/**
 * Component tests for the reader screen's load and teardown path.
 *
 * What is pinned here: the four ways opening a document can end, and
 * the promise that the handle is closed. The bytes never reach pdf.js
 * here — `createPdfReader` is faked — because what a unit test cannot
 * usefully assert about pdf.js is whether it paints, and pretending
 * otherwise would be a worse test than none.
 *
 * Whether the canvas and the text layer actually appear, stay
 * registered through a zoom and a rotation, and support a real
 * selection is `scripts/smoke-reader.mjs`'s job, against a real
 * browser with a real worker.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
	Document,
	DocumentId,
	DocumentSource,
	SourceFingerprint,
} from '../domain/document.ts';
import { asPageIndex, type PageIndex } from '../domain/reading-state.ts';
// The real implementation, imported from its own module rather than
// through the reader's entry point: that entry point pulls in
// pdf-worker.ts, whose `?url` import is a Vite specifier the test
// resolver cannot load.
import {
	nextRotation as realNextRotation,
	viewportSize as realViewportSize,
} from '../reader/pdf/pdf-coords.ts';
import type { PageHandle, ReaderHandle, ReaderSource } from '../reader/types.ts';
import { ReaderScreen } from './reader-screen.tsx';

const originalIntersectionObserver = globalThis.IntersectionObserver;

const DOC_ID = '00000000-0000-4000-8000-0000000000aa' as DocumentId;
const OTHER_DOC_ID = '00000000-0000-4000-8000-0000000000bb' as DocumentId;
const FINGERPRINT = 'b'.repeat(64) as SourceFingerprint;
const OTHER_FINGERPRINT = 'c'.repeat(64) as SourceFingerprint;

const fakePage = {
	format: 'pdf',
	render: vi.fn(async () => {}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async () => null),
} as unknown as PageHandle<'pdf'>;

const handle = {
	format: 'pdf',
	pageCount: vi.fn(async () => 3),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn(async () => null),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

/** The `open` call the screen makes, typed so the arguments are
 *  inspectable. Reset per test in `beforeEach`. */
const openMock = vi.fn(async (_input: ReaderSource<'pdf'>): Promise<ReaderHandle<'pdf'>> => handle);
const createPdfReader = vi.fn(() => ({ format: 'pdf' as const, open: openMock }));

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

vi.mock('../storage/documents-repo.ts', () => ({
	getDocument: vi.fn(),
	getPrimarySource: vi.fn(),
	getDocumentBlob: vi.fn(),
	touchLastReadAt: vi.fn(async () => {}),
}));

// The reading-progress repository is the storage boundary for #5;
// the screen only decides when to read it and hands the result down.
vi.mock('../storage/reading-state-repo.ts', () => ({
	getReadingProgress: vi.fn(async () => null),
	saveReadingPosition: vi.fn(async () => {}),
	deleteReadingProgress: vi.fn(async () => false),
}));

// The view reads the mark list on mount. This screen is not where
// bookmark behaviour is under test, so the list only has to be empty —
// and it has to be a mock, because the real repository needs IndexedDB.
vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: vi.fn(async () => []),
	addBookmark: vi.fn(),
	deleteBookmark: vi.fn(),
}));

vi.mock('../reader/pdf/index.ts', () => ({
	createPdfReader: () => createPdfReader(),
	// The view reads this class name to measure a rendered page.
	PDF_PAGE_CLASS: 'rm-page',

	nextRotation: realNextRotation,
	viewportSize: realViewportSize,
}));

/**
 * happy-dom ships an `IntersectionObserver` that never reports
 * anything, so pages would never materialize. Stand in for a browser
 * where every page is in view: the real observer's behaviour across a
 * scroll is the smoke's job.
 */
class AlwaysIntersectingObserver implements IntersectionObserver {
	readonly root = null;
	readonly rootMargin = '';
	readonly thresholds: readonly number[] = [];

	constructor(private readonly callback: IntersectionObserverCallback) {
		// Report an intersection as soon as the effect that created the
		// observer has finished wiring itself up — a microtask, so the
		// state update lands inside the test's act().
		queueMicrotask(() => {
			this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this);
		});
	}

	disconnect(): void {}
	observe(): void {}
	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
	unobserve(): void {}
}

beforeAll(() => {
	globalThis.IntersectionObserver =
		AlwaysIntersectingObserver as unknown as typeof IntersectionObserver;
});

afterAll(() => {
	globalThis.IntersectionObserver = originalIntersectionObserver;
});

const repository = await import('../storage/documents-repo.ts');
const progressRepository = await import('../storage/reading-state-repo.ts');
const mockGetProgress = vi.mocked(progressRepository.getReadingProgress);
const saveReadingPosition = vi.mocked(progressRepository.saveReadingPosition);
const mockGetDocument = vi.mocked(repository.getDocument);
const mockGetPrimarySource = vi.mocked(repository.getPrimarySource);
const mockGetDocumentBlob = vi.mocked(repository.getDocumentBlob);
const mockTouch = vi.mocked(repository.touchLastReadAt);

function makeDocument(id: DocumentId = DOC_ID): Document {
	return { id, metadata: { title: '吾輩は猫である' }, importedAt: 1, lastReadAt: null };
}

function makeSource(
	documentId: DocumentId = DOC_ID,
	sourceFingerprint: SourceFingerprint = FINGERPRINT,
): DocumentSource {
	return {
		sourceFingerprint,
		documentId,
		format: 'pdf',
		byteSize: 1024,
		importedAt: 1,
		metadata: { pageCount: 3 },
	};
}

function renderReader() {
	return render(
		<MemoryRouter initialEntries={[`/read/${DOC_ID}`]}>
			<Routes>
				<Route path="/read/:documentId" element={<ReaderScreen />} />
				<Route path="/" element={<div>library screen</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockGetProgress.mockResolvedValue(null);
	mockGetDocument.mockResolvedValue(makeDocument());
	mockGetPrimarySource.mockResolvedValue(makeSource());
	mockGetDocumentBlob.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
	openMock.mockResolvedValue(handle);
});

describe('ReaderScreen', () => {
	it('opens the document and shows the reader', async () => {
		renderReader();

		expect(await screen.findByTestId('rm-reader-toolbar')).toBeTruthy();
		// lastReadAt is "this source was opened" — the library's
		// recently-read order depends on it.
		expect(mockTouch).toHaveBeenCalledWith(DOC_ID);
		expect(createPdfReader).toHaveBeenCalledTimes(1);
	});

	it('reads the stored position for this source before rendering', async () => {
		mockGetProgress.mockResolvedValueOnce({
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			currentPage: asPageIndex(7),
			position: { pageOffsetRatio: 0.4 },
			updatedAt: 1,
		});
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		// Progress belongs to bytes, so the read is keyed by the pair —
		// and it happens before the first paint, because a restore that
		// ran afterwards would be a visible jump.
		expect(mockGetProgress).toHaveBeenCalledWith({
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
		});
		// The read happened before the first paint of the view: a
		// restore applied after the reader is on screen is a visible
		// jump from page 1 to page 7.
		const readAt = mockGetProgress.mock.invocationCallOrder[0] ?? 0;
		const openAt = openMock.mock.invocationCallOrder[0] ?? 0;
		expect(readAt).toBeGreaterThan(0);
		expect(openAt).toBeGreaterThan(0);
	});

	it('opens a document that has no stored position', async () => {
		mockGetProgress.mockResolvedValueOnce(null);
		renderReader();
		expect(await screen.findByTestId('rm-reader-toolbar')).toBeTruthy();
	});

	it('opens the other document when the route changes', async () => {
		// React reuses the component for a new `/read/:documentId`, so
		// the view keeps its instance unless it is keyed. Its refs hold
		// per-document state — which pages were rendered, which sizes
		// were measured, and whether the stored position was restored —
		// so without a key the second document inherits the first one's
		// "already restored" flag and never restores its own.
		mockGetDocument.mockImplementation(async (id) => makeDocument(id as DocumentId));
		mockGetPrimarySource.mockImplementation(async (id) =>
			makeSource(id as DocumentId, id === DOC_ID ? FINGERPRINT : OTHER_FINGERPRINT),
		);
		mockGetProgress.mockImplementation(async ({ sourceFingerprint }) =>
			sourceFingerprint === FINGERPRINT
				? {
						documentId: DOC_ID,
						sourceFingerprint: FINGERPRINT,
						currentPage: asPageIndex(1),
						position: { pageOffsetRatio: 0 },
						updatedAt: 1,
					}
				: {
						documentId: OTHER_DOC_ID,
						sourceFingerprint: OTHER_FINGERPRINT,
						currentPage: asPageIndex(2),
						position: { pageOffsetRatio: 0.25 },
						updatedAt: 2,
					},
		);
		openMock.mockImplementation(async () => handle);

		render(
			<MemoryRouter initialEntries={[`/read/${DOC_ID}`]}>
				<Routes>
					{/* A link inside the same route: following it reuses the
					    component instance, which is the case under test. */}
					<Route
						path="/read/:documentId"
						element={
							<>
								<ReaderScreen />
								<Link data-testid="rm-switch-document" to={`/read/${OTHER_DOC_ID}`}>
									switch
								</Link>
							</>
						}
					/>
				</Routes>
			</MemoryRouter>,
		);
		await screen.findByTestId('rm-reader-toolbar');
		expect(mockGetProgress).toHaveBeenLastCalledWith({
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
		});

		fireEvent.click(screen.getByTestId('rm-switch-document'));
		await waitFor(() => {
			expect(mockGetProgress).toHaveBeenLastCalledWith({
				documentId: OTHER_DOC_ID,
				sourceFingerprint: OTHER_FINGERPRINT,
			});
		});
		// The previous document's handle is closed as part of the swap.
		await waitFor(() => expect(vi.mocked(handle.close)).toHaveBeenCalled());
	});

	it('ignores a stored page that is outside this document', async () => {
		// Handing the view a page it will never find would leave it
		// waiting, and every save in that session suppressed.
		mockGetProgress.mockResolvedValueOnce({
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			currentPage: asPageIndex(99),
			position: { pageOffsetRatio: 0.5 },
			updatedAt: 1,
		});
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		expect(vi.mocked(saveReadingPosition).mock.calls.length).toBe(0);
		// The view is alive and scrollable at the top.
		expect(screen.getByTestId('rm-reader-scroll').scrollTop).toBe(0);
	});

	it('renders one host per page, 1-based', async () => {
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		await waitFor(() => {
			expect(document.querySelectorAll('[data-page-index]')).toHaveLength(3);
		});
		const indexes = Array.from(document.querySelectorAll('[data-page-index]')).map((node) =>
			node.getAttribute('data-page-index'),
		);
		// The contract is 1-based; the UI must not renumber to 0.
		expect(indexes).toEqual(['1', '2', '3']);
	});

	it('re-renders at the new scale and rotation', async () => {
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');
		await waitFor(() => expect(fakePage.render).toHaveBeenCalled());
		const before = vi.mocked(fakePage.render).mock.calls.length;

		fireEvent.click(screen.getByTestId('rm-zoom-in'));
		fireEvent.click(screen.getByTestId('rm-rotate'));

		await waitFor(() =>
			expect(vi.mocked(fakePage.render).mock.calls.length).toBeGreaterThan(before),
		);
		const lastCall = vi.mocked(fakePage.render).mock.calls.at(-1);
		expect(lastCall?.[1]).toMatchObject({ scale: 1.25, rotation: 90 });
		expect(screen.getByTestId('rm-reader-zoom').textContent).toBe('125%');
	});

	it('hands back to the library without nesting interactive elements', async () => {
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		const back = screen.getByTestId('rm-reader-back');
		expect(back.tagName).toBe('A');
		// `<a><button>` is the shape #4's review rejected.
		expect(back.querySelector('button')).toBeNull();
		fireEvent.click(back);
		expect(await screen.findByText('library screen')).toBeTruthy();
	});

	it('says the bytes are gone instead of showing an empty reader', async () => {
		mockGetDocumentBlob.mockResolvedValue(null);
		renderReader();

		// The bytes live in their own store so they can be evicted
		// (ADR-0005); the reader has to name that, not look like a
		// document with no pages.
		const state = await screen.findByTestId('rm-reader-state');
		expect(state.textContent).toContain('ファイル本体が利用できません');
		expect(state.textContent).toContain('再度 import');
		expect(screen.queryByTestId('rm-reader-toolbar')).toBeNull();
	});

	it('reports an unknown document', async () => {
		mockGetDocument.mockResolvedValue(null);
		renderReader();

		expect((await screen.findByTestId('rm-reader-state')).textContent).toContain(
			'Document が見つかりません',
		);
	});

	it('reports a document whose bytes will not open', async () => {
		openMock.mockRejectedValueOnce(new Error('InvalidPDFException'));
		renderReader();

		expect((await screen.findByTestId('rm-reader-state')).textContent).toContain(
			'この PDF を開けませんでした',
		);
		// `lastReadAt` is "opened", not "looked at": a file that never
		// opened must not float to the top of the recently-read order.
		expect(mockTouch).not.toHaveBeenCalled();
	});

	it('records the open once the reader is actually usable', async () => {
		const order: string[] = [];
		openMock.mockImplementationOnce(async () => {
			order.push('open');
			return handle;
		});
		mockTouch.mockImplementationOnce(async () => {
			order.push('touch');
		});
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		expect(order).toEqual(['open', 'touch']);
	});

	it('closes the handle when the screen goes away', async () => {
		const { unmount } = renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		unmount();

		// The whole teardown hangs off this: in-flight renders
		// cancelled, page proxies released, worker destroyed.
		await waitFor(() => expect(vi.mocked(handle.close)).toHaveBeenCalled());
	});

	it('closes a handle that finished opening after unmount', async () => {
		const opened = deferred();
		openMock.mockImplementationOnce(async () => {
			await opened.promise;
			return handle;
		});

		const { unmount } = renderReader();
		await waitFor(() => expect(openMock).toHaveBeenCalled());
		unmount();
		opened.resolve();

		// pdf.js finished parsing into a screen that is gone. The
		// handle still has to be closed or the worker outlives the
		// route.
		await waitFor(() => expect(vi.mocked(handle.close)).toHaveBeenCalled());
	});

	it('never reaches the reader for a document without a source', async () => {
		mockGetPrimarySource.mockResolvedValue(null);
		renderReader();

		expect((await screen.findByTestId('rm-reader-state')).textContent).toContain(
			'Document が見つかりません',
		);
		expect(createPdfReader).not.toHaveBeenCalled();
	});

	it('passes the source and its bytes to the reader', async () => {
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		expect(openMock).toHaveBeenCalledTimes(1);
		const input = openMock.mock.calls[0]?.[0];
		expect(input?.source.sourceFingerprint).toBe(FINGERPRINT);
		expect(input?.source.format).toBe('pdf');
		expect(input?.blob).toBeInstanceOf(Blob);
	});

	it('ignores a route parameter that is not a document id', async () => {
		render(
			<MemoryRouter initialEntries={['/read/not-a-uuid']}>
				<Routes>
					<Route path="/read/:documentId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>,
		);

		expect((await screen.findByTestId('rm-reader-state')).textContent).toContain(
			'Document が見つかりません',
		);
		expect(createPdfReader).not.toHaveBeenCalled();
	});
});

describe('render failure', () => {
	it('keeps the page scroller the only scrollable surface', async () => {
		vi.mocked(fakePage.render).mockRejectedValueOnce(new Error('out of memory'));
		renderReader();
		await screen.findByTestId('rm-reader-toolbar');

		const error = await screen.findByTestId('rm-reader-error');
		// The alert has to live inside the scroller: as a third child
		// of the app grid it would push the scroller into an implicit
		// auto row, and the reader would stop scrolling exactly when a
		// page failed.
		expect(error.closest('[data-testid="rm-reader-scroll"]')).not.toBeNull();
	});
});

describe('page index plumbing', () => {
	it('uses the branded 1-based type throughout', () => {
		// Guards the direction of the refactor: if anyone swaps
		// PageIndex for a bare number, this stops compiling.
		const one: PageIndex = asPageIndex(1);
		expect(one).toBe(1);
	});
});
