/**
 * readmark — documents repository.
 *
 * The "library" surface reads/writes through this module. Generic code
 * must NOT bypass this layer to touch Dexie directly; the IndexedDB
 * schema is a storage concern, not a domain concern.
 *
 * Identity model (see `domain/document.ts`):
 *   - On import: compute sourceFingerprint from bytes.
 *   - If a Document with that sourceFingerprint exists, refresh the
 *     blob and bump timestamps; the same DocumentId is preserved.
 *   - Else: mint a new UUID as DocumentId and create both `documents`
 *     and `documentBlobs` rows.
 */

import type { Document, DocumentId } from '../domain/document.ts';
import { fingerprintBlob } from '../lib/fingerprint.ts';
import { type DocumentBlobRecord, getDb, type StoredDocument } from './db.ts';

export async function listDocuments(): Promise<readonly Document[]> {
	const rows = await getDb()
		.documents.orderBy('lastReadAt')
		.reverse()
		.filter((d) => d.lastReadAt !== null)
		.toArray();
	const neverOpened = await getDb()
		.documents.orderBy('importedAt')
		.reverse()
		.filter((d) => d.lastReadAt === null)
		.toArray();
	return [...rows, ...neverOpened].map(toDocument);
}

/** Import (or re-import) a PDF/EPUB/... into the library. Idempotent
 *  by sourceFingerprint — re-importing the same bytes preserves the
 *  DocumentId and only refreshes the blob + timestamps. */
export async function importDocument(
	blob: Blob,
	format: Document['format'],
	metadata: Document['metadata'],
): Promise<DocumentId> {
	const sourceFingerprint = await fingerprintBlob(blob);
	const now = Date.now();
	const db = getDb();

	const id = await db.transaction('rw', db.documents, db.documentBlobs, async () => {
		// Dedup by physical identity (same bytes ⇒ same Document).
		const existingBySource = await db.documents
			.where('sourceFingerprint')
			.equals(sourceFingerprint)
			.first();
		if (existingBySource) {
			await db.documents.update(existingBySource.id, {
				blob,
				metadata: { ...existingBySource.metadata, ...metadata },
			});
			await db.documentBlobs.put({
				sourceFingerprint,
				documentId: existingBySource.id,
				blob,
				storedAt: now,
			});
			return existingBySource.id;
		}

		// New source → mint a fresh DocumentId.
		const id = crypto.randomUUID() as DocumentId;
		await db.documents.put({
			id,
			sourceFingerprint,
			format,
			byteSize: blob.size,
			importedAt: now,
			lastReadAt: null,
			metadata,
			blob,
		});
		const blobRecord: DocumentBlobRecord = {
			sourceFingerprint,
			documentId: id,
			blob,
			storedAt: now,
		};
		await db.documentBlobs.put(blobRecord);
		return id;
	});

	return id;
}

export async function getDocument(id: DocumentId): Promise<Document | null> {
	const row = await getDb().documents.get(id);
	return row ? toDocument(row) : null;
}

export async function getDocumentBlob(sourceFingerprint: string): Promise<Blob | null> {
	const row = await getDb().documentBlobs.get(sourceFingerprint);
	return row?.blob ?? null;
}

export async function touchLastReadAt(id: DocumentId): Promise<void> {
	await getDb().documents.update(id, { lastReadAt: Date.now() });
}

function toDocument(stored: StoredDocument): Document {
	const { blob: _blob, ...rest } = stored;
	void _blob;
	return rest;
}
