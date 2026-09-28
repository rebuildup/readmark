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
import type {
	PageHandle,
	PageTextLayer,
	ReaderSelection,
	RenderOptions,
	ResolvedAnchor,
} from '../types.ts';
import { isPdfResolvedDisplay } from './anchor.ts';
import { cssRectsFor, fragmentsForRuns } from './anchor-geometry.ts';
import { quoteForRange, runsForRange, selectionRangeInLayer } from './anchor-recovery.ts';
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

	/**
	 * The last render that completed: its transform, and the two elements
	 * it produced. `null` before the first one, and again while a render
	 * is in flight.
	 *
	 * All three are held together because all three are what "the pixels
	 * currently in this element were drawn with" means. The viewport
	 * alone cannot say a caller's target is the right one: every rendered
	 * page contains a `.rm-page`, so a host another `PageHandle` painted
	 * would satisfy a structural check. The painter compares element
	 * identity, which is the only thing that cannot be true of the wrong
	 * page by coincidence.
	 */
	private lastRender: {
		readonly viewport: ViewportLike;
		readonly target: HTMLElement;
		readonly page: HTMLElement;
	} | null = null;

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
		// Dropped at the *start*, not just on failure. While a re-render
		// is in flight the previous transform no longer describes what is
		// in the target — the target is being rebuilt — and a paint that
		// converted through it would place fragments against a canvas that
		// is about to be replaced. Dropping it makes such a paint say so
		// instead of quietly drawing in the wrong place.
		this.lastRender = null;

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
		//
		// The `transform` is the HiDPI half of the same decision as the
		// backing store above: pdf.js draws in CSS pixels, so on a 2×
		// display it has to be told to draw at 2 device pixels per CSS
		// pixel or the page lands in the top-left quarter of the canvas,
		// at half size and blurry when scaled up. `null` at 1× is what
		// pdf.js's own reference does, and means "no transform".
		const outputScale: number[] | undefined =
			pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0];
		const task = this.pdfPage.render({ canvas, viewport, transform: outputScale });
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

		// Remembered only once the page has actually been painted, and
		// the object is kept rather than the options: `paintResolvedAnchor`
		// has to convert through *this* transform, and re-deriving one
		// from options is how a highlight ends up beside its text.
		if (this.generation === generation && !this.closed) {
			this.lastRender = { viewport, target, page };
		}
	}

	/** The page's glyph runs, in raw PDF user-space (ADR-0007). */
	async text(): Promise<PageTextLayer> {
		return await extractPageTextLayer(this.pdfPage, this.index);
	}

	/**
	 * The anchor for a live selection: what the reader highlighted, and
	 * where on the page they highlighted it.
	 *
	 * Both halves come from the same place on purpose.
	 *
	 * The **quote** is built from the text layer's items and the
	 * selection's offsets within them — never from
	 * `Selection.toString()`. The browser synthesises whitespace and line
	 * breaks from layout, so its answer disagrees with the layer the
	 * quote is later searched against, and an anchor whose quote cannot
	 * find its own text goes stale on a document nobody changed.
	 *
	 * The **rects** are measured, through the same helper recovery uses,
	 * from a text layer built for measuring. A selection is a live thing
	 * in the reader's own layer; the anchor outlives it, at a different
	 * zoom, after a rotation, and possibly in a session that never
	 * renders this page at all.
	 *
	 * `null` when there is no selection to store: an empty one, a
	 * collapsed one, or one that does not start and end inside this
	 * page's own text layer. Cross-page selections are two anchors
	 * (ADR-0007), and a selection that reaches into another page has no
	 * single page to belong to.
	 */
	async createAnchorFromSelection(selection: ReaderSelection): Promise<Anchor | null> {
		const layer = await this.text();
		const range = selectionRangeInLayer(selection.container, selection.range, layer);
		// A collapsed range is a click, not a drag.
		if (range === null) return null;
		const quote = quoteForRange(layer, range);
		if (quote === null) return null;
		const runs = runsForRange(layer, range);
		const fragments = await fragmentsForRuns(this.pdfPage, layer, runs);
		// Rects the anchor could not be measured with. A rect produced
		// without them would be a claim about where the text is that
		// nothing checked, and the quote alone cannot answer it.
		if (fragments === null) return null;

		return {
			format: 'pdf',
			payload: { page: this.index, rects: fragments, quote },
		};
	}

	/**
	 * Paint a resolved anchor's highlight into `target`.
	 *
	 * Geometry and nothing else: the fragments are converted through the
	 * page's own viewport and turned into positioned elements. The
	 * colour is not decided here — `Highlight.color` is a semantic name
	 * and the palette belongs to the UI and its theme, so a PDF painter
	 * that hard-coded a colour would freeze one theme's decision into
	 * persisted data (ADR-0004 §"Where the refreshed anchor is
	 * written").
	 *
	 * Two kinds of "nothing happens", kept apart because they are
	 * different in kind and only one of them is worth a stack trace:
	 *
	 *   - **Programming errors reject.** An anchor for a page this is
	 *     not; a target holding no rendered page; a page with no
	 *     completed render, including one mid-re-render. Each is a caller
	 *     that lost track of what it was talking to, and each is a case
	 *     where drawing something plausible would be worse than failing.
	 *   - **Display data this page does not recognise is a no-op.**
	 *     `display` came out of storage, and a row written by a version
	 *     this build has never heard of has to paint as nothing rather
	 *     than take the reader down.
	 *
	 * The caller errors are checked first: they are about the call, and
	 * reporting them does not depend on the data being one we can read.
	 */
	async paintResolvedAnchor(anchor: ResolvedAnchor, target: HTMLElement): Promise<void> {
		if (anchor.format !== 'pdf') return;
		if (anchor.page !== this.index) {
			throw new Error(
				`readmark: paintResolvedAnchor called on page ${this.index} with an anchor for ` +
					`page ${anchor.page}`,
			);
		}
		const rendered = this.lastRender;
		if (rendered === null) {
			// Also the case where a re-render is in flight: the transform
			// was dropped when it started, and the target is mid-rebuild.
			throw new Error(
				`readmark: paintResolvedAnchor called before page ${this.index} finished rendering`,
			);
		}
		// Identity, not "does it contain a page box". Every rendered page
		// holds a `.rm-page`, so a host some *other* `PageHandle` painted
		// would pass a structural check — and this page's fragments would
		// then be laid over someone else's canvas, converted through a
		// transform that has nothing to do with either.
		if (rendered.target !== target) {
			throw new Error(
				`readmark: paintResolvedAnchor was given an element page ${this.index} was not ` +
					'rendered into',
			);
		}
		if (!isPdfResolvedDisplay(anchor.display)) return;
		const { viewport, page } = rendered;

		const layer = document.createElement('div');
		layer.className = 'rm-highlight';
		// `stale` is a fact about how the rects were derived, and the UI
		// needs to show it as such. It is data rather than only a class
		// because the stylesheet is not the only thing that will read it.
		layer.dataset.freshness = anchor.freshness;
		// A highlight is under the text, never over it: `pointer-events:
		// none` is what keeps a drag across a highlighted sentence a
		// selection rather than a click.
		layer.style.pointerEvents = 'none';
		layer.style.position = 'absolute';
		layer.style.inset = '0px';

		for (const rect of cssRectsFor(anchor.display, viewport)) {
			const fragment = document.createElement('div');
			fragment.className = 'rm-highlight__fragment';
			fragment.style.position = 'absolute';
			fragment.style.left = `${rect.left}px`;
			fragment.style.top = `${rect.top}px`;
			fragment.style.width = `${rect.width}px`;
			fragment.style.height = `${rect.height}px`;
			layer.appendChild(fragment);
		}
		// An empty layer would be a `div` covering the page for nothing.
		if (layer.childElementCount === 0) return;
		page.appendChild(layer);
	}

	/** Cancel any in-flight render and release the page. Idempotent:
	 *  a second call must not hand pdf.js a page that was already
	 *  cleaned up. Called by `PdfReaderHandle.close()`. */
	close(): void {
		if (this.closed) return;
		this.closed = true;
		this.generation++;
		// A closed page has no canvas left to describe, so it has no
		// transform to convert through either.
		this.lastRender = null;
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
