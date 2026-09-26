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
 * manually before marking PR #24 Ready for review.
 */

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';

// Some sandboxed environments ship NSS / NSPR outside the
// default loader path. If `chrome-libs` is present in $HOME,
// prepend it so the headless shell can resolve its libs.
const CHROME_LIBS = `${process.env.HOME}/chrome-libs/usr/lib/x86_64-linux-gnu`;
const extraLd =
	(await Bun.file(CHROME_LIBS).exists().catch(() => false)) || (await Bun.file(`${CHROME_LIBS}/libnspr4.so`).exists().catch(() => false))
		? CHROME_LIBS
		: '';

const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

/** Generate a 2-page PDF in memory for the import test. */
async function makeTestPdfBytes() {
	const pdf = await PDFDocument.create();
	pdf.addPage();
	pdf.addPage();
	pdf.setTitle('Smoke import test');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
}

async function withPreview(fn) {
	const proc = spawn('bun', ['run', 'preview'], {
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, NODE_ENV: 'production' },
	});
	// Wait for the server to be ready by polling the root URL.
	for (let i = 0; i < 50; i++) {
		try {
			const res = await fetch(PREVIEW_URL);
			if (res.ok) break;
		} catch {
			/* still starting */
		}
		await wait(200);
	}
	try {
		return await fn();
	} finally {
		proc.kill('SIGTERM');
	}
}

const log = (msg) => console.log(`[smoke] ${msg}`);
const fail = (msg) => {
	console.error(`[smoke] FAIL: ${msg}`);
	process.exit(1);
};

async function main() {
	await withPreview(async () => {
		log('preview server is up');

		const browser = await chromium.launch({
			args: ['--no-sandbox', '--disable-dev-shm-usage'],
			env: extraLd ? { ...process.env, LD_LIBRARY_PATH: `${extraLd}:${process.env.LD_LIBRARY_PATH ?? ''}` } : undefined,
		});
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
		const fileInput = page.locator('[data-testid="rm-document-import-input"]');
		await fileInput.setInputFiles({
			name: 'smoke.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(pdfBytes),
		});

		// Wait for the success toast to appear ("X ページを取り込みました").
		const successToast = page.locator('text=/ページを取り込みました/');
		await successToast.waitFor({ state: 'visible', timeout: 15_000 });
		log('success toast visible');

		// The library list should now have exactly one entry.
		const libraryItems = page.locator('main ul li');
		await libraryItems.first().waitFor({ state: 'visible', timeout: 5_000 });
		const firstCount = await libraryItems.count();
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
		const dbStats = await page.evaluate(async () => {
			// Open the Dexie-managed database by name. The Dexie
			// default name is "readmark" (or whatever db.ts set).
			// We don't know the exact name from here, so list
			// databases via indexedDB.databases().
			const dbs = await indexedDB.databases();
			const result = {};
			for (const { name } of dbs) {
				if (!name) continue;
				result[name] = await new Promise((resolve, reject) => {
					const req = indexedDB.open(name);
					req.onsuccess = () => {
						const db = req.result;
						const stores = Array.from(db.objectStoreNames);
						const counts = {};
						let pending = stores.length;
						if (!pending) {
							db.close();
							resolve({ stores: [], counts });
							return;
						}
						for (const store of stores) {
							try {
								const tx = db.transaction(store, 'readonly');
								const cr = tx.objectStore(store).count();
								cr.onsuccess = () => {
									counts[store] = cr.result;
									if (--pending === 0) {
										db.close();
										resolve({ stores, counts });
									}
								};
								cr.onerror = () => {
									if (--pending === 0) {
										db.close();
										resolve({ stores, counts });
									}
								};
							} catch (err) {
								if (--pending === 0) {
									db.close();
									resolve({ stores, counts, err: String(err) });
								}
							}
						}
					};
					req.onerror = () => reject(req.error);
				});
			}
			return result;
		});
		log(`IndexedDB databases: ${JSON.stringify(dbStats)}`);

		const findStore = (obj, name) => {
			for (const k of Object.keys(obj)) {
				if (obj[k]?.stores?.includes(name)) return obj[k].counts[name];
			}
			return undefined;
		};
		const docs = findStore(dbStats, 'documents');
		const sources = findStore(dbStats, 'documentSources');
		const blobs = findStore(dbStats, 'documentBlobs');
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
		// Wait for the success toast to reappear.
		await successToast.waitFor({ state: 'visible', timeout: 15_000 });
		await wait(500); // give IndexedDB writes a tick to settle
		const secondCount = await libraryItems.count();
		if (secondCount !== 1) fail(`expected 1 library entry after re-import, got ${secondCount}`);
		log(`library still has ${secondCount} entry after re-import (fingerprint dedup works)`);

		const dbStats2 = await page.evaluate(async () => {
			const dbs = await indexedDB.databases();
			const result = {};
			for (const { name } of dbs) {
				if (!name) continue;
				result[name] = await new Promise((resolve) => {
					const req = indexedDB.open(name);
					req.onsuccess = () => {
						const db = req.result;
						const stores = Array.from(db.objectStoreNames);
						const counts = {};
						let pending = stores.length;
						if (!pending) {
							db.close();
							resolve({ stores, counts });
							return;
						}
						for (const store of stores) {
							const cr = db.transaction(store, 'readonly').objectStore(store).count();
							cr.onsuccess = () => {
								counts[store] = cr.result;
								if (--pending === 0) {
									db.close();
									resolve({ stores, counts });
								}
							};
						}
					};
				});
			}
			return result;
		});
		const docs2 = findStore(dbStats2, 'documents');
		const sources2 = findStore(dbStats2, 'documentSources');
		const blobs2 = findStore(dbStats2, 'documentBlobs');
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
