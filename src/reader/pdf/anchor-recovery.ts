/**
 * readmark — quote search: ADR-0007's recovery, minus the pdf.js call.
 *
 * ADR-0007 makes the quote the canonical recovery key and the rects
 * display-only. That split is what this file is: given a stored quote
 * and a page's text layer, say whether the quote is still on the page
 * and, if it is, which glyph runs it covers — so the caller can refresh
 * the rects from the layer's own geometry instead of trusting rects
 * that were measured against a different render, a different zoom, or
 * a different file.
 *
 * It is deliberately pure: a `PageTextLayer` in, a match out. No
 * pdf.js, no DOM, no `async`. `PdfReaderHandle.resolveAnchor` is the
 * only thing that has to fetch the layer, and the only thing that can
 * fail for reasons that have nothing to do with whether the text is
 * there. That is also what makes it worth testing exhaustively: the
 * cases that decide whether a stored highlight is trusted or flagged
 * stale are all decided in here.
 *
 * ## Exact match only
 *
 * ADR-0007 rules out fuzzy matching, whitespace collapsing and
 * hyphenation repair for the MVP, and this is where that rule bites:
 *
 *   - The search is `indexOf` on the layer's own text. No
 *     normalisation, no folding, no `\s+` → ' '.
 *   - `prefix` / `suffix` are compared exactly as stored. They exist
 *     to tell two occurrences of the same phrase apart, not to make
 *     the search tolerant.
 *
 * The consequence is a real one and worth stating: a document whose
 * text layer carries ligatures or soft hyphens inconsistently will
 * recover some of its highlights and not others. The failure is
 * visible and marked (the anchor goes `stale` and keeps its stored
 * rects) rather than silent, which is the trade ADR-0007 chose.
 *
 * ## The text is the layer's, not the browser's
 *
 * The quote is searched against `items` joined in reading order with
 * nothing injected between them — no spaces, no newlines, no
 * separators of any kind. That is not an oversight; it is what keeps
 * the two ends of the round trip in agreement. Whatever produces a
 * quote must produce it from *these items* (see
 * `createAnchorFromSelection`, which walks the selection against the
 * layer), never from `getSelection().toString()`: the browser
 * synthesises whitespace and line breaks from layout, and its answer
 * would disagree with this one at every line wrap.
 *
 * A selection that spans two lines is the case that gets that wrong
 * first, and it is why the join rule is documented here rather than
 * left to whoever writes the selection side.
 */

import type { PageTextItem, PageTextLayer } from '../types.ts';
import type { PdfRect, TextQuote } from './anchor.ts';

/** A quote found on the page, and the runs it covers. */
export interface QuoteMatch {
	/** The runs the quote spans, in reading order. A quote inside one
	 *  run yields one item; a quote across two yields both. */
	readonly items: readonly PageTextItem[];
	/** The same runs as display rects, in raw PDF user-space — the
	 *  space `PdfAnchor.rects` is defined in, so the result needs no
	 *  transform before it is stored. */
	readonly rects: readonly PdfRect[];
	/** Character offset of the match within the page text. Useful for
	 *  asserting which occurrence was chosen; the caller should not
	 *  build anything on it. */
	readonly start: number;
}

/**
 * Locate `quote` in `layer`, or `null`.
 *
 * `null` means "do not trust the stored rects": either the text is not
 * on this page any more, or it is on the page but every occurrence
 * failed the context check. Both mean the same thing to the caller,
 * which is exactly why they return the same value — a highlight that
 * moved to a different sentence is not more recoverable than one whose
 * text was re-encoded away.
 */
export function findQuote(layer: PageTextLayer, quote: TextQuote): QuoteMatch | null {
	if (quote.exact === '') return null;
	const text = pageText(layer);
	if (text.length === 0) return null;

	let from = 0;
	for (;;) {
		const start = text.indexOf(quote.exact, from);
		if (start === -1) return null;
		if (contextMatches(text, quote, start)) {
			return matchAt(layer, start, quote.exact.length);
		}
		// A page can carry the same phrase several times — a running
		// head, a table of figures, a repeated heading. The context
		// rules out this one, so keep looking rather than reporting the
		// miss on the first candidate.
		from = start + 1;
	}
}

/**
 * The page's text: every run in reading order, joined with nothing.
 *
 * Exported because the selection side has to build its quote from the
 * same string, or the two halves of the round trip disagree at every
 * line wrap.
 */
export function pageText(layer: PageTextLayer): string {
	return layer.items.map((item) => item.text).join('');
}

/**
 * Whether the text around `start` is the context the quote was stored
 * with.
 *
 * A stored context that is absent from the page is a mismatch, not a
 * wildcard: a quote taken from the middle of a page is stored with the
 * words before it, and if those words are gone then the page changed
 * under the anchor.
 */
function contextMatches(text: string, quote: TextQuote, start: number): boolean {
	const end = start + quote.exact.length;
	if (quote.prefix !== undefined && quote.prefix !== '') {
		if (text.slice(Math.max(0, start - quote.prefix.length), start) !== quote.prefix) return false;
	}
	if (quote.suffix !== undefined && quote.suffix !== '') {
		if (text.slice(end, end + quote.suffix.length) !== quote.suffix) return false;
	}
	return true;
}

/** The runs a match spans, as items and as rects. */
function matchAt(layer: PageTextLayer, start: number, length: number): QuoteMatch {
	const end = start + length;
	const items: PageTextItem[] = [];
	let offset = 0;
	for (const item of layer.items) {
		const itemStart = offset;
		const itemEnd = offset + item.text.length;
		offset = itemEnd;
		// Empty runs (pdf.js emits them around marked content) carry no
		// characters, so they can never cover a match and are skipped
		// rather than being added as zero-width rects.
		if (itemEnd === itemStart) continue;
		if (itemEnd <= start || itemStart >= end) continue;
		items.push(item);
	}
	// A quote that starts or ends inside a run still takes the whole
	// run's rect: the layer exposes a rect per run and nothing finer,
	// and a partially-covered run is a display approximation the
	// `display`-only half of the anchor model is allowed to make.
	return {
		items,
		rects: items.map((item) => ({
			x: item.rect.x,
			y: item.rect.y,
			width: item.rect.width,
			height: item.rect.height,
		})),
		start,
	};
}
