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
	/** Advance width of the run, as pdf.js reports it: user space
	 *  after the content-stream CTM, before the viewport scale. */
	readonly width: number;
	/** Glyph box height, same space as `width`. */
	readonly height: number;
	/** Writing direction from `getTextContent()`: `ltr` / `rtl` /
	 *  `ttb`. Propagated to the DOM so the browser's own
	 *  bidirectional handling agrees with the PDF's. */
	readonly dir: string;
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
		dir: typeof item.dir === 'string' ? item.dir : 'ltr',
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
 * Compose two pdf.js matrices, applying the second first.
 *
 * This is pdf.js's own multiplication, term for term. pdf.js stores a
 * transform row-major with the translation in the last row:
 *
 *     x' = a·x + b·y + e
 *     y' = c·x + d·y + f
 *
 * The familiar column-major reading of `[a, b, c, d, e, f]` composes
 * to the same numbers for an axis-aligned transform — which is why a
 * horizontal fixture passes either way — and diverges the moment a run
 * has a rotation or a skew inside the page. Every consumer here is
 * downstream of `PageViewport.transform`, so this has to be
 * bit-compatible with `Util.transform`, not merely plausible.
 */
export function composeTransform(
	viewportTransform: readonly number[],
	textTransform: readonly number[],
): readonly number[] {
	const m1 = [
		viewportTransform[0] ?? 1,
		viewportTransform[1] ?? 0,
		viewportTransform[2] ?? 0,
		viewportTransform[3] ?? 1,
		viewportTransform[4] ?? 0,
		viewportTransform[5] ?? 0,
	] as const;
	const m2 = [
		textTransform[0] ?? 1,
		textTransform[1] ?? 0,
		textTransform[2] ?? 0,
		textTransform[3] ?? 1,
		textTransform[4] ?? 0,
		textTransform[5] ?? 0,
	] as const;
	return [
		m1[0] * m2[0] + m1[2] * m2[1],
		m1[1] * m2[0] + m1[3] * m2[1],
		m1[0] * m2[2] + m1[2] * m2[3],
		m1[1] * m2[2] + m1[3] * m2[3],
		m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
		m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
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

/**
 * Should this run's box be stretched to the PDF's advance width?
 *
 * pdf.js's condition, unchanged: a multi-character run is always
 * worth compensating (kerning, ligatures and substituted metrics all
 * make the browser's natural width disagree with the PDF's), and a
 * single non-space character is worth it only when it is drawn with a
 * visibly non-uniform scale.
 *
 * Skipping the compensation is not free of consequence — it is the
 * difference between a selection rectangle that covers the glyphs and
 * one that is a few percent narrower, which is the drift #7 would
 * have to correct for later.
 */
export function shouldScaleText(run: GlyphRun): boolean {
	if (run.text.length > 1) return true;
	if (run.text === ' ') return false;
	const absScaleX = Math.abs(run.transform[0] ?? 0);
	const absScaleY = Math.abs(run.transform[3] ?? 0);
	if (absScaleX === absScaleY) return false;
	const larger = Math.max(absScaleX, absScaleY);
	const smaller = Math.min(absScaleX, absScaleY);
	return smaller > 0 && larger / smaller > 1.5;
}

/**
 * The `scaleX` that makes the browser's glyphs span the PDF's advance
 * width, or `null` when no correction is wanted.
 *
 * `advanceInUserSpace` is the run's `width` (or `height`, for a
 * vertical font); pdf.js reports it in user space after the content
 * stream's CTM, so the viewport scale is still missing.
 * `measuredWidth` is what the browser drew at the same font size.
 */
export function textScaleFactor(
	advanceInUserSpace: number,
	viewportScale: number,
	measuredWidth: number,
): number | null {
	if (!(measuredWidth > 0) || !(advanceInUserSpace > 0)) return null;
	return (advanceInUserSpace * viewportScale) / measuredWidth;
}

/**
 * A 2D context used only to measure text.
 *
 * One per module, created lazily and never attached to the document:
 * a measuring canvas per run would allocate thousands of them on a
 * long page. Returns `null` when no context is available (Node, an
 * old browser, a test environment), in which case the layer is built
 * without width compensation rather than not at all.
 */
let measuringContext: CanvasRenderingContext2D | null | undefined;

function measuring2dContext(): CanvasRenderingContext2D | null {
	if (measuringContext !== undefined) return measuringContext;
	if (typeof document === 'undefined') {
		measuringContext = null;
		return measuringContext;
	}
	const canvas = document.createElement('canvas');
	canvas.width = 0;
	canvas.height = 0;
	measuringContext = canvas.getContext('2d');
	return measuringContext;
}

function measureRun(run: GlyphRun, fontSize: number): number | null {
	const context = measuring2dContext();
	if (context === null) return null;
	context.font = `${fontSize}px ${run.style.fontFamily}`;
	try {
		return context.measureText(run.text).width;
	} catch {
		// A context without `measureText` is not a text context.
		return null;
	}
}

/** Where a run's top-left corner lands in viewport space, how large
 *  its em box is there, and how the span has to be transformed.
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
	options: { readonly measure?: (run: GlyphRun, fontSize: number) => number | null } = {},
): {
	readonly x: number;
	readonly y: number;
	readonly fontSize: number;
	readonly transform: string;
	readonly scaleX: number | null;
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
	// Rotation in degrees, then the width correction in the run's own
	// (possibly rotated) frame — the order pdf.js's viewer CSS uses
	// (`rotate(var(--rotate)) scaleX(var(--scale-x))`), and the order
	// that keeps a rotated run stretched along its baseline.
	const rotate = angle === 0 ? '' : `rotate(${Number(((angle * 180) / Math.PI).toFixed(4))}deg)`;
	const measure = options.measure ?? measureRun;
	const measured = shouldScaleText(run) ? measure(run, fontSize) : null;
	const rawScaleX =
		measured === null
			? null
			: textScaleFactor(run.style.vertical ? run.height : run.width, viewport.scale, measured);
	// A correction within rounding of 1 is not a correction: emitting
	// `scaleX(1)` would put a transform on every span in the document
	// for no geometric reason, and a transform on an unrotated span is
	// what forces the browser onto a composited layer.
	const scaleX = rawScaleX === null ? null : Math.abs(rawScaleX - 1) < 0.001 ? null : rawScaleX;
	const transform =
		scaleX === null
			? rotate
			: `${rotate}${rotate === '' ? '' : ' '}scaleX(${Number(scaleX.toFixed(4))})`;

	return { x, y, fontSize, transform, scaleX };
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
	/** The measurement seam. Defaults to a module-level 2D context;
	 *  tests pass their own so the geometry can be asserted without a
	 *  canvas. */
	options: { readonly measure?: (run: GlyphRun, fontSize: number) => number | null } = {},
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
		const layout = layoutRun(run, viewport, options);
		const span = document.createElement('span');
		span.textContent = run.text;
		// The PDF's own writing direction, so the browser's
		// bidirectional handling agrees with the glyphs underneath
		// instead of reordering them.
		span.dir = run.dir;
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
