/**
 * Unit tests for the bookmarks repository.
 *
 * What is under test is the key discipline and the ordering, which
 * are the two things that go wrong silently: a list scoped to the
 * wrong source shows a reader another file's marks, and an unordered
 * list makes "jump to the one I just made" ambiguous.
 *
 * `getDb` is faked with a table that behaves like Dexie's for the
 * operations used here (a `Map` keyed by id, filter and sortBy over
 * it). The repo has no `fake-indexeddb`; the end-to-end claim — a
 * mark in the UI survives a reload and a jump lands on it — is
 * `scripts/smoke-reader.mjs`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { asDocumentId, asSourceFingerprint, type DocumentId } from '../domain/document.ts';
import { asPageIndex } from '../domain/reading-state.ts';

const rows = new Map<string, Record<string, unknown>>();
let sequence = 0;

/** A `crypto.randomUUID` that is stable, so ids can be asserted. */
function useDeterministicIds(): void {
	vi.stubGlobal('crypto', {
		...globalThis.crypto,
		randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
	});
}

vi.mock('./db.ts', () => ({
	getDb: () => ({
		bookmarks: {
			where: (index: string) => ({
				equals: (value: unknown) => ({
					filter: (predicate: (row: Record<string, unknown>) => boolean) => ({
						async sortBy(key: string) {
							return Array.from(rows.values())
								.filter((row) => row[index] === value)
								.filter(predicate)
								.sort((a, b) => Number(a[key]) - Number(b[key]));
						},
					}),
				}),
			}),
			get: async (id: string) => rows.get(id),
			put: async (row: Record<string, unknown>) => {
				rows.set(String(row.id), row);
				return row.id;
			},
			delete: async (id: string) => {
				// Dexie 4 types `Table.delete` as `void`.
				rows.delete(id);
			},
			update: async (id: string, changes: Record<string, unknown>) => {
				const row = rows.get(id);
				if (row === undefined) return 0;
				rows.set(id, { ...row, ...changes });
				return 1;
			},
		},
	}),
}));

const { addBookmark, deleteBookmark, listBookmarks, listBookmarksOnPage } = await import(
	'./bookmarks-repo.ts'
);

const DOC_A = asDocumentId('00000000-0000-4000-8000-00000000000a');
const DOC_B = asDocumentId('00000000-0000-4000-8000-00000000000b');
const FINGERPRINT_A = asSourceFingerprint('a'.repeat(64));
const FINGERPRINT_B = asSourceFingerprint('b'.repeat(64));

beforeEach(() => {
	rows.clear();
	sequence = 0;
	useDeterministicIds();
	vi.unstubAllGlobals();
	useDeterministicIds();
});

async function add(params: {
	documentId?: DocumentId;
	sourceFingerprint?: string;
	pageIndex: number;
	createdAt?: number;
}) {
	const bookmark = await addBookmark({
		documentId: params.documentId ?? DOC_A,
		sourceFingerprint: (params.sourceFingerprint ?? FINGERPRINT_A) as never,
		pageIndex: asPageIndex(params.pageIndex),
		anchor: null,
		position: { pageOffsetRatio: 0.25 },
	});
	if (params.createdAt !== undefined) {
		const row = rows.get(bookmark.id);
		if (row !== undefined) row.createdAt = params.createdAt;
	}
	return bookmark;
}

describe('addBookmark', () => {
	it('stores a page pin with no anchor and the sub-page position', async () => {
		const bookmark = await add({ pageIndex: 7 });

		expect(bookmark).toMatchObject({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			pageIndex: 7,
			// No selection: #7 owns turning a selection into an anchor,
			// and a bookmark claiming one would promise a quote it
			// cannot honour.
			anchor: null,
			position: { pageOffsetRatio: 0.25 },
		});
		expect(typeof bookmark.id).toBe('string');
		expect(typeof bookmark.createdAt).toBe('number');
	});

	it('mints a distinct id for every mark, including on the same page', async () => {
		const first = await add({ pageIndex: 7 });
		const second = await add({ pageIndex: 7 });

		expect(first.id).not.toBe(second.id);
		const listed = await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(listed).toHaveLength(2);
	});
});

describe('listBookmarks', () => {
	it('is scoped to the pair, not the document alone', async () => {
		await add({ pageIndex: 1, sourceFingerprint: FINGERPRINT_A });
		await add({ pageIndex: 2, sourceFingerprint: FINGERPRINT_B });
		await add({ pageIndex: 3, documentId: DOC_B, sourceFingerprint: FINGERPRINT_A });

		const scoped = await listBookmarks({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
		});
		// A position in one file says nothing about a re-encoded copy
		// of it, and the same book in two documents is two lists.
		expect(scoped.map((row) => row.pageIndex)).toEqual([1]);
	});

	it('orders by creation time, so the panel reads as a history', async () => {
		await add({ pageIndex: 5, createdAt: 300 });
		await add({ pageIndex: 3, createdAt: 100 });
		await add({ pageIndex: 4, createdAt: 200 });

		const listed = await listBookmarks({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
		});
		expect(listed.map((row) => row.pageIndex)).toEqual([3, 4, 5]);
	});

	it('is empty for a source that was never marked', async () => {
		expect(await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A })).toEqual(
			[],
		);
	});
});

describe('listBookmarksOnPage', () => {
	it('returns only the marks on that page', async () => {
		await add({ pageIndex: 1, createdAt: 200 });
		await add({ pageIndex: 2, createdAt: 100 });
		await add({ pageIndex: 2, createdAt: 300 });

		const onPageTwo = await listBookmarksOnPage(
			{ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A },
			asPageIndex(2),
		);
		expect(onPageTwo.map((row) => row.createdAt)).toEqual([100, 300]);
	});
});

describe('deleteBookmark', () => {
	it('removes the row and reports whether there was one', async () => {
		const bookmark = await add({ pageIndex: 1 });

		expect(await deleteBookmark(bookmark.id)).toBe(true);
		expect(await deleteBookmark(bookmark.id)).toBe(false);
		expect(await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A })).toEqual(
			[],
		);
	});

	it('leaves the other marks alone', async () => {
		const keep = await add({ pageIndex: 1 });
		const drop = await add({ pageIndex: 2 });

		await deleteBookmark(drop.id);

		const listed = await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(listed.map((row) => row.id)).toEqual([keep.id]);
	});
});
