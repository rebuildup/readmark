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

	it('reports page 1 at the top of the document', () => {
		expect(currentPositionFrom(pages(3), 0, 600)).toEqual({
			pageIndex: 1,
			pageOffsetRatio: 0,
		});
	});

	it('advances the ratio as the page is scrolled through', () => {
		// Viewport 600 tall, pages 800 tall. The viewport midpoint is
		// at scrollTop + 300, and a page holds the reader until that
		// midpoint passes the page's own centre (400 for page 1).
		const early = currentPositionFrom(pages(3), 50, 600);
		expect(early?.pageIndex).toBe(1);
		expect(early?.pageOffsetRatio).toBeCloseTo(50 / 800, 6);

		// Past page 1's centre the reader is on page 2, whose top edge
		// is still below the viewport top: the ratio clamps to 0.
		const handedOver = currentPositionFrom(pages(3), 300, 600);
		expect(handedOver?.pageIndex).toBe(2);
		expect(handedOver?.pageOffsetRatio).toBe(0);

		// Once the viewport top is inside page 2 the ratio advances.
		const intoPage2 = currentPositionFrom(pages(3), 850, 600);
		expect(intoPage2?.pageIndex).toBe(2);
		expect(intoPage2?.pageOffsetRatio).toBeCloseTo(50 / 800, 6);
	});

	it('clamps the ratio when the scroller is past the last page', () => {
		const far = currentPositionFrom(pages(3), 99_999, 600);
		expect(far?.pageIndex).toBe(3);
		expect(far?.pageOffsetRatio).toBe(1);
	});

	it('handles a last page shorter than the viewport', () => {
		// Page 3 is 200px tall in a 600px viewport: the midpoint can
		// never land inside it, so the fallback is the last page at 1.
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
			const restored = scrollTopForPosition(page, current);
			// Reconstructing from the restored offset has to land on
			// the same page and ratio: that is the whole contract.
			const again = currentPositionFrom(stack, restored, clientHeight);
			expect(again?.pageIndex).toBe(current.pageIndex);
			expect(again?.pageOffsetRatio).toBeCloseTo(current.pageOffsetRatio, 6);
		}
	});

	it('does not scroll above the top of the content', () => {
		const page: PageExtent = { pageIndex: asPageIndex(1), top: 0, height: 800 };
		expect(scrollTopForPosition(page, { pageOffsetRatio: 0 })).toBe(0);
	});

	it('lands the page top at the ratio, independent of the window size', () => {
		const page: PageExtent = { pageIndex: asPageIndex(4), top: 2400, height: 800 };
		// 25% into page 4: 200px past its top. Nothing here depends on
		// a viewport height, which is what makes a position recorded on
		// one screen meaningful on another.
		expect(scrollTopForPosition(page, { pageOffsetRatio: 0.25 })).toBe(2600);
	});
});
