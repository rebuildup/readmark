/**
 * readmark — Library screen.
 *
 * MVP shell: lists the user's library and shows the import button
 * (disabled until the file picker is wired). The full import UI lands
 * in the first feature ticket after init.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Document } from '../domain/document.ts';
import { listDocuments } from '../storage/documents-repo.ts';
import { Button } from './primitives/button.tsx';

export function LibraryScreen() {
	const [documents, setDocuments] = useState<readonly Document[] | null>(null);

	useEffect(() => {
		listDocuments().then(setDocuments).catch(console.error);
	}, []);

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
					<Button variant="primary" disabled aria-disabled="true">
						PDF を import（MVP で有効化）
					</Button>
				</section>

				<section>
					{documents === null ? (
						<p style={{ color: 'var(--rm-fg-muted)' }}>読み込み中…</p>
					) : documents.length === 0 ? (
						<p style={{ color: 'var(--rm-fg-muted)' }}>
							ライブラリは空です。上のボタンから文書を追加してください。
						</p>
					) : (
						<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
							{documents.map((doc) => (
								<li
									key={doc.id}
									style={{
										padding: '12px 16px',
										borderBottom: '1px solid var(--rm-border)',
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
									}}
								>
									<div>
										<div style={{ fontWeight: 500 }}>{doc.metadata.title || '(タイトルなし)'}</div>
										<div style={{ color: 'var(--rm-fg-muted)', fontSize: 14 }}>
											{doc.metadata.author || '(著者なし)'} ・ {doc.format.toUpperCase()} ・{' '}
											{(doc.byteSize / 1024 / 1024).toFixed(1)} MB
										</div>
									</div>
									<Link to={`/read/${doc.id}`}>
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
