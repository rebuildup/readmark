/**
 * readmark — Reader screen.
 *
 * Resolves the `DocumentId` route param to bytes and hands them to the
 * PDF reader; owns the "this document cannot be opened" states and the
 * library hand-back. It does not own rendering — that is
 * `<ReaderView>`, which only ever sees the format-agnostic
 * `ReaderHandle<'pdf'>`.
 *
 * Resolution order (each step is a separate question, and the UI has
 * to answer them differently):
 *   1. `getDocument(documentId)`            — is the logical book known?
 *   2. `getPrimarySource(documentId)`       — is there a file attached?
 *   3. `getDocumentBlob(sourceFingerprint)` — are the bytes still here?
 *      They can be gone: the bytes live in their own store precisely so
 *      they can be evicted (ADR-0005), and a reader that hit the empty
 *      state without saying "re-import" would look like data loss.
 *   4. `createPdfReader().open(...)`       — pdf.js takes the bytes.
 *
 * The reader module is imported dynamically: pdf.js is the largest
 * thing in the bundle, and the Library route must not pay for it
 * before a document is opened.
 *
 * Teardown: a source change or an unmount closes the handle, which
 * cancels in-flight renders and destroys the document. Without it a
 * render can land against a destroyed document, and the pdf.js worker
 * survives the route.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { asDocumentId, type DocumentId } from '../domain/document.ts';
import type { ReaderHandle } from '../reader/types.ts';
import {
	getDocument,
	getDocumentBlob,
	getPrimarySource,
	touchLastReadAt,
} from '../storage/documents-repo.ts';
import { LibraryLink } from './primitives/library-link.tsx';
import { ReaderView } from './reader-view.tsx';

type ReaderState =
	| { kind: 'loading' }
	| { kind: 'not-found' }
	| { kind: 'missing-blob' }
	| { kind: 'open-failed' }
	| {
			kind: 'ready';
			handle: ReaderHandle<'pdf'>;
			pageCount: number;
			title: string;
	  };

export function ReaderScreen() {
	const { documentId: rawId } = useParams<{ documentId: string }>();
	const [state, setState] = useState<ReaderState>({ kind: 'loading' });

	useEffect(() => {
		if (!rawId) {
			setState({ kind: 'not-found' });
			return;
		}
		let cancelled = false;
		let opened: ReaderHandle<'pdf'> | null = null;

		void (async () => {
			try {
				// A malformed id is a bad URL, not a broken document:
				// saying "this PDF will not open" for a typo in the
				// address bar sends the reader looking in the wrong
				// place.
				let id: DocumentId;
				try {
					id = asDocumentId(rawId);
				} catch {
					setState({ kind: 'not-found' });
					return;
				}
				const document = await getDocument(id);
				if (cancelled) return;
				if (document === null) {
					setState({ kind: 'not-found' });
					return;
				}
				const source = await getPrimarySource(id);
				if (cancelled) return;
				if (source === null) {
					setState({ kind: 'not-found' });
					return;
				}
				const blob = await getDocumentBlob(source.sourceFingerprint);
				if (cancelled) return;
				if (blob === null) {
					setState({ kind: 'missing-blob' });
					return;
				}
				const { createPdfReader } = await import('../reader/pdf/index.ts');
				if (cancelled) return;
				const handle = await createPdfReader().open({
					source: source as typeof source & { readonly format: 'pdf' },
					blob,
				});
				if (cancelled) {
					// Navigated away while pdf.js was parsing. Closing
					// here is the only thing that stops the worker.
					await handle.close();
					return;
				}
				opened = handle;
				const pageCount = await handle.pageCount();
				if (cancelled) return;
				// `lastReadAt` means "this source was opened", not
				// "this file was looked at": a corrupt or
				// password-protected PDF that never opened must not
				// float to the top of the library's recently-read
				// order. After the page count, so a document that
				// cannot be opened stays out of that list.
				await touchLastReadAt(id);
				if (cancelled) return;
				setState({
					kind: 'ready',
					handle,
					pageCount,
					title: document.metadata.title ?? '(タイトルなし)',
				});
			} catch (error: unknown) {
				console.error('readmark: reader failed to open', error);
				if (!cancelled) setState({ kind: 'open-failed' });
			}
		})();

		return () => {
			cancelled = true;
			// `close()` is idempotent and owns the whole teardown.
			void opened?.close();
		};
	}, [rawId]);

	// Ready documents get their own shell (header with toolbar plus the
	// scroll container), so the two never render two headers.
	if (state.kind === 'ready') {
		return <ReaderView handle={state.handle} pageCount={state.pageCount} title={state.title} />;
	}

	return (
		<div className="rm-app">
			<header className="rm-reader-header">
				<LibraryLink testId="rm-reader-back" />
				<h1 className="rm-reader-header__title">Reader</h1>
			</header>

			<main className="rm-reader-scroll">
				<div className="rm-reader-empty" data-testid="rm-reader-state">
					{state.kind === 'loading' && <p>文書を読み込み中…</p>}
					{state.kind === 'not-found' && (
						<p>指定された Document が見つかりません。Library から開き直してください。</p>
					)}
					{state.kind === 'missing-blob' && (
						<p>
							文書のメタデータはありますが、ファイル本体が利用できません（ブラウザの容量整理で
							削除された可能性があります）。同じファイルを再度 import してください。
						</p>
					)}
					{state.kind === 'open-failed' && (
						<p>この PDF を開けませんでした。破損ファイルまたはパスワード保護的文件です。</p>
					)}
				</div>
			</main>
		</div>
	);
}
