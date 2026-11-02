# ADR-0008: Session-scoped storage — no browser persistence

- Status: Accepted
- Date: 2026-11-02
- Deciders: owner (rebuildup), recorded through rebuildup/my-web-2026#786

## Context

Two facts met:

1. **The embedded delivery context denies storage.** readmark ships as
   an embedded Tool inside rebuildup/my-web-2026, whose shell renders
   it in an `<iframe sandbox="allow-scripts">`. That gives the framed
   document an opaque origin. Measured in Chromium on 2026-11-02:
   `indexedDB.open()` throws
   `SecurityError: … access to the Indexed Database API is denied in this context.`
   and `localStorage` throws
   `SecurityError: … The document is sandboxed and lacks the 'allow-same-origin' flag.`
   The same entry HTML opened without the sandbox uses storage
   normally — the denial is a property of the context, not of the
   file.

2. **The requirement itself was judged wrong.** The first response
   (readmark Issue #83 / PR #84, both closed) kept persistence and
   fell back to an in-memory IndexedDB implementation when the real
   one was denied. The owner rejected that: *the storage requirement
   should not exist in the first place; that is a UX problem, not a
   sandbox problem, and patching around the sandbox constraint is
   catering to the constraint.* The owner's standing position is the
   same one from the start — an IndexedDB-based configuration was
   never needed — and the redesign had to make the tool work with no
   browser storage: import / render for the current session,
   re-import when needed, with the UI stating that model in one
   line.

The host is moving Tool delivery to first-party same-origin without a
sandbox (my-web-2026 ADR-0020, PR #845). That would make storage
*available* again — and is deliberately **not** a premise of this
ADR: the decision below is correct whether or not the sandbox exists,
because it removes the requirement instead of satisfying it.

## Decision

1. **No browser storage, at all.** `dexie`, `indexedDB` and
   `navigator.storage` are removed from the codebase. Document bytes,
   document metadata and reading state (position, bookmarks,
   highlights, notes) live in a single per-tab in-memory store
   (`src/storage/session-store.ts`), whose lifetime is the tab.
2. **The session is the unit of keeping.** A document is imported
   for the current session, rendered, and re-imported when the
   reader wants it again. The library screen states this in one line
   before the reader imports anything — not after a reload has
   already lost the file.
3. **Zero third-party contact.** The Google Fonts links in
   `index.html` are removed; the font stacks name the machine's own
   faces. The tool fetches nothing from any origin.
4. **The repository signatures do not change.** `listLibrary`,
   `importDocument`, `addBookmark`, … keep their shapes, backed by
   maps instead of tables, so no call site outside `src/storage/`
   changes and the identity rules of ADR-0002 (Document /
   DocumentSource / DocumentBlob split, reading state keyed by
   `(DocumentId, SourceFingerprint)`) survive untouched.

## Consequences

- **One code path, everywhere.** Sandboxed frame, direct open, tests
  — the same store, the same behaviour. Schema versions, upgrades,
  quota handling, `QuotaExceededError`, the recovery gate in
  `main.tsx` and the quota badge are gone because their preconditions
  are gone.
- **The local-first promise becomes exactly true** (ADR-0001):
  nothing ever leaves the device, and nothing claims to outlive the
  tab. What is lost is the *silent* part — durability was never
  observable until a reload proved it.
- **Reload starts an empty library, by design.** The one-line notice
  makes that a stated model rather than a surprise.
- **A machine with no installed CJK font renders tofu.** The webfont
  that prevented that was a third-party fetch; removing it (owner
  decision, 2026-11-02) accepts this cost.
- **Cross-tab sharing cannot exist.** Two tabs are two stores. The
  write races the old tests staged through a database fake ("another
  tab deletes the row between decision and write") were removed with
  their premise; the honest-failure cases (row absent → `false`)
  remain.
- **Issue #10's acceptance criteria** (quota pre-flight, persistence
  request after import) are superseded with the code that implemented
  them.

## Supersedes / amends

- **ADR-0005** (IndexedDB persistence strategy) — its decision no
  longer holds; status flipped to Superseded.
- **ADR-0001** (local-first) — the locality half (no server, no
  network, trust, latency) is unchanged and is strengthened here;
  the sentence "all persistence is IndexedDB in the user's browser"
  is replaced by this ADR's session-scoped model.

## Not decided here

- What happens when a future format (EPUB / Markdown / text) or a
  future feature genuinely needs durability (e.g. cross-session
  annotations). That would be a new ADR with its own context, not a
  silent reintroduction of a database.
