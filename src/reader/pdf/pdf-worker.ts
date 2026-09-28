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
 *   - `setupPdfWorker()` is `async` and lazily imports
 *     `pdfjs-dist`. The side-effect import only *issues* the
 *     registration; the worker URL is set on `GlobalWorkerOptions`
 *     only when the dynamic import resolves.
 *   - Callers that touch pdf.js APIs MUST `await setupPdfWorker()`
 *     before their first `getDocument()`. `loadPdfDocument()`
 *     does this in its browser path. The Node path skips the
 *     call entirely (legacy build is worker-free).
 *   - In other words: importing this module is necessary but not
 *     sufficient; `loadPdfDocument()` is the synchronization
 *     point.
 *
 * Why idempotent (the `initialized` flag):
 *   - Module-graph re-evaluation under HMR / Vitest can run the
 *     top-level statement more than once. Setting the same URL
 *     twice is harmless but wastes cycles; an early-return keeps
 *     behavior tight.
 *   - If a future test wants to swap the worker URL, it can call
 *     `setupPdfWorker({ force: true, src: ... })` (not in MVP
 *     surface; reserved hook).
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

// Virtual module provided by the `readmark:pdfjs-support-tables`
// plugin. It reports how many files each support-table directory held
// at build time, so a test can assert the inputs exist rather than
// discovering a missing table as invisible glyphs at runtime.
import { SUPPORT_TABLE_COUNTS } from 'virtual:readmark-pdfjs-assets';
// `?url` is a Vite suffix: returns the resolved asset URL string.
// ADR-0004 / vite.config.ts: worker is excluded from optimizeDeps
// and uses ESM format (`worker.format: 'es'`).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Module-private: has the worker URL been registered already? */
let initialized = false;

/** Module-private: the URL we registered. Exposed for tests. */
export const READMARK_PDF_WORKER_URL: string = pdfWorkerUrl;

/**
 * Base URL the support tables are served from.
 *
 * `vite.config.ts` serves `pdfjs-dist/{cmaps,standard_fonts,wasm,iccs}`
 * at `<base>/assets/pdfjs/<dir>/` in BOTH dev and build, so the base
 * comes from `import.meta.env.BASE_URL` — Vite's own notion of where
 * the app is mounted. That keeps a non-root deployment (`base:
 * '/readmark/'`) working without a second edit.
 *
 * Why NOT derived from the worker's own URL, which looks tidier: the
 * two disagree in dev. Vite serves the worker from
 * `/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`, so slicing its
 * directory yields `/node_modules/pdfjs-dist/build/pdfjs/` — a path
 * that does not exist. The result is a dev server where every document
 * silently loses its glyphs while `bun run build && bun run preview`
 * works, which is the worst possible shape for this bug.
 *
 * Why not `new URL('.', workerUrl)`: this module is also evaluated
 * under Node (Vitest, and the legacy pdf.js path), where `?url` yields
 * a bare path with no origin and `new URL(relative, base)` throws
 * `Invalid base URL`, taking the whole application down at import time.
 */
const PDFJS_ASSET_BASE = `${import.meta.env.BASE_URL}assets/pdfjs/`;

/**
 * The `getDocument()` asset URLs.
 *
 * Only used in the browser. Under Node the legacy build runs on the
 * main thread with no asset fetching, and these URLs would not be
 * resolvable, so `pdf-document.ts` omits them there.
 */
export const READMARK_PDF_ASSET_URLS = {
	cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
	cMapPacked: true,
	standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
	wasmUrl: `${PDFJS_ASSET_BASE}wasm/`,
	iccUrl: `${PDFJS_ASSET_BASE}iccs/`,
} as const;

/**
 * How many files each support-table directory held at build time.
 *
 * A pdf.js upgrade that drops or renames one of these directories
 * would otherwise surface only as invisible glyphs at runtime, so the
 * counts are asserted directly by `pdf-worker.test.ts`.
 */
export const READMARK_PDF_ASSET_TABLES = SUPPORT_TABLE_COUNTS;

/**
 * Idempotent worker registration. Safe to call multiple times.
 *
 * Browser-only: under Node (Vitest), this is a no-op because
 * the legacy build (loaded by `pdf-document.ts`) does not use
 * a worker. We avoid importing the modern `pdfjs-dist` entry
 * statically so Node tests do not see the
 * "Please use the legacy build in Node.js environments" warning.
 *
 * Called automatically on module evaluation (see bottom of file).
 */
export async function setupPdfWorker(): Promise<void> {
	if (initialized) return;
	// Skip the worker registration under Node. The legacy build
	// ignores `workerSrc` anyway, and touching `GlobalWorkerOptions`
	// on the unused modern entry would emit a deprecation warning.
	if (typeof process !== 'undefined' && process.versions?.node !== undefined) {
		return;
	}
	const pdfjsLib = await import('pdfjs-dist');
	if (pdfjsLib.GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
		pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
	}
	initialized = true;
}

// Side-effect: register the worker as soon as this module is imported
// in a browser-shaped environment. Callers should `import './pdf-worker.ts'`
// (or any module that re-exports from it) BEFORE calling `getDocument()`.
// Under Node this resolves to a no-op promise (no pdfjs-dist import).
void setupPdfWorker();
