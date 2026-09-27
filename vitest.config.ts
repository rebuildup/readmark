import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// readmark — Vitest config.
//
// - happy-dom (not jsdom) — pdfjs-dist wants modern Web APIs that jsdom still
//   mocks imperfectly (ResizeObserver, structuredClone for Blob, etc.).
//   happy-dom is closer to Chrome semantics in 2026.
// - Coverage is opt-in (`bun run test:coverage`) — ADR of rebuildup/project-init
//   explicitly refuses to mandate coverage thresholds.
export default defineConfig({
	resolve: {
		alias: {
			'~': resolve(import.meta.dirname, 'src'),
		},
	},
	test: {
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		// Pool: Vitest's default (`forks`), one isolated process per
		// test file.
		//
		// Why not `vmThreads` (this config used to pin it so pdfjs'
		// worker setup could not bleed between files): react-router 7
		// ships a CJS entry that `require`s its own ESM build
		// (`react-router/dom` → `dom-export.mjs`). Inside a
		// `vmThreads` worker Node resolves that through the CJS
		// condition and the file is parsed as CommonJS, so any test
		// that touches a `Link` / `useNavigate` dies with
		// "Cannot use import statement outside a module" before a
		// single assertion runs. Inlining the package does not help —
		// the require happens in Node's own loader.
		//
		// Isolation is not lost: `isolate` defaults to true, so each
		// test file still gets a fresh process and pdfjs' global
		// worker state cannot leak across files.
	},
});
