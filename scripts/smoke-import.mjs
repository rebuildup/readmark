#!/usr/bin/env bun
/**
 * readmark — one-shot browser smoke for the #3 import flow.
 *
 * NOT a permanent E2E harness. Run once with:
 *
 *   bun scripts/smoke-import.mjs
 *
 * Verifies (against `bun run preview`):
 *   1. `pdf.worker.min-*.mjs` is fetched and instantiated as a
 *      Worker (not a fake-worker fallback).
 *   2. No "fake worker" / "please use the legacy build"
 *      warning in the console.
 *   3. A real PDF, dropped through the UI's file input, lands
 *      in IndexedDB (`documents`, `documentSources`,
 *      `documentBlobs`) and shows in the library list.
 *   4. Re-importing the same PDF does NOT add a duplicate
 *      row (fingerprint dedup).
 *
 * Exits non-zero on the first failed assertion. Output is a
 * line-by-line trace of what was checked. Designed to be run
 * manually before marking the ticket's PR Ready for review.
 *
 * The preview server, browser launch, stable-count reads and
 * failure signalling live in `scripts/smoke-harness.mjs`, shared
 * with the other smokes.
 */

import { PDFDocument } from 'pdf-lib';

import {
	fail,
	findStoreCount,
	launchBrowser,
	PREVIEW_URL,
	readStableCount,
	readStoreCounts,
	withPreview,
} from './smoke-harness.mjs';

const log = (msg) => console.log(`[smoke] ${msg}`);

/** Generate a 2-page PDF in memory for the import test. */
async function makeTestPdfBytes() {
	const pdf = await PDFDocument.create();
	pdf.addPage();
	pdf.addPage();
	pdf.setTitle('Smoke import test');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
}

/**
 * Wait for the import button to round-trip through a busy=true →
 * busy=false transition.
 *
 * Why this is two waits in one (observing the transition), not
 * "wait for aria-busy !== 'true'":
 *   - After `setInputFiles`, there is a window before React commits
 *     `setBusy(true)`. A locator check that runs in that window
 *     sees `false` and resolves immediately — we'd never observe
 *     that the import actually started, only that it ended.
 *   - True→false proves the handler both ran and returned. If the
 *     `setInputFiles` event never reaches the change handler
 *     (eg. the input is removed), busy never flips to true and
 *     the first sub-wait times out → `fail()`.
 *
 * Why use `window.__rmSawBusy` instead of a no-op `expect.toHave*`:
 *   - Playwright's `expect()` lives in `@playwright/test`, which
 *     this script does not import (vanilla Playwright + Bun). We
 *     reach for `waitForFunction` and stitch the two halves via
 *     a closure-scoped flag.
 */
async function waitForBusyRoundTrip(page, label) {
	const SENTINEL = '__rmSawBusy__' + Math.random().toString(36).slice(2);
	// Inject the sentinel on first observation.
	await page.evaluate((key) => {
		if (!(key in window)) {
			Object.defineProperty(window, key, { value: false, writable: true, configurable: true });
		}
	}, SENTINEL);
	// Phase 1: wait for aria-busy="true". `polling: 30` (instead of
	// the default 'raf') so we sample the DOM at ≤30ms cadence and
	// catch the busy=true window on sub-frame imports. Without
	// `await Promise.resolve()` between setBusy(true) and the
	// downstream await, React 19's automatic batching collapses
	// both states into one render and this wait would never resolve.
	await page.waitForFunction(
		(key) => {
			const busy = document
				.querySelector('[data-testid="rm-import-button"]')
				?.getAttribute('aria-busy');
			if (busy === 'true') {
				window[key] = true;
				return true;
			}
			return false;
		},
		SENTINEL,
		{ timeout: 15_000, polling: 30 },
	);
	// Phase 2: wait for the busy→idle transition (and only that,
	// not the initial idle state — guarded by the sentinel).
	await page.waitForFunction(
		(key) => {
			const busy = document
				.querySelector('[data-testid="rm-import-button"]')
				?.getAttribute('aria-busy');
			if (!window[key]) return false;
			return busy !== 'true';
		},
		SENTINEL,
		{ timeout: 15_000, polling: 30 },
	);
	// Reset so subsequent round-trips start clean.
	await page.evaluate((key) => {
		window[key] = false;
	}, SENTINEL);
	log(`${label} round-tripped (import button busy=true → busy=false)`);
}

async function main() {
	await withPreview(async () => {
		log('preview server is up');

		const browser = await launchBrowser();
		const context = await browser.newContext();
		const page = await context.newPage();

		// Capture every request so we can verify the worker URL
		// actually goes out.
		const workerRequests = [];
		const consoleErrors = [];
		const consoleWarns = [];
		page.on('request', (req) => {
			const url = req.url();
			if (/pdf\.worker(\.min)?-[^/]+\.mjs/.test(url)) {
				workerRequests.push({ url, resourceType: req.resourceType() });
			}
		});
		page.on('console', (msg) => {
			const text = msg.text();
			if (msg.type() === 'error') consoleErrors.push(text);
			if (msg.type() === 'warning' || msg.type() === 'warn') consoleWarns.push(text);
		});

		log('loading library page');
		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

		// --- Generate a real PDF in memory ---
		const pdfBytes = await makeTestPdfBytes();
		log(`generated test PDF: ${pdfBytes.byteLength} bytes`);

		// --- Trigger the import flow ---
		// The hidden <input type="file"> has data-testid="rm-document-import-input".
		// `.first()` because the library's empty state renders a second
		// import control with the same testid; the header control is
		// the first one and exists in every state.
		const fileInput = page.locator('[data-testid="rm-document-import-input"]').first();
		await fileInput.setInputFiles({
			name: 'smoke.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(pdfBytes),
		});
		await waitForBusyRoundTrip(page, 'import #1');
		// The library list should now have exactly one entry. Use
		// the stable-read helper so we don't catch the count mid-write.
		const libraryItems = page.locator('main ul li');
		await libraryItems.first().waitFor({ state: 'visible', timeout: 5_000 });
		const firstCount = await readStableCount(libraryItems);
		if (firstCount !== 1) fail(`expected 1 library entry after first import, got ${firstCount}`);
		log(`library has ${firstCount} entry after first import`);

		// After import the worker asset MUST have been fetched.
		// pdf.js lazily creates the Worker the first time a PDF
		// is parsed; an empty `workerRequests` here means the
		// browser fell back to a fake-worker or our setup is
		// broken.
		if (workerRequests.length === 0) {
			fail('worker asset was never requested after import');
		}
		const workerFetch = workerRequests[0];
		log(`worker asset requested: ${workerFetch.url} (resourceType=${workerFetch.resourceType})`);
		if (workerFetch.resourceType !== 'script') {
			fail(`expected worker resourceType=script, got ${workerFetch.resourceType}`);
		}

		// --- Verify IndexedDB rows ---
		const dbStats = await readStoreCounts(page);
		log(`IndexedDB databases: ${JSON.stringify(dbStats)}`);

		const docs = findStoreCount(dbStats, 'documents');
		const sources = findStoreCount(dbStats, 'documentSources');
		const blobs = findStoreCount(dbStats, 'documentBlobs');
		if (docs !== 1) fail(`expected 1 row in documents, got ${docs}`);
		if (sources !== 1) fail(`expected 1 row in documentSources, got ${sources}`);
		if (blobs !== 1) fail(`expected 1 row in documentBlobs, got ${blobs}`);
		log('documents=1 documentSources=1 documentBlobs=1');

		// --- Re-import the same PDF: should NOT add a row ---
		await fileInput.setInputFiles({
			name: 'smoke.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(pdfBytes),
		});
		await waitForBusyRoundTrip(page, 're-import');
		// Settle: poll until the library-item count is stable across
		// three consecutive reads (200 ms apart). If dedup works, we
		// stay at 1; if dedup were broken the count would briefly hit
		// 2 and settle. Either way, the value we read here is the
		// post-import truth.
		const stableCount = await readStableCount(libraryItems);
		if (stableCount !== 1) fail(`expected 1 library entry after re-import, got ${stableCount}`);
		log(`library still has ${stableCount} entry after re-import (fingerprint dedup works)`);

		const dbStats2 = await readStoreCounts(page);
		const docs2 = findStoreCount(dbStats2, 'documents');
		const sources2 = findStoreCount(dbStats2, 'documentSources');
		const blobs2 = findStoreCount(dbStats2, 'documentBlobs');
		if (docs2 !== 1) fail(`expected documents count to stay 1 after re-import, got ${docs2}`);
		if (sources2 !== 1) fail(`expected documentSources count to stay 1, got ${sources2}`);
		if (blobs2 !== 1) fail(`expected documentBlobs count to stay 1, got ${blobs2}`);
		log('dedup confirmed at IndexedDB level');

		// --- Console diagnostics ---
		const fakeWorkerHits = [...consoleErrors, ...consoleWarns].filter((m) =>
			/fake worker|please use the .legacy. build|InvalidPDFException/i.test(m),
		);
		if (fakeWorkerHits.length > 0) {
			fail(`unexpected console diagnostics:\n${fakeWorkerHits.join('\n')}`);
		}
		log('no fake-worker / legacy-build warnings in console');

		// Sanity: total worker fetches should be ≥ 1 (imports may
		// spin up additional workers). We only need to prove the
		// worker asset was actually requested.
		if (workerRequests.length < 1) fail(`expected ≥1 worker fetches, got ${workerRequests.length}`);
		log(`total worker asset fetches: ${workerRequests.length}`);

		await browser.close();
		log('ALL SMOKE CHECKS PASSED');
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
