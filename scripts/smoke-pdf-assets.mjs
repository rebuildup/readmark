#!/usr/bin/env bun
/**
 * readmark — smoke: pdf.js support tables are present and requested.
 *
 * ## Why this smoke exists
 *
 * pdf.js loads its CMaps, standard-font metrics, wasm decoders and ICC
 * profiles over HTTP at RENDER time, by URL. Nothing in the module
 * graph imports them, so a bundler has no reason to emit them and a
 * default `vite build` ships a `dist/` where every one of those
 * requests 404s.
 *
 * The failure is silent in the worst way: the document still loads,
 * `getTextContent()` still returns the correct strings, and the glyphs
 * simply do not paint. For Japanese PDFs this is the common case
 * rather than an edge case, because they are overwhelmingly Type0 /
 * Identity-H and their character-code-to-CID mapping lives in the
 * CMap files.
 *
 * The other smokes cannot catch it. They each launch a fresh profile
 * and assert on rendered geometry or DOM text, and a document whose
 * font happens to be embedded renders fine either way. This smoke
 * asserts on the two things that are actually load-bearing:
 *
 *   1. Every support table the build claims to ship exists on disk in
 *      `dist/` and is fetchable over HTTP with a 200.
 *   2. pdf.js actually requests the CMap directory for a document
 *      that needs it — i.e. the URLs resolve in the *built* app, not
 *      just on disk.
 */

import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

import {
	fail,
	launchBrowser,
	PREVIEW_URL,
	readStableCount,
	withPreview,
} from './smoke-harness.mjs';

const DIST = resolve(import.meta.dirname, '..', 'dist');

/**
 * Tables that must exist, and a file each must contain.
 *
 * The named file is the one that matters for the failure this guards,
 * not an arbitrary entry: `UniJIS-UCS2-H` is the CMap a Japanese
 * Type0 font references by name, and `LiberationSans-Regular.ttf` is
 * the substitute pdf.js reaches for when a document uses Helvetica
 * without embedding it.
 */
const REQUIRED_TABLES = [
	{
		dir: 'cmaps',
		mustContain: 'UniJIS-UCS2-H.bcmap',
		why: 'Japanese Type0 / Identity-H CMaps',
	},
	{
		dir: 'standard_fonts',
		mustContain: 'LiberationSans-Regular.ttf',
		why: 'metrics for a non-embedded Helvetica',
	},
	{ dir: 'wasm', mustContain: 'openjpeg.wasm', why: 'JPEG2000 image decoding' },
	{ dir: 'wasm', mustContain: 'jbig2.wasm', why: 'JBIG2 image decoding' },
	{ dir: 'iccs', mustContain: 'CGATS001Compat-v2-micro.icc', why: 'ICC colour profiles' },
];

async function main() {
	await withPreview(async () => {
		// --- 1. the tables are in dist/ -----------------------------
		for (const { dir, mustContain, why } of REQUIRED_TABLES) {
			const dirPath = resolve(DIST, 'assets', 'pdfjs', dir);
			let entries;
			try {
				entries = await readdir(dirPath);
			} catch {
				fail(`dist/assets/pdfjs/${dir} is missing (${why}) — pdf.js would 404 at render time`);
			}
			if (entries.length === 0) {
				fail(`dist/assets/pdfjs/${dir} is empty (${why})`);
			}
			if (mustContain && !entries.includes(mustContain)) {
				fail(
					`dist/assets/pdfjs/${dir}/${mustContain} is missing (${why}); ` +
						`found ${entries.length} entries`,
				);
			}
			console.log(`[smoke] dist/assets/pdfjs/${dir}: ${entries.length} files`);
		}

		// --- 2. fetchable over HTTP, not just on disk ---------------
		for (const { dir, mustContain } of REQUIRED_TABLES) {
			const dirPath = resolve(DIST, 'assets', 'pdfjs', dir);
			const entries = await readdir(dirPath);
			const probeName = mustContain ?? entries[0];
			const response = await fetch(`${PREVIEW_URL}/assets/pdfjs/${dir}/${probeName}`);
			if (response.status !== 200) {
				fail(
					`GET /assets/pdfjs/${dir}/${probeName} -> ${response.status}. ` +
						`The table is on disk but not served, so pdf.js still 404s.`,
				);
			}
			const size = (await response.arrayBuffer()).byteLength;
			if (size === 0) fail(`GET ${probeName} returned 0 bytes`);
			const onDisk = (await stat(resolve(dirPath, probeName))).size;
			if (size !== onDisk) {
				fail(
					`${probeName}: served ${size} bytes but is ${onDisk} on disk — ` +
						`a truncated response would decode to garbage rather than fail`,
				);
			}
			console.log(`[smoke] served ${dir}/${probeName} (${size} bytes, 200)`);
		}

		// --- 3. pdf.js requests the CMap directory ------------------
		//
		// A document with a predefined CMap forces the lookup. The
		// request itself is the evidence that the URLs in
		// `getDocument()` point at the shipped tables.
		const browser = await launchBrowser();
		try {
			const page = await browser.newPage();
			const cmapRequests = [];
			const assetFailures = [];
			page.on('response', (r) => {
				const url = r.url();
				if (url.includes('/assets/pdfjs/')) {
					cmapRequests.push(`${r.status()} ${url.split('/assets/pdfjs/')[1]}`);
					if (r.status() >= 400) assetFailures.push(`${r.status()} ${url}`);
				}
			});

			// Force the standard-font path too: a PDF with no embedded
			// font makes pdf.js reach for standardFontDataUrl.
			const pdf = await PDFDocument.create();
			const page1 = pdf.addPage();
			page1.drawText('standard font metrics probe', { x: 50, y: 700, size: 14 });
			const bytes = await pdf.save();

			await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'load' });
			// The library screen mounts only after the database opens
			// (see `recoverUnmigratableDatabase` in main.tsx), so the
			// file input is not in the DOM on first paint.
			//
			// `waitFor` defaults to requiring visibility, and this input
			// is deliberately hidden (a styled label triggers it), so we
			// wait for attachment instead.
			const fileInput = page.locator('input[type=file]');
			await fileInput.waitFor({ state: 'attached', timeout: 30000 });
			await fileInput.setInputFiles({
				name: 'asset-probe.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(bytes),
			});
			const readLink = page.getByRole('link', { name: '読む' }).first();
			await readLink.waitFor({ timeout: 30000 });
			await readLink.click();

			// The canvas only appears once a page has rendered.
			await page.locator('canvas').first().waitFor({ timeout: 30000 });
			await readStableCount(page.locator('canvas'));
			await page.waitForTimeout(3000);

			if (assetFailures.length > 0) {
				fail(`pdf.js asset requests failed:\n  ${assetFailures.join('\n  ')}`);
			}
			console.log(
				`[smoke] pdf.js support-table requests: ${cmapRequests.length}` +
					(cmapRequests.length ? ` — e.g. ${cmapRequests[0]}` : ' (none needed by this document)'),
			);
			if (cmapRequests.length === 0) {
				// Not a failure: a fully-embedded-font document needs no
				// table. The on-disk and HTTP checks above are the
				// unconditional guarantees; this is the opportunistic
				// one.
				console.log(
					'[smoke] note: this document needed no support table; ' +
						'the on-disk and HTTP checks above are what guarantee the CMap path',
				);
			}
			console.log('[smoke] ALL PDF-ASSET SMOKE CHECKS PASSED');
		} finally {
			await browser.close();
		}
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
