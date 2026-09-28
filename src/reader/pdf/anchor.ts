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
 *     (raw, untransformed): one or more visual fragments covering
 *     the selection, not one per line and not one per text-layer
 *     run. Drawn over the rendered page.
 *
 *   - **Recovery order**: text quote → rects. On open, the reader
 *     searches the page's text layer for the quote; if found, it
 *     re-derives rects by measuring the text layer (in raw PDF
 *     user-space) and hands the refreshed anchor back through
 *     `ResolvedAnchor.updatedAnchor` for the caller to persist — the
 *     reader does not write, and generic UI does not read the
 *     payload it carries. If the quote is not found, or its geometry
 *     cannot be rebuilt, the stored rects are used for display only
 *     and the anchor is flagged "stale" in the UI.
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
	/**
	 * Display rectangles, in raw PDF user-space.
	 *
	 * One or more visual fragments covering the selection, not one
	 * rect per line and not one per text-layer run. A PDF line is
	 * split into runs for reasons that have nothing to do with reading
	 * — a font change, a kerning pair, marked content — and the runs
	 * on one baseline are not one rectangle, so merging them would
	 * either cover the gap between them or take the widest run's box.
	 * The count is not part of the contract; what is guaranteed is
	 * that the fragments together cover the selection.
	 *
	 * These are built by measuring the text layer (see ADR-0007
	 * §"Where fragment geometry comes from"), which is why a stored
	 * rect is a place to paint rather than a derivation of the text.
	 */
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
		typeof (p.quote as Partial<TextQuote>).exact === 'string' &&
		// `prefix` / `suffix` are optional, so "absent" and "present but
		// not a string" are different things and the guard has to tell
		// them apart. Recovery reads both of them and compares them
		// against page text, so a payload carrying `prefix: 123` would
		// narrow to `Anchor<PdfAnchor>` here and then be compared as a
		// number at the one place that is allowed to trust this guard.
		// The 32-character bound the type documents is *not* checked
		// here: rejecting a row for carrying a long prefix would make it
		// unreadable, and a prefix that does not match leaves the anchor
		// stale, which is the outcome that is actually safe.
		optionalText((p.quote as Partial<TextQuote>).prefix) &&
		optionalText((p.quote as Partial<TextQuote>).suffix)
	);
}

/** `undefined` or a string, and nothing else. */
function optionalText(value: unknown): boolean {
	return value === undefined || typeof value === 'string';
}
