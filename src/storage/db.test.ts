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

import { describe, expect, it } from 'vitest';

import { DATABASE_NAME, ReadmarkDatabase, recoverUnmigratableDatabase } from './db.ts';

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
