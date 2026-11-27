/**
 * Integration test: the dev server's middleware *stack*, not just the
 * handler.
 *
 * ## Why a real server
 *
 * The unit suite in `pdfjs-support-tables.test.ts` pulls the handler
 * out of the plugin and calls it directly, which bypasses the order
 * the middleware is registered in. Serving under the base depends on
 * this plugin running *before* Vite's `baseMiddleware`: if a Vite
 * upgrade flips that order, `baseMiddleware` strips the prefix first,
 * the handler then sees a root-prefixed URL while a base is
 * configured, refuses it, and every support table 404s — no
 * exception, no failing unit test, glyphs that never paint. CI does
 * not run the smokes, so this is the only place that ordering is
 * fixed.
 *
 * ## What it pins
 *
 *   - `<base>assets/pdfjs/<shipped CMap>` → 200, byte-identical to
 *     the file in `pdfjs-dist`. Byte-identity matters: a server that
 *     answers 200 with the SPA fallback page satisfies a status-only
 *     check and breaks exactly the thing this guards.
 *   - `/assets/pdfjs/<shipped CMap>` → 404. Outside the configured
 *     base nothing is served; the app builds every table URL from
 *     `BASE_URL`, so a root-prefixed request cannot come from it.
 *
 * Port 0 means the OS picks a free port, so the test cannot collide
 * with a dev server someone already has running. `server.close()` in
 * `afterAll` stops the watcher and the dep optimizer either way.
 */

import { readFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APP_BASE } from '../../../app-base';

const pdfjsRoot = resolve(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'), '..');

/** A CMap that is actually shipped, so the probe reads real bytes. */
const CMAP = 'cmaps/78-EUC-H.bcmap';

/** Startup and first request include config load and dep pre-bundling. */
const TIMEOUT_MS = 60_000;

let server: ViteDevServer | undefined;
let origin = '';

/**
 * Plain `node:http`, not `fetch`: the test runs in the happy-dom
 * environment, whose `fetch` is not the one a browser would use.
 */
function request(path: string): Promise<{ status: number; body: Buffer }> {
	// `Promise.withResolvers` would be tidier, but `tsconfig.app.json`
	// pins `lib: ES2023`, which does not declare it (TS2550). Raising
	// the app-wide lib for one test helper is not this ticket's call.
	return new Promise((resolvePromise, reject) => {
		const call = httpGet(`${origin}${path}`, (response) => {
			const chunks: Buffer[] = [];
			response.on('data', (chunk: Buffer) => chunks.push(chunk));
			response.on('end', () =>
				resolvePromise({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) }),
			);
		});
		call.on('error', reject);
	});
}

beforeAll(async () => {
	server = await createServer({
		logLevel: 'silent',
		// The real config, unmodified: `configResolved` has to capture the
		// base from it for this test to mean anything.
		server: { host: '127.0.0.1', port: 0 },
	});
	await server.listen();
	const address = server.httpServer?.address();
	if (address === null || address === undefined || typeof address === 'string') {
		throw new Error('the dev server did not bind a TCP port');
	}
	origin = `http://127.0.0.1:${address.port}`;
}, TIMEOUT_MS);

afterAll(async () => {
	await server?.close();
});

describe('the pdf.js support-table dev server / middleware order', () => {
	it(
		'serves a shipped CMap under the configured base',
		async () => {
			const response = await request(`${APP_BASE}assets/pdfjs/${CMAP}`);

			expect(response.status).toBe(200);
			expect(response.body.equals(readFileSync(resolve(pdfjsRoot, CMAP)))).toBe(true);
		},
		TIMEOUT_MS,
	);

	it(
		'refuses the same CMap outside the configured base',
		async () => {
			const response = await request(`/assets/pdfjs/${CMAP}`);

			expect(response.status).toBe(404);
			expect(response.body.equals(readFileSync(resolve(pdfjsRoot, CMAP)))).toBe(false);
		},
		TIMEOUT_MS,
	);
});
