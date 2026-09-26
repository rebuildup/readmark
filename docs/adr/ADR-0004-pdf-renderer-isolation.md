# ADR-0004: PDF renderer isolation boundary

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers

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

- All pdf.js imports live under `src/reader/pdf/`.
- A `Reader` interface that returns format-agnostic page handles.
- Feature code (Library, Bookmark panel, Highlight panel, Note panel)
  imports the interface, never pdf.js.

## Decision

The PDF implementation is encapsulated at `src/reader/pdf/`. Outside
this folder, no file imports from `pdfjs-dist`. Enforced by review
and (eventually) by an ESLint/Biome no-restricted-imports rule
referencing `pdfjs-dist`.

The PDF folder owns:

- **Worker setup** — `pdf.worker.min.mjs` is loaded via Vite's `?url`
  pattern (ADR of rebuildup/project-init convention). The worker URL
  is set on `pdfjsLib.GlobalWorkerOptions.workerSrc` exactly once,
  in `reader/pdf/pdf-worker.ts`.
- **Page rendering** — `reader/pdf/pdf-page.ts` exposes
  `PdfPageHandle` which satisfies the `PageHandle` interface from
  `reader/types.ts`. Outside code never sees a `pdfjsLib.PDFPageProxy`.
- **Text layer extraction** — `reader/pdf/pdf-text-layer.ts` converts
  pdf.js `TextContent` to a `PageTextLayer` opaque to the rest of
  the app. Selection / anchor logic operates on the opaque handle.
- **Coordinate conversion** — `reader/pdf/pdf-coords.ts` is the only
  place that knows about PDF user-space vs CSS pixels. Other code
  passes coordinates in PDF user-space (the canonical document
  coordinates).
- **Anchor (re-)anchoring** — `annotation/` contains the generic
  W3C-style anchor types; `reader/pdf/pdf-anchor.ts` is the only
  place that creates PDF anchors from pdf.js selections and resolves
  them back.

The reader interface (`src/reader/types.ts`) defines:

```ts
export interface Reader<F extends DocumentFormat> {
  open(document: Document): Promise<ReaderHandle<F>>;
}

interface ReaderHandle<F> {
  pageCount(): Promise<number>;
  page(index: PageIndex): PageHandle<F>;
  resolveAnchor(anchor: DocumentPosition): Promise<PageIndex | null>;
}

interface PageHandle<F> {
  render(target: HTMLElement, options: RenderOptions): Promise<void>;
  text(): Promise<PageTextLayer>;
  // format-specific extras are NOT exposed here
}
```

## Consequences

Positive:

- The Library screen and panels don't ship pdf.js.
- Swapping pdf.js (or adding a fallback) is a one-folder change.
- Unit tests can mock the Reader interface; pdf.js is not pulled in.
- The annotation engine never depends on pdf.js types.

Negative / explicit costs:

- One more layer of indirection. Cheap.
- The Reader interface has to be designed carefully to not leak pdf.js
  shapes. This is the ongoing tax of the boundary.

## Enforcement

A Biome `noRestrictedImports` rule (added in a quality-gate ticket)
will reject `import … from "pdfjs-dist"` outside `src/reader/pdf/`.

## References

- Mozilla pdf.js — `pdfjs-dist` ESM + Vite setup wiki.
- Hypothesis client architecture — anchors and rendering are
  separated; rendering is swappable behind a strategy interface.