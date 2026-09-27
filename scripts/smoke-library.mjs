#!/usr/bin/env bun
/**
 * readmark — one-shot browser smoke for the #4 library list flow.
 *
 * NOT a permanent E2E harness. Run once with:
 *
 *   bun scripts/smoke-library.mjs
 *
 * Verifies (against `bun run preview`):
 *   1. Two imported PDFs show up as two rows, ordered by the default
 *      "recently read" rule.
 *   2. Changing the sort control reorders the rows.
 *   3. The search box filters by title and by author, and clearing it
 *      brings the rows back.
 *   4. Delete asks first; cancelling writes nothing.
 *   5. Confirming the delete removes the row AND the document,
 *      source and blob rows in IndexedDB — the delete cascade is a
 *      storage claim, so a DOM-only assertion would not prove it.
 *
 * Why the assertions are about IndexedDB as well as the DOM: a row
 * can leave the list while its bytes stay in the store, which is
 * precisely the failure mode a cascade can have, and it only shows up
 * where the reader's disk usage is decided.
 *
 * Exits non-zero on the first failed assertion. Preview server,
 * browser launch and count settling come from
 * `scripts/smoke-harness.mjs`.
 */

import { PDFDocument } from 'pdf-lib';

import {
	fail,
	findStoreCount,
	launchBrowser,
	PREVIEW_URL,
	readStableCount,
	readStoreCounts,
	withPreview,
} from './smoke-harness.mjs';

const log = (msg) => console.log(`[smoke] ${msg}`);

/** A one-page PDF whose /Info title and author the list can show. */
async function makePdfBytes(title, author) {
	const pdf = await PDFDocument.create();
	pdf.addPage();
	pdf.setTitle(title);
	pdf.setAuthor(author);
	return await pdf.save();
}

async function importPdf(page, bytes, name) {
	// The empty state renders a second import control, so the
	// testid matches two inputs while the library is empty. The first
	// one is the header control, and it is mounted in every state, so
	// pinning it keeps this selector valid before and after an import.
	await page
		.locator('[data-testid="rm-document-import-input"]')
		.first()
		.setInputFiles({
			name,
			mimeType: 'application/pdf',
			buffer: Buffer.from(bytes),
		});
	// The import status line only appears after a successful import,
	// so it doubles as the "the flow finished" signal. React commits
	// it in the same render that ends the busy state.
	await page
		.locator('[data-testid="rm-import-status"]')
		.waitFor({ state: 'visible', timeout: 20_000 });
}

const rows = (page) => page.locator('[data-testid="rm-library-row"]');

/** Row titles in DOM order — the first link in a row is the title. */
async function rowTitles(page) {
	return await page
		.locator('[data-testid="rm-library-row"] .rm-library-row__title')
		.allTextContents();
}

async function main() {
	await withPreview(async () => {
		log('preview server is up');
		const browser = await launchBrowser();
		const page = await browser.newPage();

		// Any console error here is a bug we want to see: the delete
		// flow is exactly where a rejected promise would hide.
		const consoleErrors = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
		});

		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

		// --- Import two documents ---
		await importPdf(page, await makePdfBytes('吾輩は猫である', '夏目漱石'), 'neko.pdf');
		await importPdf(page, await makePdfBytes('雪国', '川端康成'), 'yukiguni.pdf');
		const afterImport = await readStableCount(rows(page));
		if (afterImport !== 2) fail(`expected 2 rows after importing 2 PDFs, got ${afterImport}`);
		log(`imported 2 PDFs, list shows ${afterImport} rows`);

		// --- Sort ---
		// Both rows were imported and never opened, so the default
		// "recently read" order falls back to import time: newest
		// first. Titles make the order observable.
		const newestFirst = await rowTitles(page);
		if (newestFirst[0] !== '雪国' || newestFirst[1] !== '吾輩は猫である') {
			fail(
				`expected recently-read order [雪国, 吾輩は猫である], got ${JSON.stringify(newestFirst)}`,
			);
		}
		log(`default order: ${JSON.stringify(newestFirst)}`);

		await page.selectOption('[data-testid="rm-library-sort"]', 'title-asc');
		const byTitle = await rowTitles(page);
		if (byTitle[0] !== '吾輩は猫である' || byTitle[1] !== '雪国') {
			fail(`expected title order [吾輩は猫である, 雪国], got ${JSON.stringify(byTitle)}`);
		}
		log(`title order: ${JSON.stringify(byTitle)}`);

		await page.selectOption('[data-testid="rm-library-sort"]', 'recently-read');

		// --- Search ---
		await page.fill('[data-testid="rm-library-search"]', '夏目');
		if ((await readStableCount(rows(page))) !== 1) fail('search by author did not narrow to 1 row');
		await page.fill('[data-testid="rm-library-search"]', '雪国');
		if ((await readStableCount(rows(page))) !== 1) fail('search by title did not narrow to 1 row');
		await page.fill('[data-testid="rm-library-search"]', '該当なし');
		await page.locator('[data-testid="rm-library-empty-filtered"]').waitFor({ state: 'visible' });
		await page.fill('[data-testid="rm-library-search"]', '');
		if ((await readStableCount(rows(page))) !== 2)
			fail('clearing the search did not restore 2 rows');
		log('search filters by title and author, and clears');

		// --- Delete: cancel writes nothing ---
		const beforeCancel = await readStoreCounts(page);
		await rows(page).first().locator('[data-testid="rm-library-row-delete"]').click();
		const dialog = page.locator('[role="alertdialog"]');
		await dialog.waitFor({ state: 'visible' });
		const dialogText = (await dialog.textContent()) ?? '';
		if (!dialogText.includes('読書進捗')) {
			fail(`confirmation does not state the reading-state loss: ${dialogText}`);
		}
		await page.click('[data-testid="rm-dialog-cancel"]');
		await dialog.waitFor({ state: 'hidden' });
		const afterCancel = await readStoreCounts(page);
		for (const store of ['documents', 'documentSources', 'documentBlobs']) {
			if (findStoreCount(beforeCancel, store) !== findStoreCount(afterCancel, store)) {
				fail(`cancelling the delete changed the ${store} store`);
			}
		}
		if ((await readStableCount(rows(page))) !== 2)
			fail('cancelling the delete changed the row count');
		log('cancel left both the list and IndexedDB untouched');

		// --- Delete: confirm cascades ---
		const victimTitle = (await rowTitles(page))[0];
		const victimId = await rows(page).first().getAttribute('data-document-id');
		await rows(page).first().locator('[data-testid="rm-library-row-delete"]').click();
		await page.click('[data-testid="rm-dialog-confirm"]');
		const rowsAfterDelete = await readStableCount(rows(page));
		if (rowsAfterDelete !== 1)
			fail(`expected 1 row after deleting one of 2, got ${rowsAfterDelete}`);
		const remainingTitles = await rowTitles(page);
		if (remainingTitles.includes(victimTitle)) {
			fail(`deleted row ${victimTitle} is still in the list`);
		}
		const afterDelete = await readStoreCounts(page);
		for (const store of ['documents', 'documentSources', 'documentBlobs']) {
			const count = findStoreCount(afterDelete, store);
			if (count !== 1) fail(`expected 1 row left in ${store} after the delete, got ${count}`);
		}
		log(`deleted ${JSON.stringify(victimTitle)} (${victimId}); 1 document + source + blob left`);

		if (consoleErrors.length > 0) {
			fail(`unexpected console errors:\n${consoleErrors.join('\n')}`);
		}
		log('no console errors during the list flow');

		await browser.close();
		log('ALL SMOKE CHECKS PASSED');
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
