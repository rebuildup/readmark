/**
 * Unit tests for the library import flow.
 *
 * Coverage:
 *   1. Happy path: real PDF bytes → `ok: true` with metadata.
 *   2. Invalid PDF: corrupt bytes → `ok: false, kind: 'invalid-pdf'`.
 *   3. Quota error: storage layer raises → `ok: false, kind: 'quota-exceeded'`.
 *   4. Unknown error: anything else → `ok: false, kind: 'unknown'`.
 *
 * Why we mock the storage layer:
 *   - The repository writes to IndexedDB through Dexie.
 *   - The repo does not own a real DB in unit tests (no
 *     fake-indexeddb in this MVP).
 *   - We mock at the `documents-repo` boundary so the test
 *     covers the error-normalization logic of `importPdfDocument`
 *     without exercising storage.
 *
 * Why we keep the real PDF metadata path:
 *   - The "real PDF loads" smoke lives in
 *     `src/reader/pdf/pdf-metadata.test.ts`. Here we want to
 *     prove that `importPdfDocument` calls it correctly and
 *     threads the result into the success value, so we use a
 *     real 1-page PDF and only mock the storage call.
 */

import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId } from '../domain/document.ts';
import { importDocument } from '../storage/documents-repo.ts';
import { importPdfDocument } from './import-document.ts';

// Mock the storage boundary. Anything that goes through `importDocument`
// is observable from the test; everything else runs for real.
vi.mock('../storage/documents-repo.ts', () => ({
	importDocument: vi.fn(),
}));

const mockImportDocument = vi.mocked(importDocument);

async function makeOnePagePdfBytes(): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	pdf.addPage();
	return await pdf.save();
}

/** pdf-lib's `save()` returns `Uint8Array<ArrayBufferLike>`. The
 *  type is technically not assignable to `BlobPart`; we cast at
 *  the boundary. See the matching helper in `pdf-metadata.test.ts`
 *  for why we pass the view directly (happy-dom mangles bytes
 *  when handed an `ArrayBuffer` instead of the `Uint8Array`). */
function bytesToBlob(bytes: Uint8Array): Blob {
	return new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' });
}

/** A branded `DocumentId` for stubbing — the storage layer is
 *  mocked, so the actual UUID string is irrelevant. */
const FAKE_DOC_ID = '00000000-0000-4000-8000-000000000001' as DocumentId;

describe('importPdfDocument', () => {
	beforeEach(() => {
		mockImportDocument.mockReset();
	});

	it('returns ok=true for a valid PDF', async () => {
		const bytes = await makeOnePagePdfBytes();
		const blob = bytesToBlob(bytes);
		mockImportDocument.mockResolvedValueOnce(FAKE_DOC_ID);

		const result = await importPdfDocument(blob);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.pageCount).toBe(1);
		expect(result.value.documentId).toBe(FAKE_DOC_ID);
		// Storage must be called with 'pdf' format.
		const call = mockImportDocument.mock.calls[0];
		expect(call?.[1]).toBe('pdf');
		// And we passed page count through SourceMetadata.
		const opts = call?.[2] ?? {};
		expect(opts.sourceMetadata?.pageCount).toBe(1);
	});

	it('returns ok=false with kind=invalid-pdf for corrupt bytes', async () => {
		// NOT a PDF. `extractPdfMetadata` will throw.
		const blob = new Blob(['this is plain text, not a pdf'], {
			type: 'application/pdf',
		});

		const result = await importPdfDocument(blob);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe('invalid-pdf');
		// We must NOT have called the storage layer for a bad PDF.
		expect(mockImportDocument).not.toHaveBeenCalled();
	});

	it('returns ok=false with kind=quota-exceeded when storage raises QuotaExceededError', async () => {
		const bytes = await makeOnePagePdfBytes();
		const blob = bytesToBlob(bytes);
		mockImportDocument.mockRejectedValueOnce(
			Object.assign(new Error('quota'), { name: 'QuotaExceededError' }),
		);

		const result = await importPdfDocument(blob);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe('quota-exceeded');
	});

	it('returns ok=false with kind=quota-exceeded for Firefox NS_ERROR_DOM_QUOTA_REACHED', async () => {
		const bytes = await makeOnePagePdfBytes();
		const blob = bytesToBlob(bytes);
		mockImportDocument.mockRejectedValueOnce(
			Object.assign(new Error('quota'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' }),
		);

		const result = await importPdfDocument(blob);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe('quota-exceeded');
	});

	it('returns ok=false with kind=unknown for any other error', async () => {
		const bytes = await makeOnePagePdfBytes();
		const blob = bytesToBlob(bytes);
		mockImportDocument.mockRejectedValueOnce(new Error('something exploded'));

		const result = await importPdfDocument(blob);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe('unknown');
	});

	it('preserves the underlying cause on ImportError for logging', async () => {
		const blob = new Blob(['not a pdf'], { type: 'application/pdf' });
		const result = await importPdfDocument(blob);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		// The cause is whatever pdf.js threw — we just carry it through.
		expect(result.error.cause).toBeDefined();
	});
});
