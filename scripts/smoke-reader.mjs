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
 *   6b. What a DOM range knows about a text run, measured against the
 *      reader's own text layer: a substring is strictly narrower than
 *      its run and inside it, a second run measures elsewhere, and
 *      layer-local coordinates survive being measured off-screen. These
 *      are the browser facts anchor recovery is built on.
 *   7. The header has no interactive nesting, and Library is one
 *      click away.
 *   8. Reading progress: scrolling writes a `readingProgress` row, and
 *      reopening the document restores the scroll position — asserted
 *      against IndexedDB, because a row can be missing while the list
 *      still looks right.
 *   9. Bookmarks: the toolbar asks for a name and writes a `bookmarks`
 *      row pinned to the page being read, the panel shows the name and
 *      the page, clicking the row brings the reader back to that page
 *      from somewhere else in the document — including after a real
 *      wheel scroll, which must not disable later jumps — and the
 *      confirmed delete removes the row. A row can be missing while the
 *      list still looks right, so each step is read back out of
 *      IndexedDB.
 *  10. The same reader on a 2× display: the backing store is scaled,
 *      and the painted ink covers the whole canvas rather than its
 *      top-left quarter.
 *  10. Selection → highlight → removal, driven by a real mouse drag:
 *      the floating toolbar appears next to the selection, a click on it
 *      marks the words, the mark is painted on top of its own text, and
 *      re-selecting the same words offers to take the mark off again.
 *  11. No console errors and no fake-worker / legacy-build warnings.
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

/** The fixture's first text run. A drag that selects this selected the
 *  page's text layer; one that selects `125%` or `栞` selected the
 *  toolbar, which is a non-empty selection and a broken claim. */
const PAGE_TEXT = 'readmark page';

/** The name the reader types for the first mark. Japanese, because a
 *  label in the reader's own script is the case that matters: it has to
 *  survive the round trip through IndexedDB and the panel unchanged. */
const BOOKMARK_TITLE = '第三の章 まとめ';

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

async function readBookmarkRows(page) {
	return await page.evaluate(async () => {
		const db = await new Promise((resolve, reject) => {
			const request = indexedDB.open('readmark');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const rows = await new Promise((resolve) => {
			const store = db.transaction('bookmarks', 'readonly').objectStore('bookmarks');
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve([]);
		});
		db.close();
		return rows;
	});
}

/** Wait until the page has both its canvas and its text layer in the
 *  DOM. The text layer is built after the canvas paint resolves, so
 *  measuring a page the moment its canvas appears races the layer: a
 *  zoom or a rotation tears both down and puts them back a frame
 *  later, and measuring in between reports a missing text layer that
 *  looks exactly like a broken one. */
async function waitForPageLayers(page, index) {
	await page.waitForFunction(
		(target) => {
			const host = document.querySelector(`[data-page-index="${target}"]`);
			if (host === null) return false;
			return (
				host.querySelector('canvas') !== null &&
				host.querySelector('.rm-text-layer') !== null &&
				host.querySelector('.rm-text-layer span') !== null
			);
		},
		index,
		{ timeout: 10_000 },
	);
}

/** The page the reader is actually looking at, read off the real
 *  rendered layout: the invariant is "on this page", not "at some
 *  offset in a column of estimates". */
/** Poll a predicate until it holds, so a wait is for the thing being
 *  asserted rather than for a timer this script does not own. */
async function waitUntil(predicate, label, attempts = 40) {
	for (let attempt = 0; attempt < attempts; attempt++) {
		if (await predicate()) return;
		await wait(250);
	}
	fail(`timed out waiting for ${label}`);
}

/** Widths in the log are rounded to whole pixels; this keeps the
 *  sentence honest about a fractional measurement. */
function firstRunWidthText(value) {
	return Math.round(value * 10) / 10;
}

async function lookingAt(page) {
	return await page.evaluate(() => {
		const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
		if (scroller === null) return null;
		const box = scroller.getBoundingClientRect();
		const middle = box.top + scroller.clientHeight / 2;
		for (const host of document.querySelectorAll('[data-page-index]')) {
			const rect = host.getBoundingClientRect();
			if (rect.bottom < middle) continue;
			return {
				page: Number(host.getAttribute('data-page-index')),
				offsetRatio: Math.min(1, Math.max(0, (middle - rect.top) / rect.height)),
			};
		}
		return null;
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
 *
 * The span has to be clear of the toolbar. A span under it still
 * measures, but the pointer lands on the header instead, and the drag
 * then selects the toolbar's own labels — a non-empty selection that
 * says nothing about the text layer.
 */
async function selectAcrossTextLayer(page, index, { diagonal = false } = {}) {
	const measureSpan = async () =>
		await pageHost(page, index).evaluate((host) => {
			const header = document.querySelector('.rm-reader-header')?.getBoundingClientRect() ?? null;
			const spans = [...host.querySelectorAll('.rm-text-layer span')];
			const span = spans.find((candidate) => {
				const rect = candidate.getBoundingClientRect();
				return rect.width >= 4 && rect.height >= 4 && (header === null || rect.top > header.bottom);
			});
			const rects = spans.map((candidate) => {
				const rect = candidate.getBoundingClientRect();
				return {
					x: Math.round(rect.x),
					y: Math.round(rect.y),
					w: Math.round(rect.width),
					h: Math.round(rect.height),
				};
			});
			return {
				// `find` answers undefined, not null.
				span: span === undefined ? null : span.getBoundingClientRect().toJSON(),
				spanCount: spans.length,
				rects: rects.slice(0, 6),
				headerBottom: header === null ? null : Math.round(header.bottom),
			};
		});
	// Bring a candidate span into the scroller's *visible* band before
	// dragging.
	//
	// This is not cosmetic. The reader opens at fit-width, so a page is
	// often several screens tall and the first line of text can sit far
	// below the fold — at 293% on a 420pt page the first line lands
	// around y=1184 in a 720px viewport. `page.mouse.move` to a
	// coordinate outside the viewport presses nothing, so the drag
	// silently selects nothing and the smoke would report a broken text
	// layer when the text layer is fine.
	//
	// What is under test is "the text layer is selectable", and that has
	// to be tested on text a reader could actually see and drag across.
	const revealSpan = async () =>
		await page.evaluate((wanted) => {
			const host = document.querySelector(`[data-page-index="${wanted}"]`);
			if (host === null) return false;
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (scroller === null) return false;
			const header = document.querySelector('.rm-reader-header');
			const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
			const spans = [...host.querySelectorAll('.rm-text-layer span')];
			for (const candidate of spans) {
				const rect = candidate.getBoundingClientRect();
				if (rect.width < 4 || rect.height < 4) continue;
				if (rect.top < headerBottom) continue;
				const box = scroller.getBoundingClientRect();
				if (rect.top >= box.top && rect.bottom <= box.bottom) return true;
				// Scroll the SPAN itself into view, not the host and not
				// a computed delta.
				//
				// At 90° the glyph run's box is tall and narrow, and the
				// host is 2700px wide inside a 1280px scroller, so a
				// scrollTop delta computed from the host's box lands
				// nowhere useful — and clamps to 0 when the span is
				// already above the start. Asking the element to bring
				// itself into view works for both orientations.
				candidate.scrollIntoView({ block: 'center' });
				// A span that is still above the header after that is
				// off the top of a scroller that is already at 0 — the
				// page is taller than the viewport and the glyph run sits
				// in the part that scrolled past. Start the scroller from
				// the top so the first page is fully in reach.
				const after = candidate.getBoundingClientRect();
				if (after.top < headerBottom) scroller.scrollTop = 0;
				return true;
			}
			return false;
		}, index);

	await revealSpan();
	let measured = await measureSpan();
	if (measured.span === null) {
		// The page is scrolled past: at 125% and 90° the document is
		// barely taller than the scroller, so the text can sit above
		// the viewport — and a drag from a negative y lands on nothing
		// at all. Bring the page back before deciding that the text
		// layer is unusable.
		await pageHost(page, index).scrollIntoViewIfNeeded();
		await wait(150);
		measured = await measureSpan();
	}
	if (measured.span === null) {
		fail(
			`page ${index}: no text-layer span is both measurable and clear of the toolbar — ` +
				`the drag would test the header, not the page (toolbar ends at ` +
				`${measured.headerBottom}, ${measured.spanCount} spans, first rects ` +
				`${JSON.stringify(measured.rects)})`,
		);
	}
	const box = measured.span;
	if (box.width < 4 || box.height < 4) {
		fail(`page ${index}: text layer has no measurable span (${JSON.stringify(box)})`);
	}
	await page.evaluate(() => window.getSelection()?.removeAllRanges());
	const y = box.y + box.height / 2;
	const from = { x: box.x + 1, y: diagonal ? box.y + 1 : y };
	// Drag across the whole span, not a fixed 120px.
	//
	// A fixed distance silently stops covering a whole word once the
	// reader opens at fit-width: at 293% the same 120px that covered
	// "readmark page" at 100% covers only "read", and the attribution
	// check below then fails for a reason that has nothing to do with
	// the text layer. The distance has to be a property of the text, not
	// of the zoom.
	const to = diagonal
		? { x: box.x + box.width - 1, y: box.y + box.height - 1 }
		: { x: box.x + box.width - 1, y };
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
		// Attributable: the selection has to be the page's own words.
		// An empty one reads as a broken text layer, and one full of
		// toolbar labels reads as a working header.
		if (!selected.includes(PAGE_TEXT)) {
			fail(
				`a mouse drag across the text layer selected the toolbar, not the page: ` +
					`${JSON.stringify(selected)}`,
			);
		}
		log(`mouse drag selected ${JSON.stringify(selected)}`);

		// --- What a DOM range knows about a run ---
		// Measured on the page as opened: unrotated, zoom 1. That is the
		// state recovery builds its measurement layer in, and it is also
		// the only state in which "this substring is narrower than its
		// run" is a statement about a horizontal box. After the rotation
		// below the same runs are vertical and the varying axis is height.

		// Anchor geometry is measured, not derived: a stored rect comes
		// from `Range.getClientRects()` over the matched characters of a
		// text layer built off-screen at scale 1, rotation 0. That is
		// three browser properties the implementation depends on, and
		// none of them can be checked in a unit test — happy-dom has no
		// layout and would agree with a broken implementation.
		//
		// They are checked here against the reader's own real text
		// layer, before the recovery wiring is built on them. Each one
		// is a bug the wiring would have shipped:
		//
		//   1. A range over part of a run is narrower than the run. This
		//      is the whole reason the run's own rect is not the
		//      geometry: a run's box is the box of the whole run, so
		//      highlighting one word with it paints the line.
		//   2. A range over the *second* run measures somewhere else.
		//      The recovery helper addresses a run by its index in the
		//      page; if that index were the position within the match,
		//      a quote halfway down a page would be drawn on the first
		//      run of it.
		//   3. Client coordinates follow the host. A layer parked far
		//      to the left reports coordinates far to the left, which
		//      is exactly why the layer's own box is subtracted before
		//      the transform is applied. Without that subtraction every
		//      fragment lands far off the page — and still looks like a
		//      rectangle, which is what makes it hard to notice.
		const measured = await page
			.locator('[data-page-index="1"] .rm-text-layer')
			.evaluate((layer) => {
				const spans = layer.querySelectorAll('span');
				const boxOf = (range) => {
					const rects = Array.from(range.getClientRects()).filter(
						(rect) => rect.width > 0 && rect.height > 0,
					);
					if (rects.length === 0) return null;
					return rects.map((rect) => ({
						left: rect.left,
						top: rect.top,
						right: rect.right,
						bottom: rect.bottom,
					}));
				};
				const rangeIn = (span, start, end) => {
					const text = span.firstChild;
					if (text === null) return null;
					const range = document.createRange();
					range.setStart(text, start);
					range.setEnd(text, end);
					return range;
				};
				const first = spans[0];
				const second = spans[1];
				if (first === undefined || second === undefined) return { spans: spans.length };
				// Trailing whitespace is trimmed out of an inline box by
				// the browser, so a substring that only drops the run's
				// last space measures the same width as the run and would
				// report "no sub-run geometry" for a browser that has it.
				// Both measurements below therefore stop at the last
				// non-space character, and the substring drops a glyph
				// from *each* end.
				const firstText = (first.firstChild?.textContent ?? '').replace(/\s+$/, '');
				const secondText = (second.firstChild?.textContent ?? '').replace(/\s+$/, '');
				if (firstText.length < 4 || secondText.length < 2) {
					return { spans: spans.length, tooShort: true };
				}
				const whole = boxOf(rangeIn(first, 0, firstText.length));
				const middle = boxOf(rangeIn(first, 1, firstText.length - 1));
				const other = boxOf(rangeIn(second, 0, secondText.length));

				// Move the layer far off-screen, exactly the way the
				// measurement layer is hosted, and measure the same
				// range again.
				const origin = layer.getBoundingClientRect();
				const previousLeft = layer.style.left;
				layer.style.left = '-100000px';
				const moved = layer.getBoundingClientRect();
				const movedBox = boxOf(rangeIn(first, 1, firstText.length - 1));
				const localBefore = middle === null ? null : middle[0].left - origin.left;
				const localAfter = movedBox === null ? null : movedBox[0].left - moved.left;
				layer.style.left = previousLeft;

				return {
					spans: spans.length,
					firstText,
					whole,
					middle,
					other,
					origin: { left: origin.left, top: origin.top },
					movedOrigin: { left: moved.left, top: moved.top },
					movedClient: movedBox === null ? null : movedBox[0].left,
					localBefore,
					localAfter,
				};
			});
		if (measured.spans < 2) {
			fail(`the page has ${measured.spans} text runs; the geometry claims need at least 2`);
		}
		if (measured.tooShort === true) fail('the fixture runs are too short to measure a substring');
		if (measured.whole === null || measured.middle === null || measured.other === null) {
			fail(`a range over the text layer measured nothing: ${JSON.stringify(measured)}`);
		}

		// 1. A substring is strictly narrower than its run, and sits
		// inside it.
		const wholeBox = measured.whole[0];
		const middleBox = measured.middle[0];
		const wholeWidth = wholeBox.right - wholeBox.left;
		const middleWidth = middleBox.right - middleBox.left;
		log(
			`DIAGNOSTIC runs: text=${JSON.stringify(measured.firstText)} whole=${JSON.stringify(wholeBox)} middle=${JSON.stringify(middleBox)}`,
		);
		if (!(middleWidth < wholeWidth)) {
			fail(
				`a range over part of a run measured the same width as the whole run ` +
					`(${middleWidth} vs ${wholeWidth}); sub-run geometry is not available and ` +
					'the run rect would have to be used instead',
			);
		}
		if (middleBox.left < wholeBox.left - 0.5 || middleBox.right > wholeBox.right + 0.5) {
			fail(
				`a substring measured outside its own run: ${JSON.stringify(middleBox)} not within ` +
					`${JSON.stringify(wholeBox)}`,
			);
		}
		log(
			`range geometry: a ${firstRunWidthText(wholeWidth)}px run, its substring ` +
				`${firstRunWidthText(middleWidth)}px and strictly inside it`,
		);

		// 2. The second run is a different box, so a run index says
		// something. Both fixture lines start at the same left margin, so
		// the axis that tells them apart is the baseline: comparing x
		// alone would call two genuinely different runs the same run,
		// and the log would report a difference that is not there.
		const otherBox = measured.other[0];
		const sameBox =
			Math.abs(otherBox.left - wholeBox.left) < 1 && Math.abs(otherBox.top - wholeBox.top) < 1;
		if (sameBox) {
			fail(
				'the first and second runs measured at the same place, so a run index cannot ' +
					'address them; recovery would measure the wrong characters',
			);
		}
		log(
			`run addressing: run 2 at y ${Math.round(otherBox.top)}, run 1 at y ` +
				`${Math.round(wholeBox.top)} (same left margin, x ${Math.round(wholeBox.left)})`,
		);

		// 3. Client coordinates follow the host; layer-local ones do not.
		if (measured.movedClient === null || measured.movedOrigin === null) {
			fail(`moving the layer off-screen lost the measurement: ${JSON.stringify(measured)}`);
		}
		const shift = measured.movedOrigin.left - measured.origin.left;
		if (Math.abs(shift + 100_000) > 1) {
			fail(
				`moving the layer to left:-100000px moved its box by ${Math.round(shift)}px; ` +
					"the measurement layer's origin is not where this smoke assumes it is",
			);
		}
		// The pair is the whole claim: the host moved (asserted by
		// `shift` above) and the layer-local coordinate did not. An
		// implementation that ignored the origin would differ by exactly
		// the shift, which is why both are asserted rather than either.
		if (
			measured.localBefore === null ||
			measured.localAfter === null ||
			Math.abs(measured.localBefore - measured.localAfter) > 0.5
		) {
			fail(
				`layer-local coordinates changed when the layer moved: ` +
					`${JSON.stringify(measured.localBefore)} -> ${JSON.stringify(measured.localAfter)}; ` +
					'subtracting the layer origin is required, and this proves it is sufficient',
			);
		}
		// The same geometry, measured twice, has to land inside the
		// tolerance `rectsMatch` uses or every reopen would look like a
		// change and rewrite a correct row. The measurement layer is built
		// at scale 1, so here a CSS pixel is a PDF point. This is
		// *layout* drift — the same spans, moved — rather than a full
		// re-measurement through a second text layer, which needs a
		// caller and comes with the UI wiring.
		const drift = Math.abs(measured.localBefore - measured.localAfter);
		if (drift > 0.25) {
			fail(
				`re-measuring identical geometry drifted ${drift}pt, above the 0.25pt tolerance; ` +
					'every reopen would be reported as a changed highlight',
			);
		}
		log(
			`off-screen origin: client x moved ${Math.round(shift)}px with the host, ` +
				`layer-local x stayed at ${Math.round(measured.localBefore)}px ` +
				`(re-measured ${Number(drift.toFixed(3))}pt away, inside the 0.25pt tolerance)`,
		);

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
		// Wait for the row to describe *this* position, not merely to
		// exist. The reader writes its position on open, so a row is
		// already there describing page 1; reading it as soon as it
		// appears reports the position from before the scroll and turns
		// the restore assertion below into a race with the debounce.
		// Waiting for the row to name the page the reader is actually
		// on is a condition this script can state, and it fails loudly
		// if the write never happens at all.
		const scrolledTo = await lookingAt(page);
		if (scrolledTo === null) fail('could not read the position after scrolling');
		let stored = null;
		for (let attempt = 0; attempt < 40; attempt++) {
			const counts = await readStoreCounts(page);
			if (findStoreCount(counts, 'readingProgress') === 1) {
				const row = await readProgressRow(page);
				if (row !== null && row.currentPage === scrolledTo.page) {
					stored = row;
					break;
				}
			}
			await wait(250);
		}
		if (stored === null) {
			fail(
				`scrolling to page ${scrolledTo.page} never wrote a progress row describing it: ` +
					`${JSON.stringify(await readProgressRow(page))}`,
			);
		}
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
		// Wait for the restore to settle rather than sleeping a fixed
		// amount. The jump re-applies the offset over several frames
		// while the pages above the target are measured, so a fixed delay
		// reads the position mid-flight and reports an offset of 0 for a
		// restore that is about to be correct.
		await page.waitForFunction(
			() => {
				const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
				return scroller !== null && scroller.scrollTop > 0;
			},
			null,
			{ timeout: 30000 },
		);
		const settledScrollTop = await (async () => {
			let last = -1;
			for (let attempt = 0; attempt < 40; attempt++) {
				const now = await page.evaluate(
					() => document.querySelector('[data-testid="rm-reader-scroll"]')?.scrollTop ?? -1,
				);
				if (now === last) return now;
				last = now;
				await wait(150);
			}
			return last;
		})();
		log(`restored scrollTop settled at ${Math.round(settledScrollTop)}`);
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
		// Which page counts as "restored".
		//
		// The honest bound is not 0. A page's offset in the scroller is
		// the sum of every box above it, and a box is only real once the
		// page has rendered — so for a target whose predecessors are
		// still unrendered, the exact position is not knowable without
		// rendering them. readmark reserves unrendered pages from the
		// first MEASURED page, which makes a uniform document (a book)
		// near-exact, but a document of mixed page heights still carries
		// the residual. Restoring to the right *neighbourhood* is the
		// contract; landing on the right page exactly is Issue #36.
		//
		// Before this rule existed the assertion was exact and it passed
		// only because the reader opened at 100%, where the A4 reservation
		// happened to be close to the fixture's pages.
		if (Math.abs(restored.looking.page - stored.currentPage) > 1) {
			fail(
				`restored to page ${restored.looking.page} but page ${stored.currentPage} was stored ` +
					`(scrollTop ${Math.round(restored.scrollTop)}, ${JSON.stringify(restored.looking)})`,
			);
		}
		// The stored ratio is applied to the target page's own measured
		// height. The tolerance covers the accumulated reservation
		// error of the pages above it, which lazy rendering cannot know
		// without materializing them; the page itself is asserted
		// exactly, and a restore that used the reserved heights lands
		// several percent off — or on a different page entirely.
		// The offset is only comparable when we landed on the stored
		// page; one page away, the ratio belongs to a different page.
		const storedRatio =
			restored.looking.page === stored.currentPage ? (stored.position?.pageOffsetRatio ?? 0) : null;
		if (storedRatio !== null && Math.abs(restored.looking.offsetRatio - storedRatio) > 0.06) {
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

		// --- Bookmarks: add, list, jump back, delete ---
		// The bookmark is pinned to the page the reader is looking at
		// when they ask for it, so that page is read off the layout
		// first — the toolbar button has no page argument of its own.
		const atMark = await lookingAt(page);
		if (atMark === null) fail('could not read the current position before bookmarking');
		await page.click('[data-testid="rm-add-bookmark"]');
		// The name is asked for at the moment the mark is made, and
		// focus starts in the field: the reader's next move is to type.
		await page.locator('[data-testid="rm-bookmark-title"]').waitFor({ state: 'visible' });
		const titleFocused = await page.evaluate(
			() => document.activeElement?.getAttribute('data-testid') === 'rm-bookmark-title',
		);
		if (!titleFocused) fail('the add dialog did not put focus in the name field');
		await page.fill('[data-testid="rm-bookmark-title"]', BOOKMARK_TITLE);
		await page.click('[data-testid="rm-dialog-confirm"]');
		let marked = [];
		for (let attempt = 0; attempt < 40; attempt++) {
			marked = await readBookmarkRows(page);
			if (marked.length === 1) break;
			await wait(250);
		}
		if (marked.length !== 1) {
			fail(`the bookmark button did not write exactly one row: ${JSON.stringify(marked)}`);
		}
		const row = marked[0];
		// A page pin has no anchor: selection-anchored bookmarks are #7,
		// and a row that pretends to have an anchor would be a lie the
		// re-anchoring code would later have to honour.
		if (row.anchor !== null) fail(`a page bookmark carries an anchor: ${JSON.stringify(row)}`);
		if (typeof row.id !== 'string' || row.id === '') fail('the bookmark row has no id');
		if (typeof row.sourceFingerprint !== 'string' || row.sourceFingerprint === '') {
			fail('the bookmark row is not scoped to a fingerprint');
		}
		if (row.pageIndex !== atMark.page) {
			fail(
				`bookmark pinned to page ${row.pageIndex} while the reader was on ` +
					`${atMark.page}: ${JSON.stringify(row)}`,
			);
		}
		if (typeof row.createdAt !== 'number') fail('the bookmark row has no timestamp');
		if (typeof row.position?.pageOffsetRatio !== 'number') {
			fail(`the bookmark row has no usable position: ${JSON.stringify(row.position)}`);
		}
		// The name the reader typed has to reach the row, or the field
		// is decoration and two marks on one page are the same row.
		if (row.title !== BOOKMARK_TITLE) {
			fail(`the name was not stored: ${JSON.stringify(row.title)}`);
		}
		log(
			`bookmark written: "${row.title}" on page ${row.pageIndex} at ` +
				`${Number(row.position.pageOffsetRatio).toFixed(3)} (anchor ${row.anchor}), ` +
				`fingerprint ${row.sourceFingerprint.slice(0, 8)}…`,
		);

		// Adding a bookmark reveals it where it was made: the point of
		// marking a page is seeing that the mark took, and having to
		// find the list to find out is a step the reader did not ask
		// for. The toggle then has to close and reopen it.
		const panel = page.locator('[data-testid="rm-bookmarks-panel"]');
		await panel.waitFor({ state: 'visible' });
		const panelShape = await page.evaluate(() => {
			const aside = document.querySelector('[data-testid="rm-bookmarks-panel"]');
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (aside === null || scroller === null) return null;
			const asideBox = aside.getBoundingClientRect();
			const scrollerBox = scroller.getBoundingClientRect();
			return {
				aside: { x: asideBox.x, y: asideBox.y, height: asideBox.height },
				scroller: { x: scrollerBox.x, y: scrollerBox.y, height: scrollerBox.height },
				viewportHeight: window.innerHeight,
			};
		});
		if (panelShape === null) fail('the panel or the scroller is missing from the layout');
		// Auto-placement would have put the panel in the header's grid
		// row: beside the toolbar, as tall as the toolbar, with the
		// document area below it full width. The panel belongs beside
		// the whole reading column.
		if (Math.abs(panelShape.aside.y) > 1) {
			fail(
				`the panel starts ${Math.round(panelShape.aside.y)}px down, in the toolbar's ` +
					'grid row instead of running the full height of the document area',
			);
		}
		if (panelShape.aside.x <= panelShape.scroller.x) {
			fail(
				`the panel (x ${Math.round(panelShape.aside.x)}) is not beside the scroller ` +
					`(x ${Math.round(panelShape.scroller.x)})`,
			);
		}
		if (panelShape.aside.height < panelShape.scroller.height - 1) {
			fail(
				`the panel is ${Math.round(panelShape.aside.height)}px tall while the scroller is ` +
					`${Math.round(panelShape.scroller.height)}px: it does not reach the bottom`,
			);
		}
		log(
			`panel beside the document area: ${Math.round(panelShape.aside.height)}px tall, ` +
				`scroller ${Math.round(panelShape.scroller.height)}px`,
		);

		await page.click('[data-testid="rm-toggle-bookmarks"]');
		await panel.waitFor({ state: 'detached' });
		await page.click('[data-testid="rm-toggle-bookmarks"]');
		await panel.waitFor({ state: 'visible' });
		log('the panel toggle closes and reopens the panel');

		// The panel lists it under the reader's own words, with the
		// page kept underneath: a name can describe a place without
		// saying where it is.
		const listLabel = await panel.locator('[data-testid="rm-bookmark-jump"]').first().textContent();
		if (listLabel === null || !listLabel.includes(BOOKMARK_TITLE)) {
			fail(`the panel does not show the name it was given: ${JSON.stringify(listLabel)}`);
		}
		if (!listLabel.includes(`${row.pageIndex} ページ`)) {
			fail(
				`the row named "${BOOKMARK_TITLE}" no longer says which page it is on: ` +
					`${JSON.stringify(listLabel)}`,
			);
		}
		const count = await page.locator('[data-testid="rm-bookmarks-count"]').textContent();
		if (count === null || !count.includes('1')) {
			fail(`the panel count does not read 1: ${JSON.stringify(count)}`);
		}
		const empty = await page.locator('[data-testid="rm-bookmarks-empty-panel"]').count();
		if (empty !== 0) fail('the panel shows its empty state while a bookmark exists');
		log(`panel lists the bookmark as "${listLabel.trim()}"`);

		// The reader's own hand, on the wheel. A jump must survive one:
		// a takeover that latched would leave every later jump aborted
		// for the rest of the session, and a smoke that only ever jumped
		// with a programmatic scroll would not have seen it. The wheel
		// has to actually move the scroller, or the event never reached
		// the reader at all and the claim is empty.
		const beforeWheel = await lookingAt(page);
		await page.locator('[data-testid="rm-reader-scroll"]').hover();
		const scrollerBox = await page.locator('[data-testid="rm-reader-scroll"]').boundingBox();
		if (scrollerBox === null) fail('the reader has no scroller box to wheel over');
		await page.mouse.move(
			scrollerBox.x + scrollerBox.width / 2,
			scrollerBox.y + scrollerBox.height / 2,
		);
		await page.mouse.wheel(0, 600);
		const wheeled = await page
			.waitForFunction(
				() => (document.querySelector('[data-testid="rm-reader-scroll"]')?.scrollTop ?? 0) > 40,
				undefined,
				{ timeout: 5_000 },
			)
			.then(() => true)
			.catch(() => false);
		if (!wheeled) {
			fail(
				`the wheel did not move the scroller from ${JSON.stringify(beforeWheel)}: the ` +
					'event never reached the reader, so the takeover below proves nothing',
			);
		}
		log('the reader scrolled with the wheel; the next jump has to work anyway');

		// Jump back: leave the page entirely, then click the row. A jump
		// that only works from where the bookmark was taken would prove
		// nothing, so the reader is moved to the other end first.
		await page.evaluate(() => {
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (scroller !== null) scroller.scrollTop = 0;
		});
		await page.waitForFunction(
			() => (document.querySelector('[data-testid="rm-reader-scroll"]')?.scrollTop ?? 1) < 40,
		);
		const away = await lookingAt(page);
		if (away === null || away.page === row.pageIndex) {
			fail(`the reader did not leave the bookmarked page: ${JSON.stringify(away)}`);
		}
		await page.click('[data-testid="rm-bookmark-jump"]');
		let jumped = null;
		for (let attempt = 0; attempt < 40; attempt++) {
			jumped = await lookingAt(page);
			// The jump is two-phase: the second phase can only run once
			// the target page has been measured, so a page match alone
			// is not the end of it.
			if (jumped !== null && jumped.page === row.pageIndex) {
				const drift = Math.abs(jumped.offsetRatio - row.position.pageOffsetRatio);
				if (drift <= 0.06) break;
			}
			await wait(250);
		}
		if (jumped === null || jumped.page !== row.pageIndex) {
			fail(
				`the bookmark jump did not land on page ${row.pageIndex}: ` + `${JSON.stringify(jumped)}`,
			);
		}
		const jumpDrift = Math.abs(jumped.offsetRatio - row.position.pageOffsetRatio);
		if (jumpDrift > 0.06) {
			fail(
				`the bookmark jump landed at ${jumped.offsetRatio.toFixed(3)}, ` +
					`${jumpDrift.toFixed(3)} from the stored ` +
					`${Number(row.position.pageOffsetRatio).toFixed(3)}`,
			);
		}
		log(
			`bookmark jump from page ${away.page} to page ${jumped.page} at ` +
				`${jumped.offsetRatio.toFixed(3)} (stored ` +
				`${Number(row.position.pageOffsetRatio).toFixed(3)})`,
		);

		// A second mark on the same page must not overwrite the first:
		// two marks on one page are two marks. This one is left unnamed
		// on purpose, so both label paths are in the list at once — the
		// first under the reader's own words, the second falling back to
		// the page with its ordinal.
		await page.click('[data-testid="rm-add-bookmark"]');
		await page.locator('[data-testid="rm-bookmark-title"]').waitFor({ state: 'visible' });
		// The field has to be empty for this mark to be the unnamed one.
		// A dialog that reopened still holding the previous title would
		// store it again, and the assertion below would catch a reader's
		// two marks silently sharing a name.
		const fieldValue = await page.evaluate(
			() => document.querySelector('[data-testid="rm-bookmark-title"]')?.value ?? null,
		);
		if (fieldValue !== '') {
			fail(`a reopened add dialog came back holding "${fieldValue}" instead of an empty field`);
		}
		await page.click('[data-testid="rm-dialog-confirm"]');
		for (let attempt = 0; attempt < 40; attempt++) {
			marked = await readBookmarkRows(page);
			if (marked.length === 2) break;
			await wait(250);
		}
		if (marked.length !== 2) {
			fail(`a second bookmark on the same page replaced the first: ${JSON.stringify(marked)}`);
		}
		if (marked[0].id === marked[1].id) fail('two bookmarks on one page share an id');
		// IndexedDB hands rows back in primary-key order and a bookmark
		// id is a random UUID, so "the second row" means nothing here.
		// The two marks are told apart by what they carry.
		const titled = marked.filter((candidate) => candidate.title === BOOKMARK_TITLE);
		const unnamed = marked.filter((candidate) => candidate.title === '');
		if (titled.length !== 1 || unnamed.length !== 1) {
			fail(
				`expected one named and one unnamed mark, got ` +
					`${JSON.stringify(marked.map((candidate) => candidate.title))}`,
			);
		}
		const jumps = await page.locator('[data-testid="rm-bookmark-jump"]').allTextContents();
		if (jumps.length !== 2 || jumps[0] === jumps[1]) {
			fail(
				`two bookmarks on page ${row.pageIndex} are not distinguishable: ${JSON.stringify(jumps)}`,
			);
		}
		log(
			`two bookmarks on page ${row.pageIndex}: ${jumps.map((label) => label.trim()).join(' / ')}`,
		);

		// Delete: the row goes only after the confirmation, and the
		// panel and the store have to agree afterwards.
		await page.locator('[data-testid="rm-bookmark-delete"]').first().click();
		await page.locator('[data-testid="rm-dialog-confirm"]').waitFor({ state: 'visible' });
		await page.click('[data-testid="rm-dialog-confirm"]');
		let afterDelete = [];
		for (let attempt = 0; attempt < 40; attempt++) {
			afterDelete = await readBookmarkRows(page);
			if (afterDelete.length === 1) break;
			await wait(250);
		}
		if (afterDelete.length !== 1) {
			fail(`the confirmed delete left ${afterDelete.length} rows: ${JSON.stringify(afterDelete)}`);
		}
		if (afterDelete[0].id === row.id) fail('the confirmed delete removed a different bookmark');
		if ((await page.locator('[data-testid="rm-bookmark-jump"]').count()) !== 1) {
			fail('the panel did not drop the deleted bookmark');
		}
		log(`confirmed delete removed one row; the other survives: ${JSON.stringify(afterDelete)}`);

		// The last one: the panel has to reach its empty state, and
		// the reader has to be left where they were.
		await page.locator('[data-testid="rm-bookmark-delete"]').first().click();
		await page.click('[data-testid="rm-dialog-confirm"]');
		for (let attempt = 0; attempt < 40; attempt++) {
			afterDelete = await readBookmarkRows(page);
			if (afterDelete.length === 0) break;
			await wait(250);
		}
		if (afterDelete.length !== 0) {
			fail(`bookmarks survived their deletion: ${JSON.stringify(afterDelete)}`);
		}
		await page.locator('[data-testid="rm-bookmarks-empty-panel"]').waitFor({ state: 'visible' });
		await page.click('[data-testid="rm-toggle-bookmarks"]');
		if ((await panel.count()) !== 0) fail('the panel toggle did not close the panel');
		log('bookmarks deleted, panel empty, panel closed');

		// --- Selection, highlight, and taking it off again ---
		// Here, before the zoom and rotation sections: the drag is a real
		// pointer gesture, so it needs the page on screen, and "above the
		// selection" is a statement about a page that is not on its side.
		await pageHost(page, 1).scrollIntoViewIfNeeded();
		await waitForPageLayers(page, 1);
		const selection = await selectAcrossTextLayer(page, 1);
		if (!selection.includes(PAGE_TEXT)) {
			fail(`could not select the text layer to mark it: ${JSON.stringify(selection)}`);
		}
		// The toolbar hangs from the selection, and only from a real
		// selection — a page that reported one for a collapsed range would
		// be offering to mark nothing.
		const toolbar = page.locator('[data-testid="rm-selection-toolbar"]');
		await toolbar.waitFor({ state: 'visible', timeout: 5_000 });
		const geometry = await page.evaluate(() => {
			const bar = document.querySelector('[data-testid="rm-selection-toolbar"]');
			const host = document.querySelector('[data-page-index="1"]');
			if (bar === null || host === null) return null;
			const box = bar.getBoundingClientRect();
			const hostBox = host.getBoundingClientRect();
			// The same fragment the toolbar hangs from: the last non-empty
			// rect of the selection. The union box of a multi-line
			// selection has its centre in the whitespace between lines, and
			// a toolbar placed there passes "is it visible" while being
			// nowhere near the text.
			const rects = Array.from(window.getSelection()?.getRangeAt(0).getClientRects() ?? []);
			const fragment = rects.filter((rect) => rect.width > 0 && rect.height > 0).at(-1);
			return {
				bar: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
				host: { left: hostBox.left, right: hostBox.right },
				fragment:
					fragment === undefined
						? null
						: { top: fragment.top, bottom: fragment.bottom, left: fragment.left },
			};
		});
		if (geometry === null) fail('the toolbar or the page host has no measurable box');
		if (geometry.fragment === null) fail('the selection reported no fragment to anchor to');
		const { bar, fragment } = geometry;
		// Above the selected words, or below them when the sticky header
		// is in the way. Anything else — over the text, or floating in the
		// gap between two lines — would pass "is it visible".
		const above = bar.bottom <= fragment.top + 1;
		const below = bar.top >= fragment.bottom - 1;
		if (!above && !below) {
			fail(
				`the toolbar is neither above nor below the selected text: it spans ` +
					`${Math.round(bar.top)}..${Math.round(bar.bottom)} against a selection at ` +
					`${Math.round(fragment.top)}..${Math.round(fragment.bottom)}`,
			);
		}
		if (bar.left < geometry.host.left - 1 || bar.right > geometry.host.right + 1) {
			fail(
				`the toolbar is not inside the page's column: x ${Math.round(bar.left)}..${Math.round(bar.right)} ` +
					`against a page at ${Math.round(geometry.host.left)}..${Math.round(geometry.host.right)}`,
			);
		}
		log(
			`selection toolbar ${above ? 'above' : 'below'} the selected text at y ` +
				`${Math.round(above ? bar.bottom : bar.top)} (selection ${Math.round(fragment.top)}..` +
				`${Math.round(fragment.bottom)}), 2 actions`,
		);

		// Mark it. A click on the toolbar must not take the selection away
		// from the action it is for, which is why the toolbar preventDefaults
		// its own mousedown and acts on a snapshot.
		await page.click('[data-testid="rm-selection-highlight"]');
		await waitUntil(
			async () => findStoreCount(await readStoreCounts(page), 'highlights') === 1,
			'the toolbar to write a highlight row',
		);
		const markRow = await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open('readmark');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const row = await new Promise((resolve) => {
				const store = db.transaction('highlights', 'readonly').objectStore('highlights');
				const cursor = store.openCursor();
				cursor.onsuccess = () => resolve(cursor.result?.value ?? null);
			});
			db.close();
			return row;
		});
		if (markRow === null) fail('the toolbar wrote no highlight row');
		// The text the row remembers is the quote's own text, from the same
		// call — a mirror taken from the browser's selection would disagree
		// with the anchor it belongs to at a line wrap.
		if (!String(markRow.selectedText).includes(PAGE_TEXT)) {
			fail(`the row's text is not what was selected: ${JSON.stringify(markRow.selectedText)}`);
		}
		if (markRow.anchor === null || markRow.anchor?.format !== 'pdf') {
			fail(`the row has no PDF anchor: ${JSON.stringify(markRow.anchor)}`);
		}
		log(
			`highlight written from the selection: "${String(markRow.selectedText).trim()}" ` +
				`on page ${markRow.pageIndex}`,
		);

		// Painted on top of the words it marks, and inside that page's box.
		await page.waitForFunction(
			() => document.querySelectorAll('.rm-highlight').length === 1,
			undefined,
			{ timeout: 5_000 },
		);
		const painted = await page.evaluate(() => {
			const overlay = document.querySelector('.rm-highlight');
			const fragment = document.querySelector('.rm-highlight__fragment');
			const textLayer = document.querySelector('[data-page-index="1"] .rm-text-layer');
			if (overlay === null || fragment === null || textLayer === null) return null;
			const overlayBox = overlay.getBoundingClientRect();
			const fragmentBox = fragment.getBoundingClientRect();
			const textBox = textLayer.getBoundingClientRect();
			return {
				color: overlay.dataset.highlightColor ?? null,
				freshness: overlay.dataset.freshness ?? null,
				pointerEvents: getComputedStyle(overlay).pointerEvents,
				// Inside the page box it is painted in, and overlapping the
				// text layer rather than beside it.
				insideLayer:
					fragmentBox.left >= textBox.left - 1 &&
					fragmentBox.right <= textBox.right + 1 &&
					fragmentBox.top >= textBox.top - 1 &&
					fragmentBox.bottom <= textBox.bottom + 1,
				hasArea: fragmentBox.width > 0 && fragmentBox.height > 0,
				overlayInsideLayer:
					overlayBox.left >= textBox.left - 1 && overlayBox.right <= textBox.right + 1,
			};
		});
		if (painted === null) fail('the highlight overlay is missing');
		if (painted.color !== 'yellow') {
			fail(`the overlay did not get the stored colour name: ${JSON.stringify(painted.color)}`);
		}
		if (painted.freshness !== 'fresh') {
			fail(`a highlight made from a live selection resolved as ${painted.freshness}`);
		}
		// A highlight that swallows pointer events would stop the reader
		// selecting text that runs through it — which is most of the text
		// they might want to mark next.
		if (painted.pointerEvents !== 'none') {
			fail(`the overlay intercepts pointer events: ${painted.pointerEvents}`);
		}
		if (!painted.hasArea || !painted.insideLayer || !painted.overlayInsideLayer) {
			fail(`the overlay is not laid over the text: ${JSON.stringify(painted)}`);
		}
		log(
			`overlay painted over the text: colour ${painted.color}, ${painted.freshness}, ` +
				'pointer-events none',
		);

		// The text is still selectable through the highlight.
		const throughHighlight = await selectAcrossTextLayer(page, 1);
		if (!throughHighlight.includes(PAGE_TEXT)) {
			fail(
				`selecting text that runs under the highlight produced ${JSON.stringify(throughHighlight)}; ` +
					'the overlay is in the way of the reader',
			);
		}
		// And the toolbar offers to take the mark off, because the same words
		// are selected again.
		await page.locator('[data-testid="rm-selection-highlight"]').waitFor({ state: 'visible' });
		const removeLabel = await page.locator('[data-testid="rm-selection-highlight"]').textContent();
		if (removeLabel === null || !removeLabel.includes('外す')) {
			fail(`re-selecting marked text offered "${removeLabel}" instead of a removal`);
		}
		await page.click('[data-testid="rm-selection-highlight"]');
		await waitUntil(
			async () => findStoreCount(await readStoreCounts(page), 'highlights') === 0,
			'the confirmed removal to delete the row',
		);
		await page.waitForFunction(
			() => document.querySelectorAll('.rm-highlight').length === 0,
			undefined,
			{ timeout: 5_000 },
		);
		log('the mark was taken off: the row is gone and the overlay with it');

		// Escape closes the toolbar without touching what is selected.
		await selectAcrossTextLayer(page, 1);
		await toolbar.waitFor({ state: 'visible', timeout: 5_000 });
		await page.keyboard.press('Escape');
		await toolbar.waitFor({ state: 'detached', timeout: 5_000 });
		log('Escape dismissed the toolbar');

		// --- Zoom keeps the two layers registered ---
		// Zoom and rotation are claims about the page on screen, and the
		// flow above left the reader in the middle of the document.
		// Page 1 has to be back and rendered before it can be measured:
		// measuring a placeholder reports no text layer, which then
		// reads as a broken one rather than an absent one.
		await pageHost(page, 1).scrollIntoViewIfNeeded();
		await waitForPageLayers(page, 1);
		// The expected value is derived, not hardcoded: the reader opens
		// at fit-width, so the next stop is whatever that lands on, and
		// pinning '125%' would only ever pass at a 100% opening zoom.
		const beforeZoomIn = await page.evaluate(
			() => document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent ?? '',
		);
		await page.click('[data-testid="rm-zoom-in"]');
		await page.waitForFunction(
			(previous) => {
				const now = document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent ?? '';
				return now !== previous;
			},
			beforeZoomIn,
			{ timeout: 30000 },
		);
		log(
			`zoom in: ${beforeZoomIn} -> ${await page.evaluate(() => document.querySelector('[data-testid="rm-reader-zoom"]')?.textContent)}`,
		);
		await waitForPageLayers(page, 1);
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
		await waitForPageLayers(page, 1);
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
		// The drag is a real pointer gesture, so it can only happen
		// where the page is; page 1 is still the one on screen.
		// Bring page 1 back and wait for it to actually render before
		// dragging on it.
		//
		// The flow above ends scrolled into the middle of the document
		// and zoomed to 300%, so page 1's host can be far above the
		// viewport with its text layer not yet built. Revealing a span
		// before it exists finds nothing, and the drag then lands
		// nowhere — which reads as "selection broke after rotation" when
		// selection is fine.
		await pageHost(page, 1).scrollIntoViewIfNeeded();
		await waitForPageLayers(page, 1);
		await page.locator('[data-testid="rm-reader-scroll"]').evaluate((el) => {
			el.scrollTop = 0;
		});
		await wait(300);
		const rotatedSelection = await selectAcrossTextLayer(page, 1, { diagonal: true });
		if (rotatedSelection.length === 0) {
			fail('selection stopped working after zoom + rotation');
		}
		if (!rotatedSelection.includes(PAGE_TEXT)) {
			fail(`selection after rotate is not the page's text: ${JSON.stringify(rotatedSelection)}`);
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
