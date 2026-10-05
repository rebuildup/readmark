#!/usr/bin/env bun
/**
 * readmark — one-shot browser smoke for the #3 import REJECTION path.
 *
 * NOT a permanent E2E harness. Run once with:
 *
 *   bun scripts/smoke-import-reject.mjs
 *
 * Complements `smoke-import.mjs`, which only drives the success path.
 * Nothing in the committed suite drove what happens when the user
 * hands the picker a file that is not a usable PDF — the one place
 * where the import flow can tell the user something false.
 *
 * Verifies (against `bun run preview`, headless Chromium):
 *   1. A PNG is reported as an unsupported FORMAT, and the message
 *      is not the corrupt-PDF one. Before the header sniff both
 *      cases collapsed into `invalid-pdf`, so the app told a user
 *      who picked a photo that their PDF was "corrupt or
 *      password-protected".
 *   2. That same rejection opens NO pdf.js worker. This is the
 *      observable difference between sniffing in our code and
 *      letting pdf.js fail: the request counter stays at 0.
 *   3. A file that DOES start with `%PDF-` and then stops halfway
 *      still gets the corrupt-PDF message, and the two messages
 *      are genuinely different strings — the distinction is the
 *      point, so a future refactor that merges them fails here.
 *   4. No rejected import writes a row. `documents`,
 *      `documentSources` and `documentBlobs` must all still be
 *      empty after three failed imports.
 *
 * Exits non-zero on the first failed assertion. The preview server,
 * browser launch and failure signalling come from the shared
 * `smoke-harness.mjs`.
 */

import { setTimeout as wait } from 'node:timers/promises';

import { fail, launchBrowser, PREVIEW_URL, withPreview } from './smoke-harness.mjs';

const log = (msg) => console.log(`[smoke-reject] ${msg}`);

/** A real PNG signature followed by filler. No part of it is
 *  `%PDF-`, so it stands in for "the user picked a photo". */
function pngBytes() {
	const bytes = new Uint8Array(64);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	for (let i = 8; i < bytes.length; i += 1) bytes[i] = (i * 37) & 0xff;
	return bytes;
}

/** Claims to be a PDF, then stops halfway through the body. */
const CORRUPT_PDF = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog';

await withPreview(async () => {
	const browser = await launchBrowser();
	const page = await browser.newPage();
	await page.goto(PREVIEW_URL, { waitUntil: 'load' });
	await page.waitForSelector('[data-testid="rm-import-button"]');

	// The hidden <input type="file"> carries the testid. `.last()`
	// because the library screen and the reader can both be mounted
	// by the router; we want the one on screen.
	const fileInput = page.locator('[data-testid="rm-document-import-input"]').last();
	const alert = page.locator('[role="alert"]');

	// 1. A non-PDF is an unsupported format, not a broken PDF.
	await fileInput.setInputFiles({
		name: 'holiday-photo.png',
		mimeType: 'image/png',
		buffer: Buffer.from(pngBytes()),
	});
	await alert.waitFor({ timeout: 15_000 });
	const formatMessage = (await alert.textContent())?.trim() ?? '';
	log(`non-PDF alert = ${JSON.stringify(formatMessage)}`);
	if (!formatMessage.includes('サポートされていません')) {
		fail(`expected the unsupported-format message, got: ${formatMessage}`);
	}
	if (formatMessage.includes('破損')) {
		fail(`a non-PDF must not be reported as a corrupt PDF: ${formatMessage}`);
	}

	// 2. Rejecting a non-PDF must not open a pdf.js worker. The
	// listener is attached only now, so a worker fetched by the
	// page's own boot does not count against it.
	let workerRequests = 0;
	page.on('request', (request) => {
		if (request.url().includes('pdf.worker')) workerRequests += 1;
	});
	await fileInput.setInputFiles({
		name: 'another-photo.png',
		mimeType: 'image/png',
		buffer: Buffer.from(pngBytes()),
	});
	// Long enough for a worker fetch to have been issued and
	// observed; the rejection itself resolves in single-digit ms.
	await wait(1500);
	log(`worker requests while rejecting a non-PDF = ${workerRequests}`);
	if (workerRequests !== 0) {
		fail(`a non-PDF must not open a pdf.js worker, saw ${workerRequests} request(s)`);
	}

	// 3. A corrupt PDF still gets the corrupt-PDF message, and the
	//    two strings are different.
	await fileInput.setInputFiles({
		name: 'broken.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from(CORRUPT_PDF, 'latin1'),
	});
	await alert.waitFor({ timeout: 15_000 });
	const invalidMessage = (await alert.textContent())?.trim() ?? '';
	log(`corrupt-PDF alert = ${JSON.stringify(invalidMessage)}`);
	if (!invalidMessage.includes('破損')) {
		fail(`expected the invalid-pdf message, got: ${invalidMessage}`);
	}
	if (invalidMessage === formatMessage) {
		fail('the unsupported-format and invalid-pdf messages must differ');
	}

	// 4. Three failed imports, zero rows. A partially-written import
	//    would be worse than a rejected one: an orphan Document with
	//    no source, or a blob row the library cannot resolve.
	const counts = await page.evaluate(async () => {
		const open = indexedDB.open('readmark');
		const db = await new Promise((resolve, reject) => {
			open.onsuccess = () => resolve(open.result);
			open.onerror = () => reject(open.error);
		});
		const out = {};
		for (const store of ['documents', 'documentSources', 'documentBlobs']) {
			out[store] = await new Promise((resolve, reject) => {
				const request = db.transaction(store, 'readonly').objectStore(store).count();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		}
		db.close();
		return out;
	});
	log(`store counts after 3 failed imports = ${JSON.stringify(counts)}`);
	if (counts.documents !== 0 || counts.documentSources !== 0 || counts.documentBlobs !== 0) {
		fail(`a rejected import must not write any row: ${JSON.stringify(counts)}`);
	}

	await browser.close();
	log('ALL REJECTION-PATH CHECKS PASSED');
});
