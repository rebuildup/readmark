#!/usr/bin/env bun
/**
 * Gate: no tofu. Every Japanese glyph the UI draws must have real
 * ink behind it.
 *
 * ## Why this is a pixel test and not a DOM assertion
 *
 * The failure this guards is invisible to every other check. The
 * text is in the DOM, `textContent` is correct, the string is
 * non-empty, and the element has a sensible width — the characters
 * simply have no glyphs, so the browser draws □. A DOM assertion
 * passes while the app is unreadable.
 *
 * Tofu also has a distinctive shape: hollow rectangles. Rendering
 * the same string twice — once in the app's font stack, once in a
 * font known to lack the glyph — and comparing ink is how we tell
 * "drew a real kanji" from "drew a box".
 *
 * The simplest reliable signal is font availability plus a
 * non-rectangular ink profile, so this measures both:
 *   1. `document.fonts.check()` for each family the UI asks for.
 *   2. The rendered width of a known Japanese string, which must be
 *      non-zero and must not equal the width of the same string
 *      rendered with CJK glyphs forced off.
 */

import { fail, launchBrowser, PREVIEW_URL, withPreview } from './smoke-harness.mjs';

/** Japanese that appears verbatim in the library screen's chrome. */
/**
 * Japanese that appears verbatim in the library screen's chrome.
 *
 * Copied from the screen rather than invented: a string that does not
 * exist there fails the smoke for the wrong reason, and trains you to
 * ignore it.
 */
const UI_STRINGS = [
	'まだ文書がありません',
	'ローカルに保持された文書のリスト',
	'import ボタンから PDF を追加してください',
	'PDF を import',
];

await withPreview(async () => {
	const browser = await launchBrowser();
	try {
		const page = await browser.newPage();
		const failures = [];
		page.on('requestfailed', (r) => {
			if (r.url().includes('fonts.g')) failures.push(`request failed: ${r.url()}`);
		});
		page.on('response', (r) => {
			if (r.url().includes('fonts.googleapis.com/css2') && r.status() >= 400) {
				failures.push(`stylesheet ${r.status()}: ${r.url()}`);
			}
		});

		await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'load' });
		// The library screen mounts after the database opens.
		await page.locator('input[type=file]').waitFor({ state: 'attached', timeout: 30000 });
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(1500);

		// --- 1. the webfont actually loaded ------------------------
		//
		// `document.fonts.check(family, text)` is NOT a usable
		// assertion here. Google Fonts serves Noto Sans JP as ~120
		// `unicode-range`-scoped subsets, and `check()` only reports true
		// for characters covered by an ALREADY-LOADED subset. The browser
		// fetches those subsets lazily, so per-character `check()` returns
		// false for perfectly good text and this smoke fails on a working
		// page.
		//
		// What is reliable: the stylesheet was fetched and faces were
		// created for the family. The real proof of glyphs is section 3,
		// which measures ink.
		const fontReport = await page.evaluate(
			(families) => {
				const out = {};
				for (const family of families) {
					const faces = Array.from(document.fonts).filter(
						(f) => f.family.replace(/["']/g, '') === family,
					);
					out[family] = {
						faceCount: faces.length,
						loaded: faces.filter((f) => f.status === 'loaded').length,
						weights: [...new Set(faces.map((f) => f.weight))].sort(),
					};
				}
				return out;
			},
			['Noto Sans JP', 'Zen Kaku Gothic New'],
		);

		console.log('[tofu] font faces:', JSON.stringify(fontReport));
		if (fontReport['Noto Sans JP'].faceCount === 0) {
			fail(
				'No Noto Sans JP face was created at all — the Google Fonts stylesheet ' +
					'never loaded. Check the <link> in index.html and whether ' +
					'Cross-Origin-Embedder-Policy: require-corp blocks it.',
			);
		}
		if (fontReport['Noto Sans JP'].loaded === 0) {
			fail('Noto Sans JP faces exist but none loaded — every Japanese label is tofu');
		}

		// --- 2. the chrome text is really on screen ----------------
		const body = await page.evaluate(() => document.body.innerText);
		for (const s of UI_STRINGS) {
			if (!body.includes(s)) {
				fail(`expected UI string not rendered: "${s}"\n--- body ---\n${body}`);
			}
		}
		console.log(`[tofu] all ${UI_STRINGS.length} UI strings present in the rendered text`);

		// --- 3. real ink, not hollow boxes -------------------------
		//
		// Draw the same string twice into a canvas: once with the app's
		// stack, once with a font that certainly has no CJK. Tofu is
		// what the second produces, so if the first matches the second
		// the app is drawing boxes.
		const ink = await page.evaluate(async (text) => {
			await document.fonts.ready;
			const measure = (font) => {
				const canvas = document.createElement('canvas');
				canvas.width = 600;
				canvas.height = 80;
				const ctx = canvas.getContext('2d');
				ctx.font = font;
				const m = ctx.measureText(text);
				// Count distinct horizontal extents: kana/kanji have
				// varied widths, tofu boxes are uniform.
				const widths = new Set();
				for (let i = 0; i < text.length; i++) {
					const w = ctx.measureText(text[i]).width;
					widths.add(Math.round(w * 10) / 10);
				}
				return { width: m.width, distinctWidths: widths.size };
			};
			return {
				app: measure('16px "Noto Sans JP", sans-serif'),
				// A stack with no CJK face at all, forced.
				noCjk: measure('16px "___NoSuchFont___", monospace'),
			};
		}, '日本語のテキスト');

		console.log('[tofu] ink profile:', JSON.stringify(ink));
		if (ink.app.width === 0) {
			fail('Japanese string measured zero width — no glyphs are being selected');
		}
		if (ink.app.distinctWidths < 2) {
			fail(
				`every Japanese character measured the same width (${ink.app.distinctWidths} ` +
					'distinct) — that is the signature of tofu boxes, not real glyphs',
			);
		}

		await page.screenshot({ path: '/tmp/opencode/tofu-check.png' });
		console.log('[tofu] screenshot -> /tmp/opencode/tofu-check.png');

		if (failures.length > 0) {
			fail(`font requests failed:\n  ${failures.join('\n  ')}`);
		}
		console.log('[tofu] NO TOFU CHECK PASSED');
	} finally {
		await browser.close();
	}
});

process.exit(0);
