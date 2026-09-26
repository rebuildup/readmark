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
 *     layer on reopen. Robust to zoom, runtime rotation, and
 *     renderer changes — none of these alter the underlying
 *     glyphs in the PDF's text layer.
 *
 *   - **Display position** is `rects`. PDF user-space rectangles
 *     (raw, untransformed), one per visual line of the selection
 *     (multi-rect for cross-line selections). Drawn over the
 *     rendered page.
 *
 *   - **Recovery order**: text quote → rects. On open, the reader
 *     searches the page's text layer for the quote; if found, it
 *     re-derives rects from the text layer's glyph geometry (in
 *     raw PDF user-space) and updates the stored anchor. If not
 *     found (PDF re-encoded, OCR-corrected), the stored rects are
 *     used for display only and the anchor is flagged "stale" in
 *     the UI.
 *
 *   - **Single page**. A `PdfAnchor` cannot span pages. Cross-page
 *     selections are two highlights (post-MVP: a "merge adjacent"
 *     sidebar affordance).
 *
 *   - **No fuzzy match**. Exact text match in MVP. If the quote
 *     fails to resolve, the anchor is marked stale; no Levenshtein,
 *     no whitespace normalization, no hyphenation handling.
 *
 *   - **Rects are in raw PDF user-space** (1/72 inch). They are
 *     NOT pre-multiplied by the runtime rotation transform. The
 *     page's NATIVE rotation (the `/Rotate` attribute on the
 *     page dictionary) is baked into the user-space; runtime
 *     rotation (the viewer's viewport rotation: 0 / 90 / 180 /
 *     270 degrees, exposed in `stores/ui-store.ts`) is applied
 *     as a separate viewport transform by pdf.js during render.
 *     Storing rects in raw user-space means runtime rotation does
 *     NOT invalidate stored rects — highlights stay aligned at
 *     any rotation angle, because the reader applies the same
 *     viewport transform at render time that pdf.js applies to
 *     the page itself. Zoom is a uniform scale on top of the
 *     viewport transform; also doesn't touch raw user-space.
 *
 *     The failure mode is to cache VIEWPORT-space rects (i.e.
 *     pre-multiply by the rotation matrix) — that WOULD make
 *     rotation invalidate stored rects. We don't do that. The
 *     pdf.js text-layer extraction (`getTextContent`) returns
 *     raw user-space coordinates; we use those directly.
 */

import type { Anchor } from '../../domain/annotation/index.ts';
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
	 *  one per line). Raw PDF user-space; runtime rotation is
	 *  applied at render time. */
	readonly rects: readonly PdfRect[];
	/** Canonical recovery key. */
	readonly quote: TextQuote;
}

/** Full structural validation for a PDF anchor.
 *
 *  The domain-side `isAnchorOfFormat` only checks the `format`
 *  discriminator; it does NOT prove the payload is well-formed.
 *  Callers that need typed access to `payload.rects` etc. MUST
 *  use this guard first. Reads from storage may carry malformed
 *  payloads (older schema, hand-edited data, on-disk corruption).
 *
 *  Cheap structural check only. It does NOT verify that the page
 *  actually exists in the source PDF, that the rects are inside
 *  the page bounds, or that the quote text resolves against the
 *  text layer. Those are recovery-time concerns, not type-
 *  narrowing concerns. */
export function isPdfAnchor(anchor: Anchor): anchor is Anchor<PdfAnchor> {
	if (anchor.format !== 'pdf') return false;
	const payload = anchor.payload;
	if (payload === null || typeof payload !== 'object') return false;
	const p = payload as Partial<PdfAnchor>;
	return (
		typeof p.page === 'number' &&
		Number.isInteger(p.page) &&
		p.page >= 1 &&
		Array.isArray(p.rects) &&
		p.rects.length > 0 &&
		p.rects.every(
			(r) =>
				r !== null &&
				typeof r === 'object' &&
				typeof r.x === 'number' &&
				typeof r.y === 'number' &&
				typeof r.width === 'number' &&
				typeof r.height === 'number',
		) &&
		typeof p.quote === 'object' &&
		p.quote !== null &&
		typeof (p.quote as Partial<TextQuote>).exact === 'string'
	);
}
