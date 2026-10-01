#!/usr/bin/env bun
/**
 * readmark — smoke: the reader opens at a readable size.
 *
 * ## Why this is a gate
 *
 * A PDF reader that opens every document at 100% of its physical size
 * is technically correct and practically unusable: a 515pt trade book
 * draws its body text at roughly 10px. Nothing else in the suite notices,
 * because the page still renders, the text layer still reports the right
 * strings, and the reader smoke only asserts that zoom *buttons* work.
 * The defect is entirely in the number the reader starts on.
 *
 * So this asserts the number, and the rendered result of it, on a real
 * book at a laptop viewport:
 *
 *   1. The opening zoom is above 100% — the page is fitted to the
 *      window, not to the printer.
 *   2. The rendered page width matches the available width, within the
 *      padding the scroller reserves. This is what makes the toolbar
 *      percentage honest: a label reading 239% over a 515px-wide page
 *      would pass the first check and still be unreadable.
 *   3. Pressing the zoom buttons still moves, and stays reachable —
 *      a fit that lands outside the stepper's range is its own bug.
 *   4. Re-fitting is stable: scrolling through the document must not
 *      drift the scale. (The failure mode where a measurement feeds
 *      the fit its own output looks exactly like a slow zoom-out.)
 *
 * The document is read from an explicit path so the same file can be
 * used locally; the check is skipped, loudly, when it is absent.
 */

import { existsSync } from 'node:fs';

import { fail, launchBrowser, PREVIEW_URL, withPreview } from './smoke-harness.mjs';

/** A real book: 717 pages, non-embedded CID fonts, ~515pt wide. */
const BOOK = process.env.RM_BOOK ?? '/mnt/d/3_docs/books/プログラミングのための数学.pdf';

/** A laptop viewport, which is where "too small to read" bites hardest. */
const VIEWPORT = { width: 1280, height: 800 };

if (!existsSync(BOOK)) {
	console.log(`[smoke] SKIP: book not found at ${BOOK}`);
	console.log('[smoke] set RM_BOOK=/path/to/book.pdf to run the readability gate');
	process.exit(0);
}

const { readFileSync } = await import('node:fs');
const bytes = readFileSync(BOOK);

await withPreview(async () => {
	const browser = await launchBrowser();
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.setViewportSize(VIEWPORT);

	const warnings = [];
	page.on('console', (m) => {
		if (m.type() === 'error' || m.type() === 'warning') warnings.push(m.text().slice(0, 120));
	});

	await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'load' });
	const input = page.locator('input[type=file]').first();
	await input.waitFor({ state: 'attached', timeout: 60000 });
	await input.setInputFiles({ name: 'book.pdf', mimeType: 'application/pdf', buffer: bytes });
	const link = page.getByRole('link', { name: '読む' }).first();
	await link.waitFor({ timeout: 60000 });
	await link.click();
	await page.locator('canvas').first().waitFor({ timeout: 60000 });

	// Wait for a painted page before reading the zoom, so a reserved
	// placeholder cannot be mistaken for a rendered one.
	await page.waitForFunction(
		() => {
			for (const c of document.querySelectorAll('canvas')) {
				if (c.width < 10) continue;
				const d = c
					.getContext('2d', { willReadFrequently: true })
					.getImageData(0, 0, c.width, c.height).data;
				for (let i = 0; i < d.length; i += 4) if (d[i] < 200) return true;
			}
			return false;
		},
		null,
		{ timeout: 60000 },
	);
	await page.waitForTimeout(2500);

	const read = () =>
		page.evaluate(() => {
			const label = document.querySelector('[data-testid="rm-reader-zoom"]');
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			const canvas = document.querySelector('canvas');
			return {
				zoomLabel: label?.textContent?.trim() ?? '',
				zoom: Number.parseInt(label?.textContent ?? '', 10),
				scrollerWidth: scroller?.clientWidth ?? 0,
				canvasCssWidth: Math.round(canvas?.getBoundingClientRect().width ?? 0),
				canvasBacking: canvas?.width ?? 0,
				header: document.querySelector('header')?.innerText?.replace(/\n/g, ' | ') ?? '',
			};
		});

	const initial = await read();
	console.log(`[smoke] opening zoom: ${initial.zoomLabel}, header: ${initial.header}`);
	console.log(
		`[smoke] scroller=${initial.scrollerWidth}px, page=${initial.canvasCssWidth}px CSS ` +
			`(backing ${initial.canvasBacking}px)`,
	);

	// --- 1. fitted, not 100% ---------------------------------------
	if (!(initial.zoom > 100)) {
		fail(
			`the reader opened at ${initial.zoomLabel}. A book page is ~515pt, so 100% ` +
				'draws the body text at roughly 10px — the document renders but cannot ' +
				'be read. The opening zoom must fit the page to the window.',
		);
	}
	console.log(`[smoke] opens above 100% (${initial.zoom}%)`);

	// --- 2. and the page really fills the width ---------------------
	if (initial.canvasCssWidth <= 0 || initial.scrollerWidth <= 0) {
		fail('the scroller or the page reported no width; nothing was measured');
	}
	// The page should fill the scroller minus the padding the stylesheet
	// reserves. Allow a little slack for rounding, but not enough to
	// hide a page that is still rendering at its old size.
	if (initial.canvasCssWidth < initial.scrollerWidth * 0.85) {
		fail(
			`the page is ${initial.canvasCssWidth}px wide inside a ${initial.scrollerWidth}px ` +
				`scroller, and the label claims ${initial.zoomLabel}. The label and the ` +
				'render must agree, or the reader is told one size and shown another.',
		);
	}
	if (initial.canvasCssWidth > initial.scrollerWidth) {
		fail(
			`the page (${initial.canvasCssWidth}px) overflows the scroller ` +
				`(${initial.scrollerWidth}px); fit-width must leave the padding in.`,
		);
	}
	console.log('[smoke] the page fills the available width and the label agrees');

	// --- 3. stable while reading ------------------------------------
	//
	// The failure this catches is subtle: if the fit is handed a
	// measurement already in CSS px, every page that renders feeds the fit
	// a wider number and the document appears to zoom out as you read.
	//
	// This runs before the button check on purpose — it must observe the
	// fitted scale, not a value this script has just changed.
	const before = (await read()).zoom;
	for (const target of [6, 10, 14]) {
		await page.evaluate(
			(n) => document.querySelector(`[data-page-index="${n - 1}"]`)?.scrollIntoViewIfNeeded(),
			target,
		);
		await page.waitForTimeout(1200);
	}
	const after = (await read()).zoom;
	console.log(`[smoke] fitted zoom held while scrolling to page 14: ${before}% -> ${after}%`);
	if (after !== before) {
		fail(
			`the fitted scale drifted while scrolling (${before}% -> ${after}%). The fit is ` +
				'being fed a measurement taken at the current zoom, so each rendered page ' +
				'makes it shrink.',
		);
	}

	// --- 4. the zoom controls still work, and stick -----------------
	await page.locator('[data-testid="rm-zoom-out"]').click();
	await page.waitForTimeout(1500);
	const zoomedOut = await read();
	await page.locator('[data-testid="rm-zoom-in"]').click();
	await page.waitForTimeout(1500);
	const zoomedIn = await read();
	console.log(
		`[smoke] zoom out -> ${zoomedOut.zoomLabel} (page ${zoomedOut.canvasCssWidth}px), ` +
			`in -> ${zoomedIn.zoomLabel} (page ${zoomedIn.canvasCssWidth}px)`,
	);
	if (!(zoomedOut.zoom < before)) {
		fail(`zoom out did not reduce the scale (${before}% -> ${zoomedOut.zoomLabel})`);
	}
	if (!(zoomedIn.zoom > zoomedOut.zoom)) {
		fail(`zoom in did not increase the scale (${zoomedOut.zoomLabel} -> ${zoomedIn.zoomLabel})`);
	}
	// And the reader's choice must survive a resize — re-fitting would
	// silently discard it.
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.waitForTimeout(1500);
	const afterResize = (await read()).zoom;
	if (afterResize !== zoomedIn.zoom) {
		fail(
			`a resize discarded the reader's zoom (${zoomedIn.zoomLabel} -> ${afterResize}%). ` +
				'Once the reader chooses a scale, only they may change it.',
		);
	}
	console.log("[smoke] the reader's zoom survives a resize");

	// --- and the pages actually carry text --------------------------
	const pages = await page.evaluate(() =>
		Array.from(document.querySelectorAll('[data-page]'))
			.map((host) => {
				const canvas = host.querySelector('canvas');
				if (!canvas || canvas.width < 10) return null;
				let dark = 0;
				const data = canvas
					.getContext('2d', { willReadFrequently: true })
					.getImageData(0, 0, canvas.width, canvas.height).data;
				for (let i = 0; i < data.length; i += 4) if (data[i] < 200) dark++;
				return {
					page: Number(host.getAttribute('data-page')),
					ink: dark / (canvas.width * canvas.height),
				};
			})
			.filter(Boolean),
	);
	const blank = pages.filter((p) => p.ink < 0.001);
	if (blank.length > 0) {
		fail(`pages rendered blank while reading: ${blank.map((p) => p.page).join(', ')}`);
	}
	console.log(`[smoke] ${pages.length} pages materialised, none blank`);

	await page.screenshot({ path: '/tmp/opencode/readability-gate.png' });
	console.log('[smoke] screenshot -> /tmp/opencode/readability-gate.png');
	if (warnings.length > 0) {
		console.log(`[smoke] console warnings: ${JSON.stringify([...new Set(warnings)].slice(0, 4))}`);
	}
	console.log('[smoke] ALL READABILITY CHECKS PASSED');

	await ctx.close();
	await browser.close();
});
process.exit(0);
