#!/usr/bin/env bun
/**
 * readmark — verify that a built `dist/` carries the pdf.js support
 * tables.
 *
 * ## Why this exists
 *
 * The tables are copied by the `pdfjsSupportTables` plugin's
 * `closeBundle` hook, not by anything the bundler tracks. If that hook
 * stops running — plugin removed, `OUTPUT_SUBPATH` changed, a directory
 * dropped from `DIRECTORIES` — the build still succeeds, the base
 * checks still pass, and `readmark-dist` publishes an app whose
 * Japanese PDFs render blank. Nothing else in CI looks inside
 * `dist/assets/pdfjs`.
 *
 * CI runs it after each build, because each build leaves a different
 * `dist/` behind. A directory that is missing or empty fails: the copy
 * step is what fills them.
 *
 * The directory list is a literal rather than an import from
 * `vite.config.ts` on purpose — this check has to fail if the plugin
 * forgets one of them.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TABLE_DIRECTORIES = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];

const DIST = resolve(import.meta.dirname, '..', 'dist');
let failed = false;

for (const directory of TABLE_DIRECTORIES) {
	const path = join(DIST, 'assets', 'pdfjs', directory);
	let files;
	try {
		files = readdirSync(path).filter((name) => {
			if (name.startsWith('.')) return false;
			try {
				return statSync(join(path, name)).isFile();
			} catch {
				return false;
			}
		});
	} catch {
		console.error(`[check] missing  ${path}`);
		failed = true;
		continue;
	}
	if (files.length === 0) {
		console.error(`[check] empty    ${path}`);
		failed = true;
		continue;
	}
	console.log(`[check] present  ${directory}: ${files.length} files`);
}

if (failed) {
	console.error(
		'[check] FAIL: the pdf.js support tables are not in the artefact; ' +
			'those requests would 404 at render time and the glyphs would not paint.',
	);
	process.exit(1);
}
console.log(`[check] all support tables present in ${DIST}`);
