/**
 * readmark — in-memory session store (ADR-0008).
 *
 * The single place this app keeps data. Everything a reader does —
 * the imported document's bytes, the library's metadata, and the
 * reading state (position, bookmarks, highlights) — lives in
 * module-level `Map`s that die with the tab.
 *
 * Why there is no database (ADR-0008, owner decision 2026-11-02):
 * the storage requirement itself was removed rather than satisfied.
 * A document is imported for the current session, rendered, and
 * re-imported when the reader wants it again; the UI says that in
 * one line. This is not a fallback for a hostile environment — an
 * embedded (sandboxed, opaque-origin) frame denies every browser
 * storage API outright, and the decision was to stop depending on
 * storage at all instead of patching around that constraint.
 *
 * What survives from the old persistence layer: the *shape* of the
 * data (ADR-0002's identity model — Document / DocumentSource /
 * DocumentBlob split, reading state keyed by
 * (DocumentId, SourceFingerprint)) and every repository's public
 * signature, so no call site outside `storage/` changed. What does
 * not survive: the database, the browser's storage APIs, schema
 * versions, upgrades, quota, and recovery — none of those concepts
 * exist in a session store.
 *
 * Single-threaded by construction: JavaScript runs one job at a
 * time, so a "transaction" here is just synchronous code between
 * two awaits — there is no interleaving to serialise and no
 * cross-tab race to defend against. The repositories keep their
 * `async` signatures because their callers await them.
 */

import type {
	Document,
	DocumentId,
	DocumentSource,
	SourceFingerprint,
} from '../domain/document.ts';
import type { Bookmark, Highlight, ReadingProgress } from '../domain/reading-state.ts';

/** The bytes of one imported source, held for the session. */
export interface SessionBlob {
	readonly sourceFingerprint: SourceFingerprint;
	readonly blob: Blob;
	readonly storedAt: number;
}

interface SessionStore {
	/** Keyed by `Document.id`. */
	readonly documents: Map<DocumentId, Document>;
	/** Keyed by `SourceFingerprint` (the physical identity). */
	readonly documentSources: Map<SourceFingerprint, DocumentSource>;
	/** Keyed by `SourceFingerprint`, same as the source above. */
	readonly documentBlobs: Map<SourceFingerprint, SessionBlob>;
	/** Keyed by `Bookmark.id` / `Highlight.id` (plain UUIDs). */
	readonly bookmarks: Map<string, Bookmark>;
	readonly highlights: Map<string, Highlight>;
	/** Keyed by {@link readingProgressKey}. */
	readonly readingProgress: Map<string, ReadingProgress>;
}

/** The one store. Exported as a const so repositories share it and
 *  tests can clear it through `_resetSessionStoreForTests` without
 *  reaching into module-private state. */
export const sessionStore: SessionStore = {
	documents: new Map(),
	documentSources: new Map(),
	documentBlobs: new Map(),
	bookmarks: new Map(),
	highlights: new Map(),
	readingProgress: new Map(),
};

/** Composite key for the one-row-per-(document, source) table.
 *
 *  The pair is one logical key (ADR-0002), so it is joined with a
 *  separator that cannot appear in either branded string: a UUID and
 *  a SHA-256 hex are both `[0-9a-f-]` only, so `\u0000` can never
 *  collide with document content. */
export function readingProgressKey(
	documentId: DocumentId,
	sourceFingerprint: SourceFingerprint,
): string {
	return `${documentId}\u0000${sourceFingerprint}`;
}

/** Test-only: empty the store. Production code never calls this —
 *  the store's lifetime IS the tab, and clearing it mid-session
 *  would silently delete a reader's documents. */
export function _resetSessionStoreForTests(): void {
	sessionStore.documents.clear();
	sessionStore.documentSources.clear();
	sessionStore.documentBlobs.clear();
	sessionStore.bookmarks.clear();
	sessionStore.highlights.clear();
	sessionStore.readingProgress.clear();
}

/**
 * Smoke seam (`scripts/smoke-*.mjs`).
 *
 * The smokes drive the built app in a real browser and assert on
 * storage — row counts after a delete cascade, the row a debounced
 * scroll wrote — and with no database on disk there is no external
 * handle left to read. Exposing THIS realm's store under a named
 * global hands the page's own scripts a direct pointer to the
 * memory the app already runs on: no new authority (anything
 * executing in the page shares the realm with the app), just a
 * stable name instead of an accident. The smokes resolve it as
 * `globalThis.readmarkSessionStore` after the app bundle has
 * loaded.
 *
 * Deliberately NOT gated on dev mode: the smokes run against the
 * production build (`bun run build` → preview), and a seam that
 * vanishes there would make every smoke test a different program
 * than the one shipped.
 */
interface SmokeSeam {
	readmarkSessionStore?: typeof sessionStore;
}

(globalThis as SmokeSeam).readmarkSessionStore ??= sessionStore;
