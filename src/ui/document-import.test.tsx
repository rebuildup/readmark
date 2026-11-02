/**
 * Component test for `<DocumentImport>`.
 *
 * Coverage:
 *   - On a successful import, `onImported` fires with the typed
 *     success value (the contract the library screen depends on) and
 *     the status line renders.
 *   - A typed failure (`invalid-pdf` / `unknown`) surfaces as an
 *     alert with the message the switch produces.
 *   - A rejected flow (which the `Result` contract says cannot
 *     happen) still ends in an alert rather than a stuck spinner.
 *
 * ADR-0008 removed what this file used to cover alongside those:
 * the quota pre-flight (no storage, no quota) and the
 * `requestPersistenceIfNeeded` call after a commit (nothing to make
 * persistent). `#10`'s acceptance criteria died with them.
 *
 * Why the file picker is mocked, not rendered:
 *   - The `<input type="file">` opens the OS picker, which is not
 *     testable. We exercise `handleFile()` by directly invoking the
 *     React change handler with a synthetic `File`. The flow under
 *     test is everything between "file picked" and "import result
 *     surfaced".
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportSuccess } from '../library/import-document.ts';
import { importPdfDocument } from '../library/import-document.ts';
import { DocumentImport } from './document-import.tsx';

vi.mock('../library/import-document.ts', () => ({
	importPdfDocument: vi.fn(),
}));

const mockImportPdfDocument = vi.mocked(importPdfDocument);

function makeSuccess(): ImportSuccess {
	return {
		documentId: '00000000-0000-4000-8000-000000000001' as ImportSuccess['documentId'],
		sourceFingerprint: 'a'.repeat(64) as ImportSuccess['sourceFingerprint'],
		pageCount: 12,
		title: 'a document',
	};
}

function renderImport(onImported?: (result: ImportSuccess) => void) {
	const props: { onImported?: (result: ImportSuccess) => void } = {};
	if (onImported !== undefined) props.onImported = onImported;
	return render(
		<MemoryRouter>
			<DocumentImport {...props} />
		</MemoryRouter>,
	);
}

function makeFile(): File {
	// Bytes do not matter; the import flow is mocked. The File shape
	// is what `handleFile()` consumes.
	return new File(['pretend-this-is-a-pdf'], 'doc.pdf', { type: 'application/pdf' });
}

function pickFile(file: File) {
	const input = screen.getByTestId('rm-document-import-input');
	fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
	mockImportPdfDocument.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('DocumentImport', () => {
	it('calls importPdfDocument and onImported on success, then shows the status', async () => {
		const onImported = vi.fn();
		const success = makeSuccess();
		mockImportPdfDocument.mockResolvedValueOnce({ ok: true, value: success });

		renderImport(onImported);
		pickFile(makeFile());

		await waitFor(() => expect(onImported).toHaveBeenCalledWith(success));
		expect(await screen.findByTestId('rm-import-status')).toBeTruthy();
		// The success copy names the page count the flow computed —
		// the library's immediate feedback contract.
		expect(screen.getByTestId('rm-import-status').textContent).toContain('12 ページ');
	});

	it('surfaces an invalid PDF as the typed alert', async () => {
		mockImportPdfDocument.mockResolvedValueOnce({
			ok: false,
			error: { kind: 'invalid-pdf', cause: new Error('not a pdf') },
		});

		renderImport();
		pickFile(makeFile());

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('PDF として開けませんでした');
	});

	it('surfaces an unknown failure as the generic alert', async () => {
		mockImportPdfDocument.mockResolvedValueOnce({
			ok: false,
			error: { kind: 'unknown', cause: new Error('boom') },
		});

		renderImport();
		pickFile(makeFile());

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('取り込みに失敗しました');
	});

	it('ends in an alert when the flow rejects, which the Result contract forbids', async () => {
		// Defensive: `importPdfDocument()` is typed to return a
		// `Result` and never throws. If a future change breaks that
		// contract, leaving the busy spinner spinning is worse than
		// surfacing a generic message.
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockImportPdfDocument.mockRejectedValueOnce(new Error('contract broken'));

		renderImport();
		pickFile(makeFile());

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('取り込みに失敗しました');
		expect(spy).toHaveBeenCalled();
	});
});
