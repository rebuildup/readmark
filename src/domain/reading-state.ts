/**
 * readmark — reading-state model.
 *
 * Reading state attaches to a (DocumentId, SourceFingerprint) pair,
 * not to either alone. The split exists because:
 *
 *   - `Document.lastReadAt` is per-Document — any source opened = the
 *     book was opened.
 *   - `currentPage`, `bookmarks`, `highlights`, and positioned notes
 *     are per-source. PDF page 47 and EPUB "chapter 4, position 12"
 *     are NOT the same place even when the books are the same
 *     logical work.
 *
 * If a Document has multiple sources, each source has its own
 * progress / bookmarks / highlights. Cross-source progress sharing
 * (e.g. "I read pages 1-47 in the PDF, continue in EPUB") is a
 * future re-anchor operation, not a current behavior.
 *
 * Why bookmarks / highlights / notes are separate types instead of
 * one "Annotation" type:
 *   - They serve different product surfaces (Library list, Reader
 *     sidebar, Notes panel) and have different retrieval patterns.
 *   - Conflating them would force every UI surface to carry the
 *     union.
 *   - The W3C Web Annotation Data Model treats them as one shape;
 *     we deliberately don't, because we own the persistence and
 *     can normalize to W3C on export, not on store.
 *
 * Why a Note is a discriminated union (`free` | `positioned`):
 *   - A free note has no position, no source.
 *   - A positioned note is a position in specific bytes and MUST
 *     carry `sourceFingerprint`. Encoding this in the type system
 *     prevents a whole class of bugs where a pageIndex leaks across
 *     sources (e.g. "PDF p.47 highlighted as 'chapter 4'" because
 *     the EPUB happened to be the active source at re-anchor time).
 *
 * Two concepts of "position":
 *   - `Anchor` (in `domain/annotation/`) — text-region annotation
 *     position. What an annotation (Highlight, PositionedNote,
 *     Bookmark's "what text" part) is attached to. Format-specific
 *     payload is opaque to generic code; the format-specific reader
 *     fills it in. See ADR-0007.
 *   - `DocumentPosition` (in `domain/document.ts`) — sub-page
 *     navigation pointer (scroll offset, CFI, …). Used by
 *     ReadingProgress / Bookmark's `position` field for "scroll to
 *     here" on reopen. Lost under zoom / rotation changes — that
 *     is acceptable; it's not an annotation anchor.
 *
 * Why is `anchor` an opaque type at the domain level?
 *   - PDF has its own anchor shape (page + rects + text quote,
 *     ADR-0007). EPUB will have CFI. Markdown will have line
 *     range. Text will have char offset. The format-specific
 *     reader fills in the right shape. Generic UI never inspects
 *     the anchor payload — it just hands the object back to the
 *     reader (or persists it opaquely).
 */

import type { Anchor } from './annotation/index.ts';
import type { DocumentId, DocumentPosition, SourceFingerprint } from './document.ts';

/** 1-based page index for paged formats; chapter-relative for
 *  reflowable formats. */
export type PageIndex = number & { readonly __brand: 'PageIndex' };

export function asPageIndex(n: number): PageIndex {
	if (!Number.isInteger(n) || n < 1) {
		throw new Error(`Invalid page index: ${n}`);
	}
	return n as PageIndex;
}

export interface ReadingProgress {
	readonly documentId: DocumentId;
	/** Physical identity. Progress is per-source, not per-Document. */
	readonly sourceFingerprint: SourceFingerprint;
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
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageIndex: PageIndex;
	/** Text-region anchor (what text this bookmark is on). */
	readonly anchor: Anchor;
	/** Optional sub-page "scroll to here" pointer. */
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
	/** Text-region anchor. Format-specific payload is opaque at this
	 *  layer; the format-specific reader fills it in. */
	readonly anchor: Anchor;
	/** The exact text that was selected. Mirrors `anchor.payload.quote.exact`
	 *  for formats that carry a quote (PDF MVP); duplicated here
	 *  so the sidebar can list highlights without consulting the
	 *  reader. */
	readonly selectedText: string;
	readonly color: string;
	readonly createdAt: number;
}

interface NoteBase {
	readonly id: string;
	readonly documentId: DocumentId;
	readonly body: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	/** Optional: attach a note to a highlight. */
	readonly highlightId: string | null;
}

/** A note with no position. Lives in the book, not on a page. */
export interface FreeNote extends NoteBase {
	readonly kind: 'free';
}

/** A note attached to a position in a specific source. */
export interface PositionedNote extends NoteBase {
	readonly kind: 'positioned';
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageIndex: PageIndex;
	readonly anchor: Anchor | null;
}

export type Note = FreeNote | PositionedNote;
