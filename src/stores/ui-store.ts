/**
 * readmark — UI state store.
 *
 * Only ephemeral UI state lives here (selected panel, zoom level, etc.).
 * Persistent state (library, library, reading-progress, notes) lives in
 * IndexedDB through storage/. Zustand is chosen because the store is small
 * and we don't need the atom-per-key granularity of Jotai.
 */

import { create } from 'zustand';

export type ReaderSidePanel = 'bookmarks' | 'highlights' | 'notes' | 'none';

interface UiState {
	readonly sidePanel: ReaderSidePanel;
	readonly zoom: number;
	readonly rotation: 0 | 90 | 180 | 270;
	readonly setSidePanel: (panel: ReaderSidePanel) => void;
	readonly setZoom: (zoom: number) => void;
	readonly setRotation: (rotation: 0 | 90 | 180 | 270) => void;
}

export const useUiStore = create<UiState>((set) => ({
	sidePanel: 'none',
	zoom: 1.0,
	rotation: 0,
	setSidePanel: (sidePanel) => set({ sidePanel }),
	setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(zoom, 5)) }),
	setRotation: (rotation) => set({ rotation }),
}));
