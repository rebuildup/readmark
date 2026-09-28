/**
 * readmark — format-agnostic reader contract.
 *
 * The reader contract is the boundary between feature code and
 * format-specific rendering. Outside `src/reader/<format>/`,
 * no code imports `pdfjs-dist` (or any other renderer). Outside
 * `src/reader/`, no code imports a concrete reader implementation.
 *
 * Why this contract exists:
 *   - Library / Bookmark / Highlight / Note panels must NOT
 *     depend on pdf.js. They see only this contract.
 *   - Swapping the renderer (pdf.js fork, native PDF viewer,
 *     adding an EPUB reader) is a one-folder change.
 *   - Tests can mock the contract; pdf.js is not pulled in.
 *
 * What flows in:
 *   - `ReaderSource<F>` — a DocumentSource (ADR-0002 physical
 *     identity) plus its Blob. The format tag is narrowed via
 *     the generic parameter so the reader is format-specific.
 *
 * What flows out:
 *   - `ReaderHandle<F>` — an open source. Owns pages and the
 *     anchor-resolver cache.
 *   - `PageHandle<F>` — a single page; render / text-extract /
 *     createAnchorFromSelection.
 *   - `ResolvedAnchor` — format-agnostic resolution result with
 *     `fresh | stale` freshness. Format-specific display data is
 *     opaque (`unknown`) at this layer; pass it back to the
 *     format-specific reader for painting.
 *
 * Why `Anchor` (input to `resolveAnchor`) is distinct from
 * `ResolvedAnchor` (output):
 *   - The input is what's persisted — format-agnostic outer
 *     with format-specific payload (ADR-0007).
 *   - The output carries the recovery result (fresh / stale)
 *     plus format-specific display data the UI can hand back
 *     to the reader for rendering.
 *
 * Why `Promise<PageHandle<F>>` (not `PageHandle<F>`):
 *   - PDF's `pdfDocument.getPage(n)` is async. Forcing the
 *     contract to be sync would either hide the cost or require
 *     pre-loading all pages. `Promise` is honest and lets the
 *     reader cache internally.
 *
 * Why `resolveAnchor` takes `Anchor` (not `DocumentPosition`):
 *   - `DocumentPosition` is the sub-page navigation pointer used
 *     by ReadingProgress / Bookmark.position for "scroll to
 *     here" on reopen (ADR-0007 §"Two-layer anchor model").
 *   - `Anchor` is the text-region annotation position. Resolving
 *     one runs the quote → rects recovery algorithm from
 *     ADR-0007. Confusing the two was the original ADR-0004
 *     mistake.
 *
 * See ADR-0004 §Decision for the full contract rationale.
 */

import type { Anchor } from '../domain/annotation/index.ts';
import type { DocumentFormat, DocumentSource } from '../domain/document.ts';
import type { PageIndex } from '../domain/reading-state.ts';

/**
 * A document source plus its bytes, ready for a reader to open.
 *
 * Generic code assembles this from the repository:
 *   - `getDocumentSource(sourceFingerprint)` → `DocumentSource`
 *   - `getDocumentBlob(sourceFingerprint)` → `Blob`
 *
 * The format tag is narrowed via the generic parameter so the
 * reader is format-specific at compile time. If a caller hands
 * a PDF reader an EPUB-shaped source, the type system rejects
 * it.
 */
export interface ReaderSource<F extends DocumentFormat> {
	readonly source: DocumentSource & { readonly format: F };
	readonly blob: Blob;
}

/**
 * Generic reader contract. One implementation per format
 * (`PdfReader`, `EpubReader`, …). Generic code depends on this
 * interface only — it never imports a concrete reader.
 */
export interface Reader<F extends DocumentFormat> {
	readonly format: F;
	open(input: ReaderSource<F>): Promise<ReaderHandle<F>>;
}

/**
 * An open document source. Owns the rendered pages, the anchor
 * resolver cache, and the lifetime of the underlying document
 * reference. Call `close()` to release.
 */
export interface ReaderHandle<F extends DocumentFormat> {
	readonly format: F;

	/** Total page count. Async because computing it may require
	 *  parsing the document outline (PDF: `getDocument.numPages`). */
	pageCount(): Promise<number>;

	/** Page handle by 1-based index. Async because PDF's
	 *  `getPage` is async. The format-specific reader caches
	 *  internally; callers treat each handle as independent. */
	page(index: PageIndex): Promise<PageHandle<F>>;

	/** Resolve a stored `Anchor` against the current source.
	 *
	 *  Runs the recovery algorithm from ADR-0007:
	 *    1. Try the text quote against the page's text layer.
	 *    2. On match: refresh rects from glyph geometry, mark
	 *       `fresh`.
	 *    3. On miss: keep stored rects, mark `stale`.
	 *
	 *  Returns `null` only if the anchor cannot be resolved at
	 *  all (e.g. its page no longer exists in this source).
	 *
	 *  **`null` is not permission to delete the row.** It says this
	 *  reader cannot resolve this anchor *against this source*, which
	 *  is a fact about a file the reader may not even hold the whole
	 *  of. A caller that reads it as "the annotation is gone" would
	 *  delete a reader's highlight because they opened a shorter copy
	 *  of the book, or a different file. Deleting persisted state is a
	 *  user action; the only mutation a resolver may cause is the
	 *  `updatedAnchor` write-back, and only when it is not `null`.
	 *
	 *  Format-specific display data is opaque (`unknown`) on
	 *  `ResolvedAnchor.display`. Generic UI cannot read it; pass
	 *  it back to the format-specific reader for painting. */
	resolveAnchor(anchor: Anchor): Promise<ResolvedAnchor | null>;

	/** Release resources. Idempotent. */
	close(): Promise<void> | void;
}

/**
 * Resolved annotation anchor. Format-agnostic.
 *
 * `freshness` is lifted from ADR-0007's recovery algorithm:
 *   - `fresh` — the text quote resolved against the current
 *     source; rects were refreshed from glyph geometry.
 *   - `stale` — the stored anchor was the best available hint
 *     (quote miss); rects may have drifted. The UI surfaces
 *     stale anchors with a marker. We do NOT silently rewrite
 *     stored rects on a stale anchor (ADR-0007 §Decision).
 *
 * `display` is opaque format-specific data (for PDF: the resolved
 * `PdfRect[]` in raw user-space). Generic UI cannot read it; the
 * format-specific reader knows how to render it at the current
 * zoom / rotation.
 */
export interface ResolvedAnchor {
	readonly format: DocumentFormat;
	readonly page: PageIndex;
	readonly freshness: 'fresh' | 'stale';
	/** The exact text that was selected. Mirrors
	 *  `anchor.payload.quote.exact` for formats that carry a
	 *  quote (PDF MVP). Formats without a quote populate this
	 *  from their own selector. */
	readonly selectedText: string;
	/** Opaque format-specific display data. Generic UI cannot
	 *  read this; pass it back to the format-specific reader
	 *  for painting. `unknown` (not `any`) so the compiler
	 *  forces an explicit cast / type guard at any read site. */
	readonly display: unknown;
	/**
	 * The stored anchor, refreshed — or `null` when there is nothing to
	 * write back.
	 *
	 * Recovery rebuilds the display half of an anchor from the source
	 * (ADR-0007), and those rects are better than the ones in storage:
	 * they were measured against the copy of the file in front of the
	 * reader. Somebody has to persist them, and it cannot be the
	 * reader: `src/reader/` does not import the storage layer, and a
	 * reader that reached into IndexedDB would be a second, invisible
	 * writer whose failures no screen could report.
	 *
	 * So recovery hands the refreshed anchor back and lets the caller
	 * decide. `null` covers the two cases where writing would be wrong:
	 *
	 *   - `fresh` with rects that did not move — the stored anchor is
	 *     already correct, and rewriting it would churn a row that is
	 *     right. "Did not move" is a tolerance, not equality: the two
	 *     measurements are floats from two sessions.
	 *   - `stale` — ADR-0007 is explicit that a stale anchor's stored
	 *     rects are *not* rewritten. They are the best available hint,
	 *     and keeping the original lets the anchor recover if the
	 *     change that broke it is undone.
	 *
	 * The caller persists it without reading the payload: this is the
	 * "persist and route an `Anchor` opaquely" half of the boundary,
	 * and an `Anchor<unknown>` on the way to a repository is exactly as
	 * opaque as one on the way out of storage.
	 */
	readonly updatedAnchor: Anchor | null;
}

/** A new annotation anchor, and the exact text it was made from. */
export interface NewAnchor {
	readonly anchor: Anchor;
	readonly selectedText: string;
}

/**
 * A highlight the page has painted, and the only way to take it back
 * off.
 *
 * Returned rather than merely created because the caller has to be able
 * to reconcile overlays against the rows they belong to, and every one
 * of those needs an identity to do it:
 *
 *   - re-painting after a recovery or a zoom would otherwise stack a
 *     second overlay over the first, and two translucent fills over the
 *     same words is a visibly darker highlight;
 *   - deleting a row needs to know which element to remove, and a
 *     painter that keeps its own list cannot answer for a row the UI
 *     added or the reader deleted in another tab;
 *   - `Highlight.color` is a semantic name, so the colour is applied by
 *     the UI — which means the UI has to be able to reach the element.
 *
 * So the element is handed out, and `remove()` is idempotent: a
 * re-render that already replaced the page leaves the handle pointing at
 * a detached node, and calling `remove()` on that is a no-op rather
 * than an error.
 */
export interface PaintedAnchor {
	readonly element: HTMLElement;
	remove(): void;
}

/**
 * A single page of an open source. Format-agnostic shape;
 * format-specific handles may carry extra fields via subtyping.
 */
export interface PageHandle<F extends DocumentFormat> {
	readonly format: F;
	readonly index: PageIndex;

	/** Render the page into `target`. Replaces existing content. */
	render(target: HTMLElement, options: RenderOptions): Promise<void>;

	/** Extract the page's text layer for selection / anchor
	 *  creation. Generic code treats the result opaquely; the
	 *  format-specific reader handles glyph-to-rect mapping. */
	text(): Promise<PageTextLayer>;

	/** Build an `Anchor` from a DOM Selection inside this page.
	 *  Returns `null` if the selection is empty, if its geometry could
	 *  not be measured, or if it spans multiple pages (cross-page
	 *  selections are out of MVP per ADR-0007 §"Single page, MVP
	 *  scope").
	 *
	 *  The exact text comes back beside the anchor rather than being
	 *  read out of its payload. A caller has to store it — ADR-0002
	 *  duplicates it onto `Highlight` so a list can show the words
	 *  without the reader — and the only layer that knows that text
	 *  canonically is the one that built the quote, because the quote is
	 *  assembled from the text layer rather than from the DOM. A caller
	 *  taking the text from `Selection.toString()` instead would store a
	 *  mirror that disagrees with its own anchor at every line wrap. */
	createAnchorFromSelection(selection: ReaderSelection): Promise<NewAnchor | null>;

	/**
	 * Paint a resolved anchor's highlight overlay into `target`.
	 *
	 * The whole `ResolvedAnchor` goes back, not just its `display`:
	 * `display` is `unknown` to generic UI, and `freshness` is what
	 * decides whether the overlay is drawn as a resolved highlight or
	 * as the "this position is a guess" marker ADR-0007 asks for. The
	 * page owns the conversion from the format's stored coordinates to
	 * viewport rects, because it is the only thing that knows the
	 * transform the page was rendered with — a generic UI reading
	 * `display` would have to re-derive it and would get it wrong the
	 * first time zoom or rotation changed.
	 *
	 * There is deliberately no `options` parameter, which revises an
	 * earlier version of this contract. The only transform that puts a
	 * highlight on its glyphs is the one the canvas in `target` was
	 * actually drawn with, and only a completed render knows it.
	 * Honouring options would mean re-deriving a transform, which is
	 * the exact mistake the method exists to prevent. A caller that
	 * wants a different transform re-renders the page and waits.
	 *
	 * `target` is the element the page was rendered into, and the
	 * overlay is placed inside the page box that render created: inside
	 * it, its coordinates are the canvas's coordinates and it inherits
	 * whatever the caller set on the host. A target holding no
	 * rendered page is a caller that passed the wrong element.
	 *
	 * Both of those are programming errors and reject. So does a page
	 * with no completed render — including one whose re-render is still
	 * in flight, where the target is being rebuilt and an overlay placed
	 * now would either be wiped or converted through a transform that
	 * no longer describes what is on screen. Data the page does not
	 * recognise (`display` it cannot gate) is not a programming error
	 * and paints nothing.
	 *
	 * `display` is gated separately from a persisted anchor's
	 * `payload` — it is a different field on a different type, and
	 * `isPdfAnchor` does not apply to it. See ADR-0004 §Two gates.
	 *
	 * Returns a handle to what was painted, so the caller can reconcile
	 * overlays against rows, replace them, and take them off — or `null`
	 * when the display data was not one this page recognises and nothing
	 * was drawn. A caller that treats `null` as a handle is holding a
	 * hole in its map; one that treats it as an error will fall over on
	 * a row from a future version.
	 */
	paintResolvedAnchor(anchor: ResolvedAnchor, target: HTMLElement): Promise<PaintedAnchor | null>;
}

/** Render options. Format-specific readers map these to their
 *  native parameters (PDF: pdf.js `viewport` transform). */
export interface RenderOptions {
	/** CSS pixel scale. Reader maps to format-native scale.
	 *  Default is format-specific (PDF: 1.0 user-space unit = 1
	 *  CSS pixel at scale 1.0). */
	readonly scale?: number;
	/** Page rotation in degrees. Runtime rotation is supported
	 *  without re-anchoring per ADR-0007 (rects are stored in
	 *  raw format-native coordinates; pdf.js applies the
	 *  rotation transform at render time). */
	readonly rotation?: 0 | 90 | 180 | 270;
}

/** Format-agnostic text layer. Each item is a glyph run;
 *  selection / quote-search logic operates over these. The
 *  format-specific reader exposes `text()` returning this opaque
 *  type. */
export interface PageTextLayer {
	readonly format: DocumentFormat;
	readonly page: PageIndex;
	/** Glyph runs in reading order. Format-specific readers may
	 *  carry extras via subtyping; generic code treats them
	 *  opaquely. */
	readonly items: readonly PageTextItem[];
}

export interface PageTextItem {
	/** Concatenated Unicode text of the run. */
	readonly text: string;
	/** Bounding rect in raw format-native coordinates
	 *  (PDF: user-space, 1/72 inch). Generic code does not
	 *  inspect this. */
	readonly rect: {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
	};
}

/** Format-agnostic description of a DOM selection inside a
 *  rendered page. The format-specific reader maps this to its
 *  own selection APIs (PDF: `window.getSelection()` + page text
 *  layer). */
export interface ReaderSelection {
	readonly range: Range;
	/** The HTMLElement containing the rendered page. */
	readonly container: HTMLElement;
}
