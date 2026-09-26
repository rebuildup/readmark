# ADR-0002: Separate document source from reading state

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers
- Supersedes: (none)
- Related: ADR-0003 (format-agnostic document model)

## Context

A reading tool has two kinds of data:

1. **Document source** — the bytes the user is reading. PDF, EPUB,
   Markdown, plain text. The user owns it; it predates the app.
2. **Reading state** — everything the user has added: current page,
   bookmarks, highlights, notes, last-opened timestamp. The app owns
   it; it is meaningless without the app.

The naive design is to write reading state back into the document
(annotations embedded in the PDF, etc.). This is what Adobe Reader,
Preview, and most "PDF editors" do. There are several problems:

- **Mutates the source.** The user's original file is no longer the
  file they imported. Re-importing from another source-of-truth loses
  state.
- **Format-coupled.** PDF has its own annotation spec (PDF/A, XMP),
  EPUB has Readium annotations, etc. Generic state across formats
  becomes hard.
- **No backup granularity.** "Backup my reading state" cannot be
  done without copying the entire corpus.
- **No portability.** Users cannot move their annotations between
  apps without round-tripping through the format's native annotation
  format.
- **Sync is hard.** If the document lives on a network share and the
  annotations live in the document, conflict resolution requires
  PDF diff/merge.

For readmark, the user's source-of-truth is the original file (which
may live wherever: Downloads, iCloud, Syncthing, a USB stick). The
reading state is the user's *work product* on top of it. Keeping
them separate means:

- The original file is never mutated.
- Reading state can be exported / backed up / moved independently.
- Adding a new format is a storage problem, not a state-shape
  problem.
- Sync, when added, syncs only reading state (a few KB per
  document), not the document itself (often hundreds of MB).

## Two layers of identity, with three concepts (revised on review)

After initial review we discovered that the original "DocumentId +
SourceFingerprint, one Document carries one source" model still
collapsed two responsibilities that should be different. This ADR
is the canonical model; `docs/architecture.md` and `AGENTS.md` §3a
restate it.

### Three concepts

1. **`Document`** — LOGICAL book. A reader's "this book in my
   library." Survives re-imports and survives adding/removing
   sources. Carries:
   - `id` (`DocumentId`, UUID).
   - User-facing identity (`metadata.title`, `metadata.author`,
     `metadata.language`). Initial values come from the first
     source's intrinsic metadata.
   - Book-level timestamps (`importedAt`, `lastReadAt`).

2. **`DocumentSource`** — PHYSICAL source. One file attached to a
   Document. Carries:
   - `sourceFingerprint` (`SourceFingerprint`, SHA-256 of bytes).
   - `documentId` (FK → Document).
   - Source-specific properties (`format`, `byteSize`,
     `importedAt`, `metadata.pageCount`,
     `metadata.extras`).

3. **`DocumentBlob`** — the bytes of one source. Stored separately
   from `DocumentSource` so the bytes can be evicted under quota
   pressure without touching metadata or reading state.

### Why three concepts, not two

- `Document` must NOT carry `format` / `byteSize` /
  `sourceFingerprint` — those are properties of the file, not of
  the book. Putting them on Document forces 1:1 in the schema and
  blocks "same book, two formats" without a rewrite.
- `DocumentSource` and `DocumentBlob` are separate tables keyed by
  the same fingerprint so the bytes can be evicted independently
  of the metadata. Eviction policy is future work; the
  architectural invariant is "dropping `documentBlobs` rows is
  safe."

### Why every positional reading-state type carries `sourceFingerprint`

A position is meaningless outside the specific bytes that produced
it. PDF page 47 and EPUB "chapter 4, position 12" are NOT the same
place even when they refer to the same logical book. So:

- `ReadingProgress` — composite PK `[documentId, sourceFingerprint]`.
  One row per source.
- `Bookmark` — `id` + `(documentId, sourceFingerprint, pageIndex)`.
- `Highlight` — `id` + `(documentId, sourceFingerprint, pageIndex)`.
- `Note` is a discriminated union:
  - `FreeNote` — no position, no source. Lives in the book.
  - `PositionedNote` — carries `sourceFingerprint` + `pageIndex` +
    `anchor`. The discriminator prevents a class of bugs where a
    pageIndex leaks across sources.

`Document.lastReadAt` is the only reading-state-shaped field on
Document — "any source of this book was opened recently" is book-
level. Everything else is per-source.

### MVP is 1:1

In MVP, one Document always owns exactly one DocumentSource. The
schema already supports 1:N. The "merge two scans of the same
book" / "attach an EPUB alongside the PDF" UX is a thin layer over
the repository — no storage rewrite required.

## Decision

readmark splits data into four logical stores with the following
keys:

1. **`documents` table** — `Document` records. Primary key is `id`
   (UUID). Metadata only — no bytes, no source-specific fields.
2. **`documentSources` table** — `DocumentSource` records. Primary
   key is `sourceFingerprint`. FK to `documents.id` via
   `documentId`. Source-specific properties only.
3. **`documentBlobs` table** — bytes, keyed by `sourceFingerprint`.
   Evictable. The bytes' owner is looked up via `documentSources`.
4. **Reading-state tables** (`readingProgress`, `bookmarks`,
   `highlights`, `notes`) — all carry both `documentId` and
   `sourceFingerprint` (except `FreeNote`, which carries neither).
   Compound indexes enable one-read lookups by
   `(documentId, sourceFingerprint, pageIndex)`.

The document is **never written back to**. Specifically:

- No `saveAs` flow that round-trips a PDF through pdf.js to embed
  annotations.
- No XMP / PDF/A sidecar file generated.
- No metadata write-back to EPUB's OPF.

## Consequences

Positive:

- Document corpus can be migrated to / from the app at will.
- Reading state is small (KB per document) and trivially
  backup-able.
- Adding a new format doesn't change the reading-state shape.
- Future sync is reading-state-only.
- The Document ↔ DocumentSource split is forward-compatible with
  multi-source documents without a schema rewrite.
- Bytes are evictable independently of metadata.

Negative / explicit costs:

- If the bytes are evicted (browser data deleted), reading state
  is orphaned. UX surfaces this: "you have notes for X, but the
  file is missing — re-import to recover." (ReaderScreen's
  `missing-blob` state.)
- The user cannot open readmark state in another PDF reader.
  Trade-off is acceptable; export-to-PDF is a possible future
  ticket.
- The model is more elaborate than "one Document = one file."
  Mitigated by the in-codebase narrative and `AGENTS.md` §3a.

## Alternatives considered

- **Embed annotations in the PDF.** Rejected — see Context.
- **Sidecar file (XMP or JSON next to the PDF).** Considered for
  cross-app portability, but rejected for MVP because:
  - Sidecars need filesystem access, which the browser sandbox
    doesn't grant.
  - Re-importing from a different path loses the sidecar.
  - Portability is solvable later with a one-shot export flow.
- **`DocumentId` only, dedup by file metadata.** Rejected —
  metadata is mutable; we need a fingerprint of bytes.
- **`SourceFingerprint` only (no `DocumentId`).** Rejected on
  review — collapses logical and physical identity, loses reading
  state across re-encodes.
- **`Document` with single `sourceFingerprint` column
  (initial PR #17 v1).** Rejected on second-round review — still
  forces 1:1 in the schema; reading-state types other than
  Highlight silently rely on "the one source" without saying so.

## References

- W3C Web Annotation Data Model — separates target (the document)
  from body (the annotation), which is the same shape as our
  separation.
- Hypothesis client — stores annotations as a separate JSON blob
  keyed by URI, never writes back to the source page.
- ADR-0003 (format-agnostic document model).
- `docs/adr/ADR-0007-pdf-anchor-model.md` (forthcoming, see
  issue #15) — locks the highlight anchor shape.
