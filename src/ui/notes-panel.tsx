/**
 * readmark — the notes side panel.
 *
 * Lists the notes of the open source — the document's free notes and
 * its positioned notes in this source — and offers the four things a
 * reader does with a note: write one, edit one, jump to what it is
 * about, and remove it.
 *
 * ## The row is the body
 *
 * A bookmark's row shows a label, because a bookmark is a *place* and
 * the page is the most a list can say about it. A note is prose, and
 * the most a list can say about it is what it says. So the body is the
 * row, wrapped over as many lines as it takes (`.rm-note__body` is
 * `white-space: pre-wrap` — see `note-editor.tsx` for why that fails
 * silently), and the location is the smaller second line under it.
 *
 * ## Presentational, like `BookmarksPanel`
 *
 * The panel holds no note state of its own. `editor` says which note
 * is being written and every action is a callback, so a note added
 * from the selection toolbar and a note edited here are both the
 * parent's to reconcile. That is deliberate for this ticket in
 * particular: the side-panel shell is #9's to own, and a panel that
 * already reads like the one beside it can be moved there without
 * being rewritten.
 *
 * ## What a jump means here
 *
 * Clicking a row takes the reader to what the note is about. For a
 * note on a highlight that is the *highlight* — the reader pointed at
 * the mark, and the mark is the row whose position is re-anchored on
 * every open, so jumping to it lands on the words even if the note's
 * own copy of the anchor has drifted. A note with no highlight jumps to
 * its own position. A free note has no position at all, so it gets no
 * jump: there is nowhere to go, and a button that quietly does nothing
 * is worse than no button.
 *
 * The parent decides all of that — it is the only layer that holds the
 * highlights and the open reader. This panel reports which note was
 * asked for.
 */

import type { Note } from '../domain/reading-state.ts';
import { isHighlightLinked } from '../storage/notes-repo.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { NoteEditor, noteFirstLine } from './note-editor.tsx';
import { PANEL_ENTRY_NOTICE, panelCount } from './panel-entry.ts';
import { Button } from './primitives/button.tsx';

/** Which note the editor is open on, if any. The parent decides what
 *  a "create" writes — a free note, or one on a highlight the reader
 *  just made — so the panel only tracks whether an editor is open. */
export type NoteEditorState =
	| { readonly kind: 'closed' }
	| { readonly kind: 'creating' }
	| { readonly kind: 'editing'; readonly note: Note };

export interface NotesPanelProps {
	readonly notes: readonly Note[];
	readonly documentTitle: string;
	readonly editor: NoteEditorState;
	/** Disables the editor's buttons while the parent writes. */
	readonly busy?: boolean;
	/** Inline message for an open editor. */
	readonly error?: string | null;
	/**
	 * Whether the parent can actually take the reader to this note.
	 *
	 * The panel cannot answer this on its own. A note's jumpable-ness
	 * turns on whether the highlight it names is still there, and only
	 * the parent holds the open reader's highlights. Left out — as it is
	 * when this panel is rendered on its own — the panel falls back to
	 * what the note itself says, which is right for every note whose
	 * target cannot have gone missing.
	 *
	 * The case it exists for: a note that hangs off a highlight which
	 * has since been deleted, written on a book rather than a page. Such
	 * a note has no position of its own, so answering `true` renders a
	 * jump button that goes nowhere at all — the reader presses it and
	 * the note simply stays, with no outcome to read.
	 */
	readonly isReachable?: (note: Note) => boolean;
	/**
	 * A jump that was asked for and did not land exactly, by note id.
	 *
	 * A positioned note always lands on its page even when its anchor
	 * will not resolve, so this is the panel saying *how* it moved. See
	 * the same prop on `BookmarksPanel`.
	 */
	readonly jumpFailures?: ReadonlyMap<string, string>;
	readonly onStartCreate: () => void;
	readonly onCancelEdit: () => void;
	readonly onSubmit: (body: string) => void;
	readonly onEdit: (note: Note) => void;
	readonly onJump: (note: Note) => void;
	readonly onDelete: (note: Note) => void;
}

/** Whether a note names somewhere the reader can be taken.
 *
 * A free note is about the book, so there is nothing to jump to. The
 * panel asks the repository rather than reading `highlightId` itself,
 * so "linked to a highlight" is one rule in one place.
 */
function isJumpable(note: Note): boolean {
	return note.kind === 'positioned' || isHighlightLinked(note);
}

export function NotesPanel({
	notes,
	documentTitle,
	editor,
	busy = false,
	error = null,
	isReachable,
	jumpFailures,
	onStartCreate,
	onCancelEdit,
	onSubmit,
	onEdit,
	onJump,
	onDelete,
}: NotesPanelProps) {
	// The panel's own rule first, narrowed by whatever the parent knows.
	// Both have to say yes: a note that is not jumpable by shape is not
	// jumpable just because a highlight with its id happens to exist.
	const reachable = (note: Note): boolean => isJumpable(note) && (isReachable?.(note) ?? true);

	return (
		<section className="rm-panel__body" data-testid="rm-notes-panel" aria-label="メモ">
			<header className="rm-panel__header">
				<h2 className="rm-panel__title">メモ</h2>
				<span className="rm-muted" data-testid="rm-notes-count">
					{panelCount(notes.length)}
				</span>
			</header>

			{/*
			 * Hidden while an editor is open. Pressing it then would
			 * silently retarget a half-written note — from a place on a
			 * page to no place at all — and the reader would only find
			 * out on save, after the text they just wrote went to the
			 * wrong note. One editor at a time is also what keeps
			 * "which note am I writing" a question with one answer.
			 */}
			{editor.kind === 'closed' && (
				<Button
					variant="secondary"
					onClick={onStartCreate}
					data-testid="rm-note-create"
					aria-label="メモを追加"
				>
					＋メモ
				</Button>
			)}

			{/*
			 * The empty state and the creating editor are exclusive,
			 * and the editor wins. A panel with no notes that then
			 * shows "まだメモがありません" *under* the field the reader
			 * just opened would contradict them while they are typing
			 * their first note into it.
			 */}
			{notes.length === 0 && editor.kind !== 'creating' ? (
				<p className="rm-muted rm-panel__empty" data-testid="rm-notes-empty-panel">
					まだメモがありません。「＋メモ」で本についてのメモを、選択した範囲の「メモ」ボタンで
					ハイライトへのメモを書けます。
				</p>
			) : (
				<ol className="rm-panel__list" data-testid="rm-notes-list">
					{editor.kind === 'creating' && (
						<li className="rm-panel__item rm-panel__item--stacked">
							<NoteEditor
								initialBody=""
								submitLabel="追加する"
								busy={busy}
								error={error}
								onSubmit={onSubmit}
								onCancel={onCancelEdit}
							/>
						</li>
					)}
					{notes.map((note) => (
						<NoteRow
							key={note.id}
							note={note}
							documentTitle={documentTitle}
							editing={editor.kind === 'editing' && editor.note.id === note.id}
							reachable={reachable(note)}
							failure={jumpFailures?.get(note.id) ?? null}
							busy={busy}
							error={error}
							onCancelEdit={onCancelEdit}
							onSubmit={onSubmit}
							onEdit={onEdit}
							onJump={onJump}
							onDelete={onDelete}
						/>
					))}
				</ol>
			)}
		</section>
	);
}

interface NoteRowProps {
	readonly note: Note;
	readonly documentTitle: string;
	readonly editing: boolean;
	/** False when the note names somewhere that is not there any more.
	 *  A note the parent cannot place gets no jump button and says so. */
	readonly reachable: boolean;
	readonly failure: string | null;
	readonly busy: boolean;
	readonly error: string | null;
	readonly onCancelEdit: () => void;
	readonly onSubmit: (body: string) => void;
	readonly onEdit: (note: Note) => void;
	readonly onJump: (note: Note) => void;
	readonly onDelete: (note: Note) => void;
}

function NoteRow({
	note,
	documentTitle,
	editing,
	reachable,
	failure,
	busy,
	error,
	onCancelEdit,
	onSubmit,
	onEdit,
	onJump,
	onDelete,
}: NoteRowProps) {
	const label = noteFirstLine(note.body);
	return (
		<li className="rm-panel__item rm-panel__item--stacked" data-testid="rm-note-row">
			{editing ? (
				<NoteEditor
					initialBody={note.body}
					submitLabel="保存する"
					busy={busy}
					error={error}
					onSubmit={onSubmit}
					onCancel={onCancelEdit}
				/>
			) : (
				<>
					{reachable ? (
						<button
							type="button"
							className="rm-panel__jump"
							onClick={() => onJump(note)}
							data-testid="rm-note-jump"
							aria-label={label === '' ? 'メモの位置へ移動' : `「${label}」の位置へ移動`}
						>
							<NoteContents note={note} documentTitle={documentTitle} notice={null} />
						</button>
					) : (
						/*
						 * No button, and the reason on the row. A note
						 * whose only position was a highlight that has
						 * been deleted has nowhere to send the reader,
						 * and a button that quietly does nothing is the
						 * worst of the three options — it looks like
						 * the app ignoring the press.
						 *
						 * The note itself stays readable, editable and
						 * deletable. It is the reader's own writing and
						 * the missing thing is a reference, not the
						 * words.
						 */
						<div className="rm-panel__jump rm-panel__jump--static">
							<NoteContents
								note={note}
								documentTitle={documentTitle}
								notice={PANEL_ENTRY_NOTICE.gone}
							/>
						</div>
					)}
					{failure !== null && (
						<p className="rm-alert" role="alert" data-testid="rm-note-jump-error">
							{failure}
						</p>
					)}
					<div className="rm-note__row-actions">
						<Button
							variant="ghost"
							onClick={() => onEdit(note)}
							data-testid="rm-note-edit"
							aria-label={label === '' ? 'メモを編集' : `「${label}」のメモを編集`}
						>
							編集
						</Button>
						<Button
							variant="ghost"
							onClick={() => onDelete(note)}
							data-testid="rm-note-delete"
							aria-label={label === '' ? 'メモを削除' : `「${label}」のメモを削除`}
						>
							削除
						</Button>
					</div>
				</>
			)}
		</li>
	);
}

/**
 * A row's content: the body as written, and where it is.
 *
 * One component for both the jumpable and the static wrapper, because
 * the two must not be able to drift: a note that shows a different
 * body depending on whether it can be jumped to is a bug waiting for
 * the second row type to be added.
 */
function NoteContents({
	note,
	documentTitle,
	notice,
}: {
	readonly note: Note;
	readonly documentTitle: string;
	readonly notice: string | null;
}) {
	return (
		<>
			{/*
			 * `pre-wrap` on `.rm-note__body` is what preserves the line
			 * breaks. Without it a two-line note renders as one run-on
			 * line, and everything else about this row still looks
			 * right.
			 */}
			<span className="rm-note__body" data-testid="rm-note-body">
				{note.body}
			</span>
			<span className="rm-panel__jump-hint">{noteHint(note, documentTitle)}</span>
			{notice !== null && (
				<span className="rm-panel__notice" data-testid="rm-note-notice">
					{notice}
				</span>
			)}
		</>
	);
}

/**
 * The second line of a row: where the note is.
 *
 * A free note gets the document, because "about this book" is the
 * only thing that is true about it. A positioned note gets its page,
 * plus the fact that it hangs off a highlight when it does — that is
 * what tells a reader which of three notes on one page is which.
 */
export function noteHint(note: Note, documentTitle: string): string {
	const linked = isHighlightLinked(note) ? ' · ハイライトへのメモ' : '';
	if (note.kind === 'free') return `${documentTitle} 全体${linked}`;
	return `${note.pageIndex} ページ${linked}`;
}

/** Deletion confirmation, kept separate so the list is a pure
 *  projection of its props.
 *
 *  A note is the only reading-state row here the reader typed
 *  themselves, so this asks before it removes — and the dialog names
 *  the note by its first line, because a dialog reading 「削除しますか？」
 *  with no subject gives a reader nothing to check the question
 *  against. */
export function NoteDeleteDialog({
	note,
	onConfirm,
	onCancel,
}: {
	readonly note: Note;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
}) {
	const label = noteFirstLine(note.body);
	return (
		<ConfirmDialog
			title={label === '' ? 'このメモを削除しますか？' : `「${label}」のメモを削除しますか？`}
			description={<p>メモだけを削除します。ハイライトや栞、読書位置には影響しません。</p>}
			confirmLabel="削除する"
			busyLabel="削除中…"
			tone="danger"
			onConfirm={onConfirm}
			onCancel={onCancel}
		/>
	);
}
