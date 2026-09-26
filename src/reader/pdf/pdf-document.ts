/**
 * readmark — PDF document loader.
 *
 * Single responsibility (ADR-0004 §Boundary):
 *   - Convert a `Blob` / `Uint8Array` of PDF bytes into a
 *     `pdfjsLib.PDFDocumentProxy`.
 *   - Hide the `pdfjsLib.getDocument()` plumbing so callers
 *     (PdfReaderHandle in #11) don't import the main `pdfjs-dist`
 *     module directly.
 *
 * Why a separate file from `pdf-worker.ts`:
 *   - The worker URL setup (pdf-worker.ts) runs at module
 *     evaluation; document loading happens at runtime.
 *   - Mixing the two would conflate "side-effect init" with
 *     "asynchronous load", making HMR / testing harder.
 *
 * Why we keep `PDFDocumentProxy` in the return type:
 *   - The format-specific PdfPageHandle (#11) needs to call
 *     `doc.getPage(n)` and `doc.destroy()`. Both are
 *     `PDFDocumentProxy` methods.
 *   - `PDFDocumentProxy` is the ONLY pdf.js type that escapes
 *     this folder. Generic code outside `src/reader/pdf/`
 *     must not import it — that boundary is enforced by Biome
 *     `noRestrictedImports` (only the `pdfjs-dist` package path
 *     is gated; the TYPE leaking via this file is reviewed
 *     case-by-case in #11 when the page handle is added).
 *
 * In scope for #2:
 *   - `loadPdfDocument(bytes)` — the smoke-test entry point.
 *     #11 will replace this with the full Reader/ReaderHandle
 *     contract (`open(ReaderSource<pdf>) → PdfReaderHandle`).
 *
 * Out of scope for #2:
 *   - `ReaderSource<F>` acceptance — that's #11.
 *   - Anchor resolution, page rendering, text extraction — #11 / #7.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument } from 'pdfjs-dist';

import { READMARK_PDF_WORKER_URL, setupPdfWorker } from './pdf-worker.ts';

/**
 * Load a PDF document from bytes. Returns the live proxy.
 *
 * `bytes` must be the raw PDF byte stream (e.g. the result of
 * `await blob.arrayBuffer()` followed by `new Uint8Array(buffer)`).
 *
 * Caller MUST `await doc.destroy()` when done. The proxy owns
 * the worker; leaking it causes worker leaks in long-lived
 * readers. `PdfReaderHandle.close()` (#11) wraps this.
 *
 * Side effects:
 *   - Calls `setupPdfWorker()` for defense-in-depth. In normal
 *     use the worker is already initialized via the
 *     `pdf-worker.ts` side-effect import, but re-running is
 *     cheap and avoids "I forgot to import pdf-worker" bugs
 *     in callers.
 */
export async function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
	// Defense-in-depth: ensure worker URL is set even if a caller
	// skipped the `pdf-worker.ts` side-effect import.
	setupPdfWorker();

	// Touch the constant so a bundler that tree-shakes the
	// side-effect import still keeps the URL live. (Vite respects
	// side effects in ESM imports, but this guard documents the
	// dependency.)
	void READMARK_PDF_WORKER_URL;

	const loadingTask = getDocument({ data: bytes });
	return await loadingTask.promise;
}
