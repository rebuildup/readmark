/**
 * readmark — the bookmarks side panel.
 *
 * Lists the marks in the open source, oldest first, and drives two
 * actions: jump to a mark, and remove it. The panel reads and writes
 * through `src/storage/bookmarks-repo.ts`; it holds no bookmark state
 * of its own beyond the list it was given, so a mark added from the
 * toolbar and a mark removed here are both the parent's problem to
 * reconcile.
 *
 * The label is a position, not a quotation. In the MVP a bookmark is a
 * page pin with no selection behind it (`anchor: null` — ADR-0002), so
 * there is no text to show; what the reader recognises is the page and
 * roughly where in it. Marks on the same page are numbered, because
 * marking one page three times is normal and three identical rows are
 * not distinguishable.
 *
 * Removal asks first. There is no undo in the MVP, and a bookmark
 * carries a position that took a reader effort to reach.
 */

import { useState } from 'react';

import type { Bookmark } from '../domain/reading-state.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { Button } from './primitives/button.tsx';

interface BookmarksPanelProps {
	readonly bookmarks: readonly Bookmark[];
	readonly documentTitle: string;
	readonly onJump: (bookmark: Bookmark) => void;
	readonly onDelete: (bookmark: Bookmark) => void;
}

export function BookmarksPanel({
	bookmarks,
	documentTitle,
	onJump,
	onDelete,
}: BookmarksPanelProps) {
	const labels = bookmarkLabels(bookmarks);
	const hints = bookmarkHints(bookmarks, documentTitle);

	return (
		<aside className="rm-panel rm-panel--reader" data-testid="rm-bookmarks-panel" aria-label="栞">
			<header className="rm-panel__header">
				<h2 className="rm-panel__title">栞</h2>
				<span className="rm-muted" data-testid="rm-bookmarks-count">
					{bookmarks.length} 件
				</span>
			</header>

			{bookmarks.length === 0 ? (
				<p className="rm-muted rm-panel__empty" data-testid="rm-bookmarks-empty-panel">
					まだ栞がありません。ヘッダーの「栞を追加」で、いま読んでいる場所に付けられます。
				</p>
			) : (
				<ol className="rm-panel__list" data-testid="rm-bookmarks-list">
					{bookmarks.map((bookmark, index) => (
						<li className="rm-panel__item" key={bookmark.id}>
							<button
								type="button"
								className="rm-panel__jump"
								onClick={() => onJump(bookmark)}
								data-testid="rm-bookmark-jump"
							>
								<span className="rm-panel__jump-label">{labels[index]}</span>
								<span className="rm-panel__jump-hint">{hints[index]}</span>
							</button>
							<Button
								variant="ghost"
								onClick={() => onDelete(bookmark)}
								data-testid="rm-bookmark-delete"
								aria-label={`${labels[index] ?? ''} を削除`}
							>
								削除
							</Button>
						</li>
					))}
				</ol>
			)}
		</aside>
	);
}

/**
 * Naming a mark, asked for at the moment it is made.
 *
 * The name is optional and the dialog says so: an unnamed mark falls
 * back to its page and an ordinal, which is enough to find it again and
 * costs no typing. The field starts empty rather than pre-filled with
 * the page label, because a default the reader did not write is a title
 * they did not give — and two marks on one page would then carry the
 * same one, which is the thing the ordinal exists to prevent.
 *
 * Focus starts on the field, not on the cancel button: this dialog is
 * not destructive, and the reader's next move is almost always to type.
 */
export function AddBookmarkDialog({
	pageIndex,
	onConfirm,
	onCancel,
}: {
	readonly pageIndex: number;
	readonly onConfirm: (title: string) => void;
	readonly onCancel: () => void;
}) {
	const [title, setTitle] = useState('');
	return (
		<ConfirmDialog
			title="栞を追加"
			description={
				<p>
					{pageIndex} ページ に栞を付けます。名前を入れておくと一覧で区別できます。空欄なら
					ページ番号で表示されます。
				</p>
			}
			confirmLabel="追加する"
			busyLabel="追加中…"
			initialFocus="first"
			onConfirm={() => onConfirm(title.trim())}
			onCancel={onCancel}
		>
			<label className="rm-dialog__field">
				<span className="rm-dialog__field-label">名前（任意）</span>
				<input
					type="text"
					value={title}
					maxLength={120}
					placeholder={`${pageIndex} ページ`}
					onChange={(event) => setTitle(event.target.value)}
					// Enter adds: a field with no form around it would
					// otherwise swallow the key the reader expects to
					// finish with.
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							onConfirm(title.trim());
						}
					}}
					data-testid="rm-bookmark-title"
				/>
			</label>
		</ConfirmDialog>
	);
}

/** Deletion confirmation, kept separate so the panel's list is a pure
 *  projection of its props. */
export function BookmarkDeleteDialog({
	label,
	onConfirm,
	onCancel,
}: {
	readonly label: string;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
}) {
	return (
		<ConfirmDialog
			title={`「${label}」の栞を削除しますか？`}
			description={<p>栞だけを削除します。読書位置や他の栞には影響しません。</p>}
			confirmLabel="削除する"
			busyLabel="削除中…"
			tone="danger"
			onConfirm={onConfirm}
			onCancel={onCancel}
		/>
	);
}

/**
 * A mark's label: the name the reader gave it, or the page it is on.
 *
 * A title is the reader's own words and win outright — they wrote them
 * to recognise the mark by. Without one, the label falls back to the
 * page and an ordinal, because marking one page three times is normal
 * and three rows that read the same are not distinguishable.
 *
 * The ordinal is the mark's position among the marks on its page, in
 * list order — which is creation order — so labels do not renumber
 * when an earlier mark is removed. Numbering by list position instead
 * would make the list jump around under the reader's eyes. It counts
 * every mark on the page, titled or not, so `(2)` always means "the
 * second mark on this page" rather than "the second unnamed one".
 */
export function bookmarkLabel(bookmark: Bookmark, ordinal: number, total: number): string {
	const title = bookmark.title.trim();
	if (title !== '') return title;
	return total <= 1 ? `${bookmark.pageIndex} ページ` : `${bookmark.pageIndex} ページ (${ordinal})`;
}

/** Label every mark, in list order. Exported for the tests. */
export function bookmarkLabels(bookmarks: readonly Bookmark[]): readonly string[] {
	const seen = new Map<number, number>();
	return bookmarks.map((bookmark) => {
		const ordinal = (seen.get(bookmark.pageIndex) ?? 0) + 1;
		seen.set(bookmark.pageIndex, ordinal);
		const total = bookmarks.filter(
			(candidate) => candidate.pageIndex === bookmark.pageIndex,
		).length;
		return bookmarkLabel(bookmark, ordinal, total);
	});
}

/**
 * The second line of a row: the document, and the page when the label
 * has taken the reader's title instead.
 *
 * A title can name a place without saying where it is — "the part about
 * the fox" is a fine label and no location at all. The page is the one
 * thing the list can always add, so it appears whenever the label is
 * not already a position.
 */
export function bookmarkHints(
	bookmarks: readonly Bookmark[],
	documentTitle: string,
): readonly string[] {
	return bookmarks.map((bookmark) =>
		bookmark.title.trim() === ''
			? documentTitle
			: `${bookmark.pageIndex} ページ · ${documentTitle}`,
	);
}
