/**
 * Component tests for the notes surface.
 *
 * Under test is the note's own body, because that is where every
 * failure in this feature is invisible until a reader notices their own
 * writing has been mangled:
 *
 *   - The editor is a `<textarea>`, not an `<input>`, and Enter is a
 *     newline rather than a save.
 *   - What comes out of the field is what was typed, byte for byte:
 *     line breaks, blank lines, a trailing newline, runs of spaces.
 *   - The panel shows the line breaks. That one is a *stylesheet*
 *     claim, not a component one — a body rendered in an element with
 *     the default `white-space: normal` is intact in the DOM and
 *     collapsed on screen, and happy-dom applies no stylesheet at all.
 *     So the rule is asserted against `src/styles.css` directly, and
 *     the geometry of it is `scripts/smoke-notes.mjs`'s job.
 *
 * Also under test: what a row offers. A positioned note is somewhere
 * the reader can be taken; a free note is about the book and gets no
 * jump button, because a button that quietly does nothing is worse
 * than no button.
 *
 * The panel is presentational on purpose — every action is a callback
 * — so this file needs no storage fake at all. The routing those
 * callbacks feed is `notes-integration.test.tsx`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import {
	asPageIndex,
	type FreeNote,
	type Note,
	type PositionedNote,
} from '../domain/reading-state.ts';
import { NoteEditor, noteFirstLine } from './note-editor.tsx';
import { NoteDeleteDialog, type NoteEditorState, NotesPanel, noteHint } from './notes-panel.tsx';

const DOC = asDocumentId('00000000-0000-4000-8000-0000000000d1');
const FINGERPRINT = asSourceFingerprint('d'.repeat(64));
const HIGHLIGHT = '00000000-0000-4000-8000-00000000ee01';

let sequence = 0;

function positioned(params: {
	readonly body: string;
	readonly pageIndex?: number;
	readonly highlightId?: string | null;
}): PositionedNote {
	return {
		id: `note-${++sequence}`,
		kind: 'positioned',
		documentId: DOC,
		sourceFingerprint: FINGERPRINT,
		pageIndex: asPageIndex(params.pageIndex ?? 3),
		anchor: null,
		body: params.body,
		highlightId: params.highlightId ?? null,
		createdAt: sequence,
		updatedAt: sequence,
	};
}

function free(params: { readonly body: string; readonly highlightId?: string | null }): FreeNote {
	return {
		id: `note-${++sequence}`,
		kind: 'free',
		documentId: DOC,
		body: params.body,
		highlightId: params.highlightId ?? null,
		createdAt: sequence,
		updatedAt: sequence,
	};
}

const CLOSED: NoteEditorState = { kind: 'closed' };

function renderPanel(overrides: Partial<Parameters<typeof NotesPanel>[0]> = {}) {
	const props = {
		notes: [] as readonly Note[],
		documentTitle: '精読の本',
		editor: CLOSED,
		onStartCreate: vi.fn(),
		onCancelEdit: vi.fn(),
		onSubmit: vi.fn(),
		onEdit: vi.fn(),
		onJump: vi.fn(),
		onDelete: vi.fn(),
		...overrides,
	};
	render(<NotesPanel {...props} />);
	return props;
}

beforeEach(() => {
	sequence = 0;
});

/** `disabled` read plainly. The repo does not load jest-dom, so the
 *  assertions here stay on the DOM's own properties rather than on a
 *  matcher layer this suite would then be the only user of. */
function disabled(node: HTMLElement): boolean {
	return (node as HTMLButtonElement).disabled;
}

describe('the stored body is what the reader wrote', () => {
	it('renders line breaks as line breaks', () => {
		renderPanel({ notes: [positioned({ body: 'one\ntwo\nthree' })] });
		const body = screen.getByTestId('rm-note-body');
		expect(body.textContent).toBe('one\ntwo\nthree');
	});

	it('renders a blank line as a blank line', () => {
		renderPanel({ notes: [positioned({ body: 'first\n\nthird' })] });
		expect(screen.getByTestId('rm-note-body').textContent).toBe('first\n\nthird');
	});

	it('renders a trailing newline rather than dropping it', () => {
		renderPanel({ notes: [positioned({ body: 'a line\n' })] });
		expect(screen.getByTestId('rm-note-body').textContent).toBe('a line\n');
	});

	it('renders runs of spaces, which are not noise in prose', () => {
		renderPanel({ notes: [positioned({ body: 'a  double  space' })] });
		expect(screen.getByTestId('rm-note-body').textContent).toBe('a  double  space');
	});

	it('puts the body on an element the stylesheet can preserve it on', () => {
		renderPanel({ notes: [positioned({ body: 'a\nb' })] });
		expect(screen.getByTestId('rm-note-body').className).toContain('rm-note__body');
	});
});

describe('the stylesheet, which no component test can see', () => {
	// Resolved from the project root rather than from `import.meta.url`:
	// under happy-dom the module URL is an `http:` one, which
	// `readFileSync` refuses. Vitest runs with the config's directory as
	// the working directory, and the existence check below turns a
	// wrong working directory into a clear failure rather than a
	// confusing one.
	const stylesheetPath = resolve(process.cwd(), 'src/styles.css');
	expect(existsSync(stylesheetPath), `stylesheet not found at ${stylesheetPath}`).toBe(true);
	const css = readFileSync(stylesheetPath, 'utf8');

	/** The declarations for one selector, without a full CSS parser. */
	function ruleFor(selector: string): string {
		const start = css.indexOf(`${selector} {`);
		expect(start, `no rule for ${selector}`).toBeGreaterThan(-1);
		const end = css.indexOf('}', start);
		return css.slice(start, end);
	}

	it('preserves newlines in a rendered note body', () => {
		expect(ruleFor('.rm-note__body')).toMatch(/white-space:\s*pre-wrap/);
	});

	it('preserves newlines in the editor, so the box shows what will be stored', () => {
		expect(ruleFor('.rm-note__editor')).toMatch(/white-space:\s*pre-wrap/);
	});

	it('does not let one long word push the row out of the panel', () => {
		expect(ruleFor('.rm-note__body')).toMatch(/overflow-wrap:\s*break-word/);
	});
});

describe('NoteEditor', () => {
	function renderEditor(overrides: Partial<Parameters<typeof NoteEditor>[0]> = {}) {
		const props = {
			initialBody: '',
			submitLabel: '保存する',
			onSubmit: vi.fn(),
			onCancel: vi.fn(),
			...overrides,
		};
		render(<NoteEditor {...props} />);
		return props;
	}

	function type(value: string): void {
		fireEvent.change(screen.getByTestId('rm-note-body-input'), { target: { value } });
	}

	it('is a multi-line field, not a single-line one', () => {
		renderEditor();
		expect(screen.getByTestId('rm-note-body-input').tagName).toBe('TEXTAREA');
	});

	it('submits the body exactly as typed, newlines and all', () => {
		const props = renderEditor();
		const body = 'first line\n\nthird line\n';
		type(body);
		fireEvent.click(screen.getByTestId('rm-note-save'));
		expect(props.onSubmit).toHaveBeenCalledWith(body);
	});

	it('submits runs of spaces and tabs untouched', () => {
		const props = renderEditor();
		const body = 'a  double  space\n\tindented';
		type(body);
		fireEvent.click(screen.getByTestId('rm-note-save'));
		expect(props.onSubmit).toHaveBeenCalledWith(body);
	});

	it('does not save on Enter, because Enter is a newline here', () => {
		const props = renderEditor();
		type('first');
		fireEvent.keyDown(screen.getByTestId('rm-note-body-input'), { key: 'Enter' });
		expect(props.onSubmit).not.toHaveBeenCalled();
		// And the field keeps everything typed, so the reader's line
		// break is still there to be written.
		type('first\nsecond');
		fireEvent.click(screen.getByTestId('rm-note-save'));
		expect(props.onSubmit).toHaveBeenCalledWith('first\nsecond');
	});

	it('refuses to save nothing', () => {
		renderEditor();
		expect(disabled(screen.getByTestId('rm-note-save'))).toBe(true);
	});

	it('refuses a body that is only whitespace, which renders as no body at all', () => {
		renderEditor();
		type('   \n  \n');
		expect(disabled(screen.getByTestId('rm-note-save'))).toBe(true);
	});

	it('saves a body that merely has a blank line in it', () => {
		const props = renderEditor();
		type('a\n\nb');
		expect(disabled(screen.getByTestId('rm-note-save'))).toBe(false);
		fireEvent.click(screen.getByTestId('rm-note-save'));
		expect(props.onSubmit).toHaveBeenCalledWith('a\n\nb');
	});

	it('starts from the stored body when it is an edit, line breaks included', () => {
		renderEditor({ initialBody: 'stored\nbody' });
		expect(screen.getByTestId<HTMLTextAreaElement>('rm-note-body-input').value).toBe(
			'stored\nbody',
		);
	});

	it('puts the cursor in the field, because the reader came here to type', () => {
		renderEditor();
		expect(document.activeElement).toBe(screen.getByTestId('rm-note-body-input'));
	});

	it('abandons the write on Escape, from anywhere in the editor', () => {
		const props = renderEditor();
		type('half a thought');
		fireEvent.keyDown(screen.getByTestId('rm-note-cancel'), { key: 'Escape' });
		expect(props.onCancel).toHaveBeenCalledOnce();
		expect(props.onSubmit).not.toHaveBeenCalled();
	});

	it('cancels on the button too', () => {
		const props = renderEditor();
		fireEvent.click(screen.getByTestId('rm-note-cancel'));
		expect(props.onCancel).toHaveBeenCalledOnce();
	});

	it('shows an error and stays open, so the writing is not thrown away', () => {
		const props = renderEditor({ error: 'メモを保存できませんでした。' });
		expect(screen.getByTestId('rm-note-error').textContent).toContain(
			'メモを保存できませんでした。',
		);
		fireEvent.click(screen.getByTestId('rm-note-save'));
		expect(props.onSubmit).not.toHaveBeenCalled();
	});
});

describe('noteFirstLine', () => {
	it('is only the first line — a label, never the stored text', () => {
		expect(noteFirstLine('one\ntwo\nthree')).toBe('one');
	});

	it('truncates a long first line rather than the whole body', () => {
		expect(noteFirstLine('x'.repeat(80), 10)).toBe(`${'x'.repeat(10)}…`);
	});
});

describe('the panel list', () => {
	it('says so when there are no notes, and says how to write one', () => {
		renderPanel({ notes: [] });
		expect(screen.getByTestId('rm-notes-empty-panel')).toBeTruthy();
		expect(screen.getByTestId('rm-notes-count').textContent).toContain('0 件');
	});

	it('counts the notes it was given', () => {
		renderPanel({
			notes: [positioned({ body: 'a' }), positioned({ body: 'b' }), free({ body: 'c' })],
		});
		expect(screen.getByTestId('rm-notes-count').textContent).toContain('3 件');
		expect(screen.getAllByTestId('rm-note-row')).toHaveLength(3);
	});

	it('renders each note’s own body, in the order it was given', () => {
		renderPanel({
			notes: [positioned({ body: 'free thought' }), positioned({ body: 'on page 3' })],
		});
		const bodies = screen.getAllByTestId('rm-note-body').map((node) => node.textContent);
		expect(bodies).toEqual(['free thought', 'on page 3']);
	});

	it('starts the editor on a create, with an empty field', () => {
		renderPanel({ notes: [], editor: { kind: 'creating' } });
		expect(screen.getByTestId('rm-note-editor')).toBeTruthy();
		// The empty state must not contradict the field the reader is
		// being asked to type their first note into.
		expect(screen.queryByTestId('rm-notes-empty-panel')).toBeNull();
		expect(screen.getByTestId<HTMLTextAreaElement>('rm-note-body-input').value).toBe('');
		expect(screen.getByTestId('rm-note-save').textContent).toContain('追加する');
	});

	it('opens the editor on the note being edited, and only on that one', () => {
		const edited = positioned({ body: 'the one being edited' });
		renderPanel({
			notes: [positioned({ body: 'untouched' }), edited],
			editor: { kind: 'editing', note: edited },
		});
		expect(screen.getByTestId<HTMLTextAreaElement>('rm-note-body-input').value).toBe(
			'the one being edited',
		);
		expect(screen.getAllByTestId('rm-note-body')).toHaveLength(1);
		expect(screen.getByTestId('rm-note-body').textContent).toContain('untouched');
	});

	it('reports which note the reader asked to edit', () => {
		const note = positioned({ body: 'edit me' });
		const props = renderPanel({ notes: [note] });
		fireEvent.click(screen.getByTestId('rm-note-edit'));
		expect(props.onEdit).toHaveBeenCalledWith(note);
	});

	it('reports which note the reader asked to delete', () => {
		const note = positioned({ body: 'delete me' });
		const props = renderPanel({ notes: [note] });
		fireEvent.click(screen.getByTestId('rm-note-delete'));
		expect(props.onDelete).toHaveBeenCalledWith(note);
	});

	it('hides ＋メモ while an editor is open, so a save cannot be retargeted', () => {
		const note = positioned({ body: 'being edited' });
		renderPanel({ notes: [note], editor: { kind: 'editing', note } });
		expect(screen.queryByTestId('rm-note-create')).toBeNull();
		expect(screen.getByTestId('rm-note-editor')).toBeTruthy();
	});

	it('hides ＋メモ while a create is open, for the same reason', () => {
		renderPanel({ notes: [], editor: { kind: 'creating' } });
		expect(screen.queryByTestId('rm-note-create')).toBeNull();
	});

	it('brings ＋メモ back when the editor closes', () => {
		renderPanel({ notes: [positioned({ body: 'x' })], editor: { kind: 'closed' } });
		expect(screen.getByTestId('rm-note-create')).toBeTruthy();
	});

	it('reports the ask to create a note', () => {
		const props = renderPanel({ notes: [] });
		fireEvent.click(screen.getByTestId('rm-note-create'));
		expect(props.onStartCreate).toHaveBeenCalledOnce();
	});

	it('names each delete and edit button after its note, so they are tellable apart', () => {
		renderPanel({
			notes: [positioned({ body: 'first thought' }), positioned({ body: 'second thought' })],
		});
		const editButtons = screen.getAllByTestId('rm-note-edit');
		expect(editButtons[0]?.getAttribute('aria-label')).toBe('「first thought」のメモを編集');
		expect(editButtons[1]?.getAttribute('aria-label')).toBe('「second thought」のメモを編集');
	});
});

describe('what a row offers to jump to', () => {
	it('jumps a positioned note to its own place', () => {
		const note = positioned({ body: 'about page 7', pageIndex: 7 });
		const props = renderPanel({ notes: [note] });
		fireEvent.click(screen.getByTestId('rm-note-jump'));
		expect(props.onJump).toHaveBeenCalledWith(note);
	});

	it('jumps a note on a highlight too — the highlight is a place', () => {
		const note = positioned({ body: 'about the mark', highlightId: HIGHLIGHT });
		const props = renderPanel({ notes: [note] });
		fireEvent.click(screen.getByTestId('rm-note-jump'));
		expect(props.onJump).toHaveBeenCalledWith(note);
	});

	it('offers no jump for a free note, which is about the book rather than a place', () => {
		renderPanel({ notes: [free({ body: 'about the book' })] });
		expect(screen.queryByTestId('rm-note-jump')).toBeNull();
		// The writing is still there. A free note is not a second-class
		// row; it just has nowhere to go.
		expect(screen.getByTestId('rm-note-body').textContent).toContain('about the book');
		expect(screen.getByTestId('rm-note-edit')).toBeTruthy();
		expect(screen.getByTestId('rm-note-delete')).toBeTruthy();
	});
});

describe('noteHint', () => {
	it('gives a positioned note its page', () => {
		expect(noteHint(positioned({ body: 'x', pageIndex: 12 }), '精読の本')).toBe('12 ページ');
	});

	it('says which notes are on a highlight, since several can share a page', () => {
		expect(noteHint(positioned({ body: 'x', pageIndex: 4, highlightId: HIGHLIGHT }), '本')).toBe(
			'4 ページ · ハイライトへのメモ',
		);
	});

	it('gives a free note the document, which is all that is true about it', () => {
		expect(noteHint(free({ body: 'x' }), '精読の本')).toBe('精読の本 全体');
	});
});

describe('NoteDeleteDialog', () => {
	it('names the note by its first line, so there is something to check the question against', async () => {
		render(
			<NoteDeleteDialog
				note={positioned({ body: 'a long thought\nthat runs on' })}
				onConfirm={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		// The dialog is portalled in an effect, so it arrives a tick
		// after the render.
		const dialog = await screen.findByRole('alertdialog');
		expect(dialog.textContent).toContain('「a long thought」のメモを削除しますか？');
		// And only the first line: the rest of the note is not quoted
		// back at the reader, because a question with a paragraph in it
		// is a question nobody reads.
		expect(dialog.textContent).not.toContain('that runs on');
	});

	it('says what deleting does not touch', async () => {
		render(
			<NoteDeleteDialog note={positioned({ body: 'x' })} onConfirm={vi.fn()} onCancel={vi.fn()} />,
		);
		const dialog = await screen.findByRole('alertdialog');
		expect(dialog.textContent).toContain('ハイライトや栞、読書位置には影響しません');
	});

	it('starts focus on cancel, because there is no undo', async () => {
		render(
			<NoteDeleteDialog note={positioned({ body: 'x' })} onConfirm={vi.fn()} onCancel={vi.fn()} />,
		);
		await screen.findByRole('alertdialog');
		await waitFor(() => {
			expect(document.activeElement?.getAttribute('data-testid')).toBe('rm-dialog-cancel');
		});
	});
});
