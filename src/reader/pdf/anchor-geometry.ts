/**
 * readmark — turning characters into visual fragments.
 *
 * `anchor-recovery.ts` finds *which characters* a stored quote covers.
 * This file turns those characters into the rects a painter can draw.
 * The two are deliberately separate: the search is pure and belongs
 * where it can be tested exhaustively, and this half needs a real
 * layout engine, because the geometry it produces *is* browser
 * geometry.
 *
 * ## Why the text layer, and why measured
 *
 * The obvious source is the text layer's own per-run rects, and it is
 * the wrong one twice over. A run's rect is the box of the whole run,
 * so the word `cat` inside a run reading `alpha beta gamma` would be
 * painted as three words. And the only way to get finer than a run
 * from `PageTextItem` is to split its width in proportion to its
 * character count — visibly wrong on a justified line, or any run of
 * mixed-width glyphs, which is most of a page of prose. A highlight
 * that drifts off its text is worse than one that is merely coarse.
 *
 * So the fragments are measured where the browser has already solved
 * the problem: `Range.getClientRects()` over the matched characters of
 * the text layer DOM returns exactly the visual fragments those
 * characters occupy, kerning, line wrap, and rotated runs included.
 * Those rects are then brought back to raw PDF user-space in two
 * steps, and both are necessary:
 *
 *   1. Client coordinates are viewport coordinates, and this layer is
 *      hosted far off-screen to be measured (below), so its rects carry
 *      that offset. The layer's own box is subtracted.
 *   2. What is left is layer-local, which is what the layer's viewport
 *      transform was built for. The same viewport converts it back to
 *      user-space, so what comes out is transform-free and survives a
 *      later zoom or rotation (ADR-0007).
 *
 * ## Measured in a known state
 *
 * Recovery measures in a layer of its own, at scale 1 and rotation 0,
 * parked off-screen but laid out. Two reasons:
 *
 *   - The conversion back to user-space has to invert a transform it
 *     knows. Measuring in the reader's current zoom and rotation
 *     would make the stored rects depend on what the reader happened
 *     to be looking at, which is exactly what raw user-space rects are
 *     supposed to prevent.
 *   - The reader's own page may not be rendered at all, or may have
 *     been re-rendered at a different size since the quote was taken.
 *     The layer this builds is derived from the same `getTextContent`
 *     as the one the offsets were computed against, so it always
 *     exists.
 *
 * "Off-screen" means laid out and not visible — `position: fixed` far
 * to the left, never `display: none` and never detached. A detached
 * element has no boxes at all, and a measurement of nothing here would
 * come back as an anchor with no geometry, which is the failure this
 * file is careful to report rather than hide.
 *
 * ## What a failure is
 *
 * `null` means "no geometry could be produced", and the caller must
 * treat it as a miss: stored rects plus a `stale` flag, visible to the
 * reader. It is not an empty list, and it is not a fresh anchor with
 * nothing to paint. A quote that matched but produced no rects has
 * not been shown to still be where it was.
 */

import type { PDFPageProxy } from 'pdfjs-dist';

import type { PageTextLayer } from '../types.ts';
import type { PdfRect } from './anchor.ts';
import type { QuoteRunMatch } from './anchor-recovery.ts';
import type { ViewportLike } from './pdf-coords.ts';
import { buildTextLayer } from './pdf-text-layer.ts';

/**
 * The state recovery measures in. Scale 1 and no rotation make the
 * viewport transform the one pdf.js uses for raw user-space, so the
 * conversion back is the identity on the axes and nothing has to be
 * reasoned about.
 */
const RECOVERY_SCALE = 1;
const RECOVERY_ROTATION = 0 as const;

/** A client rect, structurally. `DOMRect` satisfies it, and so does a
 *  hand-written object in a test — which matters, because happy-dom
 *  has no layout and cannot produce a real one. */
export interface ClientRectLike {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly width: number;
	readonly height: number;
}

/**
 * Move measured client rects into coordinates relative to `origin`.
 *
 * `getClientRects()` answers in viewport coordinates, so a layer hosted
 * a hundred thousand pixels to the left of the document reports
 * coordinates a hundred thousand pixels to the left of it. Handing
 * those straight to a viewport transform produces a rect in the right
 * place in the file and a wildly wrong one on the page — the largest
 * kind of wrong, because it still looks like a rectangle.
 *
 * Subtracting the layer's own box is the correction, and it is the
 * only one: every rect from the same layer shares the same origin, so
 * one subtraction per rect against one origin removes it exactly.
 */
export function layerRectsFromClientRects(
	rects: Iterable<ClientRectLike>,
	origin: { readonly left: number; readonly top: number },
): readonly ClientRectLike[] {
	const local: ClientRectLike[] = [];
	for (const rect of rects) {
		const left = rect.left - origin.left;
		const top = rect.top - origin.top;
		const right = rect.right - origin.left;
		const bottom = rect.bottom - origin.top;
		local.push({ left, top, right, bottom, width: right - left, height: bottom - top });
	}
	return local;
}

/**
 * Convert measured layer-local rects into raw PDF user-space
 * fragments.
 *
 * Two corners go through the viewport and the result is normalised,
 * rather than trusting which corner is which: with rotation 0 the flip
 * is a simple y inversion, but a normalising conversion is the same
 * amount of code and cannot be wrong about a sign.
 *
 * Collapsed rects are dropped. A zero-width fragment is what an empty
 * run or a range that landed on nothing produces, and painting it
 * would put an invisible box on the page that no reader could explain.
 */
export function fragmentsFromLayerRects(
	rects: Iterable<ClientRectLike>,
	viewport: ViewportLike,
): readonly PdfRect[] {
	const fragments: PdfRect[] = [];
	for (const rect of rects) {
		if (rect.width <= 0 || rect.height <= 0) continue;
		const topLeft = viewport.convertToPdfPoint(rect.left, rect.top);
		const bottomRight = viewport.convertToPdfPoint(rect.right, rect.bottom);
		const [x0, y0] = topLeft;
		const [x1, y1] = bottomRight;
		if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) continue;
		// Corners that cross over would give a negative width, which is
		// a rect nothing can paint.
		if (x0 === x1 || y0 === y1) continue;
		fragments.push({
			x: Math.min(x0, x1),
			y: Math.min(y0, y1),
			width: Math.abs(x1 - x0),
			height: Math.abs(y1 - y0),
		});
	}
	return fragments;
}

/**
 * Measure the visual fragments `runs` covers on `layer`.
 *
 * `null` when no geometry could be produced — see the file header for
 * why that is a miss and not an empty answer.
 *
 * ## The index correspondence
 *
 * `runs[i].runIndex` is where the run sits in the page, and the layer
 * built here has one span per run in that same order. That holds by
 * construction: both projections normalise the page's `TextContent`
 * through the same `glyphRuns()`, so "span i" and "item i" are the same
 * run by definition rather than by two filters agreeing.
 *
 * The index is the *page-global* one and not the run's position within
 * the match. A match that begins halfway down a page has no
 * `runs[0]` to point at anything, and addressing a span by match
 * position would measure the first run of the page for a quote in the
 * fifth — a highlight, drawn over the wrong words.
 *
 * The checks below are therefore an invariant test, not the mechanism.
 * They stay because the alternative is worse: this function's failure
 * mode is measuring the wrong characters and returning them as a
 * highlight, which is confident, plausible, and wrong — and the day
 * someone gives the two projections different filters, the count
 * comparison is what notices.
 */
export async function fragmentsForRuns(
	page: PDFPageProxy,
	layer: PageTextLayer,
	runs: readonly QuoteRunMatch[],
): Promise<readonly PdfRect[] | null> {
	if (runs.length === 0) return null;
	const viewport = page.getViewport({ scale: RECOVERY_SCALE, rotation: RECOVERY_ROTATION });
	const host = offscreenHost(viewport);
	try {
		const textLayer = await buildTextLayer(page, viewport, host);
		const spans = textLayer.querySelectorAll('span');
		if (spans.length !== layer.items.length) return null;
		const measured: ClientRectLike[] = [];
		for (const run of runs) {
			// Addressed by the run's position in the *page*: a quote
			// beginning halfway down the page must measure the run it
			// covers, not the first run on it.
			const span = spans[run.runIndex];
			// Identity, not text: the item the offsets were computed
			// against, and proof that this span is that run.
			if (span === undefined || run.item !== layer.items[run.runIndex]) return null;
			const text = span.firstChild;
			if (text === null || text.nodeType !== Node.TEXT_NODE) return null;
			const range = document.createRange();
			range.setStart(text, run.start);
			range.setEnd(text, run.end);
			// Copied out of the live list: `getClientRects()` returns a
			// list that can track the range, and the offsets above go out
			// of scope with it.
			measured.push(...Array.from(range.getClientRects()));
		}
		// The layer is hosted a long way off-screen, so its client rects
		// are nowhere near the document's. The origin is subtracted
		// before the transform, or every fragment lands thousands of
		// points off the page.
		const origin = textLayer.getBoundingClientRect();
		const local = layerRectsFromClientRects(measured, origin);
		const fragments = fragmentsFromLayerRects(local, viewport);
		return fragments.length === 0 ? null : fragments;
	} finally {
		// The host is a measurement artefact. Leaving hundreds of spans
		// in the document behind a recovery pass would make the next
		// pass's `querySelectorAll` slower for a layer nobody can see.
		host.remove();
	}
}

/**
 * The tolerance two measurements of the same thing may differ by and
 * still count as the same, in raw PDF points.
 *
 * 0.25pt is about 0.09mm — a third of the width of a hairline at 100%
 * zoom, and a fiftieth of a character. It is not "small enough to
 * ignore": it is smaller than the difference two measurements of the
 * *same* geometry can produce. A text layer measured at a different
 * device pixel ratio, or through a different font stack, lands a
 * fraction of a point away from the last one, and rewriting the stored
 * anchor every time a document is opened would be a row churning for
 * no reason.
 */
export const RECT_TOLERANCE_PT = 0.25;

/**
 * Whether two sets of fragments are the same display geometry.
 *
 * Count first: one fragment against three is a different shape however
 * close the numbers are, and a recovery that merged or split a line
 * would otherwise be able to report "unchanged" by lining up a prefix.
 * Then every coordinate, as an absolute difference, because the two
 * measurements are floats from two sessions and `===` would say they
 * differ when the document did not.
 */
export function rectsMatch(
	left: readonly PdfRect[],
	right: readonly PdfRect[],
	tolerance: number = RECT_TOLERANCE_PT,
): boolean {
	if (left.length !== right.length) return false;
	return left.every((rect, index) => {
		const other = right[index];
		if (other === undefined) return false;
		return (
			Math.abs(rect.x - other.x) <= tolerance &&
			Math.abs(rect.y - other.y) <= tolerance &&
			Math.abs(rect.width - other.width) <= tolerance &&
			Math.abs(rect.height - other.height) <= tolerance
		);
	});
}

/**
 * A laid-out, invisible container the size of the page.
 *
 * `position: fixed` far off the left edge rather than `display: none`:
 * a hidden or detached element has no boxes, and `getClientRects()`
 * over one returns nothing at all.
 */
function offscreenHost(viewport: ViewportLike): HTMLElement {
	const host = document.createElement('div');
	host.dataset.anchorMeasurement = 'true';
	host.style.position = 'fixed';
	host.style.left = '-100000px';
	host.style.top = '0px';
	host.style.width = `${viewport.width}px`;
	host.style.height = `${viewport.height}px`;
	// `visibility: hidden` still lays the layer out; `display: none`
	// would not. Nothing here is interactive either way.
	host.style.visibility = 'hidden';
	document.body.appendChild(host);
	return host;
}
