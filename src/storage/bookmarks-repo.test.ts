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

/**
 * The order a read hands rows back in.
 *
 * IndexedDB promises the *set* of rows a query matches; it does not
 * promise the order it walks them. A scan follows whichever index the
 * engine picked, and that order changes with compaction, with the
 * index chosen, and between a fresh read and a re-read. So the fake
 * takes its order from here rather than from the insertion order a
 * `Map` happens to iterate in.
 *
 * That distinction is the whole point: with a `Map`, "read it twice,
 * get the same order" is true by construction, so an assertion built
 * on it passes whether or not the repository sorted anything. Reading
 * the same rows back through two different orders and getting one
 * answer can only mean the repository decided it.
 */
type ReadOrder = 'inserted' | 'byId' | 'reverseInserted';

let readOrder: ReadOrder = 'inserted';

function setReadOrder(order: ReadOrder): void {
	readOrder = order;
}

/** The matching rows, in the order the current read hands them over. */
function readMatching(tuple: readonly unknown[], segments: readonly string[], index: string) {
	const matched = Array.from(rows.values()).filter((row) =>
		tuple.every((v, i) => row[segments[i] ?? index] === v),
	);
	if (readOrder === 'byId') {
		return matched.sort((a, b) =>
			String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0,
		);
	}
	if (readOrder === 'reverseInserted') return matched.reverse();
	return matched;
}

/**
 * The ids the current read order would hand back for {@link SCOPE},
 * unsorted by the repository.
 *
 * Test-only, and the reason the ordering tests below can be trusted
 * not to go stale: it lets a test assert that the storage order it is
 * reacting to is genuinely *different* from the order the repository
 * returned. A fake that stopped varying would make every "stable
 * across reads" assertion pass for free, which is exactly how the
 * tie-break came to be untested in the first place.
 */
function storageOrderForScope(): readonly string[] {
	return readMatching(
		[SCOPE.documentId, SCOPE.sourceFingerprint],
		['documentId', 'sourceFingerprint'],
		'[documentId+sourceFingerprint]',
	).map((row) => String(row.id));
}

/** Ids a test wants the next `addBookmark` calls to receive, in order.
 *  Anything past the end falls back to the sequential default, so a
 *  test can pin only the ids its ordering assertion depends on. */
let queuedIds: string[] = [];

function useIds(...ids: string[]): void {
	queuedIds = [...ids];
}

/** A `crypto.randomUUID` that is stable, so ids can be asserted. */
function useDeterministicIds(): void {
	vi.stubGlobal('crypto', {
		...globalThis.crypto,
		randomUUID: () =>
			queuedIds.shift() ?? `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
	});
}

vi.mock('./db.ts', () => {
	let inflight: Promise<unknown> = Promise.resolve();
	return {
		getDb: () => ({
			bookmarks: {
				where: (index: string) => ({
					equals: (value: unknown) => {
						// Index shape support. Single-column equality is a
						// simple scan; compound equality matches an exact
						// tuple so a `[documentId+sourceFingerprint]` read
						// narrows to one document's bookmarks in one pass.
						// Dexie's compound syntax wraps the index in
						// `[...]`; strip the brackets before splitting.
						const tuple = Array.isArray(value) ? value : [value];
						const segments = index.replace(/[[\]]/g, '').split('+');
						return {
							filter: (predicate: (row: Record<string, unknown>) => boolean) => ({
								async sortBy(key: string) {
									return readMatching(tuple, segments, index)
										.filter(predicate)
										.sort((a, b) => Number(a[key]) - Number(b[key]));
								},
								async toArray() {
									return readMatching(tuple, segments, index).filter(predicate);
								},
							}),
							async toArray() {
								return readMatching(tuple, segments, index);
							},
						};
					},
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
			transaction: async <T>(_mode: string, _tables: unknown, fn: () => Promise<T>) => {
				// Serialise concurrent transactions on this table:
				// a second `tx` awaits the first, so its `get` sees
				// the first's `delete`. Mirrors Dexie's transactional
				// queue for the race tests to be meaningful.
				const result = inflight.then(async () => await fn());
				inflight = result.catch(() => undefined);
				return result;
			},
		}),
	};
});

const { addBookmark, deleteBookmark, listBookmarks, listBookmarksOnPage } = await import(
	'./bookmarks-repo.ts'
);

const DOC_A = asDocumentId('00000000-0000-4000-8000-00000000000a');
const DOC_B = asDocumentId('00000000-0000-4000-8000-00000000000b');
const FINGERPRINT_A = asSourceFingerprint('a'.repeat(64));
const FINGERPRINT_B = asSourceFingerprint('b'.repeat(64));

const SCOPE = { documentId: DOC_A, sourceFingerprint: FINGERPRINT_A };

/** Bookmark ids the ordering tests pin, in ascending id order. They
 *  are separate from the sequential default so a test can hand them
 *  out in any sequence — which is how a tie-break becomes testable:
 *  ids that run *against* the write order make "the repository sorted
 *  this" and "the storage happened to return it sorted" two different
 *  answers, and only one of them can pass. */
const ID_0 = '00000000-0000-4000-8000-000000000000';
const ID_1 = '00000000-0000-4000-8000-000000000001';
const ID_2 = '00000000-0000-4000-8000-000000000002';
const ID_3 = '00000000-0000-4000-8000-000000000003';
const ID_9 = '00000000-0000-4000-8000-000000000009';

beforeEach(() => {
	rows.clear();
	sequence = 0;
	queuedIds = [];
	readOrder = 'inserted';
	useDeterministicIds();
	vi.unstubAllGlobals();
	useDeterministicIds();
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
		// The ids here run *against* the order the rows are written in,
		// and that is the only reason this test can fail. A tie-break
		// that the repository did not apply would leave the read order
		// standing, and the read order is `ID_3, ID_1, ID_2`.
		useIds(ID_3, ID_1, ID_2);
		await add({ pageIndex: 5, createdAt: 1000 });
		await add({ pageIndex: 5, createdAt: 1000 });
		await add({ pageIndex: 5, createdAt: 1000 });

		const listed = await listBookmarks(SCOPE);
		expect(listed.map((row) => row.id)).toEqual([ID_1, ID_2, ID_3]);
	});

	it('is empty for a source that was never marked', async () => {
		expect(await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A })).toEqual(
			[],
		);
	});

	/**
	 * Issue #32 — the order is a total order, and it is the *stored*
	 * order.
	 *
	 * `createdAt` is a millisecond clock, so two marks made inside one
	 * tick tie. Without a tie-break the list came back in whatever row
	 * order the engine walked, and the panel — which renders each
	 * mark's position as an ordinal — renumbered itself between reads.
	 *
	 * Every test here hands out ids in an order that disagrees with
	 * the order the rows are written in, and checks the answer against
	 * a *named* expectation rather than against a second read. That
	 * combination is what makes them able to fail: an earlier version
	 * of this suite compared two reads of a `Map`, which returns
	 * insertion order both times, so it passed with the tie-break
	 * deleted outright.
	 */
	describe('a total order for tied marks (Issue #32)', () => {
		it('orders tied marks by id, not by the order the rows were written in', async () => {
			useIds(ID_3, ID_1, ID_2);
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });

			// Written `ID_3, ID_1, ID_2`; the answer is `ID_1, ID_2, ID_3`.
			// Anything that does not break the tie returns the first.
			expect(storageOrderForScope()).toEqual([ID_3, ID_1, ID_2]);
			expect((await listBookmarks(SCOPE)).map((row) => row.id)).toEqual([ID_1, ID_2, ID_3]);
		});

		it('gives the same order back when a fresh read walks the rows differently', async () => {
			useIds(ID_3, ID_1, ID_2);
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });

			// Three reads of the same saved state. IndexedDB does not
			// promise the order it walks rows in, so the answer must
			// come from the sort and not from the read. The first and
			// third of these are reverses of one another, so a pass
			// here cannot be an artefact of a stable read.
			setReadOrder('inserted');
			const asWritten = await listBookmarks(SCOPE);
			setReadOrder('reverseInserted');
			const reversed = await listBookmarks(SCOPE);
			setReadOrder('byId');
			const viaKeyWalk = await listBookmarks(SCOPE);

			expect(storageOrderForScope()).toEqual([ID_1, ID_2, ID_3]);
			const ids = asWritten.map((row) => row.id);
			expect(ids).toEqual([ID_1, ID_2, ID_3]);
			expect(reversed.map((row) => row.id)).toEqual(ids);
			expect(viaKeyWalk.map((row) => row.id)).toEqual(ids);
		});

		it('keeps createdAt the deciding key, even when the ids point the other way', async () => {
			// Written in id order, so an id-first sort would reproduce
			// the read order. The latest mark carries the *lowest* id,
			// which only a createdAt-first sort puts last.
			useIds(ID_1, ID_2, ID_3);
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 2000 });
			await add({ pageIndex: 5, createdAt: 3000 });

			expect((await listBookmarks(SCOPE)).map((row) => row.createdAt)).toEqual([1000, 2000, 3000]);
		});

		it('leaves the ties alone and puts the later mark after them', async () => {
			useIds(ID_3, ID_1, ID_2);
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });
			useIds(ID_9);
			const later = await add({ pageIndex: 5, createdAt: 2000 });

			// A new mark with a later `createdAt` — and the highest id
			// there is, so "sorted by id" and "newest last" happen to
			// agree. The tie order among the first three is the part
			// under test, and it is unchanged.
			expect((await listBookmarks(SCOPE)).map((row) => row.id)).toEqual([
				ID_1,
				ID_2,
				ID_3,
				later.id,
			]);
		});

		it('slots a mark that ties into its id position, and only moves what it must', async () => {
			useIds(ID_1, ID_2);
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });
			expect((await listBookmarks(SCOPE)).map((row) => row.id)).toEqual([ID_1, ID_2]);

			// A third mark in the same millisecond, with an id *below*
			// both. It takes the first slot — the specified position is
			// "wherever its id sorts", not "at the end" — and it pushes
			// the two existing marks down by exactly one.
			useIds(ID_0);
			await add({ pageIndex: 5, createdAt: 1000 });
			const listed = await listBookmarks(SCOPE);
			expect(listed.map((row) => row.id)).toEqual([ID_0, ID_1, ID_2]);
			// The pair that was already there keeps its relative order,
			// which is the part a reader has already memorised from the
			// panel's ordinals.
			expect(listed.slice(1).map((row) => row.id)).toEqual([ID_1, ID_2]);

			// And a tie with an id *above* both appends instead, so the
			// two marks already on the page do not move at all.
			useIds(ID_9);
			const high = await add({ pageIndex: 5, createdAt: 1000 });
			const afterHigh = await listBookmarks(SCOPE);
			expect(afterHigh.map((row) => row.id)).toEqual([ID_0, ID_1, ID_2, high.id]);
			expect(afterHigh.slice(0, 3).map((row) => row.id)).toEqual([ID_0, ID_1, ID_2]);
		});

		it('numbers tied marks the same way on every read, which is what the panel shows', async () => {
			// The panel's ordinal comes from list position
			// (`bookmarkLabels`, src/ui/bookmarks-panel.tsx), so the
			// number a reader sees is this order and nothing else.
			useIds(ID_3, ID_1, ID_2);
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });
			await add({ pageIndex: 5, createdAt: 1000 });

			const ordinals = async () => {
				setReadOrder(readOrder === 'inserted' ? 'reverseInserted' : 'inserted');
				return (await listBookmarks(SCOPE)).map((row) => row.id);
			};
			// `ordinals()` flips the read order on every call, so the
			// two calls below are not reading the rows the same way.
			expect(await ordinals()).toEqual([ID_1, ID_2, ID_3]);
			expect(await ordinals()).toEqual([ID_1, ID_2, ID_3]);
		});
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

	it('breaks ties on id in the same order the whole-source list does', async () => {
		// Issue #32: the page-scoped read is a different query, so
		// "inherits the same order" has to be true of the code and not
		// of a copy that happens to agree today.
		useIds(ID_3, ID_1, ID_2);
		await add({ pageIndex: 5, createdAt: 1000 });
		await add({ pageIndex: 5, createdAt: 1000 });
		await add({ pageIndex: 5, createdAt: 1000 });
		// A fourth mark on another page, sharing the millisecond and
		// sorting first by id — it must not appear, and it must not
		// change the order of the three.
		useIds(ID_0);
		await add({ pageIndex: 6, createdAt: 1000 });

		setReadOrder('inserted');
		const whole = await listBookmarks(SCOPE);
		setReadOrder('reverseInserted');
		const onPage = await listBookmarksOnPage(SCOPE, asPageIndex(5));

		expect(whole.map((row) => row.id)).toEqual([ID_0, ID_1, ID_2, ID_3]);
		expect(onPage.map((row) => row.id)).toEqual([ID_1, ID_2, ID_3]);
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

	it('atomically reports only one winner when two callers race', async () => {
		// The race that an unwrapped get-then-delete cannot answer:
		// both callers see the row, both call delete, both would
		// otherwise return true. The transaction serialises them so
		// exactly one returns true.
		const bookmark = await add({ pageIndex: 1 });

		const results = await Promise.all([deleteBookmark(bookmark.id), deleteBookmark(bookmark.id)]);
		expect(results.filter((r) => r === true)).toHaveLength(1);
		expect(results.filter((r) => r === false)).toHaveLength(1);
		expect(await listBookmarks({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A })).toEqual(
			[],
		);
	});
});
