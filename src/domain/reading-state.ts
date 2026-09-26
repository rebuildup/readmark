/**
 * readmark — reading-state model.
 *
 * Everything here is keyed by DocumentFingerprint so re-imports preserve all
 * state. None of it touches the document blob — the document is the source
 * of truth, the reading-state is the user's overlay on it (ADR-0002).
 *
 * Why are bookmarks / highlights / notes separate types instead of one
 * "Annotation" type?
 *   - They serve different product surfaces (Library list, Reader sidebar,
 *     Notes panel) and have different retrieval patterns.
 *   - Conflating them would force every UI surface to carry the union.
 *   - The W3C Web Annotation Data Model treats them as the same shape; we
 *     deliberately don't, because we own the persistence and can normalize
 *     to the W3C shape on export, not on store.
 *
 * Why is `anchor` an opaque discriminated union?
 *   - PDF has its own anchor shape (page index + PDF user-space rects).
 *   - EPUB will have CFI. Markdown will have line range. Text will have
 *     char offset. The format-specific reader fills in the right shape.
 *   - Generic UI never inspects the anchor body — it just hands the object
 *     back to the reader, which knows how to jump.
 */

import type { DocumentFingerprint } from './document.ts';

/** 1-based page index for paged formats; 0-based for some others. */
export type PageIndex = number & { readonly __brand: 'PageIndex' };

export function asPageIndex(n: number): PageIndex {
	if (!Number.isInteger(n) || n < 1) {
		throw new Error(`Invalid page index: ${n}`);
	}
	return n as PageIndex;
}

/** A position inside a document. Format-specific. Never inspect from
 *  generic UI; pass back to the reader. */
export type DocumentPosition = Readonly<Record<string, unknown>>;

export interface ReadingProgress {
	readonly documentFingerprint: DocumentFingerprint;
	/** Last 1-based page viewed. */
	readonly currentPage: PageIndex;
	/** Optional sub-page position (PDF scroll offset, EPUB CFI, …). */
	readonly position: DocumentPosition | null;
	/** Last viewed timestamp (ms since epoch). */
	readonly updatedAt: number;
}

export interface Bookmark {
	readonly id: string;
	readonly documentFingerprint: DocumentFingerprint;
	readonly pageIndex: PageIndex;
	readonly position: DocumentPosition | null;
	readonly title: string;
	readonly createdAt: number;
}

export interface Highlight {
	readonly id: string;
	readonly documentFingerprint: DocumentFingerprint;
	readonly pageIndex: PageIndex;
	readonly anchor: DocumentPosition;
	readonly selectedText: string;
	readonly color: string;
	readonly createdAt: number;
}

export interface Note {
	readonly id: string;
	readonly documentFingerprint: DocumentFingerprint;
	readonly pageIndex: PageIndex;
	readonly body: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	/** Optional: attach a note to a highlight. */
	readonly highlightId: string | null;
}
