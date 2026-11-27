/**
 * readmark — documents repository (session-scoped, ADR-0008).
 *
 * The "library" surface reads/writes through this module. Generic
 * code must NOT bypass this layer to touch the session store
 * directly; how the bytes are held is a storage concern, not a
 * domain concern.
 *
 * Identity model (see `domain/document.ts`, unchanged by ADR-0008):
 *   - On import: compute sourceFingerprint from bytes.
 *   - If a DocumentSource with that fingerprint already exists,
 *     refresh its blob + format-specific metadata in place; the
 *     DocumentId is preserved.
 *   - Else: mint a fresh DocumentId, create a Document, attach a
 *     DocumentSource, and keep the bytes — all synchronously, so
 *     there is no transaction to run.
 *
 * MVP is 1:1 (one Document ↔ one DocumentSource). The repository
 * already supports the 1:N case in shape; the only thing missing is
 * a UX that asks "do you want to attach this as a second source?"
 * (out of MVP scope).
 *
 * Blob handling:
 *   - The bytes live ONLY in `sessionStore.documentBlobs`. The
 *     `documents` map holds metadata only.
 *   - Lifetime: the tab. A reload starts an empty library, and the
 *     UI states that in one line (ADR-0008) — there is no eviction
 *     policy to write because there is no quota to exceed.
 *
 * Every function keeps the signature the old database-backed repository
 * had (`async`, `Promise<…>`): callers await, and an in-memory
 * answer is simply an already-resolved promise. What disappeared
 * with ADR-0008 is not the shape but the failure modes — schema
 * upgrades, quota errors and cross-tab races cannot occur here.
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
import { asDocumentId } from '../domain/document.ts';
import { fingerprintBlob } from '../lib/fingerprint.ts';
import { sessionStore } from './session-store.ts';

/** A row in the library list: one Document plus its "primary"
 *  source. The primary source is the oldest one attached to the
 *  Document — which, in MVP, is the only one. The UI uses this for
 *  display; the repository uses it for navigation. */
export interface LibraryEntry {
	readonly document: Document;
	readonly primarySource: DocumentSource;
}

/** List the library. Order: most recently read first, then
 *  never-opened documents in import order.
 *
 *  One pass over two maps (documents, then the sources grouped by
 *  `documentId`) — the grouping the database version needed an
 *  indexed read for is a `for` loop here. */
export async function listLibrary(): Promise<readonly LibraryEntry[]> {
	const docs = [...sessionStore.documents.values()];
	if (docs.length === 0) return [];

	const sourcesByDocument = new Map<DocumentId, DocumentSource[]>();
	for (const source of sessionStore.documentSources.values()) {
		const bucket = sourcesByDocument.get(source.documentId);
		if (bucket === undefined) {
			sourcesByDocument.set(source.documentId, [source]);
		} else {
			bucket.push(source);
		}
	}
	for (const bucket of sourcesByDocument.values()) {
		bucket.sort((a, b) => a.importedAt - b.importedAt);
	}

	const entries: LibraryEntry[] = [];
	for (const document of docs) {
		const primarySource = sourcesByDocument.get(document.id)?.[0];
		if (primarySource === undefined) {
			// A Document with no source is a data-integrity bug —
			// `importDocument` creates both in one synchronous step.
			// Logging instead of silently dropping lets tests notice;
			// the row is still filtered so the library never shows a
			// card with no file.
			console.error('readmark: document has no primary source', { documentId: document.id });
			continue;
		}
		entries.push({ document, primarySource });
	}

	return entries.sort((a, b) => {
		const aT = a.document.lastReadAt ?? a.document.importedAt;
		const bT = b.document.lastReadAt ?? b.document.importedAt;
		return bT - aT;
	});
}

/** Fetch a Document by its logical id. Does NOT return sources or
 *  bytes — callers that need them ask explicitly. */
export async function getDocument(id: DocumentId): Promise<Document | null> {
	return sessionStore.documents.get(id) ?? null;
}

/** List all sources of a Document, ordered by import time
 *  (oldest first). */
export async function listDocumentSources(
	documentId: DocumentId,
): Promise<readonly DocumentSource[]> {
	return [...sessionStore.documentSources.values()]
		.filter((source) => source.documentId === documentId)
		.sort((a, b) => a.importedAt - b.importedAt);
}

/** The "primary" source of a Document — the oldest one attached.
 *  In MVP one Document has one source, so this is unambiguous.
 *  When multi-source UI lands, this becomes "the source the reader
 *  last opened, or the oldest if never opened." */
export async function getPrimarySource(documentId: DocumentId): Promise<DocumentSource | null> {
	const sources = await listDocumentSources(documentId);
	return sources[0] ?? null;
}

export async function getDocumentSource(
	sourceFingerprint: SourceFingerprint,
): Promise<DocumentSource | null> {
	return sessionStore.documentSources.get(sourceFingerprint) ?? null;
}

/** Load the bytes for a source. Returns null when the session does
 *  not hold them — after a reload that is every source, and the UI
 *  surfaces that the user needs to re-import. */
export async function getDocumentBlob(sourceFingerprint: SourceFingerprint): Promise<Blob | null> {
	return sessionStore.documentBlobs.get(sourceFingerprint)?.blob ?? null;
}

/** Options for `importDocument`. The two metadata buckets are
 *  separated because they answer different questions — Document
 *  metadata is user-facing book identity, DocumentSource metadata
 *  is file-derived. */
export interface ImportOptions {
	readonly documentMetadata?: DocumentMetadata;
	readonly sourceMetadata?: SourceMetadata;
}

/** The identity pair returned by `importDocument`. Callers that
 *  need both keys (the library import flow, e.g. to show "this is
 *  the same file as X") get them in a single object. */
export interface ImportResult {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
}

/** Import (or re-import) a file. Idempotent by SourceFingerprint:
 *  re-importing the same bytes refreshes the source record and its
 *  bytes. Returns the (preserved or minted) DocumentId plus the
 *  physical SourceFingerprint — the caller already knows it is the
 *  dedup key; we return it so it does not have to re-hash. */
export async function importDocument(
	blob: Blob,
	format: DocumentFormat,
	options: ImportOptions = {},
): Promise<ImportResult> {
	const sourceFingerprint = await fingerprintBlob(blob);
	const now = Date.now();
	const { documentMetadata = {}, sourceMetadata = {} } = options;

	// Dedup by physical identity.
	const existing = sessionStore.documentSources.get(sourceFingerprint);
	if (existing) {
		sessionStore.documentSources.set(sourceFingerprint, {
			...existing,
			format,
			byteSize: blob.size,
			metadata: sourceMetadata,
		});
		sessionStore.documentBlobs.set(sourceFingerprint, {
			sourceFingerprint,
			blob,
			storedAt: now,
		});
		return { documentId: existing.documentId, sourceFingerprint };
	}

	// New source → mint a Document and its first Source together.
	// UUID v4 is the only shape a `DocumentId` accepts, so route
	// through the brand guard instead of casting — `as DocumentId`
	// would let a future shape change through unnoticed.
	const id = asDocumentId(crypto.randomUUID());

	sessionStore.documents.set(id, {
		id,
		metadata: documentMetadata,
		importedAt: now,
		lastReadAt: null,
	});
	sessionStore.documentSources.set(sourceFingerprint, {
		sourceFingerprint,
		documentId: id,
		format,
		byteSize: blob.size,
		importedAt: now,
		metadata: sourceMetadata,
	});
	sessionStore.documentBlobs.set(sourceFingerprint, {
		sourceFingerprint,
		blob,
		storedAt: now,
	});

	return { documentId: id, sourceFingerprint };
}

/** Bump `Document.lastReadAt`. Called by the reader whenever a
 *  source of this Document is opened. A no-op for an unknown id,
 *  the same as the old `Table.update` was. */
export async function touchLastReadAt(id: DocumentId): Promise<void> {
	const document = sessionStore.documents.get(id);
	if (document === undefined) return;
	sessionStore.documents.set(id, { ...document, lastReadAt: Date.now() });
}

/** How many rows a `deleteDocument` call removed, per store. Kept as
 *  a summary rather than a boolean so the UI can tell the user what
 *  is gone (e.g. "3 highlights and 1 bookmark will be deleted too")
 *  and so tests can assert the cascade without reading internals. */
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
 * Delete a Document and everything that belongs to it.
 *
 * Why the cascade is mandatory (ADR-0002, unchanged by ADR-0008):
 *   - Reading state is keyed by `DocumentId` + `SourceFingerprint`.
 *     Leaving bookmarks / highlights / notes / progress behind
 *     would orphan them: the `documentId` they point at no longer
 *     exists, so nothing could ever list or resolve them.
 *   - Bytes are keyed by `SourceFingerprint`, not `DocumentId`, so
 *     the Document's sources are read first and the matching bytes
 *     dropped with them.
 *
 * Returns `null` when the Document does not exist. The caller
 * distinguishes "already gone" from "deleted" without a second
 * read, and maps `null` to a typed `not-found` error.
 *
 * Deletion is intentionally NOT undoable. The UI must confirm first.
 */
export async function deleteDocument(id: DocumentId): Promise<DeleteDocumentSummary | null> {
	const document = sessionStore.documents.get(id);
	if (!document) return null;

	const sources = [...sessionStore.documentSources.values()].filter(
		(source) => source.documentId === id,
	);

	let sourcesRemoved = 0;
	let blobsRemoved = 0;
	for (const source of sources) {
		if (sessionStore.documentSources.delete(source.sourceFingerprint)) sourcesRemoved += 1;
		if (sessionStore.documentBlobs.delete(source.sourceFingerprint)) blobsRemoved += 1;
	}

	// The per-state cascade. Each map is walked once; the count is
	// the number of rows actually present (a delete of an absent key
	// is not a removal).
	const removeByDocument = <T extends { readonly documentId: DocumentId }>(
		map: Map<string, T>,
	): number => {
		let removed = 0;
		for (const [key, row] of map) {
			if (row.documentId === id) {
				map.delete(key);
				removed += 1;
			}
		}
		return removed;
	};

	const bookmarks = removeByDocument(sessionStore.bookmarks);
	const highlights = removeByDocument(sessionStore.highlights);
	// The notes table exists in the domain model but no repository
	// writes it yet (ADR-0002); the count stays in the summary so
	// the shape does not change when one lands.
	const notes = 0;
	const readingProgress = removeByDocument(sessionStore.readingProgress);

	sessionStore.documents.delete(id);

	return {
		documentId: id,
		sources: sourcesRemoved,
		blobs: blobsRemoved,
		bookmarks,
		highlights,
		notes,
		readingProgress,
	};
}
