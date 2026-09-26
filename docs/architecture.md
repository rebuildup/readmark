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
│  │             Domain 層 (format-agnostic types)                 ││
│  │   DocumentId, SourceFingerprint, ReadingProgress, Bookmark,  ││
│  │   Highlight, Note                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │   Storage 層 (Dexie → IndexedDB)                              ││
│  │   documents (id), documentBlobs (sourceFingerprint),           ││
│  │   bookmarks/highlights/notes/readingProgress (documentId)      ││
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
- Two files today: `document.ts` (Document / DocumentId /
  SourceFingerprint), `reading-state.ts` (ReadingProgress /
  Bookmark / Highlight / Note).

### Storage layer (`src/storage/`)

- The only folder that imports `dexie`.
- Exports repositories (`documents-repo.ts`, …) and the schema
  (`db.ts`).
- **Two-layer identity** (ADR-0002):
  - `documents` keyed by `id` (DocumentId).
  - `documentBlobs` keyed by `sourceFingerprint`.
  - Reading state keyed by `documentId`. Highlights additionally
    store `sourceFingerprint`.
- Blob is stored separately from metadata so it can be evicted
  without losing reading state.

### Reader layer (`src/reader/`)

- The only folder that imports `pdfjs-dist`.
- `reader/types.ts` defines the `Reader` interface.
- `reader/pdf/` is the MVP implementation.
- Other formats (EPUB, Markdown, text) plug in here later.

### Annotation layer (`src/annotation/`)

- W3C Web Annotation Data Model-inspired anchor types.
- Format-agnostic; the format-specific reader fills in
  format-specific fields.

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
3. ReaderScreen looks up the Document by `documentId`
   (`getDocument(documentId)`).
4. UI hands the resulting `SourceFingerprint` to
   `getDocumentBlob(sourceFingerprint)` to fetch the bytes.
5. UI hands the blob to the Reader (`PdfReader.open(blob)`).
6. Reader returns a `ReaderHandle` that exposes pages and anchors.
7. UI renders the Reader, passing the handle into React state.
8. As the user scrolls / jumps, the Reader reports new positions
   and the UI calls `updateReadingProgress(...)` and
   `touchLastReadAt(...)`.

## 4. Data flow — adding a highlight

1. User selects text in a rendered PDF page.
2. The Reader produces a `DocumentPosition` (PDF-specific shape,
   opaque to generic code) plus the selected string.
3. UI calls `createHighlight({ documentId, sourceFingerprint,
   pageIndex, anchor, selectedText })` from the highlights
   repository.
4. Repository writes to the `highlights` table; the UI re-fetches
   and re-renders the highlight overlay.

## 5. Failure modes

| Failure                             | Handling                                            |
| ----------------------------------- | --------------------------------------------------- |
| Browser data deleted                | Library shows empty state; orphan-state UX is a follow-up ticket. |
| IndexedDB quota exceeded            | Import flow refuses and shows the quota estimate.   |
| Persistent storage denied           | UX marks the library as "may be evicted".           |
| PDF file malformed                  | Reader throws a typed error; UI shows a recovery flow. |
| Worker fails to load                | PDF rendering falls back to a synchronous flag (TODO). |

## 6. Future extensions

| Extension             | Where it plugs in                                       |
| --------------------- | ------------------------------------------------------- |
| EPUB                  | New `reader/epub/` impl behind the same `Reader` contract. |
| Markdown              | New `reader/markdown/` impl.                            |
| "Merge two sources under one DocumentId" UI | New `library/document-merge.ts` flow. Schema already supports it. |
| Sync                  | New `storage/sync/` adapter on top of repositories.     |
| Export reading state  | New `export/` folder; consumes repos as read-only.      |
| Integration with my-web-2026 | Deferred per ADR-0006. Pick a shape when there's evidence. |

Each extension is additive; none require touching unrelated folders.

## 7. References

- ADRs in `docs/adr/`.
- `AGENTS.md` §3 (architecture boundary), §3a (identity model).