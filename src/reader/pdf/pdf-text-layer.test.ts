/**
 * Unit tests for the text layer's geometry and width compensation.
 *
 * The transform test cross-checks `composeTransform` against pdf.js's
 * own `Util.transform`, loaded from the legacy build. That is the
 * whole point of the function: every number it produces is compared
 * against the implementation whose output the canvas is drawn from,
 * on matrices that include skew and rotation. An axis-aligned fixture
 * would agree with any convention — the off-diagonal terms are zero,
 * so a wrong layout convention still looks right, which is exactly how
 * a horizontal-only test would have shipped a broken text layer.
 *
 * The rest pins the decisions that decide whether a selection lands on
 * its glyphs: which runs get a width correction, what the correction
 * is, and that the writing direction reaches the DOM.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ViewportLike } from './pdf-coords.ts';
import {
	composeTransform,
	type GlyphRun,
	layoutRun,
	shouldScaleText,
	textScaleFactor,
} from './pdf-text-layer.ts';

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;

/** A viewport with the transform conventions written out, including
 *  the flip that makes PDF's y-up become the DOM's y-down. */
function makeViewport(scale: number, rotation: number): ViewportLike {
	const quarter = rotation === 90 || rotation === 270;
	const width = (quarter ? PAGE_HEIGHT : PAGE_WIDTH) * scale;
	const height = (quarter ? PAGE_WIDTH : PAGE_HEIGHT) * scale;
	return {
		transform: [scale, 0, 0, -scale, 0, height],
		width,
		height,
		scale,
		rotation,
		convertToViewportPoint: (x, y) => [x * scale, (PAGE_HEIGHT - y) * scale],
		convertToViewportRectangle: (rect) => {
			const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = rect;
			return [x0 * scale, (PAGE_HEIGHT - y1) * scale, x1 * scale, (PAGE_HEIGHT - y0) * scale];
		},
		convertToPdfPoint: (x, y) => [x / scale, PAGE_HEIGHT - y / scale],
	};
}

function makeRun(overrides: Partial<GlyphRun> = {}): GlyphRun {
	return {
		text: 'readmark',
		transform: [12, 0, 0, 12, 50, 700],
		width: 48,
		height: 12,
		dir: 'ltr',
		style: { fontFamily: 'serif', ascent: 0.8, descent: -0.2, vertical: false },
		...overrides,
	};
}

describe('composeTransform', () => {
	/** pdf.js's own multiplication, from the installed build. */
	async function pdfJsTransform(
		m1: readonly number[],
		m2: readonly number[],
	): Promise<readonly number[]> {
		const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
			Util: { transform: (a: readonly number[], b: readonly number[]) => number[] };
		};
		return pdfjs.Util.transform([...m1], [...m2]);
	}

	const matrices: readonly (readonly [readonly number[], readonly number[]])[] = [
		// Axis-aligned: the case both conventions agree on.
		[
			[1, 0, 0, -1, 0, 800],
			[12, 0, 0, 12, 50, 700],
		],
		// A run rotated 30° inside the page: both off-diagonal terms
		// are non-zero and the two conventions disagree.
		[
			[1, 0, 0, -1, 0, 800],
			[10.392, 6, -6, 10.392, 50, 700],
		],
		// Shear, which is what a Type-3 font matrix produces.
		[
			[1.25, 0, 0, -1.25, 0, 1000],
			[12, 2.5, -1, 12, 30, 640],
		],
		// A page-level rotation of 90°, composed with a plain run.
		[
			[0, -1, 1, 0, 800, 0],
			[12, 0, 0, 12, 50, 700],
		],
		// 180°, where the linear part is symmetric again.
		[
			[-1, 0, 0, 1, 600, 800],
			[9, 0, 0, 9, 12, 34],
		],
		// Identity viewport, for the degenerate case.
		[
			[1, 0, 0, 1, 0, 0],
			[12, 0, 0, 12, 50, 700],
		],
	];

	for (const [m1, m2] of matrices) {
		it(`matches pdf.js Util.transform for [${m1}] × [${m2}]`, async () => {
			const mine = composeTransform(m1, m2);
			const reference = await pdfJsTransform(m1, m2);
			for (let i = 0; i < 6; i++) {
				expect(mine[i]).toBeCloseTo(reference[i] ?? 0, 9);
			}
		});
	}

	it('keeps the translation in the last row, not folded into the linear part', () => {
		const tx = composeTransform([1, 0, 0, -1, 0, 800], [12, 0, 0, 12, 50, 700]);
		// (50, 700) in user space is (50, 100) in a flipped viewport.
		expect(tx[4]).toBeCloseTo(50, 9);
		expect(tx[5]).toBeCloseTo(100, 9);
	});
});

describe('shouldScaleText', () => {
	it('compensates a multi-character run', () => {
		expect(shouldScaleText(makeRun({ text: 'readmark' }))).toBe(true);
	});

	it('leaves a single space alone', () => {
		expect(shouldScaleText(makeRun({ text: ' ' }))).toBe(false);
	});

	it('leaves a single uniformly-scaled character alone', () => {
		expect(shouldScaleText(makeRun({ text: '猫', transform: [12, 0, 0, 12, 0, 0] }))).toBe(false);
	});

	it('compensates a single character drawn with a lopsided scale', () => {
		expect(shouldScaleText(makeRun({ text: 'W', transform: [24, 0, 0, 8, 0, 0] }))).toBe(true);
	});

	it('does not divide by a degenerate scale', () => {
		expect(shouldScaleText(makeRun({ text: 'W', transform: [0, 0, 0, 0, 0, 0] }))).toBe(false);
	});
});

describe('textScaleFactor', () => {
	it('is the ratio of the PDF advance to the browser advance', () => {
		// PDF says 48 user-space units, the browser drew 40 CSS px at
		// the same font size: the run has to be stretched by 1.2.
		expect(textScaleFactor(48, 1, 40)).toBeCloseTo(1.2, 9);
	});

	it('folds the viewport scale into the PDF advance', () => {
		expect(textScaleFactor(48, 2, 40)).toBeCloseTo(2.4, 9);
	});

	it('declines when there is nothing to measure', () => {
		expect(textScaleFactor(48, 1, 0)).toBeNull();
		expect(textScaleFactor(0, 1, 40)).toBeNull();
	});
});

describe('layoutRun width compensation', () => {
	it('emits no transform for an upright run the browser already matches', () => {
		const layout = layoutRun(makeRun(), makeViewport(1, 0), { measure: () => 48 });
		// A factor of exactly 1 is not a correction: a transform on an
		// unrotated span buys nothing geometrically.
		expect(layout.scaleX).toBeNull();
		expect(layout.transform).toBe('');
	});

	it('stretches the run when the browser draws it narrower than the PDF', () => {
		const layout = layoutRun(makeRun(), makeViewport(1, 0), { measure: () => 40 });
		expect(layout.transform).toBe('scaleX(1.2)');
		expect(layout.scaleX).toBeCloseTo(1.2, 9);
	});

	it("rotates and stretches in the run's own frame", () => {
		const rotated = makeRun({ transform: [0, 12, -12, 0, 50, 700] });
		const layout = layoutRun(rotated, makeViewport(1, 0), { measure: () => 40 });
		// Rotation first, then the width correction in the rotated
		// frame — the other order would stretch across the page. The
		// sign follows pdf.js's own `atan2(tx[1], tx[0])` under its
		// row-major matrix convention.
		expect(layout.transform).toBe('rotate(-90deg) scaleX(1.2)');
	});

	it('advances a vertical font on its height, not its width', () => {
		const vertical = makeRun({
			style: { fontFamily: 'serif', ascent: 0.8, descent: -0.2, vertical: true },
			width: 12,
			height: 60,
		});
		const layout = layoutRun(vertical, makeViewport(1, 0), { measure: () => 50 });
		expect(layout.scaleX).toBeCloseTo(60 / 50, 9);
	});

	it('builds the layer without a correction when nothing can be measured', () => {
		const layout = layoutRun(makeRun(), makeViewport(1, 0), { measure: () => null });
		expect(layout.scaleX).toBeNull();
		expect(layout.transform).toBe('');
	});

	it('scales the compensation with the zoom', () => {
		const layout = layoutRun(makeRun(), makeViewport(2, 0), { measure: () => 80 });
		// At 2× the browser drew 80 px for the same run, and the PDF
		// advance is 48 × 2 = 96, so the ratio is back to 1.2.
		expect(layout.scaleX).toBeCloseTo(1.2, 5);
	});
});

describe('font metrics fallbacks', () => {
	it('falls through ascent → 1 + descent → default', () => {
		const viewport = makeViewport(1, 0);
		const noAscent = makeRun({
			style: { fontFamily: 'serif', ascent: 0, descent: -0.25, vertical: false },
		});
		const noMetrics = makeRun({
			style: { fontFamily: 'serif', ascent: undefined, descent: undefined, vertical: false },
		});
		expect(layoutRun(noAscent, viewport).y).toBeCloseTo(100 - 0.75 * 12, 6);
		expect(layoutRun(noMetrics, viewport).y).toBeCloseTo(100 - 0.8 * 12, 6);
	});
});

// Installed at file scope, not inside a describe: the measuring
// context is memoized on first use, and the layoutRun tests above use
// the real one when no override is passed.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
let measured = 0;

beforeAll(() => {
	// A 2D context good enough to measure text: the layer needs a
	// font and `measureText`, and nothing else.
	HTMLCanvasElement.prototype.getContext = (() => ({
		font: '',
		measureText: (text: string) => {
			measured += 1;
			// Half the PDF advance: a substituted font that draws
			// narrower than the PDF says.
			return { width: text.length * 4 };
		},
		save: () => {},
		restore: () => {},
		scale: () => {},
		fillRect: () => {},
		fillStyle: '',
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
});

it('propagates the writing direction to the DOM', async () => {
	const { buildTextLayer } = await import('./pdf-text-layer.ts');
	const target = document.createElement('div');
	const page = {
		getTextContent: async () => ({
			items: [
				{
					str: 'rtl text',
					dir: 'rtl',
					transform: [12, 0, 0, 12, 50, 700],
					width: 60,
					height: 12,
					fontName: 'F1',
				},
				{
					str: 'ttb text',
					dir: 'ttb',
					transform: [12, 0, 0, 12, 50, 600],
					width: 60,
					height: 12,
					fontName: 'F1',
				},
			],
			styles: { F1: { fontFamily: 'serif', ascent: 0.8, descent: -0.2, vertical: false } },
			lang: 'en',
		}),
	} as unknown as Parameters<typeof buildTextLayer>[0];

	const layer = await buildTextLayer(page, makeViewport(1, 0), target);
	const spans = Array.from(layer.querySelectorAll('span'));
	expect(spans.map((span) => span.getAttribute('dir'))).toEqual(['rtl', 'ttb']);
});

it('applies the measured width correction to each run', async () => {
	measured = 0;
	// The real measurement path, against the module's 2D context.
	const { buildTextLayer } = await import('./pdf-text-layer.ts');
	const target = document.createElement('div');
	const page = {
		getTextContent: async () => ({
			items: [
				{
					str: 'ten chars',
					dir: 'ltr',
					transform: [12, 0, 0, 12, 50, 700],
					width: 40,
					height: 12,
					fontName: 'F1',
				},
			],
			styles: { F1: { fontFamily: 'serif', ascent: 0.8, descent: -0.2, vertical: false } },
			lang: 'en',
		}),
	} as unknown as Parameters<typeof buildTextLayer>[0];

	const layer = await buildTextLayer(page, makeViewport(1, 0), target);
	const span = layer.querySelector('span');
	// 9 characters × 4 px measured = 36 against a PDF advance of
	// 40, so the run is stretched by 1.111 to cover its glyphs.
	expect(measured).toBe(1);
	expect(span?.style.transform).toBe('scaleX(1.1111)');
});

it('leaves the DOM untouched when the browser already matches the PDF', async () => {
	const { buildTextLayer } = await import('./pdf-text-layer.ts');
	const target = document.createElement('div');
	const page = {
		getTextContent: async () => ({
			items: [
				{
					str: 'ab cd',
					dir: 'ltr',
					transform: [12, 0, 0, 12, 50, 700],
					// 5 characters × 4 px measured = 20.
					width: 20,
					height: 12,
					fontName: 'F1',
				},
			],
			styles: { F1: { fontFamily: 'serif', ascent: 0.8, descent: -0.2, vertical: false } },
			lang: 'en',
		}),
	} as unknown as Parameters<typeof buildTextLayer>[0];

	const layer = await buildTextLayer(page, makeViewport(1, 0), target);
	expect(layer.querySelector('span')?.style.transform).toBe('');
});
