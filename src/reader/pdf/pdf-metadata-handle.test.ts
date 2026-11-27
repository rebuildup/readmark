/**
 * Unit tests for the document-handle lifecycle in
 * `extractPdfMetadata()`.
 *
 * Why this is a separate file from `pdf-metadata.test.ts`:
 *   - That file is a real-pdf.js integration smoke and deliberately
 *     does NOT mock `loadPdfDocument`. `vi.mock` is file-scoped, so
 *     asserting "was `destroy()` called?" needs its own module
 *     registry AND a fake proxy to spy on. Both live here.
 *
 * Why the failure path is worth its own test (#3 acceptance):
 *   - The integration smoke can only make the load itself fail, and
 *     that path has no `PDFDocumentProxy` to destroy — the cleanup
 *     it exercises is `loadPdfDocument`'s own `loadingTask.destroy()`.
 *   - The `finally` in `extractPdfMetadata` guards a *different*
 *     branch: a load that succeeds and a `getMetadata()` that then
 *     throws. Nothing else in the suite reaches it, so deleting or
 *     moving that `finally` would leave the suite green while every
 *     failed import leaked a worker.
 *
 * What we pin:
 *   1. `destroy()` runs on the success path.
 *   2. `destroy()` runs when `getMetadata()` throws.
 *   3. `destroy()` runs when `info.info` access throws (a second
 *      failure mode inside the same `try`).
 *   4. Non-PDF bytes are rejected by our own header sniff, BEFORE
 *      pdf.js is handed anything — so no worker is ever opened for
 *      a JPEG, and the caller gets a specific error rather than
 *      pdf.js's opaque `InvalidPDFException`.
 *   5. A `%PDF-` header anywhere in the first 1 KiB is still
 *      accepted, so producers that prepend a BOM or padding keep
 *      working.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadPdfDocument } from './pdf-document.ts';
import { PdfUnsupportedFormatError } from './pdf-errors.ts';
import { extractPdfMetadata } from './pdf-metadata.ts';

vi.mock('./pdf-document.ts', () => ({
	loadPdfDocument: vi.fn(),
}));

const mockLoadPdfDocument = vi.mocked(loadPdfDocument);

interface FakeDoc {
	readonly proxy: PDFDocumentProxy;
	readonly destroy: ReturnType<typeof vi.fn>;
	readonly getMetadata: ReturnType<typeof vi.fn>;
}

/** Minimal stand-in for `PDFDocumentProxy`. Only the three members
 *  `extractPdfMetadata` touches are modelled; the rest of pdf.js's
 *  surface is irrelevant to the handle lifecycle. */
function makeFakeDoc(getMetadataImpl?: () => Promise<unknown>): FakeDoc {
	const destroy = vi.fn(async () => undefined);
	const getMetadata = vi.fn(
		getMetadataImpl ?? (async () => ({ info: { Title: 'T', Author: 'A' } })),
	);
	const proxy = {
		numPages: 3,
		getMetadata,
		destroy,
	} as unknown as PDFDocumentProxy;
	return { proxy, destroy, getMetadata };
}

function bytesToBlob(bytes: Uint8Array): Blob {
	// Pass the view, not the underlying buffer: happy-dom's `Blob`
	// constructor loses byte data when handed an `ArrayBuffer`
	// directly. See the same helper in `pdf-metadata.test.ts`.
	return new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' });
}

/** A real PNG header followed by junk. Nothing here is a PDF, and no
 *  part of the first 1 KiB contains `%PDF-`. */
function pngBytes(): Uint8Array {
	const bytes = new Uint8Array(64);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	return bytes;
}

/** Padding, then a valid `%PDF-` header at offset 1000 — inside the
 *  1 KiB search window. */
function paddedPdfHeaderBytes(): Uint8Array {
	const bytes = new Uint8Array(1024);
	bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 1000); // "%PDF-"
	return bytes;
}

describe('extractPdfMetadata — document handle lifecycle', () => {
	beforeEach(() => {
		mockLoadPdfDocument.mockReset();
	});

	it('destroys the document proxy on the success path', async () => {
		const fake = makeFakeDoc();
		mockLoadPdfDocument.mockResolvedValueOnce(fake.proxy);

		const meta = await extractPdfMetadata(bytesToBlob(paddedPdfHeaderBytes()));

		expect(meta.pageCount).toBe(3);
		expect(fake.destroy).toHaveBeenCalledTimes(1);
	});

	it('destroys the document proxy when getMetadata() throws', async () => {
		const fake = makeFakeDoc(async () => {
			throw new Error('metadata read blew up');
		});
		mockLoadPdfDocument.mockResolvedValueOnce(fake.proxy);

		await expect(extractPdfMetadata(bytesToBlob(paddedPdfHeaderBytes()))).rejects.toThrow(
			'metadata read blew up',
		);

		expect(fake.destroy).toHaveBeenCalledTimes(1);
	});

	it('destroys the document proxy when the /Info dictionary is malformed', async () => {
		// `info.info` is typed `Object` by pdf.js but can be a
		// non-object at runtime for a corrupt dictionary. The property
		// access throwing is inside the same `try` as `getMetadata()`,
		// so it must hit the same `finally`.
		const hostile = new Proxy(
			{},
			{
				get(_target, prop) {
					if (prop === 'info') {
						throw new Error('info getter exploded');
					}
					return undefined;
				},
			},
		);
		const fake = makeFakeDoc(async () => hostile);
		mockLoadPdfDocument.mockResolvedValueOnce(fake.proxy);

		await expect(extractPdfMetadata(bytesToBlob(paddedPdfHeaderBytes()))).rejects.toThrow(
			'info getter exploded',
		);

		expect(fake.destroy).toHaveBeenCalledTimes(1);
	});

	it('rejects non-PDF bytes with PdfUnsupportedFormatError before calling pdf.js', async () => {
		await expect(extractPdfMetadata(bytesToBlob(pngBytes()))).rejects.toBeInstanceOf(
			PdfUnsupportedFormatError,
		);

		// The point of the sniff: pdf.js is never handed the bytes, so
		// no worker is opened for a file that is not a PDF.
		expect(mockLoadPdfDocument).not.toHaveBeenCalled();
	});

	it('rejects an empty blob without calling pdf.js', async () => {
		await expect(extractPdfMetadata(new Blob([]))).rejects.toBeInstanceOf(
			PdfUnsupportedFormatError,
		);
		expect(mockLoadPdfDocument).not.toHaveBeenCalled();
	});

	it('accepts a %PDF- header found inside the 1 KiB search window', async () => {
		const fake = makeFakeDoc();
		mockLoadPdfDocument.mockResolvedValueOnce(fake.proxy);

		const meta = await extractPdfMetadata(bytesToBlob(paddedPdfHeaderBytes()));

		expect(mockLoadPdfDocument).toHaveBeenCalledTimes(1);
		expect(meta.pageCount).toBe(3);
	});
});
