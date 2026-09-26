/**
 * readmark — PDF-specific anchor payload.
 *
 * Implements the `payload` half of `Anchor<PdfAnchor>` for PDF.
 * Lives in `reader/pdf/` per ADR-0004 (renderer isolation) — no
 * other layer imports this file directly.
 *
 * Design (see ADR-0007 for the rationale):
 *
 *   - **Canonical recovery key** is `quote`. Text quote with
 *     prefix / suffix context, matched against the PDF's text
 *     layer on reopen. Robust to zoom, rotation, and renderer
 *     changes — these do not alter the underlying glyphs.
 *
 *   - **Display position** is `rects`. PDF user-space rectangles,
 *     one per visual line of the selection (multi-rect for
 *     cross-line selections). Drawn over the rendered page.
 *
 *   - **Recovery order**: text quote → rects. On open, the reader
 *     searches the page's text layer for the quote; if found, it
 *     re-derives rects from the text layer's glyph geometry and
 *     updates the stored anchor. If not found (PDF re-encoded,
 *     OCR-corrected), the stored rects are used for display
 *     only and the anchor is flagged "stale" in the UI.
 *
 *   - **Single page**. A `PdfAnchor` cannot span pages. Cross-page
 *     selections are two highlights (post-MVP: a "merge adjacent"
 *     sidebar affordance).
 *
 *   - **No fuzzy match**. Exact text match in MVP. If the quote
 *     fails to resolve, the anchor is marked stale; no Levenshtein,
 *     no whitespace normalization, no hyphenation handling.
 *
 *   - **Rects are in PDF user-space**, not screen-space. The
 *     reader maps user-space to viewport-space at render time.
 *     Rotating the page after anchor creation breaks rects (the
 *     rotation transform is deferred; see ADR-0007).
 */

import type { PageIndex } from '../../domain/reading-state.ts';

/** A rectangle in PDF user-space. (0,0) is the bottom-left of
 *  the page. Coordinates are in PDF points (1/72 inch). */
export interface PdfRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** A text quote with surrounding context, for re-anchoring after
 *  re-render. The context bits are optional but strongly
 *  recommended when the selection is short or common (a single
 *  word like "the" needs context to disambiguate). */
export interface TextQuote {
	/** The exact selected text. Used as the canonical match string. */
	readonly exact: string;
	/** Up to 32 chars of context immediately BEFORE `exact`. */
	readonly prefix?: string;
	/** Up to 32 chars of context immediately AFTER `exact`. */
	readonly suffix?: string;
}

/** PDF anchor payload. */
export interface PdfAnchor {
	/** 1-based page index. */
	readonly page: PageIndex;
	/** Display rectangles. One entry per visual line of the
	 *  selection (a single paragraph usually produces N rects,
	 *  one per line). */
	readonly rects: readonly PdfRect[];
	/** Canonical recovery key. */
	readonly quote: TextQuote;
}
