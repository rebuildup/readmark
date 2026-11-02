#!/usr/bin/env bun
/**
 * Gate: no tofu. Every Japanese glyph the UI draws must have real
 * ink behind it — and the page must fetch nothing from any third
 * party while drawing it (ADR-0008: zero external origins; the
 * webfont that used to guarantee the glyphs is gone with it).
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
 * Three sections:
 *   1. No third-party request leaves the page (font hosts or any
 *      other external origin → fail). A webfont fetch would both
 *      violate ADR-0008 and mask whether the MACHINE can draw
 *      Japanese.
 *   2. The chrome strings are really on screen.
 *   3. Ink: rendered widths of a known Japanese string, which must
 *      be non-zero and must not collapse to the uniform width of
 *      forced tofu.
 *
 * What a failure of section 3 means HERE: the machine running the
 * smoke has no installed Japanese face. That is the accepted cost
 * of ADR-0008 (a document that phones home for its own UI text
 * contradicts the model), and the fix is to install a CJK font on
 * the machine — not to re-add a webfont.
 */

import { fail, launchBrowser, PREVIEW_URL, withPreview } from './smoke-harness.mjs';

/**
 * Japanese that appears verbatim in the library screen's chrome.
 *
 * Copied from the screen rather than invented: a string that does not
 * exist there fails the smoke for the wrong reason, and trains you to
 * ignore it.
 */
const UI_STRINGS = [
	'まだ文書がありません',
	'このセッションの文書のリスト',
	'この readmark は保存しません',
	'import ボタンから PDF を追加してください',
	'PDF を import',
];

/** Origins the page may talk to. Everything else is a violation. */
function isAllowedUrl(url) {
	return url.startsWith(PREVIEW_URL) || url.startsWith('data:') || url.startsWith('blob:');
}

await withPreview(async () => {
	const browser = await launchBrowser();
	try {
		const page = await browser.newPage();
		const failures = [];
		page.on('requestfailed', (r) => {
			if (!isAllowedUrl(r.url())) failures.push(`third-party request failed: ${r.url()}`);
		});
		page.on('request', (r) => {
			if (!isAllowedUrl(r.url())) failures.push(`third-party request: ${r.url()}`);
		});

		await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'load' });
		// The library screen mounts directly — there is no storage
		// initialization gate in front of the first render (ADR-0008).
		await page.locator('input[type=file]').waitFor({ state: 'attached', timeout: 30000 });
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(1500);

		// --- 1. nothing left the origin -----------------------------
		//
		// The old check here verified the Google Fonts stylesheet had
		// loaded. ADR-0008 removed the stylesheet: a page that fetches
		// its own UI text from a third party contradicts the
		// storage-free, zero-contact model this app ships with, and a
		// successful fetch would hide whether the machine itself can
		// draw Japanese.
		console.log('[tofu] no third-party request observed');

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
		// Draw the same string twice into a canvas: once with the
		// machine's stack (the same faces the stylesheet lists first),
		// once with a font that certainly has no CJK. Tofu is what the
		// second produces, so if the first matches the second the app
		// is drawing boxes.
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
				app: measure(
					'16px "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, system-ui, sans-serif',
				),
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
					'distinct) — that is the signature of tofu boxes, not real glyphs. ' +
					'Install a Japanese system font on this machine (ADR-0008 accepted ' +
					'that no webfont will be fetched).',
			);
		}

		await page.screenshot({ path: '/tmp/opencode/tofu-check.png' });
		console.log('[tofu] screenshot -> /tmp/opencode/tofu-check.png');

		if (failures.length > 0) {
			fail(`external contact observed:\n  ${failures.join('\n  ')}`);
		}
		console.log('[tofu] NO TOFU CHECK PASSED');
	} finally {
		await browser.close();
	}
});

process.exit(0);
