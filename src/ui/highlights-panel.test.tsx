/**
 * Component tests for the highlights side panel.
 *
 * The highlights list is the third of the three and the one whose rows
 * are the reader's own words rather than a position, so it is the one
 * where "this row is broken" is hardest to see. Under test:
 *
 *   - The count is the list. Asserted against the rows on screen, not
 *     against the prop — a count derived from a second source is the
 *     exact failure the panel exists to prevent, and only a rendered
 *     row count can catch it.
 *   - Orphans are a state, not an absence. A highlight the reader
 *     cannot place, or whose row the repository reports deleted, stays
 *     on screen, stays in the count, and says which of the two it is.
 *     A panel that silently dropped them would be indistinguishable
 *     from one that had no such rows.
 *   - A row that cannot be jumped to has no jump button at all — not a
 *     disabled one, which reads as the app refusing rather than as
 *     there being nothing to go to.
 *   - A jump that fell back to the page is surfaced on the row, and
 *     one that had nowhere to go is worded differently. A reader
 *     cannot otherwise tell "moved to the page" from "did nothing".
 *   - The notes on a highlight stay visible even when the highlight
 *     itself is gone: the mark is a reference, the note is the
 *     reader's own writing.
 *
 * The panel is presentational on purpose, so this file needs no storage
 * fake: `state` is passed in, and the translation of the reader's
 * resolution into these three answers is `reader-view.tsx`'s, tested
 * in `side-panels-integration.test.tsx`.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../domain/annotation/index.ts';
import { asDocumentId, asSourceFingerprint } from '../domain/document.ts';
import { asPageIndex, type Highlight, type Note } from '../domain/reading-state.ts';
import { type HighlightPanelEntry, HighlightsPanel } from './highlights-panel.tsx';
import { PANEL_ENTRY_NOTICE, panelEntryIsJumpable } from './panel-entry.ts';

const DOC = asDocumentId('00000000-0000-4000-8000-0000000000b2');
const FINGERPRINT = asSourceFingerprint('a'.repeat(64));
const TITLE = '吾輩は猫である';

let sequence = 0;

/** A stored anchor on a given page. A highlight is made from a
 *  selection, so it always carries one — the fake resolver has a page
 *  to answer about, which is what makes per-row state testable. */
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

function note(body: string, highlightId: string | null = null): Note {
	return {
		id: `note-${++sequence}`,
		kind: 'free',
		documentId: DOC,
		body,
		highlightId,
		createdAt: sequence,
		updatedAt: sequence,
	};
}

function entry(
	row: Highlight,
	state: HighlightPanelEntry['state'],
	notes: readonly Note[] = [],
): HighlightPanelEntry {
	return { highlight: row, state, notes };
}

function renderPanel(
	entries: readonly HighlightPanelEntry[],
	overrides: Partial<{
		jumpFailures: ReadonlyMap<string, string>;
		onJump: (highlight: Highlight) => void;
		onDelete: (highlight: Highlight) => void;
	}> = {},
) {
	const onJump = overrides.onJump ?? vi.fn();
	const onDelete = overrides.onDelete ?? vi.fn();
	// `exactOptionalPropertyTypes` is on, so an absent prop and a prop
	// explicitly set to `undefined` are different things. Spread the
	// optional one in only when the test actually supplied it.
	render(
		<HighlightsPanel
			entries={entries}
			documentTitle={TITLE}
			{...(overrides.jumpFailures === undefined ? {} : { jumpFailures: overrides.jumpFailures })}
			onJump={onJump}
			onDelete={onDelete}
		/>,
	);
	return { onJump, onDelete };
}

function rows(): HTMLElement[] {
	return screen.getAllByTestId('rm-highlight-row');
}

beforeEach(() => {
	sequence = 0;
});

describe('the count is the list', () => {
	it('counts every row it shows, on an empty list too', () => {
		renderPanel([]);

		expect(screen.getByTestId('rm-highlights-count').textContent).toBe('0 件');
		expect(screen.getByTestId('rm-highlights-empty-panel')).toBeTruthy();
	});

	it('counts the rows actually on screen', () => {
		renderPanel([
			entry(highlight(1, '一つ'), 'ready'),
			entry(highlight(2, '二つ'), 'ready'),
			entry(highlight(3, '三つ'), 'ready'),
		]);

		expect(rows().length).toBe(3);
		expect(screen.getByTestId('rm-highlights-count').textContent).toBe('3 件');
	});

	/**
	 * The case the criterion is really about: the count and the list
	 * could disagree, and the disagreement has to be visible.
	 *
	 * Two of the three rows here cannot be jumped to — one this reader
	 * cannot place, one the repository has already deleted. A count
	 * taken from "the jumpable ones" would read 1, a count taken from
	 * the list reads 3, and the reader would be shown a number
	 * describing entries that are plainly in front of them.
	 */
	it('counts orphans on screen rather than dropping them from the total', () => {
		renderPanel([
			entry(highlight(1, '置ける'), 'ready'),
			entry(highlight(2, '置けない'), 'unresolved'),
			entry(highlight(3, '消えた'), 'gone'),
		]);

		expect(rows().length).toBe(3);
		expect(screen.getByTestId('rm-highlights-count').textContent).toBe('3 件');
	});

	it('says how many of the rows can actually be reached, when not all can', () => {
		renderPanel([
			entry(highlight(1, '置ける'), 'ready'),
			entry(highlight(2, '置けない'), 'unresolved'),
			entry(highlight(3, '消えた'), 'gone'),
		]);

		expect(screen.getByTestId('rm-highlights-unreachable').textContent).toBe(
			'1 / 3 件に移動できます',
		);
	});

	it('leaves the reachable summary out when every row works', () => {
		renderPanel([entry(highlight(1, '一つ'), 'ready'), entry(highlight(2, '二つ'), 'ready')]);

		// A second number on a list where it says nothing is noise.
		expect(screen.queryByTestId('rm-highlights-unreachable')).toBeNull();
	});
});

describe('orphan rows are visible', () => {
	it('gives a row the reader cannot place no jump button, and says so', () => {
		renderPanel([entry(highlight(2, '見つからない文'), 'unresolved')]);

		expect(screen.queryByTestId('rm-highlight-jump')).toBeNull();
		expect(screen.getByTestId('rm-highlight-notice').textContent).toBe(
			PANEL_ENTRY_NOTICE.unresolved,
		);
		// The words are still the reader's own and still readable.
		expect(screen.getByTestId('rm-highlight-quote').textContent).toBe('見つからない文');
	});

	it('distinguishes a deleted row from one merely out of reach', () => {
		renderPanel([
			entry(highlight(2, '見つからない'), 'unresolved'),
			entry(highlight(3, '削除済み'), 'gone'),
		]);

		const notices = screen.getAllByTestId('rm-highlight-notice').map((node) => node.textContent);
		expect(notices).toEqual([PANEL_ENTRY_NOTICE.unresolved, PANEL_ENTRY_NOTICE.gone]);
		expect(PANEL_ENTRY_NOTICE.unresolved).not.toBe(PANEL_ENTRY_NOTICE.gone);
	});

	it('keeps an orphan deletable — the reader has to be able to clear it', () => {
		const onDelete = vi.fn();
		const row = highlight(2, '消えた文');
		renderPanel([entry(row, 'gone')], { onDelete });

		fireEvent.click(screen.getByTestId('rm-highlight-delete'));
		expect(onDelete).toHaveBeenCalledWith(row);
	});

	it('keeps the notes on a deleted highlight on screen', () => {
		const row = highlight(3, '消えた文');
		renderPanel([entry(row, 'gone', [note('消える前に書いたメモ')])]);

		// Hiding the reader's own words because a reference went missing
		// would be the panel losing data it does not own.
		expect(screen.getByTestId('rm-highlight-notes').textContent).toContain('消える前に書いたメモ');
		expect(screen.getByTestId('rm-highlight-notice').textContent).toBe(PANEL_ENTRY_NOTICE.gone);
	});

	it('offers no notice at all on a row that works', () => {
		renderPanel([entry(highlight(1, '置ける'), 'ready')]);

		expect(screen.queryByTestId('rm-highlight-notice')).toBeNull();
		expect(screen.getByTestId('rm-highlight-jump')).toBeTruthy();
	});
});

describe('jumping', () => {
	it('hands the highlight back when a jumpable row is pressed', () => {
		const onJump = vi.fn();
		const row = highlight(2, '移動する文');
		renderPanel([entry(row, 'ready')], { onJump });

		fireEvent.click(screen.getByTestId('rm-highlight-jump'));
		expect(onJump).toHaveBeenCalledWith(row);
	});

	it('shows a fallback jump on the row that asked for it, and nowhere else', () => {
		const first = highlight(1, ' Francis ');
		const second = highlight(2, '_places_');
		renderPanel([entry(first, 'ready'), entry(second, 'ready')], {
			jumpFailures: new Map([
				[second.id, '正確な位置は見つかりませんでした。2 ページに移動しました。'],
			]),
		});

		const error = screen.getByTestId('rm-highlight-jump-error');
		expect(error.textContent).toContain('2 ページに移動しました');
		// The message belongs to its own row, not to the list.
		const [firstRow, secondRow] = rows();
		expect(within(firstRow as HTMLElement).queryByTestId('rm-highlight-jump-error')).toBeNull();
		expect(within(secondRow as HTMLElement).getByTestId('rm-highlight-jump-error')).toBeTruthy();
	});

	it('words "there was nowhere to go" differently from "I moved to the page"', () => {
		renderPanel([entry(highlight(1, 'a'), 'ready'), entry(highlight(2, 'b'), 'ready')], {
			jumpFailures: new Map([
				['hl-1', '正確な位置は見つかりませんでした。1 ページに移動しました。'],
				['hl-2', '移動できる位置がありません。対象が削除されている可能性があります。'],
			]),
		});

		const messages = screen
			.getAllByTestId('rm-highlight-jump-error')
			.map((node) => node.textContent);
		expect(messages[0]).toContain('ページに移動しました');
		expect(messages[1]).toContain('移動できる位置がありません');
		// A reader must be able to tell "moved, imprecisely" from
		// "did not move" — they are different failures.
		expect(messages[0]).not.toBe(messages[1]);
	});

	it('announces the failure as an alert, since nothing else changes on screen', () => {
		renderPanel([entry(highlight(1, 'a'), 'ready')], {
			jumpFailures: new Map([['hl-1', '見つかりませんでした']]),
		});

		expect(screen.getByTestId('rm-highlight-jump-error').getAttribute('role')).toBe('alert');
	});

	it('shows no message for a row that has not been pressed', () => {
		renderPanel([entry(highlight(1, 'a'), 'ready')]);

		expect(screen.queryByTestId('rm-highlight-jump-error')).toBeNull();
	});
});

describe('what a row shows', () => {
	it('names the page and the book', () => {
		renderPanel([entry(highlight(7, '本文'), 'ready')]);

		expect(screen.getByTestId('rm-highlight-hint').textContent).toBe(`7 ページ · ${TITLE}`);
	});

	it('collapses the marked words onto one line without losing them', () => {
		renderPanel([entry(highlight(1, '  吾輩\nは  猫  '), 'ready')]);

		// The words are what the reader marked. The line break and the
		// double space each become one space — a row that dropped them
		// instead would read as different words, and a row that kept
		// them would break its own one-line layout.
		expect(screen.getByTestId('rm-highlight-quote').textContent).toBe('吾輩 は 猫');
	});

	it('says how many notes hang off a highlight, and which', () => {
		const row = highlight(1, '本文');
		renderPanel([entry(row, 'ready', [note('最初のメモ', row.id), note('次のメモ', row.id)])]);

		expect(screen.getByTestId('rm-highlight-notes').textContent).toBe(
			'メモ 2 件 · 最初のメモ / 次のメモ',
		);
	});

	it('leaves the notes line out when there are none', () => {
		renderPanel([entry(highlight(1, '本文'), 'ready')]);

		expect(screen.queryByTestId('rm-highlight-notes')).toBeNull();
	});
});

describe('the shared vocabulary', () => {
	it('treats only a ready row as jumpable', () => {
		expect(panelEntryIsJumpable('ready')).toBe(true);
		expect(panelEntryIsJumpable('unresolved')).toBe(false);
		expect(panelEntryIsJumpable('gone')).toBe(false);
	});

	it('has a sentence for each state that needs one, and none for the one that does not', () => {
		expect(PANEL_ENTRY_NOTICE.ready).toBeNull();
		expect(PANEL_ENTRY_NOTICE.unresolved).not.toBe(PANEL_ENTRY_NOTICE.gone);
	});
});
