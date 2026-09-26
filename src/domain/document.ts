/**
 * readmark — format-agnostic document model.
 *
 * Two layers of identity, deliberately separated:
 *
 *   - `DocumentId`     — LOGICAL identity. A UUID minted on first import.
 *                        Survives re-imports of the same logical book.
 *                        Future enhancement: multiple physical sources
 *                        (e.g. "old PDF scan" + "new EPUB") can share
 *                        one DocumentId via a "merge" UI (out of MVP
 *                        scope). All reading state is keyed by this.
 *
 *   - `SourceFingerprint` — PHYSICAL identity. SHA-256 of the raw bytes.
 *                        Stable only for the same bytes. Changes when the
 *                        file is re-encoded, OCR-corrected, or updated.
 *                        Highlights are keyed by (DocumentId,
 *                        SourceFingerprint, anchor) because a highlight is
 *                        a position in specific bytes.
 *
 * In MVP, one DocumentId always maps to exactly one source. The split is
 * forward-looking: today's import flow can ignore `id` (treat it as equal
 * to `sourceFingerprint`) but tomorrow's "merge two scans of the same
 * book" UI doesn't need to rewrite reading state.
 *
 * Why not SHA-256 of metadata + bytes (a "rich identity")?
 *   - PDFs' `/info` metadata is mutable.
 *   - Same book, different OCR passes → different bytes → different
 *     fingerprint by design. The user (not the hash) decides whether
 *     they're "the same book."
 *
 * Why is `format` a closed string and not just 'pdf'?
 *   - The MVP only handles PDF, but the storage / UI must not assume it
 *     (ADR-0003). EPUB / Markdown / text come later and re-use every
 *     boundary here.
 */

export type DocumentFormat = 'pdf' | 'epub' | 'markdown' | 'text';

/** LOGICAL identity. UUID v4. Minted once on first import of a source. */
export type DocumentId = string & { readonly __brand: 'DocumentId' };

/** PHYSICAL identity. SHA-256 hex of the raw document bytes. Stable only
 *  for the same bytes. */
export type SourceFingerprint = string & { readonly __brand: 'SourceFingerprint' };

export interface DocumentMetadata {
	/** Page count or equivalent chapter count. Optional — not all formats
	 *  expose a fixed count up-front (e.g. reflowable EPUB). */
	readonly pageCount?: number;
	/** Title parsed from the format's intrinsic metadata. May be empty. */
	readonly title?: string;
	/** Author parsed from intrinsic metadata. May be empty. */
	readonly author?: string;
	/** Language tag (BCP 47) if the format exposes one. */
	readonly language?: string;
	/** Format-specific extras. NEVER depend on this from generic code. */
	readonly extras?: Readonly<Record<string, unknown>>;
}

export interface Document {
	/** Logical identity. Reading state is keyed by this. */
	readonly id: DocumentId;
	/** Physical identity. Tied to specific bytes; changes on re-encode. */
	readonly sourceFingerprint: SourceFingerprint;
	readonly format: DocumentFormat;
	/** Size of the stored Blob in bytes. */
	readonly byteSize: number;
	/** First import timestamp (ms since epoch). Stable across re-imports. */
	readonly importedAt: number;
	/** Last opened timestamp (ms since epoch). Updated by the reader. */
	readonly lastReadAt: number | null;
	readonly metadata: DocumentMetadata;
}

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
