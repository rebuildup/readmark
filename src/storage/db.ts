/**
 * readmark — IndexedDB schema (Dexie).
 *
 * Tables and their boundaries are documented in ADR-0005. The schema
 * is intentionally split by concept so future migrations can evolve
 * one table without rewriting the others.
 *
 * Identity model (ADR-0002 + domain/document.ts):
 *   - `documents`       keyed by `id`              (DocumentId, UUID)
 *   - `documentSources` keyed by `sourceFingerprint` (SHA-256)
 *   - `documentBlobs`   keyed by `sourceFingerprint` (SHA-256)
 *
 * Why are `documentSources` and `documentBlobs` separate tables
 * keyed by the same fingerprint?
 *   - `documentSources` is metadata: format, byteSize, pageCount,
 *     format-specific extras. Cheap to keep; indexed.
 *   - `documentBlobs` is the bytes. Big. Evictable under quota
 *     pressure (e.g. user clears site data, or browser evicts best-
 *     effort storage).
 *   - Eviction leaves the Document and its reading state intact; the
 *     user re-imports the file when they want to read again. This
 *     is the "metadata and blob are independently evictable"
 *     invariant the architecture promises.
 *
 * Reading state is keyed by (DocumentId, SourceFingerprint):
 *   - `bookmarks`, `highlights`, `notes`, `readingProgress` all carry
 *     both keys. Compound indexes enable "list all highlights on
 *     page 7 of this PDF source of this document" in one indexed
 *     read.
 *   - `FreeNote` is the exception: no sourceFingerprint, no
 *     pageIndex. Dexie permits `undefined` in compound indexes, so
 *     the row simply has its sourceFingerprint slot empty.
 *
 * MVP schema (v0): all tables exist but only `documents` /
 * `documentSources` / `documentBlobs` are read/written by the
 * import flow. Reading-state tables are declared so future tickets
 * populate them without a schema bump.
 */

import Dexie, { type EntityTable, type Table } from 'dexie';
import { IDBKeyRange as sessionIDBKeyRange, indexedDB as sessionIndexedDB } from 'fake-indexeddb';
import type {
	Document,
	DocumentId,
	DocumentSource,
	SourceFingerprint,
} from '../domain/document.ts';
import type { Bookmark, Highlight, Note, ReadingProgress } from '../domain/reading-state.ts';

/** Metadata-only Document record. The blob lives in `documentBlobs`. */
export type StoredDocument = Document;
export type StoredDocumentSource = DocumentSource;

export interface StoredDocumentBlob {
	readonly sourceFingerprint: string;
	blob: Blob;
	storedAt: number;
}

export type StoredBookmark = Bookmark;
export type StoredHighlight = Highlight;
export type StoredNote = Note;
export type StoredReadingProgress = ReadingProgress;

/** The IndexedDB database name.
 *
 *  A named constant, not `ReadmarkDatabase.name`: that reads the
 *  *class* name, which a minifier rewrites (`class bd extends Dexie`),
 *  so the recovery path would open and delete a database that does not
 *  exist. Silent, and it only shows up in a production build. */
export const DATABASE_NAME = 'readmark';

export class ReadmarkDatabase extends Dexie {
	declare documents: EntityTable<StoredDocument, 'id'>;
	declare documentSources: EntityTable<StoredDocumentSource, 'sourceFingerprint'>;
	declare documentBlobs: EntityTable<StoredDocumentBlob, 'sourceFingerprint'>;
	declare bookmarks: EntityTable<StoredBookmark, 'id'>;
	declare highlights: EntityTable<StoredHighlight, 'id'>;
	declare notes: EntityTable<StoredNote, 'id'>;
	/** Composite primary key (documentId, sourceFingerprint). */
	declare readingProgress: Table<StoredReadingProgress, [DocumentId, SourceFingerprint]>;

	constructor() {
		super(DATABASE_NAME);

		// Indexing notes (apply to every version below):
		//   - documentSources has [documentId+importedAt] so listing all
		//     sources of a Document in chronological order is a single
		//     indexed read.
		//   - bookmarks / highlights index on
		//     [documentId+sourceFingerprint+pageIndex] for the common
		//     "list all annotations on page N of this source" query.
		//   - notes also index on [documentId+kind] so listing all
		//     FreeNotes for a Document is fast (UX needs it for the
		//     "this book in general" panel).
		//   - readingProgress primary key is the composite
		//     [documentId+sourceFingerprint]: one row per source per
		//     document, written atomically.

		// v1 — the only version. The current schema.
		//
		// The identity split of ADR-0002 (`Document` / `DocumentSource`
		// / `DocumentBlob`) and the anchor model of ADR-0007.
		//
		// Why there is no declared v0 / pre-split version, even though
		// `main` shipped one. Declaring it looks helpful and is
		// actively harmful: Dexie replays EVERY declared version in
		// order on the way up, so a stale browser would be walked
		// through the pre-split schema and then asked to change its
		// primary keys on the next step — the one thing Dexie refuses:
		//
		//     UpgradeError: Not yet support for changing primary key
		//
		// Declaring the pre-split schema as v0 reproduces the bug
		// rather than fixing it.
		//
		// Why the number is 1 and not 0.1: the pre-split build declared
		// `version(0.1)`, which Dexie maps to native IndexedDB version 1.
		// A number at or below that tells Dexie a stale browser is
		// already current, so it skips the upgrade and tries to patch
		// `documents` from a `fingerprint` primary key to an `id` one in
		// place — which IndexedDB cannot do — and every query in the
		// app throws `SchemaDiff` / `Unable to patch indexes of table
		// documents`.
		//
		// What Dexie CAN do, and what every future version must
		// therefore do: add tables and indexes, leaving primary keys
		// alone. Those upgrade normally and preserve rows. Changing a
		// primary key is not migratable in Dexie at all, so a version
		// that needs one must drop the database deliberately, in
		// `recoverUnmigratableDatabase`, and say why.
		this.version(1).stores({
			documents: 'id, importedAt, lastReadAt',
			documentSources: 'sourceFingerprint, documentId, format, [documentId+importedAt]',
			documentBlobs: 'sourceFingerprint, storedAt',
			bookmarks:
				'id, documentId, sourceFingerprint, [documentId+sourceFingerprint+pageIndex], createdAt',
			highlights:
				'id, documentId, sourceFingerprint, [documentId+sourceFingerprint+pageIndex], createdAt',
			notes:
				'id, documentId, kind, sourceFingerprint, [documentId+kind], [documentId+sourceFingerprint+pageIndex], updatedAt, highlightId',
			readingProgress: '[documentId+sourceFingerprint], documentId, sourceFingerprint, updatedAt',
		});
	}
}

/** Singleton handle. Lazy-init so SSR / build-time never opens the
 *  DB. */
let _db: ReadmarkDatabase | null = null;

/**
 * Which storage backend Dexie talks to (Issue #83; found through
 * rebuildup/my-web-2026#786).
 *
 * `persistent` — the browser's own IndexedDB. Every normal launch.
 *
 * `session-only` — `fake-indexeddb`, an in-memory IndexedDB
 * implementation, installed into `Dexie.dependencies` when the real
 * one is denied. The app then works for the lifetime of the tab and
 * forgets everything on reload.
 *
 * When the real one is denied: inside `<iframe sandbox="allow-
 * scripts">` the frame runs with an opaque origin, and the browser
 * refuses every storage API to it. Measured in Chromium:
 *
 *   indexedDB.open()  -> SecurityError: access to the IndexedDB API
 *                        is denied in this context.
 *   localStorage      -> SecurityError: The document is sandboxed and
 *                        lacks the 'allow-same-origin' flag.
 *
 * The host (my-web-2026) delivers every embedded Tool under that
 * sandbox and its embed policy refuses to widen it, so "denied" is
 * the permanent shape of the embedded context, not a browser bug to
 * wait out. Note that `location.origin` cannot DETECT it: Chromium
 * reports the frame's URL origin there, not the opaque origin's
 * serialization — which is why detection below is a probe open
 * rather than a string check.
 *
 * Session-only was chosen over two honest alternatives: refusing to
 * run (the pre-#83 behaviour in the sandbox — a terminal error
 * screen, nothing usable), and rewriting every repository against
 * in-memory maps (a second storage layer kept in step with the
 * schema forever).
 *
 * What session-only is NOT: it is not persistence. The UI says so
 * on screen — `LibraryScreen` renders the notice whenever
 * `isSessionOnlyStorage()` — because local-first is the product's
 * promise, and a silent downgrade of it would be the real defect.
 */
type StorageBackend = 'persistent' | 'session-only';

let storageBackend: StorageBackend | null = null;

/** Dexie's module-load defaults, captured before any swap, so the
 *  swap-back (tests) restores the browser's own implementation
 *  rather than a stale reference. */
const PERSISTENT_INDEXED_DB = Dexie.dependencies.indexedDB;
const PERSISTENT_IDB_KEY_RANGE = Dexie.dependencies.IDBKeyRange;

/**
 * Can this context open the real database? Answers SYNCHRONOUSLY,
 * because the denial is synchronous: in a denied context
 * `indexedDB.open()` throws `SecurityError` before it can return a
 * request, so a `try/catch` around the call is the whole detection.
 *
 * The probe opens `DATABASE_NAME` itself — not a throwaway name — so
 * a normal launch leaves no litter: it opens (or, on a first launch,
 * creates at the version an open-without-version creates) the very
 * database the app is about to use anyway, and the connection is
 * closed in `onsuccess` before the decision is ever acted on.
 *
 * An async `onerror` (quota pressure, eviction) does NOT flip the
 * answer: those are not the sandbox's synchronous denial, and
 * Dexie's own open surfaces them on screen the way it always did.
 */
function canOpenPersistentDatabase(): boolean {
	if (typeof indexedDB === 'undefined') return false;
	try {
		const request = indexedDB.open(DATABASE_NAME);
		request.onsuccess = () => {
			try {
				request.result.close();
			} catch {
				// Already closed elsewhere; nothing left to release.
			}
		};
		// Not a verdict: an async open error is reported by Dexie's own
		// open, with its reader-facing message.
		request.onerror = () => {};
		request.onblocked = () => {};
		return true;
	} catch {
		return false;
	}
}

/** Point Dexie at the in-memory implementation. Idempotent. */
function installSessionOnlyBackend(): void {
	if (storageBackend === 'session-only') return;
	storageBackend = 'session-only';
	Dexie.dependencies.indexedDB = sessionIndexedDB;
	Dexie.dependencies.IDBKeyRange = sessionIDBKeyRange;
}

function ensureStorageBackend(): StorageBackend {
	if (storageBackend !== null) return storageBackend;
	if (canOpenPersistentDatabase()) {
		storageBackend = 'persistent';
		return storageBackend;
	}
	installSessionOnlyBackend();
	return 'session-only';
}

/**
 * Is the app running against the in-memory backend? This is the
 * one-line truth for "will what I do here survive a reload?" — the
 * library screen renders its notice from it.
 */
export function isSessionOnlyStorage(): boolean {
	return ensureStorageBackend() === 'session-only';
}

/** Test-only: forget the backend decision, drop the singleton and
 *  restore Dexie's defaults. Production code never calls this — the
 *  same contract `_resetPersistenceRequestFlag` keeps in
 *  `persistent-storage.ts`. */
export function _resetStorageBackendForTests(): void {
	storageBackend = null;
	_db = null;
	Dexie.dependencies.indexedDB = PERSISTENT_INDEXED_DB;
	Dexie.dependencies.IDBKeyRange = PERSISTENT_IDB_KEY_RANGE;
}

export function getDb(): ReadmarkDatabase {
	ensureStorageBackend();
	if (!_db) {
		_db = new ReadmarkDatabase();
	}
	return _db;
}

/** Primary keys the pre-split schema used, per table.
 *
 *  The detection table for `recoverUnmigratableDatabase`, and a
 *  deliberate duplicate of what `main` shipped: that schema is NOT
 *  declared as a Dexie version, because declaring it makes Dexie replay
 *  it on the way up and then refuse the primary-key change. Recovery
 *  reads the installed key paths straight from IndexedDB instead, so it
 *  never depends on Dexie being openable. */
const PRE_SPLIT_PRIMARY_KEYS: Readonly<Record<string, string>> = {
	documents: 'fingerprint',
	documentBlobs: 'fingerprint',
	readingProgress: 'documentFingerprint',
};

function openRawDatabase(name: string): Promise<IDBDatabase | null> {
	return new Promise((resolve) => {
		const request = indexedDB.open(name);
		request.onsuccess = () => resolve(request.result);
		// A database we cannot open is not one we can migrate, and it
		// is not one this function can fix. `null` means "no opinion".
		request.onerror = () => resolve(null);
		request.onblocked = () => resolve(null);
	});
}

/** How long to wait for the delete to land before reporting failure.
 *
 *  `blocked` is a notification, not a verdict: it fires while some
 *  other connection to the database is still open, and the delete
 *  completes as soon as that connection closes. Waiting is therefore
 *  the right response to it — and the only safe one, because
 *  `IDBDatabase.close()` returns before the connection is actually
 *  closed (it waits for outstanding transactions), so our *own* just-
 *  closed handle can raise `blocked` on a perfectly healthy run.
 *  Failing on `blocked` would reject the normal case.
 *
 *  The wait is bounded because the request otherwise never settles at
 *  all, and a blank page is a worse outcome than an error the reader
 *  can act on. `main.tsx` turns a rejection into a terminal render
 *  that tells them to close other tabs and reload. */
const DELETE_TIMEOUT_MS = 5_000;

/**
 * Clear a database Dexie cannot upgrade, so the app becomes usable.
 *
 * ## Why this exists
 *
 * `main` shipped the pre-split schema, keying `documents`,
 * `documentBlobs` and `readingProgress` by `fingerprint` /
 * `documentFingerprint`. ADR-0002 re-keys them by `id` /
 * `sourceFingerprint` / `[documentId+sourceFingerprint]`.
 *
 * IndexedDB cannot change a store's primary key, and Dexie refuses the
 * upgrade outright rather than dropping the store:
 *
 *     UpgradeError: Not yet support for changing primary key
 *
 * The failure is total and permanent — every query in the app throws,
 * so the library renders empty, import cannot land, and no number of
 * reloads helps. A user who ran the app on `main` and then switched to
 * this branch hits a dead app they cannot recover from, because the
 * damaged database is invisible from the UI.
 *
 * ## Why not declare the pre-split schema as a Dexie version
 *
 * It looks like the tidy fix and it is not. Dexie replays every
 * declared version in order while upgrading, so declaring the pre-split
 * schema walks a stale browser straight into the primary-key change it
 * was supposed to help with, and fails with the same error. The schema
 * is therefore recognised here, by reading the installed key paths,
 * rather than by being declared.
 *
 * ## Why deleting is the right repair
 *
 * The pre-split build's import button was permanently disabled, so it
 * could not have written a row anyone would miss. And its identity
 * model is precisely what ADR-0002 replaced, so no row translates
 * faithfully into the new three-table shape. An empty library the user
 * refills by re-importing beats half-converted rows.
 *
 * ## What it does NOT do
 *
 * It does not touch a database that is merely *behind* — one that only
 * needs added tables or indexes. Those upgrade normally and keep their
 * rows; see `db.test.ts`.
 *
 * Idempotent, and a no-op when there is no database at all.
 */
export async function recoverUnmigratableDatabase(): Promise<boolean> {
	if (typeof indexedDB === 'undefined') return false;

	let existing: IDBDatabase | null;
	try {
		existing = await openRawDatabase(DATABASE_NAME);
	} catch (err) {
		// A denied context (sandboxed opaque origin — Issue #83) makes
		// `indexedDB.open()` throw `SecurityError` synchronously inside
		// the promise executor, and the promise turns that into a
		// rejection. There is no persistent database to inspect or
		// repair there: the app runs session-only instead (see
		// `ensureStorageBackend`), so this is `false`, not a failure.
		// `main.tsx` mounts the app on a resolved promise, and a
		// terminal error screen for a context that can still read (in
		// memory) would be the wrong verdict.
		if (err instanceof DOMException && err.name === 'SecurityError') {
			installSessionOnlyBackend();
			return false;
		}
		throw err;
	}
	if (!existing) return false;

	// Read the installed primary keys straight from the object stores.
	// Opening at the *current* version (no version argument) is
	// deliberate: passing a higher version would fire `upgradeneeded`
	// and put us back inside the failure we are recovering from.
	let isPreSplit = false;
	try {
		for (const [table, preSplitKeyPath] of Object.entries(PRE_SPLIT_PRIMARY_KEYS)) {
			if (!existing.objectStoreNames.contains(table)) continue;
			const keyPath = existing.transaction(table, 'readonly').objectStore(table).keyPath;
			if (keyPath === preSplitKeyPath) {
				isPreSplit = true;
				break;
			}
		}
	} finally {
		existing.close();
	}

	// Not the one unrepairable shape → leave the user's data alone.
	if (!isPreSplit) return false;

	// Release our own connection *before* asking for the delete.
	//
	// A `deleteDatabase` request is blocked by every open connection to
	// the database, and ours is one of them. Issuing the delete first
	// means the request sits waiting on this very module to do the thing
	// that unblocks it — which is the state the old code was in, and is
	// why resolving on `blocked` used to appear to work. Closing first
	// also drops a handle that would throw `DatabaseClosedError` if
	// anything reopened it once the database was gone.
	_db?.close();
	_db = null;

	// Three outcomes, and they are not the same. Resolving on all of
	// them claimed a repair that may not have happened, and `main.tsx`
	// mounts the app on a resolved promise — so a failed delete led
	// straight into the `UpgradeError` this function exists to prevent.
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(DATABASE_NAME);
		const timer = setTimeout(() => {
			reject(
				new Error(
					`readmark: the unrecoverable database was still not deleted after ${DELETE_TIMEOUT_MS}ms; another tab is probably holding it open`,
				),
			);
		}, DELETE_TIMEOUT_MS);
		request.onsuccess = () => {
			clearTimeout(timer);
			resolve();
		};
		request.onerror = () => {
			clearTimeout(timer);
			reject(
				request.error ?? new Error('readmark: the unrecoverable database could not be deleted'),
			);
		};
		// `onblocked` is intentionally left unhandled. It reports that
		// the delete is waiting on a connection, not that it failed, and
		// the timeout above is the bound on that wait. See
		// `DELETE_TIMEOUT_MS`.
	});

	return true;
}
