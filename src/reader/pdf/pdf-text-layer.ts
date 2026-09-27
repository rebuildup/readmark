/**
 * readmark — PDF text layer.
 *
 * The text layer is the transparent, selectable copy of the page's
 * glyphs that sits on top of the canvas. It is not decoration: it is
 * the only surface a reader can drag a selection across, so #7's
 * highlight work reads from it rather than from the canvas.
 *
 * Two projections come out of one `getTextContent()` call, and they
 * are deliberately different coordinate spaces:
 *
 *   - `buildTextLayer` — DOM positioned in **viewport space** (CSS
 *     px, top-left origin), matching the canvas exactly. It has to,
 *     or a selection would highlight the wrong pixels after a zoom
 *     or a rotation.
 *   - `extractPageTextLayer` — the same glyph runs projected into
 *     **raw PDF user-space**, which is what `PageTextLayer` and
 *     `PdfAnchor.rects` are defined in (ADR-0007). Storing
 *     viewport-space rects instead would make every stored anchor
 *     invalid the moment the reader zoomed or turned the page.
 *
 * Why the layer is built here instead of taken from pdf.js:
 *   - pdf.js ships its text layer inside the viewer bundle, not as a
 *     usable public entry point, and importing the viewer's stylesheet
 *     drags in annotation-layer and toolbar assumptions.
 *   - The glyph-run maths is small and stable, and having it in one
 *     file means the selection geometry has a single owner that can
 *     be unit-tested against a hand-written `TextContent`.
 *
 * Positioning follows the reference implementation: compose the
 * viewport transform with the run's own text transform, then place a
 * span at the resulting baseline origin with the font's ascent, and
 * counter-flip the y axis. `letter-spacing` / `word-spacing` are
 * pinned to `normal` in CSS because the browser's defaults would
 * accumulate across a span and drift the selection off the glyphs.
 */

import type { PDFPageProxy } from 'pdfjs-dist';

import type { PageIndex } from '../../domain/reading-state.ts';
import type { PageTextItem, PageTextLayer } from '../types.ts';
import type { ViewportLike } from './pdf-coords.ts';

/**
 * pdf.js does not re-export `TextContent` / `TextItem` / `TextStyle`
 * from its package root, and reaching into `pdfjs-dist/types/...`
 * would tie us to a path the package's exports map does not promise.
 * Deriving them from the method we actually call keeps the boundary
 * honest: if pdf.js changes the shape, the error lands here.
 */
type PageTextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
type TextContentItem = PageTextContent['items'][number];
type TextStyleMap = PageTextContent['styles'];

/** One `TextContent` entry narrowed to the glyph-bearing variant.
 *  Marked-content items carry structure, not glyphs. */
function isTextItem(item: TextContentItem): item is Extract<TextContentItem, { str: string }> {
	return 'str' in item && typeof item.str === 'string';
}

/** A run of glyphs, with everything the DOM needs. Extracted from
 *  pdf.js's `TextContent` so the maths can be tested without pdf.js
 *  and without a worker. */
export interface GlyphRun {
	readonly text: string;
	/** pdf.js text matrix `[a, b, c, d, e, f]`; `(e, f)` is the
	 *  baseline origin in user space. */
	readonly transform: readonly number[];
	/** Advance width of the run, in device space. */
	readonly width: number;
	/** Glyph height, in device space. */
	readonly height: number;
	readonly style: {
		readonly fontFamily: string;
		/** pdf.js leaves these undefined for fonts it could not
		 *  measure — a base-14 font with no embedded program, for
		 *  instance, reports `ascent: 0` rather than omitting it. The
		 *  fallback is therefore the same truthiness test pdf.js
		 *  uses, not `??`. */
		readonly ascent: number | undefined;
		readonly descent: number | undefined;
		readonly vertical: boolean;
	};
}

/** A run reduced to what the DOM needs. Marked-content items (which
 *  carry structure, not glyphs) never become runs. */
function toGlyphRun(item: TextContentItem, styles: TextStyleMap): GlyphRun | null {
	if (!isTextItem(item) || item.str.length === 0) return null;
	const style = styles[item.fontName];
	return {
		text: item.str,
		transform: item.transform as readonly number[],
		width: item.width,
		height: item.height,
		style: {
			// pdf.js omits a family for the standard 14; the browser's
			// default then matches whatever the CSS asks for, which is
			// the honest answer: the canvas shows the real glyphs.
			fontFamily: style?.fontFamily ?? 'sans-serif',
			ascent: style?.ascent,
			descent: style?.descent,
			vertical: style?.vertical ?? false,
		},
	};
}

/**
 * Compose two pdf.js-style 6-element matrices (`a b c d e f`,
 * column-vector convention), applying the second first.
 *
 * The translation part is the part that is easy to get wrong: the
 * second matrix's origin is a point, so it is transformed by the
 * first matrix's *linear* part and then offset by the first matrix's
 * own translation. Writing `e1 * e2 + f1 * c2` instead composes the
 * translation into the linear part and puts a text run hundreds of
 * pixels off the page — a bug that shows up as a text layer nothing
 * can select, rather than as an error.
 */
export function composeTransform(
	viewportTransform: readonly number[],
	textTransform: readonly number[],
): readonly number[] {
	const a1 = viewportTransform[0] ?? 1;
	const b1 = viewportTransform[1] ?? 0;
	const c1 = viewportTransform[2] ?? 0;
	const d1 = viewportTransform[3] ?? 1;
	const e1 = viewportTransform[4] ?? 0;
	const f1 = viewportTransform[5] ?? 0;
	const a2 = textTransform[0] ?? 1;
	const b2 = textTransform[1] ?? 0;
	const c2 = textTransform[2] ?? 0;
	const d2 = textTransform[3] ?? 1;
	const e2 = textTransform[4] ?? 0;
	const f2 = textTransform[5] ?? 0;
	return [
		a1 * a2 + b1 * c2,
		a1 * b2 + b1 * d2,
		c1 * a2 + d1 * c2,
		c1 * b2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1,
	];
}

/** pdf.js's fallback ascent for a font whose metrics it could not
 *  measure. */
const DEFAULT_FONT_ASCENT = 0.8;

/**
 * The run's ascent, in em.
 *
 * The fallback order is pdf.js's, and the differences matter: a font
 * that reports `ascent: 0` (no embedded program, base-14 metrics
 * left at zero) must fall through to `1 + descent`, and only a font
 * with neither falls to the default. Reading `ascent` with `??` here
 * would take `0` at face value and place every span of such a font one
 * font-height too low — a text layer that is present, selectable, and
 * quietly misaligned.
 */
function ascentOf(style: GlyphRun['style']): number {
	if (style.ascent) return style.ascent;
	if (style.descent) return 1 + style.descent;
	return DEFAULT_FONT_ASCENT;
}

/** The em-box height of a run in CSS pixels: the vertical scale of
 *  the composed transform, i.e. one axis of it (`hypot(c, d)`).
 *  Summing all four entries would count the same scale twice. */
function emHeight(matrix: readonly number[]): number {
	return Math.hypot(matrix[2] ?? 0, matrix[3] ?? 0);
}

/** Where a run's top-left corner lands in viewport space, how large
 *  its em box is there, and whether it needs rotating.
 *
 *  Split out from the DOM work so the geometry can be asserted
 *  without a document: this is the arithmetic that decides whether a
 *  selection rectangle covers the glyphs it came from.
 *
 *  The span is positioned at the top-left of the run's box and given
 *  the run's own font size, so the DOM's natural baseline already
 *  matches the PDF's; only a run that is rotated relative to the
 *  viewport needs an explicit `rotate()`. Multiplying the transform
 *  by the font size as well would scale every glyph twice. */
export function layoutRun(
	run: GlyphRun,
	viewport: ViewportLike,
): {
	readonly x: number;
	readonly y: number;
	readonly fontSize: number;
	readonly transform: string;
} {
	const tx = composeTransform(viewport.transform, run.transform);
	let angle = Math.atan2(tx[1] ?? 0, tx[0] ?? 0);
	// Vertical (縦書き) runs are laid out along the page's y axis, so
	// the text's own axes are a quarter turn from the page's. Without
	// this the glyph runs of a Japanese vertical PDF would be
	// transposed against the canvas — selectable, and in the wrong
	// place, which is the failure #7 would inherit.
	if (run.style.vertical) angle += Math.PI / 2;
	const fontSize = emHeight(tx);
	// The font's ascent in the same units, so the box is anchored by
	// its top edge rather than its baseline.
	const fontAscent = ascentOf(run.style) * fontSize;
	const x0 = tx[4] ?? 0;
	const y0 = tx[5] ?? 0;
	// A rotated run's ascent points sideways, so the offset follows
	// the rotation instead of the page axes.
	const x = angle === 0 ? x0 : x0 + fontAscent * Math.sin(angle);
	const y = angle === 0 ? y0 - fontAscent : y0 - fontAscent * Math.cos(angle);
	return {
		x,
		y,
		fontSize,
		transform: angle === 0 ? '' : `rotate(${Number(angle.toFixed(6))}rad)`,
	};
}

/**
 * Build the selectable text layer for one page into `target`.
 *
 * `target` receives a single `<div class="rm-text-layer">` sized to
 * the viewport, holding one `<span>` per glyph run. The caller owns
 * the canvas and must have laid both out from the same viewport.
 */
export async function buildTextLayer(
	page: PDFPageProxy,
	viewport: ViewportLike,
	target: HTMLElement,
): Promise<HTMLElement> {
	const textContent = await page.getTextContent();

	const layer = document.createElement('div');
	layer.className = 'rm-text-layer';
	layer.style.width = `${viewport.width}px`;
	layer.style.height = `${viewport.height}px`;
	layer.dataset.textLayer = 'true';

	const fragment = document.createDocumentFragment();
	for (const item of textContent.items) {
		const run = toGlyphRun(item, textContent.styles);
		if (run === null) continue;
		const layout = layoutRun(run, viewport);
		const span = document.createElement('span');
		span.textContent = run.text;
		span.style.left = `${layout.x}px`;
		span.style.top = `${layout.y}px`;
		span.style.fontSize = `${layout.fontSize}px`;
		span.style.fontFamily = run.style.fontFamily;
		if (layout.transform !== '') span.style.transform = layout.transform;
		fragment.appendChild(span);
	}
	layer.appendChild(fragment);
	target.appendChild(layer);
	return layer;
}

/**
 * Project a page's glyph runs into the format-agnostic
 * `PageTextLayer`, in raw PDF user-space.
 *
 * Approximation worth naming: the run's box is the glyph advance
 * (`width`) by the font box (`height`), anchored at the baseline
 * origin with the height above it. The exact ink box would need the
 * font program, which the worker does not expose per run. For
 * selection recovery in #7 the quote text is canonical and these
 * rects are display-only (ADR-0007), so the approximation is
 * confined to the one place that is allowed to be approximate.
 */
export async function extractPageTextLayer(
	page: PDFPageProxy,
	pageIndex: PageIndex,
): Promise<PageTextLayer> {
	const textContent = await page.getTextContent();
	const items: PageTextItem[] = [];
	for (const item of textContent.items) {
		const run = toGlyphRun(item, textContent.styles);
		if (run === null) continue;
		const x = run.transform[4] ?? 0;
		const baseline = run.transform[5] ?? 0;
		items.push({
			text: run.text,
			rect: {
				x,
				y: baseline - run.height,
				width: run.width,
				height: run.height,
			},
		});
	}
	return { format: 'pdf', page: pageIndex, items };
}
