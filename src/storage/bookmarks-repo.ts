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

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import type { Bookmark, PageIndex } from '../domain/reading-state.ts';
import { getDb } from './db.ts';

/** The two keys a bookmark list is scoped by. A named object rather
 *  than two arguments, because both are branded strings and a swap
 *  would typecheck. */
export interface BookmarkScope {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
}

/** Every bookmark in a source, oldest first. */
export async function listBookmarks(scope: BookmarkScope): Promise<readonly Bookmark[]> {
	return await getDb()
		.bookmarks.where('documentId')
		.equals(scope.documentId)
		.filter((row) => row.sourceFingerprint === scope.sourceFingerprint)
		.sortBy('createdAt');
}

/** Bookmarks on one page, oldest first — the query the reader's
 *  "what did I mark here" affordance needs. */
export async function listBookmarksOnPage(
	scope: BookmarkScope,
	pageIndex: PageIndex,
): Promise<readonly Bookmark[]> {
	return (await listBookmarks(scope)).filter((row) => row.pageIndex === pageIndex);
}

/** What the caller supplies to mark a place. The generated fields
 *  (`id`, `createdAt`) are the repository's business. */
export interface NewBookmark {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageIndex: PageIndex;
	/** Always `null` in the MVP: selecting text and turning it into an
	 *  `Anchor` is #7, and a bookmark that claimed an anchor without
	 *  one would be a quote it cannot honour. */
	readonly anchor: null;
	/** Sub-page pointer, the same shape reading progress stores. */
	readonly position: Bookmark['position'];
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
		// the document. Numbering within the source keeps several marks
		// on one page distinguishable without inventing titles.
		title: '',
		createdAt: Date.now(),
	};
	await getDb().bookmarks.put(bookmark);
	return bookmark;
}

/** Remove a bookmark. Returns whether the row was there, so the UI
 *  can tell "removed" from "already gone" (a second tab, or a
 *  re-render race). */
export async function deleteBookmark(id: string): Promise<boolean> {
	// Dexie 4 types `Table.delete` as `void`, so "was there a row" is
	// answered by reading first. Bookmark lists are small and a single
	// delete is not a hot path.
	const existing = await getDb().bookmarks.get(id);
	if (existing === undefined) return false;
	await getDb().bookmarks.delete(id);
	return true;
}
