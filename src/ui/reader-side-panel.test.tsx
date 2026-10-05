/**
 * Component tests for the side panel's shell.
 *
 * The shell is the piece of Issue #9 that a unit test of the three
 * lists cannot cover, because it is the only thing that knows about
 * more than one of them. What it owns:
 *
 *   - The three tabs switch, and the tab that is showing is the tab
 *     marked selected. Two lists can both be mounted and both look
 *     fine; what a reader notices is the *wrong* one being on screen.
 *   - Each tab carries a count, and the count is the length of the
 *     array that tab's list renders. If the shell had a way to label a
 *     list with a number from anywhere but that list, the acceptance
 *     criterion 「パネル内の count が Library と一致する」 would be
 *     decorative — so the test asserts the number against the rows
 *     actually on screen, not against the prop it was given.
 *   - A narrow viewport turns the panel into an overlay, and an
 *     overlay that is not a dialog is a trap: focus walks into a page
 *     the reader cannot see, and there is no way back out. So the four
 *     dismissal and focus paths are each asserted.
 *   - A wide panel must NOT get that treatment. Trapping focus in a
 *     column beside the document would stop the reader reaching the
 *     thing they opened the app to read.
 *
 * The child passed in here is a real panel, not a stub, so "the count
 * matches the list" is a claim about the two real halves agreeing.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex, type Bookmark, type Highlight, type Note } from '../domain/reading-state.ts';
import { BookmarksPanel } from './bookmarks-panel.tsx';
import { HighlightsPanel } from './highlights-panel.tsx';
import { NotesPanel } from './notes-panel.tsx';
import { ReaderSidePanel } from './reader-side-panel.tsx';

const DOC = asDocumentId('00000000-0000-4000-8000-0000000000c1');
const FINGERPRINT = asSourceFingerprint('f'.repeat(64));

const realMatchMedia = window.matchMedia;

/**
 * Take control of the narrow-viewport query.
 *
 * happy-dom implements `matchMedia` but answers `matches: false` for
 * everything, so the wide case is what a test gets for free and the
 * narrow case has to be installed. Replacing the function rather than
 * trying to change the width keeps the two cases in one file without
 * each test having to know how the other one got there.
 */
function setNarrowViewport(narrow: boolean): void {
	window.matchMedia = ((query: string): MediaQueryList => {
		const listeners = new Set<(event: MediaQueryListEvent) => void>();
		return {
			media: query,
			matches: narrow,
			onchange: null,
			addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
				listeners.add(listener);
			},
			removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
				listeners.delete(listener);
			},
			dispatchEvent: () => false,
		} as unknown as MediaQueryList;
	}) as typeof window.matchMedia;
}

/** The repo does not load jest-dom, so the assertions here stay on the
 *  DOM's own properties rather than on a matcher layer this file would
 *  then be the only user of. */
function attr(node: Element, name: string): string | null {
	return node.getAttribute(name);
}

function present(node: Element | null): boolean {
	return node !== null;
}

/**
 * Whether the panel's Tab handler claimed the key.
 *
 * happy-dom has no browser Tab, so "focus moved" cannot be asserted in
 * the middle of a cycle — the component deliberately leaves that to the
 * browser. What it owns, and what is asserted, is *whether it took the
 * key*: claiming it at the two ends of the cycle is the trap-avoidance,
 * and claiming it anywhere else would make half the panel unreachable.
 */
function claimed(node: Element, init: { key: string; shiftKey?: boolean }): boolean {
	const event = new KeyboardEvent('keydown', {
		key: init.key,
		shiftKey: init.shiftKey ?? false,
		bubbles: true,
		cancelable: true,
	});
	node.dispatchEvent(event);
	return event.defaultPrevented;
}

beforeEach(() => {
	setNarrowViewport(false);
});

afterEach(() => {
	window.matchMedia = realMatchMedia;
});

let sequence = 0;

function bookmark(pageIndex: number, title = ''): Bookmark {
	return {
		id: `bm-${++sequence}`,
		documentId: DOC,
		sourceFingerprint: FINGERPRINT,
		pageIndex: asPageIndex(pageIndex),
		title,
		anchor: null,
		position: null,
		createdAt: sequence,
	};
}

function anchorOn(page: number): Anchor {
	return { format: 'pdf', payload: { page, rects: [{ x: 1, y: 1, width: 2, height: 2 }] } };
}

function highlight(pageIndex: number, selectedText: string): Highlight {
	return {
		id: `hl-${++sequence}`,
		documentId: DOC,
		sourceFingerprint: FINGERPRINT,
		pageIndex: asPageIndex(pageIndex),
		anchor: anchorOn(pageIndex),
		selectedText,
		color: 'yellow',
		createdAt: sequence,
	};
}

function note(body: string): Note {
	return {
		id: `note-${++sequence}`,
		kind: 'free',
		documentId: DOC,
		body,
		highlightId: null,
		createdAt: sequence,
		updatedAt: sequence,
	};
}

/**
 * The three lists, wired the way `reader-view.tsx` wires them.
 *
 * The counts are built from the same arrays the panels are handed, so
 * the test is asserting the shell honours that arrangement rather than
 * proving the arrangement itself. What it does prove is that the
 * number a reader reads on the tab equals the number of rows on
 * screen — which is the acceptance criterion, and which would fail if
 * the shell ever grew a count of its own.
 */
function renderShell(active: 'bookmarks' | 'highlights' | 'notes') {
	const bookmarks = [bookmark(1), bookmark(2, '第二章の栞')];
	const highlights = [highlight(1, '吾輩は猫である')];
	const notes = [note(' Concerned about a note ')];

	function onSelect(panel: 'bookmarks' | 'highlights' | 'notes') {
		return render(
			<ReaderSidePanel
				active={panel}
				counts={{
					bookmarks: bookmarks.length,
					highlights: highlights.length,
					notes: notes.length,
				}}
				onSelect={onSelect}
				onClose={vi.fn()}
			>
				{panel === 'bookmarks' && (
					<BookmarksPanel
						bookmarks={bookmarks}
						documentTitle="吾輩は猫である"
						onJump={vi.fn()}
						onDelete={vi.fn()}
					/>
				)}
				{panel === 'highlights' && (
					<HighlightsPanel
						entries={highlights.map((row) => ({ highlight: row, state: 'ready', notes: [] }))}
						documentTitle="吾輩は猫である"
						onJump={vi.fn()}
						onDelete={vi.fn()}
					/>
				)}
				{panel === 'notes' && (
					<NotesPanel
						notes={notes}
						documentTitle="吾輩は猫である"
						editor={{ kind: 'closed' }}
						onStartCreate={vi.fn()}
						onEdit={vi.fn()}
						onCancelEdit={vi.fn()}
						onSubmit={vi.fn()}
						onJump={vi.fn()}
						onDelete={vi.fn()}
					/>
				)}
			</ReaderSidePanel>,
		);
	}

	return { bookmarks, highlights, notes, render: () => onSelect(active) };
}

describe('side panel tabs', () => {
	it('shows the bookmarks list and marks only that tab selected', () => {
		renderShell('bookmarks').render();

		expect(present(screen.queryByTestId('rm-bookmarks-panel'))).toBe(true);
		expect(attr(screen.getByTestId('rm-side-tab-bookmarks'), 'aria-selected')).toBe('true');
		expect(attr(screen.getByTestId('rm-side-tab-highlights'), 'aria-selected')).toBe('false');
		expect(attr(screen.getByTestId('rm-side-tab-notes'), 'aria-selected')).toBe('false');
	});

	it('switches to the highlights list, and the previous list is gone', () => {
		renderShell('highlights').render();

		expect(present(screen.queryByTestId('rm-highlights-panel'))).toBe(true);
		expect(present(screen.queryByTestId('rm-bookmarks-panel'))).toBe(false);
		expect(present(screen.queryByTestId('rm-notes-panel'))).toBe(false);
	});

	it('switches to the notes list, and the previous list is gone', () => {
		renderShell('notes').render();

		expect(present(screen.queryByTestId('rm-notes-panel'))).toBe(true);
		expect(present(screen.queryByTestId('rm-bookmarks-panel'))).toBe(false);
		expect(present(screen.queryByTestId('rm-highlights-panel'))).toBe(false);
	});

	it('names the showing tab as the tabpanel, so the two are linked for a screen reader', () => {
		renderShell('highlights').render();

		expect(attr(screen.getByTestId('rm-side-panel-body'), 'aria-label')).toBe('ハイライト');
	});

	it('puts only the selected tab in the Tab order', () => {
		renderShell('bookmarks').render();

		expect(attr(screen.getByTestId('rm-side-tab-bookmarks'), 'tabindex')).toBe('0');
		expect(attr(screen.getByTestId('rm-side-tab-highlights'), 'tabindex')).toBe('-1');
		expect(attr(screen.getByTestId('rm-side-tab-notes'), 'tabindex')).toBe('-1');
	});
});

/**
 * The count invariant, asserted the only way it can fail honestly:
 * against the rows on screen.
 */
describe('panel counts', () => {
	it('labels the bookmarks tab with the number of rows that list shows', () => {
		renderShell('bookmarks').render();

		const rows = within(screen.getByTestId('rm-bookmarks-list')).getAllByTestId('rm-bookmark-jump');
		expect(screen.getByTestId('rm-side-tab-count-bookmarks').textContent).toBe(String(rows.length));
		expect(screen.getByTestId('rm-bookmarks-count').textContent).toBe(`${rows.length} 件`);
	});

	it('labels the highlights tab with the number of rows that list shows', () => {
		renderShell('highlights').render();

		const rows = within(screen.getByTestId('rm-highlights-list')).getAllByTestId(
			'rm-highlight-row',
		);
		expect(screen.getByTestId('rm-side-tab-count-highlights').textContent).toBe(
			String(rows.length),
		);
		expect(screen.getByTestId('rm-highlights-count').textContent).toBe(`${rows.length} 件`);
	});

	it('labels the notes tab with the number of rows that list shows', () => {
		renderShell('notes').render();

		const rows = within(screen.getByTestId('rm-notes-list')).getAllByTestId('rm-note-row');
		expect(screen.getByTestId('rm-side-tab-count-notes').textContent).toBe(String(rows.length));
		expect(screen.getByTestId('rm-notes-count').textContent).toBe(`${rows.length} 件`);
	});

	it('says 0 on an empty list, rather than showing nothing', () => {
		render(
			<ReaderSidePanel
				active="bookmarks"
				counts={{ bookmarks: 0, highlights: 0, notes: 0 }}
				onSelect={vi.fn()}
				onClose={vi.fn()}
			>
				<BookmarksPanel bookmarks={[]} documentTitle="空" onJump={vi.fn()} onDelete={vi.fn()} />
			</ReaderSidePanel>,
		);

		expect(screen.getByTestId('rm-side-tab-count-bookmarks').textContent).toBe('0');
		expect(screen.getByTestId('rm-bookmarks-count').textContent).toBe('0 件');
		expect(present(screen.queryByTestId('rm-bookmarks-empty-panel'))).toBe(true);
	});
});

describe('narrow viewport', () => {
	it('keeps the panel a column beside the document when there is room', () => {
		renderShell('bookmarks').render();

		expect(present(screen.queryByTestId('rm-side-panel'))).toBe(true);
		expect(present(screen.queryByTestId('rm-side-panel-overlay'))).toBe(false);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('does not trap focus in the wide case — a column is not modal', () => {
		renderShell('bookmarks').render();

		// Nothing owns focus: a wide panel leaves the reader free to Tab
		// straight into the scroller beside it.
		expect(document.activeElement).toBe(document.body);
	});

	it('becomes a modal dialog when the viewport is too narrow', () => {
		setNarrowViewport(true);
		renderShell('bookmarks').render();

		expect(present(screen.queryByTestId('rm-side-panel-overlay'))).toBe(true);
		expect(present(screen.queryByTestId('rm-side-panel'))).toBe(false);
		const dialog = screen.getByRole('dialog');
		expect(attr(dialog, 'aria-modal')).toBe('true');
		expect(attr(dialog, 'aria-label')).toBe('サイドパネル');
		// The list itself survives the layout change unchanged.
		expect(present(screen.queryByTestId('rm-bookmarks-panel'))).toBe(true);
	});

	it('moves focus into the sheet, so the reader is not left behind it', () => {
		setNarrowViewport(true);
		renderShell('bookmarks').render();

		expect(document.activeElement).toBe(screen.getByTestId('rm-side-panel-dialog'));
	});

	it('closes on Escape, from anywhere inside the panel', async () => {
		setNarrowViewport(true);
		const onClose = vi.fn();
		render(
			<ReaderSidePanel
				active="bookmarks"
				counts={{ bookmarks: 1, highlights: 0, notes: 0 }}
				onSelect={vi.fn()}
				onClose={onClose}
			>
				<BookmarksPanel
					bookmarks={[bookmark(1)]}
					documentTitle="本"
					onJump={vi.fn()}
					onDelete={vi.fn()}
				/>
			</ReaderSidePanel>,
		);

		// From the sheet itself, and from a control inside it — a note
		// being half-written is not a reason the reader cannot back out.
		fireEvent.keyDown(screen.getByTestId('rm-side-panel-dialog'), { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);

		fireEvent.keyDown(screen.getByTestId('rm-bookmark-jump'), { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it('closes when the scrim is clicked', () => {
		setNarrowViewport(true);
		const onClose = vi.fn();
		render(
			<ReaderSidePanel
				active="bookmarks"
				counts={{ bookmarks: 0, highlights: 0, notes: 0 }}
				onSelect={vi.fn()}
				onClose={onClose}
			>
				<BookmarksPanel bookmarks={[]} documentTitle="本" onJump={vi.fn()} onDelete={vi.fn()} />
			</ReaderSidePanel>,
		);

		fireEvent.click(screen.getByTestId('rm-side-panel-scrim'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('keeps the scrim out of the Tab order and out of the accessibility tree', () => {
		setNarrowViewport(true);
		renderShell('bookmarks').render();

		const scrim = screen.getByTestId('rm-side-panel-scrim');
		expect(attr(scrim, 'aria-hidden')).toBe('true');
		expect(attr(scrim, 'tabindex')).toBeNull();
		expect(attr(scrim, 'role')).toBeNull();
	});

	it('cycles Tab inside the sheet instead of escaping onto the page', () => {
		setNarrowViewport(true);
		renderShell('bookmarks').render();

		const dialog = screen.getByTestId('rm-side-panel-dialog');
		const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')];
		expect(focusable.length).toBeGreaterThan(1);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		// Forward from the last wraps to the first.
		last?.focus();
		fireEvent.keyDown(dialog, { key: 'Tab' });
		expect(document.activeElement).toBe(first);

		// Backward from the first wraps to the last.
		fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
		expect(document.activeElement).toBe(last);
	});

	it('claims Tab only at the two ends, and lets the browser walk the middle', () => {
		setNarrowViewport(true);
		renderShell('bookmarks').render();

		const dialog = screen.getByTestId('rm-side-panel-dialog');
		const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')];
		expect(focusable.length).toBeGreaterThan(2);
		const first = focusable[0];
		const middle = focusable[1];
		const last = focusable[focusable.length - 1];

		// In the middle, the handler must not claim the key: the browser's
		// own Tab is what moves focus there, and a handler that
		// intercepted it would stop a reader reaching half the panel.
		middle?.focus();
		expect(claimed(dialog, { key: 'Tab' })).toBe(false);

		// At the ends it must, or focus walks out of the overlay.
		last?.focus();
		expect(claimed(dialog, { key: 'Tab' })).toBe(true);
		expect(document.activeElement).toBe(first);

		fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
		expect(document.activeElement).toBe(last);
	});

	it('leaves a key it does not handle alone', () => {
		setNarrowViewport(true);
		const onClose = vi.fn();
		render(
			<ReaderSidePanel
				active="bookmarks"
				counts={{ bookmarks: 0, highlights: 0, notes: 0 }}
				onSelect={vi.fn()}
				onClose={onClose}
			>
				<BookmarksPanel bookmarks={[]} documentTitle="本" onJump={vi.fn()} onDelete={vi.fn()} />
			</ReaderSidePanel>,
		);

		const dialog = screen.getByTestId('rm-side-panel-dialog');
		const first = dialog.querySelector<HTMLElement>('button:not([disabled])');
		first?.focus();
		// A reader typing into a note body must still get their Tab; the
		// cycle only claims the key at the two ends.
		expect(claimed(dialog, { key: 'a' })).toBe(false);
		expect(onClose).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(first);
	});

	it('gives focus back to whatever opened it when the overlay goes away', async () => {
		setNarrowViewport(true);
		const opener = document.createElement('button');
		opener.textContent = 'open';
		document.body.appendChild(opener);
		opener.focus();

		const { unmount } = render(
			<ReaderSidePanel
				active="bookmarks"
				counts={{ bookmarks: 0, highlights: 0, notes: 0 }}
				onSelect={vi.fn()}
				onClose={vi.fn()}
			>
				<BookmarksPanel bookmarks={[]} documentTitle="本" onJump={vi.fn()} onDelete={vi.fn()} />
			</ReaderSidePanel>,
		);
		await waitFor(() => expect(document.activeElement).not.toBe(opener));

		unmount();
		await waitFor(() => expect(document.activeElement).toBe(opener));
		opener.remove();
	});

	it('still switches tabs while it is an overlay', () => {
		setNarrowViewport(true);
		const { rerender } = renderShell('bookmarks').render();

		expect(present(screen.queryByTestId('rm-bookmarks-panel'))).toBe(true);
		rerender(
			<ReaderSidePanel
				active="notes"
				counts={{ bookmarks: 2, highlights: 1, notes: 1 }}
				onSelect={vi.fn()}
				onClose={vi.fn()}
			>
				<NotesPanel
					notes={[note('メモ')]}
					documentTitle="本"
					editor={{ kind: 'closed' }}
					onStartCreate={vi.fn()}
					onEdit={vi.fn()}
					onCancelEdit={vi.fn()}
					onSubmit={vi.fn()}
					onJump={vi.fn()}
					onDelete={vi.fn()}
				/>
			</ReaderSidePanel>,
		);

		expect(present(screen.queryByTestId('rm-notes-panel'))).toBe(true);
		expect(present(screen.queryByTestId('rm-bookmarks-panel'))).toBe(false);
		// The overlay survives the switch — switching a list is not closing.
		expect(present(screen.queryByTestId('rm-side-panel-dialog'))).toBe(true);
	});
});
