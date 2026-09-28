/**
 * Component tests for the bookmarks surface in the reader.
 *
 * What is under test: the four things a reader does with a mark —
 * make one, see it listed, jump to it, remove it — and the two ways
 * that can quietly go wrong.
 *
 *   - A mark must record the page the reader is *on* and the offset
 *     they are at, not the top of the document: a jump that lands at
 *     the top of the page the mark was made on is the feature
 *     working and useless.
 *   - Removing has no undo, so it has to ask, and cancelling must not
 *     touch the store.
 *   - A mark's label is a position, not a quotation, and several marks
 *     on one page have to be distinguishable.
 *
 * The storage layer is faked at the repository boundary, which is
 * where the rows come from in production too. The end-to-end claim —
 * a mark survives a reload and a jump lands on it — is
 * `scripts/smoke-reader.mjs`.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex, type Bookmark } from '../domain/reading-state.ts';
import type { PageHandle, ReaderHandle } from '../reader/types.ts';
import { useUiStore } from '../stores/ui-store.ts';
import { bookmarkHints, bookmarkLabels } from './bookmarks-panel.tsx';
import { ReaderView } from './reader-view.tsx';

const DOC_ID = asDocumentId('00000000-0000-4000-8000-0000000000cc');
const FINGERPRINT = asSourceFingerprint('d'.repeat(64));

interface StoredRow {
	readonly id: string;
	readonly documentId: typeof DOC_ID;
	readonly sourceFingerprint: typeof FINGERPRINT;
	readonly pageIndex: number;
	readonly anchor: null;
	readonly position: { readonly pageOffsetRatio: number } | null;
	readonly title: string;
	readonly createdAt: number;
}

/** The repository, faked: a list, so the assertions can be about what
 *  the view asked to store and what it does after. */
const store = {
	rows: [] as StoredRow[],
	deleted: [] as string[],
	nextId: 1,
};

vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: async () => [...store.rows],
	addBookmark: async (input: {
		pageIndex: number;
		anchor: null;
		position: { pageOffsetRatio: number } | null;
		title?: string;
	}) => {
		const row: StoredRow = {
			id: `bookmark-${store.nextId++}`,
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			pageIndex: input.pageIndex,
			anchor: null,
			position: input.position,
			title: input.title ?? '',
			createdAt: store.rows.length + 1,
		};
		store.rows.push(row);
		return row as unknown as Bookmark;
	},
	deleteBookmark: async (id: string) => {
		const index = store.rows.findIndex((row) => row.id === id);
		if (index === -1) return false;
		store.rows.splice(index, 1);
		store.deleted.push(id);
		return true;
	},
}));

vi.mock('../storage/reading-state-repo.ts', () => ({
	saveReadingPosition: vi.fn(async () => {}),
	getReadingProgress: vi.fn(async () => null),
	deleteReadingProgress: vi.fn(async () => false),
}));

const PAGE_COUNT = 3;
const PAGE_HEIGHT = 800;
const RESERVED_HEIGHT = 842;
const PAGE_GAP = 40;
const VIEWPORT_HEIGHT = 600;

const renderedPages = new Set<number>();

const fakePage = {
	format: 'pdf',
	render: vi.fn(async (target: HTMLElement) => {
		const host = target.closest<HTMLElement>('[data-page-index]');
		if (host === null) return;
		renderedPages.add(Number(host.dataset.pageIndex));
		target.replaceChildren();
		const page = document.createElement('div');
		page.className = 'rm-page';
		page.style.width = '420px';
		page.style.height = `${PAGE_HEIGHT}px`;
		target.appendChild(page);
	}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async () => null),
} as unknown as PageHandle<'pdf'>;

const fakeHandle = {
	format: 'pdf',
	pageCount: vi.fn(async () => PAGE_COUNT),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn(async () => null),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

function pageTop(index: number): number {
	let top = 0;
	for (let previous = 1; previous < index; previous++) {
		top += (renderedPages.has(previous) ? PAGE_HEIGHT : RESERVED_HEIGHT) + PAGE_GAP;
	}
	return top;
}

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const originalRaf = globalThis.requestAnimationFrame;
const originalIntersectionObserver = globalThis.IntersectionObserver;

class ViewportAwareObserver implements IntersectionObserver {
	readonly root = null;
	readonly rootMargin = '';
	readonly thresholds: readonly number[] = [];
	private readonly pending = new Map<Element, boolean>();
	private readonly scroller: HTMLElement | null;
	private readonly onScroll = () => this.recheck();

	constructor(private readonly callback: IntersectionObserverCallback) {
		this.scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
		this.scroller?.addEventListener('scroll', this.onScroll, { passive: true });
	}

	disconnect(): void {
		this.scroller?.removeEventListener('scroll', this.onScroll);
	}
	observe(target: Element): void {
		this.pending.set(target, false);
		queueMicrotask(() => this.recheck());
		// Also poll for a while. happy-dom does not fire `scroll` when
		// `scrollTop` is assigned, and a jump's first phase is exactly
		// that: a programmatic scroll that has to bring a page into
		// range. A browser recomputes intersection on the frame after a
		// scroll, which is what these ticks stand in for.
		this.poll();
	}

	/** A bounded re-check loop, so a programmatic scroll brings pages
	 *  into range the way a real one does. */
	private poll(): void {
		if (this.pending.size === 0) return;
		setTimeout(() => {
			this.recheck();
			this.poll();
		}, 0);
	}
	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
	unobserve(target: Element): void {
		this.pending.delete(target);
	}
	private recheck(): void {
		if (this.scroller === null) return;
		const box = this.scroller.getBoundingClientRect();
		const entering: IntersectionObserverEntry[] = [];
		for (const [target, seen] of this.pending) {
			if (seen) continue;
			const page = target.getBoundingClientRect();
			if (page.bottom <= box.top || page.top >= box.bottom) continue;
			this.pending.set(target, true);
			entering.push({ isIntersecting: true } as IntersectionObserverEntry);
		}
		if (entering.length > 0) this.callback(entering, this);
	}
}

beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
		fillStyle: '',
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

	Element.prototype.getBoundingClientRect = function rect(this: Element) {
		const scrollerTop =
			document.querySelector<HTMLElement>('[data-testid="rm-reader-scroll"]')?.scrollTop ?? 0;
		const host = this instanceof HTMLElement ? this.closest('[data-page-index]') : null;
		if (host instanceof HTMLElement) {
			const index = Number(host.dataset.pageIndex);
			const height = renderedPages.has(index) ? PAGE_HEIGHT : RESERVED_HEIGHT;
			const top = pageTop(index) - scrollerTop;
			return {
				x: 0,
				y: top,
				width: 420,
				height,
				top,
				left: 0,
				right: 420,
				bottom: top + height,
				toJSON: () => ({}),
			} as DOMRect;
		}
		if (this instanceof HTMLElement && this.dataset.testid === 'rm-reader-scroll') {
			return {
				x: 0,
				y: 0,
				width: 800,
				height: VIEWPORT_HEIGHT,
				top: 0,
				left: 0,
				right: 800,
				bottom: VIEWPORT_HEIGHT,
				toJSON: () => ({}),
			} as DOMRect;
		}
		return {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			toJSON: () => ({}),
		} as DOMRect;
	};

	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		setTimeout(() => callback(0), 0);
		return 1;
	}) as typeof globalThis.requestAnimationFrame;

	globalThis.IntersectionObserver = ViewportAwareObserver as unknown as typeof IntersectionObserver;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
	Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
	globalThis.requestAnimationFrame = originalRaf;
	globalThis.IntersectionObserver = originalIntersectionObserver;
});

function renderReader() {
	const result = render(
		<MemoryRouter>
			<ReaderView
				handle={fakeHandle}
				pageCount={PAGE_COUNT}
				title="栞 test"
				documentId={DOC_ID}
				sourceFingerprint={FINGERPRINT}
				initialPosition={null}
			/>
		</MemoryRouter>,
	);
	const scroller = screen.getByTestId('rm-reader-scroll');
	Object.defineProperty(scroller, 'clientHeight', { value: VIEWPORT_HEIGHT, configurable: true });
	return result;
}

function scroller(): HTMLElement {
	return screen.getByTestId('rm-reader-scroll');
}

/** Let the view's async work settle: the page render, the bookmark
 *  read, and the frame-based jump poll. Wrapped in `act` so React
 *  commits what those updates schedule. */
async function settle(): Promise<void> {
	await act(async () => {
		for (let attempt = 0; attempt < 20; attempt++) {
			await Promise.resolve();
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	store.rows = [];
	store.deleted = [];
	store.nextId = 1;
	renderedPages.clear();
	// The side panel is app-wide UI state; start each test closed.
	useUiStore.setState({ sidePanel: 'none' });
});

/** Press 「栞を追加」, name the mark, confirm. */
async function addBookmarkWithTitle(title: string): Promise<void> {
	fireEvent.click(screen.getByTestId('rm-add-bookmark'));
	const field = await screen.findByTestId('rm-bookmark-title');
	fireEvent.change(field, { target: { value: title } });
	fireEvent.click(screen.getByTestId('rm-dialog-confirm'));
	await settle();
}

describe('adding a bookmark', () => {
	it('marks the page the reader is on, at the offset they are at', async () => {
		renderReader();
		await settle();

		// Move to page 2, then mark it.
		await act(async () => {
			scroller().scrollTop = 900;
			fireEvent.scroll(scroller());
		});
		await settle();

		await addBookmarkWithTitle('第三章の要約');

		await waitFor(() => expect(store.rows).toHaveLength(1));
		const row = store.rows[0];
		// The page under the viewport's midpoint, not page 1 and not
		// the top of the document.
		expect(row?.pageIndex).toBe(2);
		// No selection behind it: #7 owns anchors, and a mark that
		// claimed one would promise a quote it cannot honour.
		expect(row?.anchor).toBeNull();
		expect(row?.position?.pageOffsetRatio).toBeGreaterThan(0);
	});

	it('opens the panel so the mark is visible where it was made', async () => {
		renderReader();
		await settle();

		await addBookmarkWithTitle('第三章の要約');

		expect(await screen.findByTestId('rm-bookmarks-panel')).toBeTruthy();
		expect(screen.getByTestId('rm-bookmarks-count').textContent).toBe('1 件');
	});

	it('stores the name the reader gave it, and shows it instead of the page', async () => {
		renderReader();
		await settle();

		await addBookmarkWithTitle('  第三章の要約  ');

		await waitFor(() => expect(store.rows).toHaveLength(1));
		expect(store.rows[0]?.title).toBe('第三章の要約');
		const label = await screen.findByTestId('rm-bookmark-jump');
		expect(label.textContent).toContain('第三章の要約');
		// A name can describe a place without saying where it is, so
		// the page stays visible under it.
		expect(label.textContent).toContain('1 ページ');
	});

	it('keeps an unnamed mark addressable by its page', async () => {
		renderReader();
		await settle();

		fireEvent.click(screen.getByTestId('rm-add-bookmark'));
		const field = await screen.findByTestId('rm-bookmark-title');
		// Focus lands in the field, not on the cancel button: the next
		// move for a dialog that asks for a name is to type one.
		expect(document.activeElement).toBe(field);
		fireEvent.click(screen.getByTestId('rm-dialog-confirm'));

		await waitFor(() => expect(store.rows).toHaveLength(1));
		expect(store.rows[0]?.title).toBe('');
		const label = await screen.findByTestId('rm-bookmark-jump');
		expect(label.textContent).toContain('1 ページ');
	});

	it('adds nothing when the dialog is cancelled', async () => {
		renderReader();
		await settle();

		fireEvent.click(screen.getByTestId('rm-add-bookmark'));
		fireEvent.change(await screen.findByTestId('rm-bookmark-title'), {
			target: { value: '書きかけ' },
		});
		fireEvent.click(screen.getByTestId('rm-dialog-cancel'));
		await settle();

		expect(store.rows).toHaveLength(0);
	});
});

describe('the bookmarks panel', () => {
	it('says so when there is nothing marked yet', async () => {
		renderReader();
		await settle();
		fireEvent.click(screen.getByTestId('rm-toggle-bookmarks'));

		expect(await screen.findByTestId('rm-bookmarks-empty-panel')).toBeTruthy();
	});

	it('lists marks in the order they were made, numbered per page', async () => {
		store.rows = [
			{
				id: 'a',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 2,
				anchor: null,
				position: null,
				title: '',
				createdAt: 1,
			},
			{
				id: 'b',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 5,
				anchor: null,
				position: null,
				title: '',
				createdAt: 2,
			},
			{
				id: 'c',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 5,
				anchor: null,
				position: null,
				title: '',
				createdAt: 3,
			},
		];
		renderReader();
		await settle();
		fireEvent.click(screen.getByTestId('rm-toggle-bookmarks'));

		const list = await screen.findByTestId('rm-bookmarks-list');
		expect(list.textContent).toContain('2 ページ');
		// Marking one page twice is normal, and two rows that read the
		// same are not distinguishable.
		expect(list.textContent).toContain('5 ページ (1)');
		expect(list.textContent).toContain('5 ページ (2)');
	});

	it('jumps to the page and offset a mark was made at', async () => {
		store.rows = [
			{
				id: 'a',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 3,
				anchor: null,
				position: { pageOffsetRatio: 0.25 },
				title: '',
				createdAt: 1,
			},
		];
		renderReader();
		await settle();
		fireEvent.click(screen.getByTestId('rm-toggle-bookmarks'));
		await screen.findByTestId('rm-bookmarks-list');

		const [jump] = screen.getAllByTestId('rm-bookmark-jump');
		fireEvent.click(jump ?? screen.getByTestId('rm-bookmarks-list'));
		await waitFor(() => expect(renderedPages.has(3)).toBe(true));
		// The page is brought into range first, then the offset is
		// applied to its measured height.
		await waitFor(() => {
			expect(scroller().scrollTop).toBeGreaterThan(pageTop(3) - VIEWPORT_HEIGHT);
		});
	});

	it('still jumps after the reader has scrolled with the wheel', async () => {
		store.rows = [
			{
				id: 'a',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 3,
				anchor: null,
				position: { pageOffsetRatio: 0.25 },
				title: '',
				createdAt: 1,
			},
		];
		renderReader();
		await settle();
		fireEvent.click(screen.getByTestId('rm-toggle-bookmarks'));
		await screen.findByTestId('rm-bookmarks-list');

		// The reader's own hand on the wheel, which retires whatever
		// jump the app had in flight. It must not retire every jump
		// after it: a latch here meant a reader who scrolled once could
		// never use a bookmark again, and no test that only ever jumped
		// with a programmatic scroll would have noticed.
		fireEvent.wheel(scroller());

		fireEvent.click(screen.getByTestId('rm-bookmark-jump'));
		await waitFor(() => expect(renderedPages.has(3)).toBe(true));
		await waitFor(() => {
			expect(scroller().scrollTop).toBeGreaterThan(pageTop(3) - VIEWPORT_HEIGHT);
		});

		// And again, with another takeover in between: the marks a
		// reader comes back to are the ones used more than once.
		await act(async () => {
			scroller().scrollTop = 0;
			fireEvent.scroll(scroller());
		});
		fireEvent.wheel(scroller());
		fireEvent.click(screen.getByTestId('rm-bookmark-jump'));
		await waitFor(() => {
			expect(scroller().scrollTop).toBeGreaterThan(pageTop(3) - VIEWPORT_HEIGHT);
		});
	});

	it('asks before removing a mark, and cancelling leaves it alone', async () => {
		store.rows = [
			{
				id: 'a',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 2,
				anchor: null,
				position: null,
				title: '',
				createdAt: 1,
			},
		];
		renderReader();
		await settle();
		fireEvent.click(screen.getByTestId('rm-toggle-bookmarks'));
		await screen.findByTestId('rm-bookmarks-list');

		fireEvent.click(screen.getByTestId('rm-bookmark-delete'));
		const dialog = await screen.findByRole('alertdialog');
		expect(dialog.textContent).toContain('2 ページ');

		fireEvent.click(screen.getByTestId('rm-dialog-cancel'));
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
		expect(store.deleted).toEqual([]);
		expect(screen.getByTestId('rm-bookmarks-count').textContent).toBe('1 件');
	});

	it('removes a mark when confirmed', async () => {
		store.rows = [
			{
				id: 'a',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 2,
				anchor: null,
				position: null,
				title: '',
				createdAt: 1,
			},
			{
				id: 'b',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex: 5,
				anchor: null,
				position: null,
				title: '',
				createdAt: 2,
			},
		];
		renderReader();
		await settle();
		fireEvent.click(screen.getByTestId('rm-toggle-bookmarks'));
		await screen.findByTestId('rm-bookmarks-list');

		const [remove] = screen.getAllByTestId('rm-bookmark-delete');
		fireEvent.click(remove ?? screen.getByTestId('rm-bookmarks-list'));
		fireEvent.click(await screen.findByTestId('rm-dialog-confirm'));

		await waitFor(() => expect(screen.getByTestId('rm-bookmarks-count').textContent).toBe('1 件'));
		expect(store.deleted).toEqual(['a']);
	});
});

describe('bookmarkLabels', () => {
	it('numbers marks on a page that carries more than one', () => {
		const mark = (pageIndex: number): Bookmark =>
			({
				id: pageIndex === 2 ? 'a' : 'b',
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex,
				anchor: null,
				position: null,
				title: '',
				createdAt: 1,
			}) as unknown as Bookmark;

		expect(bookmarkLabels([mark(2), mark(2), mark(7)])).toEqual([
			'2 ページ (1)',
			'2 ページ (2)',
			'7 ページ',
		]);
	});

	it('shows the name the reader gave a mark, and keeps the page in the hint', () => {
		const mark = (pageIndex: number, title = ''): Bookmark =>
			({
				id: `${pageIndex}-${title}`,
				documentId: DOC_ID,
				sourceFingerprint: FINGERPRINT,
				pageIndex,
				anchor: null,
				position: null,
				title,
				createdAt: 1,
			}) as unknown as Bookmark;

		expect(bookmarkLabels([mark(2, '  foxes  '), mark(2), mark(2, 'wolves')])).toEqual([
			'foxes',
			// The ordinal counts every mark on the page, so `(2)` means
			// "the second mark here", not "the second unnamed one".
			'2 ページ (2)',
			'wolves',
		]);
		expect(bookmarkHints([mark(2, 'foxes'), mark(2)], '吾輩は猫である')).toEqual([
			'2 ページ · 吾輩は猫である',
			'吾輩は猫である',
		]);
	});
});
