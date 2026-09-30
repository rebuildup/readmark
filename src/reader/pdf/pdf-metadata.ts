/**
 * readmark — PDF metadata extractor (pdf.js adapter).
 *
 * Single responsibility:
 *   - Given a PDF `Blob`, return its intrinsic metadata
 *     (page count + /Info dictionary) using pdf.js.
 *   - Hide the `pdfjs-dist` import behind the
 *     `src/reader/pdf/` boundary (ADR-0004 §Boundary / Biome
 *     `noRestrictedImports`).
 *
 * Why a separate file from `pdf-document.ts`:
 *   - `pdf-document.ts` returns the live `PDFDocumentProxy` for
 *     the reader handle (#11). This file uses the same proxy but
 *     only to read metadata, then destroys it immediately.
 *   - Mixing them would mean callers that only want metadata
 *     still need to know about page rendering and anchor
 *     resolution. Keep concerns split.
 *
 * Why `doc.destroy()` in `finally`:
 *   - The proxy owns the worker connection. Leaking it leaks
 *     the worker.
 *   - `extractPdfMetadata()` is called from the library import
 *     flow (#3) where a leaked worker would block subsequent
 *     imports in the same session. The fingerprint pipeline +
 *     IndexedDB write are fast; the worker is the slow part to
 *     clean up.
 *
 * In scope for #3:
 *   - `extractPdfMetadata(blob)` — page count + /Info fields.
 *
 * Out of scope for #3:
 *   - Outline / bookmarks extraction — future.
 *   - Per-page metadata — future.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { SourceMetadata } from '../../domain/document.ts';
import { loadPdfDocument } from './pdf-document.ts';
import { isPdfJsInvalidException, PdfInvalidError } from './pdf-errors.ts';

/** PDF metadata that flows into `DocumentSource.metadata` (and
 *  mirrored into `Document.metadata`) via the library import flow.
 *  Format-specific; generic UI must NOT depend on this shape. */
export interface PdfMetadata {
	/** Page count (PDF: total across the document, not the
	 *  outline). Stored under `SourceMetadata.pageCount`. */
	readonly pageCount: number;
	/** PDF /Info dictionary fields. Each is `undefined` if the
	 *  producer did not set them — we do NOT default to empty
	 *  strings, because a blank title is meaningfully different
	 *  from "the producer did not bother to set one". */
	readonly title?: string;
	readonly author?: string;
}

/**
 * Read intrinsic metadata from a PDF `Blob`.
 *
 * Throws `PdfInvalidError` on:
 *   - non-PDF bytes (pdf.js `InvalidPDFException`).
 *   - corrupt / truncated PDFs (pdf.js `MissingPDFException`).
 *   - password-protected PDFs (pdf.js `PasswordException`,
 *     unsupported in MVP).
 *
 * Throws whatever pdf.js raises for any other failure (e.g.
 * network errors when fetching a remote PDF, though MVP is
 * local-first so this should not happen). Callers in the
 * library import flow catch `PdfInvalidError` and translate
 * to `ImportError.kind = 'invalid-pdf'`; anything else becomes
 * `ImportError.kind = 'unknown'`.
 *
 * Side effects:
 *   - Reads the entire blob into memory. PDF parsing is not
 *     streamable in pdf.js 5.x without a worker transport, and
 *     the import flow is the only caller; we accept the memory
 *     cost here.
 *   - Opens a worker, parses the document, destroys it. The
 *     worker connection is closed by `doc.destroy()` in
 *     `finally` even on partial failure of the metadata read.
 *
 * Why we wrap pdf.js exceptions here (and not in `library/`):
 *   - The pdf.js `InvalidPDFException` class is not exported
 *     through the package boundary; generic code has to
 *     discriminate by `error.name`. That couples `library/`
 *     to pdf.js's internal naming.
 *   - Wrapping once at this boundary gives the rest of the
 *     app a single, stable error class. Library discriminates
 *     on `instanceof PdfInvalidError` and never sees the pdf.js
 *     internals.
 */
export async function extractPdfMetadata(blob: Blob): Promise<PdfMetadata> {
	let doc: PDFDocumentProxy;
	try {
		const bytes = new Uint8Array(await blob.arrayBuffer());
		doc = await loadPdfDocument(bytes);
	} catch (cause: unknown) {
		// `loadPdfDocument` already cleans up the loading task
		// on failure. We only need to translate the exception.
		if (isPdfJsInvalidException(cause)) {
			throw new PdfInvalidError('Failed to parse PDF: not a usable PDF document', { cause });
		}
		throw cause;
	}
	try {
		const info = await doc.getMetadata();

		// pdf.js types `info.info` as plain `Object` (5.x). We
		// know it is a flat dictionary of strings (the PDF /Info
		// dictionary) and only read a handful of well-known keys.
		const infoDict = (info.info ?? {}) as Record<string, unknown>;
		const title = nonEmptyString(infoDict.Title);
		const author = nonEmptyString(infoDict.Author);

		// Build the result with `exactOptionalPropertyTypes` in
		// mind: an explicit `undefined` is not assignable to a
		// property typed `title?: string`. We omit absent keys.
		const meta: { pageCount: number; title?: string; author?: string } = {
			pageCount: doc.numPages,
		};
		if (title !== undefined) meta.title = title;
		if (author !== undefined) meta.author = author;
		return meta;
	} finally {
		// Always destroy. Even if `getMetadata()` throws, the
		// worker must be released so the next import can open
		// its own document.
		await doc.destroy();
	}
}

/** Convert `PdfMetadata` into the generic `SourceMetadata` that
 *  the storage layer accepts. Lives here (not in the storage
 *  layer) because it knows the pdf.js shape.
 *
 *  Full forward: every field we know how to extract is mirrored
 *  onto `SourceMetadata`, so a downstream caller that has only
 *  the source (and not the parallel `DocumentMetadata`) can still
 *  see the title / author. The library row's `displayTitle` reads
 *  from `Document.metadata` today; this forward is for the storage
 *  layer's own use and for the future "re-import the same logical
 *  book from a new file" flow. */
export function pdfMetadataToSourceMetadata(meta: PdfMetadata): SourceMetadata {
	const out: {
		pageCount: number;
		title?: string;
		author?: string;
	} = { pageCount: meta.pageCount };
	if (meta.title !== undefined) out.title = meta.title;
	if (meta.author !== undefined) out.author = meta.author;
	return out;
}

/** PDFs produced by some tools have `Title: ''` or `null` in
 *  the /Info dict. We treat those as absent so the generic UI
 *  can fall back to "(タイトルなし)". */
function nonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}
