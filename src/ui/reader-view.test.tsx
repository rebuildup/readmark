/**
 * Component tests for the reader view's progress behaviour.
 *
 * Four things are under test, and they are the ways this feature can
 * quietly destroy or ignore a reader's place in a document:
 *
 *   - A save before the stored position has been applied would write
 *     "page 1, offset 0" over the position being restored, because an
 *     unmeasured layout reports exactly that.
 *   - A debounce that never flushes loses the last stretch of a read
 *     when the reader closes the tab or navigates away.
 *   - A restore that reads a page's *reserved* height instead of its
 *     measured one lands a few percent off on every page, and the
 *     error accumulates down a long document.
 *   - A stored page that is not in the document would leave the view
 *     waiting for a target that never appears, suppressing every save
 *     for the rest of the session.
 *
 * happy-dom has no layout, so the page geometry is faked: pages have a
 * real height that differs from the provisional one the view reserves
 * (that difference is the point of the third case), a page is as tall
 * as its content only once the fake handle has rendered it, and the
 * intersection observer materializes whatever the scroller's band
 * covers.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex, type PageIndex } from '../domain/reading-state.ts';
import { currentPositionFrom } from '../reader/position.ts';
import type { PageHandle, ReaderHandle } from '../reader/types.ts';
import { ReaderView } from './reader-view.tsx';

/** Typed so the arguments the view passes are inspectable. */
interface SaveParams {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
	readonly currentPage: PageIndex;
	readonly position: { readonly pageOffsetRatio: number };
}

const saveReadingPosition = vi.fn(async (_params: SaveParams): Promise<void> => {});

/**
 * The factory is hoisted above the declarations below, so it may only
 * reference them lazily: naming the spy directly would be a temporal
 * dead zone error at import time.
 */
vi.mock('../storage/reading-state-repo.ts', () => ({
	saveReadingPosition: (...args: [SaveParams]) => saveReadingPosition(...args),
	getReadingProgress: vi.fn(async () => null),
	deleteReadingProgress: vi.fn(async () => false),
}));

// The view reads the mark list on mount, and the real repository needs
// IndexedDB, which this environment does not have. Bookmark behaviour
// has its own file; here the list only has to be empty and quiet.
vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: vi.fn(async () => []),
	addBookmark: vi.fn(),
	deleteBookmark: vi.fn(),
}));

const DOC_ID = asDocumentId('00000000-0000-4000-8000-0000000000bb');

const FINGERPRINT = asSourceFingerprint('c'.repeat(64));

const PAGE_COUNT = 3;
/** The page the restore tests steer to. It is rendered last, so the
 *  coarse→exact window is wide enough to observe. */
const RESTORE_TARGET_PAGE = 3;
/** The real page height, once rendered. */
const PAGE_HEIGHT = 800;
/** The provisional height the view reserves for an unrendered page
 *  (A4 portrait). Deliberately not the same as the real one. */
const RESERVED_HEIGHT = 842;
const PAGE_GAP = 40;
const VIEWPORT_HEIGHT = 600;

/** Pages the fake handle has rendered: these are as tall as their
 *  content, the rest are only as tall as their reservation. */
const renderedPages = new Set<number>();

/**
 * Pages whose render is parked until the test opens them.
 *
 * The restore is coarse-then-exact: the coarse pass brings the target
 * into the prefetch band, and the exact pass runs once that page has a
 * measured height. Only a takeover *between* those can be abandoned, and
 * the gap is one frame wide — a test that polls for it catches it only
 * when the machine is slow, which is the worst possible failure mode
 * for an assertion that is supposed to always hold.
 *
 * Parking the target's render makes the gap as wide as the test needs
 * it, so "the reader scrolled before the exact pass ran" becomes a state
 * the test constructs rather than one it races for.
 */
const heldPages = new Map<number, { promise: Promise<void>; release: () => void }>();

/** Park the next render of `pageIndex` until `releaseRender` is called. */
function holdRender(pageIndex: number): void {
	if (heldPages.has(pageIndex)) return;
	let release: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	heldPages.set(pageIndex, { promise, release });
}

/** Let a parked render finish. Idempotent, and does not re-gate a page
 *  that renders again later. */
function releaseRender(pageIndex: number): void {
	const held = heldPages.get(pageIndex);
	if (held === undefined) return;
	heldPages.delete(pageIndex);
	held.release();
}

const fakePage = {
	format: 'pdf',
	render: vi.fn(async (target: HTMLElement, options: { scale?: number }) => {
		// Stands in for the real handle: drop a measured page wrapper
		// into the host, which is what the view measures afterwards.
		const host = target.closest<HTMLElement>('[data-page-index]');
		if (host === null) return;
		const index = Number(host.dataset.pageIndex);
		const held = heldPages.get(index);
		// Parked *before* the page counts as rendered, so the view still
		// sees a reserved box for it — which is the state under test.
		if (held !== undefined) await held.promise;
		renderedPages.add(index);
		target.replaceChildren();
		const page = document.createElement('div');
		page.className = 'rm-page';
		page.style.width = '420px';
		page.style.height = `${PAGE_HEIGHT * (options.scale ?? 1)}px`;
		target.appendChild(page);
	}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async () => null),
} as unknown as PageHandle<'pdf'>;

const fakeHandle = {
	format: 'pdf',
	pageCount: vi.fn(async () => PAGE_COUNT),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn(async () => null),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

type StoredPosition = {
	readonly currentPage: PageIndex;
	readonly position: { readonly pageOffsetRatio: number };
} | null;

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const originalRaf = globalThis.requestAnimationFrame;
const originalIntersectionObserver = globalThis.IntersectionObserver;

/** Cumulative content offset of a page, from the fake geometry. */
function pageTop(index: number): number {
	let top = 0;
	for (let previous = 1; previous < index; previous++) {
		top += pageHeight(previous) + PAGE_GAP;
	}
	return top;
}

function pageHeight(index: number): number {
	return renderedPages.has(index) ? PAGE_HEIGHT : RESERVED_HEIGHT;
}

/**
 * Materializes whatever the scroller's band covers, the way a browser
 * does.
 *
 * happy-dom's own observer never reports, which would leave every page
 * unrendered — and with no page rendered, no page is ever measured, so
 * a restore could never leave its first phase and the two-phase
 * behaviour would be untestable rather than absent.
 */
class ViewportAwareObserver implements IntersectionObserver {
	readonly root = null;
	readonly rootMargin = '';
	readonly thresholds: readonly number[] = [];
	private readonly pending = new Map<Element, boolean>();
	private readonly scroller: HTMLElement | null;
	private readonly onScroll = () => this.recheck();

	constructor(private readonly callback: IntersectionObserverCallback) {
		this.scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
		this.scroller?.addEventListener('scroll', this.onScroll, { passive: true });
	}

	disconnect(): void {
		this.scroller?.removeEventListener('scroll', this.onScroll);
	}

	observe(target: Element): void {
		this.pending.set(target, false);
		queueMicrotask(() => this.recheck());
		// Also poll for a while. happy-dom does not fire `scroll` when
		// `scrollTop` is assigned, and a jump's first phase is exactly
		// that: a programmatic scroll that has to bring a page into
		// range. A browser recomputes intersection on the frame after a
		// scroll, which is what these ticks stand in for.
		this.poll();
	}

	/** A bounded re-check loop, so a programmatic scroll brings pages
	 *  into range the way a real one does. */
	private poll(): void {
		if (this.pending.size === 0) return;
		setTimeout(() => {
			this.recheck();
			this.poll();
		}, 0);
	}

	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}

	unobserve(target: Element): void {
		this.pending.delete(target);
	}

	private recheck(): void {
		if (this.scroller === null) return;
		const box = this.scroller.getBoundingClientRect();
		const entering: IntersectionObserverEntry[] = [];
		for (const [target, seen] of this.pending) {
			if (seen) continue;
			const page = target.getBoundingClientRect();
			if (page.bottom <= box.top || page.top >= box.bottom) continue;
			this.pending.set(target, true);
			entering.push({ isIntersecting: true } as IntersectionObserverEntry);
		}
		if (entering.length > 0) this.callback(entering, this);
	}
}

beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
		fillStyle: '',
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

	Element.prototype.getBoundingClientRect = function rect(this: Element) {
		const scrollerTop =
			document.querySelector<HTMLElement>('[data-testid="rm-reader-scroll"]')?.scrollTop ?? 0;
		const host = this instanceof HTMLElement ? this.closest('[data-page-index]') : null;
		if (host instanceof HTMLElement) {
			const index = Number(host.dataset.pageIndex);
			// Viewport-relative, like a real browser: a page's box moves
			// up as the scroller scrolls. The view converts back to
			// content coordinates itself.
			const top = pageTop(index) - scrollerTop;
			return {
				x: 0,
				y: top,
				width: 420,
				height: pageHeight(index),
				top,
				left: 0,
				right: 420,
				bottom: top + pageHeight(index),
				toJSON: () => ({}),
			} as DOMRect;
		}
		if (this instanceof HTMLElement && this.dataset.testid === 'rm-reader-scroll') {
			return {
				x: 0,
				y: 0,
				width: 800,
				height: VIEWPORT_HEIGHT,
				top: 0,
				left: 0,
				right: 800,
				bottom: VIEWPORT_HEIGHT,
				toJSON: () => ({}),
			} as DOMRect;
		}
		return {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			toJSON: () => ({}),
		} as DOMRect;
	};

	// Frames on a macrotask: the view throttles scroll handling through
	// rAF, and a real frame wait would make every assertion a sleep.
	// A macrotask rather than a direct call, because the page-jump poll
	// has to yield to the event loop between frames for React to commit
	// a render — a synchronous (or microtask-only) rAF starves it and
	// the exact phase never runs.
	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		setTimeout(() => callback(0), 0);
		return 1;
	}) as typeof globalThis.requestAnimationFrame;

	globalThis.IntersectionObserver = ViewportAwareObserver as unknown as typeof IntersectionObserver;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
	Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
	globalThis.requestAnimationFrame = originalRaf;
	globalThis.IntersectionObserver = originalIntersectionObserver;
});

/**
 * Render, then wait for page 1 to materialize: until it has, the other
 * pages reserve a provisional height and the geometry under test is not
 * the one a reader would see.
 */
async function renderView(initialPosition: StoredPosition) {
	const result = render(
		// The view's header links back to the library, so it needs a
		// router; nothing here exercises routing.
		<MemoryRouter>
			<ReaderView
				handle={fakeHandle}
				pageCount={PAGE_COUNT}
				title="position test"
				documentId={DOC_ID}
				sourceFingerprint={FINGERPRINT}
				initialPosition={initialPosition}
			/>
		</MemoryRouter>,
	);
	// The viewport height has to be in place before the first effect
	// runs: the restore reads it, and happy-dom reports 0.
	scroller();
	// Pump microtasks rather than waiting on a timer: several tests
	// install fake timers before rendering, and `waitFor` would then
	// wait for a clock only these tests advance.
	for (let attempt = 0; attempt < 20 && !renderedPages.has(1); attempt++) {
		await act(async () => {
			await Promise.resolve();
		});
	}
	expect(renderedPages.has(1)).toBe(true);
	return result;
}

function scroller(): HTMLElement {
	const element = screen.getByTestId('rm-reader-scroll');
	Object.defineProperty(element, 'clientHeight', { value: VIEWPORT_HEIGHT, configurable: true });
	return element;
}

/**
 * Scroll and let the view's rAF-throttled handler run. The frame
 * callback is what turns a scroll event into a position, and fake
 * timers own rAF once they are installed.
 */
async function scrollTo(offset: number): Promise<void> {
	const element = scroller();
	element.scrollTop = offset;
	fireEvent.scroll(element);
	await act(async () => {
		vi.advanceTimersByTime(20);
	});
}

/**
 * Wait for the restore's coarse pass to have moved the scroller, and
 * return where it stopped.
 *
 * With the target page's render parked there is no exact pass to race,
 * so this only has to wait for the coarse `scrollTop` assignment, which
 * is synchronous once the restore effect runs.
 */
async function waitForCoarseRestore(): Promise<number> {
	for (let tick = 0; tick < 40; tick++) {
		const offset = scroller().scrollTop;
		if (offset > 0) return offset;
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	}
	throw new Error('the restore never reached its coarse phase');
}

/**
 * Wait until no further page has been materialized for a few ticks.
 *
 * Asserting a position while pages are still rendering measures a
 * moving layout: each new page changes the heights above the reader,
 * which moves the reported ratio. The restore is finished when the
 * page set stops growing, and that is when the offset can be checked.
 */
async function waitForStableLayout(): Promise<void> {
	let previous = -1;
	for (let tick = 0; tick < 40; tick++) {
		await new Promise((resolve) => setTimeout(resolve, 5));
		if (renderedPages.size === previous) return;
		previous = renderedPages.size;
	}
}

/**
 * Whether the reader is within `tolerance` of the stored offset.
 *
 * The offset within the target page is exact. The absolute scroll
 * offset is not, and cannot be: the pages above the target carry
 * reserved heights until they render, so their real contribution is
 * unknown without materializing the whole prefix of the document. The
 * bound is the accumulated reservation error of the pages above, which
 * is what ADR-0002 means by an advisory pointer — the page is always
 * right, the place within it is right to within a few percent.
 */
function offsetWithin(
	position: { pageOffsetRatio: number } | null,
	stored: number,
	tolerance: number,
): boolean {
	if (position === null) return false;
	return Math.abs(position.pageOffsetRatio - stored) <= tolerance;
}

/**
 * The position a reader is actually looking at, computed with the same
 * pure function the view uses. This is the promise the feature makes —
 * "back to this page, roughly the same place within it" — and it is
 * what distinguishes a restore that used a page's measured height from
 * one that used its reserved height.
 */
function renderedPosition(): { pageIndex: number; pageOffsetRatio: number } | null {
	const pages = Array.from(document.querySelectorAll<HTMLElement>('[data-page-index]'))
		.map((host) => {
			const index = Number(host.dataset.pageIndex);
			return {
				pageIndex: asPageIndex(index),
				top: pageTop(index),
				height: pageHeight(index),
			};
		})
		.sort((a, b) => a.top - b.top);
	return currentPositionFrom(pages, scroller().scrollTop, VIEWPORT_HEIGHT);
}

beforeEach(() => {
	vi.clearAllMocks();
	renderedPages.clear();
	// A page left parked by an earlier test would stall every later
	// restore, and the failure would point at the wrong test.
	for (const page of [...heldPages.keys()]) releaseRender(page);
	saveReadingPosition.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('saving the position', () => {
	it('debounces a run of scrolls into one write', async () => {
		vi.useFakeTimers();
		await renderView(null);

		for (const offset of [100, 200, 300, 400]) {
			await scrollTo(offset);
		}
		expect(saveReadingPosition).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		// One row per settled position, not one per scroll event: a
		// read would otherwise be hundreds of IndexedDB writes.
		expect(saveReadingPosition).toHaveBeenCalledTimes(1);
		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
		});
	});

	it('writes once for a continuous scroll, and only after it stops', async () => {
		vi.useFakeTimers();
		await renderView(null);

		// Nine frames, 200ms apart: two seconds of continuous
		// movement. A throttle would write at 800ms and again at
		// 1600ms; a debounce writes once, when the reader stops. That
		// is the acceptance criterion for #5 in words.
		for (let step = 0; step < 9; step++) {
			await scrollTo(10 * (step + 1));
			await act(async () => {
				vi.advanceTimersByTime(200);
			});
		}
		expect(saveReadingPosition).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(900);
		});
		expect(saveReadingPosition).toHaveBeenCalledTimes(1);
		// The write carries where the reader ended up, not where they
		// were when the first frame was handled.
		// The midpoint is at scrollTop + 300 = 390, which is 390/800 of
		// the way into page 1.
		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({
			currentPage: 1,
			position: { pageOffsetRatio: 390 / PAGE_HEIGHT },
		});
	});

	it('still writes during a scroll that never pauses', async () => {
		vi.useFakeTimers();
		await renderView(null);

		// A reader who holds Page Down for a minute must not lose the
		// whole session to a crash, so a continuous scroll still writes
		// at a bounded interval.
		for (let step = 0; step < 20; step++) {
			await scrollTo(40 * (step + 1));
			await act(async () => {
				vi.advanceTimersByTime(300);
			});
		}
		expect(saveReadingPosition.mock.calls.length).toBeGreaterThan(0);
	});

	it('records the page and the offset the reader is on', async () => {
		vi.useFakeTimers();
		await renderView(null);
		// The viewport midpoint is at scrollTop + 300, and the page the
		// reader is on is the one that midpoint falls inside: page 1,
		// 350px down.
		await scrollTo(50);

		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({
			currentPage: 1,
			position: { pageOffsetRatio: 350 / PAGE_HEIGHT },
		});
	});

	it('flushes what is still debounced when the view goes away', async () => {
		vi.useFakeTimers();
		const { unmount } = await renderView(null);
		await scrollTo(50);
		expect(saveReadingPosition).not.toHaveBeenCalled();

		unmount();

		// Closing the tab mid-read must not lose the last stretch of
		// progress; the debounce would otherwise swallow it.
		expect(saveReadingPosition).toHaveBeenCalledTimes(1);
		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({ currentPage: 1 });
	});

	it('never overwrites the stored position with the unmeasured one', async () => {
		vi.useFakeTimers();
		await renderView({ currentPage: asPageIndex(2), position: { pageOffsetRatio: 0.5 } });
		await act(async () => {
			vi.advanceTimersByTime(2000);
		});

		// The scroll handler runs on mount against a layout that is
		// still provisional, where every page reports the top of the
		// scroller: "page 1, offset 0". If that were saved, the stored
		// position would be destroyed by merely opening the document.
		for (const call of saveReadingPosition.mock.calls) {
			expect(call[0]).toMatchObject({
				currentPage: 2,
				position: { pageOffsetRatio: 0.5 },
			});
		}
	});

	it('keeps reading after a failed write', async () => {
		vi.useFakeTimers();
		saveReadingPosition.mockRejectedValueOnce(new Error('quota'));
		await renderView(null);
		await scrollTo(50);
		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		// A progress write is advisory; it must not surface as an
		// error the reader has to dismiss mid-read.
		await scrollTo(120);
		await act(async () => {
			vi.advanceTimersByTime(900);
		});
		expect(saveReadingPosition).toHaveBeenCalledTimes(2);
	});
});

describe('restoring the position', () => {
	it('scrolls the target page into range before committing', async () => {
		await renderView({ currentPage: asPageIndex(2), position: { pageOffsetRatio: 0.5 } });

		// Phase 1 exists at all: an unrendered page has no measurement,
		// so without a coarse scroll the exact phase would wait for a
		// target that only appears after scrolling to it.
		expect(renderedPages.has(2)).toBe(true);
	});

	it('lands on the stored page at the stored offset', async () => {
		await renderView({ currentPage: asPageIndex(2), position: { pageOffsetRatio: 0.5 } });
		await waitForStableLayout();

		await waitFor(() => {
			const position = renderedPosition();
			expect(position?.pageIndex).toBe(2);
			// The target page's real height, not its reservation: a
			// restore that used the reserved 842px would put the reader
			// 21px — 0.026 of the page — past the stored offset. The
			// bound is 0.02, so that version fails here.
			expect(offsetWithin(position, 0.5, 0.02)).toBe(true);
		});
	});

	it('lands further in with the offset applied to the page’s own size', async () => {
		await renderView({ currentPage: asPageIndex(3), position: { pageOffsetRatio: 0.25 } });
		await waitForStableLayout();

		await waitFor(() => {
			const position = renderedPosition();
			expect(position?.pageIndex).toBe(3);
			expect(offsetWithin(position, 0.25, 0.06)).toBe(true);
		});
	});

	it('saves the position the reader chose after taking over', async () => {
		vi.useFakeTimers();
		await renderView({ currentPage: asPageIndex(3), position: { pageOffsetRatio: 0.25 } });
		// Phase 1 has brought the target into range; the exact phase has
		// not run, so the stored position has not been applied.
		const afterCoarse = scroller().scrollTop;

		// The reader scrolls, then stops. The save gate has to be open
		// by then, or the position they chose is never recorded.
		fireEvent.wheel(scroller());
		await scrollTo(afterCoarse + 40);
		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		expect(saveReadingPosition).toHaveBeenCalled();
		const saved = saveReadingPosition.mock.calls.at(-1)?.[0];
		// Their position, not the one that was stored.
		expect(saved?.position.pageOffsetRatio).not.toBeCloseTo(0.25, 2);
		expect(renderedPosition()?.pageIndex).toBe(saved?.currentPage);
	});

	it('keeps saving after a keyboard scroll, whatever has focus', async () => {
		vi.useFakeTimers();
		await renderView({ currentPage: asPageIndex(3), position: { pageOffsetRatio: 0.25 } });

		// The scroller is a plain div and is not focusable, so a
		// listener on it would never see the keys a reader scrolls
		// with. These land on the document.
		fireEvent.keyDown(document, { key: 'PageDown' });
		await scrollTo(120);
		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		expect(saveReadingPosition).toHaveBeenCalled();
		expect(saveReadingPosition.mock.calls.at(-1)?.[0].position.pageOffsetRatio).not.toBeCloseTo(
			0.25,
			2,
		);
	});

	it('does not treat an ordinary keystroke as the reader moving', async () => {
		await renderView({ currentPage: asPageIndex(3), position: { pageOffsetRatio: 0.25 } });

		fireEvent.keyDown(document, { key: 'a' });
		fireEvent.keyDown(document, { key: 'Tab' });
		// The restore still completes: the reader did not take over.
		await waitFor(() => {
			expect(renderedPosition()?.pageIndex).toBe(3);
		});
	});

	it('abandons the restore when the reader scrolls first', async () => {
		// Park the target's render so the restore cannot get past its
		// coarse pass on its own. Without this the test asserts on
		// whichever side of the coarse→exact boundary it happens to
		// land, which is a coin flip rather than a contract.
		holdRender(RESTORE_TARGET_PAGE);
		await renderView({
			currentPage: asPageIndex(RESTORE_TARGET_PAGE),
			position: { pageOffsetRatio: 0.25 },
		});
		// Phase 1 has brought the page into range; the exact phase is
		// waiting on a page that is not going to arrive until we say so.
		const afterCoarseScroll = await waitForCoarseRestore();

		// A wheel event is the reader's own hand. Yanking them back to
		// where the app decided they were, after they have started
		// moving, is worse than opening them at the top.
		fireEvent.wheel(scroller());
		fireEvent.scroll(scroller());

		// Now let the page arrive. The exact pass must already have
		// been abandoned by the time it could have run.
		releaseRender(RESTORE_TARGET_PAGE);
		await waitFor(() => expect(renderedPages.has(RESTORE_TARGET_PAGE)).toBe(true));
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Still where the reader is, not at the stored ratio.
		expect(scroller().scrollTop).toBe(afterCoarseScroll);
		expect(renderedPosition()?.pageOffsetRatio).not.toBeCloseTo(0.25, 2);
	});

	it('leaves the scroll at the top for a first read', async () => {
		await renderView(null);
		expect(scroller().scrollTop).toBe(0);
	});

	it('shows the restored page in the header', async () => {
		await renderView({ currentPage: asPageIndex(3), position: { pageOffsetRatio: 0 } });

		// The label follows the restore rather than waiting for a
		// scroll event that a programmatic scroll may not raise.
		await waitFor(() => {
			expect(screen.getByTestId('rm-reader-page-indicator').textContent).toBe(`3 / ${PAGE_COUNT}`);
		});
	});
});

describe('a stored position that cannot be used', () => {
	it('resumes saving when the stored page is not in the document', async () => {
		vi.useFakeTimers();
		// A stale row: a 3-page document whose stored page is 99. The
		// view must not wait for a target that will never appear,
		// because that would suppress every save for the session.
		await renderView({ currentPage: asPageIndex(99), position: { pageOffsetRatio: 0.5 } });
		await scrollTo(50);
		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		expect(scroller().scrollTop).toBe(50);
		expect(saveReadingPosition).toHaveBeenCalledTimes(1);
		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({ currentPage: 1 });
	});
});
