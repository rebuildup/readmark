#!/usr/bin/env bun

/**
 * readmark — regression gate for "the page renders but the text is
 * gone".
 *
 * ## The failure this locks down
 *
 * pdf.js loads its support tables (CMaps, standard-font metrics, wasm
 * decoders, ICC profiles) over HTTP at render time. Nothing imports
 * them, so a bundler will not emit them, and a default `vite build`
 * ships a `dist/` where every one of those requests 404s. Neither
 * `getDocument()` nor the render task then fails — the page opens, the
 * text layer reports the right strings, and the glyphs simply are not
 * drawn. Silent, total, and specific to documents that rely on the
 * tables.
 *
 * ## Why a real file, and why this one
 *
 * `src/test/fixtures/pdf-missing-support-tables.pdf` is a real
 * 30 KB receipt, not a generated one. Generated fixtures are how this
 * went wrong before: a synthetic PDF can be malformed in ways that
 * make it fail for an unrelated reason, which teaches you to distrust
 * the test instead of fixing the bug. This file is taken verbatim from
 * a working directory of real documents and reproduces the defect on
 * its own.
 *
 * It is a good reproducer for a specific reason: it is an
 * **image-only** document — a scanned/CCITTFax receipt with **no font
 * resources at all** — whose only content is a
 * `CCITTFaxDecode` image. pdf.js decodes that through the wasm decoders
 * in `standard_fonts`/`wasm` support tables. With the tables missing,
 * the page renders as blank paper; with them present, the receipt
 * appears.
 *
 * The assertion is deliberately about *ink on the canvas*, never about
 * `getTextContent()`. A text-layer assertion passes in exactly the
 * broken state, which is why the original smokes all stayed green
 * while the app was unusable.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	fail,
	launchBrowser,
	PREVIEW_URL,
	readStableCount,
	withPreview,
} from './smoke-harness.mjs';

const FIXTURE = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'src',
	'test',
	'fixtures',
	'pdf-missing-support-tables.pdf',
);

const bytes = readFileSync(FIXTURE);
const SHA = createHash('sha256').update(bytes).digest('hex');
console.log(`[smoke] fixture: pdf-missing-support-tables.pdf`);
console.log(`[smoke]   size=${bytes.length} bytes sha256=${SHA}`);

const MEASURE = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script type="module">
// Bare pdf.js: no readmark module is involved, so a failure here is
// pdf.js's or the build's, not the reader's.
window.__ink = async (withAssets) => {
  const m = await (await fetch('/__manifest.json')).json();
  const pdfjs = await import(m.pdfChunk);
  pdfjs.GlobalWorkerOptions.workerSrc = m.worker;
  const opts = { url: '/__probe.pdf' };
  if (withAssets) {
    opts.cMapUrl = '/assets/pdfjs/cmaps/';
    opts.cMapPacked = true;
    opts.standardFontDataUrl = '/assets/pdfjs/standard_fonts/';
    opts.wasmUrl = '/assets/pdfjs/wasm/';
    opts.iccUrl = '/assets/pdfjs/iccs/';
  }
  const doc = await pdfjs.getDocument(opts).promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width);
  c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 200) dark++;
  const tc = await page.getTextContent();
  await doc.destroy();
  return { dark, total: c.width * c.height, chars: tc.items.length };
};
window.__ready = true;
</script></body></html>`;

await withPreview(async () => {
	const browser = await launchBrowser();
	const ctx = await browser.newContext();
	const page = await ctx.newPage();

	// Content-hashed asset names, read off disk so this survives a
	// rebuild instead of pinning one build's output.
	const assets = join(process.cwd(), 'dist', 'assets');
	const { readdirSync } = await import('node:fs');
	const names = readdirSync(assets);
	const pdfChunk = '/assets/' + names.find((f) => /^pdf-.*\.js$/.test(f));
	const worker = '/assets/' + names.find((f) => /^pdf\.worker\.min-.*\.mjs$/.test(f));
	if (!pdfChunk || !worker) fail('could not locate the pdf.js chunks in dist/assets');

	await ctx.route('**/__manifest.json', (r) =>
		r.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ pdfChunk, worker }),
		}),
	);
	await ctx.route('**/__measure.html', (r) =>
		r.fulfill({ status: 200, contentType: 'text/html', body: MEASURE }),
	);
	await ctx.route('**/__probe.pdf', (r) =>
		r.fulfill({
			status: 200,
			contentType: 'application/pdf',
			headers: { 'content-length': String(bytes.length) },
			body: bytes,
		}),
	);
	await page.goto(`${PREVIEW_URL}/__measure.html`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });

	// --- the negative control ---------------------------------------
	//
	// Rendering without the table URLs must produce a blank page. If it
	// does not, the fixture no longer reproduces the defect and this
	// smoke has stopped testing anything.
	const before = await page.evaluate(() => window.__ink(false));
	const beforeRatio = before.dark / before.total;
	console.log(
		`[smoke] without support tables: ink=${(beforeRatio * 100).toFixed(3)}% ` +
			`(${before.dark} px), textItems=${before.chars}`,
	);
	if (beforeRatio > 0.002) {
		fail(
			`the fixture no longer reproduces the failure: it rendered ` +
				`${(beforeRatio * 100).toFixed(3)}% ink even without the support tables. ` +
				'This smoke has stopped testing the defect it was written for.',
		);
	}
	console.log('[smoke] negative control holds: blank without the tables');

	// --- the actual gate --------------------------------------------
	const after = await page.evaluate(() => window.__ink(true));
	const afterRatio = after.dark / after.total;
	console.log(
		`[smoke] with support tables:    ink=${(afterRatio * 100).toFixed(3)}% ` +
			`(${after.dark} px), textItems=${after.chars}`,
	);
	if (afterRatio <= 0.002) {
		fail(
			'the page still renders blank WITH the support tables. The document ' +
				'is loaded and the tables are served, so something else is dropping ' +
				'the content.',
		);
	}
	console.log('[smoke] the page renders content again');

	// --- and the same through readmark itself -----------------------
	const readmarkPage = await ctx.newPage();
	const warnings = [];
	readmarkPage.on('console', (m) => {
		if (m.type() === 'error' || m.type() === 'warning') warnings.push(m.text().slice(0, 120));
	});
	await readmarkPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'load' });
	const input = readmarkPage.locator('input[type=file]').first();
	await input.waitFor({ state: 'attached', timeout: 30000 });
	await input.setInputFiles({
		name: 'pdf-missing-support-tables.pdf',
		mimeType: 'application/pdf',
		buffer: bytes,
	});
	const link = readmarkPage.getByRole('link', { name: '読む' }).first();
	await link.waitFor({ timeout: 30000 });
	await link.click();
	await readmarkPage.locator('canvas').first().waitFor({ timeout: 30000 });
	// Wait for a canvas that has actually painted. readmark reserves
	// space before rendering, so the first canvas can be a placeholder.
	const painted = await readmarkPage
		.waitForFunction(
			() => {
				for (const c of document.querySelectorAll('canvas')) {
					if (c.width < 10 || c.height < 10) continue;
					const d = c
						.getContext('2d', { willReadFrequently: true })
						.getImageData(0, 0, c.width, c.height).data;
					for (let i = 0; i < d.length; i += 4) if (d[i] < 200) return true;
				}
				return false;
			},
			null,
			{ timeout: 60000 },
		)
		.then(() => true)
		.catch(() => false);
	if (!painted) fail('no readmark canvas painted any ink within 60s');
	await readStableCount(readmarkPage.locator('canvas'));
	await readmarkPage.waitForTimeout(1500);
	await readmarkPage
		.locator('canvas')
		.first()
		.screenshot({ path: '/tmp/opencode/support-tables-regression.png' });
	console.log(
		'[smoke] readmark rendered the fixture -> /tmp/opencode/support-tables-regression.png',
	);

	// A missing-table failure shows up here as a font/decode warning.
	const tableWarnings = warnings.filter((w) =>
		/cMapUrl|standardFontDataUrl|wasm|iccUrl|could not be decoded|font loading/i.test(w),
	);
	if (tableWarnings.length > 0) {
		fail(`support-table related warnings in readmark:\n  ${tableWarnings.join('\n  ')}`);
	}
	console.log('[smoke] no support-table warnings in readmark');
	// --- the same, against the DEV server --------------------------
	//
	// The support-table base URL is resolved from `import.meta.env.BASE_URL`,
	// and dev and build disagree about every other thing: Vite serves the
	// pdf.js worker from `/node_modules/...` in dev and from `/assets/...`
	// after a build. Deriving the base from the worker's own URL — which
	// looked tidier — therefore produced a dev server where every document
	// silently lost its glyphs while `bun run preview` was perfect. This
	// leg exists so that split can never come back unnoticed.
	{
		const devPort = 5199;
		const dev = spawn('bun', ['run', 'dev', '--port', String(devPort), '--strictPort'], {
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env },
		});
		let devErr = '';
		dev.stderr.on('data', (c) => (devErr += c.toString()));
		try {
			// Wait for the bound URL, the same readiness signal the
			// harness uses for preview: a 200 could be another server.
			const ready = await new Promise((resolve) => {
				let seen = false;
				dev.stdout.on('data', (c) => {
					// Vite prints either `localhost:` or `127.0.0.1:` depending on host
					// resolution, so match the port and the Local: prefix rather
					// than one literal host.
					if (/Local:\s*https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):5199/.test(c.toString())) {
						seen = true;
					}
				});
				const deadline = Date.now() + 30000;
				const tick = setInterval(() => {
					if (seen || Date.now() > deadline) {
						clearInterval(tick);
						resolve(seen);
					}
				}, 100);
			});
			if (!ready) fail(`dev server never bound 5199; stderr:\n${devErr.slice(-400)}`);

			// The tables must be served in dev, at the app's base path.
			for (const probe of [
				'assets/pdfjs/cmaps/UniJIS-UCS2-H.bcmap',
				'assets/pdfjs/standard_fonts/LiberationSans-Regular.ttf',
				'assets/pdfjs/wasm/openjpeg.wasm',
			]) {
				const res = await fetch(`http://127.0.0.1:${devPort}/${probe}`);
				if (res.status !== 200) {
					fail(`dev server: GET /${probe} -> ${res.status} (tables must resolve in dev too)`);
				}
				const bytes = (await res.arrayBuffer()).byteLength;
				if (bytes === 0) fail(`dev server: GET /${probe} returned 0 bytes`);
				console.log(`[smoke] dev serves ${probe} (${bytes} bytes, 200)`);
			}

			// And the module must actually point at that base.
			const modSrc = await (
				await fetch(`http://127.0.0.1:${devPort}/src/reader/pdf/pdf-worker.ts`)
			).text();
			if (/node_modules[^"']*pdfjs\//.test(modSrc.split('PDFJS_ASSET_BASE')[1] ?? '')) {
				fail(
					'the dev module derives the support-table base from the worker URL ' +
						'(a /node_modules/... path), which does not exist. Documents lose ' +
						'their glyphs in dev while working in a build.',
				);
			}
			console.log('[smoke] dev module resolves the base from BASE_URL, not the worker path');
		} finally {
			dev.kill('SIGTERM');
			setTimeout(() => dev.kill('SIGKILL'), 1000).unref();
		}
	}

	console.log('[smoke] ALL SUPPORT-TABLE REGRESSION CHECKS PASSED');

	await ctx.close();
	await browser.close();
});
process.exit(0);
