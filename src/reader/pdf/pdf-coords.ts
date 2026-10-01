/**
 * readmark — PDF user-space ↔ viewport-space conversions.
 *
 * This module is the single place that knows how a position in a PDF
 * maps onto pixels (ADR-0004 §Boundary, and the two-layer anchor
 * model in ADR-0007):
 *
 *   - **User-space** is what a PDF stores: points of 1/72 inch, with
 *     (0,0) at the bottom-left of the page and y growing upward.
 *     Anchor rects are stored here (see `anchor.ts`), which is why a
 *     runtime rotation does not invalidate them.
 *   - **Viewport-space** is what the canvas and the text layer draw
 *     in: CSS pixels with (0,0) at the top-left, after the page's
 *     own `/Rotate` and the reader's runtime zoom and rotation have
 *     been applied.
 *
 * Everything here takes a `ViewportLike` — the structural subset of
 * pdf.js's `PageViewport` this module actually uses. That keeps the
 * pdf.js type out of the signatures (and makes the transforms
 * testable against a hand-written viewport, with no pdf.js in the
 * test at all), while any real `PageViewport` satisfies it
 * structurally.
 *
 * The transforms are NOT symmetric when a quarter turn is involved:
 * at 90° / 270° the viewport's x axis maps onto the page's y axis,
 * so a rectangle comes back with its corners swapped. `pdfRectToScreen`
 * normalizes that back to a positive-extent rectangle; callers that
 * care about direction (glyph runs) keep the raw transform.
 */

import type { PdfRect } from './anchor.ts';

/** The subset of pdf.js's `PageViewport` used for conversions.
 *  Declared structurally so this module stays testable and free of
 *  pdf.js imports. */
export interface ViewportLike {
	/** The viewport transform matrix (pdf.js ordering). */
	readonly transform: readonly number[];
	/** Viewport width in CSS pixels, rotation already applied. */
	readonly width: number;
	/** Viewport height in CSS pixels, rotation already applied. */
	readonly height: number;
	/** Scale factor applied to the page. */
	readonly scale: number;
	/** Rotation in degrees applied to the page. */
	readonly rotation: number;
	convertToViewportPoint(x: number, y: number): readonly number[];
	convertToViewportRectangle(rect: readonly number[]): readonly number[];
	convertToPdfPoint(x: number, y: number): readonly number[];
}

export interface ScreenPoint {
	readonly x: number;
	readonly y: number;
}

/** A rectangle in viewport space. `width` / `height` are always
 *  non-negative; the origin is the top-left corner. */
export interface ScreenRect extends ScreenPoint {
	readonly width: number;
	readonly height: number;
}

/** PDF user-space point. */
export interface PdfPoint {
	readonly x: number;
	readonly y: number;
}

/** Read a coordinate out of a pdf.js conversion result.
 *
 *  pdf.js types these as `any[]` because they are `[x, y]` tuples at
 *  runtime. Destructuring them would produce `number | undefined`
 *  under `noUncheckedIndexedAccess`, so the arity is checked once
 *  here instead of at every call site. A malformed result yields
 *  `(0, 0)`, which is the only sane fallback for a coordinate: it
 *  draws in the corner rather than at `NaN`. */
function coordinate(values: readonly number[], index: number): number {
	const value = values[index];
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * PDF user-space point → viewport-space point (CSS px, top-left
 * origin). This is the direction the renderer needs: an anchor rect
 * found in storage is user-space, the highlight has to be painted in
 * viewport space.
 */
export function pdfPointToScreen(viewport: ViewportLike, point: PdfPoint): ScreenPoint {
	const converted = viewport.convertToViewportPoint(point.x, point.y);
	return { x: coordinate(converted, 0), y: coordinate(converted, 1) };
}

/**
 * PDF user-space rectangle → viewport-space rectangle.
 *
 * pdf.js takes `[xMin, yMin, xMax, yMax]`. After a quarter turn the
 * returned corners arrive in the other order, so the extent is
 * normalized: a negative width or height would make the rect
 * un-paintable (and silently drop hit-testing) in every consumer.
 */
export function pdfRectToScreen(viewport: ViewportLike, rect: PdfRect): ScreenRect {
	const converted = viewport.convertToViewportRectangle([
		rect.x,
		rect.y,
		rect.x + rect.width,
		rect.y + rect.height,
	]);
	const ax = coordinate(converted, 0);
	const ay = coordinate(converted, 1);
	const bx = coordinate(converted, 2);
	const by = coordinate(converted, 3);
	return {
		x: Math.min(ax, bx),
		y: Math.min(ay, by),
		width: Math.abs(bx - ax),
		height: Math.abs(by - ay),
	};
}

/**
 * Viewport-space point → PDF user-space point. The inverse direction,
 * used when a click or a selection has to be stored as an anchor
 * rect.
 */
export function screenPointToPdf(viewport: ViewportLike, point: ScreenPoint): PdfPoint {
	const converted = viewport.convertToPdfPoint(point.x, point.y);
	return { x: coordinate(converted, 0), y: coordinate(converted, 1) };
}

/** Does this rotation swap the page's width and height?
 *
 *  The reader needs it to lay out a placeholder for a page it has
 *  not materialized yet: at 90° / 270° a portrait page reserves a
 *  landscape slot, and getting that backwards would make the
 *  scroll position wrong for the whole document. */
export function rotationSwapsDimensions(rotation: number): boolean {
	const normalized = ((rotation % 360) + 360) % 360;
	return normalized === 90 || normalized === 270;
}

/** Next rotation after turning `delta` degrees (positive = clockwise
 *  in the reader's UI, negative = counter-clockwise). */
export function nextRotation(rotation: number, delta: number): 0 | 90 | 180 | 270 {
	const normalized = (((rotation + delta) % 360) + 360) % 360;
	return (normalized as 0 | 90 | 180 | 270) ?? 0;
}

/** The CSS-pixel size a page occupies at this scale / rotation.
 *  Equivalent to reading `viewport.width` / `viewport.height`, but
 *  available from a bare page size so a placeholder can be reserved
 *  before the page itself has been opened. */
export function viewportSize(
	pageWidth: number,
	pageHeight: number,
	scale: number,
	rotation: number,
): ScreenRect & { readonly width: number; readonly height: number } {
	return rotationSwapsDimensions(rotation)
		? { x: 0, y: 0, width: pageHeight * scale, height: pageWidth * scale }
		: { x: 0, y: 0, width: pageWidth * scale, height: pageHeight * scale };
}
