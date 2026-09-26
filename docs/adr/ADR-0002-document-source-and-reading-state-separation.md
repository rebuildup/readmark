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

## Two layers of identity (added on review, 2026-09-26)

After initial review we discovered one more reason to keep the
separation crisp: **a single "fingerprint = identity" model
collapses two things that should be different**.

- `DocumentId` — LOGICAL identity. A UUID minted on first import.
  Survives re-imports of the same logical book. Future enhancement:
  multiple physical sources ("old PDF scan" + "new EPUB" of the
  same book) can share one DocumentId via a "merge" UI.
- `SourceFingerprint` — PHYSICAL identity. SHA-256 of the raw
  bytes. Stable only for the same bytes. Changes on re-encode,
  OCR correction, or any byte-level edit.

Why we want both:

- **Re-downloads / OCR corrections / "metadata-only updated" PDFs**.
  These produce different bytes (different `SourceFingerprint`)
  but the user reads them as "the same book". Naively using the
  fingerprint as identity would lose all reading state on each
  update. With the split, the user can map both sources under one
  `DocumentId` (future ticket).
- **Multiple formats of the same book** (PDF + EPUB). The user might
  read the PDF at home and the EPUB on a phone. Same `DocumentId`,
  different `SourceFingerprint`. Highlights are scoped to one
  source because they are positions in specific bytes; reading
  progress can be scoped to the document and replayed per source.
- **Highlights vs. reading progress**. Reading progress attaches
  to the logical document — "I'm on page 47 of this book" — and
  should survive byte changes. Highlights are positions in bytes and
  must be tied to a specific source.

In MVP, one DocumentId always maps to exactly one source. The
split is forward-looking: today's import flow uses the fingerprint
as a dedup key but mints a fresh UUID; tomorrow's "merge two scans
of the same book" UI does not need to rewrite any reading state.

## Decision

readmark splits data into three stores with the following keys:

1. **`documents` table** — metadata + DocumentId. Primary key is
   `id` (UUID). Secondary index on `sourceFingerprint` for dedup.
2. **`documentBlobs` table** — raw bytes, keyed by
   `sourceFingerprint`. Future: same DocumentId may own multiple
   `documentBlobs` rows. For MVP: 1:1 with `documents`.
3. **Reading-state tables** (`readingProgress`, `bookmarks`,
   `highlights`, `notes`) — all keyed by `documentId`. Highlights
   additionally store `sourceFingerprint`.

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
- The DocumentId / SourceFingerprint split is forward-compatible
  with multi-source documents without a schema rewrite.

Negative / explicit costs:

- If the document is evicted (browser data deleted), reading state
  is orphaned. UX will surface this: "you have notes for X, but
  the file is missing — re-import to recover."
- The user cannot open readmark state in another PDF reader.
  Trade-off is acceptable; export-to-PDF is a possible future
  ticket.
- The split introduces a tiny bit more cognitive load: "two ids?"
  Mitigated by the in-codebase narrative and `AGENTS.md` §3.

## Alternatives considered

- **Embed annotations in the PDF.** Rejected — see Context.
- **Sidecar file (XMP or JSON next to the PDF).** Considered for
  cross-app portability, but rejected for MVP because:
  - Sidecars need filesystem access, which the browser sandbox
    doesn't grant.
  - Re-importing from a different path loses the sidecar.
  - Portability is solvable later with a one-shot export flow.
- **Per-document annotation store keyed by UUID, not fingerprint.**
  Rejected — re-imports must dedupe; fingerprint is the only
  stable physical identity.
- **`SourceFingerprint` only (no `DocumentId`).** Rejected on
  review — collapses logical and physical identity, loses reading
  state across re-encodes.

## References

- W3C Web Annotation Data Model — separates target (the document)
  from body (the annotation), which is the same shape as our
  separation.
- Hypothesis client — stores annotations as a separate JSON blob
  keyed by URI, never writes back to the source page.
- ADR-0003 (format-agnostic document model).
- `docs/adr/ADR-0007-pdf-anchor-model.md` (forthcoming, see
  issue #15) — locks the highlight anchor shape.