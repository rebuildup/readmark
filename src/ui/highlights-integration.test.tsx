/**
 * Component tests for highlights in the reader — recovery, persistence
 * and paint reconciliation.
 *
 * The storage layer is faked at the repository boundary and the reader
 * at the handle boundary, which is where both are in production too.
 * What is under test is the routing, because that is where a highlight
 * can be lost or duplicated in ways no unit test of the layers below
 * could see:
 *
 *   - `resolveAnchor` answering `null` must keep the row. It is a fact
 *     about the file, not about whether the highlight exists, and a
 *     reader who opened a shorter copy of the book must not lose marks.
 *   - A `replaceHighlightAnchor` that reported `false` means the
 *     repository knows the row is gone. Painting it would resurrect a
 *     deleted highlight from a list that is already out of date.
 *   - A page disagreement between the row and the resolution is an
 *     integrity failure, detectable without reading the payload, and
 *     nothing is painted or written for it.
 *   - Reconciliation is per row: a highlight appearing must not stack a
 *     second overlay over one that is already correct, a deleted one must
 *     take its overlay down, and a re-render must repaint without
 *     redrawing the page.
 *   - A paint that could not be drawn removes what was there before,
 *     rather than leaving a stale overlay beside the truth.
 *
 * The overlays' *geometry* — whether a fragment lands on its glyphs — is
 * the browser's business and belongs to `scripts/smoke-reader.mjs`.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex } from '../domain/reading-state.ts';
import type { PaintedAnchor, ReaderHandle, ResolvedAnchor } from '../reader/types.ts';
import { useUiStore } from '../stores/ui-store.ts';
import { ReaderView } from './reader-view.tsx';

const DOC_ID = asDocumentId('00000000-0000-4000-8000-0000000000ee');
const FINGERPRINT = asSourceFingerprint('e'.repeat(64));
const PAGE_COUNT = 3;

/** One fragment per resolved anchor, so a painted row is one box. */
const FRAGMENT = { x: 10, y: 20, width: 30, height: 12 };

interface StoredRow {
	id: string;
	pageIndex: number;
	color: string;
}

const stored: StoredRow[] = [];
/** What `replaceHighlightAnchor` should report, per id. */
const writeBacks = new Map<string, boolean>();
let resolve: (anchor: Anchor) => Promise<ResolvedAnchor | null> = async () => null;

vi.mock('../storage/highlights-repo.ts', () => ({
	listHighlights: async () =>
		stored.map((row) => ({
			id: row.id,
			documentId: DOC_ID,
			sourceFingerprint: FINGERPRINT,
			pageIndex: asPageIndex(row.pageIndex),
			anchor: { format: 'pdf', payload: { id: row.id } },
			selectedText: row.id,
			color: row.color,
			createdAt: 1,
		})),
	replaceHighlightAnchor: async (id: string) => writeBacks.get(id) ?? true,
}));

vi.mock('../storage/bookmarks-repo.ts', () => ({
	listBookmarks: async () => [],
	addBookmark: vi.fn(),
	deleteBookmark: vi.fn(),
}));

vi.mock('../storage/reading-state-repo.ts', () => ({
	saveReadingPosition: vi.fn(async () => {}),
	getReadingProgress: vi.fn(async () => null),
	deleteReadingProgress: vi.fn(async () => false),
}));

/** Painted overlays, so a test can count them and find their owners. */
let overlays: PaintedAnchor[] = [];

/**
 * A page that behaves like the real one about *when* it may be painted.
 *
 * The real `PdfPageHandle` drops its remembered transform the moment a
 * render starts, because the target is about to be rebuilt, and refuses
 * to paint until a render completes. A fake that painted unconditionally
 * hid that contract, and with it a bug where an ordinary zoom raised a
 * render alert: the render effect and the paint effect re-run in the same
 * commit, so the paint asked a page whose transform had just been
 * dropped.
 */
let renderSettled = false;
/** Held open to stand in for a render that has not finished. */
let pendingRender: { promise: Promise<void>; resolve: () => void } | null = null;

const fakePage = {
	format: 'pdf',
	render: vi.fn(async (target: HTMLElement) => {
		renderSettled = false;
		if (pendingRender !== null) {
			// A render in flight, standing in for a slow one.
			await pendingRender.promise;
			pendingRender = null;
		}
		target.replaceChildren();
		const page = document.createElement('div');
		page.className = 'rm-page';
		page.style.width = '420px';
		page.style.height = '600px';
		target.appendChild(page);
		renderSettled = true;
	}),
	text: vi.fn(async () => ({ format: 'pdf', page: asPageIndex(1), items: [] })),
	createAnchorFromSelection: vi.fn(async () => null),
	paintResolvedAnchor: vi.fn(async (anchor: ResolvedAnchor, target: HTMLElement) => {
		if (!renderSettled) {
			throw new Error('readmark: paintResolvedAnchor called before the page finished rendering');
		}
		if (anchor.display === 'unpaintable') return null;
		const element = document.createElement('div');
		element.className = 'rm-highlight';
		element.dataset.freshness = anchor.freshness;
		const box = target.querySelector('.rm-page') as HTMLElement;
		const fragment = document.createElement('div');
		fragment.className = 'rm-highlight__fragment';
		fragment.style.left = `${FRAGMENT.x}px`;
		fragment.style.top = `${FRAGMENT.y}px`;
		box.appendChild(element);
		element.appendChild(fragment);
		const painted: PaintedAnchor = {
			element,
			remove: () => {
				element.remove();
				overlays = overlays.filter((candidate) => candidate !== painted);
			},
		};
		overlays.push(painted);
		return painted;
	}),
} as unknown as ReturnType<typeof Object> & Record<string, unknown>;

const fakeHandle = {
	format: 'pdf',
	pageCount: vi.fn(async () => PAGE_COUNT),
	page: vi.fn(async () => fakePage),
	resolveAnchor: vi.fn((anchor: Anchor) => resolve(anchor)),
	close: vi.fn(async () => {}),
} as unknown as ReaderHandle<'pdf'>;

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
});

beforeEach(() => {
	stored.length = 0;
	writeBacks.clear();
	overlays = [];
	renderSettled = false;
	pendingRender = null;
	resolve = async () => null;
	useUiStore.setState({ sidePanel: 'none' });
	vi.mocked(fakePage.paintResolvedAnchor).mockClear();
	vi.mocked(fakePage.render).mockClear();
	vi.mocked(fakeHandle.resolveAnchor).mockClear();
});

function row(over: Partial<StoredRow> = {}): StoredRow {
	return { id: 'h1', pageIndex: 1, color: 'yellow', ...over };
}

/** A resolution for a stored row, as `resolveAnchor` would hand it back. */
function resolved(over: Partial<ResolvedAnchor> = {}): ResolvedAnchor {
	return {
		format: 'pdf',
		page: asPageIndex(1),
		freshness: 'fresh',
		selectedText: 'the cat',
		display: FRAGMENT,
		updatedAnchor: null,
		...over,
	};
}

function view(fingerprint: string) {
	return (
		<MemoryRouter>
			<ReaderView
				handle={fakeHandle}
				pageCount={PAGE_COUNT}
				title="吾輩は猫である"
				documentId={DOC_ID}
				sourceFingerprint={asSourceFingerprint(fingerprint)}
				initialPosition={null}
			/>
		</MemoryRouter>
	);
}

function renderReader() {
	return render(view('e'.repeat(64)));
}

/** A different source identity, which is the only thing that re-runs
 *  resolution. Rows do not appear and disappear inside one open — they
 *  are read once per source — so a test that wants a new row set asks
 *  for a new source rather than poking state. */
const ANOTHER_SOURCE = 'f'.repeat(64);

async function settle(): Promise<void> {
	await act(async () => {
		await new Promise((resolve_) => setTimeout(resolve_, 0));
		await new Promise((resolve_) => setTimeout(resolve_, 0));
	});
}

describe('resolving highlights on open', () => {
	it('paints a highlight the reader resolved, with its colour on the overlay', async () => {
		stored.push(row());
		resolve = async () => resolved();

		renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));

		// The colour goes on this overlay and not on the page host, so two
		// highlights on one page can differ.
		expect(overlays[0]?.element.dataset.highlightColor).toBe('yellow');
		expect(
			(screen.getByTestId('rm-reader-scroll').querySelector('[data-page-index="1"]') as HTMLElement)
				.dataset.highlightColor,
		).toBeUndefined();
	});

	it('falls back to a known colour for a name this build does not know', async () => {
		stored.push(row({ color: 'chartreuse' }));
		resolve = async () => resolved();

		renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));

		// An unknown stored name is not drawn as an arbitrary colour.
		expect(overlays[0]?.element.dataset.highlightColor).toBe('yellow');
	});

	it('keeps a row it cannot resolve, and paints nothing for it', async () => {
		stored.push(row());
		resolve = async () => null;

		renderReader();
		await settle();

		// `null` says this reader cannot resolve this anchor against this
		// source. Deleting the row would throw away a reader's work over a
		// file they may not have the whole of.
		expect(overlays).toHaveLength(0);
		expect(vi.mocked(fakeHandle.resolveAnchor)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(fakePage.paintResolvedAnchor)).not.toHaveBeenCalled();
	});

	it('paints nothing and writes nothing when the row and the resolution disagree about the page', async () => {
		stored.push(row({ pageIndex: 2 }));
		resolve = async () => resolved({ page: asPageIndex(1) });

		renderReader();
		await settle();

		// An integrity failure, detectable without reading the payload.
		expect(overlays).toHaveLength(0);
		expect(vi.mocked(fakePage.paintResolvedAnchor)).not.toHaveBeenCalled();
	});

	it('writes the refreshed anchor back, and paints the result', async () => {
		stored.push(row());
		resolve = async () => resolved({ updatedAnchor: { format: 'pdf', payload: {} } });
		writeBacks.set('h1', true);

		renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));
	});

	it('does not paint a row the write-back reported is gone', async () => {
		stored.push(row());
		resolve = async () => resolved({ updatedAnchor: { format: 'pdf', payload: {} } });
		// The repository says the row is no longer there — another tab, or
		// the reader themselves. Painting it would resurrect a deleted
		// highlight from a list that is already out of date.
		writeBacks.set('h1', false);

		renderReader();
		await settle();

		expect(overlays).toHaveLength(0);
		expect(vi.mocked(fakePage.paintResolvedAnchor)).not.toHaveBeenCalled();
	});

	it('does not re-resolve when the reader zooms', async () => {
		stored.push(row());
		resolve = async () => resolved();
		renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));
		const resolutions = vi.mocked(fakeHandle.resolveAnchor).mock.calls.length;

		// Recovery answers "is this anchor still where it was in this
		// file", and the file does not change when the reader zooms.
		// Re-running it would be a quote search and a re-measurement per
		// page per zoom step, for an answer that cannot have changed.
		await act(async () => {
			screen.getByTestId('rm-zoom-in').click();
		});
		await settle();

		expect(vi.mocked(fakeHandle.resolveAnchor).mock.calls.length).toBe(resolutions);
	});
});

describe('paint reconciliation', () => {
	it('does not stack a second overlay over one that is already correct', async () => {
		stored.push(row());
		resolve = async () => resolved();
		renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));
		const paintsAfterFirst = vi.mocked(fakePage.paintResolvedAnchor).mock.calls.length;

		// Something else in the view re-renders: the effect re-runs with
		// the same rows, and the same resolved anchor against the same
		// render is the same overlay. Two translucent fills over the same
		// words reads as a darker highlight, not as work.
		await act(async () => {
			useUiStore.setState({ sidePanel: 'bookmarks' });
		});
		await settle();

		expect(overlays).toHaveLength(1);
		expect(vi.mocked(fakePage.paintResolvedAnchor).mock.calls.length).toBe(paintsAfterFirst);
	});

	it('repaints after a re-render, without redrawing the page for a highlight change', async () => {
		stored.push(row());
		resolve = async () => resolved();
		renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));
		const rendersBefore = vi.mocked(fakePage.render).mock.calls.length;

		// A zoom is a re-render, and the overlay underneath is now against
		// a different canvas — so it is repainted.
		await act(async () => {
			screen.getByTestId('rm-zoom-in').click();
		});
		await waitFor(() => expect(overlays).toHaveLength(1));
		expect(vi.mocked(fakePage.render).mock.calls.length).toBeGreaterThan(rendersBefore);
		// One at a time: the old overlay went before the new one arrived,
		// so there is never a moment with two.
		expect(overlays).toHaveLength(1);
	});

	it('takes the overlay down when the row disappears', async () => {
		stored.push(row());
		resolve = async () => resolved();
		const { rerender } = renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));

		// The row is gone by the time the next resolution happens — a
		// reader who deleted it in another tab, or a source that no longer
		// carries it. The overlay goes with it.
		stored.length = 0;
		await act(async () => {
			rerender(view(ANOTHER_SOURCE));
		});
		await waitFor(() => expect(overlays).toHaveLength(0));
	});

	it('takes down what it drew before when a paint can no longer be drawn', async () => {
		stored.push(row());
		resolve = async () => resolved();
		const { rerender } = renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));

		// The next resolution is one this page cannot paint — a row whose
		// display came from a version it does not recognise. Leaving the
		// earlier overlay would show a highlight the reader does not have.
		resolve = async () => resolved({ display: 'unpaintable' as never });
		await act(async () => {
			rerender(view(ANOTHER_SOURCE));
		});
		await waitFor(() => expect(overlays).toHaveLength(0));
	});

	it('does not paint while a render is in flight, and repaints after it', async () => {
		stored.push(row());
		resolve = async () => resolved();
		// The first render is still running when the rows arrive. Both are
		// I/O — a page parse and a store read — so either can win, and
		// "rows arrived first" is the ordinary case on a cold open.
		let release = (): void => {};
		pendingRender = {
			promise: new Promise<void>((resolve_) => {
				release = () => {
					resolve_();
				};
			}),
			resolve: () => {},
		};

		renderReader();
		await waitFor(() => expect(stored).toHaveLength(1));
		await settle();

		// The paint must not have gone ahead of the render: the page has no
		// transform to convert through, and asking anyway is a programming
		// error the reader would see as a render alert.
		expect(renderSettled).toBe(false);
		expect(overlays).toHaveLength(0);
		expect(screen.queryByTestId('rm-reader-error')).toBeNull();

		await act(async () => {
			release();
		});
		// The completed render's epoch bump is what brings the paint back.
		await waitFor(() => expect(overlays).toHaveLength(1));
		expect(screen.queryByTestId('rm-reader-error')).toBeNull();
	});

	it('does not repaint mid-zoom', async () => {
		stored.push(row());
		resolve = async () => resolved();
		renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));

		// A zoom changes `options`, which re-runs the render effect. The
		// paint effect does not depend on options, so it does not re-run
		// mid-zoom at all — the prop identity of a page's rows is stable,
		// and the completed render's epoch is what brings it back.
		let release = (): void => {};
		pendingRender = {
			promise: new Promise<void>((resolve_) => {
				release = () => {
					resolve_();
				};
			}),
			resolve: () => {},
		};
		await act(async () => {
			screen.getByTestId('rm-zoom-in').click();
		});
		await settle();
		expect(renderSettled).toBe(false);
		expect(overlays).toHaveLength(1);
		expect(screen.queryByTestId('rm-reader-error')).toBeNull();

		await act(async () => {
			release();
		});
		await waitFor(() => expect(renderSettled).toBe(true));
		// Repainted against the new canvas, and still exactly one overlay.
		await waitFor(() => expect(overlays).toHaveLength(1));
		expect(screen.queryByTestId('rm-reader-error')).toBeNull();
	});

	it('does not paint rows that arrive while a re-render is in flight', async () => {
		stored.push(row());
		resolve = async () => resolved();
		const { rerender } = renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));

		// A zoom starts a render that has not finished, and the rows change
		// while it is in flight: a fresh resolution for the same page. Both
		// are ordinary — a re-render is I/O, and a resolution is I/O — and
		// the two overlapping is what an impatient reader on a slow
		// document produces.
		let release = (): void => {};
		pendingRender = {
			promise: new Promise<void>((resolve_) => {
				release = () => {
					resolve_();
				};
			}),
			resolve: () => {},
		};
		await act(async () => {
			screen.getByTestId('rm-zoom-in').click();
		});
		await settle();
		expect(renderSettled).toBe(false);

		// The rows change: a new resolution, so a new `ResolvedAnchor` and
		// a paint the view wants to do now.
		resolve = async () => resolved({ selectedText: 'the cat sat down' });
		await act(async () => {
			rerender(view(ANOTHER_SOURCE));
		});
		await settle();

		// The page still has no transform — the render dropped it when it
		// started — so nothing may be painted, and nothing may be reported
		// as broken.
		expect(renderSettled).toBe(false);
		expect(screen.queryByTestId('rm-reader-error')).toBeNull();

		await act(async () => {
			release();
		});
		await waitFor(() => expect(overlays).toHaveLength(1));
		expect(screen.queryByTestId('rm-reader-error')).toBeNull();
	});

	it('removes every overlay when the view goes away', async () => {
		stored.push(row(), row({ id: 'h2', pageIndex: 2 }));
		resolve = async () => resolved();
		const { unmount } = renderReader();
		await waitFor(() => expect(overlays).toHaveLength(1));

		await act(async () => {
			unmount();
		});

		// A page view's overlays are its own; leaving them behind would
		// paint a highlight onto a page nobody owns any more.
		expect(document.querySelectorAll('.rm-highlight')).toHaveLength(0);
	});
});
