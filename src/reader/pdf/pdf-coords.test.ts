/**
 * Unit tests for the coordinate conversions.
 *
 * No pdf.js in this file on purpose. `ViewportLike` is the structural
 * subset the module needs, so the transforms are pinned against a
 * hand-written viewport whose math is visible in the test — including
 * the quarter-turn cases where a rectangle's corners come back
 * swapped, which is the case a highlight painter gets wrong.
 *
 * pdf.js's own agreement with this module is covered by the browser
 * smoke (`scripts/smoke-reader.mjs`): it reads the canvas and the
 * text layer sizes the real `PageViewport` produced.
 */

import { describe, expect, it } from 'vitest';

import type { PdfRect } from './anchor.ts';
import {
	nextRotation,
	pdfPointToScreen,
	pdfRectToScreen,
	rotationSwapsDimensions,
	screenPointToPdf,
	viewportSize,
	type ViewportLike,
} from './pdf-coords.ts';

/**
 * A viewport with pdf.js's semantics written out longhand:
 * user-space (origin bottom-left, y up) → viewport (origin top-left,
 * y down), scaled and rotated. Rotation is applied clockwise, and a
 * quarter turn swaps the axes, which is exactly what makes a rect
 * come back corner-swapped.
 */
function makeViewport(
	pageWidth: number,
	pageHeight: number,
	scale: number,
	rotation: number,
): ViewportLike {
	const quarterTurn = rotationSwapsDimensions(rotation);
	const width = (quarterTurn ? pageHeight : pageWidth) * scale;
	const height = (quarterTurn ? pageWidth : pageHeight) * scale;

	return {
		transform: [scale, 0, 0, -scale, 0, height],
		width,
		height,
		scale,
		rotation,
		convertToViewportPoint(x, y) {
			// PDF y grows upward; viewport y grows downward.
			const flippedY = pageHeight - y;
			switch (rotation) {
				case 90:
					return [flippedY * scale, x * scale];
				case 180:
					return [(pageWidth - x) * scale, y * scale];
				case 270:
					return [(pageHeight - y) * scale, (pageWidth - x) * scale];
				default:
					return [x * scale, flippedY * scale];
			}
		},
		convertToViewportRectangle(rect) {
			const [x0, y0, x1, y1] = rect;
			// Flat `[x0, y0, x1, y1]`, corners in whatever order the
			// rotation produces — the real PageViewport does not
			// normalize, and neither do we.
			const [ax, ay] = this.convertToViewportPoint(x0, y1);
			const [bx, by] = this.convertToViewportPoint(x1, y0);
			return [ax ?? 0, ay ?? 0, bx ?? 0, by ?? 0];
		},
		convertToPdfPoint(x, y) {
			switch (rotation) {
				case 90:
					return [y / scale, pageHeight - x / scale];
				case 180:
					return [pageWidth - x / scale, pageHeight - y / scale];
				case 270:
					return [pageWidth - y / scale, x / scale];
				default:
					return [x / scale, pageHeight - y / scale];
			}
		},
	};
}

const PORTRAIT = { width: 600, height: 800 } as const;

function rect(overrides: Partial<PdfRect> = {}): PdfRect {
	return { x: 10, y: 20, width: 100, height: 40, ...overrides };
}

describe('pdfPointToScreen', () => {
	it('maps the user-space origin to the viewport origin at scale 1', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 1, 0);
		// Bottom-left of the page in user space is the top-left of the
		// viewport once the y axis is flipped.
		expect(pdfPointToScreen(viewport, { x: 0, y: PORTRAIT.height })).toEqual({ x: 0, y: 0 });
	});

	it('applies the zoom scale', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 2, 0);
		expect(pdfPointToScreen(viewport, { x: 100, y: PORTRAIT.height - 50 })).toEqual({
			x: 200,
			y: 100,
		});
	});

	it('follows the quarter turn', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 1, 90);
		// At 90° the page's x axis runs down the viewport.
		expect(pdfPointToScreen(viewport, { x: 0, y: PORTRAIT.height })).toEqual({
			x: 0,
			y: 0,
		});
		expect(pdfPointToScreen(viewport, { x: 100, y: PORTRAIT.height })).toEqual({ x: 0, y: 100 });
	});

	it('falls back to the origin for a malformed conversion result', () => {
		const viewport: ViewportLike = {
			...makeViewport(PORTRAIT.width, PORTRAIT.height, 1, 0),
			convertToViewportPoint: () => [],
		};
		// Better a corner than NaN in a paint loop.
		expect(pdfPointToScreen(viewport, { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
	});
});

describe('pdfRectToScreen', () => {
	it('keeps a positive extent at 0°', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 1, 0);
		const screen = pdfRectToScreen(viewport, rect());
		expect(screen.width).toBe(100);
		expect(screen.height).toBe(40);
		expect(screen.x).toBe(10);
		// y is measured from the top of the page, so a rect 40 tall
		// whose top edge is 40 below the page top starts at 740.
		expect(screen.y).toBe(PORTRAIT.height - 60);
	});

	it('keeps a positive extent through a quarter turn', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 1, 90);
		const screen = pdfRectToScreen(viewport, rect());
		// The rect is 100 wide and 40 tall in user space; turned 90°
		// it occupies 40 x 100 on screen. A negative extent here is
		// what silently breaks painting and hit-testing.
		expect(screen.width).toBe(40);
		expect(screen.height).toBe(100);
		expect(screen.width).toBeGreaterThan(0);
		expect(screen.height).toBeGreaterThan(0);
	});

	it('scales the extent with zoom', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 1.5, 0);
		expect(pdfRectToScreen(viewport, rect()).width).toBe(150);
	});
});

describe('screenPointToPdf', () => {
	it('round-trips a point at 0°', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 1.5, 0);
		const original = { x: 123, y: 456 };
		const back = screenPointToPdf(viewport, pdfPointToScreen(viewport, original));
		expect(back.x).toBeCloseTo(original.x, 6);
		expect(back.y).toBeCloseTo(original.y, 6);
	});

	it('round-trips a point at 90°', () => {
		const viewport = makeViewport(PORTRAIT.width, PORTRAIT.height, 1, 90);
		const original = { x: 321, y: 654 };
		const back = screenPointToPdf(viewport, pdfPointToScreen(viewport, original));
		expect(back.x).toBeCloseTo(original.x, 6);
		expect(back.y).toBeCloseTo(original.y, 6);
	});
});

describe('rotationSwapsDimensions / nextRotation / viewportSize', () => {
	it('identifies quarter turns', () => {
		expect(rotationSwapsDimensions(0)).toBe(false);
		expect(rotationSwapsDimensions(90)).toBe(true);
		expect(rotationSwapsDimensions(180)).toBe(false);
		expect(rotationSwapsDimensions(270)).toBe(true);
		// pdf.js accepts any multiple of 90.
		expect(rotationSwapsDimensions(450)).toBe(true);
	});

	it('rotates within the four supported stops', () => {
		expect(nextRotation(0, 90)).toBe(90);
		expect(nextRotation(270, 90)).toBe(0);
		expect(nextRotation(90, -90)).toBe(0);
		expect(nextRotation(0, 360)).toBe(0);
	});

	it('reserves a portrait or landscape placeholder', () => {
		expect(viewportSize(600, 800, 1, 0)).toMatchObject({ width: 600, height: 800 });
		// Turned, the same page reserves a landscape slot — getting
		// this wrong shifts the scroll position for the whole file.
		expect(viewportSize(600, 800, 1, 90)).toMatchObject({ width: 800, height: 600 });
		expect(viewportSize(600, 800, 2, 180)).toMatchObject({ width: 1200, height: 1600 });
	});
});
