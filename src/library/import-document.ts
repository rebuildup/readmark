/**
 * readmark — library import flow (pure).
 *
 * Single responsibility (AGENTS.md §3 boundary):
 *   - Take a `Blob` (PDF for MVP), read its intrinsic metadata,
 *     and hand it to the storage repository (session-scoped,
 *     ADR-0008).
 *   - Return a `Result<T, E>` so the React UI can render
 *     typed errors without `try`/`catch` boilerplate.
 *
 * What this module deliberately does NOT do:
 *   - Touch React, `document`, or the DOM. Pure flow.
 *   - Import `pdfjs-dist` directly. The pdf.js adapter lives in
 *     `src/reader/pdf/pdf-metadata.ts` per ADR-0004 / Biome
 *     `noRestrictedImports` (#12).
 *   - Touch the session store directly. The storage repository
 *     (`src/storage/documents-repo.ts`) owns how bytes are held.
 *
 * Error layering:
 *
 *   layer         | produces             | reason
 *   ------------- | -------------------- | -----------------------------------
 *   reader/pdf/   | PdfInvalidError      | wraps pdf.js's three "not a
 *                 |                      | usable PDF" exceptions behind a
 *                 |                      | single class. Boundary-stable.
 *   library/      | Result<…, ImportError> | Translates the above into a
 *                 |                      | single discriminated union.
 *
 * The UI never inspects raw exceptions from this layer — it
 * switches on `ImportError.kind`. New failure modes get a new
 * `kind` here, not a new try/catch in every screen.
 *
 * ADR-0008 removed `quota-exceeded`: the import writes to memory,
 * so there is no storage quota whose exhaustion could produce one.
 * The only remaining failures are "not a PDF" and "unexpected".
 *
 * Why pdf.js exceptions are wrapped at the reader boundary:
 *   - ADR-0004 §Boundary keeps pdf.js internals inside
 *     `src/reader/pdf/`. Wrapping once here means pdf.js version
 *     bumps (or a future fork) cannot leak new exception names
 *     into `library/`.
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
	| { readonly kind: 'unsupported-format'; readonly cause: unknown }
	| { readonly kind: 'unknown'; readonly cause: unknown };

/** What we return to the UI on success. The UI uses
 *  `documentId` for navigation and `sourceFingerprint` /
 *  `pageCount` to show immediate feedback ("imported 234-page
 *  PDF, opening…"). `sourceFingerprint` comes from the storage
 *  repository's identity pass — we do NOT re-hash the blob
 *  afterwards. */
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
 *   3. Hand off to `importDocument()` for the session write.
 *      The repository returns both `documentId` and
 *      `sourceFingerprint` from the same pass so we never
 *      re-hash the blob.
 *
 * Errors are normalized to `ImportError`:
 *   - `PdfInvalidError` → `invalid-pdf`.
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
		// ADR-0008: the write is into memory, so there is no quota
		// to exhaust — everything here is unexpected.
		return { ok: false, error: { kind: 'unknown', cause } };
	}
}
