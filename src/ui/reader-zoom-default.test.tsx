/**
 * Regression tests for the OPENING zoom and for what happens to it after.
 *
 * `reader-zoom.test.ts` pins the arithmetic. This file pins the wiring,
 * because the arithmetic can be perfect and the reader still open
 * unreadable. Four behaviours, each of which has been wrong at least
 * once in a reader:
 *
 *   1. A fresh profile opens fit-width, not 100%. 100% is a printing
 *      notion; on a 515pt book it draws body text at roughly 10px.
 *   2. The fit is RECOMPUTED when the container resizes. A default
 *      computed once on mount is the failure this whole change is easy
 *      to write: the page fits the window the reader happened to open
 *      the document in, and is then wrong for every other width. The
 *      browser smoke cannot see this — it resizes only after the
 *      reader has taken over, which is the case where nothing should
 *      move.
 *   3. A zoom the reader already chose is NOT overwritten. "Default"
 *      has to mean default. A fit that re-asserts itself over an
 *      existing preference is not a default, it is a policy, and it
 *      silently discards a choice the reader made on purpose.
 *   4. Nothing renders NaN% or Infinity%. A page that has not measured
 *      itself yet, and a scroller that has not been laid out, both
 *      report zero — and zero is what a division blows up on.
 *
 * happy-dom has no layout, so the geometry is faked: the scroller
 * reports a width the test sets, the page reports its intrinsic size in
 * points, and the ResizeObserver is a stand-in the test fires by hand.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex } from '../domain/reading-state.ts';
import type { PageHandle, ReaderHandle } from '../reader/types.ts';
import { readerZoomKey, useUiStore } from '../stores/ui-store.ts';
import { FIT_WIDTH_PADDING_PX, ReaderView } from './reader-view.tsx';

// The view reads all three of these on mount, and each one reaches
// IndexedDB, which this environment does not have. None of them is what
// is under test; the zoom is a function of geometry alone.
vi.mock('../storage/reading-state-repo.ts', () => ({
	saveReadingPosition: vi.fn(async () => {}),
	getReadingProgress: vi.fn(async () => null),
	deleteReadingProgress: vi.fn(async () => false),
}));

vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: vi.fn(async () => []),
	addBookmark: vi.fn(),
	deleteBookmark: vi.fn(),
}));

vi.mock('../storage/highlights-repo.ts', () => ({
	listHighlights: vi.fn(async () => []),
	replaceHighlightAnchor: vi.fn(async () => true),
	listHighlightsOnPage: vi.fn(async () => []),
}));

const DOC_ID = asDocumentId('00000000-0000-4000-8000-00000000aa35');
const OTHER_DOC_ID = asDocumentId('00000000-0000-4000-8000-00000000bb35');
const FINGERPRINT = asSourceFingerprint('a'.repeat(64));
const ZOOM_KEY = readerZoomKey(DOC_ID, FINGERPRINT);

/** A typical trade book. The width is the number that matters: 515pt at
 *  100% is the unreadable state issue #35 is about. */
const PAGE_WIDTH_PT = 515;
const PAGE_HEIGHT_PT = 663;

/** The window the reader opens the book in. A laptop. */
const SCROLLER_WIDTH_PX = 1280;

/** What fit-width must produce at {@link SCROLLER_WIDTH_PX}:
 *  `(1280 - 48) / 515 = 2.3922…` → the toolbar's `239%`. */
const FIT_AT_1280 = Math.round(((SCROLLER_WIDTH_PX - FIT_WIDTH_PADDING_PX) / PAGE_WIDTH_PT) * 100);

/** The same arithmetic at a narrower window. Chosen so the expected
 *  value is far from FIT_AT_1280 — a resize that quietly did nothing
 *  must not be able to pass. */
const NARROW_SCROLLER_WIDTH_PX = 800;
const FIT_AT_800 = Math.round(
	((NARROW_SCROLLER_WIDTH_PX - FIT_WIDTH_PADDING_PX) / PAGE_WIDTH_PT) * 100,
);

/** The scale a reader picks, for the precedence tests. Deliberately
 *  equal to neither fit, so "the fit won" and "the choice won" are
 *  distinguishable by reading the label. */
const READER_CHOICE = 1.25;

let scrollerWidthPx = SCROLLER_WIDTH_PX;

// --- the fakes ---------------------------------------------------------

/** Live ResizeObservers, so a test can resize the container the way a
 *  browser does: change the measured width, then notify. Holding the
 *  instances rather than bare callbacks keeps the notification properly
 *  typed — a ResizeObserverCallback is handed the observer that fired. */
const liveResizeObservers = new Set<FakeResizeObserver>();

class FakeResizeObserver {
	private readonly callback: ResizeObserverCallback;

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
		liveResizeObservers.add(this);
	}

	/** Runs the callback the way the browser does, as a type. */
	notify(): void {
		this.callback([], this as unknown as ResizeObserver);
	}

	observe(): void {}
	unobserve(): void {}
	disconnect(): void {
		liveResizeObservers.delete(this);
	}
}

/** A page that reports its intrinsic size the way pdf.js does: the
 *  rendered element is `points × scale` wide, and the view recovers
 *  the points by dividing by the scale it just rendered at. */
const fakePage = {
	format: 'pdf',
	index: asPageIndex(1),
	render: vi.fn(async (target: HTMLElement, options: { scale?: number }) => {
		const scale = options.scale !== undefined && options.scale > 0 ? options.scale : 1;
		const page = document.createElement('div');
		page.className = 'rm-page';
		page.style.width = `${PAGE_WIDTH_PT * scale}px`;
		page.style.height = `${PAGE_HEIGHT_PT * scale}px`;
		// `PageHandle.render` replaces the target's content. Appending
		// instead would leave the previous, narrower page in the DOM for
		// the view to measure — and it reads the FIRST match, so the
		// intrinsic size would come from the scale-1 render forever.
		target.replaceChildren(page);
	}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async () => null),
} as unknown as PageHandle<'pdf'>;

/** One page is enough. Page 1 is materialized on mount, so this needs
 *  no IntersectionObserver at all — a smaller fake is a smaller chance
 *  of the harness standing in for the thing under test. */
const fakeHandle = {
	format: 'pdf',
	pageCount: vi.fn(async () => 1),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn(async () => null),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
		fillStyle: '',
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

	// happy-dom reports 0 for every layout box, and the scroller's width
	// is one of the two inputs to fit-width. Reading the test's own
	// variable is the closest a no-layout DOM gets to a real viewport.
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get(this: HTMLElement) {
			return this.dataset.testid === 'rm-reader-scroll' ? scrollerWidthPx : 0;
		},
	});

	globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
	if (originalClientWidth !== undefined) {
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
	} else {
		Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
	}
	globalThis.ResizeObserver = originalResizeObserver;
});

beforeEach(() => {
	vi.clearAllMocks();
	scrollerWidthPx = SCROLLER_WIDTH_PX;
	liveResizeObservers.clear();
	// A fresh profile. Any test that wants an existing preference files
	// one itself, so no test can pass on a neighbour's leftover.
	useUiStore.setState({ readerZoom: {} });
});

afterEach(() => {
	useUiStore.setState({ readerZoom: {} });
});

/** Resize the container the way a browser does: the measured width
 *  changes first, then the observer is notified. */
async function resizeContainerTo(widthPx: number): Promise<void> {
	scrollerWidthPx = widthPx;
	await act(async () => {
		for (const observer of [...liveResizeObservers]) observer.notify();
	});
}

/** The percentage the toolbar is showing, as a number. */
function shownZoom(): number {
	return Number.parseInt(screen.getByTestId('rm-reader-zoom').textContent ?? '', 10);
}

function renderReader() {
	return render(
		<MemoryRouter>
			<ReaderView
				handle={fakeHandle}
				pageCount={1}
				title="zoom default"
				documentId={DOC_ID}
				sourceFingerprint={FINGERPRINT}
				initialPosition={null}
			/>
		</MemoryRouter>,
	);
}

describe('the opening zoom', () => {
	it('fits the page to the width on a fresh profile with nothing saved', async () => {
		expect(useUiStore.getState().readerZoom).toEqual({});
		renderReader();

		// The first pass fits the A4 guess, and the real page's own width
		// arrives a tick later; the label has to settle on the real fit.
		await waitFor(() => {
			expect(shownZoom()).toBe(FIT_AT_1280);
		});
		// And the point of the whole change: a book must not open at 100%.
		expect(shownZoom()).toBeGreaterThan(150);
	});

	it('recomputes the fit when the container resizes', async () => {
		renderReader();
		await waitFor(() => {
			expect(shownZoom()).toBe(FIT_AT_1280);
		});

		// The one most likely to be silently wrong: a default computed
		// once on mount would still read 239% here, and every other
		// window size would be unreadable.
		await resizeContainerTo(NARROW_SCROLLER_WIDTH_PX);
		await waitFor(() => {
			expect(shownZoom()).toBe(FIT_AT_800);
		});
		expect(shownZoom()).not.toBe(FIT_AT_1280);

		// And back again, so the observer is observed and not just the
		// first notification after mount.
		await resizeContainerTo(SCROLLER_WIDTH_PX);
		await waitFor(() => {
			expect(shownZoom()).toBe(FIT_AT_1280);
		});
	});

	it('never reports a scale it cannot compute', async () => {
		// A scroller that has not been laid out yet reports zero, and
		// zero is what a division blows up on. The reader must hold a
		// real number rather than paint "NaN%" or "Infinity%".
		scrollerWidthPx = 0;
		renderReader();
		await waitFor(() => {
			expect(document.querySelector('canvas, .rm-page')).not.toBeNull();
		});

		const shown = shownZoom();
		expect(Number.isFinite(shown)).toBe(true);
		expect(shown).toBe(100);
	});
});

describe('a zoom the reader already chose', () => {
	beforeEach(() => {
		useUiStore.getState().setReaderZoom(ZOOM_KEY, READER_CHOICE);
	});

	it('opens at the saved scale instead of the new default', async () => {
		renderReader();

		// The fit would say 239%. The reader said 125%. The reader wins —
		// otherwise this change silently overrides an existing choice.
		await waitFor(() => {
			expect(shownZoom()).toBe(Math.round(READER_CHOICE * 100));
		});
		expect(shownZoom()).not.toBe(FIT_AT_1280);
	});

	it('keeps it through a resize the fit would otherwise have re-applied', async () => {
		renderReader();
		await waitFor(() => {
			expect(shownZoom()).toBe(Math.round(READER_CHOICE * 100));
		});

		await resizeContainerTo(NARROW_SCROLLER_WIDTH_PX);
		await resizeContainerTo(SCROLLER_WIDTH_PX);

		expect(shownZoom()).toBe(Math.round(READER_CHOICE * 100));
	});

	it('survives leaving the document and coming back', async () => {
		const first = renderReader();
		await waitFor(() => {
			expect(shownZoom()).toBe(Math.round(READER_CHOICE * 100));
		});

		// The reader picks something else, and the choice has to be filed
		// outside the component — a bare `useRef` dies with the mount and
		// the re-open snaps back to fit-width.
		fireEvent.click(screen.getByTestId('rm-zoom-in'));
		const chosen = shownZoom();
		expect(chosen).toBeGreaterThan(Math.round(READER_CHOICE * 100));

		first.unmount();
		liveResizeObservers.clear();
		renderReader();

		await waitFor(() => {
			expect(shownZoom()).toBe(chosen);
		});
		expect(shownZoom()).not.toBe(FIT_AT_1280);
	});

	it('files nothing when the reader never chose, so the default still applies', async () => {
		// The precedence cuts both ways: a fitted zoom is not a preference.
		// Writing it into the store would freeze today's window size for
		// the rest of the session and turn the default into a forced one.
		useUiStore.setState({ readerZoom: {} });
		renderReader();

		await waitFor(() => {
			expect(shownZoom()).toBe(FIT_AT_1280);
		});
		expect(useUiStore.getState().readerZoom).toEqual({});
	});
});

describe('the store that holds the choice', () => {
	it('files under both halves of the reading-state key', () => {
		// Keyed on the document alone, a re-import of the same book from a
		// different file would inherit a scale chosen against the old
		// page size.
		expect(ZOOM_KEY).not.toBe(readerZoomKey(DOC_ID, asSourceFingerprint('b'.repeat(64))));
		expect(ZOOM_KEY).not.toBe(readerZoomKey(OTHER_DOC_ID, FINGERPRINT));
	});

	it('refuses a scale it cannot render, rather than storing it', () => {
		const set = useUiStore.getState().setReaderZoom;
		set('k', Number.NaN);
		set('k', Number.POSITIVE_INFINITY);
		set('k', Number.NaN);
		expect(useUiStore.getState().readerZoom).toEqual({});

		// A value outside the toolbar's range would be one the reader
		// cannot zoom back out of, so it is clamped on the way in.
		set('k', 99);
		expect(useUiStore.getState().readerZoom['k']).toBe(5);
		set('k', 0.001);
		expect(useUiStore.getState().readerZoom['k']).toBe(0.25);
	});
});
