/**
 * readmark — reading-state model.
 *
 * Reading state attaches to the LOGICAL identity (DocumentId), not the
 * physical fingerprint. Re-importing the same bytes reuses the same id;
 * future "merge two sources under one id" UI does not require rewriting
 * any reading state.
 *
 * Why bookmarks / highlights / notes are separate types instead of one
 * "Annotation" type:
 *   - They serve different product surfaces (Library list, Reader
 *     sidebar, Notes panel) and have different retrieval patterns.
 *   - Conflating them would force every UI surface to carry the union.
 *   - The W3C Web Annotation Data Model treats them as the same shape;
 *     we deliberately don't, because we own the persistence and can
 *     normalize to the W3C shape on export, not on store.
 *
 * Why a Highlight also stores `sourceFingerprint`:
 *   - A highlight is a position in specific bytes. If the user has two
 *     sources under one DocumentId (future), the highlight must say
 *     which one it lives in. In MVP the two are always 1:1, but the
 *     schema already encodes the future shape.
 *
 * Why is `anchor` an opaque type?
 *   - PDF has its own anchor shape (page index + PDF user-space rects).
 *   - EPUB will have CFI. Markdown will have line range. Text will
 *     have char offset. The format-specific reader fills in the right
 *     shape. Generic UI never inspects the anchor body — it just hands
 *     the object back to the reader.
 */

import type { DocumentId, SourceFingerprint } from './document.ts';

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
	readonly documentId: DocumentId;
	/** Last 1-based page viewed. */
	readonly currentPage: PageIndex;
	/** Optional sub-page position (PDF scroll offset, EPUB CFI, …). */
	readonly position: DocumentPosition | null;
	/** Last viewed timestamp (ms since epoch). */
	readonly updatedAt: number;
}

export interface Bookmark {
	readonly id: string;
	readonly documentId: DocumentId;
	readonly pageIndex: PageIndex;
	readonly position: DocumentPosition | null;
	readonly title: string;
	readonly createdAt: number;
}

export interface Highlight {
	readonly id: string;
	readonly documentId: DocumentId;
	/** Which physical source this highlight lives in. */
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageIndex: PageIndex;
	readonly anchor: DocumentPosition;
	readonly selectedText: string;
	readonly color: string;
	readonly createdAt: number;
}

export interface Note {
	readonly id: string;
	readonly documentId: DocumentId;
	readonly pageIndex: PageIndex;
	readonly body: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	/** Optional: attach a note to a highlight. */
	readonly highlightId: string | null;
}
