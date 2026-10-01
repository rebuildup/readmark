/**
 * Locks the two-phase jump, and specifically the hand-off between them.
 *
 * ## The failure this prevents
 *
 * `jumpToPage` has two routes into its exact phase, and only one of
 * them used to settle:
 *
 *   - the target is already measured → settle
 *   - the target is a reserved box (a restore, a jump to a page that
 *     has never been rendered) → apply once, declare victory
 *
 * The second route is the one a restore takes, and it is the one that
 * cannot settle with a single apply. The target's `offsetTop` is the
 * sum of every page above it, and bringing the target into range is
 * *what makes it render* — so the pages above are still holding
 * reserved boxes at the exact moment the target gets its real height.
 * One apply lands on a layout that is about to change underneath it.
 *
 * At fit-width the reserved A4 box is ~25% taller than a real
 * 420x896pt page, so the error is not small: restoring to page 7 of 12
 * landed on page 4. That bug was fixed once, for the measured route,
 * and the reserved route was left behind.
 *
 * ## Why a hand-driven frame queue
 *
 * The window that matters is one frame wide: the target is measured,
 * and a frame or two later the pages above it are too. Polling for it
 * is the mistake `reader-view.test.tsx` documents, so the frames here
 * are driven by hand and layout changes are scheduled against a frame
 * index. Nothing races; the scenario is constructed rather than
 * waited for.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { asPageIndex, type PageIndex } from '../domain/reading-state.ts';
import { scrollTopForPosition } from '../reader/position.ts';
import { jumpToPage } from './scroll-to-page.ts';

/** The A4 box a page reserves before it has ever been measured. */
const RESERVED = 1000;
/** A short page's real height at fit-width — ~30% shorter than
 *  reserved. This gap is what turns a stale offset into a wrong page. */
const REAL_SHORT = 700;
/** The target's real height, taller than reserved this time, so the
 *  error is not a fixed direction the test could pass by accident. */
const REAL_TALL = 1400;
const VIEWPORT = 800;
const RATIO = 0.25;

/** A page in the fake layout. `measured` is `undefined` while it holds
 *  a reserved box, exactly as the view reports it. */
interface FakePage {
	readonly index: PageIndex;
	/** Set by the test, applied when the page is measured. */
	real: number;
	measured: number | undefined;
}

/** Typed page access. The layout is built by this file, so the index is
 *  known — but `noUncheckedIndexedAccess` does not know that, and an
 *  `as` here would hide a genuine off-by-one in a frame schedule. */
function pageAt(pages: readonly FakePage[], index: number): FakePage {
	const page = pages[index - 1];
	if (page === undefined) throw new Error(`the fake document has no page ${index}`);
	return page;
}

interface FakeDocument {
	readonly pages: FakePage[];
	readonly scroller: HTMLElement;
	readonly measuredHeight: (index: PageIndex) => number | undefined;
}

/** A stacked-page layout happy-dom will not compute for us. */
function documentOf(count: number): FakeDocument {
	const pages: FakePage[] = Array.from({ length: count }, (_, i) => ({
		index: asPageIndex(i + 1),
		real: RESERVED,
		measured: undefined,
	}));

	const heightOf = (index: PageIndex): number => pages[index - 1]?.measured ?? RESERVED;
	const topOf = (index: PageIndex): number => {
		let top = 0;
		for (let i = 1; i < index; i++) top += heightOf(asPageIndex(i));
		return top;
	};

	const scroller = document.createElement('div');
	// happy-dom does no layout, so the scroller reports itself at the
	// top of the viewport and at whatever offset the code assigned.
	Object.defineProperty(scroller, 'clientHeight', { get: () => VIEWPORT });
	Object.defineProperty(scroller, 'getBoundingClientRect', {
		value: () => ({
			top: 0,
			bottom: VIEWPORT,
			left: 0,
			right: 0,
			height: VIEWPORT,
			width: 0,
		}),
	});

	for (const page of pages) {
		const host = document.createElement('div');
		host.setAttribute('data-page-index', String(page.index));
		Object.defineProperty(host, 'offsetTop', { get: () => topOf(page.index) });
		Object.defineProperty(host, 'getBoundingClientRect', {
			value: () => {
				const top = topOf(page.index) - scroller.scrollTop;
				return {
					top,
					bottom: top + heightOf(page.index),
					left: 0,
					right: 0,
					height: heightOf(page.index),
					width: 0,
				};
			},
		});
		scroller.appendChild(host);
	}

	return { pages, scroller, measuredHeight: (index) => pages[index - 1]?.measured };
}

/** Frames, driven by hand. `requestAnimationFrame` is the only clock
 *  `scroll-to-page.ts` has, so replacing it replaces the schedule. */
let queued: Array<() => void> = [];

beforeEach(() => {
	queued = [];
	vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
		queued.push(cb);
		return queued.length;
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Run one frame's worth of callbacks, then let every promise chain
 *  that unblocked settle — including any that queue the next frame. */
async function tick(): Promise<void> {
	const due = queued.splice(0, queued.length);
	for (const cb of due) cb();
	await new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

/** Drive `work` to completion, calling `onFrame` before each frame so a
 *  test can schedule its layout changes against the frame index. */
async function drive(work: Promise<string>, onFrame: (frame: number) => void): Promise<string> {
	let settled = false;
	let value = '';
	let failure: unknown;
	void work.then(
		(v) => {
			value = v;
			settled = true;
		},
		(e) => {
			failure = e;
			settled = true;
		},
	);
	for (let frame = 0; !settled; frame++) {
		if (frame > 200) throw new Error('jumpToPage never finished');
		onFrame(frame);
		await tick();
	}
	if (failure !== undefined) throw failure;
	return value;
}

describe('jumpToPage', () => {
	it('rejects a target outside the document without waiting', async () => {
		const { scroller, measuredHeight } = documentOf(3);
		await expect(
			jumpToPage({
				scroller,
				pageIndex: asPageIndex(4),
				position: { pageOffsetRatio: 0 },
				pageCount: 3,
				measuredHeight,
			}),
		).resolves.toBe('out-of-range');
	});

	it('reports the coarse position when the page never renders', async () => {
		const { pages, scroller, measuredHeight } = documentOf(3);
		await expect(
			drive(
				jumpToPage({
					scroller,
					pageIndex: asPageIndex(3),
					position: { pageOffsetRatio: RATIO },
					pageCount: 3,
					measuredHeight,
				}),
				(frame) => {
					if (frame === 1) pageAt(pages, 1).measured = REAL_SHORT;
				},
			),
		).resolves.toBe('coarse');
	});

	it('abandons the jump once the reader takes over', async () => {
		const { scroller, measuredHeight } = documentOf(3);
		let takenOver = false;
		await expect(
			drive(
				jumpToPage({
					scroller,
					pageIndex: asPageIndex(3),
					position: { pageOffsetRatio: RATIO },
					pageCount: 3,
					measuredHeight,
					shouldAbort: () => takenOver,
				}),
				(frame) => {
					if (frame === 2) takenOver = true;
				},
			),
		).resolves.toBe('aborted');
	});

	it('settles the reserved route after the pages above it resize', async () => {
		// Four pages. The three above the target are short (700 real,
		// 1000 reserved); the target is tall. Restoring to page 4 of 4
		// is the case that used to land on page 1.
		const { pages, scroller, measuredHeight } = documentOf(4);
		for (const index of [1, 2, 3]) pageAt(pages, index).real = REAL_SHORT;
		pageAt(pages, 4).real = REAL_TALL;

		const outcome = await drive(
			jumpToPage({
				scroller,
				pageIndex: asPageIndex(4),
				position: { pageOffsetRatio: RATIO },
				pageCount: 4,
				measuredHeight,
			}),
			(frame) => {
				// The target renders first — it is what the coarse
				// scroll centred on — and the pages above it finish two
				// frames later, after the first apply has already run.
				if (frame === 1) pageAt(pages, 4).measured = REAL_TALL;
				if (frame === 3) {
					for (const index of [1, 2, 3]) pageAt(pages, index).measured = REAL_SHORT;
				}
			},
		);

		expect(outcome).toBe('applied');
		// Against the *settled* layout: 3 x 700 above, not 3 x 1000. A
		// single apply computes 2950 where the answer is 2050 — 900px,
		// more than a viewport at this size.
		expect(scroller.scrollTop).toBe(
			scrollTopForPosition(
				{ pageIndex: asPageIndex(4), top: 2100, height: REAL_TALL },
				{ pageOffsetRatio: RATIO },
				VIEWPORT,
			),
		);
		expect(scroller.scrollTop).toBe(2050);
	});

	it('honours a takeover that lands between the render and the first apply', async () => {
		// The settle loop yields a frame before its first apply
		// precisely so a takeover that arrives during the wait is seen.
		// An unrendered target always reaches the exact phase through an
		// await, so without that yield this window had no guard at all.
		const { pages, scroller, measuredHeight } = documentOf(3);
		let takenOver = false;
		const outcome = await drive(
			jumpToPage({
				scroller,
				pageIndex: asPageIndex(3),
				position: { pageOffsetRatio: RATIO },
				pageCount: 3,
				measuredHeight,
				shouldAbort: () => takenOver,
			}),
			(frame) => {
				if (frame === 1) pageAt(pages, 3).measured = REAL_TALL;
				if (frame === 2) takenOver = true;
			},
		);
		expect(outcome).toBe('aborted');
	});

	it('leaves an already-measured target where the same geometry says', async () => {
		// The route that always worked. Kept so the change cannot be
		// read as "settling is new" — the reserved route was the one
		// missing it.
		const { pages, scroller, measuredHeight } = documentOf(3);
		pageAt(pages, 1).measured = REAL_SHORT;
		pageAt(pages, 2).measured = REAL_SHORT;
		pageAt(pages, 3).measured = REAL_TALL;

		const outcome = await drive(
			jumpToPage({
				scroller,
				pageIndex: asPageIndex(3),
				position: { pageOffsetRatio: RATIO },
				pageCount: 3,
				measuredHeight,
			}),
			() => {},
		);

		expect(outcome).toBe('applied');
		expect(scroller.scrollTop).toBe(
			scrollTopForPosition(
				{ pageIndex: asPageIndex(3), top: 2 * REAL_SHORT, height: REAL_TALL },
				{ pageOffsetRatio: RATIO },
				VIEWPORT,
			),
		);
	});
});
