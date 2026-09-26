/**
 * Smoke tests for `pdf-worker` setup.
 *
 * Contract under Node (this Vitest environment — `pdf-worker.ts`
 * skips the `pdfjs-dist` import in Node to avoid the legacy-build
 * warning, see the module-level comment for the full rationale):
 *
 *   - `setupPdfWorker()` is a no-op. It MUST NOT mutate
 *     `pdfjsLib.GlobalWorkerOptions.workerSrc` and MUST NOT
 *     import `pdfjs-dist`. We assert the "side-effects-free"
 *     half; the "did not import pdfjs-dist" half is enforced by
 *     the fact that `pdfjs-dist` is reachable here only via an
 *     explicit user-driven `import()` (not from `setupPdfWorker`).
 *   - `READMARK_PDF_WORKER_URL` is the Vite-`?url`-resolved
 *     string for the bundled worker. We never assert here that
 *     `pdfjsLib.GlobalWorkerOptions.workerSrc === that URL`,
 *     because under Node it isn't (and shouldn't be).
 *
 * The "the bundled worker URL is registered on
 * GlobalWorkerOptions in a real browser" assertion has moved
 * out of unit-land — it's verified end-to-end by
 * `scripts/smoke-import.mjs` against `bun run preview`.
 */

import { describe, expect, it } from 'vitest';
import { READMARK_PDF_WORKER_URL, setupPdfWorker } from './pdf-worker.ts';

describe('pdf-worker (Node contract)', () => {
	it('exposes the bundled worker URL as a non-empty ESM path', () => {
		// Vite's `?url` resolves to a public asset path or, in test
		// runtime, the path the bundler would emit. Either way: it
		// is a string, non-empty, points at an `.mjs` file, and is
		// not a fake-worker placeholder.
		expect(typeof READMARK_PDF_WORKER_URL).toBe('string');
		expect(READMARK_PDF_WORKER_URL.length).toBeGreaterThan(0);
		expect(READMARK_PDF_WORKER_URL).toMatch(/\.mjs(\?.*)?$/);
		expect(READMARK_PDF_WORKER_URL).not.toContain('worker-stub');
	});

	it('setupPdfWorker is a no-op under Node (does not mutate GlobalWorkerOptions)', async () => {
		// Re-assert what `pdf-worker.ts` promises: under Node,
		// `setupPdfWorker` returns early without touching
		// `pdfjsLib.GlobalWorkerOptions`. We import pdfjs-dist
		// explicitly from this test (the test owns that warning),
		// snapshot workerSrc, call setup, and assert the value
		// didn't change.
		const pdfjsLib = await import('pdfjs-dist');
		const before = pdfjsLib.GlobalWorkerOptions.workerSrc;
		await setupPdfWorker();
		const after = pdfjsLib.GlobalWorkerOptions.workerSrc;
		expect(after).toBe(before);
	});

	it('setupPdfWorker resolves to void', async () => {
		await expect(setupPdfWorker()).resolves.toBeUndefined();
	});
});
