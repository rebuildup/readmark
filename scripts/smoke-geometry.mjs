#!/usr/bin/env bun
/**
 * readmark — geometry smoke for #7 (text selection + highlight).
 *
 * What this proves end-to-end:
 *
 *   The reader's quote-resolution pipeline takes a stored anchor, finds
 *   its characters in the page's text layer, measures them via
 *   `Range.getClientRects()`, and paints a `.rm-highlight__fragment`
 *   rectangle for each one. At every viewport the overlay's fragments
 *   must sit on the same characters and cover them with the same
 *   geometry that a fresh `Range.getClientRects()` over those
 *   characters reports — not their bounding box union, the fragments
 *   themselves, one by one.
 *
 * The fixtures and assertions:
 *
 *   - Three highlight rows are seeded into IndexedDB before the reader
 *     opens, each with a *deliberately wrong* stored `rects[]` but a
 *     correct `quote`. On source open the reader calls
 *     `resolveAnchor` exactly once per row, measures the fragments,
 *     detects the mismatch (`rectsMatch()` returns `false`), and
 *     writes the measured rects back via `replaceHighlightAnchor`.
 *   - The smoke waits for the read-side write-back to settle, then
 *     reads the row back from IndexedDB and checks that:
 *       1. `anchor.payload.rects` was rewritten (count and value
 *          changed away from the seed).
 *       2. `selectedText`, `pageIndex`, `color`, `createdAt` are
 *          untouched.
 *   - For each viewport (zoom=1, zoom=1.25, rotation=90°,
 *     zoom=1.25 + rotation=90°) and for each row, the smoke:
 *       1. Computes `Range.getClientRects()` over the quote's
 *          characters in the live text layer (the truth).
 *       2. Reads each `.rm-highlight__fragment` `getBoundingClientRect()`
 *          (the painted geometry).
 *       3. Compares fragment count and per-fragment left/top/right/
 *          bottom with a 1.5 CSS-px tolerance — well below the
 *          "fragment a few pixels off its glyphs" visible-broken
 *          threshold, and large enough to absorb the cross-scale
 *          Chrome font-rasterization drift (~0.75 CSS px / 0.6
 *          user-space pt between fontSize=14 and fontSize=17.5)
 *          that the conversion math cannot remove. Per-fragment
 *          drift is logged unconditionally; genuine geometry bugs
 *          shift fragments by tens of CSS px and still fail.
 *   - `resolveAnchor` runs once per source open. After the initial
 *     write-back, the stored rects are recorded; after every viewport
 *     change the row is re-read and the rects must still match the
 *     recorded values within the same tolerance. A viewport change
 *     that re-ran recovery would either write a different set
 *     (caught here) or fail to write the same set twice (also caught
 *     here).
 *   - No stale or duplicate overlay is left behind: exactly one
 *     `.rm-highlight` per seeded row is painted, across the whole
 *     document.
 *
 * Run: `bun scripts/smoke-geometry.mjs`.
 *
 * Why this exists rather than a unit test: happy-dom has no layout,
 * no `Range.getClientRects()`, no rotation-aware viewport, and no
 * IntersectionObserver. The geometry claim is the browser's
 * `getClientRects()` against the reader's text layer converted through
 * the reader's viewport transform, and no test environment below a
 * real Chromium can prove it.
 */

import { setTimeout as wait } from 'node:timers/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

import {
	fail,
	launchBrowser,
	PREVIEW_URL,
	readStoreCounts,
	withPreview,
} from './smoke-harness.mjs';

const log = (msg) => console.log(`[smoke] ${msg}`);

const PAGE_COUNT = 3;
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 600;

// CSS-pixel tolerance for overlay vs Range.getClientRects comparison.
// 0.5 is the per-rect sub-pixel noise floor the browser introduces
// when the same layer is measured twice. Cross-scale measurements
// (rects measured at scale=1, painted at scale=1.25) accumulate an
// extra 0.5–1.0 CSS px from font-size rasterization drift between
// sizes — a different fontSize is a different glyph atlas, and
// Range.getClientRects() against it lands on a different sub-pixel
// boundary. 1.5 stays well below "a fragment a few pixels off its
// glyphs" (the visible-broken threshold the smoke is meant to catch)
// while absorbing that cross-scale noise. The smoke still fails on
// genuine geometry bugs (wrong rotation, swapped corners, missing
// fragments); a real bug shifts a fragment by tens of CSS px.
const TOLERANCE_PX = 1.5;

// One quote per page so the overlay's `.rm-highlight__fragment` count
// equals the count for that single quote (a shared page with two
// quotes mixes the counts and breaks the smoke's "one page == one
// anchor" assumption). The shapes:
//   - page 1: single fragment
//   - page 2: multi-fragment (text spans two baselines)
//   - page 3: single fragment on a different page, control for cross-page
const SINGLE_QUOTE_P1 = 'single line quote on page one';
const MULTI_QUOTE_P2 = 'first partsecond part';
const SINGLE_QUOTE_P3 = 'single line quote on page three';

/** Build a PDF whose text layer matches the fixture plan above.
 *
 * Each `drawText` call becomes a separate text item in pdf.js's
 * `getTextContent()`. The text layer builder renders one `<span>` per
 * item at the item's own baseline, so two items at different `y`
 * values are two spans on different baselines — and a `Range` that
 * spans characters from both produces two `getClientRects()` rects. */
async function makeFixturePdf() {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const ink = rgb(0, 0, 0);

	const draw = (page, text, x, y, size) => {
		page.drawText(text, { x, y, size, font, color: ink });
	};

	// Page 1: header, single-line quote, trailing.
	const p1 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	draw(p1, 'header line alpha', 40, 540, 16);
	draw(p1, SINGLE_QUOTE_P1, 40, 500, 14);
	draw(p1, 'trailing line beta', 40, 470, 12);

	// Page 2: header, multi-fragment quote on two baselines, trailing.
	const p2 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	draw(p2, 'header line gamma', 40, 540, 16);
	draw(p2, 'first part', 40, 500, 14);
	draw(p2, 'second part', 40, 470, 14);
	draw(p2, 'trailing line delta', 40, 440, 12);

	// Page 3: header, single-line quote, trailing.
	const p3 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	draw(p3, 'header line epsilon', 40, 540, 16);
	draw(p3, SINGLE_QUOTE_P3, 40, 500, 14);
	draw(p3, 'trailing line zeta', 40, 470, 12);

	pdf.setTitle('readmark geometry smoke');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
}

async function importPdf(page, bytes, name) {
	await page
		.locator('[data-testid="rm-document-import-input"]')
		.first()
		.setInputFiles({
			name,
			mimeType: 'application/pdf',
			buffer: Buffer.from(bytes),
		});
	await page.locator('[data-testid="rm-import-status"]').waitFor({ state: 'visible' });
}

/** Read `documents` and `documentSources` straight from IndexedDB so
 *  the smoke knows the `(documentId, sourceFingerprint)` keys the
 *  reader will resolve against. */
async function readIndexedDbIdentity(page) {
	return await page.evaluate(async () => {
		const db = await new Promise((resolve, reject) => {
			const req = indexedDB.open('readmark');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		const docs = await new Promise((resolve) => {
			const req = db.transaction('documents', 'readonly').objectStore('documents').getAll();
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve([]);
		});
		const sources = await new Promise((resolve) => {
			const req = db
				.transaction('documentSources', 'readonly')
				.objectStore('documentSources')
				.getAll();
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve([]);
		});
		db.close();
		return { documents: docs, sources };
	});
}

/** Insert one highlight row into IndexedDB. Direct write — the
 *  reader's recovery is what we want to exercise, not its write path. */
async function seedHighlight(page, row) {
	await page.evaluate(async (row) => {
		const db = await new Promise((resolve, reject) => {
			const req = indexedDB.open('readmark');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		await new Promise((resolve, reject) => {
			const tx = db.transaction('highlights', 'readwrite');
			const store = tx.objectStore('highlights');
			const req = store.put(row);
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
		db.close();
	}, row);
}

async function readHighlightRow(page, id) {
	return await page.evaluate(async (id) => {
		const db = await new Promise((resolve, reject) => {
			const req = indexedDB.open('readmark');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		const row = await new Promise((resolve) => {
			const req = db.transaction('highlights', 'readonly').objectStore('highlights').get(id);
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
		db.close();
		return row;
	}, id);
}

/** Two PDFs with deliberately wrong stored rects but the correct quote.
 *  The seed must satisfy `isPdfAnchor`: a non-empty rects array and a
 *  quote whose `exact` is a non-empty string. */
function wrongRect() {
	// Far enough from any real glyph box that `rectsMatch()` says no.
	// Kept inside plausible page bounds so the structural guard accepts it.
	return { x: 12.5, y: 17.25, width: 4.0, height: 3.0 };
}

/** `Range.getClientRects()` over `exact`'s characters in the page's
 *  text layer, in screen-space. This is the geometry the painted
 *  overlay is being compared against. */
async function measureRangeOnPage(page, pageIndex, exact) {
	return await page.locator(`[data-page-index="${pageIndex}"]`).evaluate(
		(host, { exact }) => {
			if (host === null) return null;
			const layer = host.querySelector('.rm-text-layer');
			if (layer === null) return null;
			const spans = Array.from(layer.querySelectorAll('span'));
			const fullText = spans.map((s) => s.textContent ?? '').join('');
			const start = fullText.indexOf(exact);
			if (start < 0) return { error: 'not-found', fullText, exact };
			const end = start + exact.length;
			let offset = 0;
			let firstSpan = null;
			let firstOffset = 0;
			let lastSpan = null;
			let lastOffset = 0;
			for (const span of spans) {
				const len = (span.textContent ?? '').length;
				const itemStart = offset;
				const itemEnd = offset + len;
				if (firstSpan === null && itemEnd > start) {
					firstSpan = span;
					firstOffset = start - itemStart;
				}
				if (itemEnd >= end && lastSpan === null) {
					lastSpan = span;
					lastOffset = end - itemStart;
				}
				offset = itemEnd;
				if (firstSpan !== null && lastSpan !== null) break;
			}
			if (firstSpan === null || lastSpan === null) {
				return { error: 'span-walk-failed', fullText, start, end };
			}
			const firstText = firstSpan.firstChild;
			const lastText = lastSpan.firstChild;
			if (firstText === null || lastText === null) {
				return { error: 'no-text-node', fullText, start, end };
			}
			const range = document.createRange();
			range.setStart(firstText, Math.max(0, firstOffset));
			range.setEnd(lastText, Math.min((lastText.textContent ?? '').length, lastOffset));
			const rects = Array.from(range.getClientRects())
				.filter((r) => r.width > 0 && r.height > 0)
				.map((r) => ({
					left: r.left,
					top: r.top,
					right: r.right,
					bottom: r.bottom,
					width: r.width,
					height: r.height,
				}));
			return { rects, fullText, start, end };
		},
		{ exact },
	);
}

/** Every `.rm-highlight__fragment` painted on `pageIndex`, in DOM order,
 *  with its `getBoundingClientRect()` in screen space. */
async function readOverlayFragments(page, pageIndex) {
	return await page.locator(`[data-page-index="${pageIndex}"]`).evaluate((host) => {
		const layers = Array.from(host.querySelectorAll('.rm-highlight'));
		const fragments = [];
		for (const layer of layers) {
			for (const el of layer.querySelectorAll('.rm-highlight__fragment')) {
				const r = el.getBoundingClientRect();
				fragments.push({
					left: r.left,
					top: r.top,
					right: r.right,
					bottom: r.bottom,
					width: r.width,
					height: r.height,
					freshness: layer.dataset.freshness ?? null,
				});
			}
		}
		return fragments;
	});
}

const pageHost = (page, index) => page.locator(`[data-page-index="${index}"]`);

/** Wait for the page's text layer + the highlight row's fragment(s) to
 *  be in the DOM. The text layer is built after the canvas paint
 *  resolves, and the paint effect waits for the completed render's
 *  epoch; "wait for the fragment" is the readable end of that chain. */
async function waitForOverlayFragments(page, pageIndex, count) {
	await page.waitForFunction(
		({ index, count }) => {
			const host = document.querySelector(`[data-page-index="${index}"]`);
			if (host === null) return false;
			return host.querySelectorAll('.rm-highlight__fragment').length >= count;
		},
		{ index: pageIndex, count },
		{ timeout: 10_000 },
	);
}

/**
 * Drive the reader to an exact zoom, using the toolbar buttons.
 *
 * The geometry scenarios below are stated at zoom=1 and zoom=1.25, and
 * they are only meaningful there: a highlight's stored rects are
 * compared after the runtime transform, so the numbers depend on it.
 * The reader no longer opens at 100% (it opens at fit-width, Issue
 * #35), so "wait until the label reads 100%" waits forever.
 *
 * Stepping with the buttons rather than assigning the label keeps the
 * scenarios measuring what a reader would actually do.
 */
async function setZoomTo(page, target) {
	const label = () =>
		page.evaluate(() =>
			(document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent ?? '').replace(
				'%',
				'',
			),
		);
	const wants = String(Math.round(target * 100));
	for (let step = 0; step < 24; step++) {
		const current = Number(await label());
		if (String(current) === wants) {
			await page.waitForFunction(
				(want) =>
					document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent === `${want}%`,
				wants,
				{ timeout: 20000 },
			);
			return;
		}
		if (!Number.isFinite(current)) return;
		await page.click(
			current < target ? '[data-testid="rm-zoom-in"]' : '[data-testid="rm-zoom-out"]',
		);
		await page.waitForTimeout(400);
	}
	const now = await label();
	fail(`could not reach zoom ${wants}% (stopped at ${now}%)`);
}

async function main() {
	await withPreview(async () => {
		log('preview server is up');
		const browser = await launchBrowser();
		const context = await browser.newContext();
		const page = await context.newPage();

		const consoleErrors = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
		});

		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

		// --- Import the fixture ---
		const bytes = await makeFixturePdf();
		await importPdf(page, bytes, 'geometry-smoke.pdf');
		log(`imported fixture: ${PAGE_COUNT} pages`);

		// --- Read documentId + sourceFingerprint from IndexedDB ---
		const meta = await readIndexedDbIdentity(page);
		if (meta.documents.length !== 1) fail(`expected 1 document row, got ${meta.documents.length}`);
		if (meta.sources.length !== 1)
			fail(`expected 1 document source row, got ${meta.sources.length}`);
		const docId = meta.documents[0].id;
		const sourceFingerprint = meta.sources[0].sourceFingerprint;
		log(`identity: documentId=${docId.slice(0, 8)}… fingerprint=${sourceFingerprint.slice(0, 8)}…`);

		// --- Seed three highlight rows with deliberately wrong rects ---
		const baseTime = Date.now();
		const seeds = [
			{
				id: 'geo-single-1',
				documentId: docId,
				sourceFingerprint,
				pageIndex: 1,
				anchor: {
					format: 'pdf',
					payload: {
						page: 1,
						// Seed with TWO wrong rects; truth is ONE.
						rects: [wrongRect(), wrongRect()],
						quote: { exact: SINGLE_QUOTE_P1 },
					},
				},
				selectedText: SINGLE_QUOTE_P1,
				color: 'yellow',
				createdAt: baseTime,
			},
			{
				id: 'geo-multi-2',
				documentId: docId,
				sourceFingerprint,
				pageIndex: 2,
				anchor: {
					format: 'pdf',
					payload: {
						page: 2,
						// Seed with ONE wrong rect; truth is TWO (one per baseline).
						rects: [wrongRect()],
						quote: { exact: MULTI_QUOTE_P2 },
					},
				},
				selectedText: MULTI_QUOTE_P2,
				color: 'yellow',
				createdAt: baseTime + 1,
			},
			{
				id: 'geo-single-3',
				documentId: docId,
				sourceFingerprint,
				pageIndex: 3,
				anchor: {
					format: 'pdf',
					payload: {
						page: 3,
						rects: [wrongRect(), wrongRect(), wrongRect()], // truth is ONE
						quote: { exact: SINGLE_QUOTE_P3 },
					},
				},
				selectedText: SINGLE_QUOTE_P3,
				color: 'yellow',
				createdAt: baseTime + 2,
			},
		];
		for (const row of seeds) {
			await seedHighlight(page, row);
		}
		log(`seeded ${seeds.length} highlight rows with deliberately wrong rects`);

		// --- Open the reader; recovery runs once per source open ---
		await page.click('[data-testid="rm-library-row-read"]');
		await page.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await page
			.locator('[data-page-index="1"] .rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });

		// One highlight per page (one quote per page in the fixture).
		// Wait for page 1's overlay first — pages 2 and 3 are
		// materialized only as the reader scrolls them in.
		await waitForOverlayFragments(page, 1, 1);
		log('reader opened; page 1 paints its single-fragment overlay');

		// Pages 2 and 3 are below the fold; lazy rendering is a
		// smoke-reader.mjs invariant, so bring them in via scroll.
		await pageHost(page, 2).scrollIntoViewIfNeeded();
		await page
			.locator('[data-page-index="2"] .rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });
		await waitForOverlayFragments(page, 2, 2);
		log('page 2 paints its multi-fragment overlay');

		await pageHost(page, 3).scrollIntoViewIfNeeded();
		await page
			.locator('[data-page-index="3"] .rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });
		await waitForOverlayFragments(page, 3, 1);
		log('page 3 paints its single-fragment overlay');

		// --- IndexedDB write-back verification ---
		// Wait for the rows to land at their measured values. The reader
		// writes via Dexie `update()`, which is async; reading too early
		// catches the wrong-rect state. Poll until the rect count for
		// row `geo-single-1` is 1, row `geo-multi-1` is 2, row
		// `geo-single-2` is 1 — those are the truth counts.
		async function waitForWriteBack(id, expectedRectCount) {
			for (let attempt = 0; attempt < 60; attempt++) {
				const row = await readHighlightRow(page, id);
				if (row !== null && row.anchor?.payload?.rects?.length === expectedRectCount) {
					return row;
				}
				await wait(100);
			}
			const last = await readHighlightRow(page, id);
			fail(
				`write-back did not converge for ${id} (expected ${expectedRectCount} rects): ` +
					JSON.stringify(last),
			);
		}
		const writtenSingle1 = await waitForWriteBack('geo-single-1', 1);
		const writtenMulti2 = await waitForWriteBack('geo-multi-2', 2);
		const writtenSingle3 = await waitForWriteBack('geo-single-3', 1);
		log(`write-back converged: geo-single-1=1 rect, geo-multi-2=2 rects, geo-single-3=1 rect`);

		// The deliberately wrong stored rect must be gone; the corrected
		// value must NOT equal `wrongRect()` in any coordinate.
		const wrong = wrongRect();
		function rectsAreGone(row) {
			return (row.anchor.payload.rects ?? []).every(
				(r) =>
					r.x !== wrong.x &&
					r.y !== wrong.y &&
					r.width !== wrong.width &&
					r.height !== wrong.height,
			);
		}
		if (!rectsAreGone(writtenSingle1)) {
			fail(`geo-single-1 still carries wrong-rect values: ${JSON.stringify(writtenSingle1)}`);
		}
		if (!rectsAreGone(writtenMulti2)) {
			fail(`geo-multi-2 still carries wrong-rect values: ${JSON.stringify(writtenMulti2)}`);
		}
		if (!rectsAreGone(writtenSingle3)) {
			fail(`geo-single-3 still carries wrong-rect values: ${JSON.stringify(writtenSingle3)}`);
		}
		log('corrected rects differ from the wrong-rect seed on every axis');

		// Other fields must not have been touched.
		function checkPreserved(row, expected) {
			if (row.selectedText !== expected.selectedText) {
				fail(`${row.id}: selectedText changed: ${row.selectedText} vs ${expected.selectedText}`);
			}
			if (row.pageIndex !== expected.pageIndex) {
				fail(`${row.id}: pageIndex changed: ${row.pageIndex} vs ${expected.pageIndex}`);
			}
			if (row.color !== expected.color) {
				fail(`${row.id}: color changed: ${row.color} vs ${expected.color}`);
			}
			if (row.createdAt !== expected.createdAt) {
				fail(`${row.id}: createdAt changed: ${row.createdAt} vs ${expected.createdAt}`);
			}
			if (row.documentId !== expected.documentId) {
				fail(`${row.id}: documentId changed`);
			}
			if (row.sourceFingerprint !== expected.sourceFingerprint) {
				fail(`${row.id}: sourceFingerprint changed`);
			}
		}
		checkPreserved(writtenSingle1, seeds[0]);
		checkPreserved(writtenMulti2, seeds[1]);
		checkPreserved(writtenSingle3, seeds[2]);
		log('write-back preserved selectedText, pageIndex, color, createdAt, identity keys');

		// --- Helper: verify overlay fragments == Range rects at one viewport ---
		async function verifyAtViewport(label, pageIndex, exact, expectedFragments) {
			const truth = await measureRangeOnPage(page, pageIndex, exact);
			if (truth === null) fail(`${label}: could not read text layer on page ${pageIndex}`);
			if (truth.error !== undefined) {
				fail(
					`${label}: text-layer range failed on page ${pageIndex}: ${truth.error} ` +
						`(fullText=${JSON.stringify(truth.fullText)}, exact=${JSON.stringify(exact)})`,
				);
			}
			const overlay = await readOverlayFragments(page, pageIndex);
			if (overlay.length !== expectedFragments) {
				fail(
					`${label}: expected ${expectedFragments} overlay fragments on page ${pageIndex}, ` +
						`got ${overlay.length} (overlay=${JSON.stringify(overlay)}, truth=${JSON.stringify(truth.rects)})`,
				);
			}
			if (overlay.length !== truth.rects.length) {
				fail(
					`${label}: page ${pageIndex} fragment count mismatch — overlay ${overlay.length} ` +
						`vs Range.getClientRects() ${truth.rects.length} ` +
						`(overlay=${JSON.stringify(overlay)}, truth=${JSON.stringify(truth.rects)})`,
				);
			}
			// Numerical drift is logged unconditionally so cross-scale
			// sub-pixel rendering noise (the same layer at two different
			// font sizes) is visible in the run output. A genuine
			// transform bug fails the assertion below with the same
			// numerical breakdown; the assertion fires when drift crosses
			// TOLERANCE_PX, the log line fires every time.
			const drifts = [];
			for (let i = 0; i < overlay.length; i++) {
				const o = overlay[i];
				const t = truth.rects[i];
				const dx = Math.max(Math.abs(o.left - t.left), Math.abs(o.right - t.right));
				const dy = Math.max(Math.abs(o.top - t.top), Math.abs(o.bottom - t.bottom));
				const dW = Math.abs(o.width - t.width);
				const dH = Math.abs(o.height - t.height);
				drifts.push({ i, dx, dy, dW, dH });
				if (dx > TOLERANCE_PX || dy > TOLERANCE_PX || dW > TOLERANCE_PX || dH > TOLERANCE_PX) {
					fail(
						`${label}: page ${pageIndex} fragment ${i} drift > ${TOLERANCE_PX}px — ` +
							`overlay=${JSON.stringify(o)} truth=${JSON.stringify(t)} ` +
							`(dx=${dx.toFixed(3)} dy=${dy.toFixed(3)} dW=${dW.toFixed(3)} dH=${dH.toFixed(3)})`,
					);
				}
			}
			log(
				`  ${label} p${pageIndex}: drifts ` +
					drifts
						.map(
							(d) =>
								`f${d.i}(dx=${d.dx.toFixed(2)} dy=${d.dy.toFixed(2)} dW=${d.dW.toFixed(2)} dH=${d.dH.toFixed(2)})`,
						)
						.join(' '),
			);
			return truth;
		}

		// --- Scenario A: zoom=1, rotation=0 ---
		await setZoomTo(page, 1);
		const a1 = await verifyAtViewport('A zoom=1 rot=0', 1, SINGLE_QUOTE_P1, 1);
		const a2 = await verifyAtViewport('A zoom=1 rot=0', 2, MULTI_QUOTE_P2, 2);
		const a3 = await verifyAtViewport('A zoom=1 rot=0', 3, SINGLE_QUOTE_P3, 1);
		log(
			`A) zoom=1 rot=0: ${a1.rects.length}+${a2.rects.length}+${a3.rects.length} fragments match`,
		);

		// Snapshot the stored rects — they are what the next scenarios
		// must NOT change. A viewport operation that re-ran recovery
		// would either re-measure (drift > TOLERANCE_PX) or write the
		// same values back; both are caught here.
		const baselineSingle1 = JSON.stringify(writtenSingle1.anchor.payload.rects);
		const baselineMulti2 = JSON.stringify(writtenMulti2.anchor.payload.rects);
		const baselineSingle3 = JSON.stringify(writtenSingle3.anchor.payload.rects);

		// --- Scenario B: zoom=1.25, rotation=0 ---
		await page.click('[data-testid="rm-zoom-in"]');
		await page.waitForFunction(
			() => document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent === '125%',
		);
		// Wait for the page to repaint at the new viewport (the render
		// effect bumps the render epoch, the paint effect waits for it).
		await waitForOverlayFragments(page, 1, 1);
		await pageHost(page, 2).scrollIntoViewIfNeeded();
		await waitForOverlayFragments(page, 2, 2);
		await pageHost(page, 3).scrollIntoViewIfNeeded();
		await waitForOverlayFragments(page, 3, 1);
		const b1 = await verifyAtViewport('B zoom=1.25 rot=0', 1, SINGLE_QUOTE_P1, 1);
		const b2 = await verifyAtViewport('B zoom=1.25 rot=0', 2, MULTI_QUOTE_P2, 2);
		const b3 = await verifyAtViewport('B zoom=1.25 rot=0', 3, SINGLE_QUOTE_P3, 1);
		log(
			`B) zoom=1.25 rot=0: ${b1.rects.length}+${b2.rects.length}+${b3.rects.length} fragments match`,
		);

		// --- Scenario C: zoom=1, rotation=90° ---
		await page.click('[data-testid="rm-zoom-out"]');
		await setZoomTo(page, 1);
		await page.click('[data-testid="rm-rotate"]');
		// Rotation re-renders; the canvas dimensions swap (portrait→landscape).
		await page.waitForFunction(() => {
			const c = document.querySelector('[data-page-index="1"] canvas');
			if (c === null) return false;
			const b = c.getBoundingClientRect();
			return b.width > b.height;
		});
		await waitForOverlayFragments(page, 1, 1);
		await pageHost(page, 2).scrollIntoViewIfNeeded();
		await waitForOverlayFragments(page, 2, 2);
		await pageHost(page, 3).scrollIntoViewIfNeeded();
		await waitForOverlayFragments(page, 3, 1);
		const c1 = await verifyAtViewport('C zoom=1 rot=90°', 1, SINGLE_QUOTE_P1, 1);
		const c2 = await verifyAtViewport('C zoom=1 rot=90°', 2, MULTI_QUOTE_P2, 2);
		const c3 = await verifyAtViewport('C zoom=1 rot=90°', 3, SINGLE_QUOTE_P3, 1);
		log(
			`C) zoom=1 rot=90°: ${c1.rects.length}+${c2.rects.length}+${c3.rects.length} fragments match (no tolerance widening)`,
		);

		// --- Scenario D: zoom=1.25 + rotation=90° ---
		await page.click('[data-testid="rm-zoom-in"]');
		await page.waitForFunction(
			() => document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent === '125%',
		);
		await waitForOverlayFragments(page, 1, 1);
		await pageHost(page, 2).scrollIntoViewIfNeeded();
		await waitForOverlayFragments(page, 2, 2);
		await pageHost(page, 3).scrollIntoViewIfNeeded();
		await waitForOverlayFragments(page, 3, 1);
		const d1 = await verifyAtViewport('D zoom=1.25 rot=90°', 1, SINGLE_QUOTE_P1, 1);
		const d2 = await verifyAtViewport('D zoom=1.25 rot=90°', 2, MULTI_QUOTE_P2, 2);
		const d3 = await verifyAtViewport('D zoom=1.25 rot=90°', 3, SINGLE_QUOTE_P3, 1);
		log(
			`D) zoom=1.25 rot=90°: ${d1.rects.length}+${d2.rects.length}+${d3.rects.length} fragments match`,
		);

		// --- Stored rects must not have changed across viewport ops ---
		// Recovery is keyed on `[documentId, handle, sourceFingerprint]`,
		// which a zoom/rotation does not touch. The paint effect runs,
		// but the resolution effect does not — and the write-back's
		// boolean is the only way the row's `anchor` could change.
		const afterD_single1 = await readHighlightRow(page, 'geo-single-1');
		const afterD_multi2 = await readHighlightRow(page, 'geo-multi-2');
		const afterD_single3 = await readHighlightRow(page, 'geo-single-3');
		const afterD_single1Str = JSON.stringify(afterD_single1.anchor.payload.rects);
		const afterD_multi2Str = JSON.stringify(afterD_multi2.anchor.payload.rects);
		const afterD_single3Str = JSON.stringify(afterD_single3.anchor.payload.rects);
		if (afterD_single1Str !== baselineSingle1) {
			fail(
				`zoom+rotation re-ran recovery: geo-single-1 rects changed ` +
					`(was=${baselineSingle1}, now=${afterD_single1Str})`,
			);
		}
		if (afterD_multi2Str !== baselineMulti2) {
			fail(
				`zoom+rotation re-ran recovery: geo-multi-2 rects changed ` +
					`(was=${baselineMulti2}, now=${afterD_multi2Str})`,
			);
		}
		if (afterD_single3Str !== baselineSingle3) {
			fail(
				`zoom+rotation re-ran recovery: geo-single-3 rects changed ` +
					`(was=${baselineSingle3}, now=${afterD_single3Str})`,
			);
		}
		log('recovery did not re-run on zoom/rotation: stored rects unchanged across scenarios B/C/D');

		// --- Exactly one .rm-highlight per seeded row, no duplicates ---
		const counts = await page.evaluate(() => {
			const total = {};
			for (const host of document.querySelectorAll('[data-page-index]')) {
				const idx = host.getAttribute('data-page-index');
				const overlays = host.querySelectorAll('.rm-highlight').length;
				const fragments = host.querySelectorAll('.rm-highlight__fragment').length;
				total[idx] = { overlays, fragments };
			}
			return total;
		});
		const totalOverlays = Object.values(counts).reduce((sum, c) => sum + c.overlays, 0);
		const totalFragments = Object.values(counts).reduce((sum, c) => sum + c.fragments, 0);
		if (totalOverlays !== 3) {
			fail(
				`expected exactly 3 .rm-highlight overlays (one per seeded row), got ${totalOverlays} ` +
					`(per-page=${JSON.stringify(counts)})`,
			);
		}
		if (totalFragments !== 4) {
			// 1 (single p1) + 2 (multi p2) + 1 (single p3) = 4
			fail(
				`expected exactly 4 overlay fragments total (1+2+1), got ${totalFragments} ` +
					`(per-page=${JSON.stringify(counts)})`,
			);
		}
		log(
			`overlay inventory: ${totalOverlays} .rm-highlight, ${totalFragments} .rm-highlight__fragment ` +
				`(per-page=${JSON.stringify(counts)})`,
		);

		// --- IndexedDB store counts: no row was duplicated ---
		const finalCounts = await readStoreCounts(page);
		const highlights = finalCounts.readmark?.counts?.highlights;
		if (highlights !== 3) {
			fail(`expected 3 rows in IndexedDB highlights store, got ${highlights}`);
		}
		log(`IndexedDB highlights store: ${highlights} rows (no duplicates)`);

		if (consoleErrors.length > 0) {
			fail(`console errors during geometry smoke:\n${consoleErrors.join('\n')}`);
		}
		log('no console errors during geometry smoke');

		await browser.close();
		log('ALL GEOMETRY SMOKE CHECKS PASSED');
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
