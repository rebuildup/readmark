#!/usr/bin/env bun
/**
 * readmark — browser smoke for native page rotation (issue #33).
 *
 * ## Why this is a smoke and not a unit test
 *
 * Everything #33 changes is a transform matrix, and `pdf-rotation.test.ts`
 * checks that matrix against the real pdf.js `PageViewport` down to the
 * last element. What no unit test in this repo can check is the one
 * thing a reader would actually notice: whether the glyphs come out
 * upright. happy-dom has no canvas, so "the page renders sideways" and
 * "the page renders correctly" are indistinguishable to vitest — both
 * are a `<canvas>` with the right numbers on it.
 *
 * So this drives the built app in headless Chromium and reads pixels.
 *
 * ## How orientation is made observable
 *
 * A page that is merely the right size proves nothing: a page rendered
 * at the wrong rotation with the wrong box still has the right box, and
 * a reader sees a sideways book. The fixture therefore carries a solid
 * black square in one known corner of PDF user-space, and this smoke
 * asks which corner of the *canvas* it lands in.
 *
 * pdf.js's `PageViewport` maps user-space `(x, y)` to canvas
 * `(m0·x + m2·y + m4, m1·x + m3·y + m5)`. For a 420x595 page at
 * scale 1 that puts a marker at user-space `(60, 60)` — the
 * bottom-left — into:
 *
 *     total   canvas      marker's canvas corner
 *     0       420x595     bottom-left
 *     90      595x420     top-left
 *     180     420x595     top-right
 *     270     595x420     bottom-right
 *
 * Four distinct corners, so each total rotation is identified by the
 * pixels alone. The page also carries text in its middle, far from
 * every corner, so the corner reading is the marker and never the text.
 *
 * ## What would fail here if the composition were wrong
 *
 * The fixture's page 1 carries `/Rotate 90`. Correctly composed, the
 * reader opens it at total 90: a landscape canvas with the marker in
 * its top-left corner. Before the fix the runtime rotation `0` was
 * passed straight to `getViewport`, overriding the native rotation, so
 * the same page opened as total 0 — portrait, marker bottom-left, and
 * the content sideways inside it. Both the aspect ratio and the marker
 * move, so neither can pass by accident.
 *
 * Pages 2 and 3 carry no `/Rotate`. They are here to pin the common
 * case: `/Rotate` is a per-page attribute, so composing it must not
 * leak onto pages that never had one.
 */

import { setTimeout as wait } from 'node:timers/promises';
import { degrees, PDFDocument, rgb } from 'pdf-lib';

import { fail, launchBrowser, PREVIEW_URL, withPreview } from './smoke-harness.mjs';

const log = (msg) => console.log(`[smoke-rotate] ${msg}`);

const PAGE_COUNT = 3;
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 595;

/** The native rotation on page 1. 90 rather than 180 because 90 is the
 *  case that changes the page's aspect ratio, which is the half of this
 *  a reader would report first ("my book is on its side"). */
const NATIVE_ROTATION = 90;

/** A solid square in the bottom-left of user-space, in points. Big
 *  enough to fill a 30% corner sample of the canvas at any of the four
 *  rotations, and small enough to stay clear of the other three. */
const MARKER_SIZE = 120;
const MARKER_X = 0;
const MARKER_Y = 0;

/** Fraction of each canvas dimension sampled at each corner when
 *  looking for the marker. The marker spans 28.6% of the page's width
 *  and 20.2% of its height, so a 30% window contains all of it at every
 *  rotation and none of the text, which sits in the page's middle. */
const CORNER_SAMPLE = 0.3;

/** A pixel counts as ink when it is meaningfully darker than the white
 *  page background the reader paints. */
const INK_THRESHOLD = 200;

async function makeFixturePdf() {
	const pdf = await PDFDocument.create();
	for (let index = 1; index <= PAGE_COUNT; index++) {
		const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
		page.drawRectangle({
			x: MARKER_X,
			y: MARKER_Y,
			width: MARKER_SIZE,
			height: MARKER_SIZE,
			color: rgb(0, 0, 0),
		});
		// Text in the middle of the page, clear of all four corners, so
		// a corner reading is never the text. It also gives the reader a
		// text layer to build, which is part of what a re-render has to
		// keep registered with the canvas.
		page.drawText(`readmark rotate page ${index}`, {
			x: 100,
			y: 280,
			size: 16,
		});
		// Only page 1 is stored sideways. `/Rotate` is a per-page
		// attribute, so this is what proves the composition reads the
		// page it is rendering rather than the document.
		if (index === 1) page.setRotation(degrees(NATIVE_ROTATION));
	}
	pdf.setTitle('readmark rotate smoke');
	return await pdf.save();
}

const pageHost = (page, index) => page.locator(`[data-page-index="${index}"]`);

/**
 * Scroll a lazily-rendered page into the reader's prefetch band and
 * wait for its canvas.
 *
 * The reader only materialises pages near the viewport, so reading page
 * 2 straight after opening finds no canvas — which is a statement about
 * laziness, not about rotation. The return value is the first
 * orientation reading, so callers do not measure a page twice.
 */
async function materialize(page, index) {
	const host = pageHost(page, index);
	for (let attempt = 0; attempt < 30; attempt++) {
		await host.evaluate((element) => {
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (scroller === null) return;
			scroller.scrollTop = element.offsetTop;
		});
		await wait(200);
		const orientation = await readOrientation(page, index);
		if (orientation !== null && orientation.totalInk > 0) return orientation;
	}
	return await readOrientation(page, index);
}

/**
 * The canvas's size and which corner holds the marker.
 *
 * Reads pixels, not styles: the styles are what the implementation
 * wrote, and this is a check on what a reader would see.
 */
async function readOrientation(page, index) {
	return await pageHost(page, index).evaluate(
		(host, { sample, threshold }) => {
			const canvas = host.querySelector('canvas');
			if (canvas === null) return null;
			const context = canvas.getContext('2d');
			const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

			const dark = (x, y) => {
				const offset = (y * canvas.width + x) * 4;
				return data[offset] < threshold && data[offset + 1] < threshold;
			};

			const sampleBox = (left, top) => {
				const width = Math.round(canvas.width * sample);
				const height = Math.round(canvas.height * sample);
				const x0 = left === 'left' ? 0 : canvas.width - width;
				const y0 = top === 'top' ? 0 : canvas.height - height;
				let inked = 0;
				for (let y = y0; y < y0 + height; y++) {
					for (let x = x0; x < x0 + width; x++) {
						if (dark(x, y)) inked++;
					}
				}
				return inked;
			};

			const corners = {
				'top-left': sampleBox('left', 'top'),
				'top-right': sampleBox('right', 'top'),
				'bottom-left': sampleBox('left', 'bottom'),
				'bottom-right': sampleBox('right', 'bottom'),
			};
			const inked = Object.entries(corners).filter(([, count]) => count > 200);
			return {
				canvasWidth: canvas.width,
				canvasHeight: canvas.height,
				corners,
				// More than one inked corner means the reading is
				// ambiguous, which is a failure of the fixture rather
				// than of the reader — and a smoke that cannot tell
				// which way the page is facing must not report a pass.
				inkedCorners: inked.map(([name]) => name).sort(),
				totalInk: Object.values(corners).reduce((sum, count) => sum + count, 0),
			};
		},
		{ sample: CORNER_SAMPLE, threshold: INK_THRESHOLD },
	);
}

/** Wait for a re-render to settle: the canvas is replaced, so a read
 *  taken between the replacement and the paint sees an empty page. */
async function waitForOrientationChange(page, index, previous) {
	for (let attempt = 0; attempt < 40; attempt++) {
		await wait(150);
		const next = await readOrientation(page, index);
		if (
			next !== null &&
			next.totalInk > 0 &&
			(next.canvasWidth !== previous.canvasWidth ||
				next.canvasHeight !== previous.canvasHeight ||
				next.inkedCorners.join() !== previous.inkedCorners.join())
		) {
			return next;
		}
	}
	return await readOrientation(page, index);
}

const isLandscape = (reading) => reading.canvasWidth > reading.canvasHeight;

function check(actual, expected, label) {
	// Named, rather than `w > h !== w2 > h2` written inline: `>` binds
	// tighter than `!==`, so the inline form happens to be right and
	// reads like it is not. A smoke that a reader has to reason about
	// is a smoke that eventually gets "fixed" into the wrong thing.
	const wantLandscape = isLandscape(expected);
	if (isLandscape(actual) !== wantLandscape) {
		fail(
			`${label}: expected a ${wantLandscape ? 'landscape' : 'portrait'} ` +
				`canvas, got ${actual.canvasWidth}x${actual.canvasHeight} ` +
				`(corners: ${JSON.stringify(actual.inkedCorners)})`,
		);
	}
	if (actual.inkedCorners.length !== 1) {
		fail(
			`${label}: expected the marker in exactly one corner, found ` +
				`${JSON.stringify(actual.inkedCorners)} (all corners: ${JSON.stringify(actual.corners)})`,
		);
	}
	const wantCorner = expected.inkedCorners[0];
	const corner = actual.inkedCorners[0];
	if (corner !== wantCorner) {
		fail(
			`${label}: expected the marker in the ${wantCorner}, found it in the ${corner}. ` +
				'The page is facing the wrong way — native /Rotate is not being composed with ' +
				'the runtime rotation.',
		);
	}
}

async function main() {
	await withPreview(async () => {
		log('preview server is up');
		const browser = await launchBrowser();
		const page = await browser.newPage();
		const consoleErrors = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
		});

		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

		const bytes = await makeFixturePdf();
		await page
			.locator('[data-testid="rm-document-import-input"]')
			.first()
			.setInputFiles({
				name: 'rotate-smoke.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(bytes),
			});
		await page.locator('[data-testid="rm-import-status"]').waitFor({ state: 'visible' });
		log(`imported a ${PAGE_COUNT}-page fixture, page 1 at /Rotate ${NATIVE_ROTATION}`);

		await page.click('[data-testid="rm-library-row-read"]');
		await page.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await pageHost(page, 1).locator('canvas').first().waitFor({ state: 'visible' });
		await page
			.locator('[data-page-index="1"] .rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });
		log('reader opened with a canvas and a text layer');

		// --- Page 1: the native rotation, at runtime rotation 0 ---
		//
		// This is the claim of #33 in one reading. Pre-fix, `rotation: 0`
		// was passed straight through and overrode the page's own
		// `/Rotate 90`, so the page arrived portrait with the marker at
		// the bottom-left and the content sideways inside it.
		const atRuntimeZero = await readOrientation(page, 1);
		if (atRuntimeZero === null) fail('page 1 has no canvas');
		if (atRuntimeZero.totalInk === 0) fail('page 1 painted no marker at all');
		check(
			atRuntimeZero,
			{ canvasWidth: 595, canvasHeight: 420, inkedCorners: ['top-left'] },
			'page 1 at runtime 0',
		);
		log(
			`page 1 at runtime 0: ${atRuntimeZero.canvasWidth}x${atRuntimeZero.canvasHeight} ` +
				`landscape, marker ${atRuntimeZero.inkedCorners[0]} — native /Rotate ${NATIVE_ROTATION} applied`,
		);

		// --- Pages 2 and 3: no /Rotate, so nothing may change ---
		//
		// The regression this guards is a composition that reads the
		// document's first page and applies it to all of them. Both
		// pages must stay portrait with the marker at the bottom-left,
		// exactly as they did before the change.
		for (const index of [2, 3]) {
			const plain = await materialize(page, index);
			if (plain === null) fail(`page ${index} has no canvas`);
			if (plain.totalInk === 0) fail(`page ${index} painted no marker at all`);
			check(
				plain,
				{ canvasWidth: 420, canvasHeight: 595, inkedCorners: ['bottom-left'] },
				`page ${index} at runtime 0`,
			);
		}
		log('pages 2 and 3 (no /Rotate) are unchanged: portrait, marker bottom-left');

		// --- One turn of the reader's own rotation ---
		//
		// Each step is native 90 + runtime, so the marker must walk the
		// corners and the canvas must alternate landscape/portrait. A
		// composition that merely added the runtime rotation to itself
		// would keep the marker at the top-left forever.
		const expectedSteps = [
			{ runtime: 90, corner: 'top-right', landscape: false },
			{ runtime: 180, corner: 'bottom-right', landscape: true },
			{ runtime: 270, corner: 'bottom-left', landscape: false },
			{ runtime: 360, corner: 'top-left', landscape: true },
		];
		let previous = atRuntimeZero;
		// Scrolling back to page 1 for the rotation walk, since the
		// reader only keeps what is near the viewport materialised.
		const backOnPageOne = await materialize(page, 1);
		if (backOnPageOne === null || backOnPageOne.totalInk === 0) {
			fail('page 1 did not come back after scrolling to it');
		}
		check(
			backOnPageOne,
			{ canvasWidth: 595, canvasHeight: 420, inkedCorners: ['top-left'] },
			'page 1 on return',
		);
		previous = backOnPageOne;
		for (const step of expectedSteps) {
			await page.click('[data-testid="rm-rotate"]');
			const next = await waitForOrientationChange(page, 1, previous);
			check(
				next,
				{
					canvasWidth: step.landscape ? 595 : 420,
					canvasHeight: step.landscape ? 420 : 595,
					inkedCorners: [step.corner],
				},
				`page 1 at runtime ${step.runtime}`,
			);
			log(
				`page 1 at runtime ${step.runtime} (total ${(NATIVE_ROTATION + step.runtime) % 360}): ` +
					`${next.canvasWidth}x${next.canvasHeight}, marker ${next.inkedCorners[0]}`,
			);
			previous = next;
		}
		log('a full turn of the reader rotation walks the marker through all four corners');

		// --- Nothing in the console along the way ---
		const real = consoleErrors.filter((text) => !/favicon|Download the React DevTools/i.test(text));
		if (real.length > 0) fail(`console errors during the smoke: ${real.join(' | ')}`);
		log('no console errors');

		await browser.close();
	});
}

await main();
log('OK');
