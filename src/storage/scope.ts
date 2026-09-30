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

/** Aliases for the three repositories. They are the same type; the
 *  names document which table each repository reads/writes. */
export type BookmarkScope = DocumentSourceKey;
export type HighlightScope = DocumentSourceKey;
export type ReadingProgressKey = DocumentSourceKey;
