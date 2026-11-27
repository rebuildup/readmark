/**
 * Unit tests for the bookmarks repository (session store, ADR-0008).
 *
 * What is under test is the key discipline and the ordering, which
 * are the two things that go wrong silently: a list scoped to the
 * wrong source shows a reader another file's marks, and an unordered
 * list makes "jump to the one I just made" ambiguous.
 *
 * These run against the real in-memory repository — there is no
 * database to fake, which is the point of ADR-0008: the store is a
 * `Map`, so a test that exercises the repository exercises the
 * shipped code path exactly. The end-to-end claim (a mark appears
 * in the panel and a jump lands on it) is `scripts/smoke-reader.mjs`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { asDocumentId, asSourceFingerprint, type DocumentId } from '../domain/document.ts';
import { asPageIndex } from '../domain/reading-state.ts';
import {
	addBookmark,
	deleteBookmark,
	listBookmarks,
	listBookmarksOnPage,
} from './bookmarks-repo.ts';
import { _resetSessionStoreForTests } from './session-store.ts';

let sequence = 0;

/** A `crypto.randomUUID` that is stable, so ids can be asserted. */
function useDeterministicIds(): void {
	vi.stubGlobal('crypto', {
		...globalThis.crypto,
		randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
	});
}

const DOC_A = asDocumentId('00000000-0000-4000-8000-00000000000a');
const DOC_B = asDocumentId('00000000-0000-4000-8000-00000000000b');
const FINGERPRINT_A = asSourceFingerprint('a'.repeat(64));
const FINGERPRINT_B = asSourceFingerprint('b'.repeat(64));

beforeEach(() => {
	vi.unstubAllGlobals();
	sequence = 0;
	useDeterministicIds();
	_resetSessionStoreForTests();
});

async function add(params: {
	documentId?: DocumentId;
	sourceFingerprint?: string;
	pageIndex: number;
	createdAt?: number;
	title?: string;
}) {
	const bookmark = await addBookmark({
		documentId: params.documentId ?? DOC_A,
		sourceFingerprint: (params.sourceFingerprint ?? FINGERPRINT_A) as never,
		pageIndex: asPageIndex(params.pageIndex),
		anchor: null,
		position: { pageOffsetRatio: 0.25 },
		...(params.title === undefined ? {} : { title: params.title }),
	});
	if (params.createdAt !== undefined) {
		// `addBookmark` returns the very object it stored, so the
		// test can backdate the row without a second write path —
		// the ordering assertions need creation times the clock
		// cannot produce on demand.
		(bookmark as { createdAt: number }).createdAt = params.createdAt;
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

it('stores the name the reader gave the mark, and trims it', async () => {
	const named = await add({ pageIndex: 4, title: '  第三章の要約  ' });
	expect(named.title).toBe('第三章の要約');

	// A whitespace-only name would render as a blank row in the
	// panel, so it is stored as no name at all.
	const blank = await add({ pageIndex: 4, title: '   ' });
	expect(blank.title).toBe('');

	// And the field is optional: nothing forces a reader to name a
	// mark in order to make one.
	const unnamed = await add({ pageIndex: 4 });
	expect(unnamed.title).toBe('');

	const listed = await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
	expect(listed.map((row) => row.title)).toEqual(['第三章の要約', '', '']);
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

	it('breaks ties on id, so two marks in the same millisecond do not flicker', async () => {
		const a = await add({ pageIndex: 5, createdAt: 1000 });
		const b = await add({ pageIndex: 5, createdAt: 1000 });
		const c = await add({ pageIndex: 5, createdAt: 1000 });

		const scope = { documentId: DOC_A, sourceFingerprint: FINGERPRINT_A };
		const first = await listBookmarks(scope);
		const second = await listBookmarks(scope);
		// A panel that re-renders is a panel that flickers otherwise:
		// an order that changes between two reads is an order that
		// means nothing to the reader.
		expect(first.map((row) => row.id)).toEqual(second.map((row) => row.id));
		expect([first[0]?.id, first[1]?.id, first[2]?.id]).toEqual([a.id, b.id, c.id]);
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

	it('reports only one winner when two callers race', async () => {
		// The shape the transaction used to serialise: two callers
		// for the same row. JavaScript runs one job at a time, so the
		// first delete has already happened when the second one runs
		// — exactly one `true`, and the loser says `false`.
		const bookmark = await add({ pageIndex: 1 });

		const results = await Promise.all([deleteBookmark(bookmark.id), deleteBookmark(bookmark.id)]);
		expect(results.filter((r) => r === true)).toHaveLength(1);
		expect(results.filter((r) => r === false)).toHaveLength(1);
		expect(await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A })).toEqual(
			[],
		);
	});
});
