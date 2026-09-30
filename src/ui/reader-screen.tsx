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
 *      And is its format one we can open? `isFormatSource(source, 'pdf')`
 *      narrows the discriminated `DocumentFormat` so the cast the
 *      reader entry point needs is a real boolean test, not a structural
 *      lie (`source as ... & { format: 'pdf' }`). A future EPUB /
 *      Markdown / text reader adds a branch here, not a cast.
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
 * `touchLastReadAt` is fired-and-forgotten after `state = ready`:
 * the reader is already usable and the "this source was opened"
 * timestamp is bookkeeping. Letting the reject path leak a working
 * reader back to `open-failed` would punish the user for a storage
 * hiccup that the library will recover from on its own. The promise
 * is logged and swallowed.
 *
 * Teardown: a source change or an unmount closes the handle, which
 * cancels in-flight renders and destroys the document. Without it a
 * render can land against a destroyed document, and the pdf.js worker
 * survives the route.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
	asDocumentId,
	type DocumentId,
	isFormatSource,
	type SourceFingerprint,
} from '../domain/document.ts';
import type { PageIndex, ReadingProgress } from '../domain/reading-state.ts';
import { PdfInvalidError } from '../reader/pdf/pdf-errors.ts';
import type { ScrollPosition } from '../reader/position.ts';
import type { ReaderHandle } from '../reader/types.ts';
import {
	getDocument,
	getDocumentBlob,
	getPrimarySource,
	touchLastReadAt,
} from '../storage/documents-repo.ts';
import { getReadingProgress } from '../storage/reading-state-repo.ts';
import { LibraryLink } from './primitives/library-link.tsx';
import { ReaderView } from './reader-view.tsx';

type ReaderState =
	| { kind: 'loading' }
	| { kind: 'not-found' }
	| { kind: 'missing-blob' }
	| { kind: 'unsupported-format'; format: string }
	| { kind: 'invalid-pdf' }
	| { kind: 'open-failed' }
	| {
			kind: 'ready';
			handle: ReaderHandle<'pdf'>;
			pageCount: number;
			title: string;
			documentId: DocumentId;
			sourceFingerprint: SourceFingerprint;
			/** Where this reader was last time. `null` for a first
			 *  read, which is not an error. */
			storedPosition: {
				readonly currentPage: PageIndex;
				readonly position: ScrollPosition;
			} | null;
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
		// The previous document is on screen while this one opens. Show
		// the loading state instead: a reader who follows a link to
		// another document should not be looking at the old one.
		setState({ kind: 'loading' });

		void (async () => {
			// A malformed id is a bad URL, not a broken document:
			// saying "this PDF will not open" for a typo in the
			// address bar sends the reader looking in the wrong
			// place.
			let id: DocumentId;
			try {
				id = asDocumentId(rawId);
			} catch {
				if (!cancelled) setState({ kind: 'not-found' });
				return;
			}
			try {
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
				if (!isFormatSource(source, 'pdf')) {
					// A non-PDF source routed here: an EPUB / Markdown
					// / text reader is post-MVP, so the UI surfaces
					// it rather than silently failing as a PDF.
					setState({ kind: 'unsupported-format', format: source.format });
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
				const handle = await createPdfReader().open({ source, blob });
				if (cancelled) {
					// Navigated away while pdf.js was parsing. Closing
					// here is the only thing that stops the worker.
					await handle.close();
					return;
				}
				opened = handle;
				const pageCount = await handle.pageCount();
				if (cancelled) {
					await handle.close();
					return;
				}
				// Read before rendering the view: a restore that runs
				// after the first paint would be a visible jump.
				const progress = await getReadingProgress({
					documentId: id,
					sourceFingerprint: source.sourceFingerprint,
				});
				if (cancelled) {
					await handle.close();
					return;
				}
				setState({
					kind: 'ready',
					handle,
					pageCount,
					title: document.metadata.title ?? '(タイトルなし)',
					documentId: id,
					sourceFingerprint: source.sourceFingerprint,
					storedPosition: readStoredPosition(progress, pageCount),
				});
				// Fire-and-forget: `lastReadAt` means "this source
				// was opened", not "this file was looked at". A
				// corrupt or password-protected PDF that never
				// opened must not float to the top of the library's
				// recently-read order. After the page count, so a
				// document that cannot be opened stays out of that
				// list. The reader is already usable; failing here
				// must not take a working reader back to
				// `open-failed`.
				void touchLastReadAt(id).catch((error: unknown) => {
					console.error('readmark: could not touch lastReadAt', error);
				});
			} catch (error: unknown) {
				// Already-open handle: close before reporting the
				// failure so the pdf.js worker is not leaked across
				// the route.
				if (opened !== null) await opened.close();
				console.error('readmark: reader failed to open', error);
				if (cancelled) return;
				if (error instanceof PdfInvalidError) {
					setState({ kind: 'invalid-pdf' });
				} else {
					setState({ kind: 'open-failed' });
				}
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
		return (
			// Keyed by the source identity. React reuses the component
			// for a new `/read/:documentId`, and this view's refs carry
			// per-document state: which pages have been rendered, which
			// sizes were measured, and whether the stored position has
			// been restored. Without the key, the second document would
			// inherit the first one's "already restored" flag and never
			// restore its own — and would keep the first one's page
			// measurements, which are that document's pages.
			<ReaderView
				key={`${state.documentId}:${state.sourceFingerprint}`}
				handle={state.handle}
				pageCount={state.pageCount}
				title={state.title}
				documentId={state.documentId}
				sourceFingerprint={state.sourceFingerprint}
				initialPosition={state.storedPosition}
			/>
		);
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
					{state.kind === 'unsupported-format' && (
						<p>
							この文書は <code>{state.format}</code> 形式です。MVP は PDF のみ対応しています。
						</p>
					)}
					{state.kind === 'invalid-pdf' && (
						<p>この PDF は破損しているか、パスワードで保護されているため開けません。</p>
					)}
					{state.kind === 'open-failed' && (
						<p>この PDF を開けませんでした。時間をおいて再度お試しください。</p>
					)}
				</div>
			</main>
		</div>
	);
}

/**
 * Read a stored position into the shape the view restores from.
 *
 * A stored `position` that is not one of ours, and a stored page
 * outside this document's range, are both treated as "no position":
 * the reader opens at the top, which is a smaller failure than
 * scrolling to a page that is not there — and than leaving the view
 * waiting for one that never arrives.
 *
 * `position === null` does NOT mean "no position": the page index is
 * the field that survives and the offset is advisory (ADR-0002 /
 * reading-state-repo.ts). A stored `currentPage` with a `null`
 * position restores to the top of that page, which is the right
 * default for a freshly-imported document whose first save fires
 * before any scroll.
 *
 * Out-of-band ratios (negative or `> 1`) are also "no position": the
 * saved value is corrupt, and silently coercing it would hide the
 * corruption from the next save.
 */
function readStoredPosition(
	progress: ReadingProgress | null,
	pageCount: number,
): { readonly currentPage: PageIndex; readonly position: ScrollPosition } | null {
	if (progress === null) return null;
	if (progress.currentPage < 1 || progress.currentPage > pageCount) return null;
	const ratio = progress.position?.pageOffsetRatio;
	if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
		// Page index is valid, offset is not — restore to the top
		// of the stored page rather than discarding the page too.
		return { currentPage: progress.currentPage, position: { pageOffsetRatio: 0 } };
	}
	if (ratio < 0 || ratio > 1) return null;
	return {
		currentPage: progress.currentPage,
		position: { pageOffsetRatio: ratio },
	};
}
