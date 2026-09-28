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
 *
 * ## Where the rects are not made
 *
 * This returns *offsets*, not rectangles, on purpose. A run's rect is
 * the bounding box of the whole run, so a quote that covers two words
 * of a fifty-character run would be painted as fifty characters: the
 * highlight would read as a bug, and it would be one. `PdfAnchor.rects`
 * asks for "one entry per visual line of the selection", which a
 * per-run rect is not even when the run happens to be a whole line.
 *
 * Turning offsets into rects is a separate stage, and it does not
 * measure anything itself: it measures the text layer with
 * `Range.getClientRects()` and converts the client rects back to
 * user-space. See ADR-0007 §"Where fragment geometry comes from" for
 * why the run's own box is not enough (a run's box is the box of the
 * whole run) and why a proportional split along that box is not used
 * (it is visibly wrong on a justified line, and a highlight that
 * drifts off its text is worse than a coarse one).
 *
 * The shapes here are what that stage needs and nothing more: which
 * runs, and which characters inside each. Fragments are one-or-more
 * per selection and are not merged per line — a PDF line is split
 * into runs for reasons that have nothing to do with reading, so the
 * runs on one baseline are not one rectangle.
 *
 * All of this is display-only (ADR-0007: the quote is canonical and
 * the rects are the display half), which is why none of it sits on
 * the path that decides whether an anchor is trusted.
 */

import type { PageTextItem, PageTextLayer } from '../types.ts';
import type { TextQuote } from './anchor.ts';

/** One run the quote covers, and how much of it the quote actually is. */
export interface QuoteRunMatch {
	readonly item: PageTextItem;
	/** First character of the quote *inside this run*. */
	readonly start: number;
	/** One past the last character of the quote inside this run. The
	 *  run's own length, not the page's: a quote inside a long run has
	 *  `end - start` characters of it, and the geometry stage needs
	 *  that number against `item.text.length`, not against the page. */
	readonly end: number;
}

/** A quote found on the page, and the runs it covers. */
export interface QuoteMatch {
	/** The runs the quote spans, in reading order, each with the
	 *  quote's extent inside it. */
	readonly runs: readonly QuoteRunMatch[];
	/** Character offset of the match within `pageText(layer)`. Exported
	 *  for tests and for a caller that wants to say which occurrence
	 *  was chosen; nothing downstream should build on the page-level
	 *  offset where a run-level one is what it needs. */
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

/** The runs a match spans, each with the quote's extent inside it. */
function matchAt(layer: PageTextLayer, start: number, length: number): QuoteMatch {
	const end = start + length;
	const runs: QuoteRunMatch[] = [];
	let offset = 0;
	for (const item of layer.items) {
		const itemStart = offset;
		const itemEnd = offset + item.text.length;
		offset = itemEnd;
		// Empty runs (pdf.js emits them around marked content) carry no
		// characters, so they can never cover a match and are skipped
		// rather than being reported as zero-length coverage.
		if (itemEnd === itemStart) continue;
		if (itemEnd <= start || itemStart >= end) continue;
		runs.push({
			item,
			// Page offsets clamped into the run's own coordinate space, so
			// a quote that starts part-way into a run reports the
			// characters it really covers rather than the whole run.
			start: Math.max(0, start - itemStart),
			end: Math.min(item.text.length, end - itemStart),
		});
	}
	return { runs, start };
}
