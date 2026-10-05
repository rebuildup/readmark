/**
 * readmark — the highlights side panel.
 *
 * The third of the reader's three lists, and the only one whose row is
 * the reader's own words rather than a position or a note. It sits
 * beside `BookmarksPanel` and `NotesPanel` and is built to their shape:
 * presentational, props-only, and told about its rows rather than
 * reading storage itself.
 *
 * ## What the parent has to know, and why it cannot be worked around
 *
 * Whether a highlight can be jumped to is not a property of the
 * highlight. A stored anchor is a position in a *file*, and the file in
 * front of the reader may not lay those words out the way it did when
 * they were marked. The reader already resolves every highlight against
 * the open source when it opens it, and the outcome of that resolution
 * — placed, unplaceable, page disagreement, or the repository reporting
 * the row as deleted — is what this panel renders. So `state` is a
 * required prop, and there is no default that guesses.
 *
 * Guessing would be the quiet failure: a row painted with a working jump
 * button that scrolls nowhere is a reader clicking and concluding the
 * app is broken, rather than a row that says 「位置が見つかりません」
 * and why.
 *
 * ## The notes on a highlight
 *
 * A highlight is what a note is usually about, so its row names the
 * notes hanging off it. The parent passes them already grouped
 * (`notes`), because grouping is a storage question and this panel is
 * not allowed to ask one — it has no reader and no database, only the
 * props it was handed.
 */

import type { Highlight, Note } from '../domain/reading-state.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { noteFirstLine } from './note-editor.tsx';
import {
	PANEL_ENTRY_NOTICE,
	type PanelEntryState,
	panelCount,
	panelEntryIsJumpable,
} from './panel-entry.ts';
import { Button } from './primitives/button.tsx';

/**
 * One row of the highlights list.
 *
 * `state` is the reader's resolution of this highlight against the open
 * source, translated into the panel's three answers — see
 * `panel-entry.ts`. The translation is the parent's because the parent
 * is the only layer holding the reader.
 */
export interface HighlightPanelEntry {
	readonly highlight: Highlight;
	readonly state: PanelEntryState;
	/** Notes written about this highlight, oldest first. May be empty. */
	readonly notes: readonly Note[];
}

export interface HighlightsPanelProps {
	readonly entries: readonly HighlightPanelEntry[];
	readonly documentTitle: string;
	/**
	 * A jump that was asked for and did not land, by entry id.
	 *
	 * Separate from `state` because the two are not known at the same
	 * moment: `state` is settled when the reader opens, while a failed
	 * jump is only learned when the reader presses the row. Keeping them
	 * apart means the panel can show both without one overwriting the
	 * other, and without the parent having to re-resolve the whole list
	 * to record one failure.
	 */
	readonly jumpFailures?: ReadonlyMap<string, string>;
	readonly onJump: (highlight: Highlight) => void;
	readonly onDelete: (highlight: Highlight) => void;
}

export function HighlightsPanel({
	entries,
	documentTitle,
	jumpFailures,
	onJump,
	onDelete,
}: HighlightsPanelProps) {
	// The count is the list. `entries.length` is the same number the
	// `.map` below turns into rows, which is the invariant — see
	// `panel-entry.ts`.
	const reachable = entries.filter((entry) => panelEntryIsJumpable(entry.state)).length;

	return (
		<section className="rm-panel__body" data-testid="rm-highlights-panel" aria-label="ハイライト">
			<header className="rm-panel__header">
				<h2 className="rm-panel__title">ハイライト</h2>
				<span className="rm-muted" data-testid="rm-highlights-count">
					{panelCount(entries.length)}
				</span>
			</header>

			{/*
			 * A second number, and the reason it is here rather than
			 * in the count above. A reader looking at "12 件" cannot
			 * tell how many of the twelve they can actually get to,
			 * and the rows that answer 「位置が見つかりません」 do
			 * not add up to anything visible. The count stays honest
			 * (it counts every row); this says how many of them work.
			 */}
			{reachable !== entries.length && (
				<p className="rm-muted rm-panel__note" data-testid="rm-highlights-unreachable">
					{reachable} / {entries.length} 件に移動できます
				</p>
			)}

			{entries.length === 0 ? (
				<p className="rm-muted rm-panel__empty" data-testid="rm-highlights-empty-panel">
					まだハイライトがありません。ページ上の文章を選ぶと「ハイライト」で付けられます。
				</p>
			) : (
				<ol className="rm-panel__list" data-testid="rm-highlights-list">
					{entries.map((entry) => (
						<HighlightRow
							key={entry.highlight.id}
							entry={entry}
							documentTitle={documentTitle}
							failure={jumpFailures?.get(entry.highlight.id) ?? null}
							onJump={onJump}
							onDelete={onDelete}
						/>
					))}
				</ol>
			)}
		</section>
	);
}

interface HighlightRowProps {
	readonly entry: HighlightPanelEntry;
	readonly documentTitle: string;
	readonly failure: string | null;
	readonly onJump: (highlight: Highlight) => void;
	readonly onDelete: (highlight: Highlight) => void;
}

function HighlightRow({ entry, documentTitle, failure, onJump, onDelete }: HighlightRowProps) {
	const { highlight, state } = entry;
	const jumpable = panelEntryIsJumpable(state);
	const label = highlightLabel(highlight);

	return (
		<li className="rm-panel__item rm-panel__item--stacked" data-testid="rm-highlight-row">
			{jumpable ? (
				<button
					type="button"
					className="rm-panel__jump"
					onClick={() => onJump(highlight)}
					data-testid="rm-highlight-jump"
					aria-label={`「${label}」の位置へ移動`}
				>
					<HighlightContents entry={entry} documentTitle={documentTitle} notice={null} />
				</button>
			) : (
				/*
				 * No button at all. A `disabled` jump would still be a
				 * jump as far as the reader is concerned — it looks
				 * like the app is refusing, when in fact there is
				 * nothing there to go to. The row says which of the
				 * two it is, and stays readable and deletable.
				 */
				<div className="rm-panel__jump rm-panel__jump--static">
					<HighlightContents
						entry={entry}
						documentTitle={documentTitle}
						notice={PANEL_ENTRY_NOTICE[state]}
					/>
				</div>
			)}

			{/*
			 * The failure surface. `role="alert"` because it appears
			 * after the reader has already pressed something, with no
			 * other cue that the press did not do what it said — a
			 * reader who is not watching for a message would otherwise
			 * read the outcome as "the panel is broken".
			 */}
			{failure !== null && (
				<p className="rm-alert" role="alert" data-testid="rm-highlight-jump-error">
					{failure}
				</p>
			)}

			<div className="rm-note__row-actions">
				<Button
					variant="ghost"
					onClick={() => onDelete(highlight)}
					data-testid="rm-highlight-delete"
					aria-label={`「${label}」のハイライトを削除`}
				>
					削除
				</Button>
			</div>
		</li>
	);
}

/**
 * A row's content: the words that were marked, and where they are.
 *
 * One component for the jumpable and the static wrapper, because the
 * two must not be able to drift — a highlight that showed a different
 * quote depending on whether it could be jumped to would mean the quote
 * on the broken rows is not the quote.
 */
function HighlightContents({
	entry,
	documentTitle,
	notice,
}: {
	readonly entry: HighlightPanelEntry;
	readonly documentTitle: string;
	readonly notice: string | null;
}) {
	return (
		<>
			<span className="rm-panel__jump-label" data-testid="rm-highlight-quote">
				{label(entry.highlight)}
			</span>
			<span className="rm-panel__jump-hint" data-testid="rm-highlight-hint">
				{highlightHint(entry, documentTitle)}
			</span>
			{/*
			 * The notes on this highlight. Shown for every state,
			 * including `gone` — a note the reader wrote is still
			 * theirs to read even after the mark it hangs off is
			 * deleted, and hiding it here would be the panel hiding
			 * the reader's own words because the reference is
			 * missing.
			 */}
			{entry.notes.length > 0 && (
				<span className="rm-panel__jump-hint" data-testid="rm-highlight-notes">
					メモ {entry.notes.length} 件 ·{' '}
					{entry.notes.map((note) => noteFirstLine(note.body)).join(' / ')}
				</span>
			)}
			{notice !== null && (
				<span className="rm-panel__notice" data-testid="rm-highlight-notice">
					{notice}
				</span>
			)}
		</>
	);
}

/** The words, in one unbroken line. `selectedText` is what the reader
 *  selected, and a row that reflowed it would no longer be the words
 *  they marked. CSS clips it; the full text is in the jump's label. */
function label(highlight: Highlight): string {
	return highlight.selectedText.replace(/\s+/g, ' ').trim();
}

/** Exported for the tests' readable failure messages. */
export function highlightLabel(highlight: Highlight): string {
	const text = label(highlight);
	return text === '' ? `${highlight.pageIndex} ページ` : text;
}

/** The second line of a row: where the mark is, and the book it is in.
 *
 *  A mark with no position to speak of still names its page, and every
 *  row names the book — a panel is a list of one document, and saying
 *  so costs one clause and answers the question a reader has when a
 *  row looks unfamiliar. */
export function highlightHint(entry: HighlightPanelEntry, documentTitle: string): string {
	return `${entry.highlight.pageIndex} ページ · ${documentTitle}`;
}

/**
 * Deletion confirmation, kept separate so the list is a pure
 * projection of its props.
 *
 *  The selection toolbar removes a highlight by re-selecting the same
 *  words, which is its own confirmation — the press that would add it
 *  is the press that takes it away. A panel row has no such pairing:
 *  the delete button sits next to every other row, and a mis-click
 *  there would remove a mark the reader did not mean to touch. So this
 *  asks, and names the highlight by its words, because a dialog reading
 *  「削除しますか？」 with no subject gives a reader nothing to check the
 *  question against.
 *
 *  It also says what removal does *not* do: the notes written about the
 *  highlight stay. They are the reader's own writing, they are not part
 *  of the mark, and ADR-0007 rules out destroying a reader's words over
 *  something they did not ask to destroy.
 */
export function HighlightDeleteDialog({
	highlight,
	onConfirm,
	onCancel,
}: {
	readonly highlight: Highlight;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
}) {
	const text = highlightLabel(highlight);
	return (
		<ConfirmDialog
			title={
				text === '' ? 'このハイライトを削除しますか？' : `「${text}」のハイライトを削除しますか？`
			}
			description={
				<p>
					ハイライトだけを削除します。このハイライトに書いたメモは残ります。栞や読書位置には影響しません。
				</p>
			}
			confirmLabel="削除する"
			busyLabel="削除中…"
			tone="danger"
			onConfirm={onConfirm}
			onCancel={onCancel}
		/>
	);
}
