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
 * Why a side-effect import, not an explicit `init()`:
 *   - Other modules in `src/reader/pdf/` need pdf.js's worker to
 *     be configured BEFORE they call any pdf.js API. A side-effect
 *     import guarantees "by the time this module finishes loading,
 *     the worker URL is set."
 *   - The function is still exported (`setupPdfWorker()`) for
 *     tests and for callers that want to assert init has run.
 *
 * Why idempotent (the `initialized` flag):
 *   - Module-graph re-evaluation under HMR / Vitest can run the
 *     top-level statement more than once. Setting the same URL
 *     twice is harmless but wastes cycles; an early-return keeps
 *     behavior tight.
 *   - If a future test wants to swap the worker URL, it can call
 *     `setupPdfWorker({ force: true, src: ... })` (not in MVP
 *     surface; reserved hook).
 */

import * as pdfjsLib from 'pdfjs-dist';
// `?url` is a Vite suffix: returns the resolved asset URL string.
// ADR-0004 / vite.config.ts: worker is excluded from optimizeDeps
// and uses ESM format (`worker.format: 'es'`).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Module-private: has the worker URL been registered already? */
let initialized = false;

/** Module-private: the URL we registered. Exposed for tests. */
export const READMARK_PDF_WORKER_URL: string = pdfWorkerUrl;

/**
 * Idempotent worker registration. Safe to call multiple times.
 *
 * Called automatically on module evaluation (see bottom of file).
 */
export function setupPdfWorker(): void {
	if (initialized) return;
	// pdfjs's getter exists even before any set; reading first avoids
	// a redundant write when the URL is already correct.
	if (pdfjsLib.GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
		pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
	}
	initialized = true;
}

// Side-effect: register the worker as soon as this module is imported.
// Callers should `import './pdf-worker.ts'` (or any module that
// re-exports from it) BEFORE calling `getDocument()`.
setupPdfWorker();
