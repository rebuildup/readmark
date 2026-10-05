/**
 * readmark — the reader's side panel shell.
 *
 * One surface with three lists in it. This file owns everything the
 * three have in common — which list is showing, how you get between
 * them, what happens when the viewport is too narrow to give the panel
 * its own column — and nothing about what any one of them contains.
 * The lists are passed in as `children`, so this module never imports a
 * panel and a panel never has to know it is being shown inside a shell.
 *
 * ## Why the narrow case is a dialog and not a narrow column
 *
 * `.rm-app--reader` gives the panel a fixed 280px column beside the
 * scroller. On a phone-width viewport that column is not a column: it
 * takes a third of a screen away from the document the reader is
 * actually reading, and the document is the point. So below the
 * breakpoint the panel stops being a column and becomes an overlay
 * above the reader, with a scrim behind it.
 *
 * An overlay that is not a dialog is a trap. A reader who opens a panel
 * on a narrow screen and finds their Tab key walking into a page they
 * cannot see has been given a worse layout than the one they asked to
 * escape. So the narrow panel is a real `role="dialog"`: focus moves
 * into it, Tab cycles inside it, Escape closes it, clicking the scrim
 * closes it, and focus goes back to whatever opened it. All four are
 * tested.
 *
 * None of that applies to the wide case, and applying it there would
 * be its own bug — a side-by-side column is not modal, trapping focus
 * in it would stop a reader reaching the document they are reading.
 *
 * ## The counts on the tabs
 *
 * Each tab says how many entries its list holds, and the parent passes
 * `list.length` for the very array it hands that panel. So the number
 * on the tab, the number in the panel's own header, and the number of
 * rows on screen are three readings of one array. A tab that disagreed
 * with its own panel would be the count invariant failing in the most
 * visible place available.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react';
// Aliased, because the component below is called `ReaderSidePanel` and a
// same-named type import would shadow it in this file's own scope. The
// two are unrelated: this is the store's union of which panel is open,
// and the component is the shell that renders whichever one is.
import type { ReaderSidePanel as ReaderSidePanelId } from '../stores/ui-store.ts';

/**
 * Below this width the panel cannot have a column of its own.
 *
 * 720px is where a 280px panel plus a readable measure of text stops
 * working, not a device size: a small laptop in a narrow window and a
 * large phone in landscape both land here, and both need the same
 * thing.
 */
export const SIDE_PANEL_NARROW_QUERY = '(max-width: 720px)';

/** The three lists, in the order they are offered. */
const TABS: readonly { readonly id: Exclude<ReaderSidePanelId, 'none'>; readonly label: string }[] =
	[
		{ id: 'bookmarks', label: '栞' },
		{ id: 'highlights', label: 'ハイライト' },
		{ id: 'notes', label: 'メモ' },
	];

/** Controls that can hold focus, for the overlay's Tab cycle.
 *
 *  `tabindex="-1"` is excluded on purpose: a programmatic-only target is
 *  not somewhere Tab should land, and including it would let the cycle
 *  stop somewhere the reader cannot see. */
const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Whether the viewport is too narrow for a panel column.
 *
 * `matchMedia` is read in an effect rather than on every render, and
 * the first read seeds state so the panel does not open at the wide
 * layout and snap to the overlay a frame later.
 *
 * The `typeof` guard is for renderers that do not implement
 * `matchMedia` at all — an older embedded WebView, or a non-browser
 * host. A component that assumed it existed would throw on mount there,
 * taking the whole reader with it over a question about the panel's
 * layout. Where there is no query to ask, the answer is "not narrow",
 * which is also the truthful one: nothing has said the viewport is
 * small, and the column is the layout that works everywhere.
 */
function useNarrowViewport(): boolean {
	const [narrow, setNarrow] = useState<boolean>(() => readNarrowQuery());

	useEffect(() => {
		if (typeof window.matchMedia !== 'function') return;
		const query = window.matchMedia(SIDE_PANEL_NARROW_QUERY);
		const onChange = () => setNarrow(query.matches);
		onChange();
		query.addEventListener('change', onChange);
		return () => {
			query.removeEventListener('change', onChange);
		};
	}, []);

	return narrow;
}

function readNarrowQuery(): boolean {
	if (typeof window.matchMedia !== 'function') return false;
	return window.matchMedia(SIDE_PANEL_NARROW_QUERY).matches;
}

export interface ReaderSidePanelProps {
	/** Which list is showing. Never `'none'` — the parent unmounts the
	 *  shell entirely when the panel is closed, so this shell does not
	 *  have to model a closed state and cannot disagree with one. */
	readonly active: Exclude<ReaderSidePanelId, 'none'>;
	readonly onSelect: (panel: Exclude<ReaderSidePanelId, 'none'>) => void;
	/** Closes the panel. The overlay's Escape key and its scrim both
	 *  come through here, so there is one way to close and not several
	 *  that can drift apart. */
	readonly onClose: () => void;
	/** How many entries each list holds. Each number is the length of
	 *  the array that list renders — see the file header. */
	readonly counts: Readonly<Record<Exclude<ReaderSidePanelId, 'none'>, number>>;
	readonly children: ReactNode;
}

export function ReaderSidePanel({
	active,
	onSelect,
	onClose,
	counts,
	children,
}: ReaderSidePanelProps) {
	const narrow = useNarrowViewport();
	const sheetRef = useRef<HTMLDivElement | null>(null);

	// Focus in, and focus back out again — but only while the panel is
	// an overlay. Keyed on `narrow` so it also runs when the reader
	// opens the panel on a narrow screen, which is the case that
	// matters, and does not run for a wide panel where the reader is
	// meant to keep reaching the document beside it.
	useEffect(() => {
		if (!narrow) return;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		sheetRef.current?.focus();
		return () => {
			// Only if it is still in the document: an opener that was
			// itself removed (a tab that is no longer the active one)
			// must not have focus pushed at a detached node.
			if (opener?.isConnected === true) opener.focus();
		};
	}, [narrow]);

	const onSheetKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		// Escape closes from anywhere inside, including from a note
		// editor's textarea — a note being half-written is not a
		// reason the reader cannot back out of the panel.
		if (event.key === 'Escape') {
			event.stopPropagation();
			onClose();
			return;
		}
		if (event.key !== 'Tab') return;
		const sheet = sheetRef.current;
		if (sheet === null) return;
		const focusable = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
			(element) => element.isConnected,
		);
		if (focusable.length === 0) {
			// Nothing to move to. Letting Tab through would put focus on
			// the page behind the overlay, which is the trap.
			event.preventDefault();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (first === undefined || last === undefined) return;
		const current = document.activeElement;
		if (event.shiftKey && (current === first || current === sheet)) {
			event.preventDefault();
			last.focus();
			return;
		}
		if (!event.shiftKey && current === last) {
			event.preventDefault();
			first.focus();
		}
	};

	if (narrow) {
		return (
			<div className="rm-panel-overlay" data-testid="rm-side-panel-overlay">
				{/*
				 * The scrim is a click target, not a control: it is not
				 * focusable, is hidden from assistive technology, and
				 * exists so a tap outside the sheet dismisses the panel
				 * the way tapping a modal dismisses it. Escape and
				 * focus return are the paths that do not need a
				 * pointer.
				 */}
				<div
					className="rm-panel-overlay__scrim"
					data-testid="rm-side-panel-scrim"
					aria-hidden="true"
					onClick={onClose}
				/>
				<div
					className="rm-panel-overlay__sheet"
					role="dialog"
					aria-modal="true"
					aria-label="サイドパネル"
					tabIndex={-1}
					ref={sheetRef}
					onKeyDown={onSheetKeyDown}
					data-testid="rm-side-panel-dialog"
				>
					<PanelTabs active={active} counts={counts} onSelect={onSelect} />
					<div
						className="rm-side-panel__body"
						role="tabpanel"
						aria-label={activeTabLabel(active)}
						data-testid="rm-side-panel-body"
					>
						{children}
					</div>
				</div>
			</div>
		);
	}

	return (
		<aside
			className="rm-panel rm-panel--reader rm-side-panel"
			aria-label="サイドパネル"
			data-testid="rm-side-panel"
		>
			<PanelTabs active={active} counts={counts} onSelect={onSelect} />
			<div
				className="rm-side-panel__body"
				role="tabpanel"
				aria-label={activeTabLabel(active)}
				data-testid="rm-side-panel-body"
			>
				{children}
			</div>
		</aside>
	);
}

function activeTabLabel(active: Exclude<ReaderSidePanelId, 'none'>): string {
	return TABS.find((tab) => tab.id === active)?.label ?? '';
}

function PanelTabs({
	active,
	counts,
	onSelect,
}: {
	readonly active: Exclude<ReaderSidePanelId, 'none'>;
	readonly counts: Readonly<Record<Exclude<ReaderSidePanelId, 'none'>, number>>;
	readonly onSelect: (panel: Exclude<ReaderSidePanelId, 'none'>) => void;
}) {
	return (
		<div className="rm-side-panel__tabs" role="tablist" aria-label="サイドパネルの切り替え">
			{TABS.map((tab) => {
				const selected = tab.id === active;
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						id={`rm-side-tab-${tab.id}`}
						aria-selected={selected}
						aria-controls="rm-side-panel-body"
						tabIndex={selected ? 0 : -1}
						className={
							selected ? 'rm-side-panel__tab rm-side-panel__tab--active' : 'rm-side-panel__tab'
						}
						onClick={() => onSelect(tab.id)}
						data-testid={`rm-side-tab-${tab.id}`}
					>
						{tab.label}
						<span className="rm-side-panel__tab-count" data-testid={`rm-side-tab-count-${tab.id}`}>
							{counts[tab.id]}
						</span>
					</button>
				);
			})}
		</div>
	);
}
