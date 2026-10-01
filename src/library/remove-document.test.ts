/**
 * Unit tests for the library remove flow.
 *
 * What is under test:
 *   1. Happy path — the storage summary is passed through untouched
 *      so the screen can report what was deleted.
 *   2. `not-found` — the storage layer's `null` (row already gone)
 *      becomes a typed error instead of a silent success, because a
 *      delete that deleted nothing must not be reported as a delete.
 *   3. `unknown` — a Dexie failure is carried with its cause.
 *   4. `removeErrorMessage` covers every `kind`, so a new kind cannot
 *      reach the screen without copy.
 *
 * Why we mock the storage boundary:
 *   - The cascade itself lives in `deleteDocument()`
 *     (`src/storage/documents-repo.ts`) and needs a real IndexedDB.
 *     This repo has no `fake-indexeddb` (see the same note in
 *     `import-document.test.ts`), so repository-level behaviour is
 *     covered by the browser smoke in `scripts/smoke-library.mjs`
 *     rather than by a fake store that could drift from Dexie's
 *     real behaviour.
 *   - What matters here is the flow's own logic: the null → error
 *     mapping and the cause propagation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId } from '../domain/document.ts';
import type { DeleteDocumentSummary } from '../storage/documents-repo.ts';
import { deleteDocument } from '../storage/documents-repo.ts';
import { removeDocument, removeErrorMessage } from './remove-document.ts';

vi.mock('../storage/documents-repo.ts', () => ({
	deleteDocument: vi.fn(),
}));

const mockDeleteDocument = vi.mocked(deleteDocument);

const DOC_ID = '00000000-0000-4000-8000-00000000000a' as DocumentId;

const SUMMARY: DeleteDocumentSummary = {
	documentId: DOC_ID,
	sources: 1,
	blobs: 1,
	bookmarks: 2,
	highlights: 3,
	notes: 1,
	readingProgress: 1,
};

describe('removeDocument', () => {
	beforeEach(() => {
		mockDeleteDocument.mockReset();
	});

	it('passes the storage summary through on success', async () => {
		mockDeleteDocument.mockResolvedValueOnce(SUMMARY);

		const result = await removeDocument(DOC_ID);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.documentId).toBe(DOC_ID);
		// The per-table counts are the point: the screen can tell the
		// reader that highlights and notes went with the file.
		expect(result.value.summary).toEqual(SUMMARY);
		expect(mockDeleteDocument).toHaveBeenCalledWith(DOC_ID);
	});

	it('maps a missing row to not-found rather than reporting a delete', async () => {
		mockDeleteDocument.mockResolvedValueOnce(null);

		const result = await removeDocument(DOC_ID);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe('not-found');
		if (result.error.kind !== 'not-found') return;
		expect(result.error.documentId).toBe(DOC_ID);
	});

	it('keeps the raw cause on an unexpected storage failure', async () => {
		const cause = new Error('database is blocked');
		mockDeleteDocument.mockRejectedValueOnce(cause);

		const result = await removeDocument(DOC_ID);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe('unknown');
		if (result.error.kind !== 'unknown') return;
		expect(result.error.cause).toBe(cause);
	});

	it('does not retry or re-read after a failure', async () => {
		mockDeleteDocument.mockRejectedValueOnce(new Error('boom'));

		await removeDocument(DOC_ID);

		// One write attempt per user action. A silent retry would
		// double the work inside a transaction the user is waiting on.
		expect(mockDeleteDocument).toHaveBeenCalledTimes(1);
	});
});

describe('removeErrorMessage', () => {
	it('has copy for every error kind', () => {
		expect(removeErrorMessage({ kind: 'not-found', documentId: DOC_ID })).toContain(
			'すでに削除されています',
		);
		expect(removeErrorMessage({ kind: 'unknown', cause: new Error('x') })).toContain(
			'削除に失敗しました',
		);
	});
});
