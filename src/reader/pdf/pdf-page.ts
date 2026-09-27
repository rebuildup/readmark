/**
 * readmark — PDF page handle.
 *
 * Owns one page's rendered form: the `<canvas>` the glyphs are
 * painted into, and the transparent text layer a reader selects
 * across. Both are built from the SAME `PageViewport` in a single
 * pass, which is the only way to guarantee they stay registered
 * after a zoom or a rotation (gate 6 of the #11 operator note).
 *
 * Re-entrancy is the hard part of this file, because a reader can
 * outrun a render:
 *
 *   - Zoom and rotation are UI state, so a click can arrive while a
 *     page is still painting at the previous viewport. Every new
 *     `render()` cancels the task in flight and bumps a generation
 *     counter; the older call's `await` continuations compare their
 *     generation and drop their work instead of painting a text layer
 *     onto a canvas that no longer exists.
 *   - `close()` (via the reader handle) cancels again and releases
 *     the page, so a screen that unmounts mid-render leaves no
 *     running task and no worker-side page state behind.
 *
 * `createAnchorFromSelection` returns `null`: turning a selection
 * into an `Anchor` is #7's work, and until the quote/recovery model
 * is implemented, returning a well-typed "not yet" is better than a
 * rect that looks persistable and is not.
 */

import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';
import type { Anchor } from '../../domain/annotation/index.ts';
import type { PageIndex } from '../../domain/reading-state.ts';
import type { PageHandle, PageTextLayer, ReaderSelection, RenderOptions } from '../types.ts';
import type { ViewportLike } from './pdf-coords.ts';
import { buildTextLayer, extractPageTextLayer } from './pdf-text-layer.ts';

/** Class name of the wrapper that holds a page's canvas + text
 *  layer. The screen measures it to reserve scroll space, so it is
 *  part of the contract rather than a styling detail. */
export const PDF_PAGE_CLASS = 'rm-page';

export class PdfPageHandle implements PageHandle<'pdf'> {
	readonly format = 'pdf' as const;

	private pending: RenderTask | null = null;
	private generation = 0;
	private closed = false;

	constructor(
		readonly index: PageIndex,
		private readonly pdfPage: PDFPageProxy,
	) {}

	/**
	 * Render this page into `target` at the given scale / rotation.
	 *
	 * Replaces whatever `target` held: a re-render at a new viewport
	 * keeps a stale canvas otherwise, and the two layers would end up
	 * describing different transforms — the exact "highlight sits next
	 * to the text" failure the text layer exists to prevent.
	 */
	async render(target: HTMLElement, options: RenderOptions): Promise<void> {
		if (this.closed) return;
		const generation = ++this.generation;
		this.cancelPendingRender();

		const scale = options.scale ?? 1;
		const rotation = options.rotation ?? 0;
		// `PageViewport` structurally satisfies the `ViewportLike` the
		// coordinate / text-layer modules take, so the pdf.js type
		// stays inside this file: `render()` needs the real thing, and
		// everything downstream needs four methods.
		const viewport = this.pdfPage.getViewport({ scale, rotation });

		target.replaceChildren();
		const page = document.createElement('div');
		page.className = PDF_PAGE_CLASS;
		page.style.width = `${viewport.width}px`;
		page.style.height = `${viewport.height}px`;
		page.dataset.page = String(this.index);

		const canvas = document.createElement('canvas');
		canvas.className = 'rm-page__canvas';
		const pixelRatio = displayPixelRatio();
		// Backing store is scaled for the display; the CSS size stays
		// in CSS px so the text layer (positioned in CSS px) stays
		// registered with the glyphs.
		canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
		canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
		canvas.style.width = `${viewport.width}px`;
		canvas.style.height = `${viewport.height}px`;
		page.appendChild(canvas);
		target.appendChild(page);

		const context = canvas.getContext('2d');
		if (context === null) {
			throw new Error('readmark: 2d canvas context is unavailable');
		}
		paintWhiteBackground(context, viewport, pixelRatio);

		// pdf.js 5 takes the canvas itself and derives the context;
		// passing both is not allowed.
		const task = this.pdfPage.render({ canvas, viewport });
		this.pending = task;
		try {
			await task.promise;
		} catch (cause: unknown) {
			// A cancelled render is the expected outcome of zooming or
			// navigating away mid-paint, not a failure to report.
			if (this.generation === generation && !isRenderCancelled(cause)) {
				throw cause;
			}
			return;
		} finally {
			if (this.pending === task) this.pending = null;
		}

		if (this.generation !== generation || this.closed) return;

		try {
			await buildTextLayer(this.pdfPage, viewport, page);
		} catch (cause: unknown) {
			// A page with no extractable text still renders its
			// canvas; a text-layer failure must not blank the page.
			if (this.generation === generation && !isRenderCancelled(cause)) {
				console.error('readmark: text layer build failed', cause);
			}
		}
	}

	/** The page's glyph runs, in raw PDF user-space (ADR-0007). */
	async text(): Promise<PageTextLayer> {
		return await extractPageTextLayer(this.pdfPage, this.index);
	}

	/**
	 * #7 owns selection → `Anchor`. Returning `null` keeps the
	 * contract honest until then: a rect produced without the quote
	 * would be stored as a canonical recovery key it cannot honour.
	 */
	async createAnchorFromSelection(_selection: ReaderSelection): Promise<Anchor | null> {
		return null;
	}

	/** Cancel any in-flight render and release the page. Idempotent:
	 *  a second call must not hand pdf.js a page that was already
	 *  cleaned up. Called by `PdfReaderHandle.close()`. */
	close(): void {
		if (this.closed) return;
		this.closed = true;
		this.generation++;
		this.cancelPendingRender();
		this.pdfPage.cleanup();
	}

	private cancelPendingRender(): void {
		const task = this.pending;
		this.pending = null;
		if (task === null) return;
		try {
			task.cancel();
		} catch {
			// pdf.js throws if the task already settled between our
			// null-check and the call. Nothing left to cancel.
		}
	}
}

/** Device pixel ratio for the canvas backing store, clamped so a
 *  high-DPR display cannot ask for a page-sized allocation that
 *  exceeds the browser's per-canvas limit. 1 under Node, where the
 *  page handle is unit-tested without a real display. */
function displayPixelRatio(): number {
	if (typeof window === 'undefined') return 1;
	const ratio = window.devicePixelRatio;
	if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0) return 1;
	return Math.min(ratio, 3);
}

/** pdf.js rejects a cancelled `RenderTask` with
 *  `RenderingCancelledException`. Matched by name so the reader
 *  layer does not depend on the class identity across pdf.js
 *  versions (same reasoning as `isPdfJsInvalidException`). */
function isRenderCancelled(cause: unknown): boolean {
	if (cause === null || typeof cause !== 'object') return false;
	return (cause as { name?: unknown }).name === 'RenderingCancelledException';
}

/** PDF pages are white; the canvas is transparent until pdf.js
 *  paints, which shows the app background through it. */
function paintWhiteBackground(
	context: CanvasRenderingContext2D,
	viewport: ViewportLike,
	pixelRatio: number,
): void {
	context.save();
	context.fillStyle = '#ffffff';
	// The fill is expressed in CSS px: the context is pre-scaled to
	// the device pixel ratio, exactly as the backing store is.
	context.scale(pixelRatio, pixelRatio);
	context.fillRect(0, 0, viewport.width, viewport.height);
	context.restore();
}
