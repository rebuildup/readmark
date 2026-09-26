/**
 * readmark — `<DocumentImport>` React UI.
 *
 * Single responsibility:
 *   - Render a file picker + import button.
 *   - Hand the picked `Blob` to `importPdfDocument()`.
 *   - Surface typed `ImportError` as user-readable messages.
 *   - Tell the parent when an import succeeds (so the library
 *     list can refresh).
 *
 * Why this is a separate component from `library-screen.tsx`:
 *   - AGENTS.md §3 boundary: `library/` = flows, `ui/` = screens.
 *     The flow (`src/library/import-document.ts`) is React-agnostic;
 *     this component is the React shell that wraps it.
 *   - The picker + busy/error states are reusable; future
 *     drag-drop or URL-paste flows can mount the same component
 *     or a thinner variant.
 *
 * Why `input.value = ''` after every change:
 *   - If the user picks the same PDF twice in a row (e.g. to
 *     confirm a stale state), the browser suppresses the
 *     `change` event when `value` is unchanged. Resetting to
 *     `''` forces the event to fire again.
 *   - ADR / common gotcha — without this reset, "import the
 *     same file" silently does nothing.
 *
 * Why we use a ref for the input:
 *   - The reset on `input.value` must happen synchronously in
 *     the `change` handler. We need to write to the DOM node
 *     directly; controlled-input round-tripping via React
 *     state is overkill for a one-shot file picker.
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ImportError, ImportSuccess } from '../library/import-document.ts';
import { importPdfDocument } from '../library/import-document.ts';
import { Button } from './primitives/button.tsx';

interface DocumentImportProps {
	/** Called after a successful import. The library screen
	 *  uses this to refresh its list. */
	onImported?: (result: ImportSuccess) => void;
	/** Where to send the user after a successful import.
	 *  Default: stay on the library screen so they see the
	 *  new entry. Pass `/read/{id}` to jump straight in. */
	navigateOnSuccess?: 'library' | 'reader';
}

export function DocumentImport({ onImported, navigateOnSuccess = 'library' }: DocumentImportProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<ImportError | null>(null);
	const [lastImport, setLastImport] = useState<ImportSuccess | null>(null);
	const navigate = useNavigate();

	async function handleFile(file: File) {
		setBusy(true);
		setError(null);
		setLastImport(null);
		// Force a microtask boundary so React commits `busy=true`
		// before the import's first await. Without this, React 19's
		// automatic batching may collapse setBusy(true) and the
		// downstream state changes into one render commit for
		// sub-frame imports — the smoke (`scripts/smoke-import.mjs`)
		// would never observe aria-busy="true" long enough to prove
		// the change handler actually ran.
		await Promise.resolve();
		try {
			const result = await importPdfDocument(file);
			if (result.ok) {
				setLastImport(result.value);
				onImported?.(result.value);
				if (navigateOnSuccess === 'reader') {
					navigate(`/read/${result.value.documentId}`);
				}
			} else {
				setError(result.error);
			}
		} finally {
			setBusy(false);
		}
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		// Always reset so re-selecting the same file fires `change`.
		e.target.value = '';
		if (!file) return;
		void handleFile(file);
	}

	function handleButtonClick() {
		inputRef.current?.click();
	}

	const buttonLabel = busy ? 'import 中…' : 'PDF を import';

	return (
		<div className="rm-document-import">
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf"
				onChange={handleChange}
				disabled={busy}
				style={{ display: 'none' }}
				data-testid="rm-document-import-input"
			/>
			<Button
				variant="primary"
				onClick={handleButtonClick}
				disabled={busy}
				aria-busy={busy}
				data-testid="rm-import-button"
			>
				{buttonLabel}
			</Button>

			{error !== null && (
				<div
					role="alert"
					style={{
						marginTop: 12,
						padding: '8px 12px',
						border: '1px solid var(--rm-error)',
						borderRadius: 'var(--rm-radius-md)',
						background: 'var(--rm-error-bg)',
						color: 'var(--rm-error-fg)',
						fontSize: 14,
					}}
				>
					{errorMessage(error)}
				</div>
			)}

			{lastImport !== null && error === null && (
				<div
					role="status"
					data-testid="rm-import-status"
					style={{
						marginTop: 12,
						padding: '8px 12px',
						border: '1px solid var(--rm-border)',
						borderRadius: 'var(--rm-radius-md)',
						background: 'var(--rm-bg-surface)',
						color: 'var(--rm-fg-muted)',
						fontSize: 14,
					}}
				>
					{lastImport.title ?? '(タイトルなし)'} — {lastImport.pageCount} ページを取り込みました
				</div>
			)}
		</div>
	);
}

function errorMessage(err: ImportError): string {
	switch (err.kind) {
		case 'invalid-pdf':
			return 'このファイルは PDF として開けませんでした。破損ファイルまたはパスワード保護ではないかご確認ください。';
		case 'quota-exceeded':
			return 'ストレージの容量が不足しています。既存の文書を削除してから再度お試しください。';
		case 'unsupported-format':
			// Reserved for the post-MVP formats. Today the picker
			// already filters by accept="application/pdf", so
			// this branch should not be reachable — surface a
			// generic message anyway.
			return 'この形式はサポートされていません。';
		case 'unknown':
			return '取り込みに失敗しました。時間をおいて再度お試しください。';
	}
}
