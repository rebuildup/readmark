# ADR-0007: PDF annotation anchor model

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers
- Replaces: the placeholder `DocumentPosition = Readonly<Record<string, unknown>>` contract used as a stand-in for annotation anchors in `src/domain/reading-state.ts` pre-#15.

## Context

readmark needs a stable way to point at a piece of text in a PDF so
that highlights, bookmarks, and positioned notes survive across
reopens, zoom changes, rotation, and re-rendering. Today the model
uses `DocumentPosition = Readonly<Record<string, unknown>>` everywhere
— a placeholder that mixes two distinct concepts under one type:

1. **Annotation anchor** — "what text is this annotation attached
   to?" Used by `Highlight`, `Bookmark`'s "what text" part, and
   `PositionedNote`. Survives zoom / rotation / re-render by design.
2. **Sub-page navigation pointer** — "where on the page did the
   reader leave off?" Used by `ReadingProgress.position` and
   `Bookmark.position` for "scroll to here" on reopen. Lost under
   zoom / rotation; not re-anchored.

These are different concepts and they answer different questions.
Bundling them as one opaque blob has already produced:

- A vague `DocumentPosition` whose shape no one can describe.
- Generic UI that can't decide whether it's safe to persist /
  inspect the value, because the answer depends on which of the
  two concepts it's holding.
- No anchor recovery story — re-opening a PDF and finding
  highlights again is currently hand-waved.

PDF is the only format in MVP, but the storage layer is format-
agnostic (ADR-0003). Whatever we pick for PDF has to compose with
the future EPUB / Markdown / text anchors without a rewrite.

## Decision

### Two-layer anchor model

The annotation anchor is split into two layers:

- **Outer contract (`Anchor<P>`)** — format-agnostic. Two fields:
  `format: DocumentFormat` and `payload: P`. Generic code persists,
  routes, and reads `format`; it never inspects `payload`.
- **Inner contract (`payload`)** — format-specific. Lives at
  `src/reader/<format>/anchor.ts`. PDF's is `PdfAnchor` at
  `src/reader/pdf/anchor.ts`. Other formats add their own.

Domain types (`Highlight.anchor`, `PositionedNote.anchor`,
`Bookmark.anchor`) carry `Anchor` (i.e. `Anchor<unknown>` to the
generic layer). The format-specific reader validates the payload
at the boundary:

```ts
if (isAnchorOfFormat(anchor, 'pdf') && isPdfAnchor(anchor)) {
  // anchor is now Anchor<PdfAnchor>; safe to read payload.rects,
  // payload.quote, payload.page
}
```

Two guards in series, on purpose:

- `isAnchorOfFormat(anchor, format)` is the **domain-side
  discriminator**. It reads the `format` field only and returns
  `boolean`. It does NOT prove the payload has the right shape.
  The return type is `boolean` (not `anchor is Anchor<PdfAnchor>`)
  because the domain layer cannot honestly narrow to a typed
  payload — only the format string was checked.
- `isPdfAnchor(anchor)` is the **PDF-side validator**. It is a
  true type guard (`anchor is Anchor<PdfAnchor>`) and structurally
  validates the payload shape (`page`, `rects`, `quote.exact`,
  each `PdfRect`'s fields). It lives in `reader/pdf/anchor.ts`
  because only that folder knows what a well-formed PDF anchor
  looks like.

The earlier draft of this ADR proposed a single
`isAnchorOfFormat<PdfAnchor>(...)` that pretended to be both at
once. That was a lie — the format field alone is not enough to
claim the payload is well-formed, and the lie would have
propagated into every call site that reads payload fields. The
two-guard design is honest about what each layer knows.

`DocumentPosition` stays as a separate concept (sub-page pointer).
The two types are NOT interchangeable:

| Type             | Lives in                | Carries format? | Re-anchored?      |
| ---------------- | ----------------------- | --------------- | ----------------- |
| `Anchor<P>`      | `domain/annotation/`    | yes             | yes (quote-based) |
| `DocumentPosition` | `domain/document.ts` | no              | no (best-effort)  |

### PDF anchor payload

```ts
interface PdfAnchor {
  readonly page: PageIndex;                // 1-based
  readonly rects: readonly PdfRect[];      // PDF user-space, one per visual line
  readonly quote: TextQuote;               // exact + prefix + suffix context
}

interface PdfRect {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
}

interface TextQuote {
  readonly exact: string;
  readonly prefix?: string;   // up to 32 chars before `exact`
  readonly suffix?: string;   // up to 32 chars after `exact`
}
```

### Canonical recovery key vs display position

For PDF, both are stored, and they have distinct roles:

- **`quote` is the canonical recovery key.** Matched against the
  PDF's text layer on reopen. Robust to zoom, runtime rotation,
  font substitution, and renderer changes — none of these alter
  the underlying glyphs in the PDF's text layer.
- **`rects` is the display position.** Drawn over the rendered
  page. One entry per visual line of the selection (multi-rect
  for cross-line selections).

Rects alone are not a sufficient canonical key. They break under
any layout change that re-flows the page (uncommon for PDFs but
possible after OCR), and they don't help when the user opens the
PDF in a different viewer at a different zoom and we need to
redraw. Text quote is the only thing that genuinely identifies
the text.

Quote alone is not a sufficient display — the reader needs to know
where on the page to draw the highlight overlay. Rects give us
that. Storing both is the right answer.

### Zoom, rotation, and renderer changes — all supported by raw user-space rects

Both runtime rotation and zoom are handled "for free" by storing
rects in raw PDF user-space. The argument:

- **Raw PDF user-space** is the coordinate system pdf.js exposes
  via `getTextContent()`. It already accounts for the page's
  NATIVE rotation (the `/Rotate` attribute on the page
  dictionary). The page's native orientation is fixed at PDF
  creation time.
- **Runtime rotation** (the user spins the page 0/90/180/270 to
  read a wide table; see `stores/ui-store.ts`) is a *viewport*
  transform applied by pdf.js during render, on top of the
  native orientation. It does NOT modify the user-space rects.
- **Zoom** is a uniform scale on the viewport transform. Same
  story.
- **Renderer changes** (different pdf.js build, different
  browser, different canvas backing) are also a viewport-only
  concern. Glyphs come back from the PDF's text layer in the
  same user-space regardless.

Because we store rects in raw user-space, the reader applies the
*same* viewport transform at render time that pdf.js applies to
the page itself. Highlights therefore stay aligned under any
runtime rotation or zoom without any extra math in the anchor
code.

The failure mode we explicitly avoid: caching viewport-space
rects (i.e. pre-multiplying by the runtime rotation matrix).
That WOULD make rotation invalidate stored rects. We don't do
that. The text-layer extraction gives raw user-space coordinates
and we use those directly.

This is the reason #7's acceptance criterion ("zoom / rotation
してもハイライト位置が一致する") is satisfiable in MVP without
adding rotation-specific code to the anchor recovery algorithm.

### Recovery algorithm

On open, for each stored PDF anchor:

1. **Try the text quote.** Search the page's text layer for
   `prefix + exact + suffix`. If found:
   - Compute new rects from the matched glyph geometry (PDF
     user-space, one rect per visual line).
   - Update the stored anchor with the new rects in place. The
     quote is left unchanged.
   - Display the new rects. The anchor is considered fresh.
2. **If the text quote fails (exact match not found):**
   - Use the stored rects as-is for display. They may now be
     off (the text was OCR-corrected, the PDF was re-encoded,
     a glyph subset was substituted), but they are still the
     best available hint.
   - Flag the anchor as "stale" in the UI. Stale anchors appear
     with a marker; the user can manually reposition or delete
     them. We do NOT silently re-write stored rects on a stale
     anchor — keeping the original lets the anchor recover if
     the user reverts a recent change (e.g. undoes an OCR pass).

No fuzzy match in MVP. "Exact" means: byte-for-byte equality
between the stored `prefix + exact + suffix` and the
concatenation of the matched glyphs' Unicode strings. Whitespace,
hyphenation, ligatures, and re-flows all count as "not found."

If the PDF's text layer is missing (scanned PDF without OCR),
recovery always falls through to step 2 and every anchor is
stale from the start. The MVP surfaces this honestly; a future
OCR pipeline or image-only anchor is out of MVP scope.

### Single page, MVP scope

A `PdfAnchor` cannot span pages. A cross-page selection is two
anchors. A post-MVP sidebar affordance may offer "merge adjacent
across page break"; that's future work.

### Out of MVP scope (explicit non-goals)

- **Cross-page anchors.** Two highlights instead.
- **Fuzzy / approximate match.** Exact match only.
- **Rotation / zoom of the viewport.** NOT in scope to handle
  here — both are supported by storing rects in raw PDF
  user-space. See "Zoom, rotation, and renderer changes" above
  for why this works without any anchor-side math.- **Image-only anchors** (anchors on figures, equations, tables
  with no text). No text layer ⇒ no anchor. MVP renders fine,
  highlighting those regions is unsupported.
- **Rotated rects / non-axis-aligned highlights.** No free-form
  lasso.
- **Highlighting across overlapping text layers** (e.g.
  watermark behind body). MVP grabs the topmost layer; not
  configurable.
- **W3C Web Annotation export.** MVP stores its own shape;
  exporting to W3C on demand is a future adapter.
- **Cross-source re-anchor.** Walking a Highlight / Bookmark /
  PositionedNote from one SourceFingerprint to another under the
  same DocumentId is out of MVP scope. ADR-0002 §6 calls this
  out explicitly.

## Consequences

Positive:

- **Generic UI is honest about what it knows.** `Anchor` flows
  through without the generic layer pretending to know the
  payload shape.
- **Storage is opaque.** IndexedDB persists `Anchor` as JSON;
  Dexie never imports a format-specific type.
- **Adding EPUB / Markdown / text is a new `payload` type.**
  No change to `domain/`, `storage/`, or generic UI.
- **Recovery is bounded and explainable.** Either the quote
  resolves and the rects are refreshed, or it doesn't and the
  anchor is flagged stale. No silent state.
- **Text quote gives us a debugging handle.** When a stale anchor
  is reported, the stored quote lets us reconstruct the intended
  selection even if the rects drifted.

Negative / explicit costs:

- **Two stored fields per anchor** (rects + quote) instead of
  one. Cost is negligible; both serialize to small JSON.
- **Recovery step on every open.** Cheap — page text extraction
  is already paid for by rendering. Quote search is one
  substring scan of one page's text layer.
- **MVP has a real "stale" UI surface.** Stale anchors need an
  indicator and a delete / re-anchor affordance. Out of MVP scope
  to make this beautiful, but the type carries the bit so the
  UI is honest.
- **Cross-page selections are awkward.** Two highlights are not
  one user-visible highlight. Documented, deferred.
- **No image-region highlights.** Cannot highlight a figure or a
  chart in a scanned PDF. Documented, deferred.

## Alternatives considered

- **Rects only (no text quote).** Discarded. Rects alone can't
  identify the text; they would be the only thing left if the
  PDF is re-encoded, OCR-corrected, or has its glyph subset
  replaced. Even raw user-space rects (which are stable under
  runtime rotation and zoom, per "Zoom, rotation, and renderer
  changes" above) still break under those higher-level changes.
  Text quote is the only thing that genuinely identifies the
  text across re-encodes. Recovery becomes impossible without
  it.
- **Text quote only (no rects).** Discarded. The reader has to
  re-derive rects on every render, paying text-extraction cost
  per highlight even when nothing changed. Caching rects is a
  small optimization, but it's also a guarantee — the user can
  trust that an anchor they created yesterday still looks the
  same today, even after a viewer restart.
- **W3C Web Annotation Data Model as the on-disk shape.**
  Discarded for MVP. W3C's `TextPositionSelector` /
  `TextQuoteSelector` / `FragmentSelector` triad covers our
  needs conceptually, but their JSON-LD payload is verbose and
  leaves too many choices open. We pick a concrete shape now,
  leave a clean normalization seam for export later.
- **Fuzzy match (Levenshtein, whitespace normalization,
  hyphenation handling).** Deferred. Each of these is its own
  ticket and has its own failure modes. Exact-match first; we
  learn what users actually hit.
- **Multi-page anchors.** Deferred. Doubles the recovery cost
  (two text-layer scans, two rect computations) and complicates
  the type. Two anchors + a "merge adjacent" affordance covers
  the common case.
- **Inline image anchors.** Deferred. Requires extracting image
  bounding boxes from the PDF, which is a separate pdf.js API
  surface. No MVP user demand.
- **Re-write stored rects eagerly on every open.** Rejected.
  Even a successful quote match might leave rects already
  correct (cached) or only slightly off. Writing back only when
  rects changed is the right cost model.

## Enforcement

- `Anchor<P>` lives at `src/domain/annotation/anchor.ts`. The
  domain layer never imports from `src/reader/`. Enforced by
  review and (post-#12) by a Biome `noRestrictedImports` rule
  blocking `src/reader/` from `src/domain/`.
- `PdfAnchor` lives at `src/reader/pdf/anchor.ts`. No other layer
  imports it. Same rule covers `pdfjs-dist` (ADR-0004) — these
  are two layers of the same isolation.

## Implementation ticket

Issue **#7** (PDF anchor storage + recovery) implements this ADR.
The shape on disk is `Anchor<PdfAnchor>` serialized as JSON;
the reader exposes:

- `createAnchorFromSelection(page, selection): Promise<Anchor>`
  — used when the user releases a mouse-drag highlight.
- `resolveAnchor(anchor: Anchor): Promise<ResolvedAnchor | null>`
  — runs the recovery algorithm; returns rects (refreshed or
  stale) plus a freshness flag.

Both are part of the `Reader` interface (ADR-0004). Unit tests
cover: exact match refreshes rects, missing quote falls through
to stored rects, page rotation is detected, hyphen-broken text
is treated as not-found.

## References

- W3C Web Annotation Data Model — TextPositionSelector,
  TextQuoteSelector, FragmentSelector.
- Hypothesis client architecture — separate anchor persistence
  from rendering; renderable shape is derived, not stored.
- ADR-0002 (document / source / reading-state separation) —
  positional types carry `sourceFingerprint` because a position
  is meaningless outside the bytes that produced it.
- ADR-0003 (format-agnostic document model) — generic code never
  inspects format-specific payloads.
- ADR-0004 (PDF renderer isolation) — `src/reader/pdf/` is the
  only folder that knows about pdf.js or PDF user-space.
- AGENTS.md §3, §3a — boundary and identity model recap.
