/**
 * readmark — documents repository.
 *
 * The "library" surface reads/writes through this module. Generic
 * code must NOT bypass this layer to touch Dexie directly; the
 * IndexedDB schema is a storage concern, not a domain concern.
 *
 * Identity model (see `domain/document.ts`):
 *   - On import: compute sourceFingerprint from bytes.
 *   - If a DocumentSource with that fingerprint already exists,
 *     refresh its blob + format-specific metadata in place; the
 *     DocumentId is preserved.
 *   - Else: mint a fresh DocumentId, create a Document, attach a
 *     DocumentSource, and store the DocumentBlob — all in one
 *     transaction.
 *
 * MVP is 1:1 (one Document ↔ one DocumentSource). The repository
 * already supports the 1:N case in shape; the only thing missing is
 * a UX that asks "do you want to attach this as a second source?"
 * (out of MVP scope).
 *
 * Blob handling:
 *   - The Blob lives ONLY in `documentBlobs`. The `documents` table
 *     holds metadata only.
 *   - Eviction policy: future work. The architectural promise is
 *     that eviction can drop `documentBlobs` rows without touching
 *     `documents` or any reading-state table.
 */

import type {
	Document,
	DocumentFormat,
	DocumentId,
	DocumentMetadata,
	DocumentSource,
	SourceFingerprint,
	SourceMetadata,
} from '../domain/document.ts';
import { fingerprintBlob } from '../lib/fingerprint.ts';
import { getDb } from './db.ts';

/** A row in the library list: one Document plus its "primary"
 *  source. The primary source is the most recently imported one
 *  (and in MVP the only one). The UI uses this for display; the
 *  repository uses it for navigation. */
export interface LibraryEntry {
	readonly document: Document;
	readonly primarySource: DocumentSource;
}

/** List the library. Order: most recently read first, then
 *  never-opened documents in import order. */
export async function listLibrary(): Promise<readonly LibraryEntry[]> {
	const db = getDb();

	const docs = await db.documents.toArray();
	const entries = await Promise.all(
		docs.map(async (document) => {
			const primarySource = await getPrimarySource(document.id);
			return primarySource ? { document, primarySource } : null;
		}),
	);

	return entries
		.filter((e): e is LibraryEntry => e !== null)
		.sort((a, b) => {
			const aT = a.document.lastReadAt ?? a.document.importedAt;
			const bT = b.document.lastReadAt ?? b.document.importedAt;
			return bT - aT;
		});
}

/** Fetch a Document by its logical id. Does NOT load sources or
 *  blobs — callers that need them ask explicitly. */
export async function getDocument(id: DocumentId): Promise<Document | null> {
	const row = await getDb().documents.get(id);
	return row ?? null;
}

/** List all sources of a Document, ordered by import time
 *  (oldest first). */
export async function listDocumentSources(
	documentId: DocumentId,
): Promise<readonly DocumentSource[]> {
	return getDb()
		.documentSources.where('[documentId+importedAt]')
		.between([documentId, 0], [documentId, Number.MAX_SAFE_INTEGER])
		.toArray();
}

/** The "primary" source of a Document. MVP uses the oldest source
 *  (which is the only source). When multi-source UI lands, this
 *  becomes "the source the reader last opened, or the oldest if
 *  never opened." */
export async function getPrimarySource(documentId: DocumentId): Promise<DocumentSource | null> {
	const sources = await listDocumentSources(documentId);
	return sources[0] ?? null;
}

export async function getDocumentSource(
	sourceFingerprint: SourceFingerprint,
): Promise<DocumentSource | null> {
	const row = await getDb().documentSources.get(sourceFingerprint);
	return row ?? null;
}

/** Load the bytes for a source. Returns null if the bytes have been
 *  evicted; the UI must surface that the user needs to re-import. */
export async function getDocumentBlob(sourceFingerprint: SourceFingerprint): Promise<Blob | null> {
	const row = await getDb().documentBlobs.get(sourceFingerprint);
	return row?.blob ?? null;
}

/** Options for `importDocument`. The two metadata buckets are
 *  separated because they belong to different tables — Document
 *  metadata is user-facing book identity, DocumentSource metadata
 *  is file-derived. */
export interface ImportOptions {
	readonly documentMetadata?: DocumentMetadata;
	readonly sourceMetadata?: SourceMetadata;
}

/** The identity pair returned by `importDocument`. Callers that
 *  need both keys (the library import flow in #3, e.g. to show
 *  "this is the same file as X") get them in a single object so
 *  we do not re-hash the blob after the IndexedDB commit. */
export interface ImportResult {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
}

/** Import (or re-import) a file. Idempotent by SourceFingerprint:
 *  re-importing the same bytes refreshes the source record and
 *  its blob. Returns the (preserved or minted) DocumentId plus
 *  the physical SourceFingerprint (which the caller already
 *  knows is the dedup key — we just return it so the caller
 *  does not have to re-hash). */
export async function importDocument(
	blob: Blob,
	format: DocumentFormat,
	options: ImportOptions = {},
): Promise<ImportResult> {
	const sourceFingerprint = await fingerprintBlob(blob);
	const now = Date.now();
	const db = getDb();
	const { documentMetadata = {}, sourceMetadata = {} } = options;

	const id = await db.transaction(
		'rw',
		db.documents,
		db.documentSources,
		db.documentBlobs,
		async () => {
			// Dedup by physical identity.
			const existing = await db.documentSources.get(sourceFingerprint);
			if (existing) {
				await db.documentSources.update(sourceFingerprint, {
					format,
					byteSize: blob.size,
					metadata: sourceMetadata,
				});
				await db.documentBlobs.put({
					sourceFingerprint,
					blob,
					storedAt: now,
				});
				return existing.documentId;
			}

			// New source → mint a Document and its first Source together.
			const id = crypto.randomUUID() as DocumentId;

			await db.documents.put({
				id,
				metadata: documentMetadata,
				importedAt: now,
				lastReadAt: null,
			});
			await db.documentSources.put({
				sourceFingerprint,
				documentId: id,
				format,
				byteSize: blob.size,
				importedAt: now,
				metadata: sourceMetadata,
			});
			await db.documentBlobs.put({
				sourceFingerprint,
				blob,
				storedAt: now,
			});
			return id;
		},
	);

	return { documentId: id, sourceFingerprint };
}

/** Bump `Document.lastReadAt`. Called by the reader whenever a
 *  source of this Document is opened. */
export async function touchLastReadAt(id: DocumentId): Promise<void> {
	await getDb().documents.update(id, { lastReadAt: Date.now() });
}

/** How many rows a `deleteDocument` call removed, per table. Kept as
 *  a summary rather than a boolean so the UI can tell the user what
 *  is gone (e.g. "3 highlights and 1 bookmark will be deleted too")
 *  and so tests can assert the cascade without reading IndexedDB. */
export interface DeleteDocumentSummary {
	readonly documentId: DocumentId;
	readonly sources: number;
	readonly blobs: number;
	readonly bookmarks: number;
	readonly highlights: number;
	readonly notes: number;
	readonly readingProgress: number;
}

/**
 * Delete a Document and everything that belongs to it, in ONE
 * transaction.
 *
 * Why the cascade is mandatory (ADR-0002):
 *   - Reading state is keyed by `DocumentId` + `SourceFingerprint`.
 *     Leaving `bookmarks` / `highlights` / `notes` /
 *     `readingProgress` rows behind would orphan them: the
 *     `documentId` they point at no longer exists, so nothing could
 *     ever list or resolve them, and the rows would accumulate
 *     forever in IndexedDB. The MVP writes none of these rows yet
 *     (the tables exist so future tickets need no schema bump), but
 *     the repository already has to be correct once they do.
 *   - `documentBlobs` is keyed by `SourceFingerprint`, not by
 *     `DocumentId`, so we must read the Document's sources first and
 *     then delete the matching blobs. The bytes are the whole point
 *     of the delete (quota), so a metadata-only delete would be a
 *     silent no-op for the user's disk usage.
 *
 * Returns `null` when the Document does not exist. The caller
 * distinguishes "already gone" from "deleted" without a second
 * read, and maps `null` to a typed `not-found` error.
 *
 * Deletion is intentionally NOT undoable in the MVP. ADR-0002
 * treats reading state as cheap and re-derivable-by-reimport only
 * for bytes; restoring highlights from a deleted document would
 * require an undo buffer we do not have. The UI must confirm first.
 */
export async function deleteDocument(id: DocumentId): Promise<DeleteDocumentSummary | null> {
	const db = getDb();

	return await db.transaction(
		'rw',
		// Array form: Dexie's positional overload tops out at five
		// tables, and the cascade needs eight.
		[
			db.documents,
			db.documentSources,
			db.documentBlobs,
			db.bookmarks,
			db.highlights,
			db.notes,
			db.readingProgress,
		],
		async () => {
			const document = await db.documents.get(id);
			if (!document) return null;

			// Blobs are keyed by fingerprint, so read the sources
			// before deleting anything.
			const sources = await db.documentSources.where('documentId').equals(id).toArray();

			const [sourcesRemoved, bookmarks, highlights, notes, readingProgress] = await Promise.all([
				db.documentSources.where('documentId').equals(id).delete(),
				db.bookmarks.where('documentId').equals(id).delete(),
				db.highlights.where('documentId').equals(id).delete(),
				db.notes.where('documentId').equals(id).delete(),
				db.readingProgress.where('documentId').equals(id).delete(),
			]);

			// One indexed delete over the primary keys, not
			// `Table.delete()` per source: `Table.delete` resolves to
			// `void` in Dexie 4 while `Collection.delete` returns the
			// row count, and the summary needs that count. MVP is 1:1
			// (one source per document), so the array holds a single
			// key in practice; it only grows with multi-source.
			const fingerprints = sources.map((source) => source.sourceFingerprint);
			const blobsRemoved =
				fingerprints.length > 0
					? await db.documentBlobs.where(':id').anyOf(fingerprints).delete()
					: 0;

			await db.documents.delete(id);

			return {
				documentId: id,
				sources: sourcesRemoved,
				blobs: blobsRemoved,
				bookmarks,
				highlights,
				notes,
				readingProgress,
			};
		},
	);
}
