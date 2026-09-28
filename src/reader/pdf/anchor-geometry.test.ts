/**
 * Unit tests for fragment geometry.
 *
 * Split by what happy-dom can and cannot do, which is also the split
 * that matters:
 *
 *   - The two conversion steps are pure: client rects → layer-local,
 *     and layer-local → user-space. Pinned here against a viewport
 *     whose maths is written out longhand, the way `pdf-coords.test.ts`
 *     does it, including the corners-cross and zero-area cases, and
 *     against the off-screen offset that the measurement layer always
 *     has.
 *   - `fragmentsForRuns` needs a layout engine, because what it
 *     produces *is* browser geometry. happy-dom returns no boxes for
 *     any element, so every assertion about it here would be vacuous.
 *     Its evidence is `scripts/smoke-reader.mjs`, which measures a real
 *     text layer in a real Chromium.
 *
 * What is *not* left to the browser here is the decision about what a
 * measurement failure means. That is a `null`, not an empty list, and
 * the two are told apart below by construction rather than by a test
 * that could not have failed.
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';

import { asPageIndex } from '../../domain/reading-state.ts';
import type { PageTextItem, PageTextLayer } from '../types.ts';
import {
	fragmentsForRuns,
	fragmentsFromLayerRects,
	layerRectsFromClientRects,
} from './anchor-geometry.ts';
import type { QuoteRunMatch } from './anchor-recovery.ts';
import type { ViewportLike } from './pdf-coords.ts';

/**
 * Scale 2, origin top-left, y down — the shape of a real `PageViewport`
 * at `scale: 2`, written longhand so the expected numbers can be
 * checked by hand: a client x of 100 is user-space 50, and a client y
 * of 40 is user-space (PAGE_HEIGHT - 20) once the scale is undone.
 */
const PAGE_HEIGHT = 600;

const viewport: ViewportLike = {
	scale: 2,
	width: 420 * 2,
	height: PAGE_HEIGHT * 2,
	rotation: 0,
	transform: [2, 0, 0, -2, 0, PAGE_HEIGHT * 2],
	convertToViewportPoint(x: number, y: number): readonly number[] {
		return [x, y];
	},
	convertToViewportRectangle(rect: readonly number[]): readonly number[] {
		return rect;
	},
	convertToPdfPoint(x: number, y: number): readonly number[] {
		return [x / 2, PAGE_HEIGHT - y / 2];
	},
};

function clientRect(
	left: number,
	top: number,
	right: number,
	bottom: number,
): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
	return { left, top, right, bottom, width: right - left, height: bottom - top };
}

describe('layerRectsFromClientRects', () => {
	it('subtracts the layer origin, so an off-screen layer measures in place', () => {
		// The measurement layer is hosted far off-screen, so every client
		// rect arrives carrying that offset. Without this subtraction the
		// fragments convert to a rectangle in the right place in the file
		// and hundreds of thousands of points off the page.
		const hosted = layerRectsFromClientRects([clientRect(-99_900, -100_000, -99_700, -99_960)], {
			left: -100_000,
			top: -100_000,
		});

		expect(hosted).toEqual([clientRect(100, 0, 300, 40)]);
	});

	it('moves a rect without resizing it', () => {
		const [moved] = layerRectsFromClientRects([clientRect(10, 20, 110, 60)], {
			left: 4,
			top: 5,
		});

		expect(moved?.width).toBe(100);
		expect(moved?.height).toBe(40);
	});
});

describe('fragmentsFromLayerRects', () => {
	it('converts a layer-local rect back to raw user-space', () => {
		const fragments = fragmentsFromLayerRects([clientRect(100, 40, 300, 80)], viewport);

		// x 50..150, and the y flip: layer-local 40..80 is user-space
		// 580..560, normalised to 560..580.
		expect(fragments).toEqual([{ x: 50, y: 560, width: 100, height: 20 }]);
	});

	it('keeps one fragment per measured rect, in order', () => {
		// A selection across two lines measures as two rects. Merging
		// them would cover the gap between the lines, so they stay
		// separate — the count is not part of the contract, only that
		// they cover the selection.
		const fragments = fragmentsFromLayerRects(
			[clientRect(100, 40, 300, 60), clientRect(100, 300, 260, 320)],
			viewport,
		);

		expect(fragments).toEqual([
			{ x: 50, y: 570, width: 100, height: 10 },
			{ x: 50, y: 440, width: 80, height: 10 },
		]);
	});

	it('drops a collapsed rect rather than painting an invisible box', () => {
		// A range that landed on nothing, or a zero-width run, measures
		// as a degenerate rect. Painting it would put a box on the page
		// that no reader could account for.
		const fragments = fragmentsFromLayerRects(
			[clientRect(100, 40, 100, 60), clientRect(100, 40, 300, 40), clientRect(100, 40, 300, 60)],
			viewport,
		);

		expect(fragments).toEqual([{ x: 50, y: 570, width: 100, height: 10 }]);
	});

	it('returns nothing for a measurement that measured nothing', () => {
		expect(fragmentsFromLayerRects([], viewport)).toEqual([]);
	});

	it('normalises a y axis that flips the corners', () => {
		// This is the case normalisation exists for, and it happens on
		// every measurement: client y grows downwards, user-space y
		// grows upwards, so the "top" corner converts *above* the
		// "bottom" one. Reading the corners as if their order were
		// guaranteed would produce a rect with a negative height.
		const flipped: ViewportLike = {
			...viewport,
			convertToPdfPoint: (x: number, y: number) => [x / 2, y / 2],
		};

		const fragments = fragmentsFromLayerRects([clientRect(100, 40, 300, 80)], flipped);

		expect(fragments).toEqual([{ x: 50, y: 20, width: 100, height: 20 }]);
	});

	it('skips a rect whose corners the viewport could not convert', () => {
		// A viewport is a structural type, and a handle that does not
		// implement `convertToPdfPoint` would be a programming error
		// upstream. Refusing the rect is the safe reading: one unusable
		// fragment must not take the rest of a highlight with it, and
		// must not become a NaN box either.
		const broken = { ...viewport, convertToPdfPoint: () => [] } as unknown as ViewportLike;

		expect(
			fragmentsFromLayerRects([clientRect(100, 40, 300, 60), clientRect(0, 0, 10, 10)], broken),
		).toEqual([]);
	});
});

/** A page that yields the given pdf.js text items. The geometry half
 *  of this module needs a layout engine; the guards around it do not,
 *  and these are the guards. */
function fakePage(items: readonly unknown[]): PDFPageProxy {
	return {
		getViewport: () => viewport,
		getTextContent: async () => ({ items, styles: {} }),
	} as unknown as PDFPageProxy;
}

const ITEM: PageTextItem = { text: 'alpha beta', rect: { x: 0, y: 0, width: 1, height: 1 } };
const LAYER: PageTextLayer = { format: 'pdf', page: asPageIndex(1), items: [ITEM] };

describe('fragmentsForRuns', () => {
	it('refuses when the layer it built does not match the layer the offsets came from', () => {
		// The correspondence now holds by construction — both
		// projections normalise through the same `glyphRuns()` — so this
		// is an invariant test rather than the mechanism. It stays
		// because the failure it guards against is measuring the wrong
		// characters and returning them as a highlight: confident,
		// plausible, and wrong. A page whose text yields no runs is the
		// cheapest way to break the correspondence.
		const run: QuoteRunMatch = { runIndex: 0, item: ITEM, start: 6, end: 10 };

		return expect(fragmentsForRuns(fakePage([]), LAYER, [run])).resolves.toBeNull();
	});

	it('refuses a run whose page position does not hold it', () => {
		// `runIndex` is the page-global address, and the item it points
		// at has to be the item the offsets were computed from. A match
		// that begins on the fifth run carries `runIndex: 4`, and a
		// helper that used the match-local position instead would measure
		// the first run of the page and return it as a highlight.
		const run: QuoteRunMatch = { runIndex: 4, item: ITEM, start: 6, end: 10 };

		return expect(fragmentsForRuns(fakePage([]), LAYER, [run])).resolves.toBeNull();
	});

	it('refuses a selection with no runs before it touches the page', () => {
		// An empty match cannot be measured, and the early exit means it
		// cannot be measured *by accident* either.
		return expect(fragmentsForRuns(fakePage([]), LAYER, [])).resolves.toBeNull();
	});

	it('reports a measurement with no boxes as a failure, not an empty anchor', () => {
		// happy-dom has no layout, so this is the same situation as a
		// browser that produced no rects: the quote matched and its
		// geometry could not be rebuilt, which is `stale` with the stored
		// rects, not `fresh` with nothing to paint. `null` carries that
		// and `[]` would not.
		const run: QuoteRunMatch = { runIndex: 0, item: ITEM, start: 6, end: 10 };

		return expect(fragmentsForRuns(fakePage([]), LAYER, [run])).resolves.not.toEqual([]);
	});
});
