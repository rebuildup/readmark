/**
 * readmark — UI state store.
 *
 * Only ephemeral UI state lives here (selected panel, zoom level, etc.).
 * Persistent state (library, library, reading-progress, notes) lives in
 * IndexedDB through storage/. Zustand is chosen because the store is small
 * and we don't need the atom-per-key granularity of Jotai.
 */

import { create } from 'zustand';

import type { DocumentId, SourceFingerprint } from '../domain/document.ts';

export type ReaderSidePanel = 'bookmarks' | 'highlights' | 'notes' | 'none';

/** The zoom range, in one place for the store's own writes.
 *
 *  Duplicated from `clampZoom` (`ui/reader-view.tsx`) rather than
 *  imported: the canonical definition and its tests live with the
 *  reader that uses it, and a store importing a React screen would
 *  invert the folder ownership AGENTS.md §3 draws. The two must stay
 *  equal — `reader-zoom.test.ts` asserts it, because a preference filed
 *  outside the range the toolbar can reach is a preference the reader
 *  cannot get back from. */
const MIN_READER_ZOOM = 0.25;
const MAX_READER_ZOOM = 5;

/**
 * The key a reader's own zoom is filed under.
 *
 * Both halves of the reading-state key, not just the document: the same
 * book can be re-imported from a different file, and a scale chosen
 * against a 515pt trade-book page is not the right answer for a 595pt
 * A4 one. This is how reading state is keyed everywhere else in the
 * app (AGENTS.md §3a).
 */
export function readerZoomKey(
	documentId: DocumentId,
	sourceFingerprint: SourceFingerprint,
): string {
	return `${documentId}:${sourceFingerprint}`;
}

interface UiState {
	readonly sidePanel: ReaderSidePanel;
	readonly zoom: number;
	readonly rotation: 0 | 90 | 180 | 270;
	/**
	 * Zoom the reader picked explicitly, keyed by {@link readerZoomKey}.
	 *
	 * A MISSING key does not mean "100%" — it means "the reader has not
	 * chosen", and the reader is expected to fall back to its own
	 * default, which is fit-width. That default is deliberately absent
	 * here: it depends on the window the document is open in, so it is
	 * not a number that can be stored once and replayed. A PRESENT key
	 * is the reader's own scale, and nothing else may overwrite it.
	 *
	 * Session-ephemeral on purpose (issue #35): in-memory, so it survives
	 * navigating away from a document and back, and does not survive a
	 * reload. That is the scope the issue asked for, and it is why
	 * nothing here reaches `localStorage` or IndexedDB.
	 */
	readonly readerZoom: Readonly<Record<string, number>>;
	readonly setSidePanel: (panel: ReaderSidePanel) => void;
	readonly setZoom: (zoom: number) => void;
	readonly setRotation: (rotation: 0 | 90 | 180 | 270) => void;
	readonly setReaderZoom: (key: string, zoom: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
	sidePanel: 'none',
	zoom: 1.0,
	rotation: 0,
	readerZoom: {},
	setSidePanel: (sidePanel) => set({ sidePanel }),
	setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(zoom, 5)) }),
	setRotation: (rotation) => set({ rotation }),
	setReaderZoom: (key, zoom) => {
		// A non-finite value is a programming error, not a preference.
		// Storing it would make every later read of this key NaN, and
		// the document would then be asked to render at no scale at all
		// — so it is dropped, and the reader keeps whatever it had.
		if (!Number.isFinite(zoom)) return;
		const clamped = Math.min(MAX_READER_ZOOM, Math.max(MIN_READER_ZOOM, zoom));
		set((state) => ({ readerZoom: { ...state.readerZoom, [key]: clamped } }));
	},
}));
