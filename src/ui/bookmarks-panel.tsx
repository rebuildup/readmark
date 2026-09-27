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
								<span className="rm-panel__jump-hint">{documentTitle}</span>
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
 * A mark's label: the page, and an ordinal when the page carries more
 * than one. Marking one page three times is normal, and three rows
 * that read the same are not distinguishable.
 *
 * The ordinal is the mark's position among the marks on its page, in
 * list order — which is creation order — so labels do not renumber
 * when an earlier mark is removed. Numbering by list position instead
 * would make the list jump around under the reader's eyes.
 */
export function bookmarkLabel(pageIndex: number, ordinal: number, total: number): string {
	return total <= 1 ? `${pageIndex} ページ` : `${pageIndex} ページ (${ordinal})`;
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
		return bookmarkLabel(bookmark.pageIndex, ordinal, total);
	});
}
