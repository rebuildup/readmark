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

/** Where the reader is, as stored. `pageOffsetRatio` is `0` when the
 *  page's top edge is at the top of the viewport and `1` when the
 *  page's bottom edge is.
 *
 *  Anchored to the page's own top edge rather than to the viewport's
 *  middle: a midpoint-anchored ratio would encode the reader's window
 *  height into the stored value, so the same visual position would
 *  restore differently on a laptop and on a desktop. The cost is that
 *  the position is quantized to the start of the page it belongs to,
 *  which is the trade the page index is carrying anyway. */
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
		if (page.top + page.height / 2 < middle) continue;
		return {
			pageIndex: page.pageIndex,
			pageOffsetRatio: clamp01((scrollTop - page.top) / page.height),
		};
	}

	const last = measured[measured.length - 1];
	if (last === undefined) return null;
	return { pageIndex: last.pageIndex, pageOffsetRatio: 1 };
}

/**
 * The scroll offset that puts the reader back where they were.
 *
 * Inverts `currentPositionFrom`: the page's top edge is placed at
 * `ratio × page.height` below the top of the viewport. A page shorter
 * than the viewport still lands correctly — the ratio simply saturates.
 */
export function scrollTopForPosition(page: PageExtent, position: ScrollPosition): number {
	return Math.max(0, page.top + clamp01(position.pageOffsetRatio) * page.height);
}
