/**
 * readmark — notes repository.
 *
 * A note is the reader's own writing. It is the only reading-state row
 * in this app whose content is a person rather than a place, and every
 * rule below follows from that: the body is stored exactly as typed,
 * it is never logged, and nothing in this file decides what it may
 * say.
 *
 * ## Two things have identities, and they are not the same
 *
 * The **note's** identity is its `id` — a generated string, exactly
 * like a bookmark's or a highlight's. The reader may write three notes
 * about one highlight on one page, and those have to stay
 * distinguishable, so the id cannot be derived from the position.
 *
 * The **note's target's** identity is `(documentId, sourceFingerprint)`
 * plus, for anything positional, `pageIndex` and an `Anchor`
 * (ADR-0002 / ADR-0007). This is the rule the whole reading-state
 * layer is built on: a position in a file means nothing in a re-encoded
 * copy of it, so the same book read from two sources keeps two note
 * lists. Keying notes by `documentId` alone — which the issue's
 * shorthand `listNotes(fingerprint)` invites — would let a note written
 * against one copy of a book surface in another.
 *
 * ## Why `NewNote` is a discriminated union
 *
 * `domain/reading-state.ts` types the stored row as
 * `FreeNote | PositionedNote`, and the input mirrors it. An input whose
 * position fields were all optional would accept
 * `{ kind: 'positioned', documentId, pageIndex }` with no
 * `sourceFingerprint` — a page number in no particular file, which is
 * the exact class of bug the union exists to prevent. Making the input
 * a union means the compiler rejects it.
 *
 * ## `highlightId` is optional, and absence has to be absence
 *
 * A note may hang off a highlight or stand on its own. The field is
 * `string | null` in the domain, and this repository keeps that a real
 * distinction rather than a formatting one:
 *
 *   - {@link normalizeHighlightId} folds `undefined`, `null` and blank
 *     to `null` on the way in, so "no highlight" is one stored value
 *     and not three spellings of it.
 *   - IndexedDB does not put a row with a `null` key into an index at
 *     all, so a note with no highlight is *absent* from the
 *     `highlightId` index. {@link listNotesForHighlight} therefore
 *     cannot return it — not because it filters, but because the
 *     browser never indexed it. That is the property worth having: a
 *     query for a highlight cannot match a note that has none, however
 *     the null is spelled.
 *
 * ## Queries, and the index each one uses
 *
 * The `notes` table declares seven indexes (see `db.ts`). Each
 * function here names the one it reads, because an unnamed query in
 * this layer is how a table scan gets shipped under a test that fakes
 * the database:
 *
 *   - {@link listNotes} reads `[documentId+kind]` for the document's
 *     free notes and takes a *range* over
 *     `[documentId+sourceFingerprint+pageIndex]` for the positioned
 *     ones. Two indexed reads, because the two shapes are in two index
 *     ranges — a free note has no source and no page, so it is not in
 *     the second index at all, and reading it there would be a scan.
 *   - {@link listNotesForHighlight} reads the `highlightId` index
 *     directly. This is a single-column index, so it is an indexed
 *     equality read, not a filter over every note.
 *
 * ## Ordering
 *
 * Free notes first, then positioned notes by page and then by when
 * they were written, tie-broken on `id`. Free notes first because they
 * are about the book rather than about a place, and a list of places
 * has nowhere to put a row that is not one. Within a page, creation
 * order is the only order that means anything. The `id` tie-break is
 * not cosmetic: two notes written in the same millisecond would
 * otherwise come back in whatever order IndexedDB hands them out, and a
 * panel that re-renders is a panel that flickers.
 *
 * {@link compareNotes} is exported so a caller reconciling a local list
 * after a write orders it the same way a fresh read would.
 *
 * ## A note outlives its highlight
 *
 * Nothing here cascades. `deleteHighlight` does not reach for notes,
 * and this repository does not reach for highlights: a dangling
 * `highlightId` is a fact about a row, not a licence to delete a
 * reader's writing because they took a colour band off. A note with a
 * dangling link still lists, still edits, still deletes, and its jump
 * falls back to the note's own position.
 *
 * The one mutation a resolver may cause is {@link replaceNoteAnchor},
 * the write-back for `ResolvedAnchor.updatedAnchor` — the same
 * exception `highlights-repo.ts` makes, for the same reason. A note's
 * anchor is read on reopen, refreshed against the file in front of the
 * reader, and stored back. A resolver answering `null` is not a reason
 * to delete anything: it says this reader cannot resolve this anchor
 * against this source, which is a fact about a file the reader may not
 * even hold the whole of.
 *
 * ## The body is user content
 *
 * `body` is stored verbatim. Not trimmed, not collapsed, not
 * normalised: a trailing newline is content, and a repository that
 * "tidied" it would hand back a note the reader did not write. The
 * multi-line property is the reason `listNotes` never trims and the
 * reason the editor is a `<textarea>` over a `white-space: pre-wrap`
 * element — see `src/ui/note-editor.tsx`.
 *
 * No function in this file logs a body, and none may start. A body is
 * the reader's own writing; a stack trace that carries one puts it in
 * a console, a log aggregator, and a bug report.
 */

import Dexie from 'dexie';
import type { Anchor } from '../domain/annotation/index.ts';
import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import type { Note, PageIndex, PositionedNote } from '../domain/reading-state.ts';
import { getDb } from './db.ts';
import type { NoteScope } from './scope.ts';

/** Re-exported so callers can keep importing from `./notes-repo.ts`
 *  without changing their call sites. */
export type { NoteScope } from './scope.ts';

/** A note about the book, with no position. */
export interface NewFreeNote {
	readonly kind: 'free';
	readonly documentId: DocumentId;
	/** Stored exactly as given. See the file header. */
	readonly body: string;
	/** Attach to a highlight, or omit for a note that stands alone. */
	readonly highlightId?: string | null;
}

/** A note attached to a place in one specific source. */
export interface NewPositionedNote {
	readonly kind: 'positioned';
	readonly documentId: DocumentId;
	/** Which physical source this note is about. Not optional: a page
	 *  number in no particular file is not a position. */
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageIndex: PageIndex;
	/** Text-region anchor, or `null` for a note pinned to a page with
	 *  no selection behind it. Stored unread — the payload is the
	 *  format's (ADR-0007). */
	readonly anchor: Anchor | null;
	readonly body: string;
	readonly highlightId?: string | null;
}

/**
 * What the caller supplies to write a note. A union, not a bag of
 * optional position fields — see the file header.
 */
export type NewNote = NewFreeNote | NewPositionedNote;

/**
 * A note's position without its body — what a UI fixes when the reader
 * opens the editor and what it passes back on a save.
 *
 * Spelled out as a union rather than `Omit<NewNote, 'body'>` because
 * `Omit` distributes over the *common* keys of a union, which would
 * leave a target that is neither a free note's nor a positioned note's
 * and could be saved as either. Written this way, the shape a save is
 * aimed at is the shape the editor was opened for.
 */
export type NoteTarget = Omit<NewFreeNote, 'body'> | Omit<NewPositionedNote, 'body'>;

/**
 * One stored highlight link, or none.
 *
 * Blank is not a highlight. Ids are generated UUIDs, so `''` cannot
 * name a row that exists, and storing it would create a note that
 * claims an attachment to nothing. The stored value is trimmed: a
 * generated id never has surrounding whitespace, so trimming cannot
 * corrupt a real one, and it means `" "`, `""` and `undefined` cannot
 * end up as three different spellings of "none".
 */
function normalizeHighlightId(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

/**
 * Write a note.
 *
 * The generated fields (`id`, `createdAt`, `updatedAt`) are the
 * repository's business; the body and the position are the caller's,
 * stored exactly as given.
 */
export async function addNote(input: NewNote): Promise<Note> {
	const createdAt = Date.now();
	const highlightId = normalizeHighlightId(input.highlightId);
	const id = crypto.randomUUID();
	const note: Note =
		input.kind === 'free'
			? {
					id,
					kind: 'free',
					documentId: input.documentId,
					body: input.body,
					highlightId,
					createdAt,
					updatedAt: createdAt,
				}
			: {
					id,
					kind: 'positioned',
					documentId: input.documentId,
					sourceFingerprint: input.sourceFingerprint,
					pageIndex: input.pageIndex,
					anchor: input.anchor,
					body: input.body,
					highlightId,
					createdAt,
					updatedAt: createdAt,
				};
	await getDb().notes.put(note);
	return note;
}

/**
 * Replace a note's body. Returns the stored row, or `null` when there
 * is no row with that id.
 *
 * Only `body` and `updatedAt` are written. `createdAt` is history and
 * does not move; the position, the anchor and the highlight link are
 * not the editor's to change, and a save that could rewrite them would
 * let a note edited on a different page silently jump somewhere else.
 *
 * The count is the answer: `null` means the repository knows the row is
 * gone — another tab, or the reader themselves. Returning a
 * half-applied row would let the UI keep a note that is not on disk.
 */
export async function updateNote(id: string, body: string): Promise<Note | null> {
	const changed = await getDb().notes.update(id, { body, updatedAt: Date.now() });
	if (changed === 0) return null;
	return (await getDb().notes.get(id)) ?? null;
}

/**
 * Remove a note. Returns whether the row was there, so the UI can tell
 * "removed" from "already gone".
 *
 * Race: same shape as `bookmarks-repo.deleteBookmark` — a `get` outside
 * a transaction cannot answer "was there a row" atomically with the
 * subsequent `delete`, so two concurrent callers can both observe the
 * row and both return `true`. Wrapping in `rw` lets Dexie serialise the
 * pair.
 *
 * Deleting a note never touches its highlight, and deleting a
 * highlight never touches its notes. See the file header.
 */
export async function deleteNote(id: string): Promise<boolean> {
	return await getDb().transaction('rw', getDb().notes, async () => {
		const existing = await getDb().notes.get(id);
		if (existing === undefined) return false;
		await getDb().notes.delete(id);
		return true;
	});
}

/**
 * The order a notes list reads in: free notes first, then positioned
 * notes by page and then by when they were written, tie-broken on `id`
 * so two notes written in the same millisecond keep a stable order.
 *
 * Exported because a caller that reconciles a local list after a write
 * has to order it the way a fresh read would, and re-deriving the rule
 * in the UI is how the two drift apart.
 */
export function compareNotes(a: Note, b: Note): number {
	if (a.kind !== b.kind) return a.kind === 'free' ? -1 : 1;
	if (a.kind === 'positioned' && b.kind === 'positioned' && a.pageIndex !== b.pageIndex) {
		return a.pageIndex - b.pageIndex;
	}
	return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Every note in one source of one document: the document's free notes
 * plus its positioned notes in this source.
 *
 * A free note has no source, so it belongs to the *document*, not to a
 * source — which is why {@link NoteScope} is the upper bound of the
 * result rather than a key every row carries. A document read from two
 * sources shows its free notes in both, because they say the same
 * thing in both; its positioned notes do not appear in both, because
 * page 47 of one file is not page 47 of another.
 *
 * Two indexed reads, in parallel:
 *   - `[documentId+kind]` equals `[documentId, 'free']`.
 *   - a range over `[documentId+sourceFingerprint+pageIndex]` from
 *     `[documentId, fingerprint, Dexie.minKey]` to
 *     `[documentId, fingerprint, Dexie.maxKey]`, which is every page
 *     of this source and nothing outside it. The two leading
 *     components pin the range to one source, so the read never
 *     widens into the rest of the table.
 *
 * A note on another document, or on another source of this document,
 * is not in either range and cannot come back.
 */
export async function listNotes(scope: NoteScope): Promise<readonly Note[]> {
	const [free, positioned] = await Promise.all([
		getDb().notes.where('[documentId+kind]').equals([scope.documentId, 'free']).toArray(),
		getDb()
			.notes.where('[documentId+sourceFingerprint+pageIndex]')
			.between(
				[scope.documentId, scope.sourceFingerprint, Dexie.minKey],
				[scope.documentId, scope.sourceFingerprint, Dexie.maxKey],
			)
			.toArray(),
	]);
	return [...free, ...positioned].sort(compareNotes);
}

/**
 * The notes attached to one highlight, oldest first.
 *
 * Reads the `highlightId` index directly — a single-column index, so
 * this is an indexed equality read and not a filter over every note in
 * the table.
 *
 * A note with no highlight is not in that index at all: IndexedDB
 * refuses a `null` key, so the row is never indexed and no value of
 * `highlightId` can reach it. A blank id is refused here for the same
 * reason from the other side — there is no highlight called `''`, so
 * the honest answer is none rather than whatever a loose comparison
 * turned up.
 *
 * The result is not scoped to a document. A highlight id is globally
 * unique, and narrowing the query by a document would be a second
 * invariant to keep in step for no answer a reader can act on.
 */
export async function listNotesForHighlight(highlightId: string): Promise<readonly Note[]> {
	const id = normalizeHighlightId(highlightId);
	if (id === null) return [];
	const rows = await getDb().notes.where('highlightId').equals(id).toArray();
	return [...rows].sort(compareNotes);
}

/**
 * Store a refreshed anchor — the write-back for
 * `ResolvedAnchor.updatedAnchor`, and the only mutation on this table
 * that does not come from a reader action.
 *
 * This is what makes a note's position survive a re-open. The stored
 * rects were measured against whichever copy of the file the reader
 * had when they wrote it; recovery re-measures them against the copy in
 * front of them now and hands the result back, and somebody has to
 * store it. The payload is not read — it is the format's, the resolver
 * produced it, and inspecting it here would be the format-specific
 * reading ADR-0007 forbids outside `reader/<format>/`.
 *
 * Returns whether the row was there and could carry the new anchor.
 * A free note answers `false`: it has no anchor to refresh, and a
 * refresh that claimed to have written one would be storing a field
 * the shape does not have. `false` also means "this reader has just
 * decided an anchor is valid and is telling you there is nothing to
 * store it on" — a resolver is not in a position to create the note.
 *
 * A read-modify-write inside a transaction rather than a bare
 * `Table.update`. The reason is the union: `Note` is `FreeNote |
 * PositionedNote`, and Dexie builds `UpdateSpec` / `InsertType` from
 * `keyof T` — the keys the two members *share* — so a single-field
 * update naming `anchor` has no shape here, and so does an insert
 * object literal that carries it. `put` also accepts the full row type,
 * which is the door this goes through. The narrowing is not a cast
 * around a type problem: it is a real fact about the row, and the
 * transaction is what makes the read and the write atomic against a
 * concurrent `updateNote` (Dexie serialises transactions over the same
 * tables).
 */
export async function replaceNoteAnchor(id: string, anchor: Anchor): Promise<boolean> {
	return await getDb().transaction('rw', getDb().notes, async () => {
		const existing = await getDb().notes.get(id);
		if (existing === undefined) return false;
		if (existing.kind !== 'positioned') return false;
		// Named as `PositionedNote` rather than inlined into `put`: the
		// narrowing above is what makes the spread a positioned note,
		// and a named binding is the compiler's record of that. Dexie
		// accepts the full row type on `put`, which is what makes this
		// write possible at all — see the note on `InsertType` above.
		const refreshed: PositionedNote = { ...existing, anchor };
		await getDb().notes.put(refreshed);
		return true;
	});
}

/**
 * Whether a note points at a highlight.
 *
 * Exported as a named predicate because "does this note hang off a
 * mark" is asked by every surface that offers a jump, and answering it
 * as `note.highlightId !== null` at each call site is how one of them
 * ends up testing a trimmed value against an untrimmed one.
 */
export function isHighlightLinked(note: Note): boolean {
	return normalizeHighlightId(note.highlightId) !== null;
}
