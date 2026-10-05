/**
 * readmark — the note editor.
 *
 * A note is prose, so the editor is a `<textarea>` and nothing else
 * will do. Two things follow from that, and both fail *silently* if
 * they are got wrong — the text still appears, just not the text the
 * reader wrote:
 *
 *   1. **Enter must not submit.** An editor that treats Enter as
 *      "save" cannot hold a note with a line break in it, and the
 *      reader's only way out is a button. This one has no Enter
 *      handler at all, which is the honest way to say "Enter is a
 *      newline here".
 *   2. **The stored body is never trimmed or collapsed.** A trailing
 *      newline is content. `notes-repo.addNote` stores what it is
 *      given, so the editor must not decide the body has edges.
 *
 * The display half is the same argument from the other side: the panel
 * renders a body through `.rm-note__body`, which is
 * `white-space: pre-wrap` in `src/styles.css`. A panel that rendered
 * it in an element with the default `white-space: normal` would show a
 * correct note as a single run-on line, and nothing in a unit test with
 * no stylesheet would notice. `notes-panel.test.tsx` asserts the rule
 * is in the stylesheet for exactly that reason.
 *
 * Inline rather than modal, and that is a choice rather than an
 * omission. A note lives in the notes panel for its whole life, so the
 * editor that writes it should be in the same place: after a save the
 * reader is looking at the list the note just joined, with the new row
 * in it, rather than at a dialog closing over a list they have not
 * seen. It is also what keeps this surface composable — the editor
 * takes a body and two callbacks and knows nothing about storage,
 * anchors, highlights or the reader, so the notes panel that hosts it
 * can be moved, wrapped, or embedded elsewhere without touching it.
 *
 * Empty is refused at the affordance, not by rewriting the reader's
 * words: an editor holding nothing has nothing to save, so the save
 * button is disabled. That is a different thing from trimming — a body
 * of `"  "` is still a body, and the save button accepts it.
 */

import { useEffect, useRef, useState } from 'react';

import { Button } from './primitives/button.tsx';

/** How many rows tall an empty editor starts. Enough to see that it
 *  takes more than one line, which is the point of it. */
const MIN_ROWS = 4;

export interface NoteBodyInputProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly label: string;
	readonly testId?: string;
	/** Take focus on mount. The reader opened the editor to write, and
	 *  making them click into the field first is a step they did not
	 *  ask for. */
	readonly autoFocus?: boolean;
}

/**
 * The multi-line field. Split out so the newline contract has exactly
 * one home: a caller that needs a note field anywhere else uses this
 * rather than reaching for a `<textarea>` and re-deciding what Enter
 * means.
 */
export function NoteBodyInput({
	value,
	onChange,
	label,
	testId = 'rm-note-body-input',
	autoFocus = false,
}: NoteBodyInputProps) {
	const fieldRef = useRef<HTMLTextAreaElement | null>(null);
	useEffect(() => {
		if (!autoFocus) return;
		fieldRef.current?.focus();
	}, [autoFocus]);
	return (
		<label className="rm-dialog__field rm-note__field">
			<span className="rm-dialog__field-label">{label}</span>
			<textarea
				className="rm-note__editor"
				rows={MIN_ROWS}
				value={value}
				ref={fieldRef}
				onChange={(event) => onChange(event.target.value)}
				// Deliberately no `onKeyDown`. Enter is a newline: the
				// whole reason this is a textarea. Saving is the button
				// below, and Escape is the way out — both of which work
				// without stealing a key the reader needs for their text.
				data-testid={testId}
			/>
		</label>
	);
}

export interface NoteEditorProps {
	/** Where the field starts. The stored body, verbatim — including
	 *  its line breaks, which is the whole point. */
	readonly initialBody: string;
	/** Verb on the save button, so an add and an edit do not read the
	 *  same. */
	readonly submitLabel: string;
	/** Disables both buttons and relabels the save button while the
	 *  caller's write is in flight. */
	readonly busy?: boolean;
	/** Inline message shown above the field. The editor stays open so
	 *  the reader can fix the problem instead of retyping. */
	readonly error?: string | null;
	readonly onSubmit: (body: string) => void;
	readonly onCancel: () => void;
}

/**
 * Write or rewrite one note.
 *
 * Controlled only by its own field state: the parent owns what a save
 * does, and the editor forgets the body when it unmounts, so reopening
 * an edit starts from the stored row rather than from whatever was
 * half-typed last time.
 */
export function NoteEditor({
	initialBody,
	submitLabel,
	busy = false,
	error = null,
	onSubmit,
	onCancel,
}: NoteEditorProps) {
	const [body, setBody] = useState(initialBody);
	const canSave = body.trim() !== '' && !busy;
	const shellRef = useRef<HTMLDivElement | null>(null);

	// Escape abandons the write, from anywhere in the editor — the
	// field or either button. A multi-line field that ignores Escape
	// traps a reader who opened it by accident, and the reader's own
	// document-level handler deliberately ignores keys that land in a
	// textarea, so nothing else would catch it. A listener on the
	// shell rather than an `onKeyDown` on a wrapper, so the element
	// carrying the behaviour is not a `<div>` pretending to be a
	// control.
	useEffect(() => {
		const shell = shellRef.current;
		if (shell === null) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.stopPropagation();
			onCancel();
		};
		shell.addEventListener('keydown', onKeyDown);
		return () => {
			shell.removeEventListener('keydown', onKeyDown);
		};
	}, [onCancel]);

	return (
		<div className="rm-note__editor-shell" data-testid="rm-note-editor" ref={shellRef}>
			{error !== null && (
				<p className="rm-alert" role="alert" data-testid="rm-note-error">
					{error}
				</p>
			)}
			<NoteBodyInput value={body} onChange={setBody} label="メモ" autoFocus />
			<div className="rm-note__editor-actions">
				<Button variant="ghost" disabled={busy} onClick={onCancel} data-testid="rm-note-cancel">
					キャンセル
				</Button>
				<Button
					variant="primary"
					disabled={!canSave}
					onClick={() => onSubmit(body)}
					data-testid="rm-note-save"
				>
					{busy ? '保存中…' : submitLabel}
				</Button>
			</div>
		</div>
	);
}

/**
 * The first line of a note, for a row that cannot show the whole body.
 *
 * A note is prose, and a panel row has room for a few lines of it — so
 * this is only for a hint, never for the body itself. Trimming the
 * line here is safe: it is a label, not the stored text.
 */
export function noteFirstLine(body: string, maxLength = 40): string {
	const line = body.split('\n', 1)[0] ?? '';
	return line.length > maxLength ? `${line.slice(0, maxLength)}…` : line;
}
