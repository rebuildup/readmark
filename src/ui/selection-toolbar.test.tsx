/**
 * Unit tests for the selection toolbar's decisions.
 *
 * Two things are under test, and they are separated because only one of
 * them can be tested here at all:
 *
 *   - **The maths.** Which fragment the toolbar hangs from, which side of
 *     the selection it goes on, and where it lands when the selection is
 *     near an edge. All pure, and all of it wrong-looking output is a
 *     toolbar floating in the whitespace between two lines or half off
 *     the right margin.
 *   - **The snapshot lifecycle.** When a selection is worth a toolbar,
 *     and when the toolbar has to go away. This uses a hand-built
 *     selection, because happy-dom has no `getClientRects()` — which is
 *     also why *positioning* has no component test here. The geometry the
 *     browser produces is the geometry smoke's claim.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { asPageIndex } from '../domain/reading-state.ts';
import {
	anchorFragment,
	type Box,
	selectionStillMatches,
	snapshotSelection,
	toolbarPlacement,
} from './selection-toolbar.tsx';

// The document and the selection are shared between tests, and a
// leftover selection is exactly what several of these cases are about.
beforeEach(() => {
	window.getSelection()?.removeAllRanges();
	document.body.replaceChildren();
});

/** A page host with a text layer in it, the way `render` leaves one. */
function pageHost(page = 1): HTMLElement {
	const host = document.createElement('div');
	host.dataset.pageIndex = String(page);
	const box = document.createElement('div');
	box.className = 'rm-page';
	const layer = document.createElement('div');
	layer.className = 'rm-text-layer';
	const span = document.createElement('span');
	span.textContent = 'readmark page one of three selectable text for the smoke';
	layer.appendChild(span);
	box.appendChild(layer);
	host.appendChild(box);
	document.body.appendChild(host);
	return host;
}

function box(over: Partial<Box> = {}): Box {
	return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...over };
}

/** The snapshot, or a loud failure: every case below needs one, and a
 *  non-null assertion on each use would only say the same thing louder. */
function snapshotOrFail(selection: Selection) {
	const snapshot = snapshotSelection(selection);
	if (snapshot === null) throw new Error('expected a selection worth a snapshot');
	return snapshot;
}

/** A selection over a span, as the browser would report it. */
function selectText(
	host: HTMLElement,
	start: number,
	end: number,
): { selection: Selection; range: Range } {
	const span = host.querySelector('span') as HTMLSpanElement;
	const text = span.firstChild as Text;
	const range = document.createRange();
	range.setStart(text, start);
	range.setEnd(text, end);
	const selection = window.getSelection() as Selection;
	selection.removeAllRanges();
	selection.addRange(range);
	return { selection, range };
}

describe('anchorFragment', () => {
	it('hangs from the last non-empty fragment, not the union box', () => {
		// A selection across three lines has a union box whose centre sits
		// in the whitespace between two of them. A toolbar placed there is
		// near the middle of the selection and nowhere near the part the
		// reader just finished.
		const first = box({ top: 100, bottom: 120, left: 40, right: 400, width: 360, height: 20 });
		const last = box({ top: 200, bottom: 220, left: 40, right: 300, width: 260, height: 20 });

		expect(anchorFragment([first, last])).toBe(last);
	});

	it('skips a collapsed fragment, which is what a selection ending on a caret reports', () => {
		const real = box({ top: 100, bottom: 120, left: 40, right: 400, width: 360, height: 20 });
		const collapsed = box({ top: 120, bottom: 120, left: 400, right: 400, width: 0, height: 0 });

		expect(anchorFragment([real, collapsed])).toBe(real);
		expect(anchorFragment([collapsed])).toBeNull();
		expect(anchorFragment([])).toBeNull();
	});
});

describe('toolbarPlacement', () => {
	const TOOLBAR = { width: 200, height: 40 };
	const BOUNDS = { left: 100, right: 900 };
	const HEADER_BOTTOM = 60;

	it('goes above the selection by default', () => {
		const placement = toolbarPlacement({
			fragment: box({ top: 300, bottom: 320, left: 200, right: 600, width: 400, height: 20 }),
			toolbar: TOOLBAR,
			bounds: BOUNDS,
			headerBottom: HEADER_BOTTOM,
		});

		expect(placement.flipped).toBe(false);
		expect(placement.top).toBe(300 - 40 - 8);
		// Centred on the fragment: 200 + 400/2 - 200/2.
		expect(placement.left).toBe(300);
	});

	it('flips below when above would put it under the sticky header', () => {
		// The header is the one obstacle worth knowing about, because it is
		// the only thing the toolbar can land under.
		const placement = toolbarPlacement({
			fragment: box({ top: 70, bottom: 90, left: 200, right: 600, width: 400, height: 20 }),
			toolbar: TOOLBAR,
			bounds: BOUNDS,
			headerBottom: HEADER_BOTTOM,
		});

		expect(placement.flipped).toBe(true);
		expect(placement.top).toBe(90 + 8);
	});

	it('clamps inside the reader, so a selection near a margin does not push it off screen', () => {
		const nearRight = toolbarPlacement({
			fragment: box({ top: 300, bottom: 320, left: 800, right: 890, width: 90, height: 20 }),
			toolbar: TOOLBAR,
			bounds: BOUNDS,
			headerBottom: HEADER_BOTTOM,
		});
		expect(nearRight.left).toBe(BOUNDS.right - TOOLBAR.width);

		const nearLeft = toolbarPlacement({
			fragment: box({ top: 300, bottom: 320, left: 100, right: 190, width: 90, height: 20 }),
			toolbar: TOOLBAR,
			bounds: BOUNDS,
			headerBottom: HEADER_BOTTOM,
		});
		expect(nearLeft.left).toBe(BOUNDS.left);
	});

	it('starts at the left edge when the toolbar is wider than the reader', () => {
		// There is nowhere to centre it, and a negative left would put half
		// of it off screen.
		const placement = toolbarPlacement({
			fragment: box({ top: 300, bottom: 320, left: 150, right: 250, width: 100, height: 20 }),
			toolbar: { width: 400, height: 40 },
			bounds: { left: 100, right: 300 },
			headerBottom: HEADER_BOTTOM,
		});

		expect(placement.left).toBe(100);
	});
});

describe('snapshotSelection', () => {
	it('takes a snapshot for a selection inside one page', () => {
		const host = pageHost(2);
		const { selection } = selectText(host, 0, 8);

		const snapshot = snapshotSelection(selection);

		expect(snapshot?.page).toBe(asPageIndex(2));
		expect(snapshot?.container).toBe(host);
		expect(snapshot?.selection.range.startOffset).toBe(0);
	});

	it('declines an absent selection, and one that is only a caret', () => {
		const host = pageHost();

		expect(snapshotSelection(null)).toBeNull();
		expect(snapshotSelection(window.getSelection())).toBeNull();
		// A click is a collapsed range, not a selection: no toolbar for it.
		selectText(host, 4, 4);
		expect(snapshotSelection(window.getSelection())).toBeNull();
	});

	it('declines a selection that spans two pages', () => {
		// One `Anchor` is one page (ADR-0007), so this is two anchors —
		// and offering a toolbar that would then decline is worse than not
		// offering one.
		const first = pageHost(1);
		const second = pageHost(2);
		const range = document.createRange();
		range.setStart((first.querySelector('span') as HTMLElement).firstChild as Text, 0);
		range.setEnd((second.querySelector('span') as HTMLElement).firstChild as Text, 8);
		const selection = window.getSelection() as Selection;
		selection.removeAllRanges();
		selection.addRange(range);

		expect(snapshotSelection(selection)).toBeNull();
	});

	it('declines a selection that is not in a page at all', () => {
		const stray = document.createElement('div');
		stray.textContent = 'not a page';
		document.body.appendChild(stray);
		const range = document.createRange();
		range.setStart(stray.firstChild as Text, 0);
		range.setEnd(stray.firstChild as Text, 3);
		const selection = window.getSelection() as Selection;
		selection.removeAllRanges();
		selection.addRange(range);

		expect(snapshotSelection(selection)).toBeNull();
	});
});

describe('selectionStillMatches', () => {
	it('holds while the selection is the one the snapshot was taken from', () => {
		const host = pageHost();
		const { selection } = selectText(host, 8, 20);
		const snapshot = snapshotOrFail(selection);

		expect(selectionStillMatches(snapshot, selection)).toBe(true);
	});

	it('gives up when the selection is gone, moved, or different', () => {
		const host = pageHost();
		const { selection } = selectText(host, 8, 20);
		const snapshot = snapshotOrFail(selection);

		// Collapsed: a click away from the selection is a selection change
		// too, which is how click-away is covered without a rule of its own.
		selectText(host, 8, 8);
		expect(selectionStillMatches(snapshot, window.getSelection())).toBe(false);

		// A different range: a reader who starts dragging again.
		const moved = selectText(host, 0, 5);
		expect(selectionStillMatches(snapshot, moved.selection)).toBe(false);
	});

	it('gives up when the selection grew, which is a drag still in progress', () => {
		const host = pageHost();
		const { selection } = selectText(host, 8, 20);
		const snapshot = snapshotOrFail(selection);
		const extended = selectText(host, 8, 30);

		// The start is the same and the end moved: the reader is dragging,
		// and a snapshot of the shorter selection no longer describes what
		// they are choosing.
		expect(selectionStillMatches(snapshot, extended.selection)).toBe(false);
	});

	it('gives up when there is no selection at all', () => {
		const host = pageHost();
		const { selection } = selectText(host, 8, 20);
		const snapshot = snapshotOrFail(selection);

		(window.getSelection() as Selection).removeAllRanges();

		expect(selectionStillMatches(snapshot, window.getSelection())).toBe(false);
	});
});
