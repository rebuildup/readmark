/**
 * readmark — reading-progress repository (session-scoped, ADR-0008).
 *
 * One row per (DocumentId, SourceFingerprint) pair, which is the
 * composite key the domain model already declares (ADR-0002). The
 * pair is not redundancy: progress belongs to the bytes that produced
 * it, so re-importing a re-encoded PDF must not inherit the position
 * a reader reached in a different file, and the same book in two
 * sources keeps two independent positions.
 *
 * Scope note: this is the session's "back to this page" store only.
 * Bookmarks, notes and highlights are separate maps with their own
 * repositories; they share the keying convention, not the storage.
 *
 * The stored `position` is a `DocumentPosition` (an opaque blob per
 * `domain/document.ts`), NOT an `Anchor`. It answers "roughly where
 * was this reader", and by contract it is not re-anchored: zoom,
 * rotation and renderer changes can all invalidate a sub-page
 * pointer. The promise is "back to this page", which is why the
 * page index is the field that survives and the offset is advisory.
 *
 * ADR-0008: rows live in `sessionStore.readingProgress` and die with
 * the tab — a reload starts a fresh reader, which is exactly what
 * the library's one-line notice promises.
 */

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import type { PageIndex, ReadingProgress } from '../domain/reading-state.ts';
import type { ReadingProgressKey } from './scope.ts';
import { readingProgressKey, sessionStore } from './session-store.ts';

/** Re-exported so callers can keep importing from
 *  `./reading-state-repo.ts` without changing their call sites. */
export type { ReadingProgressKey } from './scope.ts';

/** The last position for this source, or `null` when the reader has
 *  never been opened in this session. `null` is a normal state, not
 *  an error: a freshly imported document has no progress row yet. */
export async function getReadingProgress(key: ReadingProgressKey): Promise<ReadingProgress | null> {
	return (
		sessionStore.readingProgress.get(readingProgressKey(key.documentId, key.sourceFingerprint)) ??
		null
	);
}

/** Write the last position. Idempotent per key: a second write for
 *  the same source replaces the row rather than accumulating
 *  history. The caller owns the debounce; this function is one
 *  synchronous put, cheap enough to call on every settled scroll. */
export async function upsertReadingProgress(progress: ReadingProgress): Promise<void> {
	sessionStore.readingProgress.set(
		readingProgressKey(progress.documentId, progress.sourceFingerprint),
		progress,
	);
}

/** Convenience for the write path: build the row from the pieces the
 *  UI has, with `position` passed through untouched.
 *
 *  Kept here rather than in the screen because `updatedAt` belongs
 *  with the row — a repository that forgot it would leave rows that
 *  cannot be ordered by recency for the eventual library view.
 *
 *  Thin wrapper over `upsertReadingProgress`: callers that already
 *  hold a `ReadingProgress` row can write it directly through the
 *  typed entry point. */
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
	return sessionStore.readingProgress.delete(
		readingProgressKey(key.documentId, key.sourceFingerprint),
	);
}
