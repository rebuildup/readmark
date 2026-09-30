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
 *   layer         | produces             | reason
 *   ------------- | -------------------- | -----------------------------------
 *   reader/pdf/   | PdfInvalidError      | wraps pdf.js's three "not a
 *                 |                      | usable PDF" exceptions behind a
 *                 |                      | single class. Boundary-stable.
 *   storage/      | QuotaExceededError   | Dexie / IndexedDB raises this on
 *                 | (raw, by spec name)  | `transaction()` failure. The W3C
 *                 |                      | name is stable across browsers;
 *                 |                      | we discriminate by `name`.
 *   library/      | Result<…, ImportError> | Translates the two above into a
 *                 |                      | single discriminated union.
 *
 * The UI never inspects raw exceptions from this layer — it
 * switches on `ImportError.kind`. New failure modes get a new
 * `kind` here, not a new try/catch in every screen.
 *
 * Why pdf.js exceptions are wrapped at the reader boundary:
 *   - ADR-0004 §Boundary keeps pdf.js internals inside
 *     `src/reader/pdf/`. Wrapping once here means pdf.js version
 *     bumps (or a future fork) cannot leak new exception names
 *     into `library/`.
 *   - Quota is left as raw `QuotaExceededError` because its
 *     `name` is a W3C spec contract and it originates in the
 *     storage layer, not in pdf.js.
 */

import type { DocumentId, SourceFingerprint, SourceMetadata } from '../domain/document.ts';
import { PdfInvalidError } from '../reader/pdf/pdf-errors.ts';
import { extractPdfMetadata, pdfMetadataToSourceMetadata } from '../reader/pdf/pdf-metadata.ts';
import { importDocument } from '../storage/documents-repo.ts';
import type { Result } from './result.ts';

/** Tagged union of typed errors the import flow can surface.
 *  Add a new `kind` when a new failure mode appears — never
 *  leak raw exceptions through `unknown`. */
export type ImportError =
	| { readonly kind: 'invalid-pdf'; readonly cause: unknown }
	| { readonly kind: 'quota-exceeded'; readonly cause: unknown }
	| { readonly kind: 'unsupported-format'; readonly cause: unknown }
	| { readonly kind: 'unknown'; readonly cause: unknown };

/** What we return to the UI on success. The UI uses
 *  `documentId` for navigation and `sourceFingerprint` /
 *  `pageCount` to show immediate feedback ("imported 234-page
 *  PDF, opening…"). `sourceFingerprint` comes from the storage
 *  layer's transaction — we do NOT re-hash the blob after
 *  commit. */
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
 *      The storage layer returns both `documentId` and
 *      `sourceFingerprint` from the same transaction so we
 *      never re-hash the blob.
 *
 * Errors are normalized to `ImportError`:
 *   - `PdfInvalidError` → `invalid-pdf`.
 *   - Dexie / IndexedDB `QuotaExceededError` (or Firefox's
 *     `NS_ERROR_DOM_QUOTA_REACHED`) → `quota-exceeded`.
 *   - Anything else → `unknown` (with the raw cause for logging).
 *
 * Note: this MVP only handles PDF. The discriminated union above
 * already reserves `unsupported-format` for when other formats
 * (EPUB / Markdown / text) land and we need to reject non-PDF
 * blobs at this layer (the file picker already filters by
 * `accept="application/pdf"`, but drag-drop bypasses that).
 */
export async function importPdfDocument(blob: Blob): Promise<Result<ImportSuccess, ImportError>> {
	let pdfMeta: Awaited<ReturnType<typeof extractPdfMetadata>>;
	try {
		pdfMeta = await extractPdfMetadata(blob);
	} catch (cause: unknown) {
		if (cause instanceof PdfInvalidError) {
			return { ok: false, error: { kind: 'invalid-pdf', cause } };
		}
		return { ok: false, error: { kind: 'unknown', cause } };
	}

	const sourceMetadata: SourceMetadata = pdfMetadataToSourceMetadata(pdfMeta);
	// Build `DocumentMetadata` with `exactOptionalPropertyTypes`
	// in mind: omit absent keys rather than passing `undefined`.
	// Title / author are mirrored from the source; language is
	// not extracted in MVP (PDF /Info has no /Lang; the catalog
	// entry is not exposed by pdf.js 5.x's `getMetadata()`).
	const documentMetadata: { title?: string; author?: string; language?: string } = {};
	if (pdfMeta.title !== undefined) documentMetadata.title = pdfMeta.title;
	if (pdfMeta.author !== undefined) documentMetadata.author = pdfMeta.author;

	try {
		const { documentId, sourceFingerprint } = await importDocument(blob, 'pdf', {
			documentMetadata,
			sourceMetadata,
		});

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
		if (isQuotaExceeded(cause)) {
			return { ok: false, error: { kind: 'quota-exceeded', cause } };
		}
		return { ok: false, error: { kind: 'unknown', cause } };
	}
}

/**
 * Detect IndexedDB / Dexie quota errors. The W3C spec name is
 * `QuotaExceededError`; some browsers / polyfills also expose
 * `NS_ERROR_DOM_QUOTA_REACHED`. We check both.
 *
 * Why not wrap `QuotaExceededError` at the storage boundary the
 * way we wrap `InvalidPDFException` at the pdf.js boundary:
 *   - The exception class is a stable W3C contract — `name`
 *     survives across all major browsers and polyfills.
 *   - Wrapping would also be defensible; we keep the discrimination
 *     here because there is exactly one thrower (Dexie's
 *     `transaction()`) and one catcher (this module).
 */
function isQuotaExceeded(cause: unknown): boolean {
	if (cause === null || typeof cause !== 'object') return false;
	const name = (cause as { name?: unknown }).name;
	return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}
