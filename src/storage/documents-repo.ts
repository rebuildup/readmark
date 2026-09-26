/**
 * readmark — documents repository.
 *
 * The "library" surface reads/writes through this module. Generic code must
 * NOT bypass this layer to touch Dexie directly; the IndexedDB schema is
 * a storage concern, not a domain concern.
 */

import type { Document, DocumentFingerprint } from '../domain/document.ts';
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

/** Import (or re-import) a PDF/EPUB/... into the library. Idempotent by
 *  fingerprint — re-importing the same bytes updates timestamps only. */
export async function importDocument(
	blob: Blob,
	format: Document['format'],
	metadata: Document['metadata'],
): Promise<DocumentFingerprint> {
	const fingerprint = await fingerprintBlob(blob);
	const now = Date.now();
	const db = getDb();

	await db.transaction('rw', db.documents, db.documentBlobs, async () => {
		const existing = await db.documents.get(fingerprint);
		if (existing) {
			// Re-import — preserve importedAt, refresh the blob, bump lastReadAt.
			await db.documents.update(fingerprint, {
				blob,
				lastReadAt: existing.lastReadAt,
				metadata: { ...existing.metadata, ...metadata },
			});
		} else {
			await db.documents.put({
				fingerprint,
				format,
				byteSize: blob.size,
				importedAt: now,
				lastReadAt: null,
				metadata,
				blob,
			});
		}
		const blobRecord: DocumentBlobRecord = {
			fingerprint,
			blob,
			storedAt: now,
		};
		await db.documentBlobs.put(blobRecord);
	});

	return fingerprint;
}

export async function getDocumentBlob(fingerprint: DocumentFingerprint): Promise<Blob | null> {
	const row = await getDb().documentBlobs.get(fingerprint);
	return row?.blob ?? null;
}

export async function touchLastReadAt(fingerprint: DocumentFingerprint): Promise<void> {
	await getDb().documents.update(fingerprint, { lastReadAt: Date.now() });
}

function toDocument(stored: StoredDocument): Document {
	const { blob: _blob, ...rest } = stored;
	void _blob;
	return rest;
}
