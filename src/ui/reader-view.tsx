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
import type { Bookmark, PageIndex } from '../domain/reading-state.ts';
import { nextRotation, PDF_PAGE_CLASS, viewportSize } from '../reader/pdf/index.ts';
import { currentPositionFrom, type PageExtent, type ScrollPosition } from '../reader/position.ts';
import type { ReaderHandle, RenderOptions } from '../reader/types.ts';
import { addBookmark, deleteBookmark, listBookmarks } from '../storage/bookmarks-repo.ts';
import { saveReadingPosition } from '../storage/reading-state-repo.ts';
import { useUiStore } from '../stores/ui-store.ts';
import { BookmarkDeleteDialog, BookmarksPanel } from './bookmarks-panel.tsx';
import { Button } from './primitives/button.tsx';
import { LibraryLink } from './primitives/library-link.tsx';
import { jumpToPage } from './scroll-to-page.ts';

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
 *  drifting to 112% and staying there. */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

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

interface PdfPageViewProps {
	readonly handle: ReaderHandle<'pdf'>;
	readonly index: PageIndex;
	readonly options: RenderOptions;
	/** Reserved size until this page has been rendered for real. */
	readonly reserved: PageFootprint;
	readonly onMeasured: (index: PageIndex, footprint: PageFootprint) => void;
	readonly onError: (error: unknown) => void;
}

function PdfPageView({ handle, index, options, reserved, onMeasured, onError }: PdfPageViewProps) {
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

	useEffect(() => {
		if (!materialized) return;
		const host = hostRef.current;
		if (host === null) return;
		// Re-entrancy is the page handle's job (task cancel + generation
		// counter); `cancelled` only stops this component from reading
		// the DOM of a page it no longer owns.
		let cancelled = false;
		void (async () => {
			try {
				const page = await handle.page(index);
				await page.render(host, options);
				if (cancelled) return;
				const rendered = host.querySelector<HTMLElement>(`.${PDF_PAGE_CLASS}`);
				if (rendered === null) return;
				onMeasured(index, {
					width: rendered.offsetWidth || Number.parseFloat(rendered.style.width) || 0,
					height: rendered.offsetHeight || Number.parseFloat(rendered.style.height) || 0,
				});
			} catch (error: unknown) {
				if (!cancelled) onError(error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [handle, index, materialized, onError, onMeasured, options]);

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
	const [zoom, setZoom] = useState<number>(1);
	const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
	const [footprints, setFootprints] = useState<ReadonlyMap<PageIndex, PageFootprint>>(
		() => new Map(),
	);
	const [renderError, setRenderError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState<PageIndex | null>(null);
	const [bookmarks, setBookmarks] = useState<readonly Bookmark[]>([]);
	const [pendingDelete, setPendingDelete] = useState<Bookmark | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);
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
	// Set when the reader drives the scroller themselves, so a restore
	// still in progress steps aside instead of yanking them back.
	const readerMovedRef = useRef(false);
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

	// One object for the whole document, so a zoom change re-renders
	// every visible page against the same viewport and each page's
	// effect sees a stable `options` identity.
	const options = useMemo<RenderOptions>(() => ({ scale: zoom, rotation }), [zoom, rotation]);

	const pages = useMemo(
		() => Array.from({ length: pageCount }, (_, index) => (index + 1) as PageIndex),
		[pageCount],
	);

	// Rotation-aware, so a turned page reserves a landscape slot from
	// the start rather than jumping when it is measured.
	const provisional = useMemo(
		() => viewportSize(PROVISIONAL_PAGE.width, PROVISIONAL_PAGE.height, zoom, rotation),
		[rotation, zoom],
	);

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
		setRenderError('このページの描画に失敗しました。時間をおいて再度お試しください。');
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
			setCurrentPage((previous) =>
				previous === position.pageIndex ? previous : position.pageIndex,
			);
			if (!restoredRef.current) return;
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
			readerMovedRef.current = true;
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
				const control = target.closest('input, textarea, select, button, a, [contenteditable]');
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
	}, [scheduleSave]);

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
		void jumpToPage({
			scroller,
			pageIndex: initialPosition.currentPage,
			position: initialPosition.position,
			pageCount,
			measuredHeight: (pageIndex) => footprintsRef.current.get(pageIndex)?.height,
			shouldAbort: () => cancelled || readerMovedRef.current,
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

	/** Mark the page the reader is on, at the offset they are at. */
	const handleAddBookmark = useCallback(async () => {
		const scroller = scrollRef.current;
		if (scroller === null) return;
		// Read at the moment of the click rather than from the last
		// scroll event: pages finish measuring in between, and a mark
		// should point at where the reader is now. It is the position
		// the progress row stores, computed the same way, so jumping
		// back to the mark lands where the reader actually was.
		const position = readPosition(scroller);
		if (position === null) return;
		try {
			const added = await addBookmark({
				documentId,
				sourceFingerprint,
				pageIndex: position.pageIndex,
				anchor: null,
				position: { pageOffsetRatio: position.pageOffsetRatio },
			});
			setBookmarks((previous) => [...previous, added]);
			setSidePanel('bookmarks');
		} catch (error: unknown) {
			console.error('readmark: could not add a bookmark', error);
		}
	}, [documentId, setSidePanel, sourceFingerprint]);

	const handleJump = useCallback(
		(bookmark: Bookmark) => {
			const scroller = scrollRef.current;
			if (scroller === null) return;
			void jumpToPage({
				scroller,
				pageIndex: bookmark.pageIndex,
				// A mark with no usable stored offset jumps to the top of
				// its page, which is the honest thing to do with
				// "somewhere on this page".
				position: storedOffset(bookmark.position),
				pageCount,
				measuredHeight: (pageIndex) => footprintsRef.current.get(pageIndex)?.height,
				// The reader has asked to be somewhere else; a jump
				// already in progress is not theirs to finish.
				shouldAbort: () => readerMovedRef.current,
			});
		},
		[pageCount],
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
		if (next.zoom !== undefined) setZoom(next.zoom);
		if (next.rotation !== undefined) setRotation(next.rotation);
		setFootprints(new Map());
	}

	function zoomIn(): void {
		changeOptions({ zoom: nextZoom(zoom, 1) });
	}

	function zoomOut(): void {
		changeOptions({ zoom: nextZoom(zoom, -1) });
	}

	return (
		<div className="rm-app rm-app--reader">
			<header className="rm-reader-header">
				<LibraryLink testId="rm-reader-back" />
				<h1 className="rm-reader-header__title">{title}</h1>
				<span className="rm-reader-header__spacer" />
				<div className="rm-reader-toolbar" data-testid="rm-reader-toolbar">
					<Button variant="ghost" onClick={zoomOut} data-testid="rm-zoom-out" aria-label="縮小">
						−
					</Button>
					<span className="rm-reader-zoom" data-testid="rm-reader-zoom">
						{Math.round(zoom * 100)}%
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
						onClick={() => void handleAddBookmark()}
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

			{sidePanel === 'bookmarks' && (
				<BookmarksPanel
					bookmarks={bookmarks}
					documentTitle={title}
					onJump={handleJump}
					onDelete={(bookmark) => setPendingDelete(bookmark)}
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
					<p className="rm-alert" role="alert" data-testid="rm-reader-error" style={{ margin: 12 }}>
						{renderError}
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
								onMeasured={handleMeasured}
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
