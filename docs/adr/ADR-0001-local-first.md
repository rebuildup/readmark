# ADR-0001: Local-first reading environment

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers

## Context

readmark is a personal reading tool. It is meant to be opened, used, and
re-opened across many sittings, on the same machine, by the same person.
The user brings their own PDF/EPUB/text corpus and reads it; the app
should never be the bottleneck between the user and their documents.

There are two competing architectures for a personal reading tool:

1. **Server-backed** — the user's library lives in a database the operator
   controls. Documents are uploaded, indexed, and read through the
   network. Synced across devices is a free side effect.
2. **Local-first** — the user's library lives in the browser. The server
   (if any) is a thin sync layer that may not exist at all.

For readmark, server-backed has specific costs:

- **Trust**: every page turn ships document bytes through infrastructure
  the user doesn't control. For personal PDFs (work papers, research
  drafts, ebooks) this is a non-starter.
- **Storage cost**: hosting multi-GB document libraries for many users is
  expensive. The MVP has no business model to absorb that.
- **Latency**: every read op is a network round-trip. PDF page rendering
  is local and CPU-bound; making it remote slows the only thing the user
  cares about.
- **Offline**: server-backed means the app is unusable on a plane. For
  a reading tool, "offline" is the most common case.

Local-first also has costs (sync conflicts, quota, no device hopping),
which is why we explicitly defer sync to later.

## Decision

readmark is local-first. Specifically:

- **No server runtime.** The MVP ships as a static bundle. There is no
  API, no database, no auth, no telemetry in the default build.
- **All persistence is IndexedDB in the user's browser.** Documents,
  reading state, notes, and settings live under the app's origin.
- **Sync is opt-in, additive, and out-of-scope for MVP.** When sync
  ships (post-MVP), it will be a thin layer on top of the local-first
  core. The local-first core never depends on sync working.
- **Telemetry is off by default and disabled in the default build.**
  A future opt-in crash reporter will be a separate code path.
- **The Tool contract with my-web-2026 is local-first.** The parent
  page embeds readmark via `<iframe>` to a separately hosted
  readmark bundle. The parent page cannot read the user's library
  (cross-origin + sandboxed iframe).

## Consequences

Positive:

- The user can read on a plane.
- No server bill. No DB bill.
- No privacy review.
- Trivial deployment (static files + CDN).
- The MVP can be built without any backend language in scope.

Negative / explicit costs:

- No cross-device sync in MVP. Trade-off is intentional.
- Storage is browser-quota-bound. Mitigated by persistent-storage
  request + visible quota indicator (see ADR-0005).
- Eviction is the user's problem. Mitigated by clear UX ("you deleted
  your browser data; your files are gone").
- A subsequent server sync has to reconcile CRDT-style state. Defer.

## Alternatives considered

- **Server-backed with auth.** Rejected for MVP — see costs above.
- **P2P sync (e.g. via WebRTC + a signaling server).** Out of scope;
  revisit when sync is prioritized.
- **Hybrid: cache pages in browser, but auth-required to fetch new
  documents.** Rejected — the security/privacy model still requires
  trusting the server.

## References

- Ink & Switch — "Local-first software: You own your data, in spite of
  the cloud" (the canonical essay for this category).
- Martin Kleppmann et al. — "Local-first software: changing the
  paradigm of data ownership" (academic treatment).