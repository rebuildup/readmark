/**
 * readmark — sub-page scroll position.
 *
 * `DocumentPosition` (see `domain/document.ts`) is an opaque blob: the
 * generic layer stores and returns it, and the layer that knows what
 * it means reads its fields. This module is that layer for the
 * scroll-based position, and it is the only place the shape is
 * defined.
 *
 * Why a scroll position and not an `Anchor`: the two are different
 * concepts (AGENTS.md §3b, ADR-0007). An `Anchor` addresses a text
 * region and is re-anchored against the document's text on reopen; a
 * `DocumentPosition` addresses "roughly where the reader was", is
 * format-agnostic, and by contract is NOT re-anchored — zoom,
 * rotation and renderer changes can invalidate it. The MVP promise is
 * "back to this page", so the page index is the field that survives
 * and the offset is advisory.
 *
 * The offset is a **ratio of the page's height**, not a pixel offset,
 * because a page's pixel height changes with zoom and rotation while
 * the reader's place within it does not. A ratio keeps a position
 * meaningful across a zoom that a pixel offset would silently
 * invalidate.
 *
 * Pure functions over offsets rather than DOM reads, so the geometry
 * can be asserted without a layout engine.
 */

import type { PageIndex } from '../domain/reading-state.ts';

/** One page's vertical extent inside the scroller's content, in CSS
 *  pixels measured from the top of that content. */
export interface PageExtent {
	readonly pageIndex: PageIndex;
	readonly top: number;
	readonly height: number;
}

/** Where the reader is, as stored: `pageOffsetRatio` is how far the
 *  viewport's midpoint sits into the page, from `0` at its top edge to
 *  `1` at its bottom.
 *
 *  Measured from the viewport's midpoint, because that is the same
 *  point that decides which page the reader is on — so saving and
 *  restoring are exact inverses of each other. A top-edge-anchored
 *  ratio would be independent of the window size, which sounds better
 *  and is not: it cannot be inverted without also reconstructing the
 *  window, so a position stored near the end of a page would restore
 *  to a place the reader is no longer on, and the next save would
 *  record a different page. That drift is worse than a position that
 *  is anchored to a window.
 *
 *  It also matches what a reader means by "I was on this page": the
 *  page under the middle of the window is the one they are looking
 *  at, not the one whose own middle has already gone past.
 */
export interface ScrollPosition {
	readonly pageOffsetRatio: number;
	/** A `DocumentPosition` is an opaque record; this makes the shape
	 *  assignable to one without a cast at the repository boundary. */
	readonly [key: string]: number;
}

/** The reader's position plus the page it belongs to. */
export interface CurrentPosition extends ScrollPosition {
	readonly pageIndex: PageIndex;
	readonly pageOffsetRatio: number;
}

/** The midpoint of the visible area: the line that decides which page
 *  the reader is "on". Using the middle rather than the top edge keeps
 *  the label stable while a page is only partly scrolled past. */
function viewportMiddle(scrollTop: number, clientHeight: number): number {
	return scrollTop + clientHeight / 2;
}

function clamp01(value: number): number {
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

/**
 * Which page the reader is on, and how far into it.
 *
 * The rule: the first page whose own midpoint is at or below the
 * viewport's midpoint, falling back to the last page when the
 * scroller is past the end of the content (which happens with a short
 * final page). Returns `null` for an empty or unlaid-out page list, so
 * a caller can tell "no pages yet" from "page 1".
 */
export function currentPositionFrom(
	pages: readonly PageExtent[],
	scrollTop: number,
	clientHeight: number,
): CurrentPosition | null {
	const measured = pages.filter((page) => page.height > 0);
	if (measured.length === 0) return null;

	const middle = viewportMiddle(scrollTop, clientHeight);
	for (const page of measured) {
		// The page the midpoint falls inside: its bottom has not yet
		// passed the reader's line of sight.
		if (page.top + page.height < middle) continue;
		return {
			pageIndex: page.pageIndex,
			pageOffsetRatio: clamp01((middle - page.top) / page.height),
		};
	}

	const last = measured[measured.length - 1];
	if (last === undefined) return null;
	return { pageIndex: last.pageIndex, pageOffsetRatio: 1 };
}

/**
 * The scroll offset that puts the reader back where they were.
 *
 * The exact inverse of `currentPositionFrom`: the viewport midpoint is
 * placed `ratio × page.height` into the page, which is where it was
 * when the position was recorded. `clientHeight` is part of the
 * signature for that reason — restoring is only defined relative to a
 * viewport.
 */
export function scrollTopForPosition(
	page: PageExtent,
	position: ScrollPosition,
	clientHeight: number,
): number {
	const middle = page.top + clamp01(position.pageOffsetRatio) * page.height;
	return Math.max(0, middle - clientHeight / 2);
}
