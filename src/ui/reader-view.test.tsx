/**
 * Component tests for the reader view's progress behaviour.
 *
 * Three things are under test, and they are the three ways this
 * feature can quietly destroy a reader's place in a document:
 *
 *   - A save before the stored position has been applied would write
 *     "page 1, offset 0" over the position being restored, because an
 *     unmeasured layout reports exactly that.
 *   - A debounce that never flushes loses the last stretch of a read
 *     when the reader closes the tab or navigates away.
 *   - A restore that lands on the wrong offset sends the reader to a
 *     page they have never read.
 *
 * happy-dom has no layout, so `getBoundingClientRect` and the scroll
 * metrics are stubbed with a small fake document: three pages of a
 * known height, which is enough for the geometry to be real from the
 * view's point of view.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex, type PageIndex } from '../domain/reading-state.ts';
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

const DOC_ID = asDocumentId('00000000-0000-4000-8000-0000000000bb');
const FINGERPRINT = asSourceFingerprint('c'.repeat(64));

/** Three 800px pages, 40px apart, inside a 600px scroller. */
const PAGE_COUNT = 3;
const PAGE_HEIGHT = 800;
const PAGE_GAP = 40;
const VIEWPORT_HEIGHT = 600;

const fakePage = {
	format: 'pdf',
	render: vi.fn(async () => {}),
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

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const originalRaf = globalThis.requestAnimationFrame;

beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
		fillStyle: '',
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

	Element.prototype.getBoundingClientRect = function rect(this: Element) {
		// Viewport-relative, like a real browser: a page's box moves up
		// as the scroller scrolls. The view converts back to content
		// coordinates itself.
		const scrollerTop =
			document.querySelector<HTMLElement>('[data-testid="rm-reader-scroll"]')?.scrollTop ?? 0;
		const host = this instanceof HTMLElement ? this.closest('[data-page-index]') : null;
		if (host instanceof HTMLElement) {
			const index = Number(host.dataset.pageIndex);
			const top = (index - 1) * (PAGE_HEIGHT + PAGE_GAP) - scrollerTop;
			return {
				x: 0,
				y: top,
				width: 420,
				height: PAGE_HEIGHT,
				top,
				left: 0,
				right: 420,
				bottom: top + PAGE_HEIGHT,
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

	// Immediate frames: the view throttles scroll handling through
	// rAF, and a real frame wait would make every assertion a sleep.
	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		callback(0);
		return 1;
	}) as typeof globalThis.requestAnimationFrame;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
	Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
	globalThis.requestAnimationFrame = originalRaf;
});

function renderView(
	initialPosition: {
		readonly currentPage: PageIndex;
		readonly position: { readonly pageOffsetRatio: number };
	} | null,
) {
	return render(
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
async function scrollTo(offset: number) {
	const element = scroller();
	element.scrollTop = offset;
	fireEvent.scroll(element);
	await act(async () => {
		vi.advanceTimersByTime(20);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	saveReadingPosition.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('saving the position', () => {
	it('debounces a run of scrolls into one write', async () => {
		vi.useFakeTimers();
		renderView(null);

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

	it('writes once for a continuous scroll, after it stops', async () => {
		vi.useFakeTimers();
		renderView(null);

		// Nine frames of scrolling, 200ms apart: two seconds of
		// continuous movement. A throttle would write at 800ms and
		// again at 1600ms; a debounce writes once, when the reader
		// stops. That is the acceptance criterion for #5.
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
		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({
			currentPage: 1,
			position: { pageOffsetRatio: 90 / PAGE_HEIGHT },
		});
	});

	it('still writes during a scroll that never pauses', async () => {
		vi.useFakeTimers();
		renderView(null);

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
		renderView(null);
		// The viewport midpoint is scrollTop + 300. Page 1 holds the
		// reader while that is above page 1's own centre (400), so at
		// scrollTop 50 the reader is 50px into page 1.
		await scrollTo(50);

		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({
			currentPage: 1,
			position: { pageOffsetRatio: 50 / PAGE_HEIGHT },
		});
	});

	it('flushes what is still debounced when the view goes away', async () => {
		vi.useFakeTimers();
		const { unmount } = renderView(null);
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
		renderView({ currentPage: asPageIndex(2), position: { pageOffsetRatio: 0.5 } });
		await act(async () => {
			vi.advanceTimersByTime(2000);
		});

		// The scroll handler runs on mount against a layout that is
		// still provisional, where every page reports the top of the
		// scroller: "page 1, offset 0". If that were saved, the stored
		// position would be destroyed by merely opening the document.
		for (const call of saveReadingPosition.mock.calls) {
			expect(call[0]).toMatchObject({
				currentPage: asPageIndex(2),
				position: { pageOffsetRatio: 0.5 },
			});
		}
	});

	it('keeps reading after a failed write', async () => {
		vi.useFakeTimers();
		saveReadingPosition.mockRejectedValueOnce(new Error('quota'));
		renderView(null);
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

describe('a stored position that cannot be used', () => {
	it('resumes saving when the stored page is not in the document', async () => {
		vi.useFakeTimers();
		// A stale row: the reader is on a 3-page document and the store
		// says page 99. The view must not wait for a target that will
		// never appear, because that would suppress every save for the
		// rest of the session.
		renderView({ currentPage: asPageIndex(99), position: { pageOffsetRatio: 0.5 } });
		await scrollTo(50);
		await act(async () => {
			vi.advanceTimersByTime(900);
		});

		expect(scroller().scrollTop).toBe(50);
		expect(saveReadingPosition).toHaveBeenCalledTimes(1);
		expect(saveReadingPosition.mock.calls[0]?.[0]).toMatchObject({ currentPage: 1 });
	});
});

describe('restoring the position', () => {
	it('scrolls to the stored page and offset', async () => {
		renderView({ currentPage: asPageIndex(2), position: { pageOffsetRatio: 0.5 } });
		const element = scroller();

		await waitFor(() => {
			// Page 2 starts at 840, half of it is 400 further down.
			expect(element.scrollTop).toBe(840 + PAGE_HEIGHT * 0.5);
		});
	});

	it('leaves the scroll at the top for a first read', async () => {
		renderView(null);
		expect(scroller().scrollTop).toBe(0);
	});

	it('shows the restored page in the header', async () => {
		renderView({ currentPage: asPageIndex(3), position: { pageOffsetRatio: 0 } });
		await waitFor(() => expect(scroller().scrollTop).toBeGreaterThan(0));
		// The label follows the restore rather than waiting for a
		// scroll event that a programmatic scroll may not raise.
		await waitFor(() => {
			expect(screen.getByTestId('rm-reader-page-indicator').textContent).toBe(`3 / ${PAGE_COUNT}`);
		});
	});

	it('waits for the target page to be measured before restoring', async () => {
		// The page stack starts as provisional heights; restoring
		// against them would land at an arbitrary offset.
		renderView({ currentPage: asPageIndex(3), position: { pageOffsetRatio: 0.25 } });
		await waitFor(() => {
			expect(scroller().scrollTop).toBe(2 * (PAGE_HEIGHT + PAGE_GAP) + PAGE_HEIGHT * 0.25);
		});
	});
});
