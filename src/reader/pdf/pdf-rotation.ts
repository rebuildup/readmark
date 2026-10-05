/**
 * readmark — composing a page's native `/Rotate` with the reader's
 * runtime rotation.
 *
 * A PDF page may carry `/Rotate` in its page dictionary: the number of
 * degrees the page must be turned **clockwise** before it is displayed
 * upright. It is how a scanner or an export tool records "this page
 * was fed sideways" without rewriting the content stream, and a viewer
 * that ignores it shows a sideways book.
 *
 * The reader has a rotation of its own — the one a reader turns the
 * page with — and the two have to meet in a single number, because
 * pdf.js's `getViewport` takes exactly one `rotation` and builds one
 * transform from it.
 *
 * ## Why the composition is a sum, in that order
 *
 * `PDFPageProxy.rotate` is not a delta and not a matrix. Reading
 * pdf.js 5.7's own source (verified against the pinned dependency, not
 * from memory):
 *
 *   - `Page.rotate` (core, `pdf.worker.mjs`) resolves the *inheritable*
 *     `/Rotate` — so inheritance from the page tree is already done for
 *     us — and then normalises it: a value that is not a multiple of 90
 *     collapses to 0, `>= 360` is taken mod 360, and a negative value
 *     wraps into `[0, 360)`. What reaches the main thread is therefore
 *     an **absolute page orientation in `[0, 360)`**, already a multiple
 *     of 90.
 *   - `PageViewport` takes that value as **absolute**. It is not a
 *     post-transform applied on top of anything: the constructor picks
 *     one of four quarter-turn matrices from it. There is no API for
 *     "this viewport, turned further", which is why composition has to
 *     happen *before* `getViewport` rather than after.
 *
 * Both numbers are clockwise-positive degrees in the same frame, so the
 * composition is a plain sum reduced mod 360:
 *
 *     total = (native + runtime) mod 360
 *
 * The direction is the part that is a decision rather than arithmetic.
 * Subtracting instead would mean a reader pressing "turn clockwise" on
 * a page that already says `/Rotate 90` ends up back at 0 — the button
 * would appear to do nothing. Adding means the native orientation is
 * the *base* and the runtime rotation turns the page further in the
 * same sense, which is what the button means to a reader.
 *
 * The order of the two addends is not itself load-bearing — addition
 * commutes, and both terms are normalised before they are summed, so
 * `native + runtime` and `runtime + native` cannot disagree. What is
 * load-bearing, and what this module exists to pin:
 *
 *   1. **Native is the base, runtime composes on top of it.** Not two
 *      `getViewport` calls, and — the mistake this replaces — not a CSS
 *      `rotate()` applied to a canvas that pdf.js already painted at the
 *      native orientation. That would double-rotate, and a page with
 *      `/Rotate 90` would come out at 0 in the reader's hands.
 *   2. **One absolute value goes into one viewport.** Canvas, text
 *      layer and highlight paint all derive from that single
 *      `PageViewport`, so they cannot disagree about orientation.
 *   3. **The result is always a quarter turn.** `getViewport` is given
 *      a value it has a matrix for, so no consumer ever has to reason
 *      about an arbitrary angle.
 *
 * ## Why this validates instead of trusting
 *
 * pdf.js already normalises `rotate` (above), so in practice a bad
 * `/Rotate` cannot reach here. Two reasons to check anyway:
 *
 *   - This module's input is *a number parsed out of an untrusted
 *     file*, and the reader layer does not get to assume every version
 *     of every dependency normalised the way this one does. The
 *     normalisation is part of this module's own contract, so it holds
 *     on its own terms.
 *   - The failure without it is silent and layout-destroying. A
 *     non-finite rotation reaches `PageViewport`, whose transform
 *     becomes `NaN`; the canvas backing store and the `.rm-page` box
 *     are then sized `NaNpx`, which every browser resolves to no box at
 *     all. The page does not crash and does not look wrong — it
 *     disappears, with nothing in the console to say why.
 *
 * So a value that is not a finite integer, or not a multiple of 90, is
 * rejected to 0 — the same answer pdf.js gives, and the only one that
 * renders a readable page.
 */

/** A page orientation in degrees. Always a quarter turn: the four
 *  values pdf.js's `PageViewport` has a transform for. */
export type PageRotation = 0 | 90 | 180 | 270;

/**
 * Reduce an untrusted rotation to a quarter turn, or to 0.
 *
 * `0` is the answer for everything this cannot vouch for — absent
 * (pdf.js omits `/Rotate` on a page that has none), non-numeric,
 * `NaN`, `Infinity`, fractional, or not a multiple of 90 — because 0
 * is the orientation the page would have had with no `/Rotate` at all.
 * A page whose rotation we cannot read still has to be readable.
 *
 * Wrapping is total: `-90` is 270, `450` is 90, `360` is 0. A PDF is
 * allowed to say any of those, and pdf.js itself normalises to the same
 * `[0, 360)` range, so composing with its answer stays in step.
 */
export function normalizePageRotation(value: unknown): PageRotation {
	// `Number.isInteger` is false for `NaN`, `Infinity`, every
	// non-number, and every fraction — so this one line is what keeps a
	// non-finite value out of a CSS length.
	if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
	// A `/Rotate` that is not a quarter turn is not a page orientation.
	// pdf.js rejects these to 0 for the same reason, and matching it
	// keeps this module's answer and the page's real orientation from
	// disagreeing.
	if (value % 90 !== 0) return 0;
	switch (((value % 360) + 360) % 360) {
		case 90:
			return 90;
		case 180:
			return 180;
		case 270:
			return 270;
		default:
			return 0;
	}
}

/**
 * The rotation to hand `getViewport`: the page's native `/Rotate`
 * composed with the reader's runtime rotation.
 *
 * Both are normalised *before* they are summed, so a rejected input
 * cannot drag the other one with it — a malformed `/Rotate` on a page
 * the reader has turned to 90 still renders at 90, not at 0. The sum
 * is normalised again because two quarter turns can reach 540.
 */
export function composePageRotation(native: unknown, runtime: unknown): PageRotation {
	return normalizePageRotation(normalizePageRotation(native) + normalizePageRotation(runtime));
}
