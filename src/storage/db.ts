/**
 * readmark — IndexedDB schema (Dexie).
 *
 * Tables and their boundaries are documented in ADR-0005. The schema is
 * intentionally split by concept (documents / sources / reading-state /
 * notes) so future migrations can evolve one table without rewriting
 * the others.
 *
 * Identity model (ADR-0002 + domain/document.ts):
 *   - `documents`     keyed by `id` (DocumentId, UUID)
 *   - `documentBlobs` keyed by `sourceFingerprint` (SHA-256)
 *   - Reading state (bookmarks / highlights / notes /
 *     readingProgress) keyed by `documentId`. Highlights also carry
 *     `sourceFingerprint` because a highlight is a position in
 *     specific bytes.
 *
 * MVP schema (v0): all tables exist but only `documents` /
 * `documentBlobs` are read/written. Reading-state tables are declared
 * so future PRs can populate them without a schema bump.
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Document } from '../domain/document.ts';
import type { Bookmark, Highlight, Note, ReadingProgress } from '../domain/reading-state.ts';

/**
 * Stored document record. The blob is stored separately under
 * `documentBlobs` so it can be evicted independently if quota gets
 * tight.
 */
export interface StoredDocument extends Document {
	/** Bytes of the original document. Held lazily — release to free
	 *  memory. */
	blob: Blob;
}

/** A physical source. Today: always 1:1 with a Document. Future: one
 *  Document may own multiple sources. */
export interface DocumentBlobRecord {
	readonly sourceFingerprint: string;
	readonly documentId: string;
	blob: Blob;
	storedAt: number;
}

export interface StoredBookmark extends Bookmark {}
export interface StoredHighlight extends Highlight {}
export interface StoredNote extends Note {}
export interface StoredReadingProgress extends ReadingProgress {}

export class ReadmarkDatabase extends Dexie {
	declare documents: EntityTable<StoredDocument, 'id'>;
	declare documentBlobs: EntityTable<DocumentBlobRecord, 'sourceFingerprint'>;
	declare bookmarks: EntityTable<StoredBookmark, 'id'>;
	declare highlights: EntityTable<StoredHighlight, 'id'>;
	declare notes: EntityTable<StoredNote, 'id'>;
	declare readingProgress: EntityTable<StoredReadingProgress, 'documentId'>;

	constructor() {
		super('readmark');

		// v0 — initial schema. Compound indexes are scoped per-document so
		// we can list all bookmarks/highlights/notes for one document
		// with a single indexed read. Highlights also index by
		// sourceFingerprint for the future "show me highlights in this
		// specific source" query.
		this.version(0.1).stores({
			documents: 'id, sourceFingerprint, format, importedAt, lastReadAt',
			documentBlobs: 'sourceFingerprint, documentId, storedAt',
			bookmarks: 'id, documentId, [documentId+pageIndex], createdAt',
			highlights: 'id, documentId, sourceFingerprint, [documentId+pageIndex], createdAt',
			notes: 'id, documentId, [documentId+pageIndex], updatedAt, highlightId',
			readingProgress: 'documentId, updatedAt',
		});
	}
}

/** Singleton handle. Lazy-init so SSR / build-time never opens the DB. */
let _db: ReadmarkDatabase | null = null;

export function getDb(): ReadmarkDatabase {
	if (typeof indexedDB === 'undefined') {
		throw new Error('readmark: IndexedDB is not available in this environment');
	}
	if (!_db) {
		_db = new ReadmarkDatabase();
	}
	return _db;
}
