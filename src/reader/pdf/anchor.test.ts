/**
 * Unit tests for the PDF anchor guard.
 *
 * `isPdfAnchor` is the only thing standing between a stored row and
 * code that reads `payload.rects` / `payload.quote` as PDF shapes, so
 * what it *accepts* matters as much as what it rejects. Every case
 * here is a payload that some version, some bug or some hand-edited
 * IndexedDB could plausibly contain.
 *
 * The guard is structural, not semantic: it proves a payload has the
 * declared shape and nothing more. Whether the page exists, whether
 * the rects are inside it, and whether the quote is still on the page
 * are recovery-time questions, and this file is where that boundary
 * is pinned — a guard that grew "clever" checks would turn a stale
 * highlight into an unreadable one.
 */

import { describe, expect, it } from 'vitest';

import type { Anchor } from '../../domain/annotation/index.ts';
import { asPageIndex } from '../../domain/reading-state.ts';
import { isPdfAnchor, isPdfResolvedDisplay, type PdfAnchor, type PdfRect } from './anchor.ts';

const RECT = { x: 10, y: 20, width: 30, height: 12 };

/** A well-formed PDF anchor, spread over by each test to break one
 *  field — so a test names the field it is about. */
const VALID: PdfAnchor = {
	page: asPageIndex(3),
	rects: [RECT],
	quote: { exact: 'the cat' },
};

function anchorWith(payload: unknown): Anchor {
	return { format: 'pdf', payload } as unknown as Anchor;
}

describe('isPdfAnchor', () => {
	it('accepts a well-formed anchor, with and without context', () => {
		expect(isPdfAnchor(anchorWith(VALID))).toBe(true);
		expect(
			isPdfAnchor(
				anchorWith({
					...VALID,
					quote: { exact: 'the cat', prefix: 'saw the ', suffix: ' sat down' },
				}),
			),
		).toBe(true);
		// A stored empty context is a real shape: a quote taken from the
		// top of a page has nothing before it to store.
		expect(isPdfAnchor(anchorWith({ ...VALID, quote: { exact: 'the', prefix: '' } }))).toBe(true);
	});

	it('rejects a context that is present but not text', () => {
		// The case this file exists for. `prefix` is optional, so a
		// number here is not "absent" — and recovery reads it and
		// compares it against page text, so it would be compared as a
		// number at the one place allowed to trust this guard.
		// `unknown` rather than `Partial<TextQuote>`: the whole point of
		// these cases is payloads the type forbids, and annotating them
		// with the type they violate is the mistake this file exists to
		// catch.
		const malformed: readonly unknown[] = [
			{ exact: 'the cat', prefix: 123 },
			{ exact: 'the cat', suffix: 123 },
			{ exact: 'the cat', prefix: ['a', 'b'] },
			{ exact: 'the cat', suffix: { length: 3 } },
			{ exact: 'the cat', prefix: null },
		];
		for (const quote of malformed) {
			expect(isPdfAnchor(anchorWith({ ...VALID, quote }))).toBe(false);
		}
	});

	it('rejects a quote that is not an object with a string `exact`', () => {
		expect(isPdfAnchor(anchorWith({ ...VALID, quote: null }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, quote: 'the cat' }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, quote: { exact: 42 } }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, quote: {} }))).toBe(false);
	});

	it('rejects a page that is not a 1-based integer', () => {
		expect(isPdfAnchor(anchorWith({ ...VALID, page: 0 }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, page: 2.5 }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, page: '3' }))).toBe(false);
	});

	it('rejects rects that are missing, empty or not four numbers', () => {
		// Empty is rejected deliberately: a highlight with no geometry
		// has nothing to paint, and accepting it would hand the painter
		// an anchor that resolves and then draws nothing.
		expect(isPdfAnchor(anchorWith({ ...VALID, rects: [] }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, rects: 'nope' }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, rects: [{ ...RECT, width: '30' }] }))).toBe(false);
		expect(isPdfAnchor(anchorWith({ ...VALID, rects: [{ x: 1, y: 2 }] }))).toBe(false);
	});

	it('rejects a payload that is not an object, or not PDF at all', () => {
		expect(isPdfAnchor(anchorWith(null))).toBe(false);
		expect(isPdfAnchor(anchorWith('pdf'))).toBe(false);
		expect(isPdfAnchor({ format: 'epub', payload: VALID })).toBe(false);
	});
});

describe('isPdfResolvedDisplay', () => {
	const RECT: PdfRect = { x: 1, y: 2, width: 3, height: 4 };

	it('accepts what a recovery produces', () => {
		expect(isPdfResolvedDisplay([RECT])).toBe(true);
		expect(isPdfResolvedDisplay([RECT, { ...RECT, x: 9 }])).toBe(true);
	});

	it('rejects an empty list, which recovery never produces', () => {
		// Recovery reports `null` rather than an empty measurement, so an
		// empty list here is as likely to be a shape from another version
		// as it is to be an empty highlight — and a painter that drew
		// nothing for it would look like a highlight that lost its
		// colour.
		expect(isPdfResolvedDisplay([])).toBe(false);
	});

	it('rejects a shape from a version this one has not heard of', () => {
		// `display` came out of storage. A row written by a future version
		// has to paint as nothing rather than take the reader down, and it
		// cannot throw from a guard on a data value.
		expect(isPdfResolvedDisplay('rects')).toBe(false);
		expect(isPdfResolvedDisplay({ rects: [RECT] })).toBe(false);
		expect(isPdfResolvedDisplay(null)).toBe(false);
		expect(isPdfResolvedDisplay(undefined)).toBe(false);
		expect(isPdfResolvedDisplay([null])).toBe(false);
		expect(isPdfResolvedDisplay([{ ...RECT, width: '3' }])).toBe(false);
	});

	it('rejects a fragment with no area, which is a foreign shape', () => {
		// A highlight with no height is a hairline nobody asked for, and
		// the measurement never produces one. It rejects the whole list
		// rather than one fragment of it, because a list with a degenerate
		// entry in it is not the display we recognise — and a painter that
		// drew the rest of it would look like a highlight that lost a
		// line.
		expect(isPdfResolvedDisplay([{ ...RECT, width: 0 }])).toBe(false);
		expect(isPdfResolvedDisplay([{ ...RECT, height: 0 }])).toBe(false);
		expect(isPdfResolvedDisplay([{ ...RECT, width: -4 }])).toBe(false);
		expect(isPdfResolvedDisplay([{ ...RECT, height: -4 }])).toBe(false);
		expect(isPdfResolvedDisplay([RECT, { ...RECT, width: 0 }])).toBe(false);
	});

	it('rejects numbers that cannot be a position', () => {
		// `NaN` passes `typeof === 'number'` and would put a fragment at
		// a coordinate no box can be drawn at.
		expect(isPdfResolvedDisplay([{ ...RECT, x: Number.NaN }])).toBe(false);
		expect(isPdfResolvedDisplay([{ ...RECT, y: Number.POSITIVE_INFINITY }])).toBe(false);
	});
});
