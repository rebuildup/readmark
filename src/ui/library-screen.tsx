/**
 * readmark — Library screen.
 *
 * The list itself is a JOIN over `documents` + their primary
 * `documentSources`, surfaced through `listLibrary()` as
 * `LibraryEntry`. We deliberately keep Document and DocumentSource
 * separate at the data layer; the join lives in the repository, not
 * in the screen.
 *
 * This screen owns presentation and orchestration only:
 *   - When to re-fetch (`listLibrary()` after an import or a delete).
 *   - Which sort / filter is active (the rules themselves are in
 *     `src/library/library-list.ts`, where they are unit-tested
 *     without a DOM).
 *   - The delete confirmation. The screen never deletes on its own;
 *     it goes through `removeDocument()` in `src/library/`, which
 *     returns a typed outcome instead of throwing.
 *
 * Two empty states, deliberately distinct:
 *   - "no documents at all" → the import CTA. There is nothing to
 *     search, so the toolbar is not rendered.
 *   - "documents exist but the filter matches none" → the query is
 *     wrong, not the library. We name the query and offer to clear
 *     it.
 *
 * The import affordance is mounted twice on purpose: once in the
 * header, and again inside the empty state. Each instance owns its
 * own file input, so there is no shared imperative handle to keep in
 * sync, and a reader who lands on an empty library sees the one
 * action that changes that.
 */

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { DocumentId } from '../domain/document.ts';
import type { ImportSuccess } from '../library/import-document.ts';
import {
	DEFAULT_LIBRARY_SORT,
	displayTitle,
	formatByteSize,
	LIBRARY_SORT_LABELS,
	LIBRARY_SORTS,
	type LibrarySort,
	selectVisibleLibrary,
} from '../library/library-list.ts';
import { removeDocument, removeErrorMessage } from '../library/remove-document.ts';
import type { LibraryEntry } from '../storage/documents-repo.ts';
import { listLibrary } from '../storage/documents-repo.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { DocumentImport } from './document-import.tsx';
import { LibraryRow } from './library-row.tsx';
import { Button } from './primitives/button.tsx';

export function LibraryScreen() {
	const [entries, setEntries] = useState<readonly LibraryEntry[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [sort, setSort] = useState<LibrarySort>(DEFAULT_LIBRARY_SORT);
	const [pendingDelete, setPendingDelete] = useState<LibraryEntry | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	// The instant the relative dates ("3 日前") are measured against.
	// Re-based on every successful fetch, never on a timer: it must
	// not drift while the reader reads, and a document imported after
	// a long-lived session would otherwise render a future date as a
	// negative count of days.
	const [now, setNow] = useState(() => Date.now());

	const refresh = useCallback(() => {
		listLibrary()
			.then((rows) => {
				setEntries(rows);
				setNow(Date.now());
				setLoadError(null);
			})
			.catch((err: unknown) => {
				console.error('listLibrary failed', err);
				setEntries([]);
				setLoadError('ライブラリを読み込めませんでした。ページを再読み込みしてください。');
			});
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handleImported = useCallback(
		(_result: ImportSuccess) => {
			refresh();
		},
		[refresh],
	);

	// The dialog needs the whole row (for its title and size), but
	// the click handler only has the id. Resolve at click time
	// instead of keeping a second copy of the row in state.
	const handleRequestDelete = useCallback(
		(documentId: DocumentId) => {
			const entry = entries?.find((candidate) => candidate.document.id === documentId);
			if (!entry) {
				// The row disappeared between paint and click (another
				// tab deleted it). Nothing to confirm; just resync.
				refresh();
				return;
			}
			setDeleteError(null);
			setPendingDelete(entry);
		},
		[entries, refresh],
	);

	const cancelDelete = useCallback(() => {
		setPendingDelete(null);
		setDeleteError(null);
	}, []);

	const confirmDelete = useCallback(async () => {
		if (pendingDelete === null) return;
		setDeleting(true);
		setDeleteError(null);
		const result = await removeDocument(pendingDelete.document.id);
		setDeleting(false);
		if (result.ok) {
			setPendingDelete(null);
			refresh();
			return;
		}
		if (result.error.kind === 'not-found') {
			// Nothing was deleted, but the desired end state holds.
			// Treat it as success so the reader is not sent to an
			// error for a document that is already gone.
			setPendingDelete(null);
			refresh();
			return;
		}
		// Keep the dialog open so the reader can retry or cancel
		// with the row still on screen.
		setDeleteError(removeErrorMessage(result.error));
	}, [pendingDelete, refresh]);

	const visible = useMemo(
		() => (entries === null ? null : selectVisibleLibrary(entries, { search, sort })),
		[entries, search, sort],
	);

	const totalCount = entries?.length ?? 0;
	const matchedCount = visible?.length ?? 0;
	const filtering = search.trim() !== '';

	// Two empty states, deliberately distinct. Split into a helper
	// so the JSX in the render body stays a flat ladder of conditions
	// rather than a nested ternary — the original `(visible === null
	// ? ... : loadError !== null ? null : ...)` violated the "no
	// nested ternaries" rule and was a wall to read on top of that.
	const renderBody = (): ReactNode => {
		if (visible === null) {
			return (
				<p className="rm-muted" data-testid="rm-library-loading">
					読み込み中…
				</p>
			);
		}
		if (loadError !== null) {
			// A failed read must NOT fall through to the empty state:
			// "the library is empty" and "we could not read the library"
			// are different facts, and offering the import CTA after a
			// read failure invites the reader to re-import documents
			// that are still there.
			return null;
		}
		const toolbar = totalCount > 0 && (
			<div className="rm-library-toolbar">
				<label className="rm-library-search">
					<span className="rm-visually-hidden">タイトル・著者を検索</span>
					<input
						type="search"
						value={search}
						placeholder="タイトル・著者を検索"
						onChange={(event) => setSearch(event.target.value)}
						data-testid="rm-library-search"
					/>
				</label>
				<label className="rm-library-sort">
					<span className="rm-visually-hidden">並び順</span>
					<select
						value={sort}
						onChange={(event) => setSort(event.target.value as LibrarySort)}
						data-testid="rm-library-sort"
					>
						{LIBRARY_SORTS.map((option) => (
							<option key={option} value={option}>
								{LIBRARY_SORT_LABELS[option]}
							</option>
						))}
					</select>
				</label>
				<span className="rm-muted rm-library-count" data-testid="rm-library-count">
					{filtering ? `${matchedCount} / ${totalCount} 件` : `${totalCount} 件`}
				</span>
			</div>
		);
		if (visible.length === 0) {
			if (filtering) {
				return (
					<>
						{toolbar}
						<section className="rm-library-empty" data-testid="rm-library-empty-filtered">
							<h3>一致する文書がありません</h3>
							<p className="rm-muted">「{search.trim()}」にタイトルも著者も一致しませんでした。</p>
							<Button variant="secondary" onClick={() => setSearch('')}>
								検索をクリア
							</Button>
						</section>
					</>
				);
			}
			return (
				<>
					{toolbar}
					<section className="rm-library-empty" data-testid="rm-library-empty">
						<h3>まだ文書がありません</h3>
						<p className="rm-muted">
							import ボタンから PDF を追加してください。ファイルはこのブラウザの IndexedDB
							にのみ保存され、外部へ送信されません。
						</p>
						<DocumentImport onImported={handleImported} />
					</section>
				</>
			);
		}
		return (
			<>
				{toolbar}
				<ul className="rm-library-list">
					{visible.map((entry) => (
						<LibraryRow
							key={entry.document.id}
							entry={entry}
							now={now}
							onRequestDelete={handleRequestDelete}
						/>
					))}
				</ul>
			</>
		);
	};

	return (
		<div className="rm-app">
			<header className="rm-library-header">
				<h1>readmark</h1>
			</header>

			<main className="rm-shell">
				<section className="rm-library-intro">
					<h2>Library</h2>
					<p className="rm-muted">
						ローカルに保持された文書のリスト。import で追加、読むで読書状態を復元します。
					</p>
					<DocumentImport onImported={handleImported} />
				</section>

				{loadError !== null && (
					<p className="rm-alert" role="alert" data-testid="rm-library-load-error">
						{loadError}
					</p>
				)}

				{renderBody()}
			</main>

			{pendingDelete !== null && (
				<ConfirmDialog
					title={`「${displayTitle(pendingDelete.document.metadata)}」を削除しますか？`}
					description={
						<>
							<p>
								この文書とファイル本体（{formatByteSize(pendingDelete.primarySource.byteSize)}
								）をブラウザから削除します。
							</p>
							<p>
								栞・ハイライト・メモ・読書進捗も同時に失われます。元に戻すことはできません。あとで
								読みたくなったら、同じファイルを再度 import してください。
							</p>
						</>
					}
					confirmLabel="削除する"
					busyLabel="削除中…"
					tone="danger"
					busy={deleting}
					errorMessage={deleteError}
					onConfirm={() => void confirmDelete()}
					onCancel={cancelDelete}
				/>
			)}
		</div>
	);
}
