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
│  │   Document, DocumentFingerprint, ReadingProgress, Bookmark, …  ││
│  └──────────────────────────────────────────────────────────────┘│
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │   Storage 層 (Dexie → IndexedDB)                              ││
│  │   documents, documentBlobs, bookmarks, highlights, notes,      ││
│  │   readingProgress                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                              │
                              │  static dist/  (post-build)
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  CDN / static host  ◀──  nginx (Containerfile)                    │
└───────────────────────────────────────────────────────────────────┘
                              ▲
                              │  <iframe src="https://readmark.<domain>/">
┌───────────────────────────────────────────────────────────────────┐
│  my-web-2026 (Tool consumer) — separate repo / separate origin     │
└───────────────────────────────────────────────────────────────────┘
```

Key points:

- **Single browser origin.** All app state lives in the browser's
  IndexedDB under one origin. There is no server-side runtime.
- **No network in MVP.** The app makes no outbound requests during
  normal use.
- **Tool consumer is a separate origin.** readmark cannot read
  my-web-2026 state and vice versa. Communication is `postMessage`
  only (none in MVP).

## 2. Layer contracts

### Domain layer (`src/domain/`)

- Format-agnostic types only.
- No imports from React, Dexie, pdf.js, browser APIs.
- Two files today: `document.ts`, `reading-state.ts`.

### Storage layer (`src/storage/`)

- The only folder that imports `dexie`.
- Exports repositories (`documents-repo.ts`, …) and the schema
  (`db.ts`).
- Schema is keyed by `DocumentFingerprint` for everything reading-
  state-related; blobs are stored separately so they can be evicted
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
2. UI calls `getDocumentBlob(fingerprint)` from the documents
   repository.
3. Repository reads from IndexedDB (`documentBlobs` table).
4. UI hands the blob to the Reader (`PdfReader.open(blob)`).
5. Reader returns a `ReaderHandle` that exposes pages and anchors.
6. UI renders the Reader, passing the handle into React state.
7. As the user scrolls / jumps, the Reader reports new positions
   and the UI calls `updateReadingProgress(...)` and
   `touchLastReadAt(...)`.

## 4. Data flow — adding a highlight

1. User selects text in a rendered PDF page.
2. The Reader produces a `DocumentPosition` (PDF-specific shape,
   opaque to generic code) plus the selected string.
3. UI calls `createHighlight({ fingerprint, pageIndex, anchor,
   selectedText })` from the highlights repository.
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
| Sync                  | New `storage/sync/` adapter on top of repositories.     |
| Export reading state  | New `export/` folder; consumes repos as read-only.      |
| `<postMessage>` host  | New `platform/post-message.ts`; both sides opt in.      |

Each extension is additive; none require touching unrelated folders.

## 7. References

- ADRs in `docs/adr/`.
- `AGENTS.md` §3 (architecture boundary).