/**
 * readmark — reading-progress repository.
 *
 * One row per (DocumentId, SourceFingerprint) pair, which is the
 * composite primary key the schema already declares (ADR-0002). The
 * pair is not redundancy: progress belongs to the bytes that produced
 * it, so re-importing a re-encoded PDF must not inherit the position
 * a reader reached in a different file, and the same book in two
 * sources keeps two independent positions.
 *
 * Scope note: this is the persistence for #5 only. Bookmarks, notes
 * and highlights are separate tables with their own repositories
 * (#6, #8, #7); they share the keying convention, not the table.
 *
 * The stored `position` is a `DocumentPosition` (an opaque blob per
 * `domain/document.ts`), NOT an `Anchor`. It answers "roughly where
 * was this reader", and by contract it is not re-anchored: zoom,
 * rotation and renderer changes can all invalidate a sub-page
 * pointer. The MVP promise is "back to this page", which is why the
 * page index is the field that survives and the offset is advisory.
 */

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import type { PageIndex, ReadingProgress } from '../domain/reading-state.ts';
import { getDb } from './db.ts';

/** Both keys of the composite primary key. Named so no call site can
 *  pass them in the wrong order — they are both strings, so nothing
 *  in the types would catch a swap. */
export interface ReadingProgressKey {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
}

/** The last position for this source, or `null` when the reader has
 *  never been opened. `null` is a normal state, not an error: a
 *  freshly imported document has no progress row yet. */
export async function getReadingProgress(key: ReadingProgressKey): Promise<ReadingProgress | null> {
	const row = await getDb().readingProgress.get([key.documentId, key.sourceFingerprint]);
	return row ?? null;
}

/** Write the last position. Idempotent per key: the table's primary
 *  key is the pair, so a second write for the same source replaces
 *  the row rather than accumulating history. The caller owns the
 *  debounce; this function is one read-modify-free write, cheap
 *  enough to call on every settled scroll. */
export async function upsertReadingProgress(progress: ReadingProgress): Promise<void> {
	await getDb().readingProgress.put(progress);
}

/** Convenience for the write path: build the row from the pieces the
 *  UI has, with `position` passed through untouched.
 *
 *  Kept here rather than in the screen because `updatedAt` is a
 *  storage concern — a repository that forgets it would leave rows
 *  that cannot be ordered by recency for the eventual library view. */
export async function saveReadingPosition(params: {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
	readonly currentPage: PageIndex;
	readonly position: ReadingProgress['position'];
}): Promise<void> {
	await upsertReadingProgress({
		documentId: params.documentId,
		sourceFingerprint: params.sourceFingerprint,
		currentPage: params.currentPage,
		position: params.position,
		updatedAt: Date.now(),
	});
}

/** Remove the stored position. Returns whether a row was there, so
 *  a caller can tell "cleared" from "was never there" — the reader
 *  uses it when a document is re-read from the beginning after the
 *  reader asks to forget it. */
export async function deleteReadingProgress(key: ReadingProgressKey): Promise<boolean> {
	// Dexie 4 types `Table.delete` as resolving to `void`, so "was
	// there a row" has to be answered by reading it first. This is
	// the only delete in the reading-state layer, so the extra read is
	// not worth a workaround.
	const existing = await getReadingProgress(key);
	if (existing === null) return false;
	await getDb().readingProgress.delete([key.documentId, key.sourceFingerprint]);
	return true;
}
