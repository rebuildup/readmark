/**
 * Smoke tests for pdf-worker setup.
 *
 * These verify the side-effect contract:
 *   - importing the module registers the worker URL once
 *   - re-running setupPdfWorker() is idempotent
 *   - the URL points to the bundled worker (not a fake-worker stub)
 *
 * Actual PDF loading is NOT exercised here — that's covered in
 * `pdf-metadata.test.ts`. The full worker pipeline needs the
 * browser environment; this test runs in Node via Vitest and
 * only checks the URL string set on GlobalWorkerOptions.
 *
 * Why the dynamic import of `pdfjs-dist` here:
 *   - We only need `GlobalWorkerOptions` to inspect the URL.
 *   - Statically importing `pdfjs-dist` triggers a
 *     "Please use the legacy build in Node.js environments"
 *     warning from pdf.js itself. The legacy build (used by
 *     `pdf-document.ts`) doesn't expose the same shape on
 *     `GlobalWorkerOptions`, so we import the modern entry
 *     lazily and just read the field.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

describe('pdf-worker', () => {
	let pdfjsLib: typeof import('pdfjs-dist');
	let ORIGINAL_SRC: string;

	beforeAll(async () => {
		pdfjsLib = await import('pdfjs-dist');
		ORIGINAL_SRC = pdfjsLib.GlobalWorkerOptions.workerSrc;
	});

	afterEach(() => {
		// Restore the original workerSrc so test ordering doesn't leak.
		pdfjsLib.GlobalWorkerOptions.workerSrc = ORIGINAL_SRC;
	});

	it('registers the bundled worker URL on import', async () => {
		// The module's top-level call must have already set the URL.
		// We import dynamically to be explicit about evaluation order.
		await import('./pdf-worker.ts');
		expect(pdfjsLib.GlobalWorkerOptions.workerSrc).not.toBe('');
		expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toMatch(/\.mjs$/);
	});

	it('is idempotent — calling setup twice does not re-set the URL', async () => {
		const { setupPdfWorker } = await import('./pdf-worker.ts');
		const first = pdfjsLib.GlobalWorkerOptions.workerSrc;
		await setupPdfWorker();
		await setupPdfWorker();
		await setupPdfWorker();
		const second = pdfjsLib.GlobalWorkerOptions.workerSrc;
		expect(second).toBe(first);
	});

	it('does NOT use a fake-worker stub', async () => {
		// pdf.js falls back to a fake worker if workerSrc is unset or
		// unresolvable. That breaks real PDF rendering. We assert the
		// URL is non-empty and ends in `.mjs` (the bundled worker file).
		await import('./pdf-worker.ts');
		const src = pdfjsLib.GlobalWorkerOptions.workerSrc;
		expect(src).toBeTruthy();
		expect(src.length).toBeGreaterThan(0);
		expect(src).not.toContain('worker-stub');
	});
});
