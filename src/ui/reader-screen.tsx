/**
 * readmark — Reader screen.
 *
 * MVP shell: shows the URL parameter for the document id and a
 * placeholder for the renderer. The real pdfjs-dist wiring lands in
 * the first reader ticket after init.
 *
 * The route uses `documentId` (logical) — the renderer later asks
 * storage for the blob by `sourceFingerprint` (physical) once the
 * Document is loaded.
 */

import { Link, useParams } from 'react-router-dom';
import { Button } from './primitives/button.tsx';

export function ReaderScreen() {
	const { documentId } = useParams<{ documentId: string }>();

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
					{documentId ? documentId.slice(0, 8) : '(no document)'}
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
					<p>
						PDF レンダラーはこの shell のあとに最初の feature ticket
						で実装されます。今は座組みだけがここにあります。
					</p>
				</div>
			</main>
		</div>
	);
}
