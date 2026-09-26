import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// readmark — Vite config.
//
// Why each option is set:
// - `optimizeDeps.include: ['pdfjs-dist']` — pdfjs-dist ships many ESM chunks;
//   pre-bundling speeds up dev-server cold start. pdf.worker.min.mjs is loaded
//   via `?url` (NOT pre-bundled as a worker) — see docs/adr/ADR-0004.
// - `worker.format: 'es'` — pdfjs-dist 5.x worker is an ES module.
// - `resolve.alias` — `~/*` mirrors the host repo's tsconfig path alias shape.
// - `server.headers` — COOP/COEP for SharedArrayBuffer (pdfjs needs it for
//   certain multi-threaded decode paths). Safe to enable locally too.
export default defineConfig({
	resolve: {
		alias: {
			'~': resolve(import.meta.dirname, 'src'),
		},
	},
	plugins: [react()],
	optimizeDeps: {
		include: ['pdfjs-dist'],
		exclude: ['pdfjs-dist/build/pdf.worker.min.mjs'],
	},
	worker: {
		format: 'es',
	},
	server: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp',
		},
	},
	preview: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp',
		},
	},
});
