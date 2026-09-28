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

import { type Anchor, isAnchorOfFormat } from '../../domain/annotation/index.ts';
import type { PageIndex } from '../../domain/reading-state.ts';
import type { Reader, ReaderHandle, ReaderSource, ResolvedAnchor } from '../types.ts';
import { isPdfAnchor } from './anchor.ts';
import { fragmentsForRuns } from './anchor-geometry.ts';
import { findQuote, freshAnchor, staleAnchor } from './anchor-recovery.ts';
import { loadPdfDocument } from './pdf-document.ts';
import { PdfPageHandle } from './pdf-page.ts';
import { extractPageTextLayer } from './pdf-text-layer.ts';

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

	/**
	 * ADR-0007's recovery, wired up.
	 *
	 * The shape of the answer is the whole design, so it is worth
	 * stating before the code: there are three outcomes and they are not
	 * variations of each other.
	 *
	 *   - **`null`** — the anchor is not ours or not usable: a payload
	 *     that fails the guards, or a page this file does not have. A
	 *     re-encoded document can be shorter than the one the anchor was
	 *     written against, and "page 40 of a 12-page file" is not a
	 *     stale highlight, it is an anchor that describes nothing. There
	 *     is no rects to fall back on either, so `null` is the honest
	 *     answer and the caller drops the row.
	 *   - **`stale`** — the quote is not where it was, or its geometry
	 *     could not be rebuilt. The stored rects are the best available
	 *     hint and are returned as `display` unchanged, and
	 *     `updatedAnchor` is `null`: ADR-0007 refuses to rewrite a
	 *     stale anchor, because the original is what lets it recover if
	 *     the change that broke it is undone.
	 *   - **`fresh`** — the quote matched and the fragments were
	 *     measured. `display` is what was measured, not what was
	 *     stored, because a measurement against this copy of the file
	 *     beats a measurement against another one.
	 *
	 * The last two are decided by two different questions, and only
	 * answering both is what makes a highlight trustworthy: "is the
	 * text still here" is proven by the quote match, and "is it still
	 * in the same place" is proven by the measurement. A match with a
	 * failed measurement is `stale`, not fresh-with-nothing.
	 */
	async resolveAnchor(anchor: Anchor): Promise<ResolvedAnchor | null> {
		// The same programming error as `page()`, and the same throw: a
		// closed reader is a caller bug, not a recovery that missed. A
		// recovery miss is a fact about the document and is answered with
		// a value.
		if (this.closed) {
			throw new Error('readmark: reader handle is closed');
		}
		// Two guards, in this order, and the second one is not optional:
		// `isAnchorOfFormat` only reads the discriminator, so narrowing
		// through it alone would typecheck against a payload shape
		// nothing has checked (ADR-0007 §Enforcement).
		if (!isAnchorOfFormat(anchor, 'pdf') || !isPdfAnchor(anchor)) return null;
		const payload = anchor.payload;

		if (payload.page > this.document.numPages) return null;

		const pdfPage = await this.document.getPage(payload.page);
		// The handle may have been closed while the page was being
		// parsed, exactly as in `page()`.
		if (this.closed) {
			pdfPage.cleanup();
			throw new Error('readmark: reader handle is closed');
		}
		const layer = await extractPageTextLayer(pdfPage, payload.page);

		// No text on the page at all: a scan, a page of figures, an empty
		// page. `findQuote` would say no as well, and being explicit
		// keeps the reason apart from "the text changed" — a page with no
		// text layer can never resolve, however the reader opens it.
		if (layer.items.length === 0) return staleAnchor(payload);

		const match = findQuote(layer, payload.quote);
		if (match === null) return staleAnchor(payload);
		const fragments = await fragmentsForRuns(pdfPage, layer, match.runs);
		// Matched but unmeasurable. The quote proves the text is still on
		// the page; it does not prove the highlight is still over it, and
		// a `fresh` answer with no rects would claim both.
		if (fragments === null) return staleAnchor(payload);

		return freshAnchor(payload, fragments);
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
