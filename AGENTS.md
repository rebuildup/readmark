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

readmark has two layers of document identity — **do not collapse
them**:

- **`DocumentId`** (logical): UUID. Survives re-imports of the same
  logical book. Reading state is keyed by this.
- **`SourceFingerprint`** (physical): SHA-256 hex of the raw bytes.
  Stable only for the same bytes. A highlight is a position in
  specific bytes and is keyed by `(documentId, sourceFingerprint,
  anchor)`.

In MVP one `DocumentId` ⇒ one `SourceFingerprint`. The split is
forward-looking — a future "merge two scans of the same book" UI
won't need a storage rewrite.

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
  `docs/development.md` §4.
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