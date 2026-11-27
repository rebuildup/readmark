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
import {
	isQuotaOverThreshold,
	readQuotaUsage,
	requestPersistenceIfNeeded,
} from '../platform/persistent-storage.ts';
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
		// A microtask boundary so React commits `busy=true` before
		// the import's first await; without this, sub-frame imports
		// would collapse the state changes into one render commit
		// and the smoke would never observe aria-busy="true".
		await Promise.resolve();

		// Pre-flight quota check (#10 acceptance: importing while the
		// origin is at >= 90% of its quota must surface an error
		// before we touch IndexedDB). If `readQuotaUsage` rejects
		// (private mode / unsupported browser), proceed; the actual
		// storage write will surface a real `quota-exceeded` error if
		// the origin is genuinely full.
		try {
			const snapshot = await readQuotaUsage();
			if (isQuotaOverThreshold(snapshot)) {
				setError({
					kind: 'quota-exceeded',
					cause: new Error('quota over 90% before import'),
				});
				setBusy(false);
				return;
			}
		} catch {
			// Proceed; the storage layer will catch genuine failures.
		}

		try {
			const result = await importPdfDocument(file);
			if (result.ok) {
				setLastImport(result.value);
				// Ask for persistent storage once per tab. Wrapped in
				// `void` because the reader does not need to see the
				// outcome — the badge in the library header reflects it
				// after the next refresh.
				void requestPersistenceIfNeeded();
				onImported?.(result.value);
				if (navigateOnSuccess === 'reader') {
					navigate(`/read/${result.value.documentId}`);
				}
			} else {
				setError(result.error);
			}
		} catch (thrown: unknown) {
			// Defensive: `importPdfDocument()` is typed to return a
			// `Result` and never throws. If a future change breaks
			// that contract, leaving the busy spinner spinning is
			// worse than surfacing a generic message.
			console.error('readmark: import threw unexpectedly', thrown);
			setError({ kind: 'unknown', cause: thrown });
		} finally {
			setBusy(false);
		}
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		// Reset so re-selecting the same file fires `change`.
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
				className="rm-document-import__input"
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
				<p className="rm-alert rm-alert--spaced" role="alert">
					{errorMessage(error)}
				</p>
			)}

			{lastImport !== null && error === null && (
				<p className="rm-status" role="status" data-testid="rm-import-status">
					{lastImport.title ?? '(タイトルなし)'} — {lastImport.pageCount} ページを取り込みました
				</p>
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
			// Reachable: the picker's `accept` is a hint, not a gate.
			// A renamed `.pdf`, a drag-drop, or an "All files"
			// selection all land here, and the advice differs from
			// the invalid-pdf branch — this file is not a damaged
			// PDF, it is not a PDF at all.
			return 'この形式はサポートされていません。PDF ファイルを選択してください。';
		case 'unknown':
			return '取り込みに失敗しました。時間をおいて再度お試しください。';
		default: {
			// Exhaustive guard: a future kind added to `ImportError`
			// would be silently dropped without this. The reader
			// gets a generic message; the developer gets a typed
			// compiler error at the call site above.
			const _exhaustive: never = err;
			return _exhaustive;
		}
	}
}
