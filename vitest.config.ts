import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// readmark — Vitest config.
//
// - happy-dom (not jsdom) — pdfjs-dist wants modern Web APIs that jsdom still
//   mocks imperfectly (ResizeObserver, structuredClone for Blob, etc.).
//   happy-dom is closer to Chrome semantics in 2026.
// - `pool: 'vmThreads'` so worker setup for pdfjs doesn't bleed into tests.
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
		pool: 'vmThreads',
		poolOptions: {
			vmThreads: { singleThread: true },
		},
	},
});
