/**
 * readmark — IndexedDB schema (Dexie).
 *
 * Tables and their boundaries are documented in ADR-0005. The schema
 * is intentionally split by concept so future migrations can evolve
 * one table without rewriting the others.
 *
 * Identity model (ADR-0002 + domain/document.ts):
 *   - `documents`       keyed by `id`              (DocumentId, UUID)
 *   - `documentSources` keyed by `sourceFingerprint` (SHA-256)
 *   - `documentBlobs`   keyed by `sourceFingerprint` (SHA-256)
 *
 * Why are `documentSources` and `documentBlobs` separate tables
 * keyed by the same fingerprint?
 *   - `documentSources` is metadata: format, byteSize, pageCount,
 *     format-specific extras. Cheap to keep; indexed.
 *   - `documentBlobs` is the bytes. Big. Evictable under quota
 *     pressure (e.g. user clears site data, or browser evicts best-
 *     effort storage).
 *   - Eviction leaves the Document and its reading state intact; the
 *     user re-imports the file when they want to read again. This
 *     is the "metadata and blob are independently evictable"
 *     invariant the architecture promises.
 *
 * Reading state is keyed by (DocumentId, SourceFingerprint):
 *   - `bookmarks`, `highlights`, `notes`, `readingProgress` all carry
 *     both keys. Compound indexes enable "list all highlights on
 *     page 7 of this PDF source of this document" in one indexed
 *     read.
 *   - `FreeNote` is the exception: no sourceFingerprint, no
 *     pageIndex. Dexie permits `undefined` in compound indexes, so
 *     the row simply has its sourceFingerprint slot empty.
 *
 * MVP schema (v0): all tables exist but only `documents` /
 * `documentSources` / `documentBlobs` are read/written by the
 * import flow. Reading-state tables are declared so future tickets
 * populate them without a schema bump.
 */

import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
	Document,
	DocumentId,
	DocumentSource,
	SourceFingerprint,
} from '../domain/document.ts';
import type { Bookmark, Highlight, Note, ReadingProgress } from '../domain/reading-state.ts';

/** Metadata-only Document record. The blob lives in `documentBlobs`. */
export type StoredDocument = Document;
export type StoredDocumentSource = DocumentSource;

export interface StoredDocumentBlob {
	readonly sourceFingerprint: string;
	blob: Blob;
	storedAt: number;
}

export type StoredBookmark = Bookmark;
export type StoredHighlight = Highlight;
export type StoredNote = Note;
export type StoredReadingProgress = ReadingProgress;

export class ReadmarkDatabase extends Dexie {
	declare documents: EntityTable<StoredDocument, 'id'>;
	declare documentSources: EntityTable<StoredDocumentSource, 'sourceFingerprint'>;
	declare documentBlobs: EntityTable<StoredDocumentBlob, 'sourceFingerprint'>;
	declare bookmarks: EntityTable<StoredBookmark, 'id'>;
	declare highlights: EntityTable<StoredHighlight, 'id'>;
	declare notes: EntityTable<StoredNote, 'id'>;
	/** Composite primary key (documentId, sourceFingerprint). */
	declare readingProgress: Table<StoredReadingProgress, [DocumentId, SourceFingerprint]>;

	constructor() {
		super('readmark');

		// v0 — initial schema.
		//
		// Indexing notes:
		//   - documentSources has [documentId+importedAt] so listing all
		//     sources of a Document in chronological order is a single
		//     indexed read.
		//   - bookmarks / highlights index on
		//     [documentId+sourceFingerprint+pageIndex] for the common
		//     "list all annotations on page N of this source" query.
		//   - notes also index on [documentId+kind] so listing all
		//     FreeNotes for a Document is fast (UX needs it for the
		//     "this book in general" panel).
		//   - readingProgress primary key is the composite
		//     [documentId+sourceFingerprint]: one row per source per
		//     document, written atomically.
		this.version(0.1).stores({
			documents: 'id, importedAt, lastReadAt',
			documentSources: 'sourceFingerprint, documentId, format, [documentId+importedAt]',
			documentBlobs: 'sourceFingerprint, storedAt',
			bookmarks:
				'id, documentId, sourceFingerprint, [documentId+sourceFingerprint+pageIndex], createdAt',
			highlights:
				'id, documentId, sourceFingerprint, [documentId+sourceFingerprint+pageIndex], createdAt',
			notes:
				'id, documentId, kind, sourceFingerprint, [documentId+kind], [documentId+sourceFingerprint+pageIndex], updatedAt, highlightId',
			readingProgress: '[documentId+sourceFingerprint], documentId, sourceFingerprint, updatedAt',
		});
	}
}

/** Singleton handle. Lazy-init so SSR / build-time never opens the
 *  DB. */
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
