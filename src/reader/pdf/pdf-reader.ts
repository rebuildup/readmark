/**
 * readmark — PDF reader (`Reader<'pdf'>`).
 *
 * The concrete side of ADR-0004's reader contract. Everything pdf.js
 * shaped — `PDFDocumentProxy`, page proxies, render tasks — stops
 * here: outside `src/reader/pdf/` the only thing callers see is
 * `Reader<'pdf'>`, `ReaderHandle<'pdf'>` and `PageHandle<'pdf'>`
 * from `src/reader/types.ts`.
 *
 * Three decisions worth stating:
 *
 *   - **Pages are cached, not re-fetched.** pdf.js parses a page dict
 *     once and keeps it; a cache keyed by the 1-based `PageIndex`
 *     means scrolling back up re-attaches the same `PageHandle`
 *     (and its already-rendered DOM) instead of re-running the
 *     render. The cache is released wholesale on `close()`. It does
 *     NOT evict: a reader that has scrolled through a long document
 *     holds one proxy per page until it navigates away, which is
 *     acceptable for a local-first app whose reader is closed on
 *     navigation, and is the thing to revisit if a future in-app
 *     page-jump UI makes a long session the common case.
 *   - **`close()` is the whole teardown contract.** It cancels the
 *     in-flight render of every cached page, releases the page
 *     proxies, and destroys the document — which is what shuts the
 *     pdf.js worker transport down. Callers (the screen) must call it
 *     on unmount and whenever the source changes, otherwise a
 *     re-render can still land against a destroyed document.
 *   - **`resolveAnchor` returns `null` for now.** Re-anchoring a
 *     stored quote against the text layer is #7's scope; until the
 *     quote search exists there is nothing to resolve, and returning
 *     a rect would claim a recovery this handle cannot perform.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { Anchor } from '../../domain/annotation/index.ts';
import type { PageIndex } from '../../domain/reading-state.ts';
import type { Reader, ReaderHandle, ReaderSource, ResolvedAnchor } from '../types.ts';
import { loadPdfDocument } from './pdf-document.ts';
import { PdfPageHandle } from './pdf-page.ts';

/** Wrap pdf.js's three "not a usable PDF" exceptions in the reader's
 *  own error, so callers above `src/reader/pdf/` switch on
 *  `PdfInvalidError` instead of on pdf.js exception names (same
 *  layering as `extractPdfMetadata`). */
async function openDocument(source: ReaderSource<'pdf'>): Promise<PDFDocumentProxy> {
	const bytes = new Uint8Array(await source.blob.arrayBuffer());
	try {
		return await loadPdfDocument(bytes);
	} catch (cause: unknown) {
		const { PdfInvalidError, isPdfJsInvalidException } = await import('./pdf-errors.ts');
		if (isPdfJsInvalidException(cause)) {
			throw new PdfInvalidError('readmark: the bytes are not a usable PDF', { cause });
		}
		throw cause;
	}
}

export class PdfReaderHandle implements ReaderHandle<'pdf'> {
	readonly format = 'pdf' as const;

	private readonly pages = new Map<PageIndex, PdfPageHandle>();
	private closed = false;

	constructor(private readonly document: PDFDocumentProxy) {}

	async pageCount(): Promise<number> {
		return this.document.numPages;
	}

	/** Page handle by 1-based index. Repeated calls for the same page
	 *  return the same handle, so a scroll that re-enters a page does
	 *  not restart its render. */
	async page(index: PageIndex): Promise<PdfPageHandle> {
		if (this.closed) {
			throw new Error('readmark: reader handle is closed');
		}
		const cached = this.pages.get(index);
		if (cached !== undefined) return cached;

		const pdfPage = await this.document.getPage(index);
		if (this.closed) {
			// The handle was closed while the page was being parsed.
			// Release it instead of handing back a page attached to a
			// destroyed document.
			pdfPage.cleanup();
			throw new Error('readmark: reader handle is closed');
		}
		const handle = new PdfPageHandle(index, pdfPage);
		this.pages.set(index, handle);
		return handle;
	}

	/** #7 owns quote → rects recovery. See the file header. */
	async resolveAnchor(_anchor: Anchor): Promise<ResolvedAnchor | null> {
		return null;
	}

	/** Release the document, its pages and its worker transport.
	 *  Idempotent. */
	async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		for (const page of this.pages.values()) {
			page.close();
		}
		this.pages.clear();
		try {
			await this.document.destroy();
		} catch {
			// A document already torn down (e.g. pdf.js closed the
			// worker after a fatal error) must not turn an unmount into
			// an unhandled rejection.
		}
	}
}

/** Factory used by the UI. Returning the interface rather than the
 *  class keeps `pdfjs-dist`'s types out of the screen, and lets the
 *  screen import this module lazily so the Library route does not pay
 *  for pdf.js. */
export function createPdfReader(): Reader<'pdf'> {
	return {
		format: 'pdf',
		open: async (input: ReaderSource<'pdf'>): Promise<PdfReaderHandle> => {
			const document = await openDocument(input);
			return new PdfReaderHandle(document);
		},
	};
}
