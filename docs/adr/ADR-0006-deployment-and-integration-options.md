# ADR-0006: Deployment & integration options (decision deferred)

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers
- Supersedes: (none)
- Related: (none)

> **Note on earlier draft**: an earlier draft of this ADR fixed the
> integration shape as `my-web-2026 = submodule + <iframe>`. On
> review we agreed that was premature — readmark should ship as a
> standalone web app first, and the integration method (link,
> embed, same-origin) is a downstream decision. This ADR records
> only what is decided today.

## Context

readmark is one of several "Tools" that may eventually be exposed
by rebuildup/my-web-2026 (a sibling personal-site repo). At the
same time, readmark has value on its own — a user can `bun run
dev` and read a PDF without ever involving my-web-2026.

The earlier draft locked the integration as a git submodule hosted
under `tools/readmark/` in my-web-2026 and embedded via `<iframe>`
to a stable URL. That decision pulled in real costs that don't
belong in a "should this app work at all" scope:

- **`<iframe>` brings operational constraints.** Keyboard event
  handling, drag-and-drop, focus management, clipboard access,
  URL-bar history sync, mobile viewport sizing, `postMessage` as
  the only legal cross-origin channel. None of these are bad by
  themselves, but each is a tax on the reading experience for a
  benefit (single sign-on shell, shared chrome) that hasn't been
  justified.
- **Submodule = pinned SHA.** Every readmark release becomes a
  parent-repo change. Reviews cross repos. The parent's CI
  doesn't know if readmark's CI passed. This couples the release
  cadences in a way that doesn't match readmark's MVP scope.
- **Same-origin deployment.** A simpler alternative — serve
  readmark as a path under the my-web-2026 origin — gives up
  cross-origin isolation but eliminates most iframe costs. It's
  not in the earlier draft because the draft assumed iframe.

We don't need any of this decided today. readmark can ship as a
standalone static bundle and we can pick an integration shape
later, with evidence instead of guesses.

## Decision

Today, readmark commits to the following minimal shape:

1. **Standalone web app.** readmark is a single static bundle
   produced by `bun run build`. It serves itself; it does not
   assume any parent app.
2. **No forced integration with my-web-2026.** my-web-2026 may
   *link* to a deployed readmark, *embed* it (iframe or web
   component), or *co-host* it under the same origin — none of
   these are decided here.
3. **Stable deployable artefact.** The build output (`dist/`) is
   the deployable surface. The `Containerfile` ships it via
   nginx. No backend runtime, no SSR.
4. **Single origin per deployment.** All IndexedDB lives under
   one origin. If the deployment is co-hosted with my-web-2026,
   the origin is shared; if it's cross-origin, the iframe boundary
   is the isolation guarantee.
5. **No PII in IndexedDB keys.** Fingerprints and UUIDs only —
   no file paths, no user identifiers, no telemetry.
6. **Embed contract is documented, not enforced.** A future
   commit may add a `manifest.json` and a `postMessage` schema
   when an integration is chosen. Today: nothing.

## Consequences

Positive:

- readmark ships and runs without touching my-web-2026.
- The integration decision can be made with real evidence (does
  iframe focus management actually hurt us? does same-origin
  create cache-poisoning risk?) instead of guesses.
- Future integration choices do not require rewriting readmark.
- No coupling of release cadences.

Negative / explicit costs:

- Some "build artefact + stable URL" tooling may be needed
  later anyway. Not built today.
- A co-hosting deployment would need a separate decision on
  cookie scoping, CSP, and IndexedDB origin. Not in this ADR.

## Integration options left on the table

These are **options**, not commitments. None is preferred today.

| Option | Pros | Cons |
| ------ | ---- | ---- |
| **Standalone app, link from my-web-2026** | Zero coupling. readmark has its own origin. Trivial to deploy. | Two bookmarks in browser; no shared chrome; user has to know they're separate. |
| **`<iframe>` embed** | Strong isolation. Sandboxing easy. Independent deploy. | Keyboard / focus / mobile viewport / Storage / clipboard costs (see Context). |
| **Same-origin co-host** (e.g. `https://my-web-2026.example/readmark/`) | No iframe costs. Shared auth if/when added. Shared cache. | Couples release / deploy. Cache-poisoning risk on upgrade. CSP becomes one policy. |
| **Web component / custom element** | Lightweight. Imports a JS module, mounts into the host DOM. | pdf.js + IndexedDB in a custom element is fiddly. Shared chrome + event surface ≠ readmark owns its UX. |

## Out of scope (still)

- A Tool Registry / catalog (my-web-2026 ADR-0008 forbids
  pre-creating one).
- A unified build / deploy orchestrator across repos.
- An iframe `sandbox` policy. Belongs to whatever integration
  shape is chosen later.
- A `postMessage` protocol. Belongs to whatever integration
  shape is chosen later.

## Re-evaluation triggers

Pick one of the integration options when **any one** of:

- Multiple Tools need to land together (then a parent-side ADR
  precedes the individual Tool decisions).
- A real Tool consumer ships and its requirements constrain
  readmark.
- A measurable user complaint lands about cross-app UX (e.g.
  "I want bookmarks in my-web-2026 too").
- 12+ months have passed and we still haven't picked one
  (probably means we don't need one).

## References

- rebuildup/my-web-2026 — ADR-0006 (Tools submodule policy,
  the *parent's* ADR; orthogonal to this one).
- rebuildup/my-web-2026 — ADR-0008 (obligation-oriented source
  architecture).
- rebuildup/my-web-2026 — `tools/README.md`.