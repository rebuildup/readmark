/**
 * readmark — PDF worker setup.
 *
 * Single responsibility (ADR-0004 §Boundary / §Enforcement):
 *   - Resolve the bundled `pdf.worker.min.mjs` URL via Vite's
 *     `?url` pattern.
 *   - Set `pdfjsLib.GlobalWorkerOptions.workerSrc` exactly once,
 *     module-globally, on first import.
 *
 * NOT in scope here (kept out on purpose):
 *   - `getDocument()` — see `pdf-document.ts`.
 *   - Page rendering / text extraction — see `pdf-page.ts` /
 *     `pdf-text-layer.ts`.
 *
 * Why this module uses a fire-and-forget side-effect import:
 *   - Modules in `src/reader/pdf/` that call pdf.js APIs need
 *     the worker URL registered before they run. Importing this
 *     module kicks off the registration; callers that actually
 *     open a document must additionally `await setupPdfWorker()`
 *     (see "Synchronization" below).
 *   - The function is exported so tests can assert init has
 *     run and so callers can await when timing matters.
 *
 * Synchronization (the actual guarantee):
 *   - `setupPdfWorker()` returns a Promise and lazily imports
 *     `pdfjs-dist`. The side-effect import only *issues* the
 *     registration; the worker URL is set on `GlobalWorkerOptions`
 *     only when the dynamic import resolves.
 *   - Concurrent callers share the same in-flight Promise, so
 *     two near-simultaneous calls will not both race into a
 *     `pdfjs-dist` import + `GlobalWorkerOptions` write.
 *   - Callers that touch pdf.js APIs MUST `await setupPdfWorker()`
 *     before their first `getDocument()`. `loadPdfDocument()`
 *     does this in its browser path. The Node path skips the
 *     call entirely (legacy build is worker-free).
 *   - In other words: importing this module is necessary but not
 *     sufficient; `loadPdfDocument()` is the synchronization
 *     point.
 *
 * Why idempotent (the `setupPromise` flag):
 *   - Module-graph re-evaluation under HMR / Vitest can run the
 *     top-level statement more than once. Setting the same URL
 *     twice is harmless but wastes cycles; an early-return keeps
 *     behavior tight.
 *   - Concurrent callers are deduped via `setupPromise`: a second
 *     caller arriving while the first is still awaiting the
 *     `pdfjs-dist` import reuses the in-flight promise, so we
 *     only do the import + assignment once.
 *
 * Why the dynamic import of `pdfjs-dist`:
 *   - The legacy build (`pdfjs-dist/legacy/build/pdf.mjs`) used
 *     in Node tests (see `pdf-document.ts`) does not consume
 *     `GlobalWorkerOptions.workerSrc` and would emit a warning
 *     ("Please use the legacy build in Node.js environments")
 *     if the modern entry was statically imported.
 *   - We `await import('pdfjs-dist')` lazily, only when
 *     `setupPdfWorker()` actually runs in a browser-shaped
 *     environment. The Node path skips the import entirely.
 */

// `?url` is a Vite suffix: returns the resolved asset URL string.
// ADR-0004 / vite.config.ts: worker is excluded from optimizeDeps
// and uses ESM format (`worker.format: 'es'`).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Module-private: has the worker URL been registered already?
 *  Set synchronously when the call enters so concurrent callers
 *  see the in-flight promise rather than racing into a second
 *  `await import('pdfjs-dist')`. */
let setupPromise: Promise<void> | null = null;

/** Module-private: the URL we registered. Exposed for tests. */
export const READMARK_PDF_WORKER_URL: string = pdfWorkerUrl;

/**
 * Idempotent worker registration. Safe to call multiple times
 * AND safe under concurrent calls: a second caller arriving
 * while the first is still awaiting the `pdfjs-dist` import
 * reuses the in-flight promise.
 *
 * Browser-only: under Node (Vitest), this is a no-op because
 * the legacy build (loaded by `pdf-document.ts`) does not use
 * a worker. We avoid importing the modern `pdfjs-dist` entry
 * statically so Node tests do not see the
 * "Please use the legacy build in Node.js environments" warning.
 *
 * Called automatically on module evaluation (see bottom of file).
 */
export function setupPdfWorker(): Promise<void> {
	if (setupPromise !== null) return setupPromise;
	// Skip the worker registration under Node. The legacy build
	// ignores `workerSrc` anyway, and touching `GlobalWorkerOptions`
	// on the unused modern entry would emit a deprecation warning.
	// `globalThis.process` is the safer shape — Vite's process
	// polyfill exposes `process` as a global in browser builds
	// too, so a bare `typeof process` check would (wrongly)
	// report Node and skip worker setup there as well.
	if (typeof globalThis.process?.versions?.node === 'string') {
		setupPromise = Promise.resolve();
		return setupPromise;
	}
	setupPromise = (async () => {
		const pdfjsLib = await import('pdfjs-dist');
		if (pdfjsLib.GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
			pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
		}
	})();
	return setupPromise;
}

// Side-effect: register the worker as soon as this module is imported
// in a browser-shaped environment. Callers should `import './pdf-worker.ts'`
// (or any module that re-exports from it) BEFORE calling `getDocument()`.
// Under Node this resolves to a no-op promise (no pdfjs-dist import).
void setupPdfWorker();
