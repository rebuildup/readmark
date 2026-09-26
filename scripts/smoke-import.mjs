#!/usr/bin/env bun
/**
 * readmark — one-shot browser smoke for the #3 import flow.
 *
 * NOT a permanent E2E harness. Run once with:
 *
 *   bun scripts/smoke-import.mjs
 *
 * Verifies (against `bun run preview`):
 *   1. `pdf.worker.min-*.mjs` is fetched and instantiated as a
 *      Worker (not a fake-worker fallback).
 *   2. No "fake worker" / "please use the legacy build"
 *      warning in the console.
 *   3. A real PDF, dropped through the UI's file input, lands
 *      in IndexedDB (`documents`, `documentSources`,
 *      `documentBlobs`) and shows in the library list.
 *   4. Re-importing the same PDF does NOT add a duplicate
 *      row (fingerprint dedup).
 *
 * Exits non-zero on the first failed assertion. Output is a
 * line-by-line trace of what was checked. Designed to be run
 * manually before marking PR #24 Ready for review.
 */

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';

// Some sandboxed environments ship NSS / NSPR outside the
// default loader path. If `chrome-libs` is present in $HOME,
// prepend it so the headless shell can resolve its libs.
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

const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

/** Generate a 2-page PDF in memory for the import test. */
async function makeTestPdfBytes() {
	const pdf = await PDFDocument.create();
	pdf.addPage();
	pdf.addPage();
	pdf.setTitle('Smoke import test');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
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

async function withPreview(fn) {
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
		// `SmokeFailure` instead of calling `process.exit`, so this
		// finally runs even on the early-exit branches above.
		killPreview(proc);
	}
}

const log = (msg) => console.log(`[smoke] ${msg}`);

/**
 * Wait for the import button to round-trip through a busy=true →
 * busy=false transition.
 *
 * Why this is two waits in one (observing the transition), not
 * "wait for aria-busy !== 'true'":
 *   - After `setInputFiles`, there is a window before React commits
 *     `setBusy(true)`. A locator check that runs in that window
 *     sees `false` and resolves immediately — we'd never observe
 *     that the import actually started, only that it ended.
 *   - True→false proves the handler both ran and returned. If the
 *     `setInputFiles` event never reaches the change handler
 *     (eg. the input is removed), busy never flips to true and
 *     the first sub-wait times out → `fail()`.
 *
 * Why use `window.__rmSawBusy` instead of a no-op `expect.toHave*`:
 *   - Playwright's `expect()` lives in `@playwright/test`, which
 *     this script does not import (vanilla Playwright + Bun). We
 *     reach for `waitForFunction` and stitch the two halves via
 *     a closure-scoped flag.
 */
async function waitForBusyRoundTrip(page, label) {
	const SENTINEL = '__rmSawBusy__' + Math.random().toString(36).slice(2);
	// Inject the sentinel on first observation.
	await page.evaluate((key) => {
		if (!(key in window)) {
			Object.defineProperty(window, key, { value: false, writable: true, configurable: true });
		}
	}, SENTINEL);
	// Phase 1: wait for aria-busy="true". `polling: 30` (instead of
	// the default 'raf') so we sample the DOM at ≤30ms cadence and
	// catch the busy=true window on sub-frame imports. Without
	// `await Promise.resolve()` between setBusy(true) and the
	// downstream await, React 19's automatic batching collapses
	// both states into one render and this wait would never resolve.
	await page.waitForFunction(
		(key) => {
			const busy = document
				.querySelector('[data-testid="rm-import-button"]')
				?.getAttribute('aria-busy');
			if (busy === 'true') {
				window[key] = true;
				return true;
			}
			return false;
		},
		SENTINEL,
		{ timeout: 15_000, polling: 30 },
	);
	// Phase 2: wait for the busy→idle transition (and only that,
	// not the initial idle state — guarded by the sentinel).
	await page.waitForFunction(
		(key) => {
			const busy = document
				.querySelector('[data-testid="rm-import-button"]')
				?.getAttribute('aria-busy');
			if (!window[key]) return false;
			return busy !== 'true';
		},
		SENTINEL,
		{ timeout: 15_000, polling: 30 },
	);
	// Reset so subsequent round-trips start clean.
	await page.evaluate((key) => {
		window[key] = false;
	}, SENTINEL);
	log(`${label} round-tripped (import button busy=true → busy=false)`);
}

/**
 * Read a Playwright locator's count until it stabilizes across
 * three consecutive reads (200 ms apart).
 *
 * Why a settle loop instead of a one-shot count read:
 *   - React + Dexie + IndexedDB form an async chain. A single
 *     read after `waitFor` can land mid-render or mid-write
 *     and report a stale count.
 *   - Three consecutive identical reads at 200 ms intervals is
 *     a cheap "no more writes pending" signal. If the value
 *     is still changing, we fail loudly (caught by `fail()`)
 *     rather than reporting a false-green.
 */
async function readStableCount(locator) {
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
 * Signal a failure WITHOUT calling `process.exit`. Exiting here
 * would skip `withPreview`'s `finally`, leaving the preview server
 * bound to 4173 — the next smoke run would then attach to the
 * stale build and report false-green. Throw instead; the top-level
 * `main().catch()` translates the throw into exit code 1, AFTER
 * the server is killed.
 */
class SmokeFailure extends Error {
	constructor(msg) {
		super(msg);
		this.name = 'SmokeFailure';
	}
}
const fail = (msg) => {
	console.error(`[smoke] FAIL: ${msg}`);
	throw new SmokeFailure(msg);
};

async function main() {
	await withPreview(async () => {
		log('preview server is up');

		const browser = await chromium.launch({
			args: ['--no-sandbox', '--disable-dev-shm-usage'],
			env: extraLd
				? { ...process.env, LD_LIBRARY_PATH: `${extraLd}:${process.env.LD_LIBRARY_PATH ?? ''}` }
				: undefined,
		});
		const context = await browser.newContext();
		const page = await context.newPage();

		// Capture every request so we can verify the worker URL
		// actually goes out.
		const workerRequests = [];
		const consoleErrors = [];
		const consoleWarns = [];
		page.on('request', (req) => {
			const url = req.url();
			if (/pdf\.worker(\.min)?-[^/]+\.mjs/.test(url)) {
				workerRequests.push({ url, resourceType: req.resourceType() });
			}
		});
		page.on('console', (msg) => {
			const text = msg.text();
			if (msg.type() === 'error') consoleErrors.push(text);
			if (msg.type() === 'warning' || msg.type() === 'warn') consoleWarns.push(text);
		});

		log('loading library page');
		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

		// --- Generate a real PDF in memory ---
		const pdfBytes = await makeTestPdfBytes();
		log(`generated test PDF: ${pdfBytes.byteLength} bytes`);

		// --- Trigger the import flow ---
		// The hidden <input type="file"> has data-testid="rm-document-import-input".
		const fileInput = page.locator('[data-testid="rm-document-import-input"]');
		await fileInput.setInputFiles({
			name: 'smoke.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(pdfBytes),
		});
		await waitForBusyRoundTrip(page, 'import #1');
		// The library list should now have exactly one entry. Use
		// the stable-read helper so we don't catch the count mid-write.
		const libraryItems = page.locator('main ul li');
		await libraryItems.first().waitFor({ state: 'visible', timeout: 5_000 });
		const firstCount = await readStableCount(libraryItems);
		if (firstCount !== 1) fail(`expected 1 library entry after first import, got ${firstCount}`);
		log(`library has ${firstCount} entry after first import`);

		// After import the worker asset MUST have been fetched.
		// pdf.js lazily creates the Worker the first time a PDF
		// is parsed; an empty `workerRequests` here means the
		// browser fell back to a fake-worker or our setup is
		// broken.
		if (workerRequests.length === 0) {
			fail('worker asset was never requested after import');
		}
		const workerFetch = workerRequests[0];
		log(`worker asset requested: ${workerFetch.url} (resourceType=${workerFetch.resourceType})`);
		if (workerFetch.resourceType !== 'script') {
			fail(`expected worker resourceType=script, got ${workerFetch.resourceType}`);
		}

		// --- Verify IndexedDB rows ---
		const dbStats = await page.evaluate(async () => {
			// Open the Dexie-managed database by name. The Dexie
			// default name is "readmark" (or whatever db.ts set).
			// We don't know the exact name from here, so list
			// databases via indexedDB.databases().
			const dbs = await indexedDB.databases();
			const result = {};
			for (const { name } of dbs) {
				if (!name) continue;
				result[name] = await new Promise((resolve, reject) => {
					const req = indexedDB.open(name);
					req.onsuccess = () => {
						const db = req.result;
						const stores = Array.from(db.objectStoreNames);
						const counts = {};
						let pending = stores.length;
						if (!pending) {
							db.close();
							resolve({ stores: [], counts });
							return;
						}
						for (const store of stores) {
							try {
								const tx = db.transaction(store, 'readonly');
								const cr = tx.objectStore(store).count();
								cr.onsuccess = () => {
									counts[store] = cr.result;
									if (--pending === 0) {
										db.close();
										resolve({ stores, counts });
									}
								};
								cr.onerror = () => {
									if (--pending === 0) {
										db.close();
										resolve({ stores, counts });
									}
								};
							} catch (err) {
								if (--pending === 0) {
									db.close();
									resolve({ stores, counts, err: String(err) });
								}
							}
						}
					};
					req.onerror = () => reject(req.error);
				});
			}
			return result;
		});
		log(`IndexedDB databases: ${JSON.stringify(dbStats)}`);

		const findStore = (obj, name) => {
			for (const k of Object.keys(obj)) {
				if (obj[k]?.stores?.includes(name)) return obj[k].counts[name];
			}
			return undefined;
		};
		const docs = findStore(dbStats, 'documents');
		const sources = findStore(dbStats, 'documentSources');
		const blobs = findStore(dbStats, 'documentBlobs');
		if (docs !== 1) fail(`expected 1 row in documents, got ${docs}`);
		if (sources !== 1) fail(`expected 1 row in documentSources, got ${sources}`);
		if (blobs !== 1) fail(`expected 1 row in documentBlobs, got ${blobs}`);
		log('documents=1 documentSources=1 documentBlobs=1');

		// --- Re-import the same PDF: should NOT add a row ---
		await fileInput.setInputFiles({
			name: 'smoke.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(pdfBytes),
		});
		await waitForBusyRoundTrip(page, 're-import');
		// Settle: poll until the library-item count is stable across
		// three consecutive reads (200 ms apart). If dedup works, we
		// stay at 1; if dedup were broken the count would briefly hit
		// 2 and settle. Either way, the value we read here is the
		// post-import truth.
		const stableCount = await readStableCount(libraryItems);
		if (stableCount !== 1) fail(`expected 1 library entry after re-import, got ${stableCount}`);
		log(`library still has ${stableCount} entry after re-import (fingerprint dedup works)`);

		const dbStats2 = await page.evaluate(async () => {
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
						if (!pending) {
							db.close();
							resolve({ stores, counts });
							return;
						}
						for (const store of stores) {
							const cr = db.transaction(store, 'readonly').objectStore(store).count();
							cr.onsuccess = () => {
								counts[store] = cr.result;
								if (--pending === 0) {
									db.close();
									resolve({ stores, counts });
								}
							};
						}
					};
				});
			}
			return result;
		});
		const docs2 = findStore(dbStats2, 'documents');
		const sources2 = findStore(dbStats2, 'documentSources');
		const blobs2 = findStore(dbStats2, 'documentBlobs');
		if (docs2 !== 1) fail(`expected documents count to stay 1 after re-import, got ${docs2}`);
		if (sources2 !== 1) fail(`expected documentSources count to stay 1, got ${sources2}`);
		if (blobs2 !== 1) fail(`expected documentBlobs count to stay 1, got ${blobs2}`);
		log('dedup confirmed at IndexedDB level');

		// --- Console diagnostics ---
		const fakeWorkerHits = [...consoleErrors, ...consoleWarns].filter((m) =>
			/fake worker|please use the .legacy. build|InvalidPDFException/i.test(m),
		);
		if (fakeWorkerHits.length > 0) {
			fail(`unexpected console diagnostics:\n${fakeWorkerHits.join('\n')}`);
		}
		log('no fake-worker / legacy-build warnings in console');

		// Sanity: total worker fetches should be ≥ 1 (imports may
		// spin up additional workers). We only need to prove the
		// worker asset was actually requested.
		if (workerRequests.length < 1) fail(`expected ≥1 worker fetches, got ${workerRequests.length}`);
		log(`total worker asset fetches: ${workerRequests.length}`);

		await browser.close();
		log('ALL SMOKE CHECKS PASSED');
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
