/**
 * Unit tests for `PdfReaderHandle.resolveAnchor` — ADR-0007's recovery,
 * wired to a document.
 *
 * What is under test is the routing: which of the three answers a given
 * document earns, and what each one is allowed to claim. The decisions
 * that do not need pdf.js — the freshness rule, the write-back, the
 * tolerance — are pure and live in `anchor-recovery.test.ts` and
 * `anchor-geometry.test.ts`; the measurement itself needs a layout
 * engine and is the browser smoke's job.
 *
 * The three answers, because they are not variations of each other:
 *   - `null`      the anchor is not ours, or describes a page this file
 *                 does not have. There are no rects to fall back on.
 *   - `stale`     the text moved or could not be measured. Stored
 *                 rects, and no write-back (ADR-0007).
 *   - `fresh`     the quote matched *and* the geometry was measured.
 *
 * The last one is the point of the split: a match alone proves the text
 * is on the page, not that the highlight is still over it. happy-dom
 * has no layout, so the measurement here always fails — which means
 * this file can pin every path *except* `fresh`, and pins the
 * matched-but-unmeasurable case explicitly so the distinction cannot be
 * quietly lost.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';

import { type Anchor, isAnchorOfFormat } from '../../domain/annotation/index.ts';
import { asPageIndex } from '../../domain/reading-state.ts';
import { isPdfAnchor, type PdfAnchor } from './anchor.ts';
import { PdfReaderHandle } from './pdf-reader.ts';

const DOC_PAGE_COUNT = 12;

/** A pdf.js `TextItem` as the text layer reads it. Only the fields
 *  `toGlyphRun` touches are filled in, because everything else it would
 *  want is pdf.js's own business. */
function textItem(str: string, index: number) {
	return {
		str,
		dir: 'ltr',
		width: str.length * 5,
		height: 12,
		transform: [1, 0, 0, 1, 10 * index, 700],
		fontName: 'F1',
		hasEOL: false,
	};
}

/** A document whose pages carry the given glyph runs. Page 1 exists
 *  and is empty unless told otherwise, which is the "page with no text
 *  layer" case. */
function documentWith(pages: readonly (readonly string[])[]): PDFDocumentProxy {
	return {
		numPages: DOC_PAGE_COUNT,
		getPage: async (index: number) => {
			const runs = pages[index - 1] ?? [];
			return {
				getTextContent: async () => ({
					items: runs.map((text, at) => textItem(text, at)),
					styles: { F1: { fontFamily: 'sans-serif', ascent: 0.8, descent: -0.2 } },
				}),
				getViewport: () => ({
					scale: 1,
					width: 420,
					height: 800,
					rotation: 0,
					transform: [1, 0, 0, -1, 0, 800],
					convertToViewportPoint: (x: number, y: number) => [x, y],
					convertToViewportRectangle: (rect: readonly number[]) => rect,
					convertToPdfPoint: (x: number, y: number) => [x, 800 - y],
				}),
				cleanup: () => {},
			};
		},
		destroy: async () => {},
	} as unknown as PDFDocumentProxy;
}

const STORED_RECTS = [{ x: 10, y: 20, width: 30, height: 12 }] as const;

function anchorFor(over: Partial<PdfAnchor> = {}): Anchor {
	const payload: PdfAnchor = {
		page: asPageIndex(1),
		rects: [...STORED_RECTS],
		quote: { exact: 'alpha', suffix: ' beta' },
		...over,
	};
	return { format: 'pdf', payload } as Anchor;
}

function readerFor(pages: readonly (readonly string[])[]): PdfReaderHandle {
	return new PdfReaderHandle(documentWith(pages));
}

describe('resolveAnchor', () => {
	it('refuses an anchor that is not a well-formed PDF anchor', async () => {
		const reader = readerFor([['alpha beta']]);

		// The two guards, in order: the discriminator alone would
		// typecheck against a payload nothing has checked.
		expect(await reader.resolveAnchor({ format: 'epub', payload: {} } as Anchor)).toBeNull();
		expect(await reader.resolveAnchor(anchorFor({ quote: { exact: 42 } as never }))).toBeNull();
		expect(await reader.resolveAnchor(anchorFor({ rects: [] }))).toBeNull();
		expect(
			await reader.resolveAnchor({ format: 'pdf', payload: null } as unknown as Anchor),
		).toBeNull();

		// And the same payload *does* narrow once it is well-formed,
		// which is what makes the refusals above meaningful.
		const good = anchorFor();
		expect(isAnchorOfFormat(good, 'pdf')).toBe(true);
		expect(isPdfAnchor(good)).toBe(true);
	});

	it('refuses a page this file does not have', async () => {
		// A re-encoded document can be shorter than the one the anchor
		// was written against. "Page 40 of a 12-page file" is not a stale
		// highlight, it is an anchor that describes nothing — and there
		// are no rects to fall back on either.
		const reader = readerFor([['alpha beta']]);

		expect(
			await reader.resolveAnchor(anchorFor({ page: asPageIndex(DOC_PAGE_COUNT + 28) })),
		).toBeNull();
		expect(
			await reader.resolveAnchor(anchorFor({ page: asPageIndex(DOC_PAGE_COUNT) })),
		).not.toBeNull();
	});

	it('is stale when the page has no text at all', async () => {
		// A scan, a page of figures, a blank page. It can never resolve,
		// however the reader opens it — which is a different fact from
		// "the text on this page changed", and worth keeping apart.
		const reader = readerFor([[]]);

		const resolved = await reader.resolveAnchor(anchorFor());

		expect(resolved?.freshness).toBe('stale');
		expect(resolved?.display).toEqual(STORED_RECTS);
		expect(resolved?.updatedAnchor).toBeNull();
	});

	it('is stale when the quote is not on the page, keeping the stored rects', async () => {
		// The OCR-corrected, re-encoded, glyph-substituted case: the
		// anchor is the best available hint and is kept as it is.
		const reader = readerFor([['the text has been re-encoded']]);

		const resolved = await reader.resolveAnchor(
			anchorFor({ quote: { exact: 'alpha', suffix: ' beta' } }),
		);

		expect(resolved?.freshness).toBe('stale');
		expect(resolved?.display).toEqual(STORED_RECTS);
		// ADR-0007 refuses the write-back here: overwriting the stored
		// rects would destroy the only hint the anchor has.
		expect(resolved?.updatedAnchor).toBeNull();
		// The text is still reported, so the UI can say what the reader
		// had highlighted even when the page no longer agrees.
		expect(resolved?.selectedText).toBe('alpha');
	});

	it('is stale when the quote matched but the geometry could not be measured', async () => {
		// The case the two-step recovery exists for. A match proves the
		// text is still on the page; it does not prove the highlight is
		// still over it. happy-dom has no layout, so the measurement
		// always fails here — which is exactly the situation a real
		// browser also produces when a layer will not measure.
		const reader = readerFor([['alpha beta']]);

		const resolved = await reader.resolveAnchor(anchorFor());

		expect(resolved?.freshness).toBe('stale');
		expect(resolved?.display).toEqual(STORED_RECTS);
		expect(resolved?.updatedAnchor).toBeNull();
	});

	it('rejects on a closed reader, as a programming error rather than a miss', async () => {
		// A closed handle is a caller bug, not a fact about the document.
		// The same distinction `page()` makes: a recovery that missed is
		// answered with a value, a dead reader is answered with a throw,
		// and a caller that cannot tell them apart will eventually treat
		// its own bug as "this highlight is gone".
		const reader = readerFor([['alpha beta']]);
		await reader.close();

		await expect(reader.resolveAnchor(anchorFor())).rejects.toThrow(/closed/);
		// Idempotent close, and the reject is not a state corruption.
		await reader.close();
		await expect(reader.resolveAnchor(anchorFor())).rejects.toThrow(/closed/);
	});
});
