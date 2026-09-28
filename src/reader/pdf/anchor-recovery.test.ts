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
 *   - A quote that spans several runs, and one that sits inside one.
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
	it('finds a quote inside one run and returns that run', () => {
		const match = findQuote(ALPHA, { exact: 'beta' });

		expect(match?.start).toBe(6);
		expect(match?.items.map((item) => item.text)).toEqual(['beta ']);
		expect(match?.rects).toEqual([{ x: 10, y: 200, width: 25, height: 12 }]);
	});

	it('finds a quote that spans runs and returns all of them', () => {
		// Spanning runs is the ordinary case for a sentence, and it is
		// where a run-per-rect mistake would drop a line of highlight.
		const match = findQuote(ALPHA, { exact: 'beta gamma' });

		expect(match?.items.map((item) => item.text)).toEqual(['beta ', 'gamma.']);
		expect(match?.rects).toEqual([
			{ x: 10, y: 200, width: 25, height: 12 },
			{ x: 10, y: 300, width: 30, height: 12 },
		]);
	});

	it('picks the occurrence the context points at', () => {
		const page = layerOf(['see the cat. ', 'the cat sat. ', 'and the cat left.']);

		// The same phrase three times. The suffix is what says which one:
		// without it this would resolve to the first and highlight the
		// wrong sentence.
		const match = findQuote(page, { exact: 'the cat', suffix: ' left' });

		expect(match?.start).toBe(30);
		expect(match?.items.map((item) => item.text)).toEqual(['and the cat left.']);
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
		expect(findQuote(page, { exact: 'tail' })?.items.map((item) => item.text)).toEqual(['tail']);
	});

	it('skips empty runs instead of returning zero-width rects', () => {
		// pdf.js emits empty runs around marked content. They carry no
		// characters, so they cannot cover a match, and returning one
		// would paint an invisible overlay the reader could not account
		// for.
		const page = layerOf(['', 'alpha ', '', 'beta ', '']);

		const match = findQuote(page, { exact: 'alpha beta' });

		expect(match?.items.map((item) => item.text)).toEqual(['alpha ', 'beta ']);
		expect(match?.rects).toHaveLength(2);
	});
});
