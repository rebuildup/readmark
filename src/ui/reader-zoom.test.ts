/**
 * Unit tests for the opening zoom.
 *
 * ## Why this is a unit test and not only a browser check
 *
 * Fit-width is the difference between "opens a PDF" and "can read a
 * PDF": a 515pt book page at 100% draws its body text around 10px. The
 * arithmetic is small, but it has two traps that a screenshot will not
 * catch and that this file exists to pin:
 *
 *   1. The page's width must be in POINTS. The view also holds a
 *      "footprint" for each page, and that is measured in CSS px at
 *      whatever zoom was applied. Feeding the footprint to the fit
 *      makes the fit consume its own output: each pass measures a page
 *      that is already 2.4x too wide and settles smaller every time.
 *      (That bug shipped once during this work; the browser check saw
 *      "115% on a page that should be 239%".)
 *   2. A fitted zoom lands between the toolbar's stops, so stepping
 *      from it has to still work, and the clamp has to agree with the
 *      stepper or a page can be fitted outside the reachable range.
 */

import { describe, expect, it } from 'vitest';

import { useUiStore } from '../stores/ui-store.ts';
import {
	clampZoom,
	FIT_WIDTH_PADDING_PX,
	fitWidthScale,
	MAX_ZOOM,
	MIN_ZOOM,
	ZOOM_LEVELS,
} from './reader-view.tsx';

describe('fitWidthScale', () => {
	it('scales a book page up to the available width', () => {
		// 515pt is a typical trade book; 1280px is a laptop viewport.
		const scale = fitWidthScale(1280, 515);
		const rendered = 515 * scale;
		expect(rendered).toBeGreaterThan(1280 - FIT_WIDTH_PADDING_PX - 1);
		expect(rendered).toBeLessThan(1280);
		// The point of the change: a book must NOT stay at 100%.
		expect(scale).toBeGreaterThan(1.5);
	});

	it('leaves room for the padding so no horizontal scrollbar appears', () => {
		const available = 1000;
		const rendered = 515 * fitWidthScale(available, 515);
		expect(rendered).toBeLessThanOrEqual(available - FIT_WIDTH_PADDING_PX + 0.5);
	});

	it('shrinks an oversized page to fit', () => {
		// A wide plot or a poster, on a narrow window.
		expect(fitWidthScale(600, 2000)).toBeLessThan(0.5);
	});

	it('stays inside the range the toolbar can step to', () => {
		// A short page (a receipt, a slide) on a wide monitor would
		// otherwise fit to an enormous scale and allocate a canvas
		// larger than the display.
		const tiny = fitWidthScale(4000, 100);
		expect(tiny).toBeLessThanOrEqual(MAX_ZOOM);
		// And a very narrow window must not produce a negative scale.
		const tiny2 = fitWidthScale(10, 515);
		expect(tiny2).toBeGreaterThanOrEqual(MIN_ZOOM);
	});

	it('is a fixed point on the page width in points', () => {
		// The regression guard for trap 1: the correct input must not
		// move between passes.
		const scale = fitWidthScale(1280, 515);
		expect(fitWidthScale(1280, 515)).toBeCloseTo(scale, 10);
	});

	it('shrinks on every pass if handed an already-scaled width', () => {
		// This is trap 1 made explicit, and it is a test of the *shape*
		// of the mistake rather than a wish that it cannot happen: the
		// caller must pass points, because passing a CSS-px measurement
		// of an already-fitted page feeds the fit its own output and it
		// collapses. If this ever stops shrinking, `fitWidthScale` has
		// grown some hidden state and the guarantee is gone.
		let scale = fitWidthScale(1280, 515);
		const start = scale;
		for (let pass = 0; pass < 5; pass++) {
			scale = fitWidthScale(1280, 515 * scale);
		}
		expect(scale).toBeLessThan(start);
	});

	it('falls back to 1 for input it cannot use', () => {
		expect(fitWidthScale(0, 515)).toBe(1);
		expect(fitWidthScale(1280, 0)).toBe(1);
		expect(fitWidthScale(Number.NaN, 515)).toBe(1);
	});

	it('never returns NaN or Infinity, whatever it is handed', () => {
		// A page that has not measured itself yet, and a scroller that
		// has not been laid out, both report zero or undefined — and an
		// unmeasured page is exactly the state the reader opens in. A
		// scale of NaN here is not a cosmetic slip: it reaches the
		// renderer, and the toolbar would read "NaN%".
		const unusable: readonly (readonly [number, number])[] = [
			[0, 0],
			[0, Number.NaN],
			[Number.NaN, 0],
			[Number.NaN, Number.NaN],
			[Number.POSITIVE_INFINITY, 515],
			[1280, Number.POSITIVE_INFINITY],
			[Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
			[Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
			[-1280, 515],
			[1280, -515],
			// `undefined` is what a caller that has not measured yet
			// actually holds, and TypeScript does not stop it at runtime.
			[undefined as unknown as number, 515],
			[1280, undefined as unknown as number],
		];
		for (const [available, pageWidth] of unusable) {
			const scale = fitWidthScale(available, pageWidth);
			expect(Number.isFinite(scale)).toBe(true);
			expect(scale).toBeGreaterThanOrEqual(MIN_ZOOM);
			expect(scale).toBeLessThanOrEqual(MAX_ZOOM);
		}
	});
});

describe('clampZoom', () => {
	it('holds the documented range', () => {
		expect(clampZoom(0.01)).toBe(MIN_ZOOM);
		expect(clampZoom(99)).toBe(MAX_ZOOM);
		expect(clampZoom(1.5)).toBe(1.5);
		expect(clampZoom(Number.NaN)).toBe(1);
	});

	it('agrees with the toolbar stops, so a fit is always steppable', () => {
		// Every stop must be inside the clamp range; otherwise a fit
		// could land on a value the +/- buttons cannot reach.
		for (const level of ZOOM_LEVELS) {
			expect(clampZoom(level)).toBe(level);
		}
	});

	it('agrees with the range the zoom store files a preference in', () => {
		// The store holds its own copy of these bounds, because it cannot
		// import a React screen. A drift between the two would let a
		// reader file a preference the toolbar cannot reach — and the
		// only symptom would be a document that opens at a scale they
		// cannot zoom back out of.
		const set = useUiStore.getState().setReaderZoom;
		set('at-max', MAX_ZOOM);
		set('at-min', MIN_ZOOM);
		expect(useUiStore.getState().readerZoom).toEqual({ 'at-max': MAX_ZOOM, 'at-min': MIN_ZOOM });
		useUiStore.setState({ readerZoom: {} });
	});
});
