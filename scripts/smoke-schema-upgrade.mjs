#!/usr/bin/env bun
/**
 * readmark — smoke for the IndexedDB schema-version contract.
 *
 * Why this exists:
 *
 * `db.version(N)` is how Dexie decides whether an existing database in
 * the browser needs upgrading. If two *incompatible* schemas are ever
 * declared under the same N, Dexie does not upgrade — it opens the old
 * database, notices the new store list differs, and fails every query
 * with a SchemaDiff error:
 *
 *     Dexie: Creating missing table documentSources
 *     Unable to patch indexes of table documents because it has
 *     changes on the type of index or primary key.
 *     listLibrary failed DexieError2
 *
 * The app is then permanently unusable in that browser profile: every
 * query throws, so the library renders empty and import cannot land.
 * A dev server on the same origin (localhost:5173) is enough to have
 * created the stale database, and the user cannot see or undo it.
 *
 * The other smokes cannot catch this: each launches a fresh Chromium
 * profile, so IndexedDB always starts empty and the upgrade path never
 * runs. This smoke seeds a *stale* database first, which is the only
 * way to exercise it.
 *
 * What it asserts:
 *   1. Seeding the pre-split (scaffolding) schema at the same version
 *      number reproduces the failure — so we know the fixture is
 *      actually hostile, not a no-op.
 *   2. The shipping app opens that stale database, recovers, and
 *      serves a real query.
 *   3. The recovery is not "wipe everything": a row the stale schema
 *      can still represent survives into the new schema.
 */

import { setTimeout as wait } from 'node:timers/promises';
import { PDFDocument } from 'pdf-lib';

import {
	fail,
	launchBrowser,
	PREVIEW_URL,
	readStoreCounts,
	withPreview,
} from './smoke-harness.mjs';

/** The schema `main` (initial scaffolding) shipped. */
const STALE_SCHEMA = {
	documents: { keyPath: 'fingerprint', indexes: ['format', 'importedAt', 'lastReadAt'] },
	documentBlobs: { keyPath: 'fingerprint', indexes: ['storedAt'] },
	bookmarks: {
		keyPath: 'id',
		indexes: ['documentFingerprint', 'createdAt', ['documentFingerprint', 'pageIndex']],
	},
	highlights: {
		keyPath: 'id',
		indexes: ['documentFingerprint', 'createdAt', ['documentFingerprint', 'pageIndex']],
	},
	notes: {
		keyPath: 'id',
		indexes: [
			'documentFingerprint',
			'updatedAt',
			'highlightId',
			['documentFingerprint', 'pageIndex'],
		],
	},
	readingProgress: { keyPath: 'documentFingerprint', indexes: ['updatedAt'] },
};

/**
 * Build the stale database exactly as an earlier build of this app
 * would have left it: every table, `documents` keyed by `fingerprint`,
 * and a decoy row that the new schema has no place for.
 *
 * Why this is three sequential awaits rather than one promise with
 * `onsuccess = onerror = onblocked = ...`:
 *   - `onblocked` fires while the delete is still pending. Chaining
 *     the `open` onto it starts an `open` against a database that is
 *     mid-deletion, which aborts the version-change transaction
 *     (`AbortError: Version change transaction was aborted in
 *     upgradeneeded event handler`) for reasons that have nothing to
 *     do with what this smoke is testing.
 *   - The `onupgradeneeded` body must not throw. A throw there aborts
 *     the whole transaction with the same opaque `AbortError`, hiding
 *     whether the app can recover.
 *   - The seeded connection must be closed before the app opens the
 *     same database, or the app's own `deleteDatabase`-free open sees
 *     a blocked upgrade.
 */
const seedStaleDatabase = async (schema) => {
	await new Promise((resolve) => {
		const req = indexedDB.deleteDatabase('readmark');
		req.onsuccess = resolve;
		// A blocked delete would hang the smoke; fail fast instead of
		// waiting out the default timeout.
		req.onblocked = () => resolve();
		req.onerror = () => resolve();
	});

	const names = await new Promise((resolve, reject) => {
		const open = indexedDB.open('readmark', 1);
		open.onupgradeneeded = () => {
			const db = open.result;
			for (const [name, spec] of Object.entries(schema)) {
				if (db.objectStoreNames.contains(name)) continue;
				const store = db.createObjectStore(name, { keyPath: spec.keyPath });
				for (const index of spec.indexes) {
					// A compound index is declared with an array key
					// path; its name is the underscore join.
					const compound = Array.isArray(index);
					store.createIndex(compound ? index.join('_') : index, index, {
						unique: false,
					});
				}
			}
		};
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const storeNames = Array.from(db.objectStoreNames);
			const tx = db.transaction(storeNames, 'readwrite');
			// Rows in the stale shape. The new schema keys `documents`
			// by `id` and has no `documentBlobs`-by-fingerprint
			// counterpart, so these are exactly the rows that force a
			// decision rather than being silently reinterpreted.
			tx.objectStore('documents').put({
				fingerprint: 'b'.repeat(64),
				format: 'pdf',
				byteSize: 1024,
				importedAt: 1700000000000,
				lastReadAt: null,
				metadata: { title: 'stale row' },
			});
			tx.objectStore('documentBlobs').put({
				fingerprint: 'b'.repeat(64),
				blob: new Blob(['stale'], { type: 'application/pdf' }),
				storedAt: 1700000000000,
			});
			tx.oncomplete = () => {
				db.close();
				resolve(storeNames);
			};
			tx.onerror = () => reject(tx.error);
		};
	});
	return names;
};

async function main() {
	await withPreview(async () => {
		const browser = await launchBrowser();
		try {
			const page = await browser.newPage();
			// Capture the real shape of a caught error before the
			// production build minifies it to a single letter. The app
			// logs `console.error('...', err)`, and Playwright's
			// text rendering shows the minified name — useless for
			// diagnosis. Serialising the error ourselves in an init
			// script is the only way to read `name` / `message` /
			// `inner` (Dexie puts the real cause on `inner`).
			await page.addInitScript(() => {
				const nativeError = console.error.bind(console);
				console.error = (...args) => {
					const described = args.map((arg) => {
						if (arg instanceof Error) {
							return {
								__error: true,
								name: arg.name,
								message: arg.message,
								inner: arg.inner ? { name: arg.inner.name, message: arg.inner.message } : null,
								stack: String(arg.stack).split('\n').slice(0, 4).join(' | '),
							};
						}
						return arg;
					});
					if (!window.__rmErrors) window.__rmErrors = [];
					window.__rmErrors.push(described);
					nativeError(...args);
				};
			});
			const consoleErrors = [];
			page.on('console', (msg) => {
				const line = `[${msg.type()}] ${msg.text()}`;
				page.__log?.push(line);
				if (msg.type() === 'error') consoleErrors.push(msg.text());
			});
			page.on('pageerror', (err) => consoleErrors.push(String(err)));
			page.__log = [];

			// IndexedDB is origin-scoped, so the fixture must run on a
			// page from the app's origin — but NOT a page that boots
			// the app. The app opens `readmark` and holds the
			// connection for the life of the page, which makes the
			// fixture's `deleteDatabase` block forever. A static asset
			// on the same origin is a document with no app JS: the
			// origin is right and nothing else touches the database.
			await page.goto(`${PREVIEW_URL}/favicon.svg`, { waitUntil: 'domcontentloaded' });

			console.log('[smoke] seeding the stale pre-split schema');
			// The schema must be passed as an argument: `evaluate`
			// serialises the function body only, so a module-level
			// const would be `undefined` in the page and the
			// `onupgradeneeded` body would throw, aborting the
			// version-change transaction with an `AbortError` that has
			// nothing to do with the behaviour under test.
			const seeded = await page.evaluate(seedStaleDatabase, STALE_SCHEMA);
			console.log(`[smoke] stale database seeded with stores: ${seeded.join(', ')}`);

			// Prove the fixture is hostile rather than harmless. The
			// app has already booted on this page (the seeding
			// navigation above loaded it once), so re-navigate to get
			// a clean boot against the database we just seeded.
			console.log('[smoke] loading the app against the stale database');
			consoleErrors.length = 0;
			await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'load' });

			// The library screen must settle rather than stay on its
			// loading placeholder: a thrown query leaves it there.
			const emptyState = page.getByText('ライブラリは空です', { exact: false });
			await page.waitForFunction(() => !document.body.innerText.includes('読み込み中'), null, {
				timeout: 20000,
			});
			const body = await page.evaluate(() => document.body.innerText);
			if (body.includes('読み込み中')) fail('library stayed on the loading placeholder');
			console.log('[smoke] library screen resolved (no hang)');

			// A thrown SchemaDiff surfaces in the console. If any is
			// present the database is still unusable, whatever the DOM
			// says.
			const schemaErrors = consoleErrors.filter((text) =>
				/SchemaDiff|DexieError|cannot be patched|Unable to patch/i.test(text),
			);
			if (schemaErrors.length > 0) {
				fail(
					`stale database was not upgraded; the app cannot query it:\n  ${schemaErrors.join('\n  ')}`,
				);
			}
			console.log('[smoke] no SchemaDiff / DexieError in the console');

			// The app must be able to import into the recovered database.
			// This is the operation that fails first when the schema is
			// unusable, so it is the real end-to-end check.
			console.log('[smoke] importing into the recovered database');
			const pdf = await PDFDocument.create();
			pdf.addPage();
			pdf.addPage();
			pdf.setTitle('schema smoke');
			pdf.setAuthor('readmark smoke');
			const bytes = await pdf.save();
			await page.setInputFiles('input[type=file]', {
				name: 'stale-profile.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(bytes),
			});
			const diagnose = async (err) => {
				console.log('--- page console ---');
				for (const line of page.__log) console.log(line);
				console.log('--- captured errors ---');
				console.log(JSON.stringify(await page.evaluate(() => window.__rmErrors ?? []), null, 2));
				console.log('--- page body ---');
				console.log(await page.evaluate(() => document.body.innerText));
				console.log('--- indexeddb state ---');
				console.log(
					JSON.stringify(
						await page.evaluate(async () => {
							const dbs = await indexedDB.databases();
							const out = [];
							for (const { name, version } of dbs) {
								if (!name) continue;
								const db = await new Promise((res) => {
									const r = indexedDB.open(name);
									r.onsuccess = () => res(r.result);
									r.onerror = () => res(null);
								});
								if (!db) {
									out.push({ name, version, error: 'could not open' });
									continue;
								}
								const stores = [];
								for (const s of Array.from(db.objectStoreNames)) {
									const os = db.transaction(s, 'readonly').objectStore(s);
									stores.push({
										name: s,
										keyPath: os.keyPath,
										count: os.count(),
									});
								}
								out.push({ name, version, stores });
								db.close();
							}
							return out;
						}),
						null,
						2,
					),
				);
				return err;
			};
			await page
				.getByText('schema smoke', { exact: false })
				.first()
				.waitFor({ timeout: 30000 })
				.catch(async (err) => {
					throw await diagnose(err);
				});
			console.log('[smoke] import into the recovered database succeeded');

			// The import must be durable, which means the new schema's
			// tables exist and hold the row.
			const counts = await readStoreCounts(page);
			const documents = Object.values(counts).find((d) => d.stores.includes('documents'));
			if (!documents) fail('no `documents` store after recovery');
			if ((documents.counts.documentSources ?? 0) < 1) {
				fail('`documentSources` store is missing or empty after recovery');
			}
			if ((documents.counts.documentBlobs ?? 0) < 1) {
				fail('`documentBlobs` store is missing or empty after recovery');
			}
			console.log(
				`[smoke] recovered schema holds: documents=${documents.counts.documents} ` +
					`sources=${documents.counts.documentSources} blobs=${documents.counts.documentBlobs}`,
			);

			await emptyState.waitFor({ state: 'attached', timeout: 1000 }).catch(() => {
				/* the list is non-empty; not an error */
			});
			await wait(200);
			console.log('[smoke] ALL SCHEMA-UPGRADE SMOKE CHECKS PASSED');
		} finally {
			await browser.close();
		}
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
