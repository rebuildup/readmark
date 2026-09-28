import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);

/**
 * Ship pdf.js's runtime support tables, and serve them in dev.
 *
 * pdf.js fetches these over HTTP *at render time*, by URL, and never
 * imports them. Nothing in the module graph references them, so a
 * bundler has no reason to emit them: a plain `vite build` produces a
 * `dist/` where every one of these requests 404s.
 *
 * The failure is silent and severe. No exception is thrown, the
 * document loads, `getTextContent()` still returns the right strings —
 * and the glyphs simply do not paint. For Japanese PDFs this is the
 * common case, not an edge case: they are overwhelmingly Type0 /
 * Identity-H, whose character-code-to-CID mapping lives in exactly
 * these CMap files.
 *
 * `cmaps` and `standard_fonts` are the two that lose text. `wasm`
 * carries the JBIG2 / OpenJPEG image decoders and QCMS colour
 * management; `iccs` carries colour profiles. All four are shipped
 * because a reader that renders page 1 correctly and page 40's scanned
 * image blank is not a reader.
 *
 * Why a plugin rather than a `copy` step in the build script: the dev
 * server needs the same paths to resolve, and `configureServer` gives
 * both from one declaration. It also means `bun run build` needs no
 * extra step to stay correct.
 *
 * Why the inventory is injected as a virtual module:
 * a directory has no module entry to resolve, so
 * `import 'pdfjs-dist/cmaps/?raw'` is rejected by Rollup outright.
 * The counts are a build-time fact, so computing them here and
 * injecting them keeps the filesystem read out of the app while still
 * failing loudly if a future pdf.js upgrade drops or renames a
 * directory.
 *
 * Exported because `vitest.config.ts` loads the same plugin: the app
 * imports the virtual module, and a test environment without the
 * plugin cannot resolve it.
 */
export function pdfjsSupportTables(): Plugin {
	const DIRECTORIES = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const;
	// Must match `READMARK_PDF_ASSET_URLS` in
	// `src/reader/pdf/pdf-worker.ts`, which derives the same path from
	// the worker's emitted URL.
	const OUTPUT_SUBPATH = 'assets/pdfjs';
	const VIRTUAL_ID = 'virtual:readmark-pdfjs-assets';
	const RESOLVED_ID = `\0${VIRTUAL_ID}`;

	const pdfjsRoot = resolve(require.resolve('pdfjs-dist/package.json'), '..');

	const inventory = () =>
		Object.fromEntries(
			DIRECTORIES.map((dir) => [
				dir,
				readdirSync(resolve(pdfjsRoot, dir)).filter((f) => !f.startsWith('.')).length,
			]),
		);

	async function copyInto(target: string): Promise<void> {
		await Promise.all(
			DIRECTORIES.map((dir) =>
				cp(resolve(pdfjsRoot, dir), resolve(target, OUTPUT_SUBPATH, dir), {
					recursive: true,
				}),
			),
		);
	}

	return {
		name: 'readmark:pdfjs-support-tables',
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_ID : null;
		},
		load(id) {
			if (id !== RESOLVED_ID) return null;
			return `export const SUPPORT_TABLE_COUNTS = ${JSON.stringify(inventory())};`;
		},
		// Dev server: serve the tables at the same paths the URLs
		// resolve to, so dev and production behave identically. A
		// dev-only pass is how "works on my machine" bugs are made.
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url?.split('?')[0] ?? '';
				const match = url.match(/^\/assets\/pdfjs\/([a-z_]+)\//);
				if (!match) return next();
				const dir = match[1];
				if (!DIRECTORIES.includes(dir as (typeof DIRECTORIES)[number])) return next();
				const rest = decodeURIComponent(url.slice(`/assets/pdfjs/${dir}/`.length));
				const dirRoot = resolve(pdfjsRoot, dir);
				// Resolve under the directory, then re-check: the URL
				// is attacker-controllable and must not escape it.
				const file = resolve(dirRoot, rest);
				if (file !== dirRoot && !file.startsWith(`${dirRoot}/`)) return next();
				if (!existsSync(file)) return next();
				res.setHeader(
					'Content-Type',
					rest.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
				);
				res.end(readFileSync(file));
			});
		},
		closeBundle() {
			return copyInto(resolve(import.meta.dirname, 'dist'));
		},
	};
}

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
	plugins: [react(), pdfjsSupportTables()],
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
