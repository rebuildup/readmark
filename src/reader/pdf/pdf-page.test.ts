/**
 * Unit tests for the PDF page handle and the text-layer geometry.
 *
 * `PDFPageProxy` is faked, so these run in happy-dom with no pdf.js
 * and no worker. What they pin is the part the browser cannot be
 * asked about deterministically: the re-entrancy rules.
 *
 *   - A re-render cancels the task in flight instead of letting two
 *     paints race for one canvas.
 *   - A cancelled render is not an error, and a stale continuation
 *     does not attach a text layer to a canvas that is gone.
 *   - Canvas and text layer come out of one viewport, so their sizes
 *     cannot drift.
 *   - `close()` cancels and releases, which is what the screen relies
 *     on when it unmounts mid-render.
 *
 * The arithmetic that decides whether a selection lands on its glyphs
 * is checked in `pdf-text-layer.test.ts`; whether the browser agrees
 * is the smoke's job.
 */

import type { PDFPageProxy, RenderTask, TextContent } from 'pdfjs-dist';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { asPageIndex, type PageIndex } from '../../domain/reading-state.ts';
import type { ViewportLike } from './pdf-coords.ts';
import { PDF_PAGE_CLASS, PdfPageHandle } from './pdf-page.ts';
import { type GlyphRun, layoutRun } from './pdf-text-layer.ts';

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;

/**
 * happy-dom has no canvas implementation, and adding one would be a
 * new dependency for a test double. The page handle only ever calls
 * `save` / `restore` / `scale` / `fillRect` on the context (the
 * paint itself is pdf.js's, and the fake proxy skips it), so the
 * context is stubbed with exactly that surface. Whether a real canvas
 * paints is the browser's business — `scripts/smoke-reader.mjs`
 * checks the pixels.
 */
const stubContext = {
	fillStyle: '',
	save: () => {},
	restore: () => {},
	scale: () => {},
	fillRect: () => {},
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	HTMLCanvasElement.prototype.getContext = (() =>
		stubContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
});

const PAGE_ONE = asPageIndex(1);

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

function makeTextContent(): TextContent {
	return {
		items: [
			{
				str: '吾輩は猫である',
				dir: 'ltr',
				transform: [12, 0, 0, 12, 50, 700],
				width: 120,
				height: 12,
				fontName: 'F1',
			},
		],
		styles: {
			F1: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'serif' },
		},
		lang: 'ja',
	} as unknown as TextContent;
}

interface FakeProxy {
	readonly proxy: PDFPageProxy;
	readonly renders: FakeRenderTask[];
	readonly cleanups: { count: number };
}

interface FakeRenderTask {
	promise: Promise<void>;
	cancel: () => void;
	settled: boolean;
	resolve: () => void;
	reject: (cause: unknown) => void;
}

function makeProxy(options: { autoResolve?: boolean } = {}): FakeProxy {
	const renders: FakeRenderTask[] = [];
	const cleanups = { count: 0 };
	const proxy = {
		getViewport: ({ scale, rotation }: { scale?: number; rotation?: number }) =>
			makeViewport(scale ?? 1, rotation ?? 0),
		render: () => {
			let resolve!: () => void;
			let reject!: (cause: unknown) => void;
			const promise = new Promise<void>((res, rej) => {
				resolve = () => {
					task.settled = true;
					res();
				};
				reject = (cause: unknown) => {
					task.settled = true;
					rej(cause);
				};
			});
			const task: FakeRenderTask = {
				promise,
				settled: false,
				resolve,
				reject,
				cancel: () => {
					if (task.settled) return;
					task.reject(
						Object.assign(new Error('cancelled'), {
							name: 'RenderingCancelledException',
						}),
					);
				},
			};
			renders.push(task);
			if (options.autoResolve !== false) queueMicrotask(task.resolve);
			return task as unknown as RenderTask;
		},
		getTextContent: async () => makeTextContent(),
		cleanup: () => {
			cleanups.count++;
		},
	} as unknown as PDFPageProxy;
	return { proxy, renders, cleanups };
}

function canvasOf(target: HTMLElement): HTMLCanvasElement {
	const canvas = target.querySelector('canvas');
	if (canvas === null) throw new Error('no canvas rendered');
	return canvas;
}

function textLayerOf(target: HTMLElement): HTMLElement {
	const layer = target.querySelector<HTMLElement>('.rm-text-layer');
	if (layer === null) throw new Error('no text layer rendered');
	return layer;
}

describe('PdfPageHandle.render', () => {
	it('renders a canvas and a text layer from one viewport', async () => {
		const { proxy } = makeProxy();
		const target = document.createElement('div');
		await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 });

		const viewport = makeViewport(1, 0);
		const canvas = canvasOf(target);
		expect(canvas.style.width).toBe(`${viewport.width}px`);
		expect(canvas.style.height).toBe(`${viewport.height}px`);
		const layer = textLayerOf(target);
		expect(layer.style.width).toBe(`${viewport.width}px`);
		expect(layer.style.height).toBe(`${viewport.height}px`);
		// Both layers live inside one measured wrapper, which is what
		// the screen reserves scroll space from.
		expect(target.querySelectorAll(`.${PDF_PAGE_CLASS}`)).toHaveLength(1);
	});

	it('keeps the two layers registered at a different zoom', async () => {
		const { proxy } = makeProxy();
		const target = document.createElement('div');
		const page = new PdfPageHandle(PAGE_ONE, proxy);

		await page.render(target, { scale: 1 });
		await page.render(target, { scale: 2 });

		const viewport = makeViewport(2, 0);
		expect(canvasOf(target).style.width).toBe(`${viewport.width}px`);
		expect(textLayerOf(target).style.width).toBe(`${viewport.width}px`);
		// A re-render replaces the DOM: leaving the old layer behind
		// is how a selection ends up over a stale transform.
		expect(target.querySelectorAll('.rm-text-layer')).toHaveLength(1);
		expect(target.querySelectorAll('canvas')).toHaveLength(1);
	});

	it('swaps the viewport dimensions at 90°', async () => {
		const { proxy } = makeProxy();
		const target = document.createElement('div');
		await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1, rotation: 90 });

		const viewport = makeViewport(1, 90);
		expect(canvasOf(target).style.width).toBe(`${viewport.width}px`);
		expect(textLayerOf(target).style.width).toBe(`${viewport.width}px`);
	});

	it('cancels the in-flight render when a new one starts', async () => {
		const { proxy, renders } = makeProxy({ autoResolve: false });
		const target = document.createElement('div');
		const page = new PdfPageHandle(PAGE_ONE, proxy);

		const first = page.render(target, { scale: 1 });
		const second = page.render(target, { scale: 2 });
		// The cancelled first paint rejects with
		// RenderingCancelledException, which must not surface.
		await expect(first).resolves.toBeUndefined();
		renders[1]?.resolve();
		await expect(second).resolves.toBeUndefined();
		expect(renders[0]?.settled).toBe(true);
	});

	it('does not attach a text layer to a superseded canvas', async () => {
		const { proxy, renders } = makeProxy({ autoResolve: false });
		const target = document.createElement('div');
		const page = new PdfPageHandle(PAGE_ONE, proxy);

		const first = page.render(target, { scale: 1 });
		const second = page.render(target, { scale: 2 });
		await first;
		renders[1]?.resolve();
		await second;

		// Only the surviving render's text layer exists.
		expect(target.querySelectorAll('.rm-text-layer')).toHaveLength(1);
	});

	it('surfaces a genuine render failure', async () => {
		const { proxy, renders } = makeProxy({ autoResolve: false });
		const target = document.createElement('div');
		const page = new PdfPageHandle(PAGE_ONE, proxy);
		const rendering = page.render(target, { scale: 1 });

		renders[0]?.reject(new Error('out of memory'));
		await expect(rendering).rejects.toThrow('out of memory');
	});
});

describe('PdfPageHandle lifecycle', () => {
	it('projects the text layer into raw user-space', async () => {
		const { proxy } = makeProxy();
		const layer = await new PdfPageHandle(PAGE_ONE, proxy).text();

		expect(layer.format).toBe('pdf');
		expect(layer.page).toBe(PAGE_ONE);
		expect(layer.items).toHaveLength(1);
		const item = layer.items[0];
		expect(item?.text).toBe('吾輩は猫である');
		// The box is anchored at the baseline origin and extends
		// upward by the glyph height — user space, not viewport space.
		expect(item?.rect).toEqual({ x: 50, y: 700 - 12, width: 120, height: 12 });
	});

	it('returns no anchor until #7 owns selection → anchor', async () => {
		const { proxy } = makeProxy();
		const range = document.createRange();
		const target = document.createElement('div');
		range.selectNodeContents(target);
		const anchor = await new PdfPageHandle(PAGE_ONE, proxy).createAnchorFromSelection({
			range,
			container: target,
		});
		expect(anchor).toBeNull();
	});

	it('cancels pending work and releases the page on close', async () => {
		const { proxy, renders, cleanups } = makeProxy({ autoResolve: false });
		const page = new PdfPageHandle(PAGE_ONE, proxy);
		const rendering = page.render(document.createElement('div'), { scale: 1 });

		page.close();
		await rendering;

		expect(renders[0]?.settled).toBe(true);
		expect(cleanups.count).toBe(1);
	});

	it('ignores a render requested after close', async () => {
		const { proxy, renders } = makeProxy();
		const page = new PdfPageHandle(PAGE_ONE, proxy);
		page.close();

		const target = document.createElement('div');
		await page.render(target, { scale: 1 });

		// No canvas: the page is gone, and a late render must not
		// resurrect it against a destroyed document.
		expect(target.querySelector('canvas')).toBeNull();
		expect(renders).toHaveLength(0);
	});

	it('is idempotent on close', () => {
		const { proxy, cleanups } = makeProxy();
		const page = new PdfPageHandle(PAGE_ONE, proxy);
		page.close();
		page.close();
		expect(cleanups.count).toBe(1);
	});
});

describe('layoutRun', () => {
	const run: GlyphRun = {
		text: '猫',
		transform: [12, 0, 0, 12, 50, 700],
		width: 12,
		height: 12,
		style: { fontFamily: 'serif', ascent: 0.8, descent: -0.2, vertical: false },
	};

	it('places the run in viewport space, not user space', () => {
		const layout = layoutRun(run, makeViewport(1, 0));
		// The run's origin is at (50, 700) in user space, where y
		// grows upward from the page bottom. The viewport flips that:
		// y = 800 - 700 = 100, minus the ascent for the box's top edge.
		expect(layout.x).toBeCloseTo(50, 6);
		expect(layout.y).toBeCloseTo(100 - 0.8 * 12, 6);
		expect(layout.fontSize).toBeCloseTo(12, 6);
		// A run already upright needs no rotation; the font size alone
		// carries the scale, so a matrix here would scale twice.
		expect(layout.transform).toBe('');
	});

	it('scales with the zoom', () => {
		const layout = layoutRun(run, makeViewport(2, 0));
		expect(layout.x).toBeCloseTo(100, 6);
		expect(layout.y).toBeCloseTo(200 - 0.8 * 24, 6);
		expect(layout.fontSize).toBeCloseTo(24, 6);
	});

	it('rotates a run that is not upright in the viewport', () => {
		const rotated: GlyphRun = {
			...run,
			// Text rotated 90° inside the page: its x axis now runs
			// along the page's y, so the run needs an explicit rotation
			// and its ascent offset follows the rotation too.
			transform: [0, 12, -12, 0, 50, 700],
		};
		const layout = layoutRun(rotated, makeViewport(1, 0));
		expect(layout.transform).toBe('rotate(1.570796rad)');
		expect(layout.fontSize).toBeCloseTo(12, 6);
		expect(Number.isFinite(layout.x)).toBe(true);
		expect(Number.isFinite(layout.y)).toBe(true);
	});
});

describe('PageIndex contract', () => {
	it('stays 1-based through the page handle', async () => {
		const { proxy } = makeProxy();
		const index = asPageIndex(1) as PageIndex;
		const page = new PdfPageHandle(index, proxy);
		expect(page.index).toBe(1);
		expect(page.format).toBe('pdf');
	});
});

describe('canvas context', () => {
	it('fails loudly when no 2d context is available', async () => {
		const { proxy } = makeProxy();
		const target = document.createElement('div');
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		try {
			await expect(new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 })).rejects.toThrow(
				'2d canvas context is unavailable',
			);
		} finally {
			vi.restoreAllMocks();
		}
	});
});
