#!/usr/bin/env bun
/**
 * readmark — one-shot browser smoke for the #11 reader.
 *
 * NOT a permanent E2E harness. Run once with:
 *
 *   bun scripts/smoke-reader.mjs
 *
 * Verifies (against `bun run preview`):
 *   1. Library → import a 12-page fixture → 「読む」 → the reader
 *      mounts and a real `<canvas>` appears, painted by pdf.js, with
 *      its text layer built.
 *   2. The worker asset is fetched and instantiated as a Worker — no
 *      fake-worker fallback, which a "canvas appeared" assertion
 *      cannot tell apart from a main-thread render.
 *   3. Pages are lazy: with a 12-page fixture only the first page is
 *      materialized on open, and scrolling brings the last one in.
 *   4. The text layer is really selectable — a mouse drag across it
 *      produces a non-empty `window.getSelection()`, which is the
 *      property #7 depends on and which no unit test can assert.
 *   5. Zoom keeps the canvas and the text layer the same size, and
 *      the rendered page actually grows.
 *   6. Rotating 90° swaps the page viewport and the text layer
 *      follows it.
 *   7. The header has no interactive nesting, and Library is one
 *      click away.
 *   8. Reading progress: scrolling writes a `readingProgress` row, and
 *      reopening the document restores the scroll position — asserted
 *      against IndexedDB, because a row can be missing while the list
 *      still looks right.
 *   9. The same reader on a 2× display: the backing store is scaled,
 *      and the painted ink covers the whole canvas rather than its
 *      top-left quarter.
 *  10. No console errors and no fake-worker / legacy-build warnings.
 *
 * Why this exists rather than a unit test: happy-dom has no canvas,
 * no layout, no real Selection, and no IntersectionObserver. Every
 * claim above is about geometry the browser computes.
 *
 * Preview server, browser launch and store counting come from
 * `scripts/smoke-harness.mjs`.
 */

import { setTimeout as wait } from 'node:timers/promises';
import { PDFDocument } from 'pdf-lib';

import {
	fail,
	findStoreCount,
	launchBrowser,
	PREVIEW_URL,
	readStoreCounts,
	withPreview,
} from './smoke-harness.mjs';

const log = (msg) => console.log(`[smoke] ${msg}`);

// Enough pages, each tall enough, that the reader's prefetch band
// cannot cover the whole document: with three short pages, "lazy"
// would be indistinguishable from "rendered everything", and the
// smoke would pass without ever testing laziness.
const PAGE_COUNT = 12;

/** Page heights, cycled. They differ on purpose: a restore that reads
 *  a page's *reserved* height instead of its measured one looks
 *  correct on a document whose pages are all the same size, and drifts
 *  on one whose pages are not. */
const PAGE_HEIGHTS = [900, 560, 1180, 720];

/** A multi-page PDF with real text on every page, so the text layer
 *  has something to select. The words are unique per page so a
 *  selection can be attributed to a specific page. */
async function makeFixturePdf() {
	const pdf = await PDFDocument.create();
	for (let index = 1; index <= PAGE_COUNT; index++) {
		const page = pdf.addPage([420, pageHeightFor(index)]);
		page.drawText(`readmark page ${index} of ${PAGE_COUNT}`, {
			x: 40,
			y: 520,
			size: 18,
		});
		page.drawText(`selectable text for the smoke on page ${index}`, {
			x: 40,
			y: 480,
			size: 12,
		});
		// A run that is not axis-aligned inside the page. Axis-aligned
		// fixtures agree with any matrix convention, which is how a
		// transposed text layer ships: this one puts non-zero values in
		// every off-diagonal term of the composed transform.
		page.drawText('tilted run for the smoke', {
			x: 60,
			y: 380,
			size: 14,
			rotate: { type: 'degrees', angle: 30 },
		});
	}
	pdf.setTitle('readmark reader smoke');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
}

function pageHeightFor(index) {
	return PAGE_HEIGHTS[(index - 1) % PAGE_HEIGHTS.length];
}

const pageHost = (page, index) => page.locator(`[data-page-index="${index}"]`);

async function measure(page, index) {
	return await pageHost(page, index).evaluate((host) => {
		const wrapper = host.querySelector('.rm-page');
		const canvas = host.querySelector('canvas');
		const layer = host.querySelector('.rm-text-layer');
		const box = (element) =>
			element === null
				? null
				: {
						width: Math.round(element.getBoundingClientRect().width * 100) / 100,
						height: Math.round(element.getBoundingClientRect().height * 100) / 100,
					};
		return {
			wrapper: box(wrapper),
			canvas: box(canvas),
			textLayer: box(layer),
			spanCount: layer === null ? 0 : layer.querySelectorAll('span').length,
			spanText: layer === null ? '' : (layer.textContent ?? '').trim(),
		};
	});
}

/**
 * Bounding box of everything painted on a page's canvas, in DEVICE
 * pixels, plus the canvas size.
 *
 * A size assertion cannot tell a correctly painted page from one drawn
 * into a canvas twice as large: both report the right CSS size. What
 * distinguishes them is where the ink actually is.
 */
async function inkBounds(page, index) {
	return await pageHost(page, index).evaluate((host) => {
		const canvas = host.querySelector('canvas');
		if (canvas === null) return null;
		const context = canvas.getContext('2d');
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let minX = canvas.width;
		let maxX = -1;
		let minY = canvas.height;
		let maxY = -1;
		for (let y = 0; y < canvas.height; y++) {
			for (let x = 0; x < canvas.width; x++) {
				const offset = (y * canvas.width + x) * 4;
				// The page background is white; anything else is ink.
				if (pixels[offset] > 245 && pixels[offset + 1] > 245 && pixels[offset + 2] > 245) {
					continue;
				}
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
		return {
			canvasWidth: canvas.width,
			canvasHeight: canvas.height,
			empty: maxX < 0,
			minX,
			maxX,
			minY,
			maxY,
		};
	});
}

/** The single `readingProgress` row, read straight out of IndexedDB. */
async function readProgressRow(page) {
	return await page.evaluate(async () => {
		const db = await new Promise((resolve, reject) => {
			const request = indexedDB.open('readmark');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const row = await new Promise((resolve) => {
			const store = db.transaction('readingProgress', 'readonly').objectStore('readingProgress');
			const cursorRequest = store.openCursor();
			cursorRequest.onsuccess = () => resolve(cursorRequest.result?.value ?? null);
		});
		db.close();
		return row;
	});
}

/**
 * Drag a selection across the text layer with the real mouse, so the
 * browser's own hit-testing decides what gets selected.
 *
 * `diagonal` crosses the whole run box instead of travelling along the
 * baseline: after a 90° rotation the text runs top-to-bottom, and a
 * horizontal drag would travel through the gap between two lines and
 * select nothing — which would look like a broken text layer.
 */
async function selectAcrossTextLayer(page, index, { diagonal = false } = {}) {
	const box = await pageHost(page, index).evaluate((host) => {
		const span = host.querySelector('.rm-text-layer span');
		if (span === null) return null;
		const rect = span.getBoundingClientRect();
		return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
	});
	if (box === null || box.width < 4 || box.height < 4) {
		fail(`page ${index}: text layer has no measurable span (${JSON.stringify(box)})`);
	}
	await page.evaluate(() => window.getSelection()?.removeAllRanges());
	const y = box.y + box.height / 2;
	const from = { x: box.x + 1, y: diagonal ? box.y + 1 : y };
	const to = diagonal
		? { x: box.x + box.width - 1, y: box.y + box.height - 1 }
		: { x: box.x + Math.min(box.width, 120), y };
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	// Far enough to cover a whole word in either case.
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	return await page.evaluate(() => (window.getSelection()?.toString() ?? '').trim());
}

async function main() {
	await withPreview(async () => {
		log('preview server is up');
		const browser = await launchBrowser();
		const page = await browser.newPage();

		const workerRequests = [];
		const consoleErrors = [];
		const consoleWarns = [];
		page.on('request', (req) => {
			if (/pdf\.worker(\.min)?-[^/]+\.mjs/.test(req.url())) {
				workerRequests.push({ url: req.url(), resourceType: req.resourceType() });
			}
		});
		page.on('console', (msg) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
			if (msg.type() === 'warning' || msg.type() === 'warn') consoleWarns.push(msg.text());
		});

		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

		// --- Import the fixture through the library UI ---
		const bytes = await makeFixturePdf();
		await page
			.locator('[data-testid="rm-document-import-input"]')
			.first()
			.setInputFiles({
				name: 'reader-smoke.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(bytes),
			});
		await page.locator('[data-testid="rm-import-status"]').waitFor({ state: 'visible' });
		log(`imported a ${PAGE_COUNT}-page fixture`);

		// --- Open the reader ---
		await page.click('[data-testid="rm-library-row-read"]');
		await page.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await page.locator('.rm-page canvas').first().waitFor({ state: 'visible' });
		// The text layer is built after the canvas paint resolves, so
		// waiting for the canvas alone is a race: the assertions below
		// measure both layers together.
		await page
			.locator('[data-page-index="1"] .rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });
		log('reader opened, with a canvas and a text layer');

		// --- Worker, not fake ---
		if (workerRequests.length === 0) fail('worker asset was never requested');
		const fetch = workerRequests[0];
		if (fetch.resourceType !== 'script') {
			fail(`expected worker resourceType=script, got ${fetch.resourceType}`);
		}
		log(`worker asset requested as a script: ${fetch.url}`);

		// --- Page 1 is painted and layered ---
		const first = await measure(page, 1);
		if (first.canvas === null) fail('page 1 has no canvas');
		const inkAtOneX = await inkBounds(page, 1);
		if (inkAtOneX === null || inkAtOneX.empty) fail('page 1 painted no ink at all');
		if (first.canvas.width < 100) fail(`page 1 canvas looks unpainted: ${JSON.stringify(first)}`);
		if (first.textLayer === null) fail('page 1 has no text layer');
		if (first.spanCount === 0) fail('page 1 text layer has no glyph spans');
		if (first.canvas.width !== first.textLayer.width) {
			fail(
				`page 1 canvas (${first.canvas.width}) and text layer (${first.textLayer.width}) ` +
					'disagree at zoom 100%',
			);
		}
		log(`page 1: canvas ${first.canvas.width}x${first.canvas.height}, ${first.spanCount} spans`);

		// --- The text layer is selectable, for real ---
		const selected = await selectAcrossTextLayer(page, 1);
		if (selected.length === 0) {
			fail('a mouse drag across the text layer produced an empty selection');
		}
		log(`mouse drag selected ${JSON.stringify(selected)}`);

		// --- Lazy: the far end of the document is still a placeholder ---
		const lastIndex = PAGE_COUNT;
		const lastHost = pageHost(page, lastIndex);
		const lastBefore = await lastHost.locator('canvas').count();
		if (lastBefore !== 0) {
			fail(`page ${lastIndex} was rendered before it was scrolled to (${lastBefore} canvas)`);
		}
		const materialized = await page.locator('.rm-page canvas').count();
		if (materialized >= PAGE_COUNT) {
			fail(`all ${PAGE_COUNT} pages rendered on open; the reader is not lazy`);
		}
		log(
			`${materialized} of ${PAGE_COUNT} pages rendered on open; page ${lastIndex} is a placeholder`,
		);

		await lastHost.scrollIntoViewIfNeeded();
		await lastHost.locator('canvas').waitFor({ state: 'visible', timeout: 10_000 });
		// The text layer is built after the canvas paint resolves, so
		// wait for its glyphs rather than assuming both are ready when
		// the canvas appears.
		await lastHost
			.locator('.rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });
		const last = await measure(page, lastIndex);
		if (last.textLayer === null) fail(`page ${lastIndex} rendered without a text layer`);
		if (last.spanText === '') fail(`page ${lastIndex} text layer is empty`);
		log(`scrolled: page ${lastIndex} rendered (${last.spanText.slice(0, 24)}…)`);

		// --- Reading progress: written, then restored ---
		// Scroll to the middle of the document, let the debounce fire,
		// and read the row back out of IndexedDB.
		await page.evaluate(() => {
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (scroller !== null) scroller.scrollTop = scroller.scrollHeight / 2;
		});
		await page.waitForFunction(
			() => (document.querySelector('[data-testid="rm-reader-scroll"]')?.scrollTop ?? 0) > 0,
		);
		// The write is debounced; wait for the row rather than for a
		// timer this script does not own.
		let stored = null;
		for (let attempt = 0; attempt < 40; attempt++) {
			const counts = await readStoreCounts(page);
			if (findStoreCount(counts, 'readingProgress') === 1) {
				stored = await page.evaluate(async () => {
					const db = await new Promise((resolve, reject) => {
						const request = indexedDB.open('readmark');
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					});
					const row = await new Promise((resolve) => {
						const store = db
							.transaction('readingProgress', 'readonly')
							.objectStore('readingProgress');
						const cursorRequest = store.openCursor();
						cursorRequest.onsuccess = () => resolve(cursorRequest.result?.value ?? null);
					});
					db.close();
					return row;
				});
				break;
			}
			await wait(250);
		}
		if (stored === null) fail('scrolling did not write a readingProgress row');
		if (typeof stored.currentPage !== 'number' || stored.currentPage < 1) {
			fail(`stored progress has no usable page: ${JSON.stringify(stored)}`);
		}
		if (typeof stored.updatedAt !== 'number') {
			fail(`stored progress has no timestamp: ${JSON.stringify(stored)}`);
		}
		log(
			`progress written: page ${stored.currentPage}, ` +
				`position ${JSON.stringify(stored.position ?? null)}`,
		);

		// Reopen the document and check the scroller lands back there.
		await page.click('[data-testid="rm-reader-back"]');
		await page.locator('[data-testid="rm-library-search"]').waitFor({ state: 'visible' });
		await page.click('[data-testid="rm-library-row-read"]');
		await page.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await page.locator('[data-page-index="1"] .rm-text-layer span').first().waitFor({
			state: 'attached',
			timeout: 10_000,
		});
		// Wait for the layout to settle: the restore is two-phase, and
		// the second phase can only run once the target page has been
		// rendered and measured.
		await page.waitForFunction(
			() => {
				const host = document.querySelector('[data-page-index="1"] .rm-page');
				return host !== null;
			},
			undefined,
			{ timeout: 10_000 },
		);
		const restored = await page.evaluate(() => {
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (scroller === null) return null;
			const box = scroller.getBoundingClientRect();
			const middle = box.top + scroller.clientHeight / 2;
			// The page the reader is actually looking at, from the real
			// rendered layout: the invariant is "back to the page they
			// left", not "at some offset in a column of estimates".
			let looking = null;
			for (const host of document.querySelectorAll('[data-page-index]')) {
				const page = host.getBoundingClientRect();
				if (page.bottom < middle) continue;
				looking = {
					page: Number(host.getAttribute('data-page-index')),
					offsetRatio: Math.min(1, Math.max(0, (middle - page.top) / page.height)),
					rendered: host.querySelector('.rm-page') !== null,
					height: Math.round(page.height),
				};
				break;
			}
			return {
				scrollTop: scroller.scrollTop,
				looking,
				indicator:
					document.querySelector('[data-testid="rm-reader-page-indicator"]')?.textContent ?? '',
			};
		});
		if (restored === null || restored.scrollTop <= 0) {
			fail(`reopening the document did not restore the position (${JSON.stringify(restored)})`);
		}
		if (restored.looking === null) fail('could not read the restored position from the layout');
		if (restored.looking.page !== stored.currentPage) {
			fail(
				`restored to page ${restored.looking.page} but page ${stored.currentPage} was stored ` +
					`(scrollTop ${Math.round(restored.scrollTop)}, ${JSON.stringify(restored.looking)})`,
			);
		}
		// The stored ratio is applied to the target page's own height.
		// Against the provisional reservation the reader would land
		// several percent off, which is invisible on a uniform document
		// and grows down a long one.
		const storedRatio = stored.position?.pageOffsetRatio ?? 0;
		if (Math.abs(restored.looking.offsetRatio - storedRatio) > 0.05) {
			fail(
				`restored offset ${restored.looking.offsetRatio.toFixed(3)} does not match the stored ` +
					`${storedRatio.toFixed(3)} (page ${restored.looking.page}, height ` +
					`${restored.looking.height})`,
			);
		}
		log(
			`position restored on reopen: page ${restored.looking.page} at ` +
				`${restored.looking.offsetRatio.toFixed(3)} (stored ${storedRatio.toFixed(3)}), ` +
				`header "${restored.indicator.trim()}"`,
		);

		// Saving has to be live in a real browser after a restore: a
		// reader who scrolls on from where they left gets a new row, and
		// the row they had is not left stranded as the last word.
		await page.evaluate(() => {
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (scroller !== null) scroller.scrollTop += 600;
		});
		// The page may not change — a long page can absorb 600px on its
		// own — so the assertion is that the row moved at all.
		let updated = null;
		for (let attempt = 0; attempt < 40; attempt++) {
			updated = await readProgressRow(page);
			if (updated !== null && updated.updatedAt !== stored.updatedAt) break;
			await wait(250);
		}
		if (updated === null || updated.updatedAt === stored.updatedAt) {
			fail(`scrolling after a restore did not update the stored row (${JSON.stringify(updated)})`);
		}
		log(
			`progress after further scrolling: page ${updated.currentPage} at ` +
				`${Number(updated.position?.pageOffsetRatio ?? 0).toFixed(3)} (was ` +
				`${storedRatio.toFixed(3)})`,
		);

		// --- Zoom keeps the two layers registered ---
		await page.click('[data-testid="rm-zoom-in"]');
		await page.waitForFunction(
			() => document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent === '125%',
		);
		const zoomed = await measure(page, 1);
		if (zoomed.canvas.width <= first.canvas.width) {
			fail(`zoom in did not grow the page (${first.canvas.width} -> ${zoomed.canvas.width})`);
		}
		if (zoomed.canvas.width !== zoomed.textLayer.width) {
			fail(
				`after zoom the canvas (${zoomed.canvas.width}) and text layer ` +
					`(${zoomed.textLayer.width}) disagree`,
			);
		}
		if (Math.abs(zoomed.canvas.width - zoomed.wrapper.width) > 0.5) {
			fail('after zoom the canvas overflows its wrapper');
		}
		log(`zoom 125%: canvas and text layer both ${zoomed.canvas.width}px wide`);

		// --- Rotation swaps the viewport and the text layer follows ---
		await page.click('[data-testid="rm-rotate"]');
		await page.waitForFunction(() => {
			const canvas = document.querySelector('[data-page-index="1"] canvas');
			if (canvas === null) return false;
			const box = canvas.getBoundingClientRect();
			return box.width > box.height; // portrait became landscape
		});
		const rotated = await measure(page, 1);
		if (rotated.canvas.width <= rotated.canvas.height) {
			fail(`rotation did not swap the viewport: ${JSON.stringify(rotated.canvas)}`);
		}
		if (rotated.canvas.width !== rotated.textLayer.width) {
			fail(
				`after rotation the canvas (${rotated.canvas.width}) and text layer ` +
					`(${rotated.textLayer.width}) disagree`,
			);
		}
		if (rotated.spanCount === 0) fail('the text layer lost its spans after rotation');
		log(
			`rotated 90°: viewport ${rotated.canvas.width}x${rotated.canvas.height}, text layer follows`,
		);

		// --- The selection still works on a rotated, zoomed page ---
		// Page 1 has to be back on screen: the drag is a real pointer
		// gesture and cannot happen in a scrolled-away region.
		await pageHost(page, 1).scrollIntoViewIfNeeded();
		await pageHost(page, 1)
			.locator('.rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });
		const rotatedSelection = await selectAcrossTextLayer(page, 1, { diagonal: true });
		if (rotatedSelection.length === 0) {
			fail('selection stopped working after zoom + rotation');
		}
		log(`selection after rotate: ${JSON.stringify(rotatedSelection)}`);

		// --- Header shape and the way back ---
		const headerShape = await page.evaluate(() => {
			const nested = document.querySelectorAll('.rm-reader-header a button').length;
			return { nested, back: document.querySelector('[data-testid="rm-reader-back"]')?.tagName };
		});
		if (headerShape.nested !== 0) fail('the reader header nests a button inside a link');
		if (headerShape.back !== 'A') fail(`back link is not a link: ${headerShape.back}`);
		await page.click('[data-testid="rm-reader-back"]');
		await page.locator('[data-testid="rm-library-search"]').waitFor({ state: 'visible' });
		log('returned to the library');

		// --- The same reader on a 2× display ---
		// A separate context: `deviceScaleFactor` is fixed per context.
		// The assertion is about painted pixels, not attributes: a
		// missing output transform leaves the page in the top-left
		// quarter of a canvas twice as wide as it should be, which no
		// size assertion can see.
		const hidpiContext = await browser.newContext({ deviceScaleFactor: 2 });
		const hidpi = await hidpiContext.newPage();
		const hidpiErrors = [];
		hidpi.on('console', (msg) => {
			if (msg.type() === 'error') hidpiErrors.push(msg.text());
		});
		await hidpi.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
		await hidpi
			.locator('[data-testid="rm-document-import-input"]')
			.first()
			.setInputFiles({
				name: 'reader-smoke.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(bytes),
			});
		await hidpi.locator('[data-testid="rm-import-status"]').waitFor({ state: 'visible' });
		await hidpi.click('[data-testid="rm-library-row-read"]');
		await hidpi.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await hidpi
			.locator('[data-page-index="1"] .rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });

		const hidpiState = await pageHost(hidpi, 1).evaluate((host) => {
			const canvas = host.querySelector('canvas');
			const layer = host.querySelector('.rm-text-layer');
			if (canvas === null || layer === null) return null;
			return {
				dpr: window.devicePixelRatio,
				backingWidth: canvas.width,
				backingHeight: canvas.height,
				cssWidth: Math.round(canvas.getBoundingClientRect().width * 100) / 100,
				layerWidth: Math.round(layer.getBoundingClientRect().width * 100) / 100,
			};
		});
		if (hidpiState === null) fail('no canvas or text layer on the 2x display');
		if (hidpiState.dpr !== 2) fail(`expected devicePixelRatio 2, got ${hidpiState.dpr}`);
		if (hidpiState.backingWidth !== Math.floor(hidpiState.cssWidth * 2)) {
			fail(
				`backing store (${hidpiState.backingWidth}) is not 2x the CSS width ` +
					`(${hidpiState.cssWidth})`,
			);
		}
		if (hidpiState.layerWidth !== hidpiState.cssWidth) {
			fail(
				`text layer (${hidpiState.layerWidth}) is not registered with the canvas ` +
					`(${hidpiState.cssWidth}) on a 2x display`,
			);
		}

		const inkAtTwoX = await inkBounds(hidpi, 1);
		if (inkAtTwoX === null || inkAtTwoX.empty) fail('nothing was painted on the 2x display');
		// The decisive check: the same page, painted at the same place.
		// Without pdf.js's output transform the ink lands in CSS pixel
		// coordinates inside a 2x canvas, so converting back to CSS
		// units would halve every coordinate.
		const tolerance = 2;
		for (const edge of ['minX', 'maxX', 'minY', 'maxY']) {
			const atOneX = (inkAtOneX[edge] ?? 0) / 1;
			const atTwoX = (inkAtTwoX[edge] ?? 0) / 2;
			if (Math.abs(atOneX - atTwoX) > tolerance) {
				fail(
					`ink ${edge} differs between 1x (${atOneX}) and 2x (${atTwoX}) in CSS pixels; ` +
						'the page is not being painted at the device pixel ratio',
				);
			}
		}
		if (hidpiErrors.length > 0) {
			fail(`console errors on the 2x display:\n${hidpiErrors.join('\n')}`);
		}
		log(
			`2x display: backing ${hidpiState.backingWidth}x${hidpiState.backingHeight} for ` +
				`${hidpiState.cssWidth} CSS px; ink box matches the 1x reading, text layer registered`,
		);
		await hidpiContext.close();

		// --- Diagnostics ---
		const noisy = [...consoleErrors, ...consoleWarns].filter((message) =>
			/fake worker|please use the .legacy. build|InvalidPDFException|RenderingCancelled/i.test(
				message,
			),
		);
		if (noisy.length > 0) fail(`unexpected console diagnostics:\n${noisy.join('\n')}`);
		if (consoleErrors.length > 0) {
			fail(`console errors during the reader flow:\n${consoleErrors.join('\n')}`);
		}
		log('no console errors, no fake-worker or cancelled-render warnings');

		await browser.close();
		log('ALL SMOKE CHECKS PASSED');
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
