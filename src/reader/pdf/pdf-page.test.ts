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

import { degrees, PDFDocument } from 'pdf-lib';
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { asPageIndex, type PageIndex } from '../../domain/reading-state.ts';
import type { ResolvedAnchor } from '../types.ts';
import type { PdfRect } from './anchor.ts';
import type { ViewportLike } from './pdf-coords.ts';
import { loadPdfDocument } from './pdf-document.ts';
import { PDF_PAGE_CLASS, PdfPageHandle } from './pdf-page.ts';

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

/** pdf.js does not re-export `TextContent` from its root; deriving
 *  it from the call keeps the test honest about what it fakes. */
type PageTextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;

function makeTextContent(): PageTextContent {
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
	} as unknown as PageTextContent;
}

interface FakeProxy {
	readonly proxy: PDFPageProxy;
	readonly renders: FakeRenderTask[];
	readonly renderCalls: Record<string, unknown>[];
	/** Every `getViewport` call, as the handle actually made it. The
	 *  rotation reaching pdf.js is the whole of issue #33, so it is
	 *  recorded rather than inferred from the resulting DOM. */
	readonly viewportCalls: { readonly scale: number; readonly rotation: number | undefined }[];
	readonly cleanups: { count: number };
}

interface FakeRenderTask {
	promise: Promise<void>;
	cancel: () => void;
	settled: boolean;
	resolve: () => void;
	reject: (cause: unknown) => void;
}

function makeProxy(options: { autoResolve?: boolean; rotate?: unknown } = {}): FakeProxy {
	const renders: FakeRenderTask[] = [];
	const renderCalls: Record<string, unknown>[] = [];
	const viewportCalls: { scale: number; rotation: number | undefined }[] = [];
	const cleanups = { count: 0 };
	const proxy = {
		// Absent unless a case asks for it, which is the common case:
		// most PDFs carry no `/Rotate` at all, and the handle has to
		// read the missing entry as 0 rather than as a broken page.
		// `rotate` is spread in rather than defaulted so "the page has
		// no /Rotate" and "the page says /Rotate 0" stay distinguishable.
		...(options.rotate === undefined ? {} : { rotate: options.rotate }),
		getViewport: ({ scale, rotation }: { scale?: number; rotation?: number }) => {
			viewportCalls.push({ scale: scale ?? 1, rotation });
			return makeViewport(scale ?? 1, rotation ?? 0);
		},
		render: (params: Record<string, unknown>) => {
			renderCalls.push(params);
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
	return { proxy, renders, renderCalls, viewportCalls, cleanups };
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

describe('PdfPageHandle.render — native /Rotate (issue #33)', () => {
	/**
	 * The full composition table, in the shape this describe asserts
	 * against: every native rotation against every runtime rotation.
	 * Duplicated from `pdf-rotation.test.ts` on purpose — that file
	 * tests the arithmetic, this one tests that the *handle* hands the
	 * answer to pdf.js. A shared constant would let one edit satisfy
	 * both and hide a change to either.
	 */
	const COMPOSITIONS: readonly (readonly [number, number, number])[] = [
		[0, 0, 0],
		[0, 90, 90],
		[0, 180, 180],
		[0, 270, 270],
		[90, 0, 90],
		[90, 90, 180],
		[90, 180, 270],
		[90, 270, 0],
		[180, 0, 180],
		[180, 90, 270],
		[180, 180, 0],
		[180, 270, 90],
		[270, 0, 270],
		[270, 90, 0],
		[270, 180, 90],
		[270, 270, 180],
	];

	/** The page box `render` built, which is the viewport it rendered. */
	function pageBoxOf(target: HTMLElement): HTMLElement {
		const box = target.querySelector<HTMLElement>(`.${PDF_PAGE_CLASS}`);
		if (box === null) throw new Error('no page box rendered');
		return box;
	}

	/** Every length the handle wrote into the DOM, as raw CSS strings.
	 *  The point of reading them back as strings is that a `NaN` never
	 *  survives this far: `style.width` would be the literal text
	 *  `"NaNpx"`, and a browser resolves that to no box at all. */
	function cssLengths(target: HTMLElement): readonly string[] {
		return Array.from(target.querySelectorAll<HTMLElement>('.rm-page, canvas, .rm-text-layer'))
			.flatMap((element) => [element.style.width, element.style.height])
			.filter((value) => value !== '');
	}

	it('hands getViewport the composed total, not the runtime rotation', async () => {
		// The defect in one assertion. Before the composition, the value
		// arriving here was the runtime rotation alone — so a page
		// stored at /Rotate 90 rendered as if it said nothing, and at
		// runtime 0 that meant the book was displayed sideways.
		for (const [native, runtime, total] of COMPOSITIONS) {
			const { proxy, viewportCalls } = makeProxy({ rotate: native });
			const target = document.createElement('div');

			await new PdfPageHandle(PAGE_ONE, proxy).render(target, {
				scale: 1,
				rotation: runtime as 0 | 90 | 180 | 270,
			});

			expect(viewportCalls[0]?.rotation, `native ${native} + runtime ${runtime}`).toBe(total);
		}
	});

	it('renders a page stored sideways at runtime rotation 0', async () => {
		const { proxy, viewportCalls } = makeProxy({ rotate: 90 });
		const target = document.createElement('div');

		await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 });

		// The observable consequence: a 600x800 page stored at
		// /Rotate 90 occupies a landscape box, because the reader is
		// showing the page the way the producer said it should be read.
		// With the runtime rotation passed straight through this was
		// 600x800 and the content was sideways inside it.
		expect(viewportCalls[0]?.rotation).toBe(90);
		expect(pageBoxOf(target).style.width).toBe(`${PAGE_HEIGHT}px`);
		expect(pageBoxOf(target).style.height).toBe(`${PAGE_WIDTH}px`);
	});

	it('reads a page with no /Rotate as 0, leaving the runtime rotation alone', async () => {
		// The overwhelmingly common case, and the one that must not
		// regress: a PDF written normally, with no `/Rotate` anywhere.
		for (const runtime of [0, 90, 180, 270] as const) {
			const { proxy, viewportCalls } = makeProxy();
			const target = document.createElement('div');

			await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1, rotation: runtime });

			expect(viewportCalls[0]?.rotation).toBe(runtime);
		}
	});

	it('rejects a malformed /Rotate to 0 rather than writing NaN into the DOM', async () => {
		// Not "does not throw". The claim is that every length the
		// handle writes is a real one. `rotate(NaNdeg)` and `NaNpx` do
		// not throw in a browser — they silently remove the box, so a
		// page disappears with nothing in the console to explain it.
		const malformed: readonly unknown[] = [
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			45,
			-45,
			'90',
			null,
			{},
		];
		for (const rotate of malformed) {
			const { proxy, viewportCalls } = makeProxy({ rotate });
			const target = document.createElement('div');

			await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 });

			expect(viewportCalls[0]?.rotation, String(rotate)).toBe(0);
			for (const length of cssLengths(target)) {
				expect(length, `${String(rotate)} → ${length}`).not.toContain('NaN');
				expect(length, `${String(rotate)} → ${length}`).not.toContain('Infinity');
				// A real length: a number and a unit.
				expect(length, `${String(rotate)} → ${length}`).toMatch(/^\d+(\.\d+)?px$/);
			}
		}
	});

	it('wraps an out-of-range /Rotate into [0, 360) instead of passing it on', async () => {
		// Not malformed — a PDF is allowed to say these, and pdf.js
		// reduces them to the same answer. The reader has to agree, or
		// the page and this layer would compute two orientations for
		// one page. `getViewport` is sent a quarter turn it has a
		// matrix for, never 450.
		for (const [written, expected] of [
			[360, 0],
			[450, 90],
			[-450, 270],
			[-90, 270],
			[180, 180],
		] as const) {
			const { proxy, viewportCalls } = makeProxy({ rotate: written });
			const target = document.createElement('div');

			await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 });

			expect(viewportCalls[0]?.rotation, `/Rotate ${written}`).toBe(expected);
		}
	});

	it('does not let a malformed /Rotate reset the reader’s own rotation', async () => {
		// The reader's rotation is their action on this session; a page
		// whose `/Rotate` cannot be read must not silently undo it.
		// Summing before normalising would give `NaN` here, and
		// normalising the sum rather than the terms would give 0.
		for (const rotate of [Number.NaN, 45, 'nonsense', null]) {
			const { proxy, viewportCalls } = makeProxy({ rotate });
			const target = document.createElement('div');

			await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1, rotation: 90 });

			expect(viewportCalls[0]?.rotation, String(rotate)).toBe(90);
		}
	});

	it('reads the page dictionary and never writes to it', async () => {
		const fake = makeProxy({ rotate: 90 });
		const mutable = fake.proxy as unknown as Record<string, unknown>;
		// A getter with no setter, so the guard below is real rather
		// than decorative.
		delete mutable.rotate;
		let reads = 0;
		Object.defineProperty(fake.proxy, 'rotate', {
			get: () => {
				reads++;
				return 90;
			},
			configurable: true,
			enumerable: true,
		});
		// This module is strict-mode ESM, so writing to a getter-only
		// property throws. That is the point: it is what makes "the
		// handle only reads" a testable claim rather than a reviewer's
		// assumption about a well-behaved caller.
		expect(() => {
			mutable.rotate = 0;
		}).toThrow(TypeError);

		const target = document.createElement('div');
		await new PdfPageHandle(PAGE_ONE, fake.proxy).render(target, { scale: 1 });

		// It read the page, it composed, and the page is untouched.
		expect(reads).toBeGreaterThan(0);
		expect(fake.viewportCalls[0]?.rotation).toBe(90);
		expect((fake.proxy as unknown as { rotate: number }).rotate).toBe(90);
	});

	it('gives the canvas, the text layer and the highlight one orientation', async () => {
		// The three are the reason the composition happens before
		// `getViewport` rather than as a transform over the result: one
		// viewport means they cannot disagree. A highlight drawn beside
		// its text is the failure this rules out, and it is invisible
		// until a page is actually stored sideways.
		const { proxy } = makeProxy({ rotate: 90 });
		const into = document.createElement('div');
		document.body.appendChild(into);
		const page = new PdfPageHandle(PAGE_ONE, proxy);

		await page.render(into, { scale: 1, rotation: 90 });
		await page.paintResolvedAnchor(
			{
				format: 'pdf',
				page: PAGE_ONE,
				freshness: 'fresh',
				selectedText: 'the cat',
				display: [{ x: 100, y: 600, width: 200, height: 40 }],
				updatedAnchor: null,
			},
			into,
		);

		// Native 90 + runtime 90 = 180: portrait again, and every
		// surface says so.
		const box = pageBoxOf(into);
		expect(box.style.width).toBe(`${PAGE_WIDTH}px`);
		expect(box.style.height).toBe(`${PAGE_HEIGHT}px`);
		const canvas = into.querySelector<HTMLElement>('canvas');
		expect(canvas?.style.width).toBe(`${PAGE_WIDTH}px`);
		const layer = into.querySelector<HTMLElement>('.rm-text-layer');
		expect(layer?.style.width).toBe(`${PAGE_WIDTH}px`);
		// The highlight lives inside the same box, and every one of its
		// fragments is a real length.
		const fragments = into.querySelectorAll<HTMLElement>('.rm-highlight__fragment');
		expect(fragments.length).toBe(1);
		for (const fragment of fragments) {
			for (const length of [fragment.style.left, fragment.style.top, fragment.style.width]) {
				expect(length).toMatch(/^\d+(\.\d+)?px$/);
			}
		}
		into.remove();
	});
});

describe('PdfPageHandle.render against the real pdf.js PageViewport', () => {
	/**
	 * The stub above proves the handle composes; it cannot prove the
	 * number it composes is the one pdf.js acts on. This half keeps
	 * `rotate` and `getViewport` real — a real `PDFPageProxy` reading a
	 * real `/Rotate` off a real page dictionary, building a real
	 * `PageViewport` — and fakes only `render()`, which is the one call
	 * that needs a canvas happy-dom does not have.
	 *
	 * So the box asserted below is the box pdf.js computed, not a
	 * stand-in for it.
	 */
	const PORTRAIT = { width: 420, height: 595 } as const;

	async function realPageProxy(nativeRotate: number | null) {
		const pdf = await PDFDocument.create();
		const page = pdf.addPage([PORTRAIT.width, PORTRAIT.height]);
		if (nativeRotate !== null) page.setRotation(degrees(nativeRotate));
		const doc = await loadPdfDocument(await pdf.save());
		const real = await doc.getPage(1);
		const renderCalls: Record<string, unknown>[] = [];
		const proxy = {
			// A getter, so `rotate` keeps pdf.js's own property
			// descriptor rather than being flattened into a value at
			// construction time.
			get rotate() {
				return real.rotate;
			},
			// `scale` is required here, as it is in pdf.js's
			// `GetViewportParameters`: the handle always passes a
			// resolved scale, and typing it as optional would make this
			// delegation something the real method does not accept.
			getViewport: (params: { scale: number; rotation: number }) => real.getViewport(params),
			render: (params: Record<string, unknown>) => {
				renderCalls.push(params);
				let resolve!: () => void;
				const promise = new Promise<void>((res) => {
					resolve = res;
				});
				queueMicrotask(resolve);
				return {
					promise,
					cancel: () => {},
				} as unknown as RenderTask;
			},
			getTextContent: () => real.getTextContent(),
			cleanup: () => {
				real.cleanup();
			},
		} as unknown as PDFPageProxy;
		return { proxy, renderCalls, real, destroy: () => doc.destroy() };
	}

	function pageBoxOf(target: HTMLElement): HTMLElement {
		const box = target.querySelector<HTMLElement>(`.${PDF_PAGE_CLASS}`);
		if (box === null) throw new Error('no page box rendered');
		return box;
	}

	it('sizes the page from the real composed viewport, not the runtime rotation', async () => {
		// The end-to-end claim of #33, in a form a unit test can
		// actually stand behind: for every native rotation, the box
		// `render` produces is the box pdf.js's own PageViewport
		// produced, and it tracks the *sum*.
		const expectations: readonly (readonly [number | null, number, number, number])[] = [
			// native, runtime, expected width pt, expected height pt
			[null, 0, 420, 595],
			[0, 90, 595, 420],
			[90, 0, 595, 420],
			[90, 90, 420, 595],
			[90, 180, 595, 420],
			[90, 270, 420, 595],
			[180, 0, 420, 595],
			[180, 90, 595, 420],
			[270, 0, 595, 420],
			[270, 90, 420, 595],
			[270, 270, 420, 595],
		];
		for (const [native, runtime, widthPt, heightPt] of expectations) {
			const { proxy, renderCalls, real, destroy } = await realPageProxy(native);
			try {
				const target = document.createElement('div');
				await new PdfPageHandle(PAGE_ONE, proxy).render(target, {
					scale: 1,
					rotation: runtime as 0 | 90 | 180 | 270,
				});

				const label = `native ${String(native)} + runtime ${runtime}`;
				const box = pageBoxOf(target);
				expect(box.style.width, label).toBe(`${widthPt}px`);
				expect(box.style.height, label).toBe(`${heightPt}px`);

				// The very same viewport reached pdf.js's render call.
				// If these two ever disagree, the canvas and its wrapper
				// have been sized from different transforms and the page
				// is drawn into a box that does not fit it.
				const viewport = renderCalls[0]?.viewport as { rotation: number; width: number };
				expect(viewport.rotation, label).toBe(((native ?? 0) + runtime) % 360);
				expect(viewport.width, label).toBe(widthPt);
				// And the page dictionary was not touched to get here.
				expect(real.rotate, label).toBe(native ?? 0);
			} finally {
				await destroy();
			}
		}
	});

	it('never lets a bad /Rotate in a real file reach the DOM as NaN', async () => {
		// The guarantee again, this time with the value where it
		// actually comes from: in the file. A stub can be handed `NaN`;
		// a real page carries whatever a producer wrote.
		//
		// What pdf-lib will not do is write a `/Rotate` that is not a
		// multiple of 90 — it asserts on `setRotation`. So the values
		// exercised here are the ones a real producer can actually emit
		// (absent, and out of range), and the non-multiple / `NaN` cases
		// stay in the stub-based case above, which is where they are
		// reachable at all. Both halves matter: this one proves the
		// value survives the real parser, that one proves the guard is
		// not conditional on the parser having been kind.
		for (const [written, expectedWidth, expectedHeight] of [
			// written /Rotate, and the box it composes to with runtime 90
			[null, 595, 420],
			[360, 595, 420],
			[450, 420, 595],
			[-450, 420, 595],
			[-90, 420, 595],
		] as const) {
			const { proxy, renderCalls, real, destroy } = await realPageProxy(written);
			try {
				const target = document.createElement('div');
				await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1, rotation: 90 });

				const viewport = renderCalls[0]?.viewport as {
					rotation: number;
					width: number;
					height: number;
					transform: readonly number[];
				};
				for (const value of viewport.transform) {
					expect(Number.isFinite(value), `/Rotate ${String(written)}`).toBe(true);
				}
				expect(Number.isFinite(viewport.width), `/Rotate ${String(written)}`).toBe(true);
				expect(Number.isFinite(viewport.height), `/Rotate ${String(written)}`).toBe(true);
				// A real box, not a missing one. Each expectation is the
				// page's own rotation as pdf.js read it (450 is 90,
				// -450 and -90 are 270) plus the reader's 90.
				expect(viewport.width, `/Rotate ${String(written)}`).toBe(expectedWidth);
				expect(pageBoxOf(target).style.width).toBe(`${expectedWidth}px`);
				expect(pageBoxOf(target).style.height).toBe(`${expectedHeight}px`);
				// The page dictionary is still what the file said.
				expect(real.rotate, `/Rotate ${String(written)}`).toBe(
					(((written ?? 0) % 360) + 360) % 360,
				);
			} finally {
				await destroy();
			}
		}
	});
});

describe('HiDPI backing store', () => {
	it('tells pdf.js to draw at the device pixel ratio', async () => {
		const { proxy, renderCalls } = makeProxy();
		const target = document.createElement('div');
		const spy = vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);

		try {
			await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 });
		} finally {
			spy.mockRestore();
		}

		const params = renderCalls[0];
		// Without this transform pdf.js draws in CSS pixels and the
		// page lands in the top-left quarter of a 2× canvas: half size,
		// and blurry once the browser scales it up.
		expect(params?.transform).toEqual([2, 0, 0, 2, 0, 0]);
		const canvas = canvasOf(target);
		expect(canvas.width).toBe(Math.floor(600 * 2));
		expect(canvas.height).toBe(Math.floor(800 * 2));
		// CSS size is unaffected: the text layer is positioned in CSS
		// pixels and has to stay registered with the glyphs.
		expect(canvas.style.width).toBe('600px');
	});

	it('omits the transform at a ratio of 1', async () => {
		const { proxy, renderCalls } = makeProxy();
		const target = document.createElement('div');
		await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 });

		expect(renderCalls[0]?.transform).toBeUndefined();
		expect(canvasOf(target).width).toBe(600);
	});

	it('clamps an absurd device pixel ratio', async () => {
		const { proxy, renderCalls } = makeProxy();
		const target = document.createElement('div');
		const spy = vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(12);

		try {
			await new PdfPageHandle(PAGE_ONE, proxy).render(target, { scale: 1 });
		} finally {
			spy.mockRestore();
		}

		// A 12× backing store for an A4 page exceeds what a browser will
		// allocate; the canvas would come back blank instead of sharp.
		expect(renderCalls[0]?.transform).toEqual([3, 0, 0, 3, 0, 0]);
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

describe('PdfPageHandle.paintResolvedAnchor', () => {
	/** A resolved anchor for page 1, as recovery would hand it over. */
	function resolved(
		over: Partial<ResolvedAnchor> = {},
		fragments: readonly PdfRect[] = [{ x: 100, y: 600, width: 200, height: 40 }],
	): ResolvedAnchor {
		return {
			format: 'pdf',
			page: PAGE_ONE,
			freshness: 'fresh',
			selectedText: 'the cat',
			display: fragments,
			updatedAnchor: null,
			...over,
		};
	}

	function target(): HTMLElement {
		const element = document.createElement('div');
		document.body.appendChild(element);
		return element;
	}

	/** A page rendered into the element it will be painted into: the
	 *  overlay has to land inside the box `render` created, so a test
	 *  that paints into a fresh element is asserting the wrong contract.
	 */
	async function renderedPage(
		proxy: PDFPageProxy,
		options: { scale?: number } = {},
	): Promise<{ page: PdfPageHandle; into: HTMLElement }> {
		const page = new PdfPageHandle(PAGE_ONE, proxy);
		const into = target();
		await page.render(into, { scale: options.scale ?? 1 });
		return { page, into };
	}

	it('hands back a handle so the caller can reconcile overlays against rows', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		const painted = await page.paintResolvedAnchor(resolved(), into);

		// The element is reachable so the UI can apply `Highlight.color` to
		// it: the painter decides geometry and freshness, and the palette
		// belongs to the theme.
		expect(painted?.element).not.toBeNull();
		painted?.element.setAttribute('data-highlight-color', 'yellow');
		expect(painted?.element.getAttribute('data-highlight-color')).toBe('yellow');

		// A re-paint after a recovery or a zoom would otherwise stack a
		// second overlay over the first, and two translucent fills over the
		// same words is a visibly darker highlight.
		const repainted = await page.paintResolvedAnchor(resolved(), into);
		expect(into.querySelectorAll('.rm-highlight').length).toBe(2);
		repainted?.remove();
		expect(into.querySelectorAll('.rm-highlight').length).toBe(1);
	});

	it('removes idempotently, including after the page was rebuilt', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);
		const painted = await page.paintResolvedAnchor(resolved(), into);

		painted?.remove();
		expect(into.querySelector('.rm-highlight')).toBeNull();
		// A re-render replaces the page's children, so the handle is left
		// pointing at a detached node. Removing that is a no-op, not an
		// error — the UI will not know which of the two happened.
		painted?.remove();
		await page.render(into, { scale: 2 });
		painted?.remove();
		expect(into.querySelector('.rm-highlight')).toBeNull();
	});

	it('answers null when it drew nothing', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		// A caller that treats `null` as a handle is holding a hole in its
		// map; one that treats it as an error will fall over on a row from a
		// future version. It has to be a value that means "no overlay".
		expect(await page.paintResolvedAnchor(resolved({}, 'nope' as never), into)).toBeNull();
		expect(await page.paintResolvedAnchor(resolved({ format: 'epub' as never }), into)).toBeNull();
		expect(into.querySelector('.rm-highlight')).toBeNull();
	});

	it('draws one positioned element per fragment, in CSS pixels', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		await page.paintResolvedAnchor(resolved(), into);

		const layer = into.querySelector('.rm-highlight');
		expect(layer).not.toBeNull();
		const fragments = into.querySelectorAll('.rm-highlight__fragment');
		expect(fragments.length).toBe(1);
		// Scale 1, y flipped: user-space y 600..640 is viewport y 160..200.
		const style = (fragments[0] as HTMLElement).style;
		expect(style.left).toBe('100px');
		expect(style.top).toBe('160px');
		expect(style.width).toBe('200px');
		expect(style.height).toBe('40px');
	});

	it('keeps the highlight out of the way of a selection', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		await page.paintResolvedAnchor(resolved(), into);

		// A highlight is under the text, never over it. Without this a drag
		// across a highlighted sentence is a click on the highlight, and
		// the reader cannot select text they just highlighted.
		expect((into.querySelector('.rm-highlight') as HTMLElement).style.pointerEvents).toBe('none');
	});

	it('marks freshness, because the UI has to be able to show it', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		await page.paintResolvedAnchor(resolved({ freshness: 'fresh' }), into);
		await page.paintResolvedAnchor(resolved({ freshness: 'stale' }), into);

		const layers = into.querySelectorAll('.rm-highlight');
		expect(layers[0]?.getAttribute('data-freshness')).toBe('fresh');
		expect(layers[1]?.getAttribute('data-freshness')).toBe('stale');
	});

	it('reuses the viewport the page was actually rendered with', async () => {
		// A highlight converted through a re-derived viewport is a
		// highlight beside its text. The page is rendered at scale 2 and
		// painted with no options: the fragments must come out doubled.
		const { page: scaled, into } = await renderedPage(makeProxy().proxy, { scale: 2 });

		await scaled.paintResolvedAnchor(resolved(), into);

		const style = (into.querySelector('.rm-highlight__fragment') as HTMLElement).style;
		expect(style.width).toBe('400px');
		expect(style.top).toBe('320px');
		expect(scaled.index).toBe(1);
	});

	it('declines display data it does not recognise', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		// `display` came out of storage. A row from a version this build
		// has never heard of paints as nothing rather than taking the
		// reader down.
		await page.paintResolvedAnchor(resolved({}, 'rects' as never), into);
		await page.paintResolvedAnchor(resolved({}, []), into);
		await page.paintResolvedAnchor(resolved({}, [{ x: 1, y: 2, width: 3 }] as never), into);
		// A fragment with no area is a hairline nobody asked for, and the
		// measurement never produces one — so it is a foreign shape, and a
		// foreign shape rejects the whole list rather than one fragment of it.
		await page.paintResolvedAnchor(resolved({}, [{ x: 1, y: 2, width: 0, height: 5 }]), into);
		await page.paintResolvedAnchor(resolved({}, [{ x: 1, y: 2, width: 5, height: -1 }]), into);

		expect(into.querySelector('.rm-highlight')).toBeNull();
	});

	it('declines an anchor for a format it does not paint', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		await page.paintResolvedAnchor(resolved({ format: 'epub' as never }), into);

		expect(into.querySelector('.rm-highlight')).toBeNull();
	});

	it('rejects an anchor belonging to another page', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		// A caller that lost track of which page it was talking to. That is
		// a bug in the call, not a fact about the document, and painting it
		// here would put a highlight on the wrong page.
		await expect(
			page.paintResolvedAnchor(resolved({ page: asPageIndex(7) }), into),
		).rejects.toThrow(/page 7/);
		expect(into.querySelector('.rm-highlight')).toBeNull();
	});

	it('rejects before the page has finished rendering', async () => {
		const page = new PdfPageHandle(PAGE_ONE, makeProxy().proxy);
		const into = target();

		// There is no transform to convert through, and inventing one
		// would place every fragment in the wrong place while looking like
		// it worked. The contract says this is a caller bug, so it throws.
		await expect(page.paintResolvedAnchor(resolved(), into)).rejects.toThrow(/finished rendering/);
		expect(into.querySelector('.rm-highlight')).toBeNull();
	});

	it('rejects while a re-render is in flight, rather than using the old transform', async () => {
		// The transform is dropped when a render *starts*, because the
		// target is mid-rebuild: converting through the previous viewport
		// would place fragments against a canvas about to be replaced, and
		// an overlay appended now would be wiped by `replaceChildren`.
		const slow = makeProxy({ autoResolve: false });
		const page = new PdfPageHandle(PAGE_ONE, slow.proxy);
		const into = target();
		const rendering = page.render(into, { scale: 2 });

		await expect(page.paintResolvedAnchor(resolved(), into)).rejects.toThrow(/finished rendering/);
		slow.renders[0]?.resolve();
		await rendering;
		// Once it has completed, the page paints through the new transform.
		await page.paintResolvedAnchor(resolved(), into);
		const style = (into.querySelector('.rm-highlight__fragment') as HTMLElement).style;
		expect(style.width).toBe('400px');
	});

	it('rejects an element this page was not rendered into', async () => {
		const { page } = await renderedPage(makeProxy().proxy);

		// The overlay has to land inside the box `render` created, or it is
		// positioned in a different coordinate system and sits outside the
		// tokens the caller set on the host.
		await expect(page.paintResolvedAnchor(resolved(), target())).rejects.toThrow(
			/was not rendered into/,
		);
	});

	it('rejects a host that another page handle rendered', async () => {
		// Every rendered page contains a `.rm-page`, so "the target holds a
		// page box" is not evidence of anything. This is the check that
		// stops one page's fragments being laid over another's canvas and
		// converted through an unrelated transform.
		const { page, into } = await renderedPage(makeProxy().proxy);
		const other = await renderedPage(makeProxy().proxy, { scale: 2 });

		await expect(page.paintResolvedAnchor(resolved(), other.into)).rejects.toThrow(
			/was not rendered into/,
		);
		// Its own host still works, and the two handles are independent.
		await page.paintResolvedAnchor(resolved(), into);
		expect(into.querySelector('.rm-highlight')).not.toBeNull();
		expect(other.into.querySelector('.rm-highlight')).toBeNull();
	});

	it('lets a colour set on the host reach the overlay, and only that way', async () => {
		// `Highlight.color` is a semantic name on a generic domain type.
		// The UI sets it on the host it owns; the custom property inherits
		// down to the overlay inside the box, and the painter emits neither
		// a colour nor a colour hook. An unlabelled host leaves the overlay
		// transparent, which is the painter declining to choose rather than
		// choosing a default.
		const { page, into } = await renderedPage(makeProxy().proxy);
		into.setAttribute('data-highlight-color', 'yellow');

		await page.paintResolvedAnchor(resolved(), into);

		const host = into as HTMLElement;
		expect(host.getAttribute('data-highlight-color')).toBe('yellow');
		const box = into.querySelector('.rm-page');
		// The box is created by the reader, not by the UI, and the painter
		// writes neither an attribute nor a colour into it.
		expect(box?.hasAttribute('data-highlight-color')).toBe(false);
		expect(box?.querySelector('.rm-highlight__fragment')).not.toBeNull();
	});

	it('places the overlay inside the page box, not beside it', async () => {
		const { page, into } = await renderedPage(makeProxy().proxy);

		await page.paintResolvedAnchor(resolved(), into);

		const box = into.querySelector('.rm-page');
		expect(box?.querySelector('.rm-highlight')).not.toBeNull();
		expect(into.querySelector(':scope > .rm-highlight')).toBeNull();
	});
});
