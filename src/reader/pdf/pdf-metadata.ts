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

import type { SourceMetadata } from '../../domain/document.ts';
import { loadPdfDocument } from './pdf-document.ts';

/** PDF metadata that flows into `DocumentSource.metadata.extras`
 *  via the library import flow. Format-specific; generic UI
 *  must NOT depend on this shape. */
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
	readonly language?: string;
}

/**
 * Read intrinsic metadata from a PDF `Blob`.
 *
 * Throws on:
 *   - non-PDF bytes (`pdfjsLib` raises `InvalidPDFException`).
 *   - corrupt / truncated PDFs (`PasswordException`,
 *     `MissingPDFException`, etc.).
 *
 * Callers in the library import flow catch these and surface
 * them as typed `InvalidPdf` errors — see
 * `src/library/import-document.ts`.
 *
 * Side effects:
 *   - Reads the entire blob into memory. PDF parsing is not
 *     streamable in pdf.js 5.x without a worker transport, and
 *     the import flow is the only caller; we accept the memory
 *     cost here.
 *   - Opens a worker, parses the document, destroys it. The
 *     worker connection is closed by `doc.destroy()` in
 *     `finally` even on partial failure.
 */
export async function extractPdfMetadata(blob: Blob): Promise<PdfMetadata> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const doc = await loadPdfDocument(bytes);
	try {
		const info = await doc.getMetadata();

		// pdf.js types `info.info` as plain `Object` (5.x). We
		// know it is a flat dictionary of strings (the PDF /Info
		// dictionary) and only read a handful of well-known keys.
		const infoDict = (info.info ?? {}) as Record<string, unknown>;
		const title = nonEmptyString(infoDict.Title);
		const author = nonEmptyString(infoDict.Author);
		// /Info has no `Language`; pull from catalog if present.
		const language = nonEmptyString(infoDict.Language);

		// Build the result with `exactOptionalPropertyTypes` in
		// mind: an explicit `undefined` is not assignable to a
		// property typed `title?: string`. We omit absent keys.
		const meta: { pageCount: number; title?: string; author?: string; language?: string } = {
			pageCount: doc.numPages,
		};
		if (title !== undefined) meta.title = title;
		if (author !== undefined) meta.author = author;
		if (language !== undefined) meta.language = language;
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
 *  layer) because it knows the pdf.js shape. */
export function pdfMetadataToSourceMetadata(meta: PdfMetadata): SourceMetadata {
	return { pageCount: meta.pageCount };
}

/** PDFs produced by some tools have `Title: ''` or `null` in
 *  the /Info dict. We treat those as absent so the generic UI
 *  can fall back to "(タイトルなし)". */
function nonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}
