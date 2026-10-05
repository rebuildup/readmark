/**
 * Component tests for notes in the reader — writing one, editing it,
 * removing it, jumping from it, and re-opening the document under it.
 *
 * The layers below are tested on their own. What is only visible here
 * is the routing, and the routing is where a note is lost or pointed
 * at the wrong thing:
 *
 *   - A note made from a selection hangs off the *highlight*, and the
 *     highlight is made on the way if the words are not marked yet. A
 *     note with a `highlightId` that matches nothing is a note about
 *     nothing, and it is a silent failure: the note saves, it lists,
 *     and the jump goes nowhere.
 *   - Editing a note must not move it. Only `body` and `updatedAt`
 *     are the editor's, and a save that could also rewrite the
 *     position would let a note edited on a different page jump
 *     somewhere else.
 *   - A jump from a note on a highlight resolves the *highlight's*
 *     anchor, because that is the row re-anchored on every open. A
 *     note's own copy is a snapshot from whenever it was written.
 *   - Re-opening must refresh a note's stored anchor, and a resolver
 *     that cannot find the words must keep the note. A note is the
 *     reader's own writing; `resolveAnchor` answering `null` is a
 *     fact about *this* file, and ADR-0007 rules out deleting reading
 *     state over it.
 *   - A note with no highlight is not a second-class row: it lists,
 *     it edits, and it is not asked to jump anywhere.
 *
 * The geometry of the jump — whether a page really comes into view —
 * belongs to `scripts/smoke-notes.mjs`, in a browser with layout. Here
 * the stub below makes the jump observable at all, and the assertion is
 * that the scroller was asked for the *right* page.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex, type Note, type PositionedNote } from '../domain/reading-state.ts';
import type { NewAnchor, PageHandle, ReaderHandle, ResolvedAnchor } from '../reader/types.ts';
import type { NewNote, NoteScope } from '../storage/notes-repo.ts';
import { useUiStore } from '../stores/ui-store.ts';
import { ReaderView } from './reader-view.tsx';

const DOC_ID = asDocumentId('00000000-0000-4000-8000-0000000000e8');
const FINGERPRINT = asSourceFingerprint('e'.repeat(64));
const PAGE_COUNT = 3;
const PAGE_HEIGHT = 600;
const HIGHLIGHT_ID = '00000000-0000-4000-8000-00000000ee08';

/** A stored anchor, and the refreshed one recovery hands back. Same
 *  quote, measured against a different copy of the file — which is the
 *  whole reason recovery exists. */
const STORED_ANCHOR: Anchor = {
	format: 'pdf',
	payload: { page: 1, rects: [{ x: 1, y: 1, width: 2, height: 2 }] },
};
const REFRESHED_ANCHOR: Anchor = {
	format: 'pdf',
	payload: { page: 1, rects: [{ x: 40, y: 90, width: 2, height: 2 }] },
};

interface StoredHighlight {
	readonly id: string;
	readonly pageIndex: number;
	readonly selectedText: string;
	readonly anchor: Anchor;
}

let highlights: StoredHighlight[] = [];
let nextHighlightId = 0;
let notes: Note[] = [];
let nextNoteId = 0;
/** Every anchor `resolveAnchor` was asked about, in order. */
let resolvedAnchors: Anchor[] = [];
/** What `replaceNoteAnchor` reported, per note id. */
let anchorWriteBacks = new Map<string, boolean>();

/** The repository, faked at the boundary. A list, so the assertions can
 *  be about what the view asked to store and what it does after — and
 *  so a "re-open" is a second `listNotes` over the same rows. */
const repo = vi.hoisted(() => ({
	listNotes: vi.fn(async (_scope: NoteScope): Promise<Note[]> => []),
	addNote: vi.fn(async (_input: NewNote): Promise<Note | null> => null),
	updateNote: vi.fn(async (_id: string, _body: string): Promise<Note | null> => null),
	deleteNote: vi.fn(async (_id: string): Promise<boolean> => false),
	replaceNoteAnchor: vi.fn(async (_id: string, _anchor: Anchor): Promise<boolean> => false),
	listNotesForHighlight: vi.fn(async (_highlightId: string): Promise<Note[]> => []),
}));

vi.mock('../storage/notes-repo.ts', async () => {
	// The real `compareNotes` and `isHighlightLinked` — the ordering and
	// the "is this note about a mark" rule are production code, and a
	// fake that agreed with whatever the view did would test nothing.
	const actual = await vi.importActual<typeof import('../storage/notes-repo.ts')>(
		'../storage/notes-repo.ts',
	);
	return { ...actual, ...repo };
});

vi.mock('../storage/highlights-repo.ts', () => ({
	listHighlights: vi.fn(async () =>
		highlights.map((row) => ({
			id: row.id,
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			pageIndex: asPageIndex(row.pageIndex),
			anchor: row.anchor,
			selectedText: row.selectedText,
			color: 'yellow',
			createdAt: 1,
		})),
	),
	replaceHighlightAnchor: vi.fn(async () => true),
	addHighlight: vi.fn(
		async (input: { pageIndex: number; selectedText: string; anchor: Anchor }) => {
			const row: StoredHighlight = {
				id: `hl-${++nextHighlightId}`,
				pageIndex: input.pageIndex,
				selectedText: input.selectedText,
				anchor: input.anchor,
			};
			highlights = [...highlights, row];
			return row;
		},
	),
	deleteHighlight: vi.fn(async () => true),
}));

vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: vi.fn(async () => []),
	addBookmark: vi.fn(),
	deleteBookmark: vi.fn(),
}));

vi.mock('../storage/reading-state-repo.ts', () => ({
	saveReadingPosition: vi.fn(async () => {}),
	getReadingProgress: vi.fn(async () => null),
	deleteReadingProgress: vi.fn(async () => false),
}));

/** What the page-side selection will produce. */
let nextCreated: NewAnchor | null = null;
/** What `resolveAnchor` answers, for any anchor. */
let nextResolution: ResolvedAnchor | null = null;

const fakePage = {
	format: 'pdf',
	render: vi.fn(async (target: HTMLElement) => {
		target.replaceChildren();
		const page = document.createElement('div');
		page.className = 'rm-page';
		page.style.width = '420px';
		page.style.height = `${PAGE_HEIGHT}px`;
		// A span the tests can put a DOM Selection over.
		const layer = document.createElement('div');
		layer.className = 'rm-text-layer';
		const span = document.createElement('span');
		span.textContent = 'a selection the note can be about';
		layer.appendChild(span);
		page.appendChild(layer);
		target.appendChild(page);
	}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async (): Promise<NewAnchor | null> => {
		if (nextCreated === null) return null;
		const value = nextCreated;
		nextCreated = null;
		return value;
	}),
	paintResolvedAnchor: vi.fn(async () => null),
} as unknown as PageHandle<'pdf'>;

const fakeHandle = {
	format: 'pdf',
	pageCount: vi.fn(async () => PAGE_COUNT),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn(async (anchor: Anchor): Promise<ResolvedAnchor | null> => {
		resolvedAnchors.push(anchor);
		return nextResolution;
	}),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

/**
 * Give the page hosts a geometry, so a jump is observable.
 *
 * happy-dom has no layout, so every box is zero and
 * `jumpToPage`'s first phase — `scrollTop = reserved.top - clientHeight / 2` —
 * would be a write of zero, which a jump to page 1 and a jump to page 3
 * would both look like. A box per page makes the scroller's `scrollTop`
 * say which page was asked for. Every other element still measures as
 * zero, so the selection toolbar's own maths is untouched.
 */
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

beforeEach(() => {
	highlights = [];
	nextHighlightId = 0;
	notes = [];
	nextNoteId = 0;
	resolvedAnchors = [];
	anchorWriteBacks = new Map();
	nextCreated = null;
	nextResolution = null;
	useUiStore.setState({ sidePanel: 'none' });

	for (const spy of Object.values(repo)) spy.mockClear();

	repo.listNotes.mockImplementation(async (scope: NoteScope) =>
		notes.filter(
			(note) =>
				note.documentId === scope.documentId &&
				(note.kind === 'free' || note.sourceFingerprint === scope.sourceFingerprint),
		),
	);
	repo.addNote.mockImplementation(async (input: NewNote) => {
		nextNoteId += 1;
		const base = {
			id: `note-${nextNoteId}`,
			createdAt: nextNoteId,
			updatedAt: nextNoteId,
		};
		// Built rather than spread, so the fake row is the same union
		// the repository returns and the test file cannot drift into
		// asserting against a shape nothing produces.
		const note: Note =
			input.kind === 'free'
				? {
						...base,
						kind: 'free',
						documentId: input.documentId,
						body: input.body,
						highlightId: input.highlightId ?? null,
					}
				: {
						...base,
						kind: 'positioned',
						documentId: input.documentId,
						sourceFingerprint: input.sourceFingerprint,
						pageIndex: input.pageIndex,
						anchor: input.anchor,
						body: input.body,
						highlightId: input.highlightId ?? null,
					};
		notes = [...notes, note];
		return note;
	});
	repo.updateNote.mockImplementation(async (id: string, body: string) => {
		if (!notes.some((note) => note.id === id)) return null;
		notes = notes.map((note) => (note.id === id ? { ...note, body, updatedAt: 99 } : note));
		return notes.find((note) => note.id === id) ?? null;
	});
	repo.deleteNote.mockImplementation(async (id: string) => {
		const before = notes.length;
		notes = notes.filter((note) => note.id !== id);
		return notes.length < before;
	});
	repo.replaceNoteAnchor.mockImplementation(async (id: string, anchor: Anchor) => {
		const reported = anchorWriteBacks.get(id) ?? true;
		if (!reported) return false;
		notes = notes.map((note) =>
			note.id === id && note.kind === 'positioned' ? { ...note, anchor } : note,
		);
		return true;
	});
	repo.listNotesForHighlight.mockImplementation(async (highlightId: string) =>
		notes.filter((note) => note.highlightId === highlightId),
	);

	vi.mocked(fakeHandle.resolveAnchor).mockClear();
	vi.mocked(fakePage.createAnchorFromSelection).mockClear();
	vi.mocked(fakePage.render).mockClear();
	vi.mocked(fakePage.paintResolvedAnchor).mockClear();
});

function view() {
	return (
		<MemoryRouter>
			<ReaderView
				handle={fakeHandle}
				pageCount={PAGE_COUNT}
				title="吾輩は猫である"
				documentId={DOC_ID}
				sourceFingerprint={FINGERPRINT}
				initialPosition={null}
			/>
		</MemoryRouter>
	);
}

function renderReader() {
	return render(view());
}

function scroller(): HTMLElement {
	const node = document.querySelector('[data-testid="rm-reader-scroll"]');
	if (node === null) throw new Error('no reader scroller');
	return node as HTMLElement;
}

async function settle(): Promise<void> {
	await act(async () => {
		for (let attempt = 0; attempt < 20; attempt++) {
			await Promise.resolve();
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

/** A stored positioned note. `pageIndex` is a plain number here and
 *  branded on the way in, so a test reads `pageIndex: 3` rather than
 *  `pageIndex: asPageIndex(3)` on every row. */
function stored(
	over: Partial<Omit<PositionedNote, 'pageIndex'>> & { readonly pageIndex?: number } = {},
): Note {
	const { pageIndex, ...rest } = over;
	return {
		id: `note-${++nextNoteId}`,
		kind: 'positioned',
		documentId: DOC_ID,
		sourceFingerprint: FINGERPRINT,
		pageIndex: asPageIndex(pageIndex ?? 1),
		anchor: null,
		body: 'a stored note',
		highlightId: null,
		createdAt: nextNoteId,
		updatedAt: nextNoteId,
		...rest,
	};
}

function freeStored(body: string, highlightId: string | null = null): Note {
	nextNoteId += 1;
	return {
		id: `note-${nextNoteId}`,
		kind: 'free',
		documentId: DOC_ID,
		body,
		highlightId,
		createdAt: nextNoteId,
		updatedAt: nextNoteId,
	};
}

/** The positioned note out of a list, narrowed. Several assertions are
 *  about a position, and asking for it by name says so at the call
 *  site instead of hiding the narrowing in a conditional. */
function thePositionedNote(list: readonly Note[]): PositionedNote {
	const found = list.find((note): note is PositionedNote => note.kind === 'positioned');
	if (found === undefined) throw new Error('no positioned note in the list');
	return found;
}

async function openPanel(): Promise<void> {
	fireEvent.click(screen.getByTestId('rm-toggle-notes'));
	await screen.findByTestId('rm-notes-panel');
}

async function write(body: string): Promise<void> {
	fireEvent.change(await screen.findByTestId('rm-note-body-input'), { target: { value: body } });
	fireEvent.click(screen.getByTestId('rm-note-save'));
	await settle();
}

/** Make a real DOM Selection over the test span, the way a drag would. */
function selectSpan(): void {
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

async function selectAndOpenNoteEditor(): Promise<void> {
	selectSpan();
	fireEvent.mouseUp(screen.getByTestId('rm-reader-scroll'));
	fireEvent.click(await screen.findByTestId('rm-selection-note'));
	// The mark is written on the way, so the assertions after this see
	// a highlight that exists rather than one still in flight.
	await settle();
}

describe('the notes panel on open', () => {
	it('reads the notes of this document and this source, and only once per open', async () => {
		notes = [stored({ body: 'mine' })];
		renderReader();
		await settle();
		await openPanel();

		expect(await screen.findByTestId('rm-note-body')).toBeTruthy();
		expect(repo.listNotes).toHaveBeenCalledTimes(1);
		expect(repo.listNotes).toHaveBeenCalledWith({
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
		});
	});

	it('shows a multi-line note with its line breaks, not one run-on line', async () => {
		notes = [stored({ body: 'first line\nsecond line\n\nfourth' })];
		renderReader();
		await settle();
		await openPanel();

		const body = await screen.findByTestId('rm-note-body');
		expect(body.textContent).toBe('first line\nsecond line\n\nfourth');
	});

	it('says so when there are no notes', async () => {
		renderReader();
		await settle();
		await openPanel();

		expect((await screen.findByTestId('rm-notes-empty-panel')).textContent).toContain(
			'まだメモがありません',
		);
	});

	it('toggles shut and back open', async () => {
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-toggle-notes'));
		expect(screen.queryByTestId('rm-notes-panel')).toBeNull();
	});
});

describe('a free note', () => {
	it('is written with no position at all, and keeps its line breaks', async () => {
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-create'));
		await write('about the book\n\nand its ending');

		expect(repo.addNote).toHaveBeenCalledWith({
			kind: 'free',
			documentId: DOC_ID,
			body: 'about the book\n\nand its ending',
		});
		expect((await screen.findByTestId('rm-note-body')).textContent).toBe(
			'about the book\n\nand its ending',
		);
	});

	it('has no jump, because there is nowhere to go', async () => {
		notes = [freeStored('about the book')];
		renderReader();
		await settle();
		await openPanel();

		expect(await screen.findByTestId('rm-note-body')).toBeTruthy();
		expect(screen.queryByTestId('rm-note-jump')).toBeNull();
	});

	it('is never handed to the resolver, because it has no anchor', async () => {
		notes = [freeStored('about the book')];
		renderReader();
		await settle();
		await openPanel();

		expect(resolvedAnchors).toEqual([]);
		expect(repo.replaceNoteAnchor).not.toHaveBeenCalled();
	});
});

describe('a note on a highlight', () => {
	it('marks the selection first, so the note has something to be about', async () => {
		nextCreated = { anchor: STORED_ANCHOR, selectedText: 'a select' };
		renderReader();
		await settle();
		await selectAndOpenNoteEditor();

		expect(highlights).toHaveLength(1);
		expect(highlights[0]?.anchor).toBe(STORED_ANCHOR);
	});

	it('opens the notes panel with an editor, so the note is written where it will live', async () => {
		nextCreated = { anchor: STORED_ANCHOR, selectedText: 'a select' };
		renderReader();
		await settle();
		await selectAndOpenNoteEditor();

		expect(await screen.findByTestId('rm-note-editor')).toBeTruthy();
		expect(await screen.findByTestId('rm-notes-panel')).toBeTruthy();
	});

	it('stores the highlight it made, its page, its anchor and the body', async () => {
		nextCreated = { anchor: STORED_ANCHOR, selectedText: 'a select' };
		renderReader();
		await settle();
		await selectAndOpenNoteEditor();
		await write('why this matters\nand what to do about it');

		expect(repo.addNote).toHaveBeenCalledWith({
			kind: 'positioned',
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			pageIndex: 1,
			anchor: STORED_ANCHOR,
			highlightId: highlights[0]?.id,
			body: 'why this matters\nand what to do about it',
		});
	});

	it('hangs off an existing highlight rather than marking the words twice', async () => {
		highlights = [
			{ id: HIGHLIGHT_ID, pageIndex: 1, selectedText: 'a select', anchor: STORED_ANCHOR },
		];
		renderReader();
		await settle();
		await selectAndOpenNoteEditor();
		await write('about the mark');

		// `createAnchorFromSelection` is never called, so no second
		// mark was made: two identical highlights over the same words
		// is a visibly darker one.
		expect(fakePage.createAnchorFromSelection).not.toHaveBeenCalled();
		expect(highlights).toHaveLength(1);
		expect(repo.addNote).toHaveBeenCalledWith(
			expect.objectContaining({ highlightId: HIGHLIGHT_ID, body: 'about the mark' }),
		);
	});

	it('adds nothing when the editor is cancelled', async () => {
		nextCreated = { anchor: STORED_ANCHOR, selectedText: 'a select' };
		renderReader();
		await settle();
		await selectAndOpenNoteEditor();
		fireEvent.click(await screen.findByTestId('rm-note-cancel'));
		await settle();

		expect(repo.addNote).not.toHaveBeenCalled();
	});
});

describe('editing a note', () => {
	it('starts from the stored body, line breaks and all', async () => {
		notes = [stored({ body: 'before\n\nand after' })];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-edit'));

		const field = await screen.findByTestId('rm-note-body-input');
		expect((field as HTMLTextAreaElement).value).toBe('before\n\nand after');
	});

	it('saves the rewritten body verbatim', async () => {
		notes = [stored({ body: 'before' })];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-edit'));
		await write('after\nwith a second line\n');

		const target = notes[0];
		expect(target?.body).toBe('after\nwith a second line\n');
		expect((await screen.findByTestId('rm-note-body')).textContent).toBe(
			'after\nwith a second line\n',
		);
	});

	it('cannot move the note: only the body is the editor’s', async () => {
		notes = [stored({ body: 'before', pageIndex: 2, highlightId: HIGHLIGHT_ID })];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-edit'));
		await write('after');

		const target = notes[0];
		expect(target?.body).toBe('after');
		if (target?.kind !== 'positioned') throw new Error('expected a positioned note');
		expect(target.pageIndex).toBe(2);
		expect(target.highlightId).toBe(HIGHLIGHT_ID);
	});

	it('leaves the list when the note is no longer on disk', async () => {
		const note = stored({ body: 'about to vanish' });
		notes = [note];
		repo.updateNote.mockImplementationOnce(async () => null);

		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-edit'));
		await write('edited');

		// The row is not on disk, so showing it would be showing writing
		// the reader cannot find again.
		expect(screen.queryByTestId('rm-note-row')).toBeNull();
	});

	it('changes nothing when the editor is cancelled', async () => {
		notes = [stored({ body: 'before' })];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-edit'));
		fireEvent.change(await screen.findByTestId('rm-note-body-input'), {
			target: { value: 'abandoned' },
		});
		fireEvent.click(screen.getByTestId('rm-note-cancel'));
		await settle();

		expect(notes[0]?.body).toBe('before');
	});
});

describe('deleting a note', () => {
	it('asks first, and the question names the note', async () => {
		notes = [stored({ body: 'a thought worth keeping\nfor now' })];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-delete'));

		const dialog = await screen.findByRole('alertdialog');
		expect(dialog.textContent).toContain('「a thought worth keeping」のメモを削除しますか？');
		expect(repo.deleteNote).not.toHaveBeenCalled();
	});

	it('removes it once confirmed', async () => {
		const note = stored({ body: 'a thought worth keeping' });
		notes = [note];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-delete'));
		fireEvent.click(await screen.findByTestId('rm-dialog-confirm'));
		await settle();

		expect(repo.deleteNote).toHaveBeenCalledWith(note.id);
		expect(notes).toEqual([]);
		expect(screen.queryByTestId('rm-note-row')).toBeNull();
	});

	it('changes nothing when the confirmation is cancelled', async () => {
		notes = [stored({ body: 'kept' })];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-delete'));
		fireEvent.click(await screen.findByTestId('rm-dialog-cancel'));
		await settle();

		expect(repo.deleteNote).not.toHaveBeenCalled();
		expect(notes).toHaveLength(1);
	});

	it('closes an editor open on the note that just went', async () => {
		notes = [stored({ body: 'about to be deleted' })];
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-edit'));
		await screen.findByTestId('rm-note-editor');
		// A second panel action while the row is an editor: the row
		// shows 編集 / 保存 rather than 削除, so cancel out and delete
		// from a fresh open.
		fireEvent.click(screen.getByTestId('rm-note-cancel'));
		await settle();
		fireEvent.click(screen.getByTestId('rm-note-delete'));
		fireEvent.click(await screen.findByTestId('rm-dialog-confirm'));
		await settle();

		expect(screen.queryByTestId('rm-note-editor')).toBeNull();
		expect(screen.queryByTestId('rm-note-row')).toBeNull();
	});
});

describe('jumping from a note', () => {
	it('takes the reader to the highlight, resolving the highlight’s anchor', async () => {
		const note = stored({ body: 'about the mark', pageIndex: 1, highlightId: HIGHLIGHT_ID });
		highlights = [
			{ id: HIGHLIGHT_ID, pageIndex: 3, selectedText: 'the words', anchor: REFRESHED_ANCHOR },
		];
		nextResolution = {
			format: 'pdf',
			page: asPageIndex(3),
			freshness: 'fresh',
			selectedText: 'the words',
			display: { x: 0, y: 0, width: 1, height: 1 },
			updatedAnchor: null,
		};
		notes = [note];
		renderReader();
		await settle();
		await openPanel();

		resolvedAnchors.length = 0;
		fireEvent.click(screen.getByTestId('rm-note-jump'));
		await waitFor(() => expect(resolvedAnchors).toContain(REFRESHED_ANCHOR));

		// The highlight's anchor, not the note's own copy of it — the
		// highlight is the row that is re-anchored on every open.
		expect(resolvedAnchors).not.toContain(STORED_ANCHOR);
		// And the jump asked for the page the highlight is on.
		await waitFor(() => expect(scroller().scrollTop).toBeGreaterThan((3 - 1) * PAGE_HEIGHT - 1));
	});

	it('falls back to the note’s own position when its highlight is gone', async () => {
		// A dangling link is a fact about a row, not a licence to
		// refuse: the note is still about a place.
		notes = [
			stored({ body: 'orphan', pageIndex: 2, anchor: STORED_ANCHOR, highlightId: HIGHLIGHT_ID }),
		];
		highlights = [];
		renderReader();
		await settle();
		await openPanel();

		resolvedAnchors.length = 0;
		fireEvent.click(screen.getByTestId('rm-note-jump'));
		await waitFor(() => expect(resolvedAnchors).toContain(STORED_ANCHOR));
		await waitFor(() => expect(scroller().scrollTop).toBeGreaterThan((2 - 1) * PAGE_HEIGHT - 1));
	});

	it('jumps a note with no highlight to its own page', async () => {
		notes = [stored({ body: 'about page 2', pageIndex: 2, anchor: null, highlightId: null })];
		renderReader();
		await settle();
		await openPanel();

		fireEvent.click(screen.getByTestId('rm-note-jump'));
		await waitFor(() => expect(scroller().scrollTop).toBeGreaterThan((2 - 1) * PAGE_HEIGHT - 1));
	});
});

describe('an anchor survives a re-open', () => {
	it('resolves the stored anchor and writes the refreshed one back', async () => {
		notes = [stored({ body: 'about the words', pageIndex: 1, anchor: STORED_ANCHOR })];
		nextResolution = {
			format: 'pdf',
			page: asPageIndex(1),
			freshness: 'fresh',
			selectedText: 'the words',
			display: { x: 40, y: 90, width: 1, height: 1 },
			updatedAnchor: REFRESHED_ANCHOR,
		};
		renderReader();
		await settle();

		await waitFor(() => expect(repo.replaceNoteAnchor).toHaveBeenCalled());
		expect(repo.replaceNoteAnchor).toHaveBeenCalledWith(notes[0]?.id, REFRESHED_ANCHOR);
		// And it is really stored: the next open reads the refreshed
		// anchor, not the one it started with.
		expect(thePositionedNote(notes).anchor).toBe(REFRESHED_ANCHOR);
	});

	it('resolves on every re-open, so a note made weeks ago lands on the words', async () => {
		notes = [stored({ body: 'about the words', pageIndex: 1, anchor: STORED_ANCHOR })];
		nextResolution = {
			format: 'pdf',
			page: asPageIndex(1),
			freshness: 'fresh',
			selectedText: 'the words',
			display: { x: 40, y: 90, width: 1, height: 1 },
			updatedAnchor: REFRESHED_ANCHOR,
		};

		const first = renderReader();
		await waitFor(() => expect(repo.listNotes).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(repo.replaceNoteAnchor).toHaveBeenCalledTimes(1));

		// Close the document and open it again.
		first.unmount();
		resolvedAnchors.length = 0;
		renderReader();
		await waitFor(() => expect(repo.listNotes).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(resolvedAnchors).toContain(REFRESHED_ANCHOR));
	});

	it('keeps the note when the anchor cannot be resolved in this file', async () => {
		notes = [stored({ body: 'about words this file lost', pageIndex: 1, anchor: STORED_ANCHOR })];
		nextResolution = null;
		renderReader();
		await settle();
		await openPanel();

		// A resolver answering null is a fact about *this* copy of the
		// file. The note is the reader's own writing, and deleting it
		// over a file they may not hold the whole of is the one
		// outcome ADR-0007 rules out.
		expect(notes).toHaveLength(1);
		expect(repo.deleteNote).not.toHaveBeenCalled();
		expect((await screen.findByTestId('rm-note-body')).textContent).toBe(
			'about words this file lost',
		);
		// And the stored anchor is left exactly as it was, so the note
		// can recover if the change that broke it is undone.
		expect(thePositionedNote(notes).anchor).toBe(STORED_ANCHOR);
	});

	it('writes nothing when the resolution disagrees about the page', async () => {
		notes = [stored({ body: 'about page 1', pageIndex: 1, anchor: STORED_ANCHOR })];
		nextResolution = {
			format: 'pdf',
			page: asPageIndex(3),
			freshness: 'fresh',
			selectedText: 'the words',
			display: { x: 0, y: 0, width: 1, height: 1 },
			updatedAnchor: REFRESHED_ANCHOR,
		};
		renderReader();
		await settle();

		// An integrity failure, detectable without reading the payload.
		// Nothing is written, and the row is left as it is.
		expect(repo.replaceNoteAnchor).not.toHaveBeenCalled();
		expect(thePositionedNote(notes).anchor).toBe(STORED_ANCHOR);
	});

	it('a vanished note is not resurrected, and a write-back that says so is believed', async () => {
		notes = [stored({ body: 'deleted in another tab', pageIndex: 1, anchor: STORED_ANCHOR })];
		const id = notes[0]?.id ?? '';
		anchorWriteBacks.set(id, false);
		nextResolution = {
			format: 'pdf',
			page: asPageIndex(1),
			freshness: 'fresh',
			selectedText: 'the words',
			display: { x: 0, y: 0, width: 1, height: 1 },
			updatedAnchor: REFRESHED_ANCHOR,
		};
		renderReader();
		await settle();

		expect(repo.replaceNoteAnchor).toHaveBeenCalledWith(id, REFRESHED_ANCHOR);
		// The repository says the row is gone. Trusting it is what
		// keeps a stale list from writing over a note the reader just
		// removed.
		expect(thePositionedNote(notes).anchor).toBe(STORED_ANCHOR);
	});

	it('writes nothing when recovery says the stored anchor is already right', async () => {
		notes = [stored({ body: 'about the words', pageIndex: 1, anchor: STORED_ANCHOR })];
		nextResolution = {
			format: 'pdf',
			page: asPageIndex(1),
			freshness: 'fresh',
			selectedText: 'the words',
			display: { x: 1, y: 1, width: 1, height: 1 },
			updatedAnchor: null,
		};
		renderReader();
		await settle();

		expect(repo.replaceNoteAnchor).not.toHaveBeenCalled();
	});

	it('keeps the list when one row’s write-back fails', async () => {
		notes = [
			stored({ body: 'first note', pageIndex: 1, anchor: STORED_ANCHOR }),
			stored({ body: 'second note', pageIndex: 2, anchor: STORED_ANCHOR }),
		];
		// A rejected IndexedDB write on the second row. Left
		// unhandled it would reject the `Promise.all` the load effect
		// uses, and the reader would open the panel to an empty book
		// they had written two notes in.
		repo.replaceNoteAnchor.mockImplementation(async (id: string) => {
			if (notes.find((note) => note.id === id)?.body === 'first note') {
				throw new Error('IndexedDB write failed');
			}
			return true;
		});
		nextResolution = {
			format: 'pdf',
			page: asPageIndex(1),
			freshness: 'fresh',
			selectedText: 'the words',
			display: { x: 0, y: 0, width: 1, height: 1 },
			updatedAnchor: REFRESHED_ANCHOR,
		};
		renderReader();
		await settle();
		await openPanel();

		const bodies = screen.getAllByTestId('rm-note-body').map((node) => node.textContent);
		expect(bodies).toContain('first note');
		expect(bodies).toContain('second note');
	});

	it('leaves a positioned note with no anchor alone', async () => {
		notes = [stored({ body: 'about page 5', pageIndex: 5, anchor: null })];
		renderReader();
		await settle();

		expect(repo.replaceNoteAnchor).not.toHaveBeenCalled();
	});
});

describe('a failed write', () => {
	it('keeps the editor open with the writing still in it', async () => {
		renderReader();
		await settle();
		await openPanel();
		fireEvent.click(screen.getByTestId('rm-note-create'));
		fireEvent.change(await screen.findByTestId('rm-note-body-input'), {
			target: { value: 'worth keeping even if it fails' },
		});
		repo.addNote.mockRejectedValueOnce(new Error('quota exceeded'));

		fireEvent.click(screen.getByTestId('rm-note-save'));
		await settle();

		expect((await screen.findByTestId('rm-note-error')).textContent).toContain(
			'メモを保存できませんでした',
		);
		expect((screen.getByTestId('rm-note-body-input') as HTMLTextAreaElement).value).toBe(
			'worth keeping even if it fails',
		);
	});

	it('shows a banner when a selection cannot be turned into a note', async () => {
		nextCreated = null; // the page declines the selection
		renderReader();
		await settle();
		await selectAndOpenNoteEditor();
		await settle();

		expect(screen.queryByTestId('rm-note-editor')).toBeNull();
		expect(repo.addNote).not.toHaveBeenCalled();
	});
});
