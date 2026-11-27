/**
 * readmark — shared scope types for storage repositories.
 *
 * `BookmarkScope`, `HighlightScope`, and `ReadingProgressKey` are three
 * identical `(documentId, sourceFingerprint)` pairs spread across the
 * three reading-state repositories. They are named objects rather than
 * two positional arguments because both keys are branded strings: a
 * positional pair would typecheck on a swap, and the bug would be a
 * silent scope violation in the reader.
 *
 * Centralising the type here means new repositories pick it up by
 * importing, not by re-declaring, and the keys appear identically
 * across the storage layer. Domain stays unchanged — the brand types
 * still live in `domain/document.ts` per ADR-0007.
 */

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';

/** The two keys every reading-state row is scoped by. */
export interface DocumentSourceKey {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
}

/** Aliases for the four repositories. They are the same type; the
 *  names document which table each repository reads/writes.
 *
 *  `NoteScope` is the same pair for a *different* reason than the other
 *  three, and the difference is worth stating because it is the whole
 *  point of the notes repository: a `FreeNote` has no position and so
 *  no source to be scoped by, and the notes repository answers for it
 *  by document alone. The scope type is the *upper* bound of what a
 *  notes query can return, not a claim that every row it returns
 *  carries both keys. See `notes-repo.ts`. */
export type BookmarkScope = DocumentSourceKey;
export type HighlightScope = DocumentSourceKey;
export type NoteScope = DocumentSourceKey;
export type ReadingProgressKey = DocumentSourceKey;
