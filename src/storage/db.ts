/**
 * readmark — IndexedDB schema (Dexie).
 *
 * Tables and their boundaries are documented in ADR-0005. The schema is
 * intentionally split by concept (documents / reading-state / notes) so
 * future migrations can evolve one table without rewriting the others.
 *
 * MVP schema (v0): all tables exist but only `documents` is read/written.
 * Reading-state tables are declared so future PRs can populate them
 * without a schema bump.
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Document } from '../domain/document.ts';
import type { Bookmark, Highlight, Note, ReadingProgress } from '../domain/reading-state.ts';

/**
 * Stored document record. The blob is stored separately under
 * `documentBlobs` so it can be evicted independently if quota gets tight.
 */
export interface StoredDocument extends Document {
	/** Bytes of the original document. Held lazily — release to free memory. */
	blob: Blob;
}

export interface DocumentBlobRecord {
	readonly fingerprint: string;
	blob: Blob;
	storedAt: number;
}

export interface StoredBookmark extends Bookmark {}
export interface StoredHighlight extends Highlight {}
export interface StoredNote extends Note {}
export interface StoredReadingProgress extends ReadingProgress {}

export class ReadmarkDatabase extends Dexie {
	declare documents: EntityTable<StoredDocument, 'fingerprint'>;
	declare documentBlobs: EntityTable<DocumentBlobRecord, 'fingerprint'>;
	declare bookmarks: EntityTable<StoredBookmark, 'id'>;
	declare highlights: EntityTable<StoredHighlight, 'id'>;
	declare notes: EntityTable<StoredNote, 'id'>;
	declare readingProgress: EntityTable<StoredReadingProgress, 'documentFingerprint'>;

	constructor() {
		super('readmark');

		// v0 — initial schema. Compound indexes are scoped per-document so
		// we can list all bookmarks/highlights/notes for one document with
		// a single indexed read.
		this.version(0.1).stores({
			documents: 'fingerprint, format, importedAt, lastReadAt',
			documentBlobs: 'fingerprint, storedAt',
			bookmarks: 'id, documentFingerprint, [documentFingerprint+pageIndex], createdAt',
			highlights: 'id, documentFingerprint, [documentFingerprint+pageIndex], createdAt',
			notes: 'id, documentFingerprint, [documentFingerprint+pageIndex], updatedAt, highlightId',
			readingProgress: 'documentFingerprint, updatedAt',
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
