#!/usr/bin/env bun
/**
 * readmark — shared harness for the browser smokes.
 *
 * The smokes under `scripts/` drive the real built app in headless
 * Chromium. What they have in common is the part that is easy to get
 * subtly wrong, so it lives here once:
 *
 *   - Starting `bun run preview` and knowing when it is genuinely
 *     ready (a bound-port URL line, not a `fetch` 200 — with
 *     `--strictPort` the child exits on a port collision, so a
 *     successful fetch could belong to someone else's server).
 *   - Killing that child reliably, including the SIGTERM→SIGKILL
 *     escalation, without calling `process.exit` (which would skip
 *     the cleanup and leave a stale server bound to the port, making
 *     the next run report a false-green).
 *   - Reading a count that will not be read mid-render: three
 *     consecutive identical values.
 *   - Launching Chromium with the NSS/NSPR library path that
 *     sandboxed hosts need.
 *
 * `scripts/smoke-import.mjs` and `scripts/smoke-library.mjs` add
 * their own flow-specific waits on top.
 */

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';

export const PREVIEW_PORT = 4173;
export const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

/**
 * Some sandboxed environments ship NSS / NSPR outside the default
 * loader path. If `chrome-libs` is present in $HOME, prepend it so
 * the headless shell can resolve its libs.
 */
const CHROME_LIBS = `${process.env.HOME}/chrome-libs/usr/lib/x86_64-linux-gnu`;
const extraLd =
	(await Bun.file(CHROME_LIBS)
		.exists()
		.catch(() => false)) ||
	(await Bun.file(`${CHROME_LIBS}/libnspr4.so`)
		.exists()
		.catch(() => false))
		? CHROME_LIBS
		: '';

export async function launchBrowser() {
	return await chromium.launch({
		args: ['--no-sandbox', '--disable-dev-shm-usage'],
		env: extraLd
			? { ...process.env, LD_LIBRARY_PATH: `${extraLd}:${process.env.LD_LIBRARY_PATH ?? ''}` }
			: undefined,
	});
}

/**
 * Kill a child preview server reliably.
 *
 * Why we track `exited` via the 'exit' event instead of using
 * `proc.killed` / `proc.exitCode`:
 *   - `ChildProcess.killed` is set the moment `proc.kill()` *sends*
 *     a signal — not when the process actually terminates. After
 *     SIGTERM it's already `true`, so a `!proc.killed && exitCode
 *     === null` check would never enter the SIGKILL escalation
 *     branch. The Node docs are explicit on this.
 *   - We bind an 'exit' handler at spawn time and consult that flag
 *     here. That gives a true "is the child gone?" signal.
 *
 * Why both SIGTERM and SIGKILL:
 *   - SIGTERM lets Vite flush its build-cache writes and exit cleanly.
 *   - Some Vite processes hang on SIGTERM under load. After 1s we
 *     escalate to SIGKILL so the next smoke run can't connect to a
 *     half-dead server left listening on 4173 (which would make a
 *     following run hit a stale build and false-green).
 *
 * Why this is a separate function instead of inline `proc.kill`:
 *   - `withPreview`'s finally, `SmokeFailure` throws, and any
 *     uncaught rejection above all share the same cleanup path.
 */
function killPreview(proc) {
	if (proc.__rmExited) return;
	try {
		proc.kill('SIGTERM');
	} catch {
		/* already gone */
	}
	setTimeout(() => {
		if (!proc.__rmExited) {
			try {
				proc.kill('SIGKILL');
			} catch {
				/* race: reaped between the check and the kill */
			}
		}
	}, 1000).unref();
}

export async function withPreview(fn) {
	const proc = spawn('bun', ['run', 'preview'], {
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, NODE_ENV: 'production' },
	});
	// Track actual child termination via the 'exit' event. We CANNOT
	// use `proc.killed` for this — see the killPreview comment for
	// why — so we set markers on the object itself. `__rmStderr`
	// captures Vite's stderr so we can surface it in fail() messages.
	proc.__rmExited = false;
	proc.__rmExitedCode = null;
	proc.__rmStderr = '';
	let sawListenUrl = false;
	proc.stderr.on('data', (chunk) => {
		proc.__rmStderr += chunk.toString();
	});
	proc.stdout.on('data', (chunk) => {
		// Vite prints its bound URL exactly once, on successful bind:
		//   "  ➜  Local:   http://127.0.0.1:4173/"
		// Only our spawned child prints this line — a stale server
		// on 4173 cannot. Decoupling readiness from `fetch(...)`'s
		// 200 response closes the last false-green path: with
		// `--strictPort`, our child exits non-zero on port collision
		// before any listen URL is printed, so the ready predicate
		// never fires.
		const text = chunk.toString();
		if (/Local:\s*http:\/\/127\.0\.0\.1:4173/.test(text)) {
			sawListenUrl = true;
		}
	});
	proc.on('exit', (code) => {
		proc.__rmExited = true;
		proc.__rmExitedCode = code;
	});
	try {
		// Ready loop: declare "ready" only when our child has printed
		// its bound URL AND is still alive at the moment we declare.
		// Polling every 100ms catches either side: the URL line shows
		// up within ~1s on a healthy start, the exit event fires
		// within ~1s when `--strictPort` rejects a busy 4173.
		let ready = false;
		for (let i = 0; i < 100; i++) {
			if (proc.__rmExited) {
				fail(
					`preview server exited before ready ` +
						`(code=${proc.__rmExitedCode}); ` +
						`stderr:\n${proc.__rmStderr || '<empty>'}`,
				);
			}
			if (sawListenUrl) {
				ready = true;
				break;
			}
			await wait(100);
		}
		if (!ready) {
			if (proc.__rmExited) {
				fail(
					`preview server exited during ready loop ` +
						`(code=${proc.__rmExitedCode}); ` +
						`stderr:\n${proc.__rmStderr || '<empty>'}`,
				);
			}
			fail(
				`preview server did not print listen URL within 10s; ` +
					`stderr tail:\n${proc.__rmStderr.slice(-400) || '<empty>'}`,
			);
		}
		// Final guard for the brief race: URL printed, then the child
		// dies before we hand off to `fn()`. Cheap to check.
		if (proc.__rmExited) {
			fail(
				`preview server died immediately after printing listen URL ` +
					`(code=${proc.__rmExitedCode}); ` +
					`stderr:\n${proc.__rmStderr || '<empty>'}`,
			);
		}
		return await fn();
	} finally {
		// `finally` is the only reliable cleanup path. `fail()` throws
		// instead of calling `process.exit`, so this finally runs even
		// on the early-exit branches above.
		killPreview(proc);
	}
}

/**
 * Read a Playwright locator's count until it stabilizes across three
 * consecutive reads (200 ms apart).
 *
 * Why a settle loop instead of a one-shot count read:
 *   - React + Dexie + IndexedDB form an async chain. A single read
 *     after `waitFor` can land mid-render or mid-write and report a
 *     stale count.
 *   - Three consecutive identical reads at 200 ms intervals is a
 *     cheap "no more writes pending" signal. If the value is still
 *     changing, we fail loudly (caught by `fail()`) rather than
 *     reporting a false-green.
 */
export async function readStableCount(locator) {
	let last = -1;
	let stable = 0;
	for (let i = 0; i < 25; i++) {
		const current = await locator.count();
		if (current === last) {
			stable++;
			if (stable >= 3) return current;
		} else {
			stable = 0;
			last = current;
		}
		await wait(200);
	}
	fail(`count did not stabilize (last=${last}); possible UI churn`);
}

/**
 * Signal a failure WITHOUT calling `process.exit`. Exiting here would
 * skip `withPreview`'s `finally`, leaving the preview server bound to
 * 4173 — the next smoke run would then attach to the stale build and
 * report false-green. Throw instead; the top-level
 * `main().catch()` translates the throw into exit code 1, AFTER the
 * server is killed.
 */
export class SmokeFailure extends Error {
	constructor(msg) {
		super(msg);
		this.name = 'SmokeFailure';
	}
}

export const fail = (msg) => {
	console.error(`[smoke] FAIL: ${msg}`);
	throw new SmokeFailure(msg);
};

/**
 * Per-store row counts for every IndexedDB database on the page.
 *
 * The smokes assert on storage, not on the DOM: a row can disappear
 * from the list while still sitting in the store, and that is exactly
 * the bug a delete cascade can have. The page cannot know the Dexie
 * handle, so the stores are counted through `indexedDB.databases()`
 * by name.
 */
export async function readStoreCounts(page) {
	return await page.evaluate(async () => {
		const dbs = await indexedDB.databases();
		const result = {};
		for (const { name } of dbs) {
			if (!name) continue;
			result[name] = await new Promise((resolve) => {
				const req = indexedDB.open(name);
				req.onsuccess = () => {
					const db = req.result;
					const stores = Array.from(db.objectStoreNames);
					const counts = {};
					let pending = stores.length;
					const settle = () => {
						if (--pending === 0) {
							db.close();
							resolve({ stores, counts });
						}
					};
					for (const store of stores) {
						try {
							const cr = db.transaction(store, 'readonly').objectStore(store).count();
							cr.onsuccess = () => {
								counts[store] = cr.result;
								settle();
							};
							cr.onerror = settle;
						} catch {
							settle();
						}
					}
					if (!pending) {
						db.close();
						resolve({ stores, counts });
					}
				};
				req.onerror = () => resolve({ stores: [], counts: {} });
			});
		}
		return result;
	});
}

/** Look up one store's row count across all databases on the page. */
export function findStoreCount(dbStats, storeName) {
	for (const db of Object.values(dbStats)) {
		if (db?.stores?.includes(storeName)) return db.counts[storeName];
	}
	return undefined;
}
