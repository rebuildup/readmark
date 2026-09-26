# AGENTS.md — readmark

This file is the **always-on** agent contract for working in the readmark
repository. It is intentionally concise. Long-lived decisions live in
`docs/adr/`; conditional workflows live in Skills (installed via
`bunx skills add rebuildup/project-init`); current task state lives on
the GitHub Issue or PR.

> Source of truth: this repo at HEAD. Do NOT infer from older memory
> what the project's rules are — Read `AGENTS.md`, `CONTRIBUTING.md`,
> and the relevant ADR before starting non-trivial work.

## 0. Project position

readmark is a **local-first reading app for the browser**. The MVP
handles PDF. EPUB / Markdown / text are post-MVP.

readmark is **not part of the my-web-2026 monorepo**. It is a
sibling repository. Integration with my-web-2026 (link, embed,
same-origin co-host, or none) is a downstream decision — see
ADR-0006. The two repos do **not** share source, dependencies,
design tokens, or CI.

## 1. Language policy

- **Source code**: English. Comments, identifiers, file headers.
- **Documentation**: Japanese. ADRs, README, docs/*, inline
  explanation. (mirrors rebuildup/project-init's language policy.)
- **Issues / PR titles & bodies**: Japanese.
- **Commit messages**: English subject; Japanese body is fine.
- **Branch names**: identifiers or release versions only — no prose.

## 2. Stack discipline (do not substitute)

- **JS/TS**: bun (`packageManager` pin in `package.json`).
- **Build**: Vite 7.x with `@vitejs/plugin-react`.
- **Renderer**: `pdfjs-dist` 5.4.x.
- **Persistence**: IndexedDB through Dexie.
- **State**: Zustand for ephemeral UI state only.
- **Router**: react-router-dom 7.x.
- **Format / lint**: Biome 2.x. **No Prettier. No ESLint.**
- **No Tailwind. No shadcn/ui.** Styling lives in `src/styles.css`.
- **No new Python scripts.** (project-init policy.)
- **Containerfile** — never `Dockerfile`.

Do not add a new dependency to a category that already has one. If
a choice is required (e.g. "should we use TanStack Query?"), open
an ADR ticket before installing.

## 3. Architecture boundary (do not bleed)

The folder shape is obligation-oriented. **Path = projection of
ownership**, not the rule that creates it.

- `src/domain/` — format-agnostic types. No React, no Dexie, no
  pdf.js imports here.
- `src/storage/` — Dexie schema + repositories. The only folder
  that imports `dexie`.
- `src/reader/` — reader contract + per-format implementations.
  PDF lives at `src/reader/pdf/`. **Only this folder imports
  `pdfjs-dist`.**
- `src/annotation/` — anchor types + (re-)anchoring logic.
  Format-agnostic; format-specific details come from the reader.
- `src/library/` — library flows (import, list, dedupe).
- `src/ui/` — React screens. Imports from every layer above, but
  does not bypass repositories to hit Dexie directly.
- `src/stores/` — Zustand stores for ephemeral UI state. **Never
  store document bytes or reading-state here.**
- `src/platform/` — thin wrappers over browser APIs
  (`navigator.storage`, `crypto.subtle`, `URL.createObjectURL`).
- `src/lib/` — utilities (currently `fingerprint.ts`).

Forbidden:

- `import … from "pdfjs-dist"` outside `src/reader/pdf/`.
- `import … from "dexie"` outside `src/storage/`.
- Generic `src/components/`, `src/hooks/`, `src/utils/` folders.
  Add code to the owner that needs it.

## 3a. Identity model (recap of ADR-0002)

readmark has three concepts, not two — **do not collapse them**:

- **`Document`** — logical book. `id` is a `DocumentId` (UUID).
  Holds user-facing identity (title / author / language) and book-
  level timestamps (`importedAt`, `lastReadAt`). Source-specific
  fields do NOT belong here.
- **`DocumentSource`** — physical file attached to a Document.
  `sourceFingerprint` is a `SourceFingerprint` (SHA-256 of bytes).
  Holds source-specific properties (`format`, `byteSize`,
  `pageCount`, format-specific extras).
- **`DocumentBlob`** — the bytes of one source. Stored separately
  from `DocumentSource` so eviction can drop bytes without
  touching metadata or reading state.

Reading state is keyed by **both** keys for everything that has a
position:

- `ReadingProgress`: composite PK `[documentId, sourceFingerprint]`.
- `Bookmark` / `Highlight`: `id` + `(documentId, sourceFingerprint,
  pageIndex)`.
- `Note` is a discriminated union:
  - `FreeNote` — no position, no source.
  - `PositionedNote` — carries `sourceFingerprint` + `pageIndex`.

`Document.lastReadAt` is the only reading-state-shaped field on
Document — opening any source counts.

In MVP one `Document` ⇒ one `DocumentSource`. The schema already
supports 1:N; a future "merge two scans of the same book" / "attach
an EPUB alongside the PDF" UI is a thin layer over the repository,
not a storage rewrite. Cross-source progress migration is future
re-anchor work.

## 3b. Annotation anchor model (recap of ADR-0007)

readmark has TWO concepts of "position", and they are NOT the
same type:

- **`Anchor<P>`** (`src/domain/annotation/anchor.ts`) — a
  text-region annotation position. Used by `Highlight.anchor`,
  `PositionedNote.anchor`, and (optionally)
  `Bookmark.anchor`. Format-agnostic outer contract
  (`format` + opaque `payload`); the format-specific reader
  fills in the payload shape (`PdfAnchor` for PDF MVP, future
  EPUB CFI / Markdown line range / text char-offset).
  **Re-anchored on reopen** — quote-based recovery for PDF,
  with stale fallback to stored rects.
- **`DocumentPosition`** (`src/domain/document.ts`) — a sub-page
  navigation pointer. Used by `ReadingProgress.position` and
  `Bookmark.position` for "scroll to here" on reopen. Format-
  agnostic opaque blob (PDF scroll offset, EPUB CFI, …). **NOT
  re-anchored** — zoom, rotation, and renderer changes can all
  invalidate it; the MVP contract is "back to this page", not
  "back to this scroll offset".

For PDF specifically (MVP):

- **`quote` is canonical / recovery**, **`rects` is display**.
  Both are stored. On open, the reader searches the page's text
  layer for the quote; if found, rects are refreshed from glyph
  geometry. If not found, the stored rects are kept and the
  anchor is flagged "stale" in the UI.
- **Single page only.** Cross-page selections are two anchors.
- **Exact match only.** No fuzzy / whitespace / hyphenation
  handling in MVP.
- **Rects are in raw PDF user-space** (1/72 inch, untransformed).
  The reader maps to viewport-space at render time, applying
  the same runtime rotation + zoom transform that pdf.js applies
  to the page itself. Storing in raw user-space means runtime
  rotation does NOT invalidate stored rects — highlights stay
  aligned at any rotation angle.

`Bookmark.anchor` is `Anchor | null` (optional). A bookmark can
be either a "pin this page" (no selection, `anchor: null`) or a
"this specific text on this page" (selection-based,
`anchor: Anchor`). The MVP must support the former — users add
bookmarks while reading without making a selection. Forcing a
selection would block the common case. `pageIndex` is the only
required positional field.

Generic UI never inspects `Anchor.payload`. It persists and
routes the anchor opaquely. The format-specific reader casts
through TWO guards at the boundary:

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

This two-guard pattern is mandatory. A single
`isAnchorOfFormat<PdfAnchor>` would lie about payload
well-formedness and is rejected by code review. Adding EPUB /
Markdown / text is a new `payload` type + new `is<Format>Anchor`
guard at `src/reader/<format>/anchor.ts` — no change to
`domain/`, `storage/`, or generic UI.

## 4. Quality gates

Three deterministic entry points (mirrors project-init's
quality-gate shape):

- `bun run validate:fast` — typecheck + lint + unit test. Required
  locally before opening a PR.
- `bun run validate` — adds build. Required before tagging a
  release.
- CI workflow `.github/workflows/ci.yml` runs `validate:fast` on
  PRs and push to `main` / `release-*` / numeric branches.

Coverage thresholds are not enforced (project-init ADR-0007 of
the upstream). Do not invent them to "look protected".

## 5. Sprint workflow (mirrors rebuildup/project-init /
   my-web-2026)

- One Issue = one branch = one PR. Branch name is just the issue
  number (`42`, no `issue/` prefix).
- Stacked PRs base on the predecessor branch, not on `main`.
- A Draft PR is opened **after the first meaningful commit** and
  *before* any further implementation. Opening a Draft PR after
  the work is done is forbidden.
- Squash-merge and rebase-merge are **disabled** on this repo.
  PRs land via merge commit.
- `main` accepts only `release-X.Y.Z → main` PRs.

## 6. Local-first invariants (recap)

- No server runtime. No backend language in scope.
- No telemetry in the default build. (No `READMARK_TELEMETRY` env
  var — YAGNI. Add it back if / when telemetry is actually
  implemented.)
- No `localStorage` for documents or large payloads. IndexedDB
  only.
- Reading state and document source are separate stores keyed by
  `DocumentId` (ADR-0002). Source bytes are keyed by
  `SourceFingerprint`.

## 7. Decision precedence

In order:

1. This `AGENTS.md` (always-on invariants).
2. `docs/adr/*` (long-lived decisions).
3. Coherent existing implementation in this repo.
4. Current official framework guidance (Vite, React, pdf.js,
   Dexie).
5. Ecosystem convention.
6. Local best judgment.

When in doubt, escalate via an ADR draft PR, not by silently
violating an invariant.

## 8. Secrets

- `.env`, `.env.*` are gitignored. **Do not commit secrets.**
- `.env.example` is the canonical env schema. See
  `docs/development.md` §4. The MVP schema is `READMARK_EPHEMERAL`
  only. Variables for unimplemented features do not exist; they
  land here together with the ADR that introduces them.
- A future ticket may integrate Infisical per project-init
  ADR-0023. Out of scope for MVP.

## 9. Required skills (per current task)

| Task                       | Load Skill                   |
| -------------------------- | ---------------------------- |
| Any persistent prose       | `writing-discipline`         |
| Any ticket / PR work       | `github-delivery`            |
| Any design / API question  | `engineering-decisions`      |
| Quality gate design         | `quality-gate`               |
| Worktree / branch ops      | `worktree-workflow`          |
| Recovery after interruption | `agent-recovery`           |

Install with `bunx skills add rebuildup/project-init --skill
<name>`.

## 10. Out of scope (do not start)

- Sync / multi-device
- Cloud accounts / auth
- EPUB / Markdown / text rendering (post-MVP)
- AI features (post-MVP)
- Writing annotations back into the PDF
- Covering the bundle with Tailwind / shadcn
- A backend runtime of any kind
- Locking the my-web-2026 integration shape (deferred per
  ADR-0006)
- Telemetry / crash reporting (excluded per ADR-0001; add when
  actually built)

## 11. Recovery

If interrupted mid-ticket, re-read the GitHub Issue and the open
PR's most recent commit. The durable state is GitHub, not local
files.

## 12. References

- ADRs in `docs/adr/`.
- `docs/architecture.md` — system shape.
- `docs/development.md` — local setup, env schema, common tasks.
- `docs/release.md` — version / release process.
- `docs/troubleshooting.md` — known gotchas.
- rebuildup/project-init — meta-template this repo follows.

## 13. ADR index

- ADR-0001 — local-first invariants.
- ADR-0002 — Document / DocumentSource / DocumentBlob separation.
- ADR-0003 — format-agnostic document model.
- ADR-0004 — PDF reader contract and renderer isolation
  (`ReaderSource<F>` / `Reader<F>` / `ReaderHandle<F>` /
  `PageHandle<F>` / `ResolvedAnchor`).
- ADR-0005 — IndexedDB persistence strategy.
- ADR-0006 — deployment / my-web-2026 integration.
- ADR-0007 — PDF annotation anchor model (`Anchor<P>` outer +
  `PdfAnchor` payload; quote canonical, rects display).