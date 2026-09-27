/**
 * Component test for the Library screen (#4).
 *
 * What is under test here — the wiring, not the rules:
 *   - The sort control re-orders the rendered rows.
 *   - The search box filters them, and the "no match" state offers a
 *     way back.
 *   - The empty state offers the import CTA.
 *   - Delete is confirmed before anything is written: cancel writes
 *     nothing, confirm writes exactly one `deleteDocument` for the
 *     clicked row, and the row disappears after the refetch.
 *   - A failed delete keeps the dialog open with the error, and an
 *     already-missing row is treated as done (the desired end state
 *     holds).
 *
 * Interaction style: `fireEvent`, not `@testing-library/user-event`.
 * user-event is the better tool, but it is a new devDependency and
 * this repo does not have one (AGENTS.md §2: do not add a package to
 * a category that already has one). For a controlled `<input>` and
 * a `<select>`, `fireEvent.change` is equivalent here.
 *
 * Why both layers are mocked:
 *   - `documents-repo` is the storage boundary: this file must not
 *     depend on IndexedDB. `library-list.test.ts` covers the sort /
 *     filter rules, and the real cascade is covered by
 *     `scripts/smoke-library.mjs` against a real browser.
 *   - `<DocumentImport>` is stubbed because importing a PDF is #3's
 *     tested flow; here it is only a mounted control.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
	Document,
	DocumentId,
	DocumentSource,
	SourceFingerprint,
} from '../domain/document.ts';
import type { DeleteDocumentSummary, LibraryEntry } from '../storage/documents-repo.ts';
import { deleteDocument, listLibrary } from '../storage/documents-repo.ts';
import { LibraryScreen } from './library-screen.tsx';

vi.mock('../storage/documents-repo.ts', () => ({
	listLibrary: vi.fn(),
	deleteDocument: vi.fn(),
}));

vi.mock('./document-import.tsx', () => ({
	DocumentImport: () => <button type="button">PDF を import</button>,
}));

const mockListLibrary = vi.mocked(listLibrary);
const mockDeleteDocument = vi.mocked(deleteDocument);

let seq = 0;

function makeEntry(params: {
	title?: string;
	author?: string;
	importedAt: number;
	lastReadAt?: number | null;
}): LibraryEntry {
	seq += 1;
	const n = String(seq).padStart(2, '0');
	const id = `00000000-0000-4000-8000-0000000000${n}` as DocumentId;
	const metadata: { title?: string; author?: string } = {};
	if (params.title !== undefined) metadata.title = params.title;
	if (params.author !== undefined) metadata.author = params.author;

	const document: Document = {
		id,
		metadata,
		importedAt: params.importedAt,
		lastReadAt: params.lastReadAt ?? null,
	};
	const primarySource: DocumentSource = {
		sourceFingerprint: n.repeat(64).slice(0, 64) as SourceFingerprint,
		documentId: id,
		format: 'pdf',
		byteSize: 2 * 1024 * 1024,
		importedAt: params.importedAt,
		metadata: { pageCount: 120 },
	};
	return { document, primarySource };
}

function summaryFor(documentId: DocumentId): DeleteDocumentSummary {
	return {
		documentId,
		sources: 1,
		blobs: 1,
		bookmarks: 0,
		highlights: 0,
		notes: 0,
		readingProgress: 1,
	};
}

function renderScreen() {
	return render(
		<MemoryRouter>
			<LibraryScreen />
		</MemoryRouter>,
	);
}

/** First link of each row is the title link. */
function rowTitles(): string[] {
	return screen
		.getAllByTestId('rm-library-row')
		.map((row) => within(row).getAllByRole('link')[0]?.textContent ?? '');
}

function rowByDocumentId(documentId: DocumentId): HTMLElement {
	const row = screen
		.getAllByTestId('rm-library-row')
		.find((candidate) => candidate.getAttribute('data-document-id') === documentId);
	if (!row) throw new Error(`row for ${documentId} is not rendered`);
	return row;
}

function setSearch(value: string) {
	fireEvent.change(screen.getByTestId('rm-library-search'), { target: { value } });
}

function selectSort(value: string) {
	fireEvent.change(screen.getByTestId('rm-library-sort'), { target: { value } });
}

async function waitForRows(count: number) {
	await waitFor(() => expect(screen.getAllByTestId('rm-library-row')).toHaveLength(count));
}

beforeEach(() => {
	seq = 0;
	mockListLibrary.mockReset();
	mockDeleteDocument.mockReset();
});

describe('LibraryScreen', () => {
	it('shows the import CTA when the library is empty', async () => {
		mockListLibrary.mockResolvedValueOnce([]);
		renderScreen();

		const empty = await screen.findByTestId('rm-library-empty');
		// The CTA is the only action that changes an empty library.
		expect(within(empty).getByText('PDF を import')).toBeTruthy();
		// No rows, so no toolbar to filter nothing with.
		expect(screen.queryByTestId('rm-library-search')).toBeNull();
	});

	it('reorders rows when the sort changes', async () => {
		// Chosen so all three orders differ: reading order is
		// b > a > c, import order is b > c > a, title order is
		// a > b > c. A test that only checked two of them would pass
		// even if the third fell through to the default.
		const a = makeEntry({ title: 'sort-a', importedAt: 1000, lastReadAt: 5000 });
		const b = makeEntry({ title: 'sort-b', importedAt: 3000, lastReadAt: 9000 });
		const c = makeEntry({ title: 'sort-c', importedAt: 2000, lastReadAt: 1000 });
		mockListLibrary.mockResolvedValue([a, b, c]);
		renderScreen();
		await waitForRows(3);

		expect(rowTitles()).toEqual(['sort-b', 'sort-a', 'sort-c']);

		selectSort('imported-newest');
		expect(rowTitles()).toEqual(['sort-b', 'sort-c', 'sort-a']);

		selectSort('title-asc');
		expect(rowTitles()).toEqual(['sort-a', 'sort-b', 'sort-c']);
	});

	it('filters rows by title and by author, and can clear the query', async () => {
		const cat = makeEntry({ title: '吾輩は猫である', author: '夏目漱石', importedAt: 1000 });
		const snow = makeEntry({ title: '雪国', author: '川端康成', importedAt: 2000 });
		mockListLibrary.mockResolvedValue([cat, snow]);
		renderScreen();
		await waitForRows(2);

		setSearch('雪国');
		expect(rowTitles()).toEqual(['雪国']);
		expect(screen.getByTestId('rm-library-count').textContent).toBe('1 / 2 件');

		setSearch('夏目');
		expect(rowTitles()).toEqual(['吾輩は猫である']);

		setSearch('存在しない');
		expect(screen.queryAllByTestId('rm-library-row')).toHaveLength(0);
		const empty = await screen.findByTestId('rm-library-empty-filtered');
		expect(empty.textContent).toContain('存在しない');
		// The input that produced this state must stay reachable —
		// otherwise the only way back is a different control.
		expect(screen.getByTestId('rm-library-search')).toBeTruthy();

		fireEvent.click(within(empty).getByText('検索をクリア'));
		expect(screen.getAllByTestId('rm-library-row')).toHaveLength(2);
	});

	it('lets the reader type a new query straight out of the no-match state', async () => {
		const cat = makeEntry({ title: '吾輩は猫である', importedAt: 1000 });
		const snow = makeEntry({ title: '雪国', importedAt: 2000 });
		mockListLibrary.mockResolvedValue([cat, snow]);
		renderScreen();
		await waitForRows(2);

		setSearch('該当なし');
		await screen.findByTestId('rm-library-empty-filtered');

		setSearch('雪国');
		expect(rowTitles()).toEqual(['雪国']);
	});

	it('links each row to the reader route by documentId', async () => {
		const entry = makeEntry({ title: 'link target', importedAt: 1000 });
		mockListLibrary.mockResolvedValue([entry]);
		renderScreen();
		await waitForRows(1);

		// Title link and the "読む" button both target the reader.
		for (const link of within(rowByDocumentId(entry.document.id)).getAllByRole('link')) {
			expect(link.getAttribute('href')).toBe(`/read/${entry.document.id}`);
		}
	});

	it('focuses the cancel button when the confirmation opens', async () => {
		mockListLibrary.mockResolvedValue([makeEntry({ title: 'focus me', importedAt: 1000 })]);
		renderScreen();
		await waitForRows(1);

		fireEvent.click(screen.getByTestId('rm-library-row-delete'));

		const cancel = await screen.findByTestId('rm-dialog-cancel');
		await waitFor(() => expect(document.activeElement).toBe(cancel));
	});

	it('does not write anything when the delete confirmation is cancelled', async () => {
		const entry = makeEntry({ title: 'cancel target', importedAt: 1000 });
		mockListLibrary.mockResolvedValue([entry]);
		renderScreen();
		await waitForRows(1);

		fireEvent.click(screen.getByTestId('rm-library-row-delete'));
		const dialog = await screen.findByRole('alertdialog');
		expect(dialog.textContent).toContain('cancel target');
		// The confirmation must state that reading state is lost.
		expect(dialog.textContent).toContain('栞・ハイライト・メモ・読書進捗も同時に失われます');

		fireEvent.click(screen.getByTestId('rm-dialog-cancel'));
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
		expect(mockDeleteDocument).not.toHaveBeenCalled();
		expect(screen.getAllByTestId('rm-library-row')).toHaveLength(1);
	});

	it('deletes the clicked row and refetches the list on confirm', async () => {
		const kept = makeEntry({ title: 'keep', importedAt: 1000 });
		const doomed = makeEntry({ title: 'doomed', importedAt: 2000 });
		mockListLibrary.mockResolvedValueOnce([kept, doomed]).mockResolvedValue([kept]);
		mockDeleteDocument.mockResolvedValueOnce(summaryFor(doomed.document.id));
		renderScreen();
		await waitForRows(2);

		fireEvent.click(
			within(rowByDocumentId(doomed.document.id)).getByTestId('rm-library-row-delete'),
		);
		fireEvent.click(await screen.findByTestId('rm-dialog-confirm'));

		await waitForRows(1);
		expect(mockDeleteDocument).toHaveBeenCalledTimes(1);
		expect(mockDeleteDocument).toHaveBeenCalledWith(doomed.document.id);
		expect(rowTitles()).toEqual(['keep']);
		// listLibrary ran once on mount and once after the delete.
		expect(mockListLibrary).toHaveBeenCalledTimes(2);
	});

	it('keeps the dialog open with the error when the delete fails', async () => {
		const entry = makeEntry({ title: 'stubborn', importedAt: 1000 });
		mockListLibrary.mockResolvedValue([entry]);
		mockDeleteDocument.mockRejectedValueOnce(new Error('database is blocked'));
		renderScreen();
		await waitForRows(1);

		fireEvent.click(screen.getByTestId('rm-library-row-delete'));
		fireEvent.click(await screen.findByTestId('rm-dialog-confirm'));

		const error = await screen.findByTestId('rm-dialog-error');
		expect(error.textContent).toContain('削除に失敗しました');
		// The row is still there, and no refetch was triggered.
		expect(screen.getAllByTestId('rm-library-row')).toHaveLength(1);
		expect(mockListLibrary).toHaveBeenCalledTimes(1);
	});

	it('treats an already-missing row as done instead of showing an error', async () => {
		const entry = makeEntry({ title: 'ghost', importedAt: 1000 });
		mockListLibrary.mockResolvedValueOnce([entry]).mockResolvedValue([]);
		mockDeleteDocument.mockResolvedValueOnce(null);
		renderScreen();
		await waitForRows(1);

		fireEvent.click(screen.getByTestId('rm-library-row-delete'));
		fireEvent.click(await screen.findByTestId('rm-dialog-confirm'));

		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
		expect(screen.queryByTestId('rm-dialog-error')).toBeNull();
		expect(screen.getByTestId('rm-library-empty')).toBeTruthy();
	});

	it('surfaces a load failure without pretending the library is empty', async () => {
		mockListLibrary.mockRejectedValueOnce(new Error('indexeddb unavailable'));
		renderScreen();

		expect(await screen.findByTestId('rm-library-load-error')).toBeTruthy();
		expect(screen.queryByTestId('rm-library-empty')).toBeNull();
	});
});
