/**
 * readmark — the selection toolbar: what it hangs from, where it goes,
 * and what makes it go away.
 *
 * Three decisions live here, and each has a failure that is worse than
 * not having the feature:
 *
 *   - **It hangs from the last non-empty fragment, not the union box.**
 *     A selection across three lines has a union box whose centre is in
 *     the whitespace between two of them, so a union-anchored toolbar
 *     floats in a gap between words — near the middle of the selection
 *     and nowhere near the part the reader just finished. The last
 *     fragment is the end of what they selected, which is where their
 *     attention is.
 *   - **It goes above, and flips below only when the sticky header is
 *     in the way.** A toolbar that jumps sides for any reason reads as
 *     a flicker. The header is the one obstacle worth knowing about,
 *     because it is the only thing the toolbar can land under.
 *   - **`selectionchange` and Escape dismiss it, and nothing else.**
 *     An outer `pointerdown` would fire on the *start* of a drag
 *     selection, so the toolbar would close while the reader was making
 *     the selection it belongs to. A click away from the selection is
 *     itself a selection change — the browser collapses the selection —
 *     so delegating to `selectionchange` covers it without a click-away
 *     rule of its own to get wrong.
 *
 * The toolbar acts on a **snapshot** taken when it appeared. Clicking a
 * button can change the DOM Selection — a click that lands on the
 * toolbar rather than the page, or a focus change that collapses it —
 * and a toolbar that re-read `window.getSelection()` on click would
 * sometimes act on whatever is selected *now* rather than on what the
 * reader chose. The buttons also stop the mousedown that would collapse
 * the selection in the first place, which is the usual case; the
 * snapshot is what makes the rest safe.
 *
 * The positioning maths is pure and exported, because a layout engine
 * cannot be asked "would this have fitted above the header" and a
 * component test in happy-dom measures nothing: no `getClientRects()`,
 * no `getBoundingClientRect()` worth reading.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { PageIndex } from '../domain/reading-state.ts';
import type { ReaderSelection } from '../reader/types.ts';

/** A measured box. Structural, so a test can supply one. */
export interface Box {
	readonly top: number;
	readonly left: number;
	readonly right: number;
	readonly bottom: number;
	readonly width: number;
	readonly height: number;
}

/** What the toolbar was shown for, captured when it appeared. */
export interface SelectionSnapshot {
	readonly page: PageIndex;
	/** The page host the selection is inside. The anchor builder
	 *  resolves the text layer from it, and a snapshot whose selection
	 *  is not in its own host is not a selection at all. */
	readonly container: HTMLElement;
	readonly selection: ReaderSelection;
}

/** The selection as it is right now, or `null` when there is none worth
 *  acting on: collapsed, empty, or spread over more than one page.
 *
 *  A cross-page selection is not a selection this reader can store —
 *  one `Anchor` is one page (ADR-0007) — and offering a toolbar that
 *  would then decline is worse than not offering one. */
export function snapshotSelection(selection: Selection | null): SelectionSnapshot | null {
	if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null;
	const range = selection.getRangeAt(0);
	if (range === undefined) return null;
	const container = pageHostOf(range.startContainer);
	// Both ends, or nothing: a selection that starts on page 3 and ends
	// on page 4 is two anchors, and choosing one of them silently is the
	// kind of guess a reader cannot see.
	if (container === null || !container.contains(range.endContainer)) return null;
	const page = Number(container.dataset.pageIndex);
	if (!Number.isInteger(page) || page < 1) return null;
	return {
		page: page as PageIndex,
		container,
		selection: { range, container },
	};
}

/** The page host a DOM node is inside, or `null`. */
function pageHostOf(node: Node | null): HTMLElement | null {
	if (node === null) return null;
	const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
	if (!(element instanceof HTMLElement)) return null;
	return element.closest<HTMLElement>('[data-page-index]');
}

/** Whether the live selection is still the one the snapshot was taken
 *  from. Anything else — collapsed, moved, different, another page —
 *  means the toolbar is describing a selection the reader no longer has. */
export function selectionStillMatches(
	snapshot: SelectionSnapshot,
	selection: Selection | null,
): boolean {
	if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return false;
	const range = selection.getRangeAt(0);
	if (range === undefined) return false;
	const same = snapshot.selection.range;
	// Compared by value rather than by object: a `selectionchange` that
	// re-reads the same selection produces an equal range, and a range
	// that only *grew* is a different one — the reader is still dragging.
	return (
		range.startContainer === same.startContainer &&
		range.startOffset === same.startOffset &&
		range.endContainer === same.endContainer &&
		range.endOffset === same.endOffset
	);
}

/** The fragment the toolbar hangs from: the **last** non-empty one.
 *
 *  Zero-area rects are skipped rather than used, because a selection
 *  that ends on a collapsed position reports one, and a toolbar hanging
 *  from a degenerate box is a toolbar hanging from nothing. */
export function anchorFragment(rects: readonly Box[]): Box | null {
	for (let index = rects.length - 1; index >= 0; index--) {
		const rect = rects[index];
		if (rect !== undefined && rect.width > 0 && rect.height > 0) return rect;
	}
	return null;
}

export interface Placement {
	readonly top: number;
	readonly left: number;
	/** Whether the toolbar went below the selection rather than above. */
	readonly flipped: boolean;
}

/**
 * Where the toolbar goes, in viewport coordinates.
 *
 * Above the fragment by default. Below it only when above would put the
 * toolbar under the sticky header — the one obstacle it can land
 * beneath, and a collision with anything else is not worth moving for.
 * Horizontally it is centred on the fragment and clamped inside
 * `bounds`, because a selection near the right margin would otherwise
 * push half the toolbar off screen.
 */
export function toolbarPlacement(params: {
	readonly fragment: Box;
	readonly toolbar: { readonly width: number; readonly height: number };
	/** The area the toolbar may occupy: the reader's own box. */
	readonly bounds: { readonly left: number; readonly right: number };
	/** The bottom of the sticky header, in viewport coordinates. */
	readonly headerBottom: number;
	readonly gap?: number;
}): Placement {
	const gap = params.gap ?? 8;
	const above = params.fragment.top - params.toolbar.height - gap;
	const flipped = above < params.headerBottom;
	const top = flipped ? params.fragment.bottom + gap : above;

	const centred = params.fragment.left + params.fragment.width / 2 - params.toolbar.width / 2;
	const room = params.bounds.right - params.bounds.left;
	// A toolbar wider than the reader has nowhere to centre, so it starts
	// at the reader's left edge rather than at a negative left.
	const left =
		params.toolbar.width >= room
			? params.bounds.left
			: Math.min(Math.max(centred, params.bounds.left), params.bounds.right - params.toolbar.width);
	return { top, left, flipped };
}

export interface SelectionToolbarProps {
	readonly snapshot: SelectionSnapshot | null;
	/** The element the toolbar may not leave: the reader's scroller. */
	readonly boundsRef: React.RefObject<HTMLElement | null>;
	/** Bottom of the sticky header in viewport coordinates. */
	readonly headerBottom: () => number;
	/**
	 * What the highlight button does for *this* selection: mark the text,
	 * or take off a mark that is already on it.
	 *
	 * Removal lives here rather than on a painted overlay because an
	 * overlay has to stay `pointer-events: none` — a highlight that
	 * swallowed pointer events would stop the reader selecting text that
	 * runs through it, which is most of the text they might want to mark
	 * next. A reader who re-selects marked text and is offered 「外す」 is
	 * removing it by the gesture they already know, with nothing over
	 * the page to intercept.
	 */
	readonly highlightLabel: string;
	readonly onHighlight: (snapshot: SelectionSnapshot) => void;
	readonly onBookmark: (snapshot: SelectionSnapshot) => void;
	/**
	 * Write a note about *this* selection — which the caller turns
	 * into a note on the selection's highlight, creating the highlight
	 * if the words are not marked yet.
	 *
	 * A third button rather than a fourth mode of the highlight button
	 * for the same reason the highlight button is a button: each of
	 * these is a different thing the reader wants to do to a
	 * selection, and folding "mark the words" and "write about the
	 * words" into one control makes the reader choose the right
	 * outcome before they know which they want.
	 *
	 * The label is not a prop because it does not toggle the way
	 * `highlightLabel` does. Marking is a state the words can be in
	 * and be taken out of; a note is written either way, and a second
	 * note on a highlight is a second note rather than a replacement.
	 */
	readonly onNote: (snapshot: SelectionSnapshot) => void;
}

export function SelectionToolbar({
	snapshot,
	boundsRef,
	headerBottom,
	highlightLabel,
	onHighlight,
	onBookmark,
	onNote,
}: SelectionToolbarProps) {
	const toolbarRef = useRef<HTMLDivElement | null>(null);
	const [placement, setPlacement] = useState<Placement | null>(null);

	// Recomputed from the same snapshot, so a scroll or a resize moves
	// the toolbar with the text it belongs to instead of leaving it
	// pointing at a place the selection has left.
	const measure = useCallback(() => {
		const toolbar = toolbarRef.current;
		const bounds = boundsRef.current;
		if (snapshot === null || toolbar === null || bounds === null) {
			setPlacement(null);
			return;
		}
		const rects = Array.from(snapshot.selection.range.getClientRects());
		const fragment = anchorFragment(rects);
		if (fragment === null) {
			setPlacement(null);
			return;
		}
		const box = toolbar.getBoundingClientRect();
		const boundsBox = bounds.getBoundingClientRect();
		setPlacement(
			toolbarPlacement({
				fragment,
				toolbar: { width: box.width, height: box.height },
				bounds: { left: boundsBox.left, right: boundsBox.right },
				headerBottom: headerBottom(),
			}),
		);
	}, [boundsRef, headerBottom, snapshot]);

	useLayoutEffect(() => {
		measure();
	}, [measure]);

	useEffect(() => {
		if (snapshot === null) return;
		// `capture` so a scroll inside the reader is seen even on
		// elements that stop propagation; `passive` because nothing here
		// scrolls.
		window.addEventListener('scroll', measure, { capture: true, passive: true });
		window.addEventListener('resize', measure, { passive: true });
		return () => {
			window.removeEventListener('scroll', measure, { capture: true });
			window.removeEventListener('resize', measure);
		};
	}, [measure, snapshot]);

	if (snapshot === null) return null;

	// Rendered as soon as there is a selection, and hidden until it has
	// been placed. Placing it needs the element's own size, so refusing to
	// render before measuring is a chicken-and-egg that leaves the
	// toolbar permanently unplaced — and `visibility: hidden` rather than
	// `display: none` keeps it in the layout engine, which is where the
	// size comes from, while showing the reader nothing.
	return (
		<div
			className="rm-selection-toolbar"
			ref={toolbarRef}
			role="toolbar"
			aria-label="選択範囲の操作"
			data-testid="rm-selection-toolbar"
			style={{
				position: 'fixed',
				visibility: placement === null ? 'hidden' : 'visible',
				...(placement === null ? {} : { top: `${placement.top}px`, left: `${placement.left}px` }),
			}}
			// A click on the toolbar must not collapse the selection it
			// belongs to. The snapshot already protects the target, and
			// this keeps the usual case from needing that protection.
			onMouseDown={(event) => {
				event.preventDefault();
			}}
		>
			<button
				type="button"
				className="rm-button rm-button--primary"
				data-testid="rm-selection-highlight"
				onClick={() => onHighlight(snapshot)}
			>
				{highlightLabel}
			</button>
			<button
				type="button"
				className="rm-button"
				data-testid="rm-selection-bookmark"
				onClick={() => onBookmark(snapshot)}
			>
				選択範囲を栞
			</button>
			<button
				type="button"
				className="rm-button"
				data-testid="rm-selection-note"
				onClick={() => onNote(snapshot)}
			>
				メモ
			</button>
		</div>
	);
}
