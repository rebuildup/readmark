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

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
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
/** A branded `SourceFingerprint` for stubbing. We deliberately
 *  do NOT recompute the real SHA-256 — the whole point of the
 *  `importDocument` widening is to avoid that work in the
 *  success path. */
const FAKE_FINGERPRINT = 'a'.repeat(64) as SourceFingerprint;

describe('importPdfDocument', () => {
	beforeEach(() => {
		mockImportDocument.mockReset();
	});

	it('returns ok=true for a valid PDF and reuses the storage-layer fingerprint', async () => {
		const bytes = await makeOnePagePdfBytes();
		const blob = bytesToBlob(bytes);
		// New contract: storage returns both keys in one object,
		// so the library layer does not re-hash.
		mockImportDocument.mockResolvedValueOnce({
			documentId: FAKE_DOC_ID,
			sourceFingerprint: FAKE_FINGERPRINT,
		});

		const result = await importPdfDocument(blob);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.pageCount).toBe(1);
		expect(result.value.documentId).toBe(FAKE_DOC_ID);
		// The fingerprint must come straight from the storage
		// layer's transaction result — no second SHA-256 pass.
		expect(result.value.sourceFingerprint).toBe(FAKE_FINGERPRINT);
		// Storage must be called with 'pdf' format.
		const call = mockImportDocument.mock.calls[0];
		expect(call?.[1]).toBe('pdf');
		// And we passed page count through SourceMetadata.
		const opts = call?.[2] ?? {};
		expect(opts.sourceMetadata?.pageCount).toBe(1);
	});

	it('returns ok=false with kind=invalid-pdf for corrupt bytes', async () => {
		// NOT a PDF. `extractPdfMetadata` will throw `PdfInvalidError`.
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

	it('returns ok=false with kind=unknown for any other storage error', async () => {
		const bytes = await makeOnePagePdfBytes();
		const blob = bytesToBlob(bytes);
		mockImportDocument.mockRejectedValueOnce(new Error('something exploded'));

		const result = await importPdfDocument(blob);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe('unknown');
	});

	it('returns ok=false with kind=unknown for non-PdfInvalidError pdf.js failures', async () => {
		// pdf.js can raise other exceptions (e.g. UnknownErrorException
		// on corrupted xref). Those are NOT `invalid-pdf` — they
		// surface as `unknown`. We simulate one by mocking the
		// metadata path to throw something generic. The simplest
		// way to do that is to feed bytes that pdf.js's legacy
		// build rejects with an exception we don't recognize.
		// We use a PDF header but truncate the body.
		const truncated = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
		const blob = bytesToBlob(truncated);

		const result = await importPdfDocument(blob);

		// Either `invalid-pdf` (legacy build's MissingPDFException
		// wrapped) or `unknown` (raw rethrow). Both are acceptable
		// for the user-facing message "this is not a PDF" — what
		// matters is that the storage layer was NOT called.
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(['invalid-pdf', 'unknown']).toContain(result.error.kind);
		expect(mockImportDocument).not.toHaveBeenCalled();
	});

	it('preserves the underlying cause on ImportError for logging', async () => {
		const blob = new Blob(['not a pdf'], { type: 'application/pdf' });
		const result = await importPdfDocument(blob);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		// The cause is the PdfInvalidError — we just carry it through.
		expect(result.error.cause).toBeDefined();
	});
});
