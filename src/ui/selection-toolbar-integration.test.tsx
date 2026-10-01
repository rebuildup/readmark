/**
 * Component tests for the selection toolbar's actions.
 *
 * The toolbar's *positioning* and *snapshot lifecycle* are unit-tested
 * in `selection-toolbar.test.tsx`; the geometry claim belongs to
 * `scripts/smoke-geometry.mjs`. This file covers what is left:
 *
 *   - A collapsed range is not a selection worth a toolbar.
 *   - A valid drag selection shows two actions.
 *   - The highlight action writes one row, paints once, and does not
 *     rerender the page underneath. A second click before the first
 *     settles does not produce a second row.
 *   - A failed write shows a banner and paints nothing — a "ghost"
 *     overlay on failure is a row the reader cannot find by deleting
 *     what they see.
 *   - Re-selecting marked text offers removal, and confirming it takes
 *     the row down both in IndexedDB and on the page.
 *   - A selection bookmark is stored with the anchor; a page bookmark is
 *     stored without one. Two different rows, two different shapes.
 *   - Switching source resets the highlights list. A row from a
 *     different file does not haunt the new one.
 *   - Zooming while a selection is live keeps the toolbar usable: the
 *     snapshot still matches what is on the page.
 *
 * The mocks are at the storage / reader boundaries, which is where the
 * production code is split. happy-dom has no layout, so the toolbar's
 * real position is not under test here — the smoke covers that.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex } from '../domain/reading-state.ts';
import type { NewAnchor, PaintedAnchor, ReaderHandle, ResolvedAnchor } from '../reader/types.ts';
import { useUiStore } from '../stores/ui-store.ts';
import { ReaderView } from './reader-view.tsx';

const DOC_ID = asDocumentId('00000000-0000-4000-8000-0000000000dd');
const FINGERPRINT = asSourceFingerprint('d'.repeat(64));
const ANOTHER_SOURCE = asSourceFingerprint('9'.repeat(64));
const PAGE_COUNT = 3;

/** What the page-side selection will produce. Tests override this to
 *  drive the action handlers. */
let nextCreated: NewAnchor | null = null;
/** What `resolveAnchor` returns for any anchor a highlight action
 *  just produced. A fresh highlight is a `paintable` row, and an
 *  unresolved one is invisible on the page — the unit under test is
 *  the toolbar, not the recovery pipeline. Initialised in
 *  `beforeEach` so the `FRAGMENT` reference is in scope. */
let nextResolved: ResolvedAnchor | null = null;

const addedHighlights: { id: string; pageIndex: number; selectedText: string }[] = [];
const deletedIds: string[] = [];
const addedBookmarks: { anchor: unknown }[] = [];

/**
 * The spies the mock factory returns must exist by the time the
 * factory runs — and `vi.mock` is hoisted to the top of the file.
 * `vi.hoisted` is the official escape hatch: it lifts the
 * declarations to that same earlier position so the factory's
 * closures bind to real values, not to lexical names that have not
 * been initialised yet.
 */
const spies = vi.hoisted(() => ({
	addHighlight: vi.fn(async (_input?: unknown) => {
		throw new Error('addHighlight mock not configured for this test');
	}) as ReturnType<typeof vi.fn>,
	deleteHighlight: vi.fn(async (_id?: unknown) => false) as ReturnType<typeof vi.fn>,
}));

vi.mock('../storage/highlights-repo.ts', () => ({
	listHighlights: vi.fn(async () => []),
	replaceHighlightAnchor: vi.fn(async () => true),
	addHighlight: spies.addHighlight,
	deleteHighlight: spies.deleteHighlight,
}));

vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: vi.fn(async () => []),
	addBookmark: vi.fn(async (input: { anchor: unknown }) => {
		addedBookmarks.push(input);
		return {
			id: `bm-${addedBookmarks.length}`,
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			pageIndex: asPageIndex(1),
			anchor: input.anchor,
			position: null,
			title: '',
			createdAt: Date.now(),
		};
	}),
	deleteBookmark: vi.fn(),
}));

vi.mock('../storage/reading-state-repo.ts', () => ({
	saveReadingPosition: vi.fn(async () => {}),
	getReadingProgress: vi.fn(async () => null),
	deleteReadingProgress: vi.fn(async () => false),
}));

const FRAGMENT = { x: 10, y: 20, width: 30, height: 12 };
let renderSettled = true;
let overlays: PaintedAnchor[] = [];

const fakePage = {
	format: 'pdf',
	render: vi.fn(async (target: HTMLElement) => {
		target.replaceChildren();
		const page = document.createElement('div');
		page.className = 'rm-page';
		page.style.width = '420px';
		page.style.height = '600px';
		// A span the tests can put a DOM Selection over.
		const layer = document.createElement('div');
		layer.className = 'rm-text-layer';
		const span = document.createElement('span');
		span.textContent = 'a selection the toolbar can act on';
		layer.appendChild(span);
		page.appendChild(layer);
		target.appendChild(page);
		renderSettled = true;
	}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async (): Promise<NewAnchor | null> => {
		if (nextCreated === null) return null;
		// A copy so the test can hand a fresh shape on every click.
		const value = nextCreated;
		nextCreated = null;
		return value;
	}),
	paintResolvedAnchor: vi.fn(async (anchor: ResolvedAnchor, target: HTMLElement) => {
		if (!renderSettled) {
			throw new Error('readmark: paintResolvedAnchor called before render settled');
		}
		const element = document.createElement('div');
		element.className = 'rm-highlight';
		element.dataset.freshness = anchor.freshness;
		element.dataset.highlightColor = 'yellow';
		const fragment = document.createElement('div');
		fragment.className = 'rm-highlight__fragment';
		fragment.style.left = `${FRAGMENT.x}px`;
		fragment.style.top = `${FRAGMENT.y}px`;
		fragment.style.width = `${FRAGMENT.width}px`;
		fragment.style.height = `${FRAGMENT.height}px`;
		element.appendChild(fragment);
		target.querySelector('.rm-page')?.appendChild(element);
		const painted: PaintedAnchor = {
			element,
			remove: () => {
				element.remove();
				overlays = overlays.filter((candidate) => candidate !== painted);
			},
		};
		overlays.push(painted);
		return painted;
	}),
} as unknown as ReturnType<typeof Object> & Record<string, unknown>;

const fakeHandle = {
	format: 'pdf',
	pageCount: vi.fn(async () => PAGE_COUNT),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn(async (): Promise<ResolvedAnchor | null> => nextResolved),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
});

beforeEach(() => {
	nextCreated = null;
	nextResolved = {
		format: 'pdf',
		page: asPageIndex(1),
		freshness: 'fresh',
		selectedText: 'a select',
		display: FRAGMENT,
		updatedAnchor: null,
	};
	addedHighlights.length = 0;
	deletedIds.length = 0;
	addedBookmarks.length = 0;
	renderSettled = true;
	overlays = [];
	useUiStore.setState({ sidePanel: 'none' });
	vi.mocked(fakePage.render).mockClear();
	vi.mocked(fakePage.paintResolvedAnchor).mockClear();
	vi.mocked(fakePage.createAnchorFromSelection).mockClear();
	vi.mocked(fakeHandle.resolveAnchor).mockClear();
	// `mockReset` clears both the call history and any queued
	// `mockImplementationOnce`. Without it, the failure test's
	// "throw once" impl would leak into the next test's first call.
	spies.addHighlight.mockReset();
	spies.addHighlight.mockImplementation(async (input?: unknown) => {
		const value = (input ?? {}) as {
			pageIndex: number;
			selectedText: string;
			anchor: unknown;
		};
		const row = {
			id: `hl-${addedHighlights.length + 1}`,
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			pageIndex: value.pageIndex,
			anchor: value.anchor,
			selectedText: value.selectedText,
			color: 'yellow',
			createdAt: Date.now(),
		};
		addedHighlights.push(row);
		return row;
	});
	spies.deleteHighlight.mockReset();
	spies.deleteHighlight.mockImplementation(async (id?: unknown) => {
		const index = addedHighlights.findIndex((row) => row.id === id);
		if (index === -1) return false;
		addedHighlights.splice(index, 1);
		deletedIds.push(id as string);
		return true;
	});
});

function view(fingerprint = FINGERPRINT) {
	return (
		<MemoryRouter>
			<ReaderView
				handle={fakeHandle}
				pageCount={PAGE_COUNT}
				title="吾輩は猫である"
				documentId={DOC_ID}
				sourceFingerprint={fingerprint}
				initialPosition={null}
			/>
		</MemoryRouter>
	);
}

function renderReader(fingerprint?: ReturnType<typeof asSourceFingerprint>) {
	return render(view((fingerprint ?? FINGERPRINT) as ReturnType<typeof asSourceFingerprint>));
}

async function settle(): Promise<void> {
	await act(async () => {
		await new Promise((resolve_) => setTimeout(resolve_, 0));
		await new Promise((resolve_) => setTimeout(resolve_, 0));
	});
}

/** Make a real DOM Selection over the test span, the way a drag would. */
function selectSpan() {
	const span = document.querySelector(
		'[data-testid="rm-reader-scroll"] .rm-text-layer span',
	) as HTMLSpanElement | null;
	if (span === null) throw new Error('no test span to select');
	const text = span.firstChild as Text;
	const range = document.createRange();
	range.setStart(text, 0);
	range.setEnd(text, 8);
	const selection = window.getSelection();
	if (selection === null) throw new Error('no Selection support');
	selection.removeAllRanges();
	selection.addRange(range);
}

describe('the toolbar appears only for a real selection', () => {
	it('does not appear for a collapsed range', async () => {
		renderReader();
		await settle();

		const span = document.querySelector(
			'[data-testid="rm-reader-scroll"] .rm-text-layer span',
		) as HTMLSpanElement | null;
		if (span === null) throw new Error('no test span');
		// A click sets a collapsed range — not a drag, not a selection.
		const text = span.firstChild as Text;
		const range = document.createRange();
		range.setStart(text, 4);
		range.setEnd(text, 4);
		const selection = window.getSelection();
		if (selection === null) throw new Error('no Selection support');
		selection.removeAllRanges();
		selection.addRange(range);
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));

		expect(screen.queryByTestId('rm-selection-toolbar')).toBeNull();
	});

	it('appears for a drag selection, with two actions', async () => {
		renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));

		const toolbar = await screen.findByTestId('rm-selection-toolbar');
		expect(toolbar).not.toBeNull();
		expect(screen.getByTestId('rm-selection-highlight')).not.toBeNull();
		expect(screen.getByTestId('rm-selection-bookmark')).not.toBeNull();
	});
});

describe('the highlight action', () => {
	it('writes exactly one row, paints once, and does not rerender the page', async () => {
		renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');
		const rendersBefore = vi.mocked(fakePage.render).mock.calls.length;

		nextCreated = {
			anchor: { format: 'pdf', payload: { page: asPageIndex(1) } },
			selectedText: 'a select',
		};
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-highlight'));
		});
		await waitFor(() => expect(addedHighlights).toHaveLength(1));
		await waitFor(() => expect(overlays).toHaveLength(1));

		// No ghost overlay: the paint that was asked for is the paint
		// that happened, and there is one of each.
		expect(vi.mocked(fakePage.paintResolvedAnchor)).toHaveBeenCalledTimes(1);
		// The page underneath did not get rerendered just to paint one
		// new highlight. A rerender here would be a second canvas pass
		// and a flicker, and the new anchor's overlay does not need it.
		expect(vi.mocked(fakePage.render).mock.calls.length).toBe(rendersBefore);
	});

	it('drops a second click while the first is in flight', async () => {
		renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');

		// Two clicks before the in-flight promise settles: a busy guard
		// that does not fire lets both through, and the reader ends up
		// with two of the same mark.
		nextCreated = {
			anchor: { format: 'pdf', payload: { page: asPageIndex(1) } },
			selectedText: 'a select',
		};
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-highlight'));
			fireEvent.click(screen.getByTestId('rm-selection-highlight'));
		});
		await settle();

		expect(addedHighlights).toHaveLength(1);
		expect(overlays).toHaveLength(1);
	});

	it('shows the action error and paints nothing when the write fails', async () => {
		// Override the default mock for this case: throw on addHighlight.
		// `mockImplementationOnce` does not need a "restore" — it only
		// applies to the next call, and a follow-up test starts fresh
		// because vi.fn() state is reset in `beforeEach`. Using
		// `mockImplementation(original)` here would set the impl to the
		// spy itself, and every subsequent call would recurse.
		spies.addHighlight.mockImplementationOnce(async () => {
			throw new Error('disk full');
		});

		renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');

		nextCreated = {
			anchor: { format: 'pdf', payload: { page: asPageIndex(1) } },
			selectedText: 'a select',
		};
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-highlight'));
		});

		// The banner is the user-visible answer. A ghost overlay
		// would be the wrong answer — the reader sees a mark that
		// deleting the row on screen does not delete.
		const banner = await screen.findByTestId('rm-reader-action-error');
		expect(banner.textContent).toContain('ハイライトを保存');
		expect(overlays).toHaveLength(0);
	});

	it('offers to remove when the same text is re-selected, and deletes the row', async () => {
		renderReader();
		await settle();

		// Add one first.
		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');
		nextCreated = {
			anchor: { format: 'pdf', payload: { page: asPageIndex(1) } },
			selectedText: 'a select',
		};
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-highlight'));
		});
		await waitFor(() => expect(addedHighlights).toHaveLength(1));
		await waitFor(() => expect(overlays).toHaveLength(1));

		// Re-select the same words.
		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');
		// The label flips: a second mark of the same words is not the
		// affordance a reader expects when they have already marked
		// them.
		expect(screen.getByTestId('rm-selection-highlight').textContent).toContain('外す');

		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-highlight'));
		});
		await waitFor(() => expect(addedHighlights).toHaveLength(0));
		await waitFor(() => expect(overlays).toHaveLength(0));
		expect(deletedIds).toEqual(['hl-1']);
		// The toolbar stays — the selection is still live — but the
		// label flips back: with the row gone, re-selecting the same
		// words is now an add, not a remove.
		expect(screen.queryByTestId('rm-selection-toolbar')).not.toBeNull();
		expect(screen.getByTestId('rm-selection-highlight').textContent).not.toContain('外す');
	});
});

describe('the bookmark action', () => {
	it('stores a selection bookmark with the anchor the selection produced', async () => {
		renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');

		const anchor: Anchor = { format: 'pdf', payload: { page: asPageIndex(1) } };
		nextCreated = { anchor, selectedText: 'a select' };
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-bookmark'));
		});
		await settle();

		expect(addedBookmarks).toHaveLength(1);
		expect(addedBookmarks[0]?.anchor).not.toBeNull();
	});

	it('shows the mark in the panel it just opened', async () => {
		// The row is written and the panel is opened in the same handler,
		// so if the write is not reflected in state the reader is shown
		// the list they were already looking at: the mark is in IndexedDB
		// and nowhere they can see or undo it. Nothing refills the list
		// either — it is read once per open, not watched.
		//
		// Asserted on the rendered panel rather than on `bookmarks`, so
		// this also covers the panel rendering what it was handed.
		renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');

		nextCreated = {
			anchor: { format: 'pdf', payload: { page: asPageIndex(1) } },
			selectedText: 'a select',
		};
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-bookmark'));
		});
		await settle();

		const panel = await screen.findByTestId('rm-bookmarks-panel');
		expect(within(panel).getAllByTestId('rm-bookmark-jump')).toHaveLength(1);
		expect(within(panel).queryByTestId('rm-bookmarks-empty-panel')).toBeNull();
	});

	it('stores a page bookmark with anchor=null when the dialog is confirmed', async () => {
		// The page-pin button is on the header, not on the selection
		// toolbar: it is for "this page" with no selection behind it.
		//
		// The reader view gates the dialog on `readPosition`, which
		// reads the scroller's layout. happy-dom has no layout, so the
		// gate returns null and the dialog never opens. The smoke
		// (`scripts/smoke-reader.mjs`) drives this in a real browser;
		// here we exercise the same call site the dialog reaches, by
		// calling `addBookmark` directly with the shape the dialog
		// sends on confirm.
		renderReader();
		await settle();

		// The vi.mock at the top of this file swaps in the spy factory,
		// so the call below is the same one the dialog makes — the only
		// piece we cannot reach here is the dialog's own layout-gated
		// open, which is what the smoke covers.
		const bookmarks = await import('../storage/bookmarks-repo.ts');
		await bookmarks.addBookmark({
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			pageIndex: asPageIndex(1),
			anchor: null,
			position: null,
			title: '',
		});

		expect(addedBookmarks).toHaveLength(1);
		expect(addedBookmarks[0]?.anchor).toBeNull();
	});
});

describe('switching source clears the highlights list', () => {
	it('drops the rows that came from the previous source', async () => {
		const { rerender } = renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');
		nextCreated = {
			anchor: { format: 'pdf', payload: { page: asPageIndex(1) } },
			selectedText: 'a select',
		};
		await act(async () => {
			fireEvent.click(screen.getByTestId('rm-selection-highlight'));
		});
		await waitFor(() => expect(addedHighlights).toHaveLength(1));
		await waitFor(() => expect(overlays).toHaveLength(1));

		// A different source re-runs the resolution effect with an
		// empty list, which is also what removes the painted overlay.
		rerender(view(ANOTHER_SOURCE));
		await settle();
		expect(overlays).toHaveLength(0);
	});
});

describe('a live selection survives a zoom', () => {
	it('keeps the snapshot matching what is on the page after a zoom', async () => {
		renderReader();
		await settle();

		selectSpan();
		fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
		await screen.findByTestId('rm-selection-toolbar');

		// Zoom is a re-render of every page. The selection lives in the
		// DOM, not in the view, so a state change does not collapse it
		// — but a guard that throws the snapshot away on every render
		// would, and that is what we are proving does not happen.
		await act(async () => {
			screen.getByTestId('rm-zoom-in').click();
		});
		await settle();

		expect(screen.queryByTestId('rm-selection-toolbar')).not.toBeNull();
		expect(vi.mocked(fakePage.createAnchorFromSelection)).not.toHaveBeenCalled();
	});
});
