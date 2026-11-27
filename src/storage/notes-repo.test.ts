/**
 * Unit tests for the notes repository.
 *
 * What is under test is the four things about notes that go wrong
 * quietly, and the acceptance criterion that goes wrong *quietest* of
 * all:
 *
 *   - **A body that is stored intact.** Newlines, trailing newlines,
 *     runs of spaces. A note that comes back as one run-on line looks
 *     like a rendering bug; it is far more often a storage one, and by
 *     the time it is rendered the text is already gone.
 *   - **"No highlight" is absence, not an empty highlight.** A query
 *     for a highlight must not return notes that have none, and a note
 *     with a blank link must be stored as the same absence rather than
 *     as three spellings of it.
 *   - **Two different queries, two different keys.** A notes list is
 *     scoped to a document *and* a source; a note's list for a
 *     highlight is keyed by the highlight. Getting either key wrong
 *     shows a reader another book's notes, or scans the table.
 *   - **A note's position survives a re-open.** The anchor is stored
 *     unread and handed back unchanged, and the resolver write-back
 *     stores a refreshed one without disturbing anything else on the
 *     row.
 *
 * ## What the fake is for, and what it is not
 *
 * `getDb` is faked with a table that implements the four declared
 * indexes and refuses every other one. That is not a shortcut around
 * IndexedDB — it is how the "no highlight means no index entry"
 * property is testable at all:
 *
 *   IndexedDB does not put a row whose index key is `null` into that
 *   index. There is no such key, so the row is simply absent from it,
 *   and no value of `highlightId` can ever reach it. The fake
 *   reproduces that by skipping rows with a non-string key rather
 *   than by filtering them out after the fact, so a query that *would*
 *   have matched them in a hand-rolled filter still comes back empty.
 *
 * Every query is recorded, so a test can assert which index was read.
 * The repo has no `fake-indexeddb`; the end-to-end claim — a note
 * written in the UI is still there after a reload, and a jump from the
 * panel lands on the words it was written about — is
 * `scripts/smoke-notes.mjs`.
 */

import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint, type DocumentId } from '../domain/document.ts';
import {
	asPageIndex,
	type Note,
	type PageIndex,
	type PositionedNote,
} from '../domain/reading-state.ts';

type Row = Record<string, unknown>;

const rows = new Map<string, Row>();
/** Every index a query asked for, in order. */
const queries: string[] = [];
let sequence = 0;

/** A `crypto.randomUUID` that is stable, so ids can be asserted. */
function useDeterministicIds(): void {
	vi.stubGlobal('crypto', {
		...globalThis.crypto,
		randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
	});
}

/** Every index the `notes` table declares in `db.ts`, and how a row is
 *  matched against it. A key the repository asks for that is not here
 *  is a hard error, not an empty result — Dexie raises `SchemaError`
 *  for an unindexed keyPath, and a fake that quietly returned nothing
 *  would let a table scan ship under a green test. */
const INDEXES: Record<string, (row: Row, key: unknown) => boolean> = {
	id: (row, key) => row.id === key,
	documentId: (row, key) => row.documentId === key,
	kind: (row, key) => row.kind === key,
	sourceFingerprint: (row, key) => row.sourceFingerprint === key,
	updatedAt: (row, key) => row.updatedAt === key,
	'#documentId+kind': (row, key) => {
		const [documentId, kind] = key as [unknown, unknown];
		return row.documentId === documentId && row.kind === kind;
	},
	'#documentId+sourceFingerprint+pageIndex': (row, key) => {
		const [documentId, sourceFingerprint, pageIndex] = key as [unknown, unknown, unknown];
		return (
			row.documentId === documentId &&
			row.sourceFingerprint === sourceFingerprint &&
			row.pageIndex === pageIndex
		);
	},
	/**
	 * The property the whole "no highlight" story rests on. A row whose
	 * `highlightId` is `null` is not in this index — not "matches
	 * null", not "matches the empty string": absent, because `null` is
	 * not a valid IndexedDB key. Reproduced by skipping such rows
	 * rather than by filtering them after a read, so a query that
	 * *would* have matched them under a hand-rolled filter still comes
	 * back empty here.
	 */
	'#highlightId': (row, key) => typeof row.highlightId === 'string' && row.highlightId === key,
};

vi.mock('./db.ts', () => {
	let inflight: Promise<unknown> = Promise.resolve();
	return {
		getDb: () => ({
			notes: {
				where: (index: string) => {
					queries.push(index);
					// Dexie's compound syntax wraps the keyPath in
					// brackets; the fake's keys do not, so strip them
					// before the lookup rather than carrying two
					// spellings of every compound index.
					const name = index.replace(/[[\]]/g, '');
					const compound = INDEXES[`#${name}`];
					const single = INDEXES[name];
					if (compound === undefined && single === undefined) {
						throw new Error(`SchemaError: KeyPath ${index} on object store notes is not indexed`);
					}
					return {
						equals: (value: unknown) => ({
							toArray: async () =>
								all().filter((row) =>
									compound === undefined ? single?.(row, value) === true : compound(row, value),
								),
						}),
						between: (lower: unknown, upper: unknown) => ({
							toArray: async () => {
								if (compound === undefined) {
									throw new Error(`SchemaError: ${index} cannot be read as a range`);
								}
								const [documentId, sourceFingerprint, from] = lower as [unknown, unknown, unknown];
								const [, , to] = upper as [unknown, unknown, unknown];
								return all().filter((row) => {
									// The first two components pin the range to one
									// source; a free note has neither a
									// `sourceFingerprint` nor a `pageIndex`, so
									// it cannot be inside it.
									if (row.documentId !== documentId) return false;
									if (row.sourceFingerprint !== sourceFingerprint) return false;
									const pageIndex = row.pageIndex;
									if (typeof pageIndex !== 'number') return false;
									// A real page always sits between Dexie's
									// sentinels, which is the point of using
									// them: `minKey` is `-Infinity` and
									// `maxKey` is the string `￿`,
									// the largest legal key, and IndexedDB
									// orders every number below every
									// string. A bound written as
									// `[1, pageCount]` would quietly drop a
									// note on any other page.
									return keyAtOrBefore(from, pageIndex) && keyAtOrBefore(pageIndex, to);
								});
							},
						}),
					};
				},
				get: async (id: string) => rows.get(id),
				put: async (row: Row) => {
					rows.set(String(row.id), { ...row });
					return row.id;
				},
				delete: async (id: string) => {
					rows.delete(id);
				},
				update: async (id: string, changes: Row) => {
					const row = rows.get(id);
					if (row === undefined) return 0;
					rows.set(id, { ...row, ...changes });
					return 1;
				},
			},
			transaction: async <T>(_mode: string, _tables: unknown, fn: () => Promise<T>) => {
				// Serialise, the way Dexie does over the same tables, so
				// the get-and-write pairs in this file are atomic.
				const result = inflight.then(async () => await fn());
				inflight = result.catch(() => undefined);
				return result;
			},
		}),
	};
});

/** The positioned note out of a list, narrowed. Most of what is
 *  asserted below is about a position, and asking for it by name puts
 *  the narrowing at the call site instead of in a chain of
 *  conditionals. */
function thePositionedNote(list: readonly Note[]): PositionedNote {
	const found = list.find((note): note is PositionedNote => note.kind === 'positioned');
	if (found === undefined) throw new Error('no positioned note in the list');
	return found;
}

function all(): Row[] {
	return Array.from(rows.values());
}

/** The stored row, or a clear failure. `rows` is the fake's own state
 *  and the test put the row there a line ago, so a missing one is a
 *  broken test rather than a case to guard against — and a `!` at
 *  every call site would be twelve ways to say the same thing. */
function rowOf(id: string): Row {
	const row = rows.get(id);
	if (row === undefined) throw new Error(`no stored note with id ${id}`);
	return row;
}

/**
 * IndexedDB key ordering, for the range read.
 *
 * A key is `number | string | Date | ArrayBuffer | Array`, and they
 * sort in that order: every number before every string, every string
 * before every binary, every binary before every array. Dexie's
 * `maxKey` is the string `￿` precisely so that it is above every
 * number, which is what makes a `between(.., maxKey)` bound mean "and
 * everything after this" rather than "and nothing, because a number
 * compared with `￿` in JavaScript is less than it".
 */
function keyAtOrBefore(a: unknown, b: unknown): boolean {
	if (typeof a === 'number' && typeof b === 'number') return a <= b;
	// A number is at or before any other key type, so it is below every
	// string — which is what makes `maxKey` a usable upper bound for a
	// numeric range.
	if (typeof a === 'number') return true;
	// Both non-numbers. Only strings occur in this file.
	return String(a) <= String(b);
}

const {
	addNote,
	compareNotes,
	deleteNote,
	isHighlightLinked,
	listNotes,
	listNotesForHighlight,
	replaceNoteAnchor,
	updateNote,
} = await import('./notes-repo.ts');

const DOC_A = asDocumentId('00000000-0000-4000-8000-0000000000a1');
const DOC_B = asDocumentId('00000000-0000-4000-8000-0000000000b1');
const FINGERPRINT_A = asSourceFingerprint('a'.repeat(64));
const FINGERPRINT_B = asSourceFingerprint('b'.repeat(64));
const HIGHLIGHT_1 = '00000000-0000-4000-8000-00000000aa01';
const HIGHLIGHT_2 = '00000000-0000-4000-8000-00000000aa02';

/** A PDF anchor whose payload is not a shape this layer is meant to
 *  read. Frozen, so a repository that tried to rewrite it would throw
 *  rather than quietly succeed. */
function frozenAnchor(page: number, quote: string): Anchor {
	return Object.freeze({
		format: 'pdf',
		payload: Object.freeze({
			page: asPageIndex(page),
			rects: Object.freeze([Object.freeze({ x: 1, y: 2, width: 3, height: 4 })]),
			quote: Object.freeze({ exact: quote }),
		}),
	});
}

beforeEach(() => {
	rows.clear();
	queries.length = 0;

	sequence = 0;
	vi.unstubAllGlobals();
	useDeterministicIds();
});

async function addPositioned(params: {
	documentId?: DocumentId;
	sourceFingerprint?: string;
	pageIndex?: number;
	body?: string;
	anchor?: Anchor | null;
	highlightId?: string | null | undefined;
}) {
	return await addNote({
		kind: 'positioned',
		documentId: params.documentId ?? DOC_A,
		sourceFingerprint: asSourceFingerprint(params.sourceFingerprint ?? FINGERPRINT_A),
		pageIndex: asPageIndex(params.pageIndex ?? 1),
		anchor: params.anchor ?? null,
		body: params.body ?? 'a note',
		highlightId: params.highlightId ?? null,
	});
}

async function addFree(params: {
	documentId?: DocumentId;
	body?: string;
	highlightId?: string | null;
}) {
	return await addNote({
		kind: 'free',
		documentId: params.documentId ?? DOC_A,
		body: params.body ?? 'a free note',
		highlightId: params.highlightId ?? null,
	});
}

describe('addNote — the body is stored exactly as written', () => {
	it('keeps line breaks, blank lines and a trailing newline', async () => {
		const body = 'first line\n\nthird line\n';
		const added = await addPositioned({ body });
		const [stored] = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(stored?.body).toBe(body);
		expect(stored?.body.split('\n')).toHaveLength(4);
		// And on the row itself, not only through a read that might
		// have reassembled it.
		expect(rows.get(added.id)?.body).toBe(body);
	});

	it('keeps runs of spaces and tabs, which are not noise in prose', async () => {
		const body = 'a  double-spaced  line\n\tan indented one';
		const added = await addPositioned({ body });
		expect(rows.get(added.id)?.body).toBe(body);
	});

	it('keeps a CRLF body as CRLF, rather than normalising it on the way in', async () => {
		const body = 'windows\r\nline';
		const added = await addPositioned({ body });
		expect(rows.get(added.id)?.body).toBe(body);
	});

	it('stores an empty body rather than inventing one', async () => {
		const added = await addPositioned({ body: '' });
		expect(rows.get(added.id)?.body).toBe('');
	});
});

describe('addNote — identity', () => {
	it('gives two notes on one highlight two ids', async () => {
		const first = await addPositioned({ pageIndex: 4, highlightId: HIGHLIGHT_1 });
		const second = await addPositioned({ pageIndex: 4, highlightId: HIGHLIGHT_1 });
		expect(first.id).not.toBe(second.id);
	});

	it('does not trim the body, which is a different thing from the link', async () => {
		// A note about a highlight with whitespace around the text is a
		// link to that highlight, and the body is untouched.
		const body = '  spaced body  ';
		const added = await addPositioned({ body, highlightId: `  ${HIGHLIGHT_1}  ` });
		expect(rows.get(added.id)?.body).toBe(body);
		expect(rows.get(added.id)?.highlightId).toBe(HIGHLIGHT_1);
	});

	it('stores a positioned note with both keys and its anchor', async () => {
		const anchor = frozenAnchor(9, 'the words');
		const added = await addPositioned({ pageIndex: 9, anchor });
		const row = rows.get(added.id);
		expect(row?.documentId).toBe(DOC_A);
		expect(row?.sourceFingerprint).toBe(FINGERPRINT_A);
		expect(row?.pageIndex).toBe(9);
		expect(row?.anchor).toBe(anchor);
	});

	it('stores a free note with no source and no page at all', async () => {
		const added = await addFree({});
		const row = rows.get(added.id);
		expect(row?.kind).toBe('free');
		expect(row?.sourceFingerprint).toBeUndefined();
		expect(row?.pageIndex).toBeUndefined();
		expect(row?.anchor).toBeUndefined();
	});
});

describe('the highlight link is absence, not an empty highlight', () => {
	it('stores a blank link as the same null an omitted one is', async () => {
		const omitted = await addPositioned({ highlightId: undefined });
		const blank = await addPositioned({ highlightId: '' });
		const spaced = await addPositioned({ highlightId: '   ' });
		expect(rows.get(blank.id)?.highlightId).toBeNull();
		expect(rows.get(spaced.id)?.highlightId).toBeNull();
		expect(rows.get(omitted.id)?.highlightId).toBeNull();
		expect(isHighlightLinked(omitted)).toBe(false);
		expect(isHighlightLinked(blank)).toBe(false);
	});

	it('never returns a note with no highlight from a highlight query', async () => {
		await addPositioned({ highlightId: null });
		await addFree({ highlightId: null });
		expect(await listNotesForHighlight(HIGHLIGHT_1)).toEqual([]);
	});

	it('answers none for a blank highlight id, rather than matching blank ones', async () => {
		await addPositioned({ highlightId: HIGHLIGHT_1 });
		expect(await listNotesForHighlight('')).toEqual([]);
		expect(await listNotesForHighlight('   ')).toEqual([]);
	});

	it('a note with a highlight is distinguishable from one without', async () => {
		const linked = await addPositioned({ highlightId: HIGHLIGHT_1 });
		const unlinked = await addPositioned({ highlightId: null });
		expect(isHighlightLinked(linked)).toBe(true);
		expect(isHighlightLinked(unlinked)).toBe(false);
		expect(await listNotesForHighlight(HIGHLIGHT_1)).toHaveLength(1);
		expect((await listNotesForHighlight(HIGHLIGHT_1))[0]?.id).toBe(linked.id);
	});
});

describe('listNotesForHighlight', () => {
	it('returns only that highlight’s notes', async () => {
		await addPositioned({ highlightId: HIGHLIGHT_1, body: 'one' });
		await addPositioned({ highlightId: HIGHLIGHT_1, body: 'two' });
		await addPositioned({ highlightId: HIGHLIGHT_2, body: 'three' });
		await addPositioned({ highlightId: null, body: 'four' });

		const found = await listNotesForHighlight(HIGHLIGHT_1);
		expect(found.map((note) => note.body)).toEqual(['one', 'two']);
	});

	it('returns them oldest first', async () => {
		const first = await addPositioned({ highlightId: HIGHLIGHT_1 });
		rowOf(first.id).createdAt = 100;
		const second = await addPositioned({ highlightId: HIGHLIGHT_1 });
		rowOf(second.id).createdAt = 50;
		const found = await listNotesForHighlight(HIGHLIGHT_1);
		expect(found.map((note) => note.id)).toEqual([second.id, first.id]);
	});

	it('reads the highlightId index rather than scanning the table', async () => {
		await addPositioned({ highlightId: HIGHLIGHT_1 });
		queries.length = 0;
		await listNotesForHighlight(HIGHLIGHT_1);
		expect(queries).toEqual(['highlightId']);
	});

	it('is not narrowed by a document, because a highlight id is already unique', async () => {
		await addPositioned({ documentId: DOC_A, highlightId: HIGHLIGHT_1 });
		await addPositioned({ documentId: DOC_B, highlightId: HIGHLIGHT_1 });
		expect(await listNotesForHighlight(HIGHLIGHT_1)).toHaveLength(2);
	});
});

describe('listNotes — one document, one source', () => {
	it("returns that source's notes and no other document's", async () => {
		await addPositioned({ documentId: DOC_A, body: 'mine' });
		await addPositioned({ documentId: DOC_B, body: 'theirs' });
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(found.map((note) => note.body)).toEqual(['mine']);
	});

	it("returns that source's notes and no other source's", async () => {
		await addPositioned({ sourceFingerprint: FINGERPRINT_A, body: 'the pdf' });
		await addPositioned({ sourceFingerprint: FINGERPRINT_B, body: 'the epub' });
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(found.map((note) => note.body)).toEqual(['the pdf']);
	});

	it('includes the document’s free notes, which belong to the book rather than a source', async () => {
		await addFree({ body: 'about the book' });
		await addPositioned({ body: 'about page 3', pageIndex: 3 });
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(found.map((note) => note.body)).toEqual(['about the book', 'about page 3']);
		// The same free note in the other source, because it says the
		// same thing in both.
		const other = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_B });
		expect(other.map((note) => note.body)).toEqual(['about the book']);
	});

	it('does not include another document’s free notes', async () => {
		await addFree({ documentId: DOC_A, body: 'mine' });
		await addFree({ documentId: DOC_B, body: 'theirs' });
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(found.map((note) => note.body)).toEqual(['mine']);
	});

	it('orders free notes first, then by page, then by when they were written', async () => {
		const free = await addFree({ body: 'free' });
		const late = await addPositioned({ pageIndex: 7, body: 'page 7' });
		const early = await addPositioned({ pageIndex: 2, body: 'page 2' });
		rowOf(late.id).createdAt = 20;
		rowOf(early.id).createdAt = 90;
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(found.map((note) => note.id)).toEqual([free.id, early.id, late.id]);
	});

	it('breaks a same-millisecond tie on id, so a re-render cannot reshuffle the list', async () => {
		const first = await addPositioned({ pageIndex: 1 });
		const second = await addPositioned({ pageIndex: 1 });
		rowOf(first.id).createdAt = 7;
		rowOf(second.id).createdAt = 7;
		const once = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		const twice = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(once.map((note) => note.id)).toEqual([first.id, second.id]);
		expect(twice.map((note) => note.id)).toEqual(once.map((note) => note.id));
	});

	it('reads declared indexes, and asks for the range over the compound one', async () => {
		await addPositioned({});
		queries.length = 0;
		await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(queries).toContain('[documentId+kind]');
		expect(queries).toContain('[documentId+sourceFingerprint+pageIndex]');
	});

	it('bounds the range with Dexie’s own min and max keys, not a magic page number', async () => {
		// A range closed over "every page" that was written as
		// `[1, pageCount]` or `[0, Infinity]` would silently drop a note
		// on any other page. Dexie's sentinels are what make the bound
		// honest, so the highest page index there is has to come back.
		await addPositioned({ pageIndex: 9999 });
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(found).toHaveLength(1);
		// `minKey` is `-Infinity`; `maxKey` is the string `￿`, the
		// largest legal key. Not a number, and that is the point: it is
		// above every number, so the range really is unbounded above.
		expect(Dexie.minKey).toBe(Number.NEGATIVE_INFINITY);
		expect(typeof Dexie.maxKey).toBe('string');
	});
});

describe('updateNote', () => {
	it('replaces the body and leaves everything else alone', async () => {
		const anchor = frozenAnchor(5, 'the words');
		const added = await addPositioned({ pageIndex: 5, anchor, highlightId: HIGHLIGHT_1 });
		// Pinned, because two writes in the same millisecond would make
		// an `updatedAt` comparison a coin flip and quietly stop testing
		// what it is named after.
		rowOf(added.id).createdAt = 1_000;

		const saved = await updateNote(added.id, 'rewritten\n\nacross two lines');
		expect(saved?.body).toBe('rewritten\n\nacross two lines');
		expect(saved?.id).toBe(added.id);
		// History does not move, and the edit is stamped.
		expect(saved?.createdAt).toBe(1_000);
		expect(saved?.updatedAt).toBeGreaterThan(1_000);
		// A position is the reader's, not the editor's: an edit that
		// could move a note would let a rewrite on one page silently
		// relocate a note written on another.
		if (saved?.kind !== 'positioned') throw new Error('expected a positioned note');
		expect(saved.pageIndex).toBe(5);
		expect(saved.anchor).toBe(anchor);
		expect(saved.highlightId).toBe(HIGHLIGHT_1);
	});

	it('reports null for a note that is not there, rather than half of one', async () => {
		expect(await updateNote('no-such-note', 'anything')).toBeNull();
	});

	it('cannot move a note to another page or another book', async () => {
		const added = await addPositioned({ pageIndex: 5 });
		const row = rowOf(added.id);
		await updateNote(added.id, 'edited');
		expect(rows.get(added.id)?.pageIndex).toBe(row.pageIndex);
		expect(rows.get(added.id)?.sourceFingerprint).toBe(row.sourceFingerprint);
		expect(rows.get(added.id)?.documentId).toBe(row.documentId);
	});

	it('keeps newlines through an edit', async () => {
		const added = await addPositioned({ body: 'one line' });
		const body = 'one line\ntwo line\n';
		await updateNote(added.id, body);
		const [stored] = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		expect(stored?.body).toBe(body);
	});
});

describe('deleteNote', () => {
	it('removes the note and reports that it did', async () => {
		const added = await addPositioned({});
		expect(await deleteNote(added.id)).toBe(true);
		expect(rows.has(added.id)).toBe(false);
		expect(await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A })).toEqual([]);
	});

	it('reports false for a note that is already gone', async () => {
		const added = await addPositioned({});
		await deleteNote(added.id);
		expect(await deleteNote(added.id)).toBe(false);
	});

	it('removes only the note it was asked for', async () => {
		const keep = await addPositioned({ highlightId: HIGHLIGHT_1 });
		const drop = await addPositioned({ highlightId: HIGHLIGHT_1 });
		await deleteNote(drop.id);
		expect(await listNotesForHighlight(HIGHLIGHT_1)).toHaveLength(1);
		expect((await listNotesForHighlight(HIGHLIGHT_1))[0]?.id).toBe(keep.id);
	});
});

describe('an anchor survives a re-open', () => {
	it('hands the stored anchor back unchanged, without reading the payload', async () => {
		const anchor = frozenAnchor(12, 'the exact words');
		const added = await addPositioned({ pageIndex: 12, anchor });
		// Simulate closing the document and opening it again: a fresh
		// read through the repository, with no in-memory copy of the
		// row to fall back on.
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		const note = thePositionedNote(found);
		expect(note.id).toBe(added.id);
		expect(note.anchor).toEqual(anchor);
		// Frozen on the way in and frozen on the way out: a repository
		// that rebuilt or normalised it would have had to write to it.
		expect(Object.isFrozen(note.anchor)).toBe(true);
	});

	it('stores a refreshed anchor and leaves the body and the position alone', async () => {
		const stored = frozenAnchor(3, 'before');
		const added = await addPositioned({ pageIndex: 3, anchor: stored, body: 'a\nnote' });
		const refreshed = frozenAnchor(3, 'before');

		expect(await replaceNoteAnchor(added.id, refreshed)).toBe(true);
		const note = thePositionedNote(
			await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A }),
		);
		expect(note.anchor).toEqual(refreshed);
		expect(note.body).toBe('a\nnote');
		expect(note.pageIndex).toBe(3);
		expect(note.highlightId).toBeNull();
	});

	it('stores a refreshed anchor on a highlight-linked note too', async () => {
		const added = await addPositioned({ highlightId: HIGHLIGHT_1, anchor: frozenAnchor(1, 'a') });
		expect(await replaceNoteAnchor(added.id, frozenAnchor(1, 'a'))).toBe(true);
		const note = thePositionedNote(
			await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A }),
		);
		expect(note.highlightId).toBe(HIGHLIGHT_1);
	});

	it('reports false for a note that is not there, so a resolver cannot claim to have stored one', async () => {
		expect(await replaceNoteAnchor('no-such-note', frozenAnchor(1, 'x'))).toBe(false);
	});

	it('reports false for a free note, which has no anchor to refresh', async () => {
		const added = await addFree({});
		expect(await replaceNoteAnchor(added.id, frozenAnchor(1, 'x'))).toBe(false);
		// And the row is untouched — a free note must not grow a
		// position because a resolver asked politely.
		expect(rows.get(added.id)?.anchor).toBeUndefined();
	});
});

describe('compareNotes', () => {
	it('orders a reconciled list the same way a fresh read would', async () => {
		const free = await addFree({ body: 'free' });
		const page7 = await addPositioned({ pageIndex: 7, body: 'p7' });
		const page2 = await addPositioned({ pageIndex: 2, body: 'p2' });
		rowOf(page7.id).createdAt = 20;
		rowOf(page2.id).createdAt = 90;
		const read = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		const reconciled = [page7, free, page2].sort(compareNotes);
		expect(reconciled.map((note) => note.id)).toEqual(read.map((note) => note.id));
	});

	it('puts a free note before a positioned one, whatever their timestamps', async () => {
		const free = await addFree({});
		const positioned = await addPositioned({});
		rowOf(free.id).createdAt = 999;
		rowOf(positioned.id).createdAt = 1;
		expect([positioned, free].sort(compareNotes).map((note) => note.kind)).toEqual([
			'free',
			'positioned',
		]);
	});
});

describe('the type of a stored note', () => {
	it('reads back as the union the domain declares, with the kind intact', async () => {
		await addFree({ body: 'free' });
		await addPositioned({ body: 'placed', pageIndex: 2 });
		const found = await listNotes({ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A });
		const kinds = found.map((note: Note) => note.kind).sort();
		expect(kinds).toEqual(['free', 'positioned']);
		const placed = found.find((note) => note.kind === 'positioned');
		if (placed?.kind !== 'positioned') throw new Error('expected a positioned note');
		// A discriminated union the reader can narrow without a cast.
		const page: PageIndex | null = placed.pageIndex;
		expect(page).toBe(2);
	});
});
