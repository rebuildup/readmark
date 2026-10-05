/**
 * Locks the IndexedDB schema-version discipline.
 *
 * ## The failure this prevents
 *
 * `main` shipped a schema keying `documents`, `documentBlobs` and
 * `readingProgress` by `fingerprint` / `documentFingerprint`. ADR-0002
 * re-keys them by `id` / `sourceFingerprint` /
 * `[documentId+sourceFingerprint]`. IndexedDB cannot change a store's
 * primary key, and Dexie refuses such an upgrade outright:
 *
 *     UpgradeError: Not yet support for changing primary key
 *
 * The result is a permanently broken app in any browser that ran the
 * old build: every query throws, the library is empty, import cannot
 * land, and reloading does not help.
 *
 * The tempting fixes all fail, and each was tried against Dexie 4.4
 * before being ruled out:
 *
 *   - Re-declare the pre-split schema as a lower Dexie version, so
 *     Dexie "knows" about it. This REPRODUCES the bug: Dexie replays
 *     every declared version while upgrading, so the stale browser is
 *     walked through the pre-split schema and then asked to change its
 *     primary keys on the next step.
 *   - Insert an empty version between them. Also fails: `.stores()` is
 *     cumulative, so a later block merges into the earlier one and the
 *     primary-key change is still in the final diff.
 *   - Bump the version number alone. Correct, and still not sufficient
 *     on its own — the pre-split database has to be discarded, which is
 *     what `recoverUnmigratableDatabase` does.
 *
 * These assertions encode the three rules that came out of that: only
 * one version is declared, the recovery recognises the old shape by
 * primary key, and it recognises nothing else.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DATABASE_NAME, getDb, ReadmarkDatabase, recoverUnmigratableDatabase } from './db.ts';

describe('ReadmarkDatabase schema', () => {
	it('declares exactly one version', () => {
		// More than one is not automatically wrong — additive versions
		// are the supported migration path. But every extra version
		// widens the set of primary keys Dexie is asked to reconcile, so
		// the count is asserted to make the decision deliberate rather
		// than incidental.
		expect(new ReadmarkDatabase().verno).toBe(1);
	});

	it('keys documents by id, not by the pre-split fingerprint', () => {
		const db = new ReadmarkDatabase();
		expect(db.tables.map((t) => t.name).sort()).toEqual([
			'bookmarks',
			'documentBlobs',
			'documentSources',
			'documents',
			'highlights',
			'notes',
			'readingProgress',
		]);
	});

	it('keys readingProgress by the composite (document, source) pair', () => {
		// The pre-split schema used a bare `documentFingerprint` here.
		// A regression to that shape is exactly what makes the database
		// unmigratable, so the composite key is asserted directly.
		const db = new ReadmarkDatabase();
		const table = db.tables.find((t) => t.name === 'readingProgress');
		expect(table?.schema.primKey.keyPath).toEqual(['documentId', 'sourceFingerprint']);
	});

	it('uses a literal database name, not the minified class name', () => {
		// `ReadmarkDatabase.name` is the CLASS name, which a production
		// minifier rewrites. The recovery path must never use it: it
		// would open and delete a database that does not exist, and
		// only in a production build.
		expect(DATABASE_NAME).toBe('readmark');
	});
});

/**
 * Every index a repository actually reads has to be declared.
 *
 * The failure is not a wrong answer, which is what makes it worth a
 * test. Dexie can serve a compound equality on `[a+b]` off two
 * single-column indexes with a filter over the result, so a repository
 * reading an undeclared prefix still returns the right rows — it just
 * narrows the read to a whole document where the question was about
 * one source of it, and gets worse with every row the document
 * accumulates. That is invisible in a unit test with a faked database
 * and invisible in a small fixture, so the index list is pinned here
 * instead: this is the only place that knows both halves, the schema
 * and the queries.
 *
 * ## The pre-existing gap, deliberately not pinned
 *
 * `bookmarks` and `highlights` both declare
 * `[documentId+sourceFingerprint+pageIndex]` and are read with
 * `[documentId+sourceFingerprint]` by `listBookmarks` /
 * `listHighlights` — the same shape, and it predates `notes`. It is
 * reported as a defect rather than asserted here, because a test that
 * fails when someone *fixes* the schema is a test that has to be
 * deleted in the same commit that fixes the thing, which is how tests
 * end up asserting that a bug is still present.
 */
describe('declared indexes', () => {
	/** Every `where(...)` index the notes repository reads. */
	const NOTES_INDEXES = [
		'[documentId+kind]',
		'[documentId+sourceFingerprint+pageIndex]',
		'highlightId',
	] as const;

	function declared(tableName: string): string[] {
		const table = new ReadmarkDatabase().tables.find((candidate) => candidate.name === tableName);
		const schema = table?.schema as { indexes?: readonly { name: string }[] } | undefined;
		return (schema?.indexes ?? []).map((index) => index.name);
	}

	it.each(NOTES_INDEXES)('notes declares %s, which the notes repository reads', (index) => {
		expect(declared('notes')).toContain(index);
	});

	it('declares no notes index the repository does not read', () => {
		// The other direction. An index nothing queries is a write the
		// reader pays for on every note, and it is invisible from the
		// repository — this is the only place both are visible.
		expect(declared('notes').sort()).toEqual(
			[
				'[documentId+kind]',
				'[documentId+sourceFingerprint+pageIndex]',
				'documentId',
				'highlightId',
				'kind',
				'sourceFingerprint',
				'updatedAt',
			].sort(),
		);
	});
});

describe('recoverUnmigratableDatabase', () => {
	it('is a no-op without IndexedDB rather than throwing', async () => {
		// The function runs before the app mounts. Throwing here would
		// replace a readable message with a blank page, so the
		// no-IndexedDB path must return false.
		const original = globalThis.indexedDB;
		// @ts-expect-error — deliberately removing the global to exercise the guard.
		delete globalThis.indexedDB;
		try {
			await expect(recoverUnmigratableDatabase()).resolves.toBe(false);
		} finally {
			globalThis.indexedDB = original;
		}
	});
});

/**
 * How the delete ends. `blocked-forever` is the case the browser
 * produces when another tab keeps a connection open: the request never
 * settles, so it is the only one that can hang.
 */
type DeleteOutcome = 'success' | 'error' | 'blocked-forever';

/** The primary keys `main` shipped, which is what makes the recovery
 *  fire at all. */
const PRE_SPLIT_KEY_PATHS: Readonly<Record<string, string>> = {
	documents: 'fingerprint',
	documentBlobs: 'fingerprint',
	readingProgress: 'documentFingerprint',
};

/** The subset of `IDBRequest` the recovery touches. */
interface FakeRequest {
	onsuccess?: (() => void) | null;
	onerror?: (() => void) | null;
	onblocked?: (() => void) | null;
	result?: unknown;
	error?: unknown;
}

/**
 * A fake `indexedDB` that reports the given schema and lets the test
 * choose how the delete ends, recording an ordered event log.
 *
 * Callbacks are fired on a microtask, not a timer: the recovery assigns
 * its handlers inside the promise executor, so anything later than that
 * is safe, and microtasks stay real under fake timers.
 */
function installFakeIndexedDB(options: {
	readonly keyPaths: Readonly<Record<string, string>>;
	readonly outcome: DeleteOutcome;
	readonly events: string[];
}): void {
	const { keyPaths, outcome, events } = options;
	vi.stubGlobal('indexedDB', {
		open: (): FakeRequest => {
			const request: FakeRequest = {
				result: {
					objectStoreNames: { contains: (table: string) => table in keyPaths },
					transaction: (table: string) => ({
						objectStore: () => ({ keyPath: keyPaths[table] }),
					}),
					close: () => {
						events.push('raw-close');
					},
				},
			};
			queueMicrotask(() => {
				request.onsuccess?.();
			});
			return request;
		},
		deleteDatabase: (): FakeRequest => {
			events.push('delete-requested');
			const request: FakeRequest =
				outcome === 'error' ? { error: new Error('delete refused') } : {};
			if (outcome === 'success') {
				queueMicrotask(() => {
					request.onsuccess?.();
				});
			} else if (outcome === 'error') {
				queueMicrotask(() => {
					request.onerror?.();
				});
			} else {
				// `blocked` fires, and then nothing. This is the shape
				// that used to resolve as a success.
				queueMicrotask(() => {
					request.onblocked?.();
				});
			}
			return request;
		},
	});
}

describe('recoverUnmigratableDatabase / how the delete ends', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('resolves true when the delete lands', async () => {
		const events: string[] = [];
		installFakeIndexedDB({ keyPaths: PRE_SPLIT_KEY_PATHS, outcome: 'success', events });
		await expect(recoverUnmigratableDatabase()).resolves.toBe(true);
		expect(events).toContain('delete-requested');
	});

	it('rejects when the delete fails instead of claiming the repair', async () => {
		// The whole point: `main.tsx` mounts the app on a resolved
		// promise, so resolving here after a failed delete walks the
		// reader straight back into the `UpgradeError` this function
		// exists to prevent — with the app apparently healthy until the
		// first query throws.
		const events: string[] = [];
		installFakeIndexedDB({ keyPaths: PRE_SPLIT_KEY_PATHS, outcome: 'error', events });
		await expect(recoverUnmigratableDatabase()).rejects.toThrow('delete refused');
	});

	it('gives up on a delete that stays blocked', async () => {
		// `blocked` is a notification, not a verdict — the delete lands
		// when the other tab closes. But the request never settles on its
		// own, and an unsettled promise means `main.tsx` never renders at
		// all, which is worse than a message the reader can act on.
		vi.useFakeTimers();
		const events: string[] = [];
		installFakeIndexedDB({ keyPaths: PRE_SPLIT_KEY_PATHS, outcome: 'blocked-forever', events });
		const recovery = recoverUnmigratableDatabase();
		// Attached before advancing so the rejection is never unhandled.
		const settled = expect(recovery).rejects.toThrow(/still not deleted after/);
		await vi.advanceTimersByTimeAsync(10_000);
		await settled;
	});

	it('closes its own connection before asking for the delete', async () => {
		// A `deleteDatabase` request is blocked by every open connection,
		// including this module's cached handle. Requesting the delete
		// first means the request waits on this module to do the thing
		// that unblocks it — and it also drops a handle that would throw
		// `DatabaseClosedError` if anything reopened it afterwards.
		const events: string[] = [];
		installFakeIndexedDB({ keyPaths: PRE_SPLIT_KEY_PATHS, outcome: 'success', events });
		const handle = getDb();
		vi.spyOn(handle, 'close').mockImplementation(() => {
			events.push('own-close');
		});

		await recoverUnmigratableDatabase();

		expect(events).toContain('own-close');
		expect(events.indexOf('own-close')).toBeLessThan(events.indexOf('delete-requested'));
	});

	it('leaves a database it does not recognise completely alone', async () => {
		// Deleting is irreversible. The only shape it is allowed to
		// touch is the one it can name.
		const events: string[] = [];
		installFakeIndexedDB({
			keyPaths: { documents: 'id', readingProgress: 'documentId' },
			outcome: 'success',
			events,
		});
		await expect(recoverUnmigratableDatabase()).resolves.toBe(false);
		expect(events).not.toContain('delete-requested');
	});
});
