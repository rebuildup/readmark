/**
 * Unit tests for quote search — ADR-0007's recovery, tested without
 * pdf.js.
 *
 * The helper is pure, so every case that decides whether a stored
 * highlight is *trusted* or flagged *stale* can be pinned here against
 * a hand-written text layer whose geometry is visible in the test. The
 * browser smoke cannot cover any of it: stale-vs-fresh needs a
 * document that changed under the anchor, which a fixture that never
 * changes cannot produce.
 *
 * What is worth a test, in the order it has bitten someone:
 *   - A quote that spans several runs, and one that sits inside one —
 *     and a quote that covers *part* of a run, which is the case a
 *     whole-run rect gets visibly wrong.
 *   - `runIndex` is the address in the *page*, so a quote that begins
 *     halfway down a page reports the run it covers and not the run it
 *     happens to be first in.
 *   - The same phrase twice on a page, told apart by context — the
 *     case `prefix` / `suffix` exist for. A running head or a
 *     repeated heading is not exotic.
 *   - Text that is gone, and text that is present in the wrong place.
 *     Both mean "stale", and both must not resolve.
 *   - Whitespace and line-wrap differences, which ADR-0007 rules out
 *     of scope and which therefore have to be *visible* failures
 *     rather than quiet tolerance.
 */

import { describe, expect, it } from 'vitest';
import { isAnchorOfFormat } from '../../domain/annotation/index.ts';
import { asPageIndex } from '../../domain/reading-state.ts';
import type { PageTextItem, PageTextLayer } from '../types.ts';
import { isPdfAnchor, type PdfAnchor, type PdfRect } from './anchor.ts';
import {
	findQuote,
	freshAnchor,
	pageText,
	QUOTE_CONTEXT_LIMIT,
	quoteForRange,
	runsForRange,
	selectionRangeInLayer,
	staleAnchor,
} from './anchor-recovery.ts';

/**
 * A layer whose runs are `["alpha ", "beta ", "gamma."]` unless the
 * test says otherwise. Rects are numbered by item so a test can name
 * the geometry it expects: item 1 sits at y=100, item 2 at y=200, and
 * so on, which is enough to tell "the matched run" from "a run".
 */
function layerOf(texts: readonly string[]): PageTextLayer {
	const items: PageTextItem[] = texts.map((text, index) => ({
		text,
		rect: { x: 10, y: 100 * (index + 1), width: text.length * 5, height: 12 },
	}));
	return { format: 'pdf', page: asPageIndex(1), items };
}

const ALPHA = layerOf(['alpha ', 'beta ', 'gamma.']);

describe('pageText', () => {
	it('joins the runs in reading order, injecting nothing', () => {
		// No separators, no newlines. The selection side has to build its
		// quotes from this same string, or the two halves of the round
		// trip disagree at every line wrap.
		expect(pageText(ALPHA)).toBe('alpha beta gamma.');
		expect(pageText(layerOf([]))).toBe('');
	});
});

describe('findQuote', () => {
	it('finds a quote inside one run and reports the characters it covers', () => {
		const match = findQuote(ALPHA, { exact: 'beta' });

		expect(match?.start).toBe(6);
		expect(match?.runs.map((run) => run.item.text)).toEqual(['beta ']);
		// Run-local, not page-local: 'beta' is characters 0..4 of its own
		// run and characters 6..10 of the page. The geometry stage needs
		// the first pair.
		expect(match?.runs.map((run) => [run.start, run.end])).toEqual([[0, 4]]);
	});

	it('reports partial coverage of a run instead of the whole run', () => {
		// One run holding a whole line: a quote covering two words of it
		// must not be reported as covering the line. A geometry stage
		// given [0, runLength] would paint the entire run, which is the
		// bug this shape exists to make impossible.
		const line = layerOf(['alpha beta gamma']);

		const match = findQuote(line, { exact: 'beta' });

		expect(match?.runs).toHaveLength(1);
		expect(match?.runs[0]?.item.text).toBe('alpha beta gamma');
		expect([match?.runs[0]?.start, match?.runs[0]?.end]).toEqual([6, 10]);
		// A whole-run quote still reports the whole run.
		expect(findQuote(line, { exact: 'gamma' })?.runs.map((run) => [run.start, run.end])).toEqual([
			[11, 16],
		]);
	});

	it("finds a quote that spans runs and reports each run's own extent", () => {
		// Spanning runs is the ordinary case for a sentence. The first run
		// is covered to its end, the second from its start — and saying so
		// is what lets the geometry stage merge them into one line.
		const match = findQuote(ALPHA, { exact: 'beta gamma' });

		expect(match?.runs.map((run) => run.item.text)).toEqual(['beta ', 'gamma.']);
		expect(match?.runs.map((run) => [run.start, run.end])).toEqual([
			[0, 5],
			[0, 5],
		]);
	});

	it('clamps coverage to the runs it actually spans', () => {
		// The quote starts inside run 2 and ends inside run 3, so run 1
		// gets no coverage at all and must not appear.
		const match = findQuote(ALPHA, { exact: 'ha be' });

		expect(match?.runs.map((run) => [run.start, run.end])).toEqual([
			[3, 6],
			[0, 2],
		]);
	});

	it('addresses each run by its position in the page, not in the match', () => {
		// The geometry stage finds a run's element by this index, so a
		// match-local position would send a quote in the fifth run to the
		// first one on the page: a highlight, drawn in the wrong place.
		const page = layerOf(['zero ', 'one ', 'two ', 'three ', 'four ']);

		const match = findQuote(page, { exact: 'two three' });

		expect(match?.runs.map((run) => run.runIndex)).toEqual([2, 3]);
		// A single-run match halfway down reports where it is, not 0.
		expect(findQuote(page, { exact: 'four' })?.runs.map((run) => run.runIndex)).toEqual([4]);
		expect(findQuote(page, { exact: 'zero' })?.runs.map((run) => run.runIndex)).toEqual([0]);
	});

	it('picks the occurrence the context points at', () => {
		const page = layerOf(['see the cat. ', 'the cat sat. ', 'and the cat left.']);

		// The same phrase three times. The suffix is what says which one:
		// without it this would resolve to the first and highlight the
		// wrong sentence.
		const match = findQuote(page, { exact: 'the cat', suffix: ' left' });

		expect(match?.start).toBe(30);
		expect(match?.runs.map((run) => run.item.text)).toEqual(['and the cat left.']);
		expect(match?.runs.map((run) => [run.start, run.end])).toEqual([[4, 11]]);
	});

	it('takes the first occurrence when the quote carries no context', () => {
		const page = layerOf(['the cat sat. ', 'the cat left.']);

		expect(findQuote(page, { exact: 'the cat' })?.start).toBe(0);
	});

	it('refuses a phrase whose every occurrence fails the context', () => {
		// The text is on the page, and it is still the wrong text: a
		// highlight that has moved to another sentence is no more
		// trustworthy than one whose text was re-encoded away, and both
		// mean the stored rects go stale.
		const page = layerOf(['the cat sat. ', 'the cat left.']);

		expect(findQuote(page, { exact: 'the cat', prefix: 'while ' })).toBeNull();
		expect(findQuote(page, { exact: 'the cat', suffix: ' purred' })).toBeNull();
	});

	it('refuses text that is not on the page at all', () => {
		expect(findQuote(ALPHA, { exact: 'delta' })).toBeNull();
	});

	it('refuses an empty quote rather than matching the page start', () => {
		// An empty quote matches at offset 0 in every page, so resolving
		// it would paint a highlight at the top of the document.
		expect(findQuote(ALPHA, { exact: '' })).toBeNull();
		expect(findQuote(layerOf([]), { exact: 'anything' })).toBeNull();
	});

	it('matches exactly, with no whitespace tolerance', () => {
		// ADR-0007 rules out whitespace collapsing for the MVP. The
		// failure has to be visible — the anchor goes stale and says so
		// — rather than quietly resolving to a slightly wrong place.
		expect(findQuote(ALPHA, { exact: 'alpha beta' })).not.toBeNull();
		expect(findQuote(ALPHA, { exact: 'alpha  beta' })).toBeNull();
		expect(findQuote(ALPHA, { exact: 'alpha\nbeta' })).toBeNull();
		expect(findQuote(ALPHA, { exact: 'ALPHA' })).toBeNull();
	});

	it('resolves a quote at the very start or end of the page', () => {
		const page = layerOf(['alpha beta. ', 'tail']);

		// A quote taken from the top of a page has no prefix to store, and
		// one from the bottom has no suffix. Storing "nothing" and
		// comparing it to a real neighbour would fail a match that is
		// perfectly good.
		expect(findQuote(page, { exact: 'alpha', prefix: '' })?.start).toBe(0);
		expect(findQuote(page, { exact: 'tail' })?.runs.map((run) => run.item.text)).toEqual(['tail']);
	});

	it('skips empty runs instead of reporting zero-length coverage', () => {
		// pdf.js emits empty runs around marked content. They carry no
		// characters, so they cannot cover a match, and reporting one
		// would produce an empty rect for a geometry stage to place.
		const page = layerOf(['', 'alpha ', '', 'beta ', '']);

		const match = findQuote(page, { exact: 'alpha beta' });

		expect(match?.runs.map((run) => run.item.text)).toEqual(['alpha ', 'beta ']);
		expect(match?.runs.map((run) => [run.start, run.end])).toEqual([
			[0, 6],
			[0, 4],
		]);
	});
});

describe('the recovery answer', () => {
	const STORED: readonly PdfRect[] = [
		{ x: 10, y: 20, width: 30, height: 12 },
		{ x: 10, y: 40, width: 30, height: 12 },
	];

	function payload(rects: readonly PdfRect[] = STORED): PdfAnchor {
		return {
			page: asPageIndex(3),
			rects,
			quote: { exact: 'the cat', prefix: 'saw the ', suffix: ' sat down' },
		};
	}

	describe('fresh', () => {
		it('reports what was measured, not what was stored', () => {
			// A measurement against this copy of the file beats one taken
			// against another copy, which is the whole reason recovery
			// exists.
			const measured: readonly PdfRect[] = [{ x: 11, y: 21, width: 31, height: 12 }];

			const resolved = freshAnchor(payload(), measured);

			expect(resolved.freshness).toBe('fresh');
			expect(resolved.display).toBe(measured);
			expect(resolved.selectedText).toBe('the cat');
			expect(resolved.page).toBe(3);
		});

		it('hands back a write-back that moves the rects and nothing else', () => {
			const measured: readonly PdfRect[] = [{ x: 90, y: 21, width: 31, height: 12 }];

			const updated = freshAnchor(payload(), measured).updatedAnchor;

			expect(updated).not.toBeNull();
			expect(updated?.format).toBe('pdf');
			// `updatedAnchor` is `Anchor<unknown>` to anything outside
			// `reader/pdf/`, so this assertion has to go through the same
			// two guards a format-aware caller would. It cannot be a cast,
			// which is the point of the field being `unknown`.
			if (updated === null || !isAnchorOfFormat(updated, 'pdf') || !isPdfAnchor(updated)) {
				throw new Error('the write-back is not a well-formed PDF anchor');
			}
			// The page and the quote are what identify the annotation. A
			// write-back that changed either would be a second claim
			// about what this highlight is.
			expect(updated.payload.page).toBe(3);
			expect(updated.payload.quote).toEqual({
				exact: 'the cat',
				prefix: 'saw the ',
				suffix: ' sat down',
			});
			expect(updated.payload.rects).toBe(measured);
		});

		it('asks for no write when the measured rects are already the stored ones', () => {
			expect(freshAnchor(payload(), STORED).updatedAnchor).toBeNull();
		});

		it('judges "unchanged" by a tolerance, not by equality', () => {
			// The two measurements are floats from two sessions, so
			// `===` would report a difference where the document has not
			// moved at all, and rewrite a correct row on every open.
			const drifted: readonly PdfRect[] = [
				{ x: 10.2, y: 20.2, width: 30.2, height: 12.2 },
				{ x: 10.2, y: 40.2, width: 30.2, height: 12.2 },
			];

			expect(freshAnchor(payload(), drifted).updatedAnchor).toBeNull();
		});

		it('asks for a write when a fragment count changed', () => {
			// One fragment against three is a different shape however close
			// the numbers are — a recovery that merged or split a line must
			// not be able to report "unchanged" by lining up a prefix.
			const merged: readonly PdfRect[] = [{ x: 10, y: 20, width: 30, height: 32 }];

			expect(freshAnchor(payload(), merged).updatedAnchor).not.toBeNull();
		});
	});

	describe('stale', () => {
		it('keeps the stored rects and asks for no write', () => {
			// ADR-0007: a stale anchor's stored rects are not rewritten.
			// They may be off, and they are still the best available hint —
			// and keeping the original is what lets the anchor recover if
			// the change that broke it is undone.
			const resolved = staleAnchor(payload());

			expect(resolved.freshness).toBe('stale');
			expect(resolved.display).toBe(STORED);
			expect(resolved.updatedAnchor).toBeNull();
			expect(resolved.selectedText).toBe('the cat');
			expect(resolved.page).toBe(3);
		});
	});
});

describe('quoteForRange', () => {
	// One long run, so the context limit can be tested on a known
	// alphabet: '.' is the 46th character, so counting is checkable by
	// hand in the expectations below.
	const filler = '.'.repeat(80);
	const page = layerOf([filler]);

	it('takes the selection as the exact text and the rest as context', () => {
		const quote = quoteForRange(page, { start: 40, end: 44 });

		expect(quote?.exact).toBe('....');
		expect(quote?.prefix).toHaveLength(QUOTE_CONTEXT_LIMIT);
		expect(quote?.suffix).toHaveLength(QUOTE_CONTEXT_LIMIT);
	});

	it('keeps 32 characters of context on each side, and not 33', () => {
		// The boundary is the whole point of the constant, and both
		// sides of it are pinned: a limit of 33 would store a row that
		// `TextQuote` does not describe, and a limit of 31 would throw
		// away context that disambiguates a short phrase.
		const quote = quoteForRange(page, { start: 40, end: 44 });

		expect(quote?.prefix).toBe('.'.repeat(32));
		expect(quote?.prefix).not.toBe('.'.repeat(33));
		expect(quote?.prefix).not.toBe('.'.repeat(31));
		expect(quote?.suffix).toBe('.'.repeat(32));
		expect(quote?.suffix).not.toBe('.'.repeat(33));
	});

	it('cuts the prefix from the far end, so what survives is adjacent', () => {
		// The characters nearest the selection are the ones that say
		// where it was; the far ones are the first to stop being useful.
		const text = '0123456789ABCDEFGHIJ0123456789abcdefghijKLMNOP';
		const quote = quoteForRange(layerOf([text]), { start: 40, end: 44 });

		// The selection is `KLMN` at 40..44, so the 32 characters of
		// context are 8..40: they end with the three characters
		// immediately before the selection, and the eight before those
		// are the ones dropped.
		expect(quote?.exact).toBe('KLMN');
		expect(quote?.prefix).toBe(text.slice(8, 40));
		expect(quote?.prefix).toHaveLength(32);
		expect(quote?.prefix?.endsWith('hij')).toBe(true);
	});

	it('omits a context it does not have rather than storing an empty one', () => {
		// A selection at the very start has nothing before it. Storing
		// `prefix: ''` would be a field the guard accepts and recovery
		// compares against nothing.
		const quote = quoteForRange(layerOf(['alpha beta']), { start: 0, end: 5 });

		expect(quote?.exact).toBe('alpha');
		expect(quote?.prefix).toBeUndefined();
		expect(quote?.suffix).toBe(' beta');
	});

	it('refuses an empty selection and a range past the text', () => {
		// An empty quote matches at the top of every page, so a highlight
		// that stored one would resolve there on the next open.
		expect(quoteForRange(page, { start: 20, end: 20 })).toBeNull();
		expect(quoteForRange(page, { start: 20, end: 19 })).toBeNull();
		expect(quoteForRange(page, { start: 0, end: pageText(page).length + 1 })).toBeNull();
	});

	it('builds a quote that findQuote can find again', () => {
		// The round trip the two ends of the anchor depend on: a quote
		// built from the layer must resolve against that same layer, or
		// every anchor goes stale on a document nobody changed.
		const quote = quoteForRange(ALPHA, { start: 6, end: 10 });
		if (quote === null) throw new Error('a selection inside the text produced no quote');
		// Rebuilt rather than spread: `exactOptionalPropertyTypes` will
		// not take `prefix: undefined` for a field that is optional by
		// omission, which is the same distinction `quoteForRange` makes.
		const match = findQuote(ALPHA, {
			exact: quote.exact,
			...(quote.prefix === undefined ? {} : { prefix: quote.prefix }),
			...(quote.suffix === undefined ? {} : { suffix: quote.suffix }),
		});

		expect(match?.start).toBe(6);
	});
});

describe('selectionRangeInLayer', () => {
	/** A text layer shaped like the DOM `buildTextLayer` produces: one
	 *  span per run, in the same order, holding the same text. */
	function domFor(layer: PageTextLayer): {
		layer: HTMLElement;
		spanAt: (index: number) => HTMLSpanElement;
	} {
		const host = document.createElement('div');
		host.className = 'rm-text-layer';
		for (const item of layer.items) {
			const span = document.createElement('span');
			span.textContent = item.text;
			host.appendChild(span);
		}
		document.body.appendChild(host);
		const spans = [...host.querySelectorAll('span')];
		return { layer: host, spanAt: (index) => spans[index] as HTMLSpanElement };
	}

	function rangeIn(span: HTMLSpanElement, start: number, end: number): Range {
		const range = document.createRange();
		const text = span.firstChild as Text;
		range.setStart(text, start);
		range.setEnd(text, end);
		return range;
	}

	/** A range whose endpoints are in two different runs — what a drag
	 *  across a line break produces. */
	function rangeAcross(
		from: HTMLSpanElement,
		fromOffset: number,
		to: HTMLSpanElement,
		toOffset: number,
	): Range {
		const range = document.createRange();
		range.setStart(from.firstChild as Text, fromOffset);
		range.setEnd(to.firstChild as Text, toOffset);
		return range;
	}

	it('locates a selection inside one run', () => {
		const dom = domFor(ALPHA);

		// 'beta' is characters 6..10 of the page, and characters 0..4 of
		// its own run.
		const range = selectionRangeInLayer(rangeIn(dom.spanAt(1), 0, 4), ALPHA);

		expect(range).toEqual({ start: 6, end: 10 });
	});

	it('locates a selection that starts and ends in different runs', () => {
		const dom = domFor(ALPHA);

		// From the start of 'beta ' to inside 'gamma.': the endpoints are
		// in different spans, and the page offset has to account for the
		// whole first run rather than restarting at the second.
		const range = selectionRangeInLayer(rangeAcross(dom.spanAt(1), 0, dom.spanAt(2), 5), ALPHA);

		expect(range).toEqual({ start: 6, end: 16 });
	});

	it('reads a caret at the end of a run without running into the next one', () => {
		const dom = domFor(ALPHA);

		// Dragging to the end of a line produces an offset equal to the
		// text length. Addressing the next run's text with it would make
		// the highlight start a word early.
		const range = selectionRangeInLayer(rangeIn(dom.spanAt(0), 0, 6), ALPHA);

		expect(range).toEqual({ start: 0, end: 6 });
	});

	it('refuses a selection this page cannot account for', () => {
		domFor(ALPHA);
		const elsewhere = document.createElement('span');
		elsewhere.textContent = 'another page';
		document.body.appendChild(elsewhere);
		const outside = document.createRange();
		const outsideText = elsewhere.firstChild as Text;
		outside.setStart(outsideText, 0);
		outside.setEnd(outsideText, 4);

		// Cross-page selections are two anchors (ADR-0007), and a
		// highlight that silently covered the wrong page is worse than one
		// that was not offered.
		expect(selectionRangeInLayer(outside, ALPHA)).toBeNull();
		expect(selectionRangeInLayer(document.createRange(), ALPHA)).toBeNull();
	});
});

describe('runsForRange', () => {
	it('gives the page-global index and the run-local extent of each run', () => {
		const runs = runsForRange(ALPHA, { start: 6, end: 16 });

		expect(runs.map((run) => [run.runIndex, run.start, run.end])).toEqual([
			[1, 0, 5],
			[2, 0, 5],
		]);
	});

	it('clamps a run the range only touches at an edge', () => {
		const runs = runsForRange(ALPHA, { start: 3, end: 8 });

		expect(runs.map((run) => [run.runIndex, run.start, run.end])).toEqual([
			[0, 3, 6],
			[1, 0, 2],
		]);
	});
});
