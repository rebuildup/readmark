/**
 * readmark — Reader screen.
 *
 * MVP shell: resolves the DocumentId route param to a Document +
 * primary DocumentSource + DocumentBlob, then shows the URL
 * parameter for the document id and a placeholder for the renderer.
 * The real pdfjs-dist wiring lands in the first reader ticket after
 * init.
 *
 * Resolution order:
 *   1. `getDocument(documentId)`            — metadata only.
 *   2. `getPrimarySource(documentId)`       — physical identity.
 *   3. `getDocumentBlob(sourceFingerprint)` — bytes.
 * If any step returns null, the reader surfaces a recovery flow
 * (re-import). The MVP shows the empty state for now.
 *
 * On a successful open, the screen calls `touchLastReadAt(id)` so
 * the library re-sorts correctly on next visit.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DocumentId } from '../domain/document.ts';
import { asDocumentId } from '../domain/document.ts';
import {
	getDocument,
	getDocumentBlob,
	getPrimarySource,
	touchLastReadAt,
} from '../storage/documents-repo.ts';
import { Button } from './primitives/button.tsx';

type ReaderLoadState =
	| { kind: 'loading' }
	| { kind: 'ready'; documentId: DocumentId }
	| { kind: 'not-found' }
	| { kind: 'missing-blob' };

export function ReaderScreen() {
	const { documentId: rawId } = useParams<{ documentId: string }>();

	const [state, setState] = useState<ReaderLoadState>({ kind: 'loading' });

	useEffect(() => {
		if (!rawId) {
			setState({ kind: 'not-found' });
			return;
		}
		let cancelled = false;

		(async () => {
			try {
				const id = asDocumentId(rawId);
				const doc = await getDocument(id);
				if (cancelled) return;
				if (!doc) {
					setState({ kind: 'not-found' });
					return;
				}
				const source = await getPrimarySource(id);
				if (cancelled) return;
				if (!source) {
					setState({ kind: 'not-found' });
					return;
				}
				const blob = await getDocumentBlob(source.sourceFingerprint);
				if (cancelled) return;
				if (!blob) {
					setState({ kind: 'missing-blob' });
					return;
				}
				await touchLastReadAt(id);
				if (cancelled) return;
				setState({ kind: 'ready', documentId: id });
			} catch (err) {
				console.error(err);
				if (!cancelled) setState({ kind: 'not-found' });
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [rawId]);

	return (
		<div className="rm-app">
			<header
				style={{
					padding: '12px 24px',
					borderBottom: '1px solid var(--rm-border)',
					background: 'var(--rm-bg-surface)',
					display: 'flex',
					alignItems: 'center',
					gap: 16,
				}}
			>
				<Link to="/">
					<Button variant="ghost">← Library</Button>
				</Link>
				<h1 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--rm-font-mono)' }}>
					{state.kind === 'ready' ? state.documentId.slice(0, 8) : '(no document)'}
				</h1>
			</header>

			<main className="rm-shell" style={{ display: 'grid', placeItems: 'center', minHeight: 0 }}>
				<div
					style={{
						border: '1px dashed var(--rm-border-strong)',
						borderRadius: 'var(--rm-radius-lg)',
						padding: 48,
						textAlign: 'center',
						color: 'var(--rm-fg-muted)',
						maxWidth: 480,
					}}
				>
					<h2 style={{ marginTop: 0 }}>Reader</h2>
					{state.kind === 'loading' && <p>文書を読み込み中…</p>}
					{state.kind === 'not-found' && (
						<p>指定された Document が見つかりません。Library から開き直してください。</p>
					)}
					{state.kind === 'missing-blob' && (
						<p>
							文書のメタデータはありますが bytes が利用できません（eviction された可能性）。 再
							import が必要です。
						</p>
					)}
					{state.kind === 'ready' && (
						<p>
							PDF レンダラーはこの shell のあとに最初の feature ticket
							で実装されます。今は座組みだけがここにあります。
						</p>
					)}
				</div>
			</main>
		</div>
	);
}
