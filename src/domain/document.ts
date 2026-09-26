/**
 * readmark — format-agnostic document model.
 *
 * The Document is the SoT for "what is in the user's library". The actual
 * file bytes live in storage/ as a Blob keyed by `fingerprint`. All
 * reading-state is keyed by `fingerprint`, never by `id`, so re-importing
 * the same PDF produces a stable identity.
 *
 * Why content hash and not (e.g.) a UUID or filename?
 *   - Re-importing the same file must dedupe (ADR-0002).
 *   - Filenames and `/info` metadata are mutable in PDFs.
 *   - SHA-256 of the raw bytes is collision-resistant for our purposes.
 *
 * Why is `format` a closed string and not just 'pdf'?
 *   - The MVP only handles PDF, but the storage / UI must not assume it
 *     (ADR-0003 — format-agnostic document model). EPUB / Markdown / text
 *     come later and re-use every boundary here.
 */

export type DocumentFormat = 'pdf' | 'epub' | 'markdown' | 'text';

/** SHA-256 hex string of the raw document bytes. Stable across re-imports. */
export type DocumentFingerprint = string & { readonly __brand: 'DocumentFingerprint' };

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
	readonly fingerprint: DocumentFingerprint;
	readonly format: DocumentFormat;
	/** Size of the stored Blob in bytes. */
	readonly byteSize: number;
	/** First import timestamp (ms since epoch). Stable across re-imports. */
	readonly importedAt: number;
	/** Last opened timestamp (ms since epoch). Updated by the reader. */
	readonly lastReadAt: number | null;
	readonly metadata: DocumentMetadata;
}

/** Type guard so we can't pass arbitrary strings to fingerprint-typed APIs. */
export function asDocumentFingerprint(hex: string): DocumentFingerprint {
	if (!/^[0-9a-f]{64}$/.test(hex)) {
		throw new Error(`Invalid document fingerprint: ${hex}`);
	}
	return hex as DocumentFingerprint;
}
