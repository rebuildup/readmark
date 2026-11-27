/**
 * readmark — bookmarks repository.
 *
 * A bookmark is "the reader marked this place in this source". The
 * MVP form is the one ADR-0002 insists the product must support: a
 * page pin, with no selection behind it. `anchor` stays `null` and
 * `position` carries the same sub-page pointer reading progress uses,
 * which is what makes a jump land on the spot instead of the top of
 * the page.
 *
 * Two identity rules, both from ADR-0002 and both easy to get wrong:
 *
 *   - Rows are keyed by `documentId` **and** `sourceFingerprint`. A
 *     position in a file means nothing in a re-encoded copy of it, so
 *     the same book read from two sources keeps two bookmark lists.
 *   - `id` is a plain generated string, not a page index: a reader may
 *     mark the same page several times, and those have to stay
 *     distinguishable (ADR-0002: a bookmark is either a page pin or a
 *     selection, and several pins on one page are normal).
 *
 * Ordering is by creation time, so the panel reads as a history of
 * where the reader has been rather than as an index.
 */

import type { Anchor } from '../domain/annotation/index.ts';
import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import type { Bookmark, PageIndex } from '../domain/reading-state.ts';
import { getDb } from './db.ts';
import type { BookmarkScope } from './scope.ts';

/** Re-exported so callers can keep importing from `./bookmarks-repo.ts`
 *  without changing their call sites. */
export type { BookmarkScope } from './scope.ts';

/**
 * The one order every bookmark list is returned in, and the reason it
 * is a *total* order.
 *
 * `createdAt` first, because the panel is a history of where the
 * reader has been. It is a millisecond clock, so two marks made inside
 * the same tick tie — and a tie hands the ordering to whatever row
 * order the storage engine happened to walk, which is not a contract
 * anything may rely on. The panel renders each mark's position as an
 * ordinal (`bookmarkLabels` in `src/ui/bookmarks-panel.tsx`), so an
 * order that moved between two reads renumbers rows a reader had
 * already learned.
 *
 * `id` breaks the tie. It is the primary key, so it is unique and
 * never rewritten: it makes the order total, and because it is
 * *stored*, the same saved state returns the same order on every read
 * — this session, the next one, another device. A `id` is a v4 UUID
 * and carries no time, so this does not recover which of two marks
 * the reader made first; nothing that is stored could. It only stops
 * the list reshuffling, which is the guarantee the panel actually
 * needs. See Issue #32.
 *
 * Compared as UTF-16 code units rather than with `localeCompare`: a
 * locale-sensitive comparison would make a *stored* order depend on
 * the reader's ICU settings, which is the same instability in a
 * different costume.
 *
 * One comparator, shared by the whole-source read and the page-scoped
 * one, so a reader who jumps from the panel to the painter cannot see
 * two different orders for the same rows.
 */
function compareBookmarksByCreation(a: Bookmark, b: Bookmark): number {
	if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Every bookmark in a source, oldest first, ties broken on `id`.
 *  A scoped read plus an in-memory sort by
 *  {@link compareBookmarksByCreation}, so the panel reads as a
 *  history. */
export async function listBookmarks(scope: BookmarkScope): Promise<readonly Bookmark[]> {
	const rows = await getDb()
		.bookmarks.where('[documentId+sourceFingerprint]')
		.equals([scope.documentId, scope.sourceFingerprint])
		.toArray();
	return [...rows].sort(compareBookmarksByCreation);
}

/** Bookmarks on one page, oldest first, ties broken on `id` — the
 *  same order {@link listBookmarks} returns. Hits the
 *  `[documentId+sourceFingerprint+pageIndex]` compound index directly
 *  so the painter's query is a single indexed read. */
export async function listBookmarksOnPage(
	scope: BookmarkScope,
	pageIndex: PageIndex,
): Promise<readonly Bookmark[]> {
	const rows = await getDb()
		.bookmarks.where('[documentId+sourceFingerprint+pageIndex]')
		.equals([scope.documentId, scope.sourceFingerprint, pageIndex])
		.toArray();
	return [...rows].sort(compareBookmarksByCreation);
}

/** What the caller supplies to mark a place. The generated fields
 *  (`id`, `createdAt`) are the repository's business. */
export interface NewBookmark {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageIndex: PageIndex;
	/**
	 * The text region this mark points at, or `null` for a page pin.
	 *
	 *  Both are MVP bookmarks and they are different things. A page pin
	 *  has no selection behind it, which is what ADR-0002 requires the
	 *  product to support — a reader marks a page without selecting
	 *  anything first. A selection bookmark points at words, and carries
	 *  the anchor the reader's selection produced, stored unread for the
	 *  same reason every other anchor is.
	 */
	readonly anchor: Anchor | null;
	/** Sub-page pointer, the same shape reading progress stores. */
	readonly position: Bookmark['position'];
	/**
	 * A name the reader gave the mark, or `''` for none.
	 *
	 * Asked for when the mark is made, not edited afterwards: the panel
	 * has no rename affordance in the MVP, so a title that could only be
	 * set later would be a field no reader could ever fill in. Trimmed
	 * here rather than in the UI, because a row storing `'  '` renders
	 * as a blank label in every list that reads it.
	 */
	readonly title?: string;
}

/**
 * Mark a place. The page index and the id are independent, so the
 * same page can be marked as often as the reader likes.
 */
export async function addBookmark(input: NewBookmark): Promise<Bookmark> {
	const bookmark: Bookmark = {
		id: crypto.randomUUID(),
		documentId: input.documentId,
		sourceFingerprint: input.sourceFingerprint,
		pageIndex: input.pageIndex,
		anchor: input.anchor,
		position: input.position,
		// The title is a label the reader can scan, not a quotation of
		// the document. An empty one is legitimate: the panel falls back
		// to the page and an ordinal.
		title: input.title?.trim() ?? '',
		createdAt: Date.now(),
	};
	await getDb().bookmarks.put(bookmark);
	return bookmark;
}

/** Remove a bookmark. Returns whether the row was there, so the UI
 *  can tell "removed" from "already gone" (a second tab, or a
 *  re-render race).
 *
 *  Race: a `get` outside a transaction cannot answer the question
 *  "was there a row" atomically with the subsequent `delete` — two
 *  concurrent calls (a panel + a cross-tab sync) can both observe
 *  the row as present, both call `delete`, and both return `true`
 *  while only one is a real write. Wrapping in a `rw` transaction
 *  lets Dexie serialise the get-and-delete so the second caller
 *  reads `undefined` and returns `false`. */
export async function deleteBookmark(id: string): Promise<boolean> {
	return await getDb().transaction('rw', getDb().bookmarks, async () => {
		const existing = await getDb().bookmarks.get(id);
		if (existing === undefined) return false;
		await getDb().bookmarks.delete(id);
		return true;
	});
}
