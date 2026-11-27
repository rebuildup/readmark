/**
 * Component test for `<DocumentImport>` (#10 wiring).
 *
 * Coverage for #10 acceptance criteria:
 *   - When `readQuotaUsage` reports >= 90% used, the import does NOT
 *     run and an error is surfaced (#10 acceptance: "quota の 90%
 *     を超えた状態で import を試みるとエラー表示される").
 *   - On a successful import, `requestPersistenceIfNeeded` is called
 *     (#10 acceptance: "初回 import 後に persistent 要求が出る").
 *   - On a successful import, `onImported` fires with the typed
 *     success value (the contract the library screen depends on).
 *   - On a quota-exceeded import failure, `requestPersistenceIfNeeded`
 *     is NOT called — we only ask for persistence when we actually
 *     committed a write.
 *   - The persistence *answer* is reported to the parent only after
 *     the browser has actually answered, and is reported identically
 *     whether the browser grants or denies the request.
 *
 * Why the file picker is mocked, not rendered:
 *   - The `<input type="file">` opens the OS picker, which is not
 *     testable. We exercise `handleFile()` by directly invoking the
 *     React change handler with a synthetic `File`. The flow under
 *     test is everything between "file picked" and "import result
 *     surfaced", which is where the #10 wiring lives.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportError, ImportSuccess } from '../library/import-document.ts';
import { importPdfDocument } from '../library/import-document.ts';
import { readQuotaUsage, requestPersistenceIfNeeded } from '../platform/persistent-storage.ts';
import { DocumentImport } from './document-import.tsx';

vi.mock('../library/import-document.ts', () => ({
	importPdfDocument: vi.fn(),
}));

vi.mock('../platform/persistent-storage.ts', () => ({
	readQuotaUsage: vi.fn(),
	isQuotaOverThreshold: vi.fn((snapshot, threshold = 0.9) => {
		if (snapshot.quota <= 0) return false;
		return snapshot.usage / snapshot.quota >= threshold;
	}),
	requestPersistenceIfNeeded: vi.fn(),
}));

const mockImportPdfDocument = vi.mocked(importPdfDocument);
const mockReadQuotaUsage = vi.mocked(readQuotaUsage);
const mockRequestPersistence = vi.mocked(requestPersistenceIfNeeded);

function makeSuccess(): ImportSuccess {
	return {
		documentId: '00000000-0000-4000-8000-000000000001' as ImportSuccess['documentId'],
		sourceFingerprint: 'a'.repeat(64) as ImportSuccess['sourceFingerprint'],
		pageCount: 12,
		title: 'pre-flight doc',
	};
}

function renderImport(
	onImported?: (result: ImportSuccess) => void,
	onPersistenceSettled?: () => void,
) {
	const props: {
		onImported?: (result: ImportSuccess) => void;
		onPersistenceSettled?: () => void;
	} = {};
	if (onImported !== undefined) props.onImported = onImported;
	if (onPersistenceSettled !== undefined) props.onPersistenceSettled = onPersistenceSettled;
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
	mockReadQuotaUsage.mockReset();
	mockRequestPersistence.mockReset();
	// Default: quota is healthy so individual tests can opt into the
	// over-threshold path by overriding this mock.
	mockReadQuotaUsage.mockResolvedValue({
		usage: 100,
		quota: 10000,
		persistent: true,
	});
	mockRequestPersistence.mockResolvedValue(true);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('DocumentImport — #10 wiring', () => {
	it('calls importPdfDocument and onImported on success, then requests persistence', async () => {
		const onImported = vi.fn();
		const success = makeSuccess();
		mockImportPdfDocument.mockResolvedValueOnce({ ok: true, value: success });

		renderImport(onImported);
		pickFile(makeFile());

		await waitFor(() => expect(onImported).toHaveBeenCalledWith(success));
		expect(mockRequestPersistence).toHaveBeenCalledTimes(1);
		expect(await screen.findByTestId('rm-import-status')).toBeTruthy();
	});

	it('refuses the import when current usage is at the 90% threshold', async () => {
		mockReadQuotaUsage.mockResolvedValueOnce({
			usage: 9000,
			quota: 10000,
			persistent: false,
		});
		renderImport();
		pickFile(makeFile());

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('ストレージの容量が不足');
		// The import flow itself must NOT have been called — the
		// pre-flight refuses before we touch IndexedDB.
		expect(mockImportPdfDocument).not.toHaveBeenCalled();
		expect(mockRequestPersistence).not.toHaveBeenCalled();
	});

	it('refuses the import when current usage is above the 90% threshold', async () => {
		mockReadQuotaUsage.mockResolvedValueOnce({
			usage: 9500,
			quota: 10000,
			persistent: true,
		});
		renderImport();
		pickFile(makeFile());

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('ストレージの容量が不足');
		expect(mockImportPdfDocument).not.toHaveBeenCalled();
	});

	it('proceeds when readQuotaUsage rejects (unsupported browser)', async () => {
		// Private-mode / unsupported browsers make estimate() reject.
		// The pre-flight must not block on that; the storage layer
		// will surface a real quota-exceeded if it really is full.
		mockReadQuotaUsage.mockRejectedValueOnce(new Error('private mode'));
		mockImportPdfDocument.mockResolvedValueOnce({ ok: true, value: makeSuccess() });

		renderImport();
		pickFile(makeFile());

		await waitFor(() => expect(mockImportPdfDocument).toHaveBeenCalledTimes(1));
	});

	it('does not call requestPersistenceIfNeeded when the import fails', async () => {
		const quotaError: ImportError = {
			kind: 'quota-exceeded',
			cause: new Error('disk full'),
		};
		mockImportPdfDocument.mockResolvedValueOnce({ ok: false, error: quotaError });

		renderImport();
		pickFile(makeFile());

		await screen.findByRole('alert');
		expect(mockRequestPersistence).not.toHaveBeenCalled();
	});
});

describe('DocumentImport — persistence outcome is reported, not assumed', () => {
	it('signals the parent only after the browser has answered persist()', async () => {
		// The badge must not re-read `persisted()` before the browser
		// answers. Hold the request open and assert the signal has
		// NOT fired, so the badge cannot render a stale verdict.
		let answerPersist: ((granted: boolean) => void) | undefined;
		mockRequestPersistence.mockReturnValue(
			new Promise<boolean>((resolve) => {
				answerPersist = resolve;
			}),
		);
		mockImportPdfDocument.mockResolvedValueOnce({ ok: true, value: makeSuccess() });

		const onImported = vi.fn();
		const onPersistenceSettled = vi.fn();
		renderImport(onImported, onPersistenceSettled);
		pickFile(makeFile());

		// The list refresh is not blocked on the answer — `persist()`
		// may show a prompt, and the reader's new row should appear
		// without waiting for it.
		await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
		// ...but the persistence verdict has not been delivered yet.
		expect(onPersistenceSettled).not.toHaveBeenCalled();

		answerPersist?.(true);
		await waitFor(() => expect(onPersistenceSettled).toHaveBeenCalledTimes(1));
	});

	it('still signals the parent when the browser denies persistence', async () => {
		// A denial is the common case (headless Chromium denies it
		// outright). It must be reported the same way as a grant —
		// the callback carries no opinion, and the badge re-reads
		// `persisted()` to learn the truth.
		mockRequestPersistence.mockResolvedValueOnce(false);
		mockImportPdfDocument.mockResolvedValueOnce({ ok: true, value: makeSuccess() });

		const onPersistenceSettled = vi.fn();
		renderImport(vi.fn(), onPersistenceSettled);
		pickFile(makeFile());

		await waitFor(() => expect(onPersistenceSettled).toHaveBeenCalledTimes(1));
	});

	it('does not signal the parent when the import never succeeded', async () => {
		mockRequestPersistence.mockResolvedValueOnce(true);
		mockImportPdfDocument.mockResolvedValueOnce({
			ok: false,
			error: { kind: 'invalid-pdf', cause: new Error('corrupt') },
		});

		const onPersistenceSettled = vi.fn();
		renderImport(vi.fn(), onPersistenceSettled);
		pickFile(makeFile());

		await screen.findByRole('alert');
		expect(onPersistenceSettled).not.toHaveBeenCalled();
	});
});
