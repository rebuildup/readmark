/**
 * readmark — library import flow (pure).
 *
 * Single responsibility (AGENTS.md §3 boundary):
 *   - Take a `Blob` (PDF for MVP), read its intrinsic metadata,
 *     and persist it through the storage repository.
 *   - Return a `Result<T, E>` so the React UI can render
 *     typed errors without `try`/`catch` boilerplate.
 *
 * What this module deliberately does NOT do:
 *   - Touch React, `document`, or the DOM. Pure flow.
 *   - Import `pdfjs-dist` directly. The pdf.js adapter lives in
 *     `src/reader/pdf/pdf-metadata.ts` per ADR-0004 / Biome
 *     `noRestrictedImports` (#12).
 *   - Touch Dexie directly. The storage repository
 *     (`src/storage/documents-repo.ts`) owns IndexedDB.
 *
 * Error layering:
 *
 *   layer         | produces               | reason
 *   ------------- | ---------------------- | --------------------------
 *   reader/pdf/   | InvalidPdfException    | pdf.js raises this; we
 *                 | (rethrown as-is)       | pass it through.
 *   storage/      | Dexie `QuotaExceeded`  | Dexie throws this on
 *                 | (rethrown as-is)       | `transaction()` failure.
 *   library/      | Result<…, ImportError> | Normalizes the two
 *                 |                        | above into a single
 *                 |                        | discriminated union.
 *
 * The UI never inspects raw exceptions from this layer — it
 * switches on `ImportError.kind`. New failure modes get a new
 * `kind` here, not a new try/catch in every screen.
 */

import type { DocumentId, SourceFingerprint, SourceMetadata } from '../domain/document.ts';
import { extractPdfMetadata, pdfMetadataToSourceMetadata } from '../reader/pdf/pdf-metadata.ts';
import { importDocument } from '../storage/documents-repo.ts';

/** Tagged union of typed errors the import flow can surface.
 *  Add a new `kind` when a new failure mode appears — never
 *  leak raw exceptions through `unknown`. */
export type ImportError =
	| { readonly kind: 'invalid-pdf'; readonly cause: unknown }
	| { readonly kind: 'quota-exceeded'; readonly cause: unknown }
	| { readonly kind: 'unsupported-format'; readonly cause: unknown }
	| { readonly kind: 'unknown'; readonly cause: unknown };

/** Minimal `Result<T, E>` for the import flow. Defined here
 *  rather than in `lib/` because it has no callers outside this
 *  module yet — promote when the second use site appears. */
export type Result<T, E> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E };

/** What we return to the UI on success. The UI uses
 *  `documentId` for navigation and `sourceFingerprint` /
 *  `pageCount` to show immediate feedback ("imported 234-page
 *  PDF, opening…"). */
export interface ImportSuccess {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageCount: number;
	readonly title?: string;
	readonly author?: string;
}

/**
 * Import a PDF `Blob` into the library.
 *
 * Steps:
 *   1. Read intrinsic metadata via `extractPdfMetadata()`
 *      (pdf.js via `src/reader/pdf/pdf-metadata.ts`).
 *   2. Build `SourceMetadata` (page count) + `DocumentMetadata`
 *      (title, author from /Info dictionary).
 *   3. Hand off to `importDocument()` for the IndexedDB write.
 *
 * Errors are normalized to `ImportError`:
 *   - pdf.js failure → `invalid-pdf`.
 *   - Dexie / IndexedDB `QuotaExceededError` → `quota-exceeded`.
 *   - Anything else → `unknown` (with the raw cause for logging).
 *
 * Note: this MVP only handles PDF. The discriminated union above
 * already reserves `unsupported-format` for when other formats
 * (EPUB / Markdown / text) land and we need to reject non-PDF
 * blobs at this layer (the file picker already filters by
 * `accept="application/pdf"`, but drag-drop bypasses that).
 */
export async function importPdfDocument(blob: Blob): Promise<Result<ImportSuccess, ImportError>> {
	try {
		const pdfMeta = await extractPdfMetadata(blob);
		const sourceMetadata: SourceMetadata = pdfMetadataToSourceMetadata(pdfMeta);
		// Build `DocumentMetadata` with `exactOptionalPropertyTypes`
		// in mind: omit absent keys rather than passing `undefined`.
		const documentMetadata: { title?: string; author?: string; language?: string } = {};
		if (pdfMeta.title !== undefined) documentMetadata.title = pdfMeta.title;
		if (pdfMeta.author !== undefined) documentMetadata.author = pdfMeta.author;
		if (pdfMeta.language !== undefined) documentMetadata.language = pdfMeta.language;

		const documentId = await importDocument(blob, 'pdf', {
			documentMetadata,
			sourceMetadata,
		});

		// We need the fingerprint to surface in `ImportSuccess`
		// (UI can show "this is the same as X" if it wants). The
		// storage layer computed it internally for dedup; re-derive
		// is wasteful, but the alternative is a wider return shape
		// from `importDocument`. Pick the simpler contract here.
		// Future: have `importDocument` return both.
		const sourceFingerprint = await fingerprintBlobForUi(blob);

		const success: {
			documentId: DocumentId;
			sourceFingerprint: SourceFingerprint;
			pageCount: number;
			title?: string;
			author?: string;
		} = {
			documentId,
			sourceFingerprint,
			pageCount: pdfMeta.pageCount,
		};
		if (pdfMeta.title !== undefined) success.title = pdfMeta.title;
		if (pdfMeta.author !== undefined) success.author = pdfMeta.author;

		return { ok: true, value: success };
	} catch (cause: unknown) {
		if (isInvalidPdf(cause)) {
			return { ok: false, error: { kind: 'invalid-pdf', cause } };
		}
		if (isQuotaExceeded(cause)) {
			return { ok: false, error: { kind: 'quota-exceeded', cause } };
		}
		return { ok: false, error: { kind: 'unknown', cause } };
	}
}

/**
 * Detect `InvalidPDFException` from pdf.js without importing
 * `pdfjs-dist` (boundary rule). pdf.js's error class is not
 * exported in a way that the generic layer can reference without
 * pulling the package; we use duck-typing on `name` instead.
 *
 * Recognized error names (pdf.js 5.x):
 *   - `InvalidPDFException` — bytes are not a PDF.
 *   - `MissingPDFException` — bytes look like a PDF but the
 *     header / xref is missing.
 *   - `PasswordException` — encrypted PDF (we do not support
 *     password-protected files in MVP; surface as `invalid-pdf`).
 */
function isInvalidPdf(cause: unknown): boolean {
	if (cause === null || typeof cause !== 'object') return false;
	const name = (cause as { name?: unknown }).name;
	return (
		name === 'InvalidPDFException' || name === 'MissingPDFException' || name === 'PasswordException'
	);
}

/**
 * Detect IndexedDB / Dexie quota errors. The W3C spec name is
 * `QuotaExceededError`; some browsers / polyfills also expose
 * `NS_ERROR_DOM_QUOTA_REACHED`. We check both.
 */
function isQuotaExceeded(cause: unknown): boolean {
	if (cause === null || typeof cause !== 'object') return false;
	const name = (cause as { name?: unknown }).name;
	return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

/** Compute the source fingerprint for `ImportSuccess`. Lives
 *  here (not exported) because the only caller is right above.
 *  `fingerprintBlob` is a thin SHA-256 helper; we re-import it
 *  rather than reach into `lib/fingerprint.ts` directly so the
 *  storage layer's API stays the single source of truth for
 *  identity. */
async function fingerprintBlobForUi(blob: Blob): Promise<SourceFingerprint> {
	const { fingerprintBlob } = await import('../lib/fingerprint.ts');
	return fingerprintBlob(blob);
}
