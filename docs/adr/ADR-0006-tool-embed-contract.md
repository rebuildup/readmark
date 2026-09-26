# ADR-0006: Embed contract with my-web-2026 (Tool slot)

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers
- Extends: rebuildup/my-web-2026 ADR-0006 (Tools submodule policy)

## Context

readmark is intended to be one of several "Tools" embedded by
my-web-2026 (the rebuildup personal site). my-web-2026 defines a
canonical slot at `tools/<tool-name>/` populated by a pinned Git
submodule, with a strict boundary: the parent must never import from
the tool's `src/`, and the tool must never import from the parent's
`src/` or `styled-system/`.

Each Tool may use its own framework / styling / runtime. The
integration contract is "build artefact + stable URL + an embed
pattern the Tool documents." my-web-2026 explicitly forbids
pre-creating `src/domains/tools/` or any Tool registry.

This ADR records readmark's side of that contract. It does **not**
own the parent-side decision (which lives in my-web-2026's ADR-0006
and a future ADR on the embed URL). It only locks in what readmark
promises to deliver.

## Decision

readmark's embed contract with my-web-2026:

1. **Stable deployable bundle.** readmark ships a Vite-built static
   bundle (no SSR, no edge functions). The deployable artefact is
   the contents of `dist/` after `bun run build`. The Tool never
   ships a backend runtime.

2. **Stable URL.** readmark is reachable at a stable URL — either
   `https://readmark.<domain>/` (first-party host) or
   `https://tools.<domain>/readmark/` (path-prefixed under the Tools
   host). The parent embeds it via `<iframe src="<stable-url>/" />`
   with `sandbox` attribute set per future security ADR.

3. **No cross-origin state sharing.** The iframe is a separate
   origin (or sub-origin). The parent page cannot read the user's
   library. Communication is via `postMessage` if at all (no
   cross-origin state sharing in MVP).

4. **Manifest.** The build artefact ships with a `manifest.json`
   that declares the entry URL, the supported embed query
   parameters (none in MVP), the postMessage protocol version
   (none in MVP), and the iframe sandbox recommendation. Parent
   code reads `manifest.json` to wire the embed; hardcoding the
   URL shape in the parent is forbidden.

5. **Submodule pinned to a SHA.** When the parent adds readmark as
   `tools/readmark`, the parent pins a specific commit SHA and
   bumps it on a deliberate schedule. readmark does not push
   unreviewed commits.

6. **No coupling to parent's design system.** readmark's styles
   live in `src/styles.css` and are not derived from
   my-web-2026's Panda CSS tokens. The Tool is owned end-to-end.

7. **Versioned release tags.** readmark uses SemVer. The parent
   pins to a `release-X.Y.Z` tag or commit SHA. Major bumps
   require an embed-contract ADR update on both sides.

8. **Smoke-tested in isolation.** Before a release, readmark is
   deployed to a staging URL and a Playwright smoke test confirms
   the bundle loads and the Library route renders. The parent's
   own prod-smoke workflow may additionally verify the embed; this
   is the parent's responsibility.

## Consequences

Positive:

- The two repos evolve independently. readmark doesn't break on
  my-web-2026 changes.
- The Tool can be developed, tested, and shipped without involving
  the parent repo's CI.
- The bundle is reusable: readmark can also be deployed standalone
  (e.g. as a PWA on the user's own domain).

Negative / explicit costs:

- Two deploys per release (readmark, then the parent's embed bump).
- The parent's CI cannot test the readmark embed without staging
  access. Mitigated by the prod-smoke workflow.
- `postMessage` is a richer protocol than `<iframe>` alone, and we
  are deferring it. Future ticket.

## Out of scope

- A Tool Registry / catalog. The parent's ADR-0008 forbids
  pre-creating one. If many Tools land, that ticket precedes the
  individual Tool tickets.
- A unified build / deploy orchestrator across the parent and its
  Tools. Same reasoning — deferred.
- An iframe `sandbox` policy. This belongs to the parent's embed
  ADR; we will adopt the recommended policy once the parent
  publishes it.

## References

- rebuildup/my-web-2026 — ADR-0006 (Tools submodule policy).
- rebuildup/my-web-2026 — ADR-0008 (obligation-oriented source
  architecture; forbids pre-created `src/domains/tools/`).
- rebuildup/my-web-2026 — `tools/README.md` (the slot description).