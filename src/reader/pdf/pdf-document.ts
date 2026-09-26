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
 * Why we pick the legacy build under Node:
 *   - pdf.js 5.x's main entry (`pdfjs-dist`) is browser-targeted
 *     and expects to fetch the worker from a URL. Under Node
 *     (Vitest) that URL is unresolvable and pdf.js warns
 *     "Please use the `legacy` build in Node.js environments."
 *   - The legacy build (`pdfjs-dist/legacy/build/pdf.mjs`)
 *     contains the same parser, runs without a worker on the
 *     main thread, and is the recommended entry for Node-side
 *     tooling.
 *   - In the browser we keep the main entry so the real worker
 *     (set up by `pdf-worker.ts`) handles parsing off the main
 *     thread.
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

import { READMARK_PDF_WORKER_URL, setupPdfWorker } from './pdf-worker.ts';

/** `true` when running under Node (not a browser DOM).
 *
 *  We cannot use `typeof window === 'undefined'` because Vitest
 *  with happy-dom polyfills `window`. We use `process.versions.node`
 *  which only Node sets — happy-dom does not. */
const IS_NODE = typeof process !== 'undefined' && process.versions?.node !== undefined;

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
 *   - Calls `setupPdfWorker()` for defense-in-depth in the
 *     browser. Under Node, the legacy build runs on the main
 *     thread and the worker URL is irrelevant; we still touch
 *     the constant so a bundler that tree-shakes the side-effect
 *     import keeps the URL live for the browser path.
 */
export async function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
	const pdfjsLib = await importPdfJs();

	// Browser: defense-in-depth. Node: legacy build runs without
	// a worker, but `setupPdfWorker` is a no-op safe call (it just
	// touches `GlobalWorkerOptions.workerSrc` on the unused entry).
	if (!IS_NODE) {
		await setupPdfWorker();
		void READMARK_PDF_WORKER_URL;
	}

	const loadingTask = pdfjsLib.getDocument({ data: bytes });
	return await loadingTask.promise;
}

/**
 * Resolve the pdf.js entry point appropriate for the current
 * environment. Kept in its own function so the dynamic-import
 * shape is obvious and the `@vite-ignore` comment (which prevents
 * Vite from rewriting the specifier) is right next to it.
 *
 * Why `@vite-ignore`:
 *   - Without it, Vite tries to bundle `pdfjs-dist/legacy/build/
 *     pdf.mjs` into the production browser bundle, which:
 *       (a) bloats the bundle with code the browser never runs,
 *       (b) fails to resolve under Vite because the `legacy/`
 *           subpath is not exported from pdfjs-dist's `exports`
 *           map (only `pdfjs-dist` is).
 *   - `@vite-ignore` makes Vite leave the specifier alone; the
 *     native ESM resolver then loads the file in Node. In the
 *     browser, this branch is dead (we pick the main entry) so
 *     the specifier is never reached.
 */
async function importPdfJs(): Promise<typeof import('pdfjs-dist')> {
	if (IS_NODE) {
		// `/* @vite-ignore */` is the documented Vite hint for
		// "do not rewrite this dynamic import at build time".
		const mod = await import(/* @vite-ignore */ 'pdfjs-dist/legacy/build/pdf.mjs');
		return mod as unknown as typeof import('pdfjs-dist');
	}
	return await import('pdfjs-dist');
}
