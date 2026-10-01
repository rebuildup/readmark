/**
 * Unit tests for the reading-progress repository.
 *
 * `getDb` is faked with a table that behaves like Dexie's for the
 * operations this repository uses (a `Map` keyed by the composite
 * primary key). The repo has no `fake-indexeddb`, and a real IndexedDB
 * would not add evidence here anyway: what is under test is the key
 * discipline — the pair in the right order, the upsert replacing
 * rather than accumulating — and the row shape the UI relies on. The
 * end-to-end claim (a scroll really writes a row, a reopen really
 * restores it) is `scripts/smoke-reader.mjs`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { asDocumentId, asSourceFingerprint, type DocumentId } from '../domain/document.ts';
import { asPageIndex } from '../domain/reading-state.ts';

const rows = new Map<string, unknown>();
const putCalls: unknown[] = [];

function key(documentId: DocumentId, fingerprint: string): string {
	return `${documentId}|${fingerprint}`;
}

vi.mock('./db.ts', () => {
	let inflight: Promise<unknown> = Promise.resolve();
	return {
		getDb: () => ({
			readingProgress: {
				get: async ([documentId, fingerprint]: [DocumentId, string]) =>
					rows.get(key(documentId, fingerprint)) ?? undefined,
				put: async (row: { documentId: DocumentId; sourceFingerprint: string }) => {
					putCalls.push(row);
					rows.set(key(row.documentId, row.sourceFingerprint), row);
					return row.sourceFingerprint;
				},
				delete: async ([documentId, fingerprint]: [DocumentId, string]) => {
					// Dexie 4 types `Table.delete` as `void`.
					rows.delete(key(documentId, fingerprint));
				},
			},
			transaction: async <T>(_mode: string, _tables: unknown, fn: () => Promise<T>) => {
				// Serialise concurrent transactions on this table so
				// the delete-vs-save race resolves deterministically.
				const result = inflight.then(async () => await fn());
				inflight = result.catch(() => undefined);
				return result;
			},
		}),
	};
});

const { deleteReadingProgress, getReadingProgress, saveReadingPosition } = await import(
	'./reading-state-repo.ts'
);

const DOC_A = asDocumentId('00000000-0000-4000-8000-00000000000a');
const DOC_B = asDocumentId('00000000-0000-4000-8000-00000000000b');
const FINGERPRINT_A = asSourceFingerprint('a'.repeat(64));
const FINGERPRINT_B = asSourceFingerprint('b'.repeat(64));

beforeEach(() => {
	rows.clear();
	putCalls.length = 0;
});

describe('getReadingProgress', () => {
	it('is null for a source that was never opened', async () => {
		expect(
			await getReadingProgress({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A }),
		).toBeNull();
	});

	it('is keyed by the pair, not by the document alone', async () => {
		await saveReadingPosition({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			currentPage: asPageIndex(12),
			position: { pageOffsetRatio: 0.5 },
		});

		// The same document with different bytes keeps its own position:
		// page 47 of one PDF is not page 47 of another.
		expect(
			await getReadingProgress({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_B }),
		).toBeNull();
		// And a different document with the same bytes is a different
		// row, even though the fingerprint matches.
		expect(
			await getReadingProgress({ documentId: DOC_B, sourceFingerprint: FINGERPRINT_A }),
		).toBeNull();
	});
});

describe('saveReadingPosition', () => {
	it('writes the row the contract describes', async () => {
		await saveReadingPosition({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			currentPage: asPageIndex(3),
			position: { pageOffsetRatio: 0.25 },
		});

		const stored = await getReadingProgress({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
		});
		expect(stored).toMatchObject({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			currentPage: 3,
			position: { pageOffsetRatio: 0.25 },
		});
		// `updatedAt` is a storage concern; a row without it could
		// never be ordered by recency.
		expect(typeof stored?.updatedAt).toBe('number');
	});

	it('replaces the row for the same pair instead of accumulating', async () => {
		const params = {
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			position: null,
		};
		await saveReadingPosition({ ...params, currentPage: asPageIndex(1) });
		await saveReadingPosition({ ...params, currentPage: asPageIndex(9) });

		expect(rows.size).toBe(1);
		expect(
			(
				await getReadingProgress({
					documentId: DOC_A,
					sourceFingerprint: FINGERPRINT_A,
				})
			)?.currentPage,
		).toBe(9);
	});

	it('keeps two sources of one document apart', async () => {
		await saveReadingPosition({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			currentPage: asPageIndex(2),
			position: null,
		});
		await saveReadingPosition({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_B,
			currentPage: asPageIndex(30),
			position: null,
		});

		expect(rows.size).toBe(2);
		expect(
			(
				await getReadingProgress({
					documentId: DOC_A,
					sourceFingerprint: FINGERPRINT_B,
				})
			)?.currentPage,
		).toBe(30);
	});

	it('passes a null position through untouched', async () => {
		await saveReadingPosition({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			currentPage: asPageIndex(4),
			position: null,
		});
		expect(
			(
				await getReadingProgress({
					documentId: DOC_A,
					sourceFingerprint: FINGERPRINT_A,
				})
			)?.position,
		).toBeNull();
	});
});

describe('deleteReadingProgress', () => {
	it('reports whether there was a row to remove', async () => {
		await saveReadingPosition({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			currentPage: asPageIndex(5),
			position: null,
		});

		expect(
			await deleteReadingProgress({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A }),
		).toBe(true);
		expect(
			await deleteReadingProgress({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A }),
		).toBe(false);
	});

	it('atomically reports only one winner when two callers race', async () => {
		// Without a transaction, two concurrent "forget progress"
		// clicks would both pass the existence check and both delete.
		// The transaction serialises the read-and-delete so the
		// second caller sees the row is already gone.
		await saveReadingPosition({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			currentPage: asPageIndex(5),
			position: null,
		});

		const key = { documentId: DOC_A, sourceFingerprint: FINGERPRINT_A };
		const results = await Promise.all([deleteReadingProgress(key), deleteReadingProgress(key)]);
		expect(results.filter((r) => r === true)).toHaveLength(1);
		expect(results.filter((r) => r === false)).toHaveLength(1);
		expect(
			await getReadingProgress({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A }),
		).toBeNull();
	});
});
