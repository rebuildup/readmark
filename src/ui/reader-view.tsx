/**
 * readmark — the open-document view.
 *
 * Owns the page lifecycle for one open source: which pages have been
 * materialized, what each one's footprint is, and the toolbar's zoom
 * and rotation. Everything it needs arrives through
 * `ReaderHandle<'pdf'>` — it never sees a pdf.js type.
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

import type { PageIndex } from '../domain/reading-state.ts';
import { nextRotation, viewportSize } from '../reader/pdf/index.ts';
import type { ReaderHandle, RenderOptions } from '../reader/types.ts';
import { Button } from './primitives/button.tsx';
import { LibraryLink } from './primitives/library-link.tsx';

/** Zoom stops the toolbar steps through. Discrete rather than
 *  multiplicative so "zoom in" can land back on 100% instead of
 *  drifting to 112% and staying there. */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** How far outside the viewport a page may be and still be
 *  materialized. Two screens of slack keeps a fast scroll from
 *  outrunning the render, without paying for the whole file. */
const PREFETCH_MARGIN = '200% 0px';

/** A4 portrait in points, used to reserve space for a page nobody has
 *  measured yet. Only a placeholder: the first page that renders
 *  replaces it for the whole document, and each page corrects its own
 *  size as it materializes. Without a non-zero provisional height the
 *  pages would all stack at the top of the scroller, every one of them
 *  inside the viewport, and the reader would render the whole file at
 *  once while believing it was lazy. */
const PROVISIONAL_PAGE = { width: 595, height: 842 };

/** Wrapper class of a rendered page. The screen measures it to reserve
 *  scroll space, so it is part of the contract, not styling. */
const PAGE_CLASS = 'rm-page';

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
				const rendered = host.querySelector<HTMLElement>(`.${PAGE_CLASS}`);
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

interface ReaderViewProps {
	readonly handle: ReaderHandle<'pdf'>;
	readonly pageCount: number;
	readonly title: string;
}

export function ReaderView({ handle, pageCount, title }: ReaderViewProps) {
	const [zoom, setZoom] = useState<number>(1);
	const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
	const [footprints, setFootprints] = useState<ReadonlyMap<PageIndex, PageFootprint>>(
		() => new Map(),
	);
	const [renderError, setRenderError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState<PageIndex | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);

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
			if (existing !== undefined && existing.width === footprint.width) return previous;
			const next = new Map(previous);
			next.set(index, footprint);
			return next;
		});
	}, []);

	const handleError = useCallback((error: unknown) => {
		console.error('readmark: page render failed', error);
		setRenderError('このページの描画に失敗しました。時間をおいて再度お試しください。');
	}, []);

	// Current page: the first page whose box reaches the middle of the
	// viewport. #5 turns this into persisted progress; until then it
	// only labels where the reader is.
	useEffect(() => {
		const scroller = scrollRef.current;
		if (scroller === null) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			const middle = scroller.scrollTop + scroller.clientHeight / 2;
			const hosts = Array.from(scroller.querySelectorAll<HTMLElement>('[data-page-index]'));
			let best: PageIndex | null = null;
			for (const host of hosts) {
				if (host.offsetTop + host.offsetHeight / 2 < middle) continue;
				best = Number(host.dataset.pageIndex) as PageIndex;
				break;
			}
			if (best === null) {
				const last = hosts[hosts.length - 1];
				best = last === undefined ? null : (Number(last.dataset.pageIndex) as PageIndex);
			}
			setCurrentPage((previous) => (previous === best ? previous : best));
		};
		const onScroll = () => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(update);
		};
		scroller.addEventListener('scroll', onScroll, { passive: true });
		update();
		return () => {
			scroller.removeEventListener('scroll', onScroll);
			if (frame !== 0) cancelAnimationFrame(frame);
		};
		// Mount-only on purpose: the listener reads the page hosts from
		// the DOM at scroll time, and `pageCount` is fixed for as long
		// as this view is mounted (the screen opens the document first).
	}, []);

	return (
		<div className="rm-app rm-app--reader">
			<header className="rm-reader-header">
				<LibraryLink testId="rm-reader-back" />
				<h1 className="rm-reader-header__title">{title}</h1>
				<span className="rm-reader-header__spacer" />
				<div className="rm-reader-toolbar" data-testid="rm-reader-toolbar">
					<Button
						variant="ghost"
						onClick={() => setZoom((current) => nextZoom(current, -1))}
						data-testid="rm-zoom-out"
						aria-label="縮小"
					>
						−
					</Button>
					<span className="rm-reader-zoom" data-testid="rm-reader-zoom">
						{Math.round(zoom * 100)}%
					</span>
					<Button
						variant="ghost"
						onClick={() => setZoom((current) => nextZoom(current, 1))}
						data-testid="rm-zoom-in"
						aria-label="拡大"
					>
						＋
					</Button>
					<Button
						variant="ghost"
						onClick={() => setRotation((current) => nextRotation(current, 90))}
						data-testid="rm-rotate"
					>
						回転
					</Button>
					<span className="rm-reader-zoom" data-testid="rm-reader-page-indicator">
						{currentPage === null ? `- / ${pageCount}` : `${currentPage} / ${pageCount}`}
					</span>
				</div>
			</header>

			{renderError !== null && (
				<p className="rm-alert" role="alert" data-testid="rm-reader-error" style={{ margin: 12 }}>
					{renderError}
				</p>
			)}

			<div className="rm-reader-scroll" ref={scrollRef} data-testid="rm-reader-scroll">
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
