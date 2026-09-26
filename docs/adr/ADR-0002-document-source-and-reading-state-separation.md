# ADR-0002: Separate document source from reading state

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers

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
  annotations live in the document, conflict resolution requires PDF
  diff/merge.

For readmark, the user's source-of-truth is the original file (which
may live wherever: Downloads, iCloud, Syncthing, a USB stick). The
reading state is the user's *work product* on top of it. Keeping them
separate means:

- The original file is never mutated.
- Reading state can be exported / backed up / moved independently.
- Adding a new format is a storage problem, not a state-shape
  problem.
- Sync, when added, syncs only reading state (a few KB per document),
  not the document itself (often hundreds of MB).

## Decision

readmark splits data into two stores with no shared keys except a
**document fingerprint**:

1. **`documentBlobs` table** — raw bytes, keyed by SHA-256 of the
   bytes. Optional in the long run: the user may choose to keep only
   a fingerprint and re-fetch from a content-addressed source. For
   MVP the blob is always cached.
2. **Reading-state tables** (`documents` for metadata, `readingProgress`,
   `bookmarks`, `highlights`, `notes`) — all keyed by the same
   document fingerprint.

The document is **never written back to**. Specifically:

- No `saveAs` flow that round-trips a PDF through pdf.js to embed
  annotations.
- No XMP / PDF/A sidecar file generated.
- No metadata write-back to EPUB's OPF.

The fingerprint is the only stable join key. If the user moves the
original file, deletes it, and re-imports later, the reading state
re-binds to the same fingerprint.

## Consequences

Positive:

- Document corpus can be migrated to / from the app at will.
- Reading state is small (KB per document) and trivially backup-able.
- Adding a new format doesn't change the reading-state shape.
- Future sync is reading-state-only.

Negative / explicit costs:

- If the document is evicted (browser data deleted), reading state
  is orphaned. UX will surface this: "you have notes for X, but the
  file is missing — re-import to recover."
- The user cannot open readmark state in another PDF reader. Trade-off
  is acceptable; export-to-PDF is a possible future ticket.
- Storage takes 2× during the lifetime of an open document (blob in
  IndexedDB + working memory). Mitigated by streaming the blob out
  of IndexedDB via `URL.createObjectURL`.

## Alternatives considered

- **Embed annotations in the PDF.** Rejected — see Context.
- **Sidecar file (XMP or JSON next to the PDF).** Considered for
  cross-app portability, but rejected for MVP because:
  - Sidecars need filesystem access, which the browser sandbox
    doesn't grant.
  - Re-importing from a different path loses the sidecar.
  - Portability is solvable later with a one-shot export flow.
- **Per-document annotation store keyed by UUID, not fingerprint.**
  Rejected — re-imports must dedupe; fingerprint is the only stable
  identity.

## References

- W3C Web Annotation Data Model — separates target (the document) from
  body (the annotation), which is the same shape as our separation.
- Hypothesis client — stores annotations as a separate JSON blob keyed
  by URI, never writes back to the source page.