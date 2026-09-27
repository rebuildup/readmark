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
 *      mounts and a real `<canvas>` appears, painted by pdf.js.
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
 *   8. No console errors and no fake-worker / legacy-build warnings.
 *
 * Why this exists rather than a unit test: happy-dom has no canvas,
 * no layout, no real Selection, and no IntersectionObserver. Every
 * claim above is about geometry the browser computes.
 *
 * Preview server, browser launch and store counting come from
 * `scripts/smoke-harness.mjs`.
 */

import { PDFDocument } from 'pdf-lib';

import { fail, launchBrowser, PREVIEW_URL, withPreview } from './smoke-harness.mjs';

const log = (msg) => console.log(`[smoke] ${msg}`);

// Enough pages, each tall enough, that the reader's prefetch band
// cannot cover the whole document: with three short pages, "lazy"
// would be indistinguishable from "rendered everything", and the
// smoke would pass without ever testing laziness.
const PAGE_COUNT = 12;

/** A multi-page PDF with real text on every page, so the text layer
 *  has something to select. The words are unique per page so a
 *  selection can be attributed to a specific page. */
async function makeFixturePdf() {
	const pdf = await PDFDocument.create();
	for (let index = 1; index <= PAGE_COUNT; index++) {
		const page = pdf.addPage([420, 900]);
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
	}
	pdf.setTitle('readmark reader smoke');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
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
		log('reader opened and a canvas is present');

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
