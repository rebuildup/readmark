# ADR-0003: Format-agnostic document model

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers

## Context

readmark is a PDF reader in MVP. But the user's reading corpus is not
all PDFs. Common companion formats include:

- **EPUB** — the dominant ebook format. Reflowable, CSS-styled.
- **Markdown** — for technical notes, exported blog drafts, plaintext
  zines.
- **Plain text / source code** — for research, archival material,
  RFC-style reading.

If the domain layer is built around `PdfDocument`, every later addition
(EPUB, Markdown, text) is a rewrite. If the domain layer is built
around `Document`, every later addition is a new reader implementation
behind the same interface.

Concretely, the places where format-coupling leaks today are:

- **Storage schema** — `pageCount` works for PDFs but not for EPUB
  (reflowable) or Markdown (one "page" per scroll?). We model it as
  optional.
- **Reading state anchors** — PDF needs PDF user-space rects; EPUB
  needs CFI; Markdown needs line ranges. Generic UI never inspects
  the anchor; it hands it back to the reader.
- **Renderers** — pdf.js for PDF; Readium for EPUB; a custom
  tokenizer for Markdown. All behind a single `Reader` contract.
- **Metadata** — every format has its own title/author/lang fields.
  The Document model exposes only common fields; format-specific
  extras live under `metadata.extras`.

## Decision

readmark's domain layer is format-agnostic. The MVP only ships a PDF
reader, but:

1. **`Document` is the type.** Not `PdfDocument`. The format field is
   a closed union of strings (`pdf | epub | markdown | text`) and
   grows by adding cases, not by replacing the type.
2. **`Reader` is an interface.** Concrete implementations
   (`PdfReader`, `EpubReader`, …) live under `reader/<format>/` and
   own everything format-specific. The rest of the app depends on
   the interface only.
3. **`DocumentPosition` is opaque.** Generic UI passes it through.
   No type outside the reader inspects the shape.
4. **`DocumentMetadata` exposes a small common subset plus an `extras`
   bag.** Format-specific readers write into `extras` and never rely
   on `extras` from outside their own folder.

The PDF implementation lives at `reader/pdf/` and may import from
`pdfjs-dist`. The domain layer may not.

## Consequences

Positive:

- EPUB, Markdown, text are added as new `reader/<format>/`
  implementations behind the same contract. The Library, Bookmarks,
  Highlights, Notes, Reading Progress surfaces don't change.
- The storage schema is reusable across formats.
- The user's reading state survives a format migration. If a user
  re-saves their PDF as EPUB and re-imports, the fingerprint changes
  (different bytes), but the rest of the architecture is ready to
  support a "same content, different format" link later.

Negative / explicit costs:

- We carry a slightly more abstract type system in MVP that pays off
  only once a second format ships. This is an intentional trade.
- The `DocumentPosition` opacity forces generic UI to bounce through
  the reader for jumps. Cheap; acceptable.

## Alternatives considered

- **`PdfDocument` everywhere, refactor when EPUB arrives.** Rejected
  — refactors are expensive once reading-state rows exist.
- **One mega-`Document` that knows every format.** Rejected — becomes
  a god-object.
- **Format-first (i.e. each format is its own app).** Rejected —
  defeats the user's expectation of "one library, many formats."

## References

- Readium LCP / Readium SDK — a real-world reference for format-agnostic
  reader architecture.
- W3C Web Annotation Data Model — `target` is generic; `selector` is
  format-specific. Same pattern.