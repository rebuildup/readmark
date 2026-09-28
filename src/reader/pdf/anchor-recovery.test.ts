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

import { asPageIndex } from '../../domain/reading-state.ts';
import type { PageTextItem, PageTextLayer } from '../types.ts';
import { findQuote, pageText } from './anchor-recovery.ts';

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
