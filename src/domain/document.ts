/**
 * readmark — format-agnostic document model.
 *
 * Three concept types form the spine of the model. Each owns one
 * responsibility and lives in its own IndexedDB table:
 *
 *   - `Document`        — LOGICAL book. A reader's "this book in my
 *                         library." Survives re-imports of the same
 *                         logical work and survives adding/removing
 *                         sources. Holds user-facing identity (title,
 *                         author, language) and book-level timestamps
 *                         (importedAt, lastReadAt).
 *
 *   - `DocumentSource`  — PHYSICAL source. One file (PDF / EPUB /
 *                         Markdown / text) attached to a Document.
 *                         Holds source-specific properties (format,
 *                         byteSize, pageCount, format-specific
 *                         metadata). The bytes themselves are NOT
 *                         here — see `DocumentBlob` below.
 *
 *   - `DocumentBlob`    — the bytes of one source. Stored separately
 *                         from `documentSources` so the bytes can be
 *                         evicted under storage pressure without
 *                         touching metadata or reading state.
 *
 * Identity rules:
 *
 *   - `DocumentId`        — UUID, LOGICAL. Minted once per Document.
 *                           Stable across re-imports of the same
 *                           logical work. Reading state is keyed by
 *                           this in combination with a
 *                           `SourceFingerprint`.
 *   - `SourceFingerprint` — SHA-256 hex, PHYSICAL. Stable only for
 *                           the same bytes. Re-encoding, OCR pass,
 *                           re-export — all change the fingerprint.
 *                           Highlight / Bookmark / ReadingProgress
 *                           / PositionedNote all carry this because
 *                           a position is meaningless outside the
 *                           specific bytes that produced it.
 *
 * MVP is 1:1 (one Document ↔ one DocumentSource). The schema already
 * supports 1:N. A future "merge two scans of the same book" UI is a
 * thin layer over the repository — no storage rewrite required.
 *
 * Why not a "rich identity" (SHA-256 of metadata + bytes)?
 *   - PDFs' `/info` metadata is mutable.
 *   - Same book, different OCR passes → different bytes → different
 *     fingerprint by design. The user (not the hash) decides whether
 *     they're "the same book."
 *
 * Why is `format` a closed string and not just 'pdf'?
 *   - The MVP only handles PDF, but the storage / UI must not assume
 *     it (ADR-0003). EPUB / Markdown / text come later and re-use
 *     every boundary here.
 */

export type DocumentFormat = 'pdf' | 'epub' | 'markdown' | 'text';

/** LOGICAL identity. UUID v4. Minted once per Document. */
export type DocumentId = string & { readonly __brand: 'DocumentId' };

/** PHYSICAL identity. SHA-256 hex of the raw bytes. Stable only for
 *  the same bytes. */
export type SourceFingerprint = string & { readonly __brand: 'SourceFingerprint' };

/** User-facing metadata for a Document. Initial values are copied
 *  from the source's intrinsic metadata at import time. The user
 *  may override them later (out of MVP scope). */
export interface DocumentMetadata {
	readonly title?: string;
	readonly author?: string;
	/** BCP 47 language tag if known. */
	readonly language?: string;
}

export interface Document {
	/** Logical identity. */
	readonly id: DocumentId;
	readonly metadata: DocumentMetadata;
	/** Earliest source-import timestamp (ms since epoch). */
	readonly importedAt: number;
	/** Most recent open timestamp (ms since epoch). Updated when any
	 *  source of this Document is opened. `null` if never opened. */
	readonly lastReadAt: number | null;
}

/** Source-specific properties derived from the file. Generic code
 *  reads `format` and `byteSize`; format-specific UI may read the
 *  rest. */
export interface SourceMetadata {
	/** Page count for paged formats; chapter count for reflowable. */
	readonly pageCount?: number;
	/** Format-specific extras. NEVER depend on this from generic
	 *  code. */
	readonly extras?: Readonly<Record<string, unknown>>;
}

export interface DocumentSource {
	/** Physical identity. SHA-256 of the raw bytes. */
	readonly sourceFingerprint: SourceFingerprint;
	/** Logical parent. */
	readonly documentId: DocumentId;
	readonly format: DocumentFormat;
	/** Size of the stored Blob in bytes. */
	readonly byteSize: number;
	/** When this source was attached to the Document (ms since
	 *  epoch). Independent of `Document.importedAt` so the same
	 *  Document can later receive a second source. */
	readonly importedAt: number;
	readonly metadata: SourceMetadata;
}

/** A sub-page navigation pointer inside a document. Format-specific.
 *  Used by ReadingProgress / Bookmark's `position` field for "scroll
 *  to here" on reopen. NOT an annotation anchor — see `Anchor<P>`
 *  in `domain/annotation/anchor.ts` for that (ADR-0007).
 *
 *  Generic code persists this opaquely; the format-specific reader
 *  fills it in (PDF scroll offset, EPUB CFI, …) and reads it back
 *  on open. Sub-page positions are deliberately NOT re-anchored —
 *  zoom, rotation, font-substitution, and renderer changes can all
 *  invalidate them; re-opening just gets you back "to this page"
 *  and that's the MVP contract.
 */
export type DocumentPosition = Readonly<Record<string, unknown>>;

// --- type guards ---------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

export function asDocumentId(uuid: string): DocumentId {
	if (!UUID_RE.test(uuid)) {
		throw new Error(`Invalid document id (expected UUID): ${uuid}`);
	}
	return uuid as DocumentId;
}

export function asSourceFingerprint(hex: string): SourceFingerprint {
	if (!SHA256_HEX_RE.test(hex)) {
		throw new Error(`Invalid source fingerprint (expected SHA-256 hex): ${hex}`);
	}
	return hex as SourceFingerprint;
}
