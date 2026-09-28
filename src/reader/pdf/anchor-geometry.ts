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
 * Those client rects are then converted back to raw PDF user-space
 * through the same viewport the layer was built with, so what comes
 * out is transform-free and survives a later zoom or rotation
 * (ADR-0007).
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
 * Convert measured client rects into raw PDF user-space fragments.
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
export function fragmentsFromClientRects(
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
 * `runs[i].item` is `layer.items[i]`, and the layer built here has one
 * span per surviving run in the same order, because both projections
 * walk the same `getTextContent()` items and skip the same ones
 * (`toGlyphRun` returning null). That correspondence is what makes
 * offsets meaningful, and it is an assumption about two functions in
 * another file rather than a fact this one can prove — so the span
 * count is checked against the item count, and a disagreement is
 * reported as a failure instead of measuring the wrong characters.
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
		const rects: ClientRectLike[] = [];
		for (const [index, run] of runs.entries()) {
			const span = spans[index];
			// The item the offsets were computed against, not just any
			// span: a run that moved would mean the offsets are talking
			// about characters this measurement cannot see.
			if (span === undefined || run.item.text !== layer.items[index]?.text) return null;
			const text = span.firstChild;
			if (text === null || text.nodeType !== Node.TEXT_NODE) return null;
			const range = document.createRange();
			range.setStart(text, run.start);
			range.setEnd(text, run.end);
			rects.push(...range.getClientRects());
		}
		const fragments = fragmentsFromClientRects(rects, viewport);
		return fragments.length === 0 ? null : fragments;
	} finally {
		// The host is a measurement artefact. Leaving hundreds of spans
		// in the document behind a recovery pass would make the next
		// pass's `querySelectorAll` slower for a layer nobody can see.
		host.remove();
	}
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
