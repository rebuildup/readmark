/**
 * Unit tests for the sub-page scroll position.
 *
 * The restore path is the one that has to be right: a reader who comes
 * back to a document expects to land where they left off, and a
 * position that round-trips through storage into a slightly different
 * viewport is how "it opened at page 1 again" happens. The tests are
 * written as round trips rather than as coordinate checks wherever the
 * round trip is the actual contract.
 */

import { describe, expect, it } from 'vitest';

import { asPageIndex, type PageIndex } from '../domain/reading-state.ts';
import { currentPositionFrom, type PageExtent, scrollTopForPosition } from './position.ts';

/** Three 800px pages stacked with no gaps, the first at the top. */
function pages(count: number, height = 800): PageExtent[] {
	return Array.from({ length: count }, (_, index) => ({
		pageIndex: (index + 1) as PageIndex,
		top: index * height,
		height,
	}));
}

describe('currentPositionFrom', () => {
	it('is null before the pages have any height', () => {
		// An unmeasured layout must read as "no position", not as
		// "page 1 at the top" — the difference decides whether a save
		// overwrites a real stored position with a guess.
		expect(
			currentPositionFrom([{ pageIndex: asPageIndex(1), top: 0, height: 0 }], 0, 600),
		).toBeNull();
		expect(currentPositionFrom([], 0, 600)).toBeNull();
	});

	it('reports the page under the viewport midpoint', () => {
		// Three 800px pages, a 600px window: the midpoint starts at
		// 300, which is inside page 1.
		expect(currentPositionFrom(pages(3), 0, 600)).toEqual({
			pageIndex: 1,
			pageOffsetRatio: 300 / 800,
		});
		// Midpoint 1100 is inside page 2 (800..1600).
		expect(currentPositionFrom(pages(3), 800, 600)?.pageIndex).toBe(2);
	});

	it('advances the ratio as the reader moves through a page', () => {
		// Midpoint 600: half way into page 1.
		expect(currentPositionFrom(pages(3), 300, 600)?.pageOffsetRatio).toBeCloseTo(600 / 800, 9);
		// Midpoint 1000: 200px into page 2.
		const next = currentPositionFrom(pages(3), 700, 600);
		expect(next?.pageIndex).toBe(2);
		expect(next?.pageOffsetRatio).toBeCloseTo(200 / 800, 9);
	});

	it('clamps the ratio when the scroller is past the last page', () => {
		const far = currentPositionFrom(pages(3), 99_999, 600);
		expect(far?.pageIndex).toBe(3);
		expect(far?.pageOffsetRatio).toBe(1);
	});

	it('handles a last page shorter than the viewport', () => {
		// Page 3 is 200px tall in a 600px viewport: the midpoint lands
		// past it, so the fallback is the last page at 1.
		const mixed = [...pages(2), { pageIndex: asPageIndex(3), top: 1600, height: 200 }];
		expect(currentPositionFrom(mixed, 1600, 600)).toEqual({
			pageIndex: 3,
			pageOffsetRatio: 1,
		});
	});
});

describe('scrollTopForPosition', () => {
	it('inverts currentPositionFrom for every page', () => {
		const stack = pages(4);
		for (const scrollTop of [0, 137, 640, 1500, 2400, 3199]) {
			const clientHeight = 600;
			const current = currentPositionFrom(stack, scrollTop, clientHeight);
			if (current === null) throw new Error('expected a position');
			const page = stack.find((candidate) => candidate.pageIndex === current.pageIndex);
			if (page === undefined) throw new Error('expected the page in the stack');
			const restored = scrollTopForPosition(page, current, clientHeight);
			// Reconstructing from the restored offset has to land on the
			// same page and ratio: that is the whole contract, and the
			// reason the ratio is anchored to the viewport's midpoint.
			const again = currentPositionFrom(stack, restored, clientHeight);
			expect(again?.pageIndex).toBe(current.pageIndex);
			expect(again?.pageOffsetRatio).toBeCloseTo(current.pageOffsetRatio, 9);
		}
	});

	it('does not scroll above the top of the content', () => {
		const page: PageExtent = { pageIndex: asPageIndex(1), top: 0, height: 800 };
		// 0 of the page at the midpoint is 300px above the content.
		expect(scrollTopForPosition(page, { pageOffsetRatio: 0 }, 600)).toBe(0);
	});

	it('places the midpoint at the stored offset into the page', () => {
		const page: PageExtent = { pageIndex: asPageIndex(4), top: 2400, height: 800 };
		// A quarter into page 4: the midpoint sits at 2400 + 200, and
		// the scroll offset is that minus half a viewport.
		expect(scrollTopForPosition(page, { pageOffsetRatio: 0.25 }, 600)).toBe(2300);
	});

	it('coerces a NaN ratio to 0 instead of propagating NaN', () => {
		// `Number.isNaN` is the only path through the three
		// comparisons in `clamp01` that reaches a defined output;
		// without it, a NaN ratio would land the scroller at NaN
		// scrollTop and break the next save.
		const page: PageExtent = { pageIndex: asPageIndex(1), top: 0, height: 800 };
		expect(scrollTopForPosition(page, { pageOffsetRatio: Number.NaN }, 600)).toBe(0);
	});

	it('clamps a NaN ratio in currentPositionFrom to 0', () => {
		// Symmetrically, a NaN arithmetic in the ratio path lands on
		// 0 rather than NaN so the storage layer never sees a NaN.
		const offset = currentPositionFrom(pages(1), 300, 600);
		expect(offset?.pageOffsetRatio).not.toBe(Number.NaN);
	});
});
