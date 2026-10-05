/**
 * Component tests for the three side panels wired into the reader.
 *
 * The panel files are presentational and are tested on their own; the
 * shell is tested in `reader-side-panel.test.tsx`. What is only visible
 * here is the wiring, and the wiring is where Issue #9's acceptance
 * criteria actually live:
 *
 *   - The three tabs switch, and each one shows the list the header
 *     toggle named. A panel that renders while another is also
 *     rendered is a panel showing the reader the wrong list.
 *   - The count on the tab equals the number of rows on screen, taken
 *     from the reader's own loaded state rather than from a second
 *     query. This is the 「count が Library と一致する」 criterion, and
 *     the failure it guards is a number and a list that were read at
 *     different moments.
 *   - Orphans are visible. A highlight the reader cannot place, and a
 *     free note whose highlight has been deleted, both stay on screen
 *     and stay in the count — a bookmark or a mark that silently
 *     vanished is the empty-success case.
 *   - A jump that cannot land exactly says so on its own row. A jump
 *     to a stored page with an unresolvable anchor still moves the
 *     reader; the panel must not let that look identical to a jump
 *     that found the exact spot.
 *   - A note with nowhere left to go records an outcome too, rather
 *     than falling off the end of the handler.
 *
 * The geometry of a jump — whether a page really comes into view — is
 * `scripts/smoke-panels.mjs`'s job, in a browser with layout. Here the
 * fake handle makes the outcome observable and the assertion is about
 * the outcome the panel reports and the list it keeps.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex, type Bookmark, type Highlight, type Note } from '../domain/reading-state.ts';
import type { NewAnchor, PageHandle, ReaderHandle, ResolvedAnchor } from '../reader/types.ts';
import { useUiStore } from '../stores/ui-store.ts';
import { ReaderView } from './reader-view.tsx';

const DOC_ID = asDocumentId('00000000-0000-4000-8000-0000000000a9');
const FINGERPRINT = asSourceFingerprint('9'.repeat(64));
const PAGE_COUNT = 3;
const PAGE_HEIGHT = 600;

/** A stored anchor on a given page. A real highlight always carries
 *  one — it was made from a selection — so the fake resolver has a page
 *  to answer about, which is what makes per-row behaviour testable. */
function anchorOn(page: number): Anchor {
	return { format: 'pdf', payload: { page, rects: [{ x: 1, y: 1, width: 2, height: 2 }] } };
}

const ANCHOR = anchorOn(1);
const ANCHOR_2 = anchorOn(2);
const ANCHOR_3 = anchorOn(3);

let bookmarks: Bookmark[] = [];
let highlights: Highlight[] = [];
let notes: Note[] = [];
/**
 * Pages whose words this copy of the file cannot place.
 *
 * Keyed by the page in the anchor payload rather than by one global
 * answer, because the interesting cases are all *per row*: one mark
 * that still lands and one that does not, in the same list, at the same
 * moment. A single global `null` would resolve every row the same way
 * and could not express the mixed list a reader actually has.
 */
let unresolvablePages = new Set<number>();
/** When the resolver hands back a refreshed anchor. A write-back is
 *  what gives the repository the chance to report the row as gone. */
let updateOnResolve = false;
/** Anchors `resolveAnchor` was asked about, so a jump can be shown to
 *  have used the row's own anchor rather than a page number. */
let resolvedAnchors: Anchor[] = [];
/** Whether the repository still holds a row when the view writes an
 *  anchor back. `false` is how a row becomes `vanished`. */
let highlightWriteBackSucceeds = true;

/** The page an anchor payload points at. Test-side narrowing only: the
 *  panel layer never inspects a payload, but the fake resolver has to
 *  to decide what to answer. */
function anchorPage(anchor: Anchor): number {
	const payload = anchor.payload as { readonly page: number };
	return payload.page;
}

vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: vi.fn(async () => bookmarks),
	addBookmark: vi.fn(),
	deleteBookmark: vi.fn(async () => true),
}));

vi.mock('../storage/highlights-repo.ts', () => ({
	listHighlights: vi.fn(async () => highlights),
	replaceHighlightAnchor: vi.fn(async () => highlightWriteBackSucceeds),
	listHighlightsOnPage: vi.fn(async () => []),
	addHighlight: vi.fn(),
	deleteHighlight: vi.fn(async () => true),
}));

vi.mock('../storage/notes-repo.ts', async () => {
	// The real `compareNotes` and `isHighlightLinked`: the ordering and
	// the "is this note about a mark" rule are production code, and a
	// fake agreeing with whatever the view did would test nothing.
	const actual = await vi.importActual<typeof import('../storage/notes-repo.ts')>(
		'../storage/notes-repo.ts',
	);
	return {
		...actual,
		listNotes: vi.fn(async () => notes),
		listNotesForHighlight: vi.fn(async (id: string) =>
			notes.filter((note) => note.highlightId === id),
		),
		addNote: vi.fn(async () => null),
		updateNote: vi.fn(async () => null),
		deleteNote: vi.fn(async () => true),
		replaceNoteAnchor: vi.fn(async () => true),
	};
});

vi.mock('../storage/reading-state-repo.ts', () => ({
	saveReadingPosition: vi.fn(async () => {}),
	getReadingProgress: vi.fn(async () => null),
	deleteReadingProgress: vi.fn(async () => false),
}));

const fakePage = {
	format: 'pdf',
	render: vi.fn(async (target: HTMLElement) => {
		target.replaceChildren();
		const page = document.createElement('div');
		page.className = 'rm-page';
		page.style.width = '420px';
		page.style.height = `${PAGE_HEIGHT}px`;
		const layer = document.createElement('div');
		layer.className = 'rm-text-layer';
		const span = document.createElement('span');
		span.textContent = 'a line the marks can be about';
		layer.appendChild(span);
		page.appendChild(layer);
		target.appendChild(page);
	}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async (): Promise<NewAnchor | null> => null),
	paintResolvedAnchor: vi.fn(async () => null),
} as unknown as PageHandle<'pdf'>;

const fakeHandle = {
	format: 'pdf',
	pageCount: vi.fn(async () => PAGE_COUNT),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn(async (anchor: Anchor): Promise<ResolvedAnchor | null> => {
		resolvedAnchors.push(anchor);
		const page = anchorPage(anchor);
		if (unresolvablePages.has(page)) return null;
		return {
			format: 'pdf',
			page: asPageIndex(page),
			freshness: 'fresh',
			selectedText: 'a line the marks can be about',
			display: [],
			updatedAnchor: updateOnResolve ? anchor : null,
		};
	}),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

/** Give the page hosts a geometry, so a jump is observable at all. */
beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

	Element.prototype.getBoundingClientRect = function bounding(this: Element) {
		const index = (this as HTMLElement).dataset?.pageIndex;
		const top = index === undefined ? 0 : (Number(index) - 1) * PAGE_HEIGHT;
		return {
			x: 0,
			y: top,
			top,
			bottom: top + PAGE_HEIGHT,
			left: 0,
			right: 420,
			width: 420,
			height: PAGE_HEIGHT,
			toJSON: () => ({}),
		} as DOMRect;
	};
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
	Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

let sequence = 0;

function makeBookmark(pageIndex: number, title = '', anchor: Anchor | null = null): Bookmark {
	return {
		id: `bm-${++sequence}`,
		documentId: DOC_ID,
		sourceFingerprint: FINGERPRINT,
		pageIndex: asPageIndex(pageIndex),
		title,
		anchor,
		position: null,
		createdAt: sequence,
	};
}

function makeHighlight(pageIndex: number, selectedText: string, anchor: Anchor): Highlight {
	return {
		id: `hl-${++sequence}`,
		documentId: DOC_ID,
		sourceFingerprint: FINGERPRINT,
		pageIndex: asPageIndex(pageIndex),
		anchor,
		selectedText,
		color: 'yellow',
		createdAt: sequence,
	};
}

function makeFreeNote(body: string, highlightId: string | null): Note {
	return {
		id: `note-${++sequence}`,
		kind: 'free',
		documentId: DOC_ID,
		body,
		highlightId,
		createdAt: sequence,
		updatedAt: sequence,
	};
}

function makePositionedNote(body: string, pageIndex: number, anchor: Anchor): Note {
	return {
		id: `note-${++sequence}`,
		kind: 'positioned',
		documentId: DOC_ID,
		sourceFingerprint: FINGERPRINT,
		pageIndex: asPageIndex(pageIndex),
		anchor,
		body,
		highlightId: null,
		createdAt: sequence,
		updatedAt: sequence,
	};
}

beforeEach(() => {
	sequence = 0;
	bookmarks = [];
	highlights = [];
	notes = [];
	unresolvablePages = new Set();
	updateOnResolve = false;
	resolvedAnchors = [];
	highlightWriteBackSucceeds = true;
	useUiStore.setState({ sidePanel: 'none' });
	vi.mocked(fakeHandle.resolveAnchor).mockClear();
	vi.mocked(fakePage.render).mockClear();
});

function renderReader() {
	return render(
		<MemoryRouter>
			<ReaderView
				handle={fakeHandle}
				pageCount={PAGE_COUNT}
				title="吾輩は猫である"
				documentId={DOC_ID}
				sourceFingerprint={FINGERPRINT}
				initialPosition={null}
			/>
		</MemoryRouter>,
	);
}

/** Open a panel through the header toggle, the way a reader does. */
async function openPanel(panel: 'bookmarks' | 'highlights' | 'notes') {
	const toggle = screen.getByTestId(`rm-toggle-${panel}`);
	await act(async () => {
		fireEvent.click(toggle);
	});
}

/** Wait for the reader's async list loads to land. */
async function listsLoaded() {
	await waitFor(() => {
		const tab = screen.queryByTestId('rm-side-tab-bookmarks');
		expect(tab).not.toBeNull();
	});
}

/**
 * Forget the resolutions the open-time pass made.
 *
 * Every mark is resolved once when the reader opens, before a single
 * row is on screen. Clearing the log is what lets a later assertion be
 * about the jump's *own* resolve — the one the press caused — rather
 * than about the pass that happened before the test touched anything.
 */
function forgetResolutions(): void {
	resolvedAnchors = [];
}

function scroller(): HTMLElement {
	return screen.getByTestId('rm-reader-scroll');
}

describe('the three panels switch', () => {
	it('opens no panel until one is asked for', () => {
		renderReader();

		expect(screen.queryByTestId('rm-side-panel')).toBeNull();
		expect(screen.queryByRole('dialog', { name: 'サイドパネル' })).toBeNull();
	});

	it('shows the bookmarks list when 栞 is pressed', async () => {
		bookmarks = [makeBookmark(1)];
		renderReader();
		await openPanel('bookmarks');
		await listsLoaded();

		expect(screen.getByTestId('rm-bookmarks-panel')).toBeTruthy();
		expect(screen.queryByTestId('rm-highlights-panel')).toBeNull();
		expect(screen.queryByTestId('rm-notes-panel')).toBeNull();
	});

	it('shows the highlights list when ハイライト is pressed', async () => {
		highlights = [makeHighlight(1, '文', ANCHOR)];
		renderReader();
		await openPanel('highlights');
		await listsLoaded();

		expect(screen.getByTestId('rm-highlights-panel')).toBeTruthy();
		expect(screen.queryByTestId('rm-bookmarks-panel')).toBeNull();
		expect(screen.queryByTestId('rm-notes-panel')).toBeNull();
	});

	it('shows the notes list when メモ is pressed', async () => {
		notes = [makeFreeNote('メモ', null)];
		renderReader();
		await openPanel('notes');
		await listsLoaded();

		expect(screen.getByTestId('rm-notes-panel')).toBeTruthy();
		expect(screen.queryByTestId('rm-bookmarks-panel')).toBeNull();
		expect(screen.queryByTestId('rm-highlights-panel')).toBeNull();
	});

	it('moves between all three by tab, keeping one list on screen at a time', async () => {
		bookmarks = [makeBookmark(1)];
		highlights = [makeHighlight(1, '文', ANCHOR)];
		notes = [makeFreeNote('メモ', null)];
		renderReader();
		await openPanel('bookmarks');
		await listsLoaded();

		for (const [tab, panel] of [
			['highlights', 'rm-highlights-panel'],
			['notes', 'rm-notes-panel'],
			['bookmarks', 'rm-bookmarks-panel'],
		] as const) {
			await act(async () => {
				fireEvent.click(screen.getByTestId(`rm-side-tab-${tab}`));
			});
			expect(screen.getByTestId(panel)).toBeTruthy();
			expect(screen.getByTestId(`rm-side-tab-${tab}`).getAttribute('aria-selected')).toBe('true');
		}
	});

	it('closes the panel when the toggle for the showing one is pressed again', async () => {
		bookmarks = [makeBookmark(1)];
		renderReader();
		await openPanel('bookmarks');
		await listsLoaded();
		expect(screen.getByTestId('rm-bookmarks-panel')).toBeTruthy();

		await openPanel('bookmarks');
		expect(screen.queryByTestId('rm-bookmarks-panel')).toBeNull();
		expect(screen.queryByTestId('rm-side-panel')).toBeNull();
	});
});

/**
 * The count invariant, against the reader's own loaded state.
 *
 * The count and the list are read from the same state here, so this
 * cannot fail by drifting — which is the point. The orphan case is the
 * one worth naming: rows the reader cannot act on are still rows, and a
 * count that excluded them would be describing a shorter list than the
 * one on screen.
 */
describe('the count matches the list', () => {
	it('labels each tab with the number of rows that list shows', async () => {
		bookmarks = [makeBookmark(1), makeBookmark(2), makeBookmark(2, '二')];
		highlights = [makeHighlight(1, '一つ', ANCHOR), makeHighlight(2, '二つ', ANCHOR_2)];
		notes = [makeFreeNote('ひとつ', null), makePositionedNote('ふたつ', 2, ANCHOR_2)];
		renderReader();
		await openPanel('bookmarks');
		await listsLoaded();

		const bookmarkRows = within(screen.getByTestId('rm-bookmarks-list')).getAllByTestId(
			'rm-bookmark-jump',
		);
		expect(screen.getByTestId('rm-side-tab-count-bookmarks').textContent).toBe(
			String(bookmarkRows.length),
		);
		expect(screen.getByTestId('rm-side-tab-count-highlights').textContent).toBe('2');
		expect(screen.getByTestId('rm-side-tab-count-notes').textContent).toBe('2');
		expect(screen.getByTestId('rm-bookmarks-count').textContent).toBe('3 件');
	});

	it('keeps an unplaceable highlight on screen and in the total', async () => {
		// Page 2's words are not in this copy of the file. The highlight
		// is not deleted — it is simply unreachable here, and the other
		// row in the same list is fine.
		unresolvablePages = new Set([2]);
		highlights = [makeHighlight(1, '置ける', ANCHOR), makeHighlight(2, '置けない', ANCHOR_2)];
		renderReader();
		await openPanel('highlights');
		await listsLoaded();

		// Two rows, and the anchor-carrying one is among them.
		await waitFor(() => {
			expect(screen.getAllByTestId('rm-highlight-row').length).toBe(2);
		});
		expect(screen.getByTestId('rm-highlights-count').textContent).toBe('2 件');
		expect(screen.getByTestId('rm-side-tab-count-highlights').textContent).toBe('2');
		// And it says so, rather than vanishing.
		expect(screen.getAllByTestId('rm-highlight-notice').length).toBe(1);
	});

	it('keeps a row the repository has deleted on screen, counted, and named', async () => {
		// The resolver finds the words and offers a refreshed anchor, but
		// the write-back reports the row is gone — another tab, or the
		// reader themselves.
		updateOnResolve = true;
		highlightWriteBackSucceeds = false;
		highlights = [makeHighlight(1, '消えた', ANCHOR)];
		renderReader();
		await openPanel('highlights');
		await listsLoaded();

		await waitFor(() => {
			expect(screen.getAllByTestId('rm-highlight-row').length).toBe(1);
		});
		expect(screen.getByTestId('rm-highlights-count').textContent).toBe('1 件');
		expect(screen.getByTestId('rm-highlight-notice').textContent).toBe('対象なし');
		expect(screen.queryByTestId('rm-highlight-jump')).toBeNull();
	});
});

describe('every entry jumps', () => {
	it('jumps a bookmark to its page, using its own anchor when it has one', async () => {
		const mark = makeBookmark(3, '第三章', ANCHOR_3);
		bookmarks = [mark];
		// A page-pin jump is the exact case: the page *is* the mark, so
		// the resolver finding its anchor makes the landing exact.
		renderReader();
		await openPanel('bookmarks');
		await listsLoaded();
		forgetResolutions();

		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-bookmark-jump'));
		});

		// The mark's own anchor, not just its page number.
		expect(resolvedAnchors).toContain(ANCHOR_3);
		expect(scroller().scrollTop).toBeGreaterThan(0);
		expect(screen.queryByTestId('rm-bookmark-jump-error')).toBeNull();
	});

	it('jumps a highlight through the reader’s own resolution', async () => {
		highlights = [makeHighlight(2, '移動する', ANCHOR_2)];
		renderReader();
		await openPanel('highlights');
		await listsLoaded();

		forgetResolutions();
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-highlight-jump'));
		});

		// The mark's own anchor is the one the jump resolves — a jump
		// that used only the page number could not be exact.
		expect(resolvedAnchors).toContain(ANCHOR_2);
		expect(scroller().scrollTop).toBeGreaterThan(0);
		expect(screen.queryByTestId('rm-highlight-jump-error')).toBeNull();
	});

	it('jumps a note through the highlight it hangs off', async () => {
		const mark = makeHighlight(2, 'メモの対象', ANCHOR_2);
		highlights = [mark];
		notes = [makeFreeNote('この行について', mark.id)];
		renderReader();
		await openPanel('notes');
		await listsLoaded();

		forgetResolutions();
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-note-jump'));
		});

		// The *highlight's* anchor is the one resolved, because that is
		// the row re-anchored on every open.
		expect(resolvedAnchors).toContain(ANCHOR_2);
		expect(scroller().scrollTop).toBeGreaterThan(0);
	});

	it('jumps a positioned note on its own page', async () => {
		notes = [makePositionedNote('位置つき', 3, ANCHOR_3)];
		renderReader();
		await openPanel('notes');
		await listsLoaded();

		forgetResolutions();
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-note-jump'));
		});

		expect(resolvedAnchors).toContain(ANCHOR_3);
		expect(scroller().scrollTop).toBeGreaterThan(0);
	});
});

/**
 * Jump honesty.
 *
 * The failure a reader can actually detect is a jump that looks
 * successful and was not, so the failure path is asserted directly
 * rather than inferred from the absence of an error.
 */
describe('a jump reports what it actually did', () => {
	it('says it fell back to the page when the anchor will not resolve', async () => {
		bookmarks = [makeBookmark(3, '消えた章', ANCHOR_3)];
		// The resolver cannot find the words in this copy of the file.
		unresolvablePages = new Set([3]);
		renderReader();
		await openPanel('bookmarks');
		await listsLoaded();

		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-bookmark-jump'));
		});

		const message = screen.getByTestId('rm-bookmark-jump-error');
		expect(message.textContent).toContain('正確な位置は見つかりませんでした');
		expect(message.textContent).toContain('3 ページに移動しました');
		// It still moved — a page pin whose anchor is stale lands on the
		// stored page rather than nowhere.
		expect(scroller().scrollTop).toBeGreaterThan(0);
	});

	/**
	 * The two failures are different events, and the panel keeps them
	 * apart.
	 *
	 * A row that was already unplaceable *when the book opened* has no
	 * button at all — there is nothing to press. A row that was
	 * placeable on open and is not on the press keeps its button and
	 * says what happened. Collapsing the two would either hide a
	 * failure behind a missing button, or offer a button that
	 * routinely does nothing.
	 */
	it('keeps the two failure moments apart on a highlight row', async () => {
		highlights = [makeHighlight(1, '一つ', ANCHOR), makeHighlight(2, '二つ', ANCHOR_2)];
		renderReader();
		await openPanel('highlights');
		await listsLoaded();

		// Both placed on open, so both rows are pressable.
		const jumpable = screen.getAllByTestId('rm-highlight-jump');
		expect(jumpable.length).toBe(2);
		expect(screen.queryByTestId('rm-highlight-jump-error')).toBeNull();

		// The second row's words go missing between opening the book and
		// pressing the row.
		unresolvablePages = new Set([2]);
		await act(async () => {
			fireEvent.click(jumpable[1] as HTMLElement);
		});

		const errors = screen.getAllByTestId('rm-highlight-jump-error');
		expect(errors.length).toBe(1);
		const error = errors[0] as HTMLElement;
		expect(error.textContent).toContain('2 ページに移動しました');
		// And it is on the row that asked, not the one that did not.
		const [firstRow, secondRow] = screen.getAllByTestId('rm-highlight-row');
		expect(firstRow?.contains(error)).toBe(false);
		expect(secondRow?.contains(error)).toBe(true);
	});

	it('clears the message once a jump lands exactly', async () => {
		const mark = makeBookmark(2, '第二章', ANCHOR_2);
		bookmarks = [mark];
		renderReader();
		await openPanel('bookmarks');
		await listsLoaded();

		// First press: the words are not where the mark says.
		unresolvablePages = new Set([2]);
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-bookmark-jump'));
		});
		expect(screen.getByTestId('rm-bookmark-jump-error')).toBeTruthy();

		// Second press, after the file has been re-scanned.
		unresolvablePages = new Set();
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-bookmark-jump'));
		});

		// A row that recovered has nothing left to explain.
		expect(screen.queryByTestId('rm-bookmark-jump-error')).toBeNull();
	});
});

describe('a note with nowhere to go', () => {
	it('offers no jump button, and says why', async () => {
		// A free note whose highlight is not in the open list: no page
		// of its own, and nothing to hang off.
		notes = [makeFreeNote('消えたハイライトへのメモ', 'hl-does-not-exist')];
		renderReader();
		await openPanel('notes');
		await listsLoaded();

		expect(screen.queryByTestId('rm-note-jump')).toBeNull();
		expect(screen.getByTestId('rm-note-notice').textContent).toBe('対象なし');
	});

	it('keeps the note readable, editable and deletable', async () => {
		notes = [makeFreeNote('消えたハイライトへのメモ', 'hl-does-not-exist')];
		renderReader();
		await openPanel('notes');
		await listsLoaded();

		// The missing thing is a reference, not the reader's own words.
		expect(screen.getByTestId('rm-note-body').textContent).toBe('消えたハイライトへのメモ');
		expect(screen.getByTestId('rm-note-delete')).toBeTruthy();
		expect(screen.getByTestId('rm-notes-count').textContent).toBe('1 件');
		expect(screen.getByTestId('rm-side-tab-count-notes').textContent).toBe('1');
	});

	it('offers the jump back once the highlight it names is in the list again', async () => {
		const mark = makeHighlight(2, '戻ってきた', ANCHOR_2);
		highlights = [mark];
		notes = [makeFreeNote('対象', mark.id)];
		renderReader();
		await openPanel('notes');
		await listsLoaded();

		// Reachable: the note is free, but the mark it names is here.
		expect(screen.getByTestId('rm-note-jump')).toBeTruthy();
		expect(screen.queryByTestId('rm-note-notice')).toBeNull();
	});
});
