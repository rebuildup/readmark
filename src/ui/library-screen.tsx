/**
 * readmark — Library screen.
 *
 * The library list is a JOIN over `documents` + their primary
 * `documentSources`, surfaced through `listLibrary()` as
 * `LibraryEntry`. We deliberately keep Document and DocumentSource
 * separate at the data layer; the join lives in the repository,
 * not in the screen.
 *
 * The screen owns only:
 *   - The mount of `<DocumentImport>`.
 *   - The trigger to re-fetch `listLibrary()` after an import
 *     (so the new entry appears without a manual reload).
 *
 * The actual import flow (`extractPdfMetadata` → `importDocument`)
 * lives in `src/library/import-document.ts`. The React shell for
 * the file picker lives in `<DocumentImport>`.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { ImportSuccess } from '../library/import-document.ts';
import type { LibraryEntry } from '../storage/documents-repo.ts';
import { listLibrary } from '../storage/documents-repo.ts';
import { DocumentImport } from './document-import.tsx';
import { Button } from './primitives/button.tsx';

export function LibraryScreen() {
	const [entries, setEntries] = useState<readonly LibraryEntry[] | null>(null);

	const refresh = useCallback(() => {
		listLibrary()
			.then(setEntries)
			.catch((err: unknown) => {
				console.error('listLibrary failed', err);
				setEntries([]);
			});
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handleImported = useCallback(
		(_result: ImportSuccess) => {
			// Re-fetch the library so the new entry shows up.
			refresh();
		},
		[refresh],
	);

	return (
		<div className="rm-app">
			<header
				style={{
					padding: '16px 24px',
					borderBottom: '1px solid var(--rm-border)',
					background: 'var(--rm-bg-surface)',
				}}
			>
				<h1 style={{ margin: 0, fontSize: 20 }}>readmark</h1>
			</header>

			<main className="rm-shell">
				<section style={{ marginBottom: 32 }}>
					<h2 style={{ fontSize: 24 }}>Library</h2>
					<p style={{ color: 'var(--rm-fg-muted)', marginTop: 0 }}>
						ローカルに保持された文書のリスト。import で追加、クリックで読書状態を復元します。
					</p>
					<DocumentImport onImported={handleImported} />
				</section>

				<section>
					{entries === null ? (
						<p style={{ color: 'var(--rm-fg-muted)' }}>読み込み中…</p>
					) : entries.length === 0 ? (
						<p style={{ color: 'var(--rm-fg-muted)' }}>
							ライブラリは空です。上のボタンから文書を追加してください。
						</p>
					) : (
						<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
							{entries.map(({ document, primarySource }) => (
								<li
									key={document.id}
									style={{
										padding: '12px 16px',
										borderBottom: '1px solid var(--rm-border)',
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
									}}
								>
									<div>
										<div style={{ fontWeight: 500 }}>
											{document.metadata.title || '(タイトルなし)'}
										</div>
										<div style={{ color: 'var(--rm-fg-muted)', fontSize: 14 }}>
											{document.metadata.author || '(著者なし)'} ・{' '}
											{primarySource.format.toUpperCase()} ・{' '}
											{(primarySource.byteSize / 1024 / 1024).toFixed(1)} MB
										</div>
									</div>
									<Link to={`/read/${document.id}`}>
										<Button variant="secondary">読む</Button>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</div>
	);
}
