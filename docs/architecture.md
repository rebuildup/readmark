# readmark — architecture

> システム形状の俯瞰。1 段落要約は `README.md`。意思決定の根拠は
> `docs/adr/`。

## 1. システム境界

```
┌───────────────────────────────────────────────────────────────────┐
│                        Browser (single origin)                    │
│                                                                   │
│  ┌──────────────┐   ┌───────────────┐   ┌────────────────────────┐│
│  │   UI 層       │   │  Application  │   │   Reader 層             ││
│  │ (React 19.3) │──▶│ (repositories │──▶│  (Reader interface     ││
│  │ screens      │   │  + stores)    │   │   + PdfReader impl)    ││
│  └──────────────┘   └───────┬───────┘   └─────────┬──────────────┘│
│                             │                     │              │
│                             ▼                     ▼              │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │   Domain 層 (format-agnostic types)                           ││
│  │   Document / DocumentSource / DocumentBlob,                   ││
│  │   ReadingProgress / Bookmark / Highlight /                    ││
│  │   (FreeNote | PositionedNote)                                 ││
│  └──────────────────────────────────────────────────────────────┘│
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │   Storage 層 (Dexie → IndexedDB)                              ││
│  │   documents         — Document (id)                           ││
│  │   documentSources   — DocumentSource (sourceFingerprint)      ││
│  │   documentBlobs     — DocumentBlob (sourceFingerprint)        ││
│  │   bookmarks / highlights / notes / readingProgress — keyed by ││
│  │     (documentId, sourceFingerprint, …)                        ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                              │
                              │  static dist/  (post-build)
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  CDN / static host  ◀──  nginx (Containerfile)                    │
└───────────────────────────────────────────────────────────────────┘
```

Key points:

- **Single browser origin.** All app state lives in the browser's
  IndexedDB under one origin. There is no server-side runtime.
- **No network in MVP.** The app makes no outbound requests during
  normal use.
- **Integration with my-web-2026 is intentionally undecided**
  (ADR-0006). readmark is a standalone web app.

## 2. Layer contracts

### Domain layer (`src/domain/`)

- Format-agnostic types only.
- No imports from React, Dexie, pdf.js, browser APIs.
- Three concept files today:
  - `document.ts` — `Document` (logical), `DocumentSource`
    (physical), `DocumentBlob` (bytes), identity types.
  - `reading-state.ts` — `ReadingProgress`, `Bookmark`,
    `Highlight`, `Note` (discriminated union).

### Storage layer (`src/storage/`)

- The only folder that imports `dexie`.
- Exports the schema (`db.ts`) and repositories
  (`documents-repo.ts`).
- **Three identity-keyed tables** (ADR-0002):
  - `documents` keyed by `id` (DocumentId) — metadata only.
  - `documentSources` keyed by `sourceFingerprint` — source
    metadata.
  - `documentBlobs` keyed by `sourceFingerprint` — bytes. The
    blob is never duplicated onto `documents`; the invariant is
    "drop `documentBlobs` rows under quota pressure without
    touching `documents` or reading-state."
- Reading state is keyed by `(documentId, sourceFingerprint)`:
  - `readingProgress` has composite PK
    `[documentId+sourceFingerprint]`.
  - `bookmarks` / `highlights` index on
    `[documentId+sourceFingerprint+pageIndex]`.
  - `notes` is a single table with a `kind` discriminator
    (`free` | `positioned`). `FreeNote` rows have an empty
    `sourceFingerprint` slot; `PositionedNote` rows fill it.

### Reader layer (`src/reader/`)

- The only folder that imports `pdfjs-dist`.
- `reader/types.ts` defines the `Reader` interface.
- `reader/pdf/` is the MVP implementation.
- Other formats (EPUB, Markdown, text) plug in here later.

### Annotation layer (`src/annotation/`)

- W3C Web Annotation Data Model-inspired anchor types.
- Format-agnostic; the format-specific reader fills in
  format-specific fields.

Two-layer model (ADR-0007):

- **Outer** — `Anchor<P>` (`src/domain/annotation/anchor.ts`).
  Generic. Two fields: `format: DocumentFormat` and
  `payload: P`. Generic code persists and routes this opaquely;
  it never inspects `payload`.
- **Inner** — format-specific payloads. PDF's is `PdfAnchor` at
  `src/reader/pdf/anchor.ts`. EPUB / Markdown / text add their
  own at `src/reader/<format>/anchor.ts`.

For PDF MVP, `PdfAnchor` carries both `rects` (raw PDF
user-space display) and `quote` (text + prefix + suffix
context). **`quote` is the canonical recovery key**;
**`rects` is the display position**. On reopen, the reader
searches the page's text layer for the quote and refreshes
rects from glyph geometry when found; if not found, the stored
rects are kept and the anchor is flagged "stale" in the UI.

Rects live in raw PDF user-space (1/72 inch, untransformed).
Runtime rotation and zoom are applied at render time, not
stored alongside the anchor — so both are supported in MVP
without any anchor-side math.

The format-specific reader uses TWO guards at the boundary to
read payload fields:

```ts
if (isAnchorOfFormat(anchor, 'pdf') && isPdfAnchor(anchor)) {
  // safe to read anchor.payload.rects / .quote / .page
}
```

- `isAnchorOfFormat` (domain-side) reads the `format` field
  only; returns `boolean`. It does NOT prove the payload is
  well-formed.
- `isPdfAnchor` (PDF-side, `src/reader/pdf/anchor.ts`) does
  full structural validation of the payload and narrows to
  `Anchor<PdfAnchor>`.

A single `isAnchorOfFormat<PdfAnchor>` is rejected by code
review — the format field alone is not enough to claim the
payload is well-formed.

`Anchor` is distinct from `DocumentPosition`
(`src/domain/document.ts`) — `DocumentPosition` is the sub-page
"scroll to here" pointer used by `ReadingProgress` /
`Bookmark.position`. It is NOT re-anchored; it just gets you
"back to this page."

### UI layer (`src/ui/`)

- React 19.3 with react-router-dom 7.
- Screens only. No business logic here — repositories and stores
  carry that.
- Imports from any layer above; never bypasses repositories to
  reach storage directly.

### Stores (`src/stores/`)

- Zustand for ephemeral UI state only (current side panel, zoom,
  rotation).
- **Never** store document blobs, reading state, or any
  persistent data.

### Platform (`src/platform/`)

- Thin wrappers over browser APIs:
  - `navigator.storage.persist()` / `.estimate()` / `.persisted()`
  - `crypto.subtle.digest()`
  - `URL.createObjectURL()` / `URL.revokeObjectURL()`
- One wrapper per concept; not a "utilities grab bag".

## 3. Data flow — opening a document

1. User clicks a document in the Library.
2. UI navigates to `/read/:documentId`.
3. ReaderScreen calls `getDocument(documentId)` (metadata only).
4. ReaderScreen calls `getPrimarySource(documentId)` to resolve
   the physical identity.
5. ReaderScreen calls `getDocumentBlob(sourceFingerprint)` for
   the bytes.
6. UI hands the blob to the Reader (`PdfReader.open(blob)`).
7. Reader returns a `ReaderHandle` that exposes pages and anchors.
8. UI renders the Reader, passing the handle into React state.
9. On success, ReaderScreen calls `touchLastReadAt(documentId)`.
10. As the user scrolls / jumps, the Reader reports new positions
    and the UI calls `updateReadingProgress(documentId,
    sourceFingerprint, ...)` and other reading-state writes.

If any step returns `null`, ReaderScreen surfaces the failure
(`not-found` or `missing-blob` state). The `missing-blob` state is
the visible consequence of "eviction dropped the bytes but kept
the metadata."

## 4. Data flow — adding a highlight

1. User selects text in a rendered PDF page.
2. The Reader produces an `Anchor<PdfAnchor>` (a `format: 'pdf'`
   plus `payload: { page, rects, quote }`) and the selected
   string. Both the anchor and the selected string flow out; the
   selected string mirrors `anchor.payload.quote.exact` so the
   sidebar can list highlights without consulting the reader.
3. UI calls `createHighlight({ documentId, sourceFingerprint,
   pageIndex, anchor, selectedText })` from the highlights
   repository.
4. Repository writes to the `highlights` table; the UI re-fetches
   and re-renders the highlight overlay.

On reopen, the Reader runs the recovery algorithm (ADR-0007):
search for the stored quote on the page; if found, refresh
rects from glyph geometry; if not, keep stored rects and flag
the anchor "stale."

A `FreeNote` is added without source or pageIndex; a
`PositionedNote` requires both. The discriminated union forces
this distinction at the type level.

## 5. Failure modes

| Failure                             | Handling                                            |
| ----------------------------------- | --------------------------------------------------- |
| Browser data deleted                | Library shows empty state; orphan-state UX is a follow-up ticket. |
| IndexedDB quota exceeded            | Import flow refuses and shows the quota estimate.   |
| Persistent storage denied           | UX marks the library as "may be evicted".           |
| Bytes evicted but metadata kept     | ReaderScreen shows `missing-blob` state; user re-imports. |
| PDF file malformed                  | Reader throws a typed error; UI shows a recovery flow. |
| Worker fails to load                | PDF rendering falls back to a synchronous flag (TODO). |

## 6. Future extensions

| Extension             | Where it plugs in                                       |
| --------------------- | ------------------------------------------------------- |
| EPUB                  | New `reader/epub/` impl behind the same `Reader` contract. |
| Markdown              | New `reader/markdown/` impl.                            |
| Multi-source per Document | Repository already supports 1:N — only the UI for "attach a second source" is missing. |
| Cross-source re-anchor | Re-anchor job: walk a `PositionedNote` / `Bookmark` / `Highlight` from one `SourceFingerprint` to another under the same `DocumentId`. Algorithm is out of MVP scope. |
| Sync                  | New `storage/sync/` adapter on top of repositories.     |
| Export reading state  | New `export/` folder; consumes repos as read-only.      |
| Eviction policy       | Drop `documentBlobs` rows first; keep `documents` and reading state. UI surfaces the gap (already wired as `missing-blob`). |
| Integration with my-web-2026 | Deferred per ADR-0006. Pick a shape when there's evidence. |

Each extension is additive; none require touching unrelated folders.

## 7. References

- ADRs in `docs/adr/` (notably ADR-0007 — PDF annotation anchor
  model — for the `Anchor<P>` / `PdfAnchor` split).
- `AGENTS.md` §3 (architecture boundary), §3a (identity model),
  §3b (anchor model recap).
