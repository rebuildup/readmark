# ADR-0004: PDF reader contract and renderer isolation

- Status: Accepted
- Date: 2026-09-26 (initial); 2026-09-27 (sync with ADR-0002 / ADR-0007)
- Deciders: readmark maintainers
- Supersedes: the earlier "open(document) → ReaderHandle, resolveAnchor(DocumentPosition)"
  shape. The current contract opens a `(DocumentSource, Blob)` pair and
  resolves `Anchor` (per ADR-0007) into `ResolvedAnchor` (fresh / stale).

## Context

PDF rendering in the browser has a single practical option today:
Mozilla's `pdfjs-dist`. It is large (the core library is ~5 MB minified
before tree-shaking), opinionated (its own worker model, its own text
layer, its own coordinate system), and changes often (the v5 → v6 line
shipped a notable refactor).

Naive integration: import `pdfjs-dist` from the top-level React
components. This causes:

1. **Bundle bloat in non-PDF code paths.** The Library screen ships
   pdf.js unless it's lazily imported. Today: ~5 MB. After more
   features: worse.
2. **Coupling at every layer.** The React components hold pdf.js
   types directly. Swapping the renderer (for whatever reason — fork,
   alternative library, native browser PDF viewer) is a rewrite.
3. **No abstraction for the reader contract.** Annotations, page
   rendering, text selection, and viewport math all leak into
   feature code.
4. **Hard to test.** Components import pdf.js directly, so any unit
   test that touches the reader pulls pdf.js in too.

readmark's job is to be a *reading app*, not a *pdf.js wrapper*. The
boundary needs to be:

- All pdf.js imports live under `src/reader/pdf/`. Enforced by a
  Biome `noRestrictedImports` rule (see "Enforcement" below).
- A `Reader` interface that returns format-agnostic handles.
- Feature code (Library, Bookmark panel, Highlight panel, Note panel)
  imports the interface, never pdf.js.
- The reader contract is keyed on **format** + **DocumentSource**,
  not on `Document`. ADR-0002 split Document (logical) from
  DocumentSource (physical); the reader opens the physical source
  plus its bytes, not the logical book.

The contract below also reflects ADR-0007: the reader resolves
`Anchor` (a text-region annotation position with a format-specific
payload) into `ResolvedAnchor` (a format-agnostic result that
carries fresh / stale freshness). Generic code persists and
routes `Anchor` opaquely; only the format-specific reader knows
how to resolve it.

## Decision

### Boundary

The PDF implementation is encapsulated at `src/reader/pdf/`. Outside
this folder, no file imports from `pdfjs-dist`. Enforced by a Biome
`noRestrictedImports` rule (see "Enforcement").

The PDF folder owns:

- **Worker setup** — `pdf.worker.min.mjs` is loaded via Vite's
  `?url` pattern. The worker URL is set on
  `pdfjsLib.GlobalWorkerOptions.workerSrc` exactly once, in
  `reader/pdf/pdf-worker.ts`.
- **Document loading** — `reader/pdf/pdf-document.ts` opens the
  `Blob` into a `pdfjsLib.PDFDocumentProxy`. Outside code never
  sees this type.
- **Page rendering** — `reader/pdf/pdf-page.ts` exposes
  `PdfPageHandle` which satisfies the `PageHandle` interface from
  `reader/types.ts`. Outside code never sees a
  `pdfjsLib.PDFPageProxy`.
- **Text layer extraction** — `reader/pdf/pdf-text-layer.ts`
  converts pdf.js `TextContent` to `PageTextLayer` opaque to the
  rest of the app. Selection / anchor logic operates on the opaque
  handle.
- **Coordinate conversion** — `reader/pdf/pdf-coords.ts` is the
  only place that knows about PDF user-space vs CSS pixels. Other
  code passes coordinates in PDF user-space (the canonical
  document coordinates, per ADR-0007).
- **Anchor creation / resolution** — `reader/pdf/anchor.ts`
  contains `PdfAnchor`, `PdfRect`, `TextQuote`, `isPdfAnchor`,
  and the `createAnchorFromSelection` / `resolveAnchor` logic
  for PDF. `domain/annotation/anchor.ts` carries the format-
  agnostic `Anchor<P>` outer contract; only the format-specific
  reader knows the payload shape.

### Reader contract

`src/reader/types.ts` defines the format-agnostic reader contract:

```ts
import type { Anchor } from '../domain/annotation/index.ts';
import type {
  DocumentFormat,
  DocumentSource,
} from '../domain/document.ts';
import type { PageIndex } from '../domain/reading-state.ts';

/** A document source plus its bytes, ready for a reader to open.
 *  Generic code assembles this from the repository
 *  (`getDocumentSource` + `getDocumentBlob`). The format tag is
 *  narrowed via the generic parameter so the reader can be
 *  format-specific. */
export interface ReaderSource<F extends DocumentFormat> {
  readonly source: DocumentSource & { readonly format: F };
  readonly blob: Blob;
}

/** Generic reader contract. One implementation per format
 *  (PdfReader, EpubReader, …). Generic code depends on this
 *  interface only — it never imports a concrete reader. */
export interface Reader<F extends DocumentFormat> {
  readonly format: F;
  open(input: ReaderSource<F>): Promise<ReaderHandle<F>>;
}

/** An open document source. Owns the rendered pages, the resolved
 *  anchor cache, and the lifetime of the underlying document
 *  reference. Call `close()` to release. */
export interface ReaderHandle<F extends DocumentFormat> {
  readonly format: F;

  /** Total page count. Async because computing it may require
   *  parsing the document outline (PDF: getDocument.numPages). */
  pageCount(): Promise<number>;

  /** Page handle by 1-based index. Async because PDF's getPage
   *  is async. The format-specific reader caches / re-fetches
   *  internally; callers treat each handle as independent. */
  page(index: PageIndex): Promise<PageHandle<F>>;

  /** Resolve a stored `Anchor` against the current source. Runs
   *  the recovery algorithm from ADR-0007 (text quote → rect
   *  refresh; on miss, stored rects + stale flag).
   *
   *  Returns `null` only if the anchor cannot be resolved at all
   *  (e.g. its page no longer exists in this source).
   *
   *  `Anchor` (input) carries the format-specific payload;
   *  `ResolvedAnchor` (output) is format-agnostic. Format-specific
   *  display data is in `ResolvedAnchor.display` as opaque
   *  `unknown`. Generic UI cannot read it; pass it back to the
   *  format-specific reader for painting. */
  resolveAnchor(anchor: Anchor): Promise<ResolvedAnchor | null>;

  /** Release resources. Idempotent. */
  close(): Promise<void> | void;
}

/** Resolved annotation anchor. Format-agnostic. */
export interface ResolvedAnchor {
  readonly format: DocumentFormat;
  readonly page: PageIndex;
  /** 'fresh' = quote resolved against the current source;
   *  'stale' = stored anchor was the best available hint.
   *  Surfaced in the UI; stale anchors are not silently
   *  rewritten. See ADR-0007 for the algorithm. */
  readonly freshness: 'fresh' | 'stale';
  /** The exact text that was selected. Mirrors
   *  `anchor.payload.quote.exact` for formats that carry a
   *  quote; formats without a quote (post-MVP) populate this
   *  from their own selector. */
  readonly selectedText: string;
  /** Opaque format-specific display data (e.g. for PDF: the
   *  resolved `PdfRect[]` in raw user-space). Generic UI
   *  cannot read this; the format-specific reader knows
   *  how to render it at the current zoom / rotation. */
  readonly display: unknown;
}

/** A single page of an open source. Format-agnostic shape;
 *  format-specific handles may carry extra fields via subtyping. */
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
   *  Returns `null` if the selection is empty or spans multiple
   *  pages (cross-page selections are out of MVP per ADR-0007). */
  createAnchorFromSelection(
    selection: ReaderSelection,
  ): Promise<Anchor | null>;

  /** Paint a resolved anchor's highlight overlay into `target`.
   *  Reads `anchor.display` (opaque to generic UI) and computes
   *  viewport-space rects from the page's current render options. */
  paintResolvedAnchor(
    anchor: ResolvedAnchor,
    target: HTMLElement,
    options?: RenderOptions,
  ): Promise<void>;
}
```

### Supporting types

```ts
export interface RenderOptions {
  /** CSS pixel scale. Reader maps to format-native scale. */
  readonly scale?: number;
  /** Page rotation in degrees (0/90/180/270). Runtime
   *  rotation is supported without re-anchoring per ADR-0007
   *  (rects are stored in raw format-native coordinates). */
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
   *  carry extras; generic code treats them opaquely. */
  readonly items: readonly PageTextItem[];
}

export interface PageTextItem {
  /** Concatenated Unicode text of the run. */
  readonly text: string;
  /** Bounding rect in raw format-native coordinates
   *  (PDF user-space). Generic code does not inspect this. */
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

/** Format-agnostic description of a DOM selection inside a
 *  rendered page. The format-specific reader maps this to its
 *  own selection APIs (PDF: window.getSelection() + page text
 *  layer). */
export interface ReaderSelection {
  readonly range: Range;
  /** The HTMLElement containing the rendered page. */
  readonly container: HTMLElement;
}
```

### Why `ReaderSource<F>` instead of `Reader.open(document)`

ADR-0002 split the model into three concepts: Document (logical),
DocumentSource (physical), DocumentBlob (bytes). A reader opens
the physical bytes of one source, not the logical book. The
`ReaderSource<F>` pair captures exactly that: a source whose
format is narrowed to `F`, plus its blob. Generic code never
needs the Document-level identity to render a page.

The format tag narrowing (`source: DocumentSource & { format: F }`)
is a compile-time guarantee that the source matches the reader.
If a caller hands a PDF reader an EPUB-shaped source, the type
system rejects it.

### Why `resolveAnchor(Anchor)` returns `ResolvedAnchor`

ADR-0007 separates two ideas:

- **`Anchor<P>`** — what's persisted. Format-agnostic outer;
  format-specific payload. Persists across opens.
- **`ResolvedAnchor`** — what's in memory after a recovery pass.
  Carries `fresh | stale` so the UI can flag stale anchors.
  Carries format-specific display data opaquely so generic UI
  can hand it back to the reader for painting without
  inspecting it.

The earlier "resolveAnchor(DocumentPosition) → PageIndex" was
wrong on two counts:

- `DocumentPosition` is the sub-page navigation pointer (used by
  ReadingProgress / Bookmark.position for "scroll to here"), not
  an annotation anchor (ADR-0007).
- Returning `PageIndex | null` lost the freshness information
  that ADR-0007's algorithm produces.

The new contract reflects both corrections.

### Where `ResolvedAnchor.display` goes

`display` is `unknown`, so this is the one place the boundary is worth
drawing down. The rule: **generic UI never reads `display`; it hands
the whole `ResolvedAnchor` to the page that produced it.**

```
  selection (DOM)
        │  PageHandle.createAnchorFromSelection(selection)
        ▼
  Anchor<unknown>                        ← persisted (IndexedDB)
  { format: 'pdf', payload: PdfAnchor }
        │  ReaderHandle.resolveAnchor(anchor)
        │  → ADR-0007 recovery: quote search in the text layer,
        │    rects refreshed from glyph geometry, or kept + stale
        ▼
  ResolvedAnchor                         ← in memory, per session
  { format, page, freshness, selectedText, display: PdfRect[] }
        │
        │   generic UI reads: page, freshness, selectedText
        │   generic UI must NOT read: display
        ▼
  PageHandle.paintResolvedAnchor(resolved, target)
        │  isAnchorOfFormat(anchor,'pdf') && isPdfAnchor(anchor)
        │  display  → PdfRect[]  (narrowed inside reader/pdf/)
        │  PdfRect[] (raw user-space) + RenderOptions
        │    → pdf.js viewport transform
        ▼
  overlay elements in `target` (viewport CSS px)
```

Two properties the diagram is asserting, not just describing:

- **The narrowing happens on the format side.** `display` is read
  through `isPdfAnchor`'s companion check inside `reader/pdf/`, never
  by a cast in `src/ui/`. `unknown` is what forces that: a UI that
  tried to read it would not typecheck.
- **The transform is applied once, at paint time.** Stored rects are
  raw user-space (ADR-0007), so a zoom or rotation change never
  invalidates them; the page applies the transform the *current*
  `RenderOptions` imply. A generic UI that positioned rects itself
  would have to re-derive that transform on every zoom, and would
  diverge from the canvas the first time it did.

`freshness` travels with the anchor for the same reason: whether an
overlay is drawn as a resolved highlight or as the "this position is a
guess" marker is a format decision about how the rects were derived,
so the page needs it, not the UI.

### Why `page()` is async

PDF's `pdfDocument.getPage(n)` returns `Promise<PDFPageProxy>`.
Forcing the contract to be synchronous would either:

- Hide the async (each call internally awaits; the cost is paid
  but not declared), or
- Require the reader to pre-load all pages (memory blowup).

`Promise<PageHandle<F>>` is honest about the cost and lets the
reader cache.

## Consequences

Positive:

- The Library screen and panels don't ship pdf.js (enforced by
  Biome `noRestrictedImports`).
- Swapping pdf.js (or adding a fallback) is a one-folder change.
- Unit tests can mock the Reader interface; pdf.js is not pulled
  in.
- The annotation engine never depends on pdf.js types.
- `Anchor` / `ResolvedAnchor` carry freshness across opens; stale
  anchors are surfaced honestly instead of silently re-written.
- Adding EPUB / Markdown / text is a new `Reader<F>` impl + a new
  payload type at `reader/<format>/anchor.ts`. No change to
  `domain/`, `storage/`, or generic UI.

Negative / explicit costs:

- One more layer of indirection. Cheap.
- `ResolvedAnchor.display` is opaque to generic UI (`unknown`).
  Generic code that wants to render highlights must hand the whole
  `ResolvedAnchor` back to the format-specific reader
  (`pageHandle.paintResolvedAnchor(resolved, target)`). The reader
  control flow stays on the format-specific side.
- `Promise<PageHandle<F>>` adds an `await` at every page access.
  Unavoidable: PDF's getPage is async.
- Two anchor types in flight at once: stored `Anchor` (input to
  resolveAnchor) and `ResolvedAnchor` (output). Necessary
  because the input is what the storage layer knows; the output
  is what the UI needs.

## Enforcement

- Biome `noRestrictedImports` (added in #12, `biome.json`):
  - `pdfjs-dist` is `error` everywhere except `src/reader/pdf/**`.
  - `dexie` is `error` everywhere except `src/storage/**`.
  - Both rules are exercised by `bun run lint` in the CI
    workflow `.github/workflows/ci.yml`.
- Code review: a single `isAnchorOfFormat<PdfAnchor>` that pretends
  to narrow payload is rejected (see ADR-0007 §Decision). The
  two-guard pattern (`isAnchorOfFormat(anchor, 'pdf') && isPdfAnchor(anchor)`)
  is mandatory.

## Implementation ticket

Issue **#1** implements this contract. #2 (worker setup) and #11
(reader screen) implement against it. #7 (text selection + highlight)
implements `createAnchorFromSelection` and `paintResolvedAnchor`
against it.

## References

- Mozilla pdf.js — `pdfjs-dist` ESM + Vite setup wiki.
- Hypothesis client architecture — anchors and rendering are
  separated; rendering is swappable behind a strategy interface.
- W3C Web Annotation Data Model — TextPositionSelector /
  TextQuoteSelector / FragmentSelector. readmark stores its own
  shape (ADR-0007); W3C is the future export format.
- ADR-0002 — Document / DocumentSource / DocumentBlob. The reader
  opens `(DocumentSource, Blob)`, not `Document`.
- ADR-0007 — anchor model. `Anchor<PdfAnchor>` is the input to
  `resolveAnchor`; `ResolvedAnchor` (with freshness) is the output.
- AGENTS.md §3, §3a, §3b.
