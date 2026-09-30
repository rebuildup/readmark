/**
 * readmark — scrolling to a page.
 *
 * One operation with two callers: restoring the reader's last position
 * after a reopen, and jumping to a bookmark. Both need the same
 * thing, and the thing is not a one-liner.
 *
 * A page that has never been rendered has a *reserved* box — the size
 * of the last measured page, or a provisional one — and no measured
 * size of its own. Scrolling to the reserved box and calling it done
 * is wrong in a way that is invisible on a uniform document and grows
 * down a mixed-size one: the stored offset is applied to a height the
 * page does not have, and nothing corrects it afterwards because the
 * operation considers itself finished.
 *
 * So a jump is two phases:
 *
 *   1. Coarse. Scroll the target into the prefetch band using its
 *      reserved box. Cheap, always available, not committed.
 *   2. Exact. Wait for the page to render, then apply the offset to
 *      its measured height.
 *
 * The wait is a bounded frame poll rather than a promise from the
 * renderer: the page that has to render is the one the scroll itself
 * brings into range, and there is no event to await. If the reader
 * takes over (a wheel, a key, a drag) the exact phase is abandoned —
 * pulling someone back to where the app decided they were, after they
 * have started moving, is worse than not finishing the jump.
 *
 * This module owns the DOM. The reader contract stays format-agnostic
 * and DOM-free: it hands out pages and positions, and this is the
 * layer that knows how to get from one to the other.
 */

import type { PageIndex } from '../domain/reading-state.ts';
import { type PageExtent, type ScrollPosition, scrollTopForPosition } from '../reader/position.ts';

/** How the jump ended. Reported rather than thrown: every outcome is
 *  a legitimate state, and the caller decides what to show. */
export type PageJumpOutcome =
	/** The exact position was applied. */
	| 'applied'
	/** The page was brought into range but never rendered, so the
	 *  coarse position stands. The reader is on the right page. */
	| 'coarse'
	/** The reader took over before the exact phase could run. */
	| 'aborted'
	/** There is no such page in this document. */
	| 'out-of-range';

/** How long to wait for the target page to render, in animation
 *  frames. At 60fps this is two seconds: long enough for a worker to
 *  decode a heavy page, short enough that a page which will never
 *  render does not leave the reader waiting. */
const MAX_WAIT_FRAMES = 120;

/** How many times the exact offset is re-applied while the pages above
 *  the target settle into their real sizes. Each pass is one animation
 *  frame, so this is a few tens of milliseconds; the bound exists so a
 *  document whose layout never converges cannot spin here. */
const MAX_SETTLE_PASSES = 12;

export interface PageJumpRequest {
	readonly scroller: HTMLElement;
	readonly pageIndex: PageIndex;
	readonly position: ScrollPosition;
	/** Total pages, so an impossible target is rejected instead of
	 *  waited for. */
	readonly pageCount: number;
	/** Measured height of a page, or `undefined` while it is
	 *  unrendered. The view keeps the map. */
	readonly measuredHeight: (pageIndex: PageIndex) => number | undefined;
	/** Ask before each phase: has the reader taken over? */
	readonly shouldAbort?: () => boolean;
}

export async function jumpToPage(request: PageJumpRequest): Promise<PageJumpOutcome> {
	const { scroller, pageIndex, position, pageCount, measuredHeight } = request;
	const abort = request.shouldAbort ?? (() => false);

	if (pageIndex < 1 || pageIndex > pageCount) return 'out-of-range';
	if (abort()) return 'aborted';

	const host = scroller.querySelector<HTMLElement>(`[data-page-index="${pageIndex}"]`);
	if (host === null) return 'out-of-range';

	const extentOf = (height: number): PageExtent => {
		const box = host.getBoundingClientRect();
		const scrollerBox = scroller.getBoundingClientRect();
		return {
			pageIndex,
			top: box.top - scrollerBox.top + scroller.scrollTop,
			height,
		};
	};

	const apply = (height: number) => {
		scroller.scrollTop = scrollTopForPosition(extentOf(height), position, scroller.clientHeight);
	};

	// Phase 3: settle.
	//
	// Measuring the TARGET page is not sufficient. The target's offset
	// is the sum of every page above it, including the ones still
	// holding a *reserved* box, because a page only renders once the
	// scroller reaches it. Scrolling the target into range can therefore
	// grow the pages above it, which moves the target and invalidates
	// the offset just applied.
	//
	// At 100% the reserved A4 box is close enough to the real one that
	// one pass passes by luck. The reader opens at fit-width now, where
	// a reserved A4 box is ~25% taller than a real 420x896pt page, and
	// the error compounds: restoring to page 7 of 12 landed on page 4.
	//
	// Convergence is judged on `offsetTop`, NOT on
	// `getBoundingClientRect().top`. The latter is viewport-relative, so
	// it changes every time we scroll — comparing it across passes
	// measures our own scrolling, never stabilises, and silently burns
	// the whole pass budget. `offsetTop` is the layout position and is
	// the thing that has to stop moving.
	const settle = async (): Promise<PageJumpOutcome> => {
		let lastTop = Number.NaN;
		for (let pass = 0; pass < MAX_SETTLE_PASSES; pass++) {
			// Yield before the first apply, and re-check for a takeover.
			//
			// The exact phase runs after an await (the page has to render),
			// so the reader can take over inside it. Applying on the same
			// tick we discovered the page is measured moves someone who has
			// already started scrolling back to where the app decided they
			// were — the exact outcome the abort check exists to prevent.
			await nextFrame();
			if (abort()) return 'aborted';
			const height = measuredHeight(pageIndex);
			if (height === undefined) return 'coarse';
			apply(height);
			await nextFrame();
			if (abort()) return 'aborted';
			const top = host.offsetTop;
			if (Number.isFinite(lastTop) && Math.abs(top - lastTop) < 1) return 'applied';
			lastTop = top;
		}
		return 'applied';
	};

	const measured = measuredHeight(pageIndex);
	if (measured !== undefined) {
		if (abort()) return 'aborted';
		return await settle();
	}

	// Phase 1: into the prefetch band, at ratio 0 — the top of the
	// page is enough to make the band cover it.
	const reserved = extentOf(host.getBoundingClientRect().height);
	scroller.scrollTop = Math.max(0, reserved.top - scroller.clientHeight / 2);
	if (abort()) return 'aborted';

	// Phase 2: wait for the page to be rendered and measured.
	for (let frame = 0; frame < MAX_WAIT_FRAMES; frame++) {
		if (abort()) return 'aborted';
		const height = measuredHeight(pageIndex);
		if (height !== undefined) {
			// The page is now as tall as its content, so the offset is
			// applied to a height that is really its own.
			apply(height);
			return 'applied';
		}
		await nextFrame();
	}
	return 'coarse';
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => resolve());
			return;
		}
		resolve();
	});
}
