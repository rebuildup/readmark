/**
 * readmark — the open-document view.
 *
 * Owns the page lifecycle for one open source: which pages have been
 * materialized, what each one's footprint is, and the toolbar's zoom
 * and rotation. Everything it needs arrives through
 * `ReaderHandle<'pdf'>` — it never sees a pdf.js type.
 *
 * The rotation and viewport-size helpers come from the PDF reader
 * rather than from `domain/`, because in the MVP rotation is a
 * runtime PDF transform (ADR-0007: stored rects stay in raw user
 * space and the reader applies the transform at paint time). The
 * format-agnostic seam is `RenderOptions`: a second format gets its
 * own view rather than a conditional in this one.
 *
 * Why one `PdfPageView` per page instead of a single render loop:
 *   - Each page decides for itself when it is near the viewport, so
 *     `getPage` is called only for the pages a reader actually
 *     reaches, never once per page up front.
 *   - A zoom or a rotation re-renders the visible pages and nothing
 *     else; re-rendering a page that has scrolled away would burn
 *     worker time on pixels nobody is looking at.
 *
 * The reserved size for a page nobody has measured yet comes from
 * page 1's own size, rotation included. Reserving from a
 * rotation-unaware constant would make the scroll geometry wrong for
 * the whole document the moment anyone turned a page.
 *
 * #5 owns reading-progress persistence. The current page is tracked
 * here only so the header can display it, and it stays local state
 * rather than something the reader handle holds.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import type { Bookmark, Highlight, PageIndex } from '../domain/reading-state.ts';
import { nextRotation, PDF_PAGE_CLASS, viewportSize } from '../reader/pdf/index.ts';
import { currentPositionFrom, type PageExtent, type ScrollPosition } from '../reader/position.ts';
import type {
	PaintedAnchor,
	ReaderHandle,
	RenderOptions,
	ResolvedAnchor,
} from '../reader/types.ts';
import { addBookmark, deleteBookmark, listBookmarks } from '../storage/bookmarks-repo.ts';
import {
	addHighlight,
	deleteHighlight,
	listHighlights,
	replaceHighlightAnchor,
} from '../storage/highlights-repo.ts';
import { saveReadingPosition } from '../storage/reading-state-repo.ts';
import { readerZoomKey, useUiStore } from '../stores/ui-store.ts';
import { AddBookmarkDialog, BookmarkDeleteDialog, BookmarksPanel } from './bookmarks-panel.tsx';
import { Button } from './primitives/button.tsx';
import { LibraryLink } from './primitives/library-link.tsx';
import { jumpToPage } from './scroll-to-page.ts';
import {
	type SelectionSnapshot,
	SelectionToolbar,
	selectionStillMatches,
	snapshotSelection,
} from './selection-toolbar.tsx';

/**
 * Where the reader is, in the reader's own coordinate space: which page
 * holds the viewport's midpoint, and how far into it they are.
 *
 * Everything in one space — viewport rects. `offsetTop` is relative to
 * the offset parent while `scrollTop` is relative to the scroller's
 * content, and the two differ by the header height: enough to save the
 * reader a page off from where they are.
 *
 * The header label, the saved progress row and the bookmark button all
 * read the position through this one call, so those three can never
 * disagree about where the reader is.
 */
function readPosition(
	scroller: HTMLElement,
): { pageIndex: PageIndex; pageOffsetRatio: number } | null {
	const scrollerBox = scroller.getBoundingClientRect();
	const extents: PageExtent[] = Array.from(
		scroller.querySelectorAll<HTMLElement>('[data-page-index]'),
	).map((host) => {
		const box = host.getBoundingClientRect();
		return {
			pageIndex: Number(host.dataset.pageIndex) as PageIndex,
			top: box.top - scrollerBox.top + scroller.scrollTop,
			height: box.height,
		};
	});
	return currentPositionFrom(extents, scroller.scrollTop, scroller.clientHeight);
}

/**
 * A mark's stored offset, or the top of its page.
 *
 * `position` is a `DocumentPosition` — an opaque record by contract —
 * so the one field this reader understands is read defensively: a mark
 * written by another shape, or by a version that stored nothing, jumps
 * to the start of its page, which is the honest reading of "somewhere
 * on this page".
 */
function storedOffset(position: Bookmark['position']): ScrollPosition {
	const ratio = position?.pageOffsetRatio;
	if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return { pageOffsetRatio: 0 };
	return { pageOffsetRatio: Math.min(1, Math.max(0, ratio)) };
}

/** Zoom stops the toolbar steps through. Discrete rather than
 *  multiplicative so "zoom in" can land back at 100% instead of
 *  drifting to 112% and staying there.
 *
 *  Note that the reader does NOT start on one of these. A book page is
 *  ~515pt wide, so 100% draws it at 515 CSS px and the body text lands
 *  around 10px — technically correct and practically unreadable. The
 *  opening zoom is fit-width (see `fitWidthScale`), and these stops
 *  remain for the explicit +/- steps from there. */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** Horizontal breathing room the scroller leaves around a page.
 *  Must match the `.rm-reader-scroll` / `.rm-reader-pages` padding in
 *  `styles.css`, or a fitted page will overflow by exactly this much
 *  and the user gets a horizontal scrollbar on first open. */
export const FIT_WIDTH_PADDING_PX = 48;

/**
 * The scale at which a page fills the available width.
 *
 * Why this is the opening zoom: 100% means "one PDF point per CSS
 * pixel", which is a printing notion, not a reading one. A 515pt book
 * page at 100% is smaller than the real thing. Every reader worth
 * using opens at fit-width, because "can I read the page" depends on
 * the window, not on the file.
 *
 * Clamped to the same range the +/- buttons respect, so a fit can never
 * land outside what the user can then step away from. The upper clamp
 * matters most: a short page (a slide, a receipt) on a wide monitor
 * would otherwise scale to an unreadable size and allocate a canvas
 * far larger than the display.
 */
export function fitWidthScale(availableWidthPx: number, pageWidthPt: number): number {
	if (!Number.isFinite(availableWidthPx) || !Number.isFinite(pageWidthPt)) return 1;
	if (pageWidthPt <= 0 || availableWidthPx <= 0) return 1;
	const usable = Math.max(120, availableWidthPx - FIT_WIDTH_PADDING_PX);
	const scale = usable / pageWidthPt;
	return clampZoom(scale);
}

/** The zoom range, as one rule.
 *
 *  `clampZoom` and `nextZoom` both have to agree on the ends, or a
 *  fitted page could be one the user cannot zoom out of. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 5;

export function clampZoom(scale: number): number {
	if (!Number.isFinite(scale)) return 1;
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Keys that scroll the document, and so count as the reader taking
 *  over from a restore in progress. */
const READER_SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

/** How far outside the viewport a page may be and still be
 *  materialized. Two screens of slack keeps a fast scroll from
 *  outrunning the render, without paying for the whole file. */
const PREFETCH_MARGIN = '200% 0px';

/** How long the position has to be still before it is written.
 *
 *  A scroll produces one event per frame; writing a row per frame
 *  would put a hundred IndexedDB transactions per second of reading
 *  into a local-first app for no benefit — the position only has to
 *  survive a crash, not every intermediate scroll offset. This is a
 *  *debounce*, not a throttle: the timer is restarted by every new
 *  position, so a continuous scroll writes once when it stops rather
 *  than writing repeatedly while it is still going.
 *
 *  Longest a continuous scroll can go without writing anything, in the
 *  case where the tab is killed outright (no unmount, so no flush).
 *  Without it, a reader who scrolls a long document in one gesture
 *  would lose all of it to a crash. One row every few seconds is
 *  cheap insurance for a local-first app that has no server to
 *  re-derive the position from.
 */
const SAVE_DEBOUNCE_MS = 800;
const SAVE_MAX_WAIT_MS = 5_000;

/** A4 portrait in points, used to reserve space for a page nobody has
 *  measured yet. Only a placeholder: the first page that renders
 *  replaces it for the whole document, and each page corrects its own
 *  size as it materializes. Without a non-zero provisional height the
 *  pages would all stack at the top of the scroller, every one of them
 *  inside the viewport, and the reader would render the whole file at
 *  once while believing it was lazy. */
const PROVISIONAL_PAGE = { width: 595, height: 842 };

interface PageFootprint {
	readonly width: number;
	readonly height: number;
}

/** The colour names this build knows how to paint. A stored row
 *  carries a name; the palette that gives it a colour is the theme's
 *  business, so the only narrowing that happens here is "is this a
 *  name we know", and anything else falls back rather than being drawn
 *  as an arbitrary colour. */
const HIGHLIGHT_COLOR_TOKENS = ['yellow'] as const;
type HighlightColorToken = (typeof HIGHLIGHT_COLOR_TOKENS)[number];
const HIGHLIGHT_COLOR_FALLBACK: HighlightColorToken = 'yellow';

/** A stored colour name to a token this build paints. */
function highlightColorToken(color: string): HighlightColorToken {
	const known: readonly string[] = HIGHLIGHT_COLOR_TOKENS;
	return known.includes(color) ? (color as HighlightColorToken) : HIGHLIGHT_COLOR_FALLBACK;
}

/**
 * One stored highlight and what resolving it produced.
 *
 * The four states are separate types rather than a flag because each
 * one means a different thing to the reader, and collapsing them is how
 * "this reader could not resolve it" turns into "this highlight is
 * gone" — which is a reader losing work they did on purpose.
 */
type HighlightState =
	/** Resolved, and paintable at the page it says it is on. */
	| { readonly kind: 'paintable'; readonly resolved: ResolvedAnchor }
	/** The reader cannot resolve this anchor against *this* source. The
	 *  row stays: that is a fact about the file, not about whether the
	 *  highlight exists. Nothing is deleted and no overlay is drawn. */
	| { readonly kind: 'unresolved' }
	/** The row's page and the resolved page disagree, which is
	 *  detectable without reading the payload and is an integrity
	 *  failure rather than a rendering one. Excluded from painting and
	 *  from the write-back; the row is left exactly as it is stored. */
	| { readonly kind: 'mismatch' }
	/** The write-back reported the row is no longer there — another tab,
	 *  or the reader themselves. Not painted: a stale list snapshot must
	 *  not put a highlight back on screen that the repository knows is
	 *  gone. */
	| { readonly kind: 'vanished' };

/** A highlight the reader has, and where it stands. */
interface HighlightRow {
	readonly row: Highlight;
	readonly state: HighlightState;
}

/** A shared empty list, so a page with no highlights keeps the same
 *  prop identity across re-renders. */
const NO_HIGHLIGHTS: readonly HighlightRow[] = [];

/** The paintable rows per page, in one pass.
 *
 *  Grouped rather than filtered per page view, and memoised by the
 *  caller, because a fresh array per render is a fresh *identity* per
 *  render — and a page view's paint effect depends on its rows. A new
 *  identity re-runs that effect on every commit of the reader, which is
 *  how a paint ended up racing a render.
 */
function highlightsByPage(
	rows: readonly HighlightRow[],
): ReadonlyMap<PageIndex, readonly HighlightRow[]> {
	const byPage = new Map<PageIndex, HighlightRow[]>();
	for (const row of rows) {
		if (row.state.kind !== 'paintable') continue;
		const page = row.state.resolved.page;
		const existing = byPage.get(page);
		if (existing === undefined) byPage.set(page, [row]);
		else existing.push(row);
	}
	return byPage;
}

interface PdfPageViewProps {
	readonly handle: ReaderHandle<'pdf'>;
	readonly index: PageIndex;
	readonly options: RenderOptions;
	/** Reserved size until this page has been rendered for real. */
	readonly reserved: PageFootprint;
	/** The paintable highlights for this page. Empty for a page nobody
	 *  highlighted; the render effect does not care either way. */
	readonly highlights: readonly HighlightRow[];
	readonly onMeasured: (index: PageIndex, footprint: PageFootprint) => void;
	/** Reports a page's intrinsic size in PDF points (zoom-independent).
	 *  Called for every measurement; the reader keeps the first. */
	readonly onIntrinsicSize?: (size: { widthPt: number; heightPt: number }) => void;
	readonly onError: (error: unknown) => void;
}

/** What this view has painted for one row, and what it would take to
 *  leave it alone. */
interface PaintEntry {
	readonly resolved: ResolvedAnchor;
	/** The render the overlay was positioned against. A different one
	 *  means the canvas underneath is different, so the overlay is too. */
	readonly epoch: number;
	readonly token: HighlightColorToken;
	readonly painted: PaintedAnchor;
}

function PdfPageView({
	handle,
	index,
	options,
	reserved,
	highlights,
	onMeasured,
	onIntrinsicSize,
	onError,
}: PdfPageViewProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	// Latched: once a page is materialized it stays rendered, so
	// scrolling back up re-attaches existing pixels. Page 1 starts
	// materialized because a reader always shows it, and because its
	// size is what reserves space for the rest.
	const [materialized, setMaterialized] = useState(index === 1);

	useEffect(() => {
		const host = hostRef.current;
		if (host === null || materialized) return;
		if (typeof IntersectionObserver === 'undefined') {
			// No observer available: render rather than show a page
			// that never fills in.
			setMaterialized(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setMaterialized(true);
					observer.disconnect();
				}
			},
			{ rootMargin: PREFETCH_MARGIN },
		);
		observer.observe(host);
		return () => observer.disconnect();
	}, [materialized]);

	// Bumped by every render that completed, and the only thing the paint
	// effect watches for "the canvas underneath has changed". A highlight
	// appearing, changing or being deleted does not bump it: those are
	// reasons to reconcile overlays, never to redraw a page.
	const [renderEpoch, setRenderEpoch] = useState(0);
	// Whether a render is in flight, set synchronously when the effect
	// below starts and cleared when it settles.
	//
	// This is the gate that keeps paint and render in order. A zoom
	// changes `options`, and in one React commit both effects re-run: the
	// render effect starts a render — which drops the page handle's
	// remembered transform immediately, since the target is about to be
	// rebuilt — and the paint effect would then ask that same handle to
	// paint against a transform it no longer has. It answered that with a
	// programming error, so an ordinary zoom could raise a render alert.
	//
	// A ref rather than state because it has to be true *before* the paint
	// effect runs, and re-running the paint effect is not the answer: the
	// completed render bumps the epoch, which brings it back for a repaint.
	const renderingRef = useRef(false);

	useEffect(() => {
		if (!materialized) return;
		const host = hostRef.current;
		if (host === null) return;
		// Re-entrancy is the page handle's job (task cancel + generation
		// counter); `cancelled` only stops this component from reading
		// the DOM of a page it no longer owns.
		let cancelled = false;
		// Before the async body, so the gate is closed by the time the
		// paint effect below runs in this same commit.
		renderingRef.current = true;
		void (async () => {
			try {
				const page = await handle.page(index);
				await page.render(host, options);
				if (cancelled) return;
				const rendered = host.querySelector<HTMLElement>(`.${PDF_PAGE_CLASS}`);
				if (rendered === null) return;
				// The footprint is in CSS px, so it is zoom-dependent and
				// cannot be compared against a viewport width. The
				// intrinsic width in points is what fit-width needs, and
				// dividing by the scale we just rendered at recovers it.
				// Captured once, on the first report: later reports are
				// the same page at a different zoom, and taking the
				// latest would feed the fit its own output.
				if (onIntrinsicSize !== undefined) {
					const scale = options.scale !== undefined && options.scale > 0 ? options.scale : 1;
					const w = rendered.offsetWidth || Number.parseFloat(rendered.style.width) || 0;
					const h = rendered.offsetHeight || Number.parseFloat(rendered.style.height) || 0;
					onIntrinsicSize({ widthPt: w / scale, heightPt: h / scale });
				}
				onMeasured(index, {
					// `getBoundingClientRect` is the post-layout size; the
					// chain `offsetWidth || parseFloat(style.width) || 0`
					// reads from a not-yet-laid-out host and silently
					// hands the view a zero, which is what makes a
					// restored position fall through to "page 1".
					width: rendered.getBoundingClientRect().width,
					height: rendered.getBoundingClientRect().height,
				});
				setRenderEpoch((previous) => previous + 1);
			} catch (error: unknown) {
				if (!cancelled) onError(error);
			} finally {
				// Opened again by the completed render's epoch bump, which
				// is what brings the paint effect back for a repaint.
				if (!cancelled) renderingRef.current = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [handle, index, materialized, onError, onMeasured, onIntrinsicSize, options]);

	// What has been painted, and this view's ownership of it. A ref, not
	// state: reconciliation is a side effect on the DOM, and putting the
	// map in state would redraw the page on every reconcile.
	const paintedRef = useRef(new Map<string, PaintEntry>());
	// Painting is async, so a run can be superseded mid-flight by a zoom,
	// a delete, or an unmount. The generation guard is what keeps a stale
	// run from committing handles it made after losing its turn.
	const paintRunRef = useRef(0);

	useEffect(() => {
		if (!materialized || renderEpoch === 0) return;
		// A render in flight means the target is being rebuilt and the
		// page handle has no transform to convert through. The completed
		// render bumps the epoch, which re-runs this effect; skipping here
		// is what keeps an ordinary zoom from asking a page to paint
		// against a canvas that does not exist yet.
		if (renderingRef.current) return;
		const host = hostRef.current;
		if (host === null) return;
		const painted = paintedRef.current;
		const run = ++paintRunRef.current;

		void (async () => {
			const page = await handle.page(index);
			if (run !== paintRunRef.current) return;
			for (const row of highlights) {
				if (row.state.kind !== 'paintable') continue;
				const resolved = row.state.resolved;
				const token = highlightColorToken(row.row.color);
				const existing = painted.get(row.row.id);
				// Nothing to do: the same resolved anchor against the same
				// render is the same overlay. Repainting it would stack a
				// second translucent fill over the first, which reads as a
				// darker highlight rather than as work.
				if (
					existing !== undefined &&
					existing.resolved === resolved &&
					existing.epoch === renderEpoch &&
					existing.token === token
				) {
					continue;
				}
				const result = await page.paintResolvedAnchor(resolved, host);
				if (run !== paintRunRef.current) {
					// Superseded while this row was being painted. The
					// overlay exists in the DOM, so it has to go — leaving
					// it would be a highlight nobody owns.
					result?.remove();
					return;
				}
				if (result === null) {
					// The reader could not paint this one. Take down
					// anything we drew for it earlier rather than leaving
					// a stale overlay beside the truth.
					existing?.painted.remove();
					painted.delete(row.row.id);
					continue;
				}
				// The colour goes on this overlay and not on the page
				// host, so two highlights on one page can differ.
				result.element.dataset.highlightColor = token;
				existing?.painted.remove();
				painted.set(row.row.id, { resolved, epoch: renderEpoch, token, painted: result });
			}
			// Whatever is left is a row that disappeared. The handle makes
			// this safe even if a re-render already detached the element.
			for (const [id, entry] of painted) {
				if (highlights.some((row) => row.row.id === id)) continue;
				entry.painted.remove();
				painted.delete(id);
			}
		})().catch((error: unknown) => {
			if (run === paintRunRef.current) onError(error);
		});
	}, [handle, highlights, index, materialized, onError, renderEpoch]);

	// Every overlay this view made goes away with it.
	useEffect(
		() => () => {
			paintRunRef.current++;
			for (const entry of paintedRef.current.values()) entry.painted.remove();
			paintedRef.current.clear();
		},
		[],
	);

	return (
		<div
			className="rm-page-host"
			ref={hostRef}
			data-page-index={index}
			style={{ width: `${reserved.width}px`, height: `${reserved.height}px` }}
		/>
	);
}

export interface ReaderViewProps {
	readonly handle: ReaderHandle<'pdf'>;
	readonly pageCount: number;
	readonly title: string;
	/** Both keys of the progress row. Reading state is keyed by the
	 *  pair, not by the document (ADR-0002). */
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
	/** Where this reader was last time, if anywhere. Restored once the
	 *  page's box is measured; `null` for a first read. */
	readonly initialPosition: {
		readonly currentPage: PageIndex;
		readonly position: ScrollPosition;
	} | null;
}

export function ReaderView({
	handle,
	pageCount,
	title,
	documentId,
	sourceFingerprint,
	initialPosition,
}: ReaderViewProps) {
	// Where this reader's own zoom is filed, and whether one is already
	// there from earlier in this session.
	//
	// The precedence is the whole of issue #35: a scale the reader picked
	// is THEIRS and opens the document at that value; with nothing filed,
	// the document opens fit-width. "Default" has to mean default — a
	// fresh profile fits the page, and a choice made before this mount
	// is never silently overwritten by the fit.
	const zoomKey = readerZoomKey(documentId, sourceFingerprint);
	const storedZoom = useUiStore((state) => state.readerZoom[zoomKey]);
	const setReaderZoom = useUiStore((state) => state.setReaderZoom);

	// `null` means "not chosen yet" and lets the fit-width effect below
	// pick the opening zoom once a page and a viewport both exist. A
	// number means the reader (or a restored preference) has taken over.
	//
	// Seeded from the store so the very first frame already shows the
	// reader's own scale. Reading it in an effect instead would show
	// 100% for a tick and then jump — a restored 150% would briefly be
	// reported as 100%, which is the exact "too small to read" state
	// this change exists to remove.
	const [zoom, setZoom] = useState<number | null>(storedZoom ?? null);
	const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
	const [footprints, setFootprints] = useState<ReadonlyMap<PageIndex, PageFootprint>>(
		() => new Map(),
	);
	const [renderError, setRenderError] = useState<string | null>(null);
	// A user-visible error from a selection action (highlight or bookmark).
	// Render errors have their own surface because they describe a different
	// failure: a page that would not draw, not a write that did not stick.
	const [actionError, setActionError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState<PageIndex | null>(null);
	const [bookmarks, setBookmarks] = useState<readonly Bookmark[]>([]);
	const [highlights, setHighlights] = useState<readonly HighlightRow[]>([]);
	// The selection the toolbar is acting on, as it was when the
	// toolbar appeared. Not re-read on click — see the module header for
	// why a click can change the DOM Selection out from under it.
	const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
	const [pendingAdd, setPendingAdd] = useState<{
		readonly pageIndex: PageIndex;
		readonly pageOffsetRatio: number;
	} | null>(null);
	const [pendingDelete, setPendingDelete] = useState<Bookmark | null>(null);
	/** Inline error for the add-bookmark dialog. Cleared on each
	 *  fresh open of the dialog so a previous failure does not
	 *  reappear over a new attempt. */
	const [bookmarkError, setBookmarkError] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	// The sticky header, so the selection toolbar knows the one thing it
	// can land underneath.
	const headerRef = useRef<HTMLElement | null>(null);
	// In-flight tracking for the highlight action. A ref, not state, because
	// a re-render between the two clicks would be wasteful and the second
	// click is racing the first whether it does or not.
	const highlightInFlight = useRef(false);
	const sidePanel = useUiStore((state) => state.sidePanel);
	const setSidePanel = useUiStore((state) => state.setSidePanel);

	// Progress bookkeeping, all in refs: none of it drives a render,
	// and putting a pending write in state would re-render the reader
	// on every scroll.
	//
	// `restoredRef` is the gate that matters. Until the stored position
	// has been applied (or found to be inapplicable), the scroll
	// handler must not save: an unmeasured layout reports a position
	// of "page 1, offset 0", and writing that would destroy the very
	// position being restored.
	const restoredRef = useRef(initialPosition === null);
	const pendingRef = useRef<{ pageIndex: PageIndex; position: ScrollPosition } | null>(null);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// When the last write happened, for the max-wait escape hatch.
	// Seeded with the mount time, not zero: a reader's first position
	// is a normal debounced write, not an overdue one.
	const lastWriteAtRef = useRef<number>(Date.now());
	// The position recomputation, so the restore can ask for it
	// directly: setting `scrollTop` is not guaranteed to raise a scroll
	// event (and does not in every test environment), and the header
	// label has to agree with where the reader actually is.
	const updatePositionRef = useRef<(() => void) | null>(null);
	// How many times the reader has taken over from the app: once per
	// wheel, touch, drag or scroll key, and once per jump the reader
	// asks for. A *count*, not a flag, and that is the whole point: an
	// app-initiated scroll captures the number when it starts and gives
	// up when it changes, so retiring one jump retires that jump only.
	// A flag would latch for the rest of the session, and a reader who
	// scrolled once could never use a bookmark again — every jump would
	// see the flag still set and abort before it moved anything.
	const takeoverCountRef = useRef(0);
	/**
	 * Bump the takeover counter and return its new value.
	 *
	 * One place for the `+= 1` rule: a reader-initiated scroll (`wheel`,
	 * `touchstart`, `pointerdown`, scroll-key) and a bookmark jump both
	 * ask the view to retire whatever async was in flight, and the only
	 * way to keep both honest is to go through here. The restore path
	 * reads the counter — it does not write to it — so it does not
	 * call this.
	 */
	const registerTakeover = useCallback((): number => {
		takeoverCountRef.current += 1;
		return takeoverCountRef.current;
	}, []);
	// Read by the jump through a callback, so the effect that starts it
	// does not have to be re-created on every measurement.
	const footprintsRef = useRef(footprints);
	footprintsRef.current = footprints;
	/** Write the pending position now, if there is one. */
	const flushSave = useCallback(() => {
		if (saveTimerRef.current !== null) {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
		}
		const pending = pendingRef.current;
		if (pending === null) return;
		pendingRef.current = null;
		lastWriteAtRef.current = Date.now();
		void saveReadingPosition({
			documentId,
			sourceFingerprint,
			currentPage: pending.pageIndex,
			position: pending.position,
		}).catch((error: unknown) => {
			// A failed progress write is not worth interrupting a read
			// over: the position is advisory, and the next one will
			// overwrite it.
			console.error('readmark: could not save reading position', error);
		});
	}, [documentId, sourceFingerprint]);

	const scheduleSave = useCallback(
		(pageIndex: PageIndex, position: ScrollPosition) => {
			pendingRef.current = { pageIndex, position };
			// A debounce restarts on every new position. Returning early
			// when a timer is already running would be a throttle: the
			// write would land mid-scroll, at 800ms, with the reader
			// still moving — which is exactly what the acceptance
			// criterion for #5 says must not happen.
			if (saveTimerRef.current !== null) {
				clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
			}
			const waiting = Date.now() - lastWriteAtRef.current;
			if (waiting >= SAVE_MAX_WAIT_MS) {
				flushSave();
				return;
			}
			saveTimerRef.current = setTimeout(() => {
				saveTimerRef.current = null;
				flushSave();
			}, SAVE_DEBOUNCE_MS);
		},
		[flushSave],
	);

	const [intrinsicSizePt, setIntrinsicSizePt] = useState<{
		readonly widthPt: number;
		readonly heightPt: number;
	} | null>(null);
	const handleIntrinsicSize = useCallback((size: { widthPt: number; heightPt: number }) => {
		setIntrinsicSizePt((previous) => {
			if (previous !== null || size.widthPt <= 0 || size.heightPt <= 0) return previous;
			return size;
		});
	}, []);

	// The effective scale every render and every reserved box uses. Until
	// the fit has been computed this is 1, which is only ever visible for
	// the single frame before the first measurement lands.
	const effectiveZoom = zoom ?? 1;

	// One object for the whole document, so a zoom change re-renders
	// every visible page against the same viewport and each page's
	// effect sees a stable `options` identity.
	const options = useMemo<RenderOptions>(
		() => ({ scale: effectiveZoom, rotation }),
		[effectiveZoom, rotation],
	);

	const pages = useMemo(
		() => Array.from({ length: pageCount }, (_, index) => (index + 1) as PageIndex),
		[pageCount],
	);

	// The box reserved for a page that has not rendered yet.
	//
	// This starts as a fixed A4 guess and switches to the first
	// MEASURED page's own size. That switch is not cosmetic: a page's
	// offset within the scroller is the sum of every box above it, so
	// while unrendered pages hold a wrong box, every measured page below
	// them sits at a wrong offset — and reading-progress restore and
	// bookmark jumps both compute positions that way.
	//
	// With the A4 guess on a 420x896pt document the reserved box is ~57%
	// too tall, and the error compounds: restoring to page 7 of 12 landed
	// on page 4. A real book's pages are near-uniform, so measuring one
	// collapses the error to the document's own variation. A genuinely
	// mixed-size document keeps some error, which is why the jump also
	// re-applies until the target stops moving.
	const reservedPage = useMemo(
		() => intrinsicSizePt ?? { widthPt: PROVISIONAL_PAGE.width, heightPt: PROVISIONAL_PAGE.height },
		[intrinsicSizePt],
	);

	// Rotation-aware, so a turned page reserves a landscape slot from
	// the start rather than jumping when it is measured.
	const provisional = useMemo(
		() => viewportSize(reservedPage.widthPt, reservedPage.heightPt, effectiveZoom, rotation),
		[effectiveZoom, reservedPage, rotation],
	);

	// The first page's width in PDF points, once a page has rendered.
	// A book is 515pt and A4 is 595pt, so the provisional guess is off by
	// enough to leave the opening page visibly short of the margin.
	//
	// This is deliberately NOT the footprint: that is measured in CSS px at
	// whatever zoom happened to be applied, so using it here would feed
	// the fit its own output and settle at a smaller scale each pass.

	// Opening zoom: fit the page to the width actually available.
	//
	// Two facts are needed and neither exists on the first render — the
	// scroller's width and the page's own dimensions — so this cannot be
	// derived during render. It is also not compute-once: a window resize
	// has to re-fit, which is what the observer is for.
	//
	// Why the reader's own zoom sticks: once they press +/-, the number is
	// theirs, and re-fitting on every resize would throw that away.
	// `userZoomedRef` is the whole of that state — a ref, not a second
	// `useState`, so it cannot trigger a render or drift from `zoom`.
	//
	// Seeded from the store, so a choice made BEFORE this mount — the
	// reader left the document and came back — already counts as theirs
	// and the fit never gets a chance to overwrite it. That seed is the
	// only thing that has to be right: the only other writer of the store
	// is `changeOptions` below, which sets this ref synchronously, so no
	// effect is needed to keep the two in step.
	const userZoomedRef = useRef(storedZoom !== undefined);

	useEffect(() => {
		const scroller = scrollRef.current;
		if (scroller === null) return;

		// A rotation swaps the page's width and height, so a turned page is
		// fitted on its now-horizontal dimension.
		const rotated = rotation === 90 || rotation === 270;
		const pageWidth =
			intrinsicSizePt !== null
				? rotated
					? // A turned page is fitted on its now-horizontal
						// dimension, which is the page's height in points.
						intrinsicSizePt.heightPt
					: intrinsicSizePt.widthPt
				: rotated
					? PROVISIONAL_PAGE.height
					: PROVISIONAL_PAGE.width;

		const apply = () => {
			if (userZoomedRef.current) return;
			const available = scroller.clientWidth;
			if (available <= 0) return;
			const next = fitWidthScale(available, pageWidth);
			setZoom((previous) => (previous === next ? previous : next));
		};

		apply();
		const observer = new ResizeObserver(apply);
		observer.observe(scroller);
		return () => observer.disconnect();
	}, [intrinsicSizePt, rotation]);

	const handleMeasured = useCallback((index: PageIndex, footprint: PageFootprint) => {
		setFootprints((previous) => {
			const existing = previous.get(index);
			// Both dimensions: a rotation turns the old width into the
			// new height, and comparing width alone would keep a
			// reservation that no longer matches the rendered page.
			if (
				existing !== undefined &&
				existing.width === footprint.width &&
				existing.height === footprint.height
			) {
				return previous;
			}
			const next = new Map(previous);
			next.set(index, footprint);
			return next;
		});
	}, []);

	const handleError = useCallback((error: unknown) => {
		console.error('readmark: page render failed', error);
		// The first render failure is the one the reader sees on screen
		// — they have to be told that *one* page failed. A second failure
		// overwrites the first only by chance (it might be the same
		// page, or it might be a different one), so keep the first and
		// log the rest. The reader gets to keep the page they were on
		// and the developer gets a stack trace per failure.
		setRenderError((previous) =>
			previous ? previous : 'このページの描画に失敗しました。時間をおいて再度お試しください。',
		);
	}, []);

	// The reader's position, on every scroll frame that is not already
	// waiting for one. `currentPositionFrom` decides which page holds
	// the viewport's midpoint and how far into it the reader is; the
	// same call feeds the header label and the saved row, so the label
	// and the stored position can never disagree.
	useEffect(() => {
		const scroller = scrollRef.current;
		if (scroller === null) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			const position = readPosition(scroller);
			if (position === null) return;
			// Only update the header label after the restore has
			// settled: the restore's own `.then` calls `update()` with
			// the post-restore position, and labelling the reader as
			// "on page 1" while the scroll-to-page is still in flight
			// would be a flicker from 1 → restored page.
			if (!restoredRef.current) return;
			setCurrentPage((previous) =>
				previous === position.pageIndex ? previous : position.pageIndex,
			);
			scheduleSave(position.pageIndex, { pageOffsetRatio: position.pageOffsetRatio });
		};
		const onScroll = () => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(update);
		};
		// Wheel, touch and keys are the reader's own hands. A
		// programmatic scroll raises `scroll` but none of these, so the
		// two are not confused.
		const markReaderMoved = () => {
			registerTakeover();
			// The restore is over — the reader has taken over. Leaving
			// the gate closed here would be worse than losing one write:
			// the effect that closes it only runs when the page
			// measurements change, so a scroll that materializes nothing
			// would suppress every save for the rest of the session and
			// the position they just chose would never be recorded.
			if (!restoredRef.current) restoredRef.current = true;
		};
		for (const event of ['wheel', 'touchstart', 'pointerdown'] as const) {
			scroller.addEventListener(event, markReaderMoved, { passive: true });
		}
		scroller.addEventListener('scroll', onScroll, { passive: true });
		updatePositionRef.current = update;
		update();
		// Keys are watched on the document, not the scroller: the
		// scroller is a plain div and is not focusable, so PageDown and
		// the arrow keys are delivered to whatever else has focus — or
		// to nothing at all. A listener on the scroller would have
		// caught none of the scrolling a reader does with the keyboard.
		// The filter matters for the same reason: Tab and a bare
		// keystroke are not movement, and a keystroke aimed at a
		// control belongs to that control.
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (target instanceof HTMLElement) {
				// A keystroke aimed at a control belongs to that
				// control. The role-based selectors catch custom widgets
				// (`<div role="button">`) that the tag list would miss.
				const control = target.closest(
					'input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="menuitem"], [role="tab"]',
				);
				if (control !== null) return;
			}
			if (!READER_SCROLL_KEYS.has(event.key) && event.key !== ' ') return;
			markReaderMoved();
		};
		document.addEventListener('keydown', onKeyDown);

		return () => {
			updatePositionRef.current = null;
			for (const event of ['wheel', 'touchstart', 'pointerdown'] as const) {
				scroller.removeEventListener(event, markReaderMoved);
			}
			document.removeEventListener('keydown', onKeyDown);
			scroller.removeEventListener('scroll', onScroll);
			if (frame !== 0) cancelAnimationFrame(frame);
		};
		// Mount-only: the listener reads the page hosts from the DOM at
		// scroll time, and the page count is fixed for as long as this
		// view is mounted. `scheduleSave` is stable.
	}, [registerTakeover, scheduleSave]);

	// Restore the reader's last position. The two-phase scroll lives in
	// `scroll-to-page.ts` because a bookmark jump needs exactly the
	// same thing, and two copies of this geometry is how one of them
	// rots.
	//
	// Saving stays suspended until the restore resolves, because an
	// unmeasured layout reports "page 1, offset 0" — the value that
	// would destroy the position being restored. It is released by the
	// reader's own input too (see `markReaderMoved`), so a reader who
	// starts scrolling is never fighting the app and never goes
	// unsaved.
	useEffect(() => {
		if (restoredRef.current) return;
		if (initialPosition === null) {
			restoredRef.current = true;
			return;
		}
		const scroller = scrollRef.current;
		if (scroller === null) return;

		let cancelled = false;
		// What the reader had taken over by the time this restore began.
		// Any later takeover — their own scroll, or a jump they asked
		// for — retires this one, and the `.then` below still opens the
		// save gate.
		const takeover = takeoverCountRef.current;
		void jumpToPage({
			scroller,
			pageIndex: initialPosition.currentPage,
			position: initialPosition.position,
			pageCount,
			measuredHeight: (pageIndex) => footprintsRef.current.get(pageIndex)?.height,
			shouldAbort: () => cancelled || takeoverCountRef.current !== takeover,
		}).then((outcome) => {
			if (cancelled) return;
			// Whatever the outcome — applied, coarse, out of range, or
			// abandoned — the reader is at the top of a real page, so
			// recording from here on is correct. Leaving the gate closed
			// on the paths that do not resolve would mean the whole
			// session goes unrecorded.
			restoredRef.current = true;
			if (outcome === 'out-of-range') return;
			// Recompute rather than waiting for a scroll event: the
			// header label has to show the page the reader was restored
			// to, and a programmatic `scrollTop` assignment does not
			// reliably raise one.
			updatePositionRef.current?.();
		});

		return () => {
			cancelled = true;
		};
		// Re-runs as pages report their sizes, which is what the
		// restore waits for; biome cannot see the dependency through
		// the callback.
		// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the measured sizes, which is the condition the restore waits for
	}, [footprints, initialPosition, pageCount]);

	// Grouped once per resolution, not once per render, so each page view
	// gets a stable prop identity.
	const byPage = useMemo(() => highlightsByPage(highlights), [highlights]);

	/**
	 * Resolve one stored row into a state, applying the write-back rule.
	 *
	 *  Shared by the open path and by an add, so a highlight made a
	 *  moment ago goes through exactly the same gates as one that was
	 *  already on disk: a `null` resolution is kept and unpainted, a page
	 *  disagreement paints and writes nothing, and a write-back that says
	 *  the row is gone is not painted.
	 */
	const resolveRow = useCallback(
		async (row: Highlight): Promise<HighlightRow> => {
			const resolved = await handle.resolveAnchor(row.anchor).catch((error: unknown) => {
				console.error('readmark: could not resolve a highlight anchor', error);
				return null;
			});
			if (resolved === null) return { row, state: { kind: 'unresolved' } };
			if (resolved.page !== row.pageIndex) {
				console.error('readmark: highlight page mismatch', {
					id: row.id,
					storedPage: row.pageIndex,
					resolvedPage: resolved.page,
				});
				return { row, state: { kind: 'mismatch' } };
			}
			if (resolved.updatedAnchor !== null) {
				if (!(await replaceHighlightAnchor(row.id, resolved.updatedAnchor))) {
					// The repository knows the row is gone — another tab, or
					// the reader themselves. Painting it would resurrect a
					// deleted highlight from a list that is already stale.
					return { row, state: { kind: 'vanished' } };
				}
			}
			return { row, state: { kind: 'paintable', resolved } };
		},
		[handle],
	);

	// Highlight resolution is a *source* lifecycle, not a render one.
	//
	// Recovery answers "is this anchor still where it was in this file",
	// and the file does not change when the reader zooms. Re-running it
	// on every render would mean a quote search and a re-measurement per
	// page per zoom step, for an answer that cannot have changed. So it
	// runs once per open — keyed on the handle and the two identity keys —
	// and painting, which *is* per viewport, is a separate effect in the
	// page view.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			let stored: readonly Highlight[];
			try {
				stored = await listHighlights({ documentId, sourceFingerprint });
			} catch (error: unknown) {
				if (!cancelled) console.error('readmark: could not read highlights', error);
				return;
			}
			if (cancelled) return;

			// Each row's resolution is independent: `resolveAnchor`
			// does not mutate shared state, and the write-back is keyed
			// on the row's own id. Resolving serially meant a 100-row
			// document with a slow quote search on each one would
			// gate every paint on every other row; in parallel, the
			// wait is the slowest single row, not the sum.
			//
			// `Promise.all` preserves index order, so the assembled
			// rows are in the same order as `stored` without a separate
			// sort.
			const rows = await Promise.all(
				stored.map(async (row): Promise<HighlightRow> => {
					// A malformed or unresolvable anchor resolves to
					// null. The row is kept and simply not painted: this
					// reader cannot resolve it against this source,
					// which says nothing about whether the highlight
					// exists, and deleting it would throw away a
					// reader's work over a file they may not have the
					// whole of.
					const resolved = await handle.resolveAnchor(row.anchor).catch((error: unknown) => {
						console.error('readmark: could not resolve a highlight anchor', error);
						return null;
					});
					if (resolved === null) return { row, state: { kind: 'unresolved' } };
					// Both are generic fields, so this is detectable
					// without reading the payload. Disagreement means
					// the row and the resolution are about different
					// places, which is an integrity failure: nothing
					// is painted, nothing is written, and the stored
					// row is left as it is.
					if (resolved.page !== row.pageIndex) {
						console.error('readmark: highlight page mismatch', {
							id: row.id,
							storedPage: row.pageIndex,
							resolvedPage: resolved.page,
						});
						return { row, state: { kind: 'mismatch' } };
					}
					if (resolved.updatedAnchor !== null) {
						const wasStored = await replaceHighlightAnchor(row.id, resolved.updatedAnchor);
						// The write-back is the only persistence this
						// flow causes, and its boolean is why it is
						// safe: false means the repository knows the
						// row is gone — another tab, or the reader
						// themselves. Painting it anyway would
						// resurrect a deleted highlight on screen from
						// a list that is already out of date.
						if (!wasStored) return { row, state: { kind: 'vanished' } };
					}
					return { row, state: { kind: 'paintable', resolved } };
				}),
			);
			if (cancelled) return;
			setHighlights(rows);
		})();
		return () => {
			cancelled = true;
		};
	}, [documentId, resolveRow, sourceFingerprint]);

	// Selection observation. `mouseup` is what ends a drag, and
	// `selectionchange` is what dismisses the toolbar afterwards — it
	// fires when the selection collapses, moves, or lands on another
	// page, which is every ordinary click-away. There is deliberately no
	// `pointerdown` dismissal: it would fire on the *start* of a drag and
	// close the toolbar while the reader is making the selection.
	useEffect(() => {
		const scroller = scrollRef.current;
		if (scroller === null) return;

		const onMouseUp = () => {
			setSelection(snapshotSelection(window.getSelection()));
		};
		const onSelectionChange = () => {
			setSelection((previous) => {
				if (previous === null) return null;
				return selectionStillMatches(previous, window.getSelection()) ? previous : null;
			});
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			const target = event.target;
			if (target instanceof HTMLElement) {
				const control = target.closest('input, textarea, select, [contenteditable]');
				if (control !== null) return;
			}
			setSelection(null);
		};

		scroller.addEventListener('mouseup', onMouseUp, { passive: true });
		document.addEventListener('selectionchange', onSelectionChange);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			scroller.removeEventListener('mouseup', onMouseUp);
			document.removeEventListener('selectionchange', onSelectionChange);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, []);

	/** Where the sticky header ends, in viewport coordinates. Read at
	 *  measure time rather than memoised: it moves with a scroll, and a
	 *  stale value is a toolbar tucked under a header that has gone. */
	const headerBottom = useCallback(
		() => headerRef.current?.getBoundingClientRect().bottom ?? 0,
		[],
	);

	// The bookmark list is read once per open and reconciled locally
	// after every add or delete, so opening the panel is instant and a
	// second tab's changes are picked up the next time the document is
	// opened. A live cross-tab sync is out of scope.
	useEffect(() => {
		let cancelled = false;
		void listBookmarks({ documentId, sourceFingerprint })
			.then((rows) => {
				if (!cancelled) setBookmarks(rows);
			})
			.catch((error: unknown) => {
				// A failed read leaves the panel empty rather than
				// blocking the reader; the marks are still there.
				console.error('readmark: could not read bookmarks', error);
			});
		return () => {
			cancelled = true;
		};
	}, [documentId, sourceFingerprint]);

	/**
	 * The highlight the reader's current selection already has, if any.
	 *
	 *  Matched on `selectedText`, which is a generic field — comparing
	 *  the words they just selected against the text each stored row
	 *  remembers is a question the UI may answer, while comparing quotes
	 *  would mean reading a payload. The flip side is that it is a text
	 *  match and not an identity: two marks of the same words are
	 *  interchangeable, and the first one found is offered for removal.
	 *  For the MVP, marking the same words twice is not something a
	 *  reader does on purpose.
	 */
	const selectionHighlight = useCallback(
		(snapshot: SelectionSnapshot): Highlight | null => {
			const text = snapshot.selection.range.toString();
			if (text === '') return null;
			return highlights.find((row) => row.row.selectedText === text)?.row ?? null;
		},
		[highlights],
	);

	/** Mark the words the reader selected — or take off a mark already
	 *  on them.
	 *
	 *  The double-click guard is a ref, not state, because a re-render
	 *  between the two clicks is not the same race as the second click
	 *  racing the first: the second click always races the first, and a
	 *  guard that disappears between them is a guard that does not fire.
	 *  Errors fall through to a user-visible banner — silently dropped
	 *  writes are how a reader ends up with a mark that was never
	 *  stored.
	 */
	const handleHighlightSelection = useCallback(
		async (snapshot: SelectionSnapshot) => {
			if (highlightInFlight.current) return;
			highlightInFlight.current = true;
			setActionError(null);
			try {
				const existing = selectionHighlight(snapshot);
				if (existing !== null) {
					if (await deleteHighlight(existing.id)) {
						setHighlights((previous) => previous.filter((row) => row.row.id !== existing.id));
					}
					return;
				}
				const page = await handle.page(snapshot.page);
				// The anchor and its text come from one call, so the stored
				// mirror cannot disagree with the quote it came from.
				const created = await page.createAnchorFromSelection(snapshot.selection);
				if (created === null) return;
				const highlight = await addHighlight({
					documentId,
					sourceFingerprint,
					pageIndex: snapshot.page,
					anchor: created.anchor,
					selectedText: created.selectedText,
				});
				// Painted now rather than on the next open, through the same
				// gates as a row that was already stored. If this throws,
				// the row is on disk but no overlay goes up: a second pass
				// from the effect will paint it on the next render. The
				// banner is for the writer failure above, not for the
				// resolution failure.
				const resolvedRow = await resolveRow(highlight);
				setHighlights((previous) => [...previous, resolvedRow]);
			} catch (error: unknown) {
				console.error('readmark: could not save the selection highlight', error);
				setActionError('ハイライトを保存できませんでした。もう一度お試しください。');
			} finally {
				highlightInFlight.current = false;
			}
		},
		[documentId, handle, resolveRow, selectionHighlight, sourceFingerprint],
	);

	/** Pin the words the reader selected, as a bookmark with an anchor. */
	const handleBookmarkSelection = useCallback(
		async (snapshot: SelectionSnapshot) => {
			setActionError(null);
			try {
				const page = await handle.page(snapshot.page);
				const created = await page.createAnchorFromSelection(snapshot.selection);
				if (created === null) return;
				// A different row from a page pin, and deliberately not on the
				// header's button: the header is "back to this page", this is
				// "back to these words". Two overlapping ways to mark a page is
				// a choice the reader makes for no gain.
				const added = await addBookmark({
					documentId,
					sourceFingerprint,
					pageIndex: snapshot.page,
					anchor: created.anchor,
					position: null,
				});
				// The panel is opened on the next line and renders
				// `bookmarks`, so without this the reader is shown a list
				// that is missing the mark they just made. It stays
				// missing until the document is reopened: the list is read
				// once per open and reconciled locally after every add
				// (see the effect above), so this is not a cache that
				// refills itself. Same shape as `handleConfirmAdd` below.
				setBookmarks((previous) => [...previous, added]);
				setSidePanel('bookmarks');
			} catch (error: unknown) {
				console.error('readmark: could not save the selection bookmark', error);
				setActionError('栞を保存できませんでした。もう一度お試しください。');
			}
		},
		[documentId, handle, setSidePanel, sourceFingerprint],
	);

	/**
	 * Open the add dialog for the page the reader is on.
	 *
	 * The position is read here, at the moment of the press, and the
	 * dialog is modal, so the background cannot move while it is open:
	 * the mark points at where the reader was when they asked for it.
	 * The value is the one the progress row stores, computed the same
	 * way, so jumping back to the mark lands where they actually were.
	 */
	const handleRequestAdd = useCallback(() => {
		const scroller = scrollRef.current;
		if (scroller === null) return;
		const position = readPosition(scroller);
		if (position === null) return;
		setBookmarkError(null);
		setPendingAdd(position);
	}, []);

	/** Write the mark the dialog was opened for. */
	const handleConfirmAdd = useCallback(
		async (title: string) => {
			const target = pendingAdd;
			if (target === null) return;
			try {
				const added = await addBookmark({
					documentId,
					sourceFingerprint,
					pageIndex: target.pageIndex,
					anchor: null,
					position: { pageOffsetRatio: target.pageOffsetRatio },
					title,
				});
				setPendingAdd(null);
				setBookmarks((previous) => [...previous, added]);
				// The point of marking a page is seeing that it took, so
				// the list is revealed — with the name that was just
				// given, where the reader can still read it and change
				// their mind.
				setSidePanel('bookmarks');
			} catch (error: unknown) {
				// Leave the dialog open with an inline message: the
				// reader typed a title, and a silent close + console
				// trace throws that work away. They can edit the title
				// and retry, or cancel.
				console.error('readmark: could not add a bookmark', error);
				setBookmarkError('栞を保存できませんでした。もう一度お試しください。');
			}
		},
		[documentId, pendingAdd, setSidePanel, sourceFingerprint],
	);

	const handleJump = useCallback(
		async (bookmark: Bookmark) => {
			const scroller = scrollRef.current;
			if (scroller === null) return;
			// Selection bookmarks carry an anchor; resolving it confirms
			// the words are still where the reader left them, and picks
			// the page they belong to now (the file may have grown, or
			// the mark outlived the original page). A page pin has no
			// anchor to resolve and goes straight to the jump.
			//
			// A resolver failure is not a refusal: the row stays. A
			// stored anchor that the reader cannot find in *this* file
			// may yet be the row the reader was looking at in the file
			// they had when they wrote it.
			let targetPage = bookmark.pageIndex;
			if (bookmark.anchor !== null) {
				const resolved = await handle.resolveAnchor(bookmark.anchor).catch(() => null);
				if (resolved !== null) {
					targetPage = resolved.page;
				}
			}
			// Starting a jump retires the one in flight, if any: the
			// reader has asked to be somewhere else, and the previous
			// jump is not theirs to finish. It also retires a restore
			// still settling, which is the same decision.
			const takeover = registerTakeover();
			void jumpToPage({
				scroller,
				pageIndex: targetPage,
				// A mark with no usable stored offset jumps to the top of
				// its page, which is the honest thing to do with
				// "somewhere on this page".
				position: storedOffset(bookmark.position),
				pageCount,
				measuredHeight: (pageIndex) => footprintsRef.current.get(pageIndex)?.height,
				shouldAbort: () => takeoverCountRef.current !== takeover,
			});
		},
		[pageCount, registerTakeover],
	);

	const handleConfirmDelete = useCallback(async () => {
		if (pendingDelete === null) return;
		const target = pendingDelete;
		setPendingDelete(null);
		try {
			await deleteBookmark(target.id);
			setBookmarks((previous) => previous.filter((row) => row.id !== target.id));
		} catch (error: unknown) {
			console.error('readmark: could not delete a bookmark', error);
		}
	}, [pendingDelete]);

	// Leaving the screen (or closing the document) flushes whatever is
	// still debounced. Without this, closing the tab during a read
	// would lose the last stretch of progress.
	useEffect(
		() => () => {
			flushSave();
		},
		[flushSave],
	);

	/**
	 * Change the render options and drop the measured page sizes.
	 *
	 * A footprint records a page's size *at the options it was
	 * measured with*. Keeping them across a zoom or a rotation would
	 * leave the scroller with a column of mixed geometry — some pages
	 * at the new size, the rest at the old one — and both the page
	 * indicator and a restored position would be computed against a
	 * layout that is not the one on screen. Every page falls back to
	 * the rotation-aware provisional size and re-measures as it
	 * materializes; the visible ones do so immediately.
	 */
	function changeOptions(next: { zoom?: number; rotation?: 0 | 90 | 180 | 270 }): void {
		// An explicit zoom is the reader overriding the fit, so the
		// fit-width effect must stop re-applying it — including on the
		// resize that follows, which is the whole point of choosing.
		if (next.zoom !== undefined) {
			userZoomedRef.current = true;
			const chosen = clampZoom(next.zoom);
			// Filed so the choice outlives this mount: the reader can go
			// back to the library and reopen the document, and it opens
			// where they left it instead of snapping back to fit-width.
			setReaderZoom(zoomKey, chosen);
			setZoom(chosen);
		}
		if (next.rotation !== undefined) setRotation(next.rotation);
		setFootprints(new Map());
	}

	function zoomIn(): void {
		changeOptions({ zoom: nextZoom(effectiveZoom, 1) });
	}

	function zoomOut(): void {
		changeOptions({ zoom: nextZoom(effectiveZoom, -1) });
	}

	return (
		<div className="rm-app rm-app--reader">
			<header className="rm-reader-header" ref={headerRef}>
				<LibraryLink testId="rm-reader-back" />
				<h1 className="rm-reader-header__title">{title}</h1>
				<span className="rm-reader-header__spacer" />
				<div className="rm-reader-toolbar" data-testid="rm-reader-toolbar">
					<Button variant="ghost" onClick={zoomOut} data-testid="rm-zoom-out" aria-label="縮小">
						−
					</Button>
					<span className="rm-reader-zoom" data-testid="rm-reader-zoom">
						{Math.round(effectiveZoom * 100)}%
					</span>
					<Button variant="ghost" onClick={zoomIn} data-testid="rm-zoom-in" aria-label="拡大">
						＋
					</Button>
					<Button
						variant="ghost"
						onClick={() => changeOptions({ rotation: nextRotation(rotation, 90) })}
						data-testid="rm-rotate"
					>
						回転
					</Button>
					<Button
						variant="ghost"
						onClick={handleRequestAdd}
						disabled={currentPage === null}
						data-testid="rm-add-bookmark"
						aria-label="栞を追加"
					>
						栞を追加
					</Button>
					<Button
						variant="ghost"
						onClick={() => setSidePanel(sidePanel === 'bookmarks' ? 'none' : 'bookmarks')}
						data-testid="rm-toggle-bookmarks"
						aria-pressed={sidePanel === 'bookmarks'}
					>
						栞
					</Button>
					<span className="rm-reader-zoom" data-testid="rm-reader-page-indicator">
						{currentPage === null ? `- / ${pageCount}` : `${currentPage} / ${pageCount}`}
					</span>
				</div>
			</header>

			<SelectionToolbar
				snapshot={selection}
				boundsRef={scrollRef}
				headerBottom={headerBottom}
				// A reader who re-selects marked text is offered the
				// removal instead of a second identical mark.
				highlightLabel={
					selection !== null && selectionHighlight(selection) !== null
						? 'ハイライトを外す'
						: 'ハイライト'
				}
				onHighlight={(snapshot) => void handleHighlightSelection(snapshot)}
				onBookmark={(snapshot) => void handleBookmarkSelection(snapshot)}
			/>
			{actionError !== null && (
				<p
					className="rm-alert rm-reader-action-error"
					role="alert"
					data-testid="rm-reader-action-error"
				>
					{actionError}
				</p>
			)}
			{sidePanel === 'bookmarks' && (
				<BookmarksPanel
					bookmarks={bookmarks}
					documentTitle={title}
					onJump={(bookmark) => void handleJump(bookmark)}
					onDelete={(bookmark) => setPendingDelete(bookmark)}
				/>
			)}
			{pendingAdd !== null && (
				<AddBookmarkDialog
					pageIndex={pendingAdd.pageIndex}
					onConfirm={(title) => void handleConfirmAdd(title)}
					onCancel={() => setPendingAdd(null)}
					error={bookmarkError}
				/>
			)}
			{pendingDelete !== null && (
				<BookmarkDeleteDialog
					label={`${pendingDelete.pageIndex} ページ`}
					onConfirm={() => void handleConfirmDelete()}
					onCancel={() => setPendingDelete(null)}
				/>
			)}

			<div className="rm-reader-scroll" ref={scrollRef} data-testid="rm-reader-scroll">
				{/*
				 * Inside the scroller on purpose. `.rm-app` is a two-row
				 * grid, so a third child would land in an implicit
				 * `auto` row, the scroller would size to its content
				 * instead of scrolling, and the reader would stop
				 * scrolling exactly when a page failed to render.
				 */}
				{renderError !== null && (
					<p className="rm-alert rm-alert--with-margin" role="alert" data-testid="rm-reader-error">
						{renderError}
					</p>
				)}
				{actionError !== null && (
					<p className="rm-alert" role="alert" data-testid="rm-action-error" style={{ margin: 12 }}>
						{actionError}
					</p>
				)}
				<div className="rm-reader-pages">
					{pages.map((index) => {
						const footprint = footprints.get(index) ?? footprints.get(1 as PageIndex);
						return (
							<PdfPageView
								key={index}
								handle={handle}
								index={index}
								options={options}
								reserved={footprint ?? provisional}
								highlights={byPage.get(index) ?? NO_HIGHLIGHTS}
								onMeasured={handleMeasured}
								onIntrinsicSize={handleIntrinsicSize}
								onError={handleError}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function nextZoom(current: number, direction: 1 | -1): number {
	const index = ZOOM_LEVELS.findIndex((level) => level >= current - 1e-9);
	const from = index === -1 ? ZOOM_LEVELS.length - 1 : index;
	const next = from + direction;
	if (next < 0) return ZOOM_LEVELS[0] ?? 1;
	if (next >= ZOOM_LEVELS.length) return ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 1;
	return ZOOM_LEVELS[next] ?? current;
}
