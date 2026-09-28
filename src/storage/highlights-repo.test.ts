/**
 * Unit tests for the highlights repository.
 *
 * What is under test is the same as for bookmarks, plus the one rule
 * this table has that bookmarks does not: the anchor write-back.
 *
 *   - A list scoped to the wrong source shows a reader another file's
 *     highlights, which is the failure that is invisible until someone
 *     re-imports a book.
 *   - Ordering is by page, because that is the order a painter needs.
 *   - `replaceHighlightAnchor` stores the payload it is given without
 *     reading it, and reports honestly when the row is not there. A
 *     resolver that has just decided an anchor is still valid must not
 *     be able to report success for a highlight that no longer exists.
 *
 * `getDb` is faked with a table that behaves like Dexie's for the
 * operations used here. The end-to-end claims — a highlight made by
 * dragging, painted, recovered, and persisted after a reload — belong
 * to `scripts/smoke-reader.mjs`, once the reader calls any of this.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint, type DocumentId } from '../domain/document.ts';
import { asPageIndex } from '../domain/reading-state.ts';

const rows = new Map<string, Record<string, unknown>>();
let sequence = 0;

function useDeterministicIds(): void {
	vi.stubGlobal('crypto', {
		...globalThis.crypto,
		randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
	});
}

vi.mock('./db.ts', () => ({
	getDb: () => ({
		highlights: {
			where: (index: string) => ({
				equals: (value: unknown) => ({
					filter: (predicate: (row: Record<string, unknown>) => boolean) => ({
						async toArray() {
							return Array.from(rows.values())
								.filter((row) => row[index] === value)
								.filter(predicate);
						},
					}),
				}),
			}),
			get: async (id: string) => rows.get(id),
			put: async (row: Record<string, unknown>) => {
				rows.set(String(row.id), row);
				return row.id;
			},
			update: async (id: string, changes: Record<string, unknown>) => {
				const row = rows.get(id);
				if (row === undefined) return 0;
				rows.set(id, { ...row, ...changes });
				return 1;
			},
			delete: async (id: string) => {
				rows.delete(id);
			},
		},
	}),
}));

const {
	DEFAULT_HIGHLIGHT_COLOR,
	addHighlight,
	deleteHighlight,
	listHighlights,
	listHighlightsOnPage,
	replaceHighlightAnchor,
} = await import('./highlights-repo.ts');

const DOC_A = asDocumentId('00000000-0000-4000-8000-00000000000a');
const DOC_B = asDocumentId('00000000-0000-4000-8000-00000000000b');
const FINGERPRINT_A = asSourceFingerprint('a'.repeat(64));
const FINGERPRINT_B = asSourceFingerprint('b'.repeat(64));

beforeEach(() => {
	rows.clear();
	sequence = 0;
	useDeterministicIds();
	vi.unstubAllGlobals();
	useDeterministicIds();
});

/** A PDF anchor, or as close as this layer can see one: the payload is
 *  opaque here, which is the point. */
function anchorFor(quote: string): Anchor {
	return { format: 'pdf', payload: { page: 1, quote: { exact: quote }, rects: [] } };
}

async function add(params: {
	documentId?: DocumentId;
	sourceFingerprint?: string;
	pageIndex: number;
	quote?: string;
	createdAt?: number;
}) {
	const highlight = await addHighlight({
		documentId: params.documentId ?? DOC_A,
		sourceFingerprint: (params.sourceFingerprint ?? FINGERPRINT_A) as never,
		pageIndex: asPageIndex(params.pageIndex),
		anchor: anchorFor(params.quote ?? 'a quote'),
		selectedText: params.quote ?? 'a quote',
	});
	if (params.createdAt !== undefined) {
		const row = rows.get(highlight.id);
		if (row !== undefined) row.createdAt = params.createdAt;
	}
	return highlight;
}

describe('addHighlight', () => {
	it('stores the anchor and the words that were selected', async () => {
		const highlight = await add({ pageIndex: 4, quote: 'the cat' });

		expect(highlight).toMatchObject({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			pageIndex: 4,
			selectedText: 'the cat',
			color: DEFAULT_HIGHLIGHT_COLOR,
		});
		expect(highlight.anchor.format).toBe('pdf');
		// Generated here, not supplied: the caller describes a text
		// region and does not get to name the row.
		expect(typeof highlight.id).toBe('string');
		expect(typeof highlight.createdAt).toBe('number');
	});

	it('stores a colour by name and leaves the default alone', async () => {
		// A stored hex is a stored theme decision: change the palette and
		// every existing highlight is pinned to a colour the app no longer
		// uses, with no way to tell which ones.
		expect((await add({ pageIndex: 1 })).color).toBe('yellow');
		const green = await addHighlight({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
			pageIndex: asPageIndex(1),
			anchor: anchorFor('q'),
			selectedText: 'q',
			color: 'green',
		});
		expect(green.color).toBe('green');
	});
});

describe('listHighlights', () => {
	it('is scoped to the pair, not the document alone', async () => {
		await add({ pageIndex: 1 });
		await add({ pageIndex: 2, sourceFingerprint: FINGERPRINT_B });
		await add({ pageIndex: 3, documentId: DOC_B });

		const scoped = await listHighlights({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
		});

		expect(scoped.map((row) => row.pageIndex)).toEqual([1]);
	});

	it('orders by page, because that is the order a painter walks', async () => {
		await add({ pageIndex: 9, createdAt: 1 });
		await add({ pageIndex: 2, createdAt: 4 });
		await add({ pageIndex: 2, createdAt: 2 });
		await add({ pageIndex: 5, createdAt: 3 });

		const listed = await listHighlights({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
		});

		// Page first, then creation within the page. A list ordered by
		// time would make a reader's later mark on an earlier page arrive
		// after the pages that follow it.
		expect(listed.map((row) => [row.pageIndex, row.createdAt])).toEqual([
			[2, 2],
			[2, 4],
			[5, 3],
			[9, 1],
		]);
	});

	it('keeps the order stable when two highlights share a timestamp', async () => {
		await add({ pageIndex: 7, createdAt: 1000 });
		await add({ pageIndex: 7, createdAt: 1000 });
		await add({ pageIndex: 7, createdAt: 1000 });

		const scope = { documentId: DOC_A, sourceFingerprint: FINGERPRINT_A };
		const listed = await listHighlights(scope);
		const again = await listHighlights(scope);

		// A painter reads this list in order, so an order that changes
		// between two reads is a list that flickers. The tiebreak cannot
		// recover creation order — a random id carries none — but it can
		// make the order the same twice.
		expect(listed.map((row) => row.id)).toEqual(again.map((row) => row.id));
	});

	it('lists one page on its own', async () => {
		await add({ pageIndex: 2 });
		await add({ pageIndex: 7, createdAt: 2 });
		await add({ pageIndex: 7, createdAt: 1 });

		const onPage = await listHighlightsOnPage(
			{ documentId: DOC_A, sourceFingerprint: FINGERPRINT_A },
			asPageIndex(7),
		);

		expect(onPage.map((row) => row.createdAt)).toEqual([1, 2]);
	});
});

describe('replaceHighlightAnchor', () => {
	it('stores the refreshed anchor without reading its payload', async () => {
		const highlight = await add({ pageIndex: 3, quote: 'the cat' });
		const refreshed = anchorFor('the cat sat down');

		expect(await replaceHighlightAnchor(highlight.id, refreshed)).toBe(true);

		const listed = await listHighlights({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
		});
		// Stored exactly as given. A repository that inspected the payload
		// to "check" it would be doing format-specific reading outside
		// `reader/<format>/`, and it would break the first time a second
		// format stored something PDF-shaped was not.
		expect(listed[0]?.anchor).toBe(refreshed);
		// The quote is left alone, so its mirror is left alone too.
		// Rewriting one without the other would be a disagreement this
		// repository refuses to invent.
		expect(listed[0]?.selectedText).toBe('the cat');
	});

	it('reports that a highlight that is gone was not written', async () => {
		await add({ pageIndex: 1 });

		expect(await replaceHighlightAnchor('no-such-highlight', anchorFor('q'))).toBe(false);
	});
});

describe('deleteHighlight', () => {
	it('removes the row and says whether it was there', async () => {
		const highlight = await add({ pageIndex: 1 });
		await add({ pageIndex: 2 });

		expect(await deleteHighlight(highlight.id)).toBe(true);
		// A second delete reports "already gone" rather than pretending:
		// the difference is a second tab, or a re-render race.
		expect(await deleteHighlight(highlight.id)).toBe(false);

		const listed = await listHighlights({
			documentId: DOC_A,
			sourceFingerprint: FINGERPRINT_A,
		});
		expect(listed.map((row) => row.pageIndex)).toEqual([2]);
	});
});
