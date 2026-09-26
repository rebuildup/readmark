# ADR-0005: IndexedDB persistence strategy

- Status: Accepted
- Date: 2026-09-26
- Deciders: readmark maintainers

## Context

readmark persists three categories of data:

1. **Document bytes** (Blobs, potentially multi-hundred-MB each).
2. **Document metadata** (small structured records).
3. **Reading state** (bookmarks, highlights, notes, progress — small
   structured records keyed by document fingerprint).

All three live in IndexedDB. The choices to lock down:

- **Wrapper library.** Raw IndexedDB is verbose; `idb` is small but
  no schema versioning; Dexie gives typed tables, declarative
  versioning, indexed queries, and good ergonomics. Bundle cost is
  ~29 KB minified.
- **Schema split.** One mega-store mixes concerns and prevents
  per-table migrations. Splitting tables by concept (documents /
  blobs / reading state) lets one table evolve without rewriting the
  others.
- **Storage quota and eviction.** Browsers cap IndexedDB at a
  fraction of disk; Chrome at ~60% of total disk, Firefox at 10% (or
  10 GiB, whichever is smaller) for best-effort storage. We need a
  strategy for the user hitting quota.
- **Persistent storage.** Without `navigator.storage.persist()` the
  browser may evict the origin under disk pressure. With it,
  eviction is user-only.
- **Compound indexes.** Reading-state tables are queried as
  "all bookmarks for document X" and "all highlights on page P of
  document X". A `[documentFingerprint+pageIndex]` compound index
  serves both with one read.

## Decision

Use **Dexie** as the IndexedDB wrapper. Schema v0 (in
`src/storage/db.ts`) is:

```
documents:        'fingerprint, format, importedAt, lastReadAt'
documentBlobs:    'fingerprint, storedAt'
bookmarks:        'id, documentFingerprint, [documentFingerprint+pageIndex], createdAt'
highlights:       'id, documentFingerprint, [documentFingerprint+pageIndex], createdAt'
notes:            'id, documentFingerprint, [documentFingerprint+pageIndex], updatedAt, highlightId'
readingProgress:  'documentFingerprint, updatedAt'
```

Storage discipline:

- **`documentBlobs` is its own table** so we can evict it without
  losing reading state. The `documents` table holds metadata; the
  blob is fetched lazily from `documentBlobs` on read.
- **Compound indexes** are scoped per-document for fast page-scoped
  queries.
- **`navigator.storage.persist()` is requested once per session**
  after the first successful document import. This is the moment
  the browser is most likely to grant persistent storage.
- **`navigator.storage.estimate()` is read at Library mount** and
  the UI surfaces `(usage / quota)` near the import button.
- **No PII in IndexedDB keys.** Fingerprints are content hashes,
  not file paths.

Migration policy:

- Dexie's `db.version(n).stores({...})` is the migration tool.
- Reading-state schema changes go in their own version bump; they
  do not require re-importing documents.
- Blob eviction does not delete reading state. The "missing document"
  UX (orphan highlights) is a separate ADR candidate.

## Consequences

Positive:

- Schema is declarative; migrations are diffable.
- Indexed queries are O(log n) per-table.
- Blob eviction can happen independently of metadata.
- The persistent-storage dance is centralized in
  `src/platform/persistent-storage.ts`.

Negative / explicit costs:

- Dexie adds ~29 KB to the bundle. Acceptable vs. raw IDB pain.
- Schema migrations require careful version bumps; quality gate
  has a ticket for "schema-migration test" once v1 ships.
- The "orphan highlights" UX is unaddressed. Deferred to a follow-up.

## Alternatives considered

- **Raw IndexedDB.** Rejected — verbose; would re-implement Dexie.
- **`idb` (Jake Archibald's tiny wrapper).** Rejected — no
  declarative schema versioning; we'd write migration code by hand.
- **`localForage`.** Rejected — key-value API; loses indexed queries.
- **OPFS (Origin Private File System) for blobs.** Considered; OPFS
  gives filesystem semantics on top of IDB. Deferred — would help
  with very large corpora, but adds a second storage surface to
  reason about. Revisit when corpus > 5 GB becomes a real complaint.

## References

- MDN — Storage quotas and eviction criteria.
- MDN — StorageManager.persist() / persisted().
- Dexie docs — schema versioning, compound indexes, Blob storage.