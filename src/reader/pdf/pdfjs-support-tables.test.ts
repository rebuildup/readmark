/**
 * Locks the dev-server half of the pdf.js support-tables plugin.
 *
 * ## Why this file exists
 *
 * `pdfjsSupportTables` in `vite.config.ts` registers a dev middleware that
 * serves `cmaps` / `standard_fonts` / `wasm` / `iccs` from inside the
 * installed `pdfjs-dist`, at the same paths the URLs in `pdf-worker.ts`
 * resolve to. It is the only place the directory-escape guard exists, and
 * nothing exercised it: the middleware ran only under `bun run dev`, and the
 * tests that do run never built a request against it.
 *
 * That matters because the guard is security-relevant. `req.url` is
 * attacker-controllable and `DIRECTORIES` only pins the *first* path segment,
 * so everything after it can still climb out with `..`.
 *
 * ## What these tests do and do not prove
 *
 * Mostly they are regression cover. The containment check was rewritten in
 * this change, and the traversal cases pin the rewritten behaviour so a later
 * simplification cannot quietly widen it.
 *
 * Two things are worth stating precisely, because they were measured rather
 * than assumed:
 *
 *   - **The Windows 404 cannot be reproduced here.** `node:path` resolves to
 *     the POSIX implementation under Linux and CI is Linux-only, so the old
 *     literal-`/` prefix check and the new `relative()` check agree on every
 *     machine this runs on. Every traversal test below is green against both.
 *     The bug being fixed is real — `resolve()` returns `\` on Windows, so a
 *     prefix built from a literal `/` matches nothing and every legitimate
 *     request falls through to the 404 — but proving it needs a Windows
 *     runner or a human on a Windows machine.
 *
 *   - **One test here is load-bearing.** Asking for the directory itself
 *     (`/assets/pdfjs/cmaps/`) used to pass the guard, because the old check
 *     explicitly exempted `file === dirRoot`, and then reach
 *     `readFileSync` on a directory, which throws `EISDIR`. It is the only
 *     assertion in this file that fails against the previous implementation.
 *
 * The backslash-climb case is also weaker than it looks: on POSIX a backslash
 * is an ordinary character in a filename, so `..\package.json` is a single
 * nonexistent name there and the request is refused by `existsSync` rather
 * than by the guard. It is listed because it is exactly the shape a Windows
 * dev server has to refuse.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { pdfjsSupportTables } from '../../../vite.config';

/** The subset of connect's middleware the plugin registers. */
type Middleware = (req: { url?: string }, res: FakeResponse, next: () => void) => void;

interface FakeResponse {
	readonly headers: Record<string, string>;
	// Spelled `| undefined` rather than `body?: Buffer`: the middleware
	// calls `end()` with no argument when it falls through, and the app
	// tsconfig's `exactOptionalPropertyTypes` will not let that assign to
	// an optional property.
	body: Buffer | undefined;
	setHeader(name: string, value: string): void;
	end(body?: Buffer): void;
}

function createResponse(): FakeResponse {
	return {
		headers: {},
		body: undefined,
		setHeader(name, value) {
			this.headers[name] = value;
		},
		end(body) {
			this.body = body;
		},
	};
}

/** One request through the middleware: what it served, or whether it passed. */
interface Attempt {
	readonly nexted: boolean;
	readonly response: FakeResponse;
}

/** Pull the handler out of the plugin without starting a dev server. */
function installMiddleware(): Middleware {
	const plugin = pdfjsSupportTables();
	// `configureServer` is a Vite `ObjectHook`, so the direct call is not
	// typed; the shape used here is the one the plugin itself writes to.
	const configureServer = plugin.configureServer as unknown as (server: {
		middlewares: { use: (middleware: Middleware) => void };
	}) => void;

	let captured: Middleware | undefined;
	configureServer({
		middlewares: {
			use: (middleware) => {
				captured = middleware;
			},
		},
	});
	if (!captured) {
		throw new Error('pdfjsSupportTables did not register a dev middleware');
	}
	return captured;
}

const pdfjsRoot = resolve(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'), '..');

/** A CMap that is actually shipped, so the serving test reads real bytes. */
const CMAP = 'cmaps/78-EUC-H.bcmap';

let middleware: Middleware;

beforeAll(() => {
	middleware = installMiddleware();
});

function request(url: string): Attempt {
	const response = createResponse();
	let nexted = false;
	middleware({ url }, response, () => {
		nexted = true;
	});
	return { nexted, response };
}

describe('the pdf.js support-table dev middleware / serving', () => {
	it('serves a shipped CMap with its bytes intact', () => {
		// A CMap is the table a Japanese PDF needs and never imports, so
		// this request 404ing is the glyphs-not-painting bug in its purest
		// form: no exception, correct text extraction, blank page.
		const { nexted, response } = request(`/assets/pdfjs/${CMAP}`);

		expect(nexted).toBe(false);
		expect(response.body?.equals(readFileSync(resolve(pdfjsRoot, CMAP)))).toBe(true);
	});

	it('types a .wasm table so the browser will instantiate it', () => {
		// `fetch`ing a buffer as octet-stream and handing it to
		// `WebAssembly.instantiate` fails; the MIME type is load-bearing,
		// not decoration.
		const { response } = request('/assets/pdfjs/wasm/qcms_bg.wasm');

		expect(response.headers['Content-Type']).toBe('application/wasm');
	});

	it('types a CMap as opaque bytes', () => {
		const { response } = request(`/assets/pdfjs/${CMAP}`);

		expect(response.headers['Content-Type']).toBe('application/octet-stream');
	});

	it('passes a missing file on rather than answering with an error', () => {
		// Falling through leaves the dev server to 404 it, which is what
		// every other unknown path in the app does.
		const { nexted, response } = request('/assets/pdfjs/cmaps/not-a-real-cmap.bcmap');

		expect(nexted).toBe(true);
		expect(response.body).toBeUndefined();
	});

	it('passes the directory itself on', () => {
		// The load-bearing one. The old guard exempted `file === dirRoot`
		// explicitly, so this request sailed through it and died in
		// `readFileSync` with `EISDIR` — a thrown error inside a dev
		// middleware, rather than a 404.
		const { nexted } = request('/assets/pdfjs/cmaps/');

		expect(nexted).toBe(true);
	});
});

describe('the pdf.js support-table dev middleware / containment', () => {
	// Each of these points at a file that genuinely exists, so a guard that
	// let one through would read and return real bytes rather than 404 by
	// accident. `pdfjs-dist/package.json` sits one level above each
	// directory, which makes it the nearest thing worth stealing.
	const escapes: readonly [name: string, url: string][] = [
		['a parent segment', '/assets/pdfjs/cmaps/../package.json'],
		['an encoded parent segment', '/assets/pdfjs/cmaps/%2e%2e%2fpackage.json'],
		['a grandparent climb', '/assets/pdfjs/cmaps/sub/../../../package.json'],
		['a backslash climb', '/assets/pdfjs/cmaps/..\\package.json'],
		['an absolute path', '/assets/pdfjs/cmaps//etc/passwd'],
	];

	for (const [name, url] of escapes) {
		it(`refuses ${name}`, () => {
			const { nexted, response } = request(url);

			expect(nexted).toBe(true);
			expect(response.body).toBeUndefined();
		});
	}

	it('refuses a directory it does not ship', () => {
		// The allow-list is the outer wall; the path check is the inner one.
		// Both have to hold, and neither is allowed to stand in for the other.
		const { nexted, response } = request('/assets/pdfjs/src/package.json');

		expect(nexted).toBe(true);
		expect(response.body).toBeUndefined();
	});

	it('ignores a URL outside the asset namespace entirely', () => {
		const { nexted } = request('/src/main.tsx');

		expect(nexted).toBe(true);
	});
});
