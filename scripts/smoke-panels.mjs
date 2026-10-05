#!/usr/bin/env bun
/**
 * readmark — one-shot browser smoke for #9 side panels.
 *
 * NOT a permanent E2E harness. Run once with:
 *
 *   bun scripts/smoke-panels.mjs
 *
 * What it verifies, against the real built app in headless Chromium:
 *
 *   1. The three tabs switch, and only the chosen list is on screen.
 *      Asserting on a visible row rather than on the tab's own
 *      `aria-selected` is the point: two panels mounted at once, or the
 *      wrong one showing, both leave the tab state looking right.
 *   2. **The count equals the rows on screen.** Read from the rendered
 *      DOM for each of the three lists, and cross-checked against
 *      IndexedDB so the panel is not merely agreeing with itself. This
 *      is the 「count が Library と一致する」 criterion; a count derived
 *      from a second query would pass a self-consistent check and fail
 *      here.
 *   3. A highlight made by a real drag appears in the highlights list,
 *      and a bookmark added from the header appears in the 栞 list.
 *   4. **A narrow viewport becomes an overlay**: `role="dialog"`,
 *      `aria-modal`, and the panel measured as a sheet over the
 *      document rather than as a column beside it. The computed
 *      position is the part only a browser can answer.
 *   5. **Focus really moves into the overlay, Tab is contained, and
 *      Escape returns focus to the opener.** Asserted against
 *      `document.activeElement` after real key presses — happy-dom has
 *      no browser focus, so this is the only place these can be true.
 *   6. Jumping from a bookmark scrolls the document away from where it
 *      was. happy-dom has no layout, so a jump there is a write of
 *      zero; here the page is measurably on screen.
 *   7. An orphan note — one whose highlight no longer exists — is on
 *      screen, counted, carries no jump button, and says why. Injected
 *      straight into IndexedDB, which is the only way to produce the
 *      state a reader reaches by deleting a mark in another tab.
 *   8. No console errors.
 *
 * Why this exists rather than a unit test: happy-dom has no layout, no
 * real focus model, no viewport and no computed styles. Every claim
 * above is about something the browser computes.
 *
 * Preview server, browser launch and store counting come from
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

const PAGE_COUNT = 8;
/** Below the panel's own breakpoint, so the overlay path is the one
 *  under test rather than the column. */
const NARROW = { width: 480, height: 900 };
/** Above it, so the column path is. */
const WIDE = { width: 1280, height: 900 };

async function makeFixturePdf() {
	const pdf = await PDFDocument.create();
	for (let index = 1; index <= PAGE_COUNT; index++) {
		const page = pdf.addPage([420, 900]);
		page.drawText(`readmark page ${index} of ${PAGE_COUNT}`, { x: 40, y: 520, size: 18 });
		page.drawText(`selectable text for the panels smoke on page ${index}`, {
			x: 40,
			y: 480,
			size: 12,
		});
	}
	pdf.setTitle('readmark panels smoke');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
}

/**
 * Drag a real selection across page 1's text layer.
 *
 * The span is revealed first: at fit-width a page is often several
 * screens tall, and a drag to a coordinate outside the viewport
 * selects nothing, which would report a broken text layer when the
 * text layer is fine.
 */
async function dragSelectFirstPageText(page) {
	await page.evaluate(() => {
		const host = document.querySelector('[data-page-index="1"]');
		const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
		if (host === null || scroller === null) return;
		const headerBottom =
			document.querySelector('.rm-reader-header')?.getBoundingClientRect().bottom ?? 0;
		for (const candidate of host.querySelectorAll('.rm-text-layer span')) {
			const rect = candidate.getBoundingClientRect();
			if (rect.width < 4 || rect.height < 4) continue;
			if (rect.top < headerBottom) continue;
			const box = scroller.getBoundingClientRect();
			if (rect.top >= box.top && rect.bottom <= box.bottom) return;
			candidate.scrollIntoView({ block: 'center' });
			return;
		}
	});

	const measured = await page.evaluate(() => {
		const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
		const header = document.querySelector('.rm-reader-header');
		if (scroller === null || header === null) return null;
		const headerBottom = header.getBoundingClientRect().bottom;
		const box = scroller.getBoundingClientRect();
		for (const candidate of document.querySelectorAll(
			'[data-page-index="1"] .rm-text-layer span',
		)) {
			const rect = candidate.getBoundingClientRect();
			if (rect.width < 4 || rect.height < 4) continue;
			if (rect.top < headerBottom + 4) continue;
			if (rect.top < box.top || rect.bottom > box.bottom) continue;
			return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		}
		return null;
	});
	if (measured === null) fail('no text span was visible on page 1 to drag across');

	const startX = measured.x + 2;
	const startY = measured.y + measured.height / 2;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + measured.width - 4, startY, { steps: 8 });
	await page.mouse.up();
	return await page.evaluate(() => window.getSelection()?.toString() ?? '');
}

/** Write a row straight into IndexedDB.
 *
 * The orphan note in step 7 has no UI path: the reader only ever writes
 * a note that hangs off a mark it has just made. Producing the state a
 * reader reaches by deleting a mark in another tab needs the store
 * itself, which is also the honest way to prove the panel copes with
 * data it did not create.
 */
async function writeRow(page, storeName, row) {
	await page.evaluate(
		async ([store, value]) => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open('readmark');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			await new Promise((resolve, reject) => {
				const tx = db.transaction(store, 'readwrite');
				tx.objectStore(store).put(value);
				tx.oncomplete = () => resolve(undefined);
				tx.onerror = () => reject(tx.error);
			});
			db.close();
		},
		[storeName, row],
	);
}

/** Where the scroller is, so a jump is measurable rather than asserted. */
async function scrollTop(page) {
	return await page.evaluate(
		() => document.querySelector('[data-testid="rm-reader-scroll"]')?.scrollTop ?? 0,
	);
}

/** The count a tab shows, read from the rendered DOM. */
async function tabCount(page, tab) {
	return await page.evaluate(
		(id) =>
			Number(
				document.querySelector(`[data-testid="rm-side-tab-count-${id}"]`)?.textContent ?? '-1',
			),
		tab,
	);
}

async function main() {
	await withPreview(async () => {
		log('preview server is up');
		const browser = await launchBrowser();
		const page = await browser.newPage();
		await page.setViewportSize(WIDE);

		const consoleErrors = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
		});

		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

		// --- Import the fixture through the library UI ---
		const bytes = await makeFixturePdf();
		await page
			.locator('[data-testid="rm-document-import-input"]')
			.first()
			.setInputFiles({
				name: 'panels-smoke.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(bytes),
			});
		await page.locator('[data-testid="rm-import-status"]').waitFor({ state: 'visible' });
		log(`imported a ${PAGE_COUNT}-page fixture`);

		// --- Open the reader ---
		await page.click('[data-testid="rm-library-row-read"]');
		await page.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await page
			.locator('[data-page-index="1"] .rm-text-layer span')
			.first()
			.waitFor({ state: 'attached', timeout: 10_000 });
		log('reader opened, with a text layer');

		// --- Make real marks, so the lists have something to show ---
		const selected = await dragSelectFirstPageText(page);
		if (selected.trim() === '') fail('the drag selected nothing, so there is no highlight to list');
		await page.locator('[data-testid="rm-selection-toolbar"]').waitFor({ state: 'visible' });
		await page.click('[data-testid="rm-selection-highlight"]');
		// The toolbar does not necessarily go away: re-selecting marked
		// text is offered the removal instead of a second mark. What
		// matters is that the row landed in the store, which step 2
		// checks against IndexedDB.
		await page.waitForFunction(
			async () => {
				const db = await new Promise((resolve, reject) => {
					const request = indexedDB.open('readmark');
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				const count = await new Promise((resolve) => {
					const request = db
						.transaction('highlights', 'readonly')
						.objectStore('highlights')
						.count();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => resolve(0);
				});
				db.close();
				return count >= 1;
			},
			undefined,
			{ timeout: 15_000 },
		);
		log(`made a highlight by dragging: ${JSON.stringify(selected.slice(0, 40))}`);

		await page.click('[data-testid="rm-add-bookmark"]');
		await page.locator('[data-testid="rm-bookmark-title"]').fill('第 1 ページの栞');
		await page.click('[data-testid="rm-dialog-confirm"]');
		log('added a bookmark from the header');

		// A free note, written from the panel's own create button. It
		// exists so the notes list has a row, and so the orphan in step
		// 7 can be written from a real note row rather than a
		// hand-built one. Written from the panel rather than from a
		// selection: a second drag would land on words already marked,
		// where the toolbar offers the *removal* of the mark.
		await page.click('[data-testid="rm-toggle-notes"]');
		await page.locator('[data-testid="rm-notes-panel"]').waitFor({ state: 'visible' });
		await page.click('[data-testid="rm-note-create"]');
		await page.locator('[data-testid="rm-note-editor"]').waitFor({ state: 'visible' });
		await page.locator('[data-testid="rm-note-body-input"]').fill('通常の一行メモ');
		await page.click('[data-testid="rm-note-save"]');
		await page.locator('[data-testid="rm-notes-list"]').waitFor({ state: 'visible' });
		const written = await readStableCount(page.locator('[data-testid="rm-note-row"]'));
		if (written !== 1) fail(`expected one note row after writing, found ${written}`);
		log('wrote a free note from the panel');

		// --- 1. The three tabs switch, and only one list is on screen ---
		await page.click('[data-testid="rm-toggle-bookmarks"]');
		await page.locator('[data-testid="rm-bookmarks-panel"]').waitFor({ state: 'visible' });
		const visibleLists = async () =>
			await page.evaluate(() =>
				['rm-bookmarks-panel', 'rm-highlights-panel', 'rm-notes-panel'].filter(
					(id) => document.querySelector(`[data-testid="${id}"]`) !== null,
				),
			);

		let lists = await visibleLists();
		if (lists.length !== 1 || lists[0] !== 'rm-bookmarks-panel') {
			fail(`expected only the bookmarks list on screen, found: ${lists.join(', ')}`);
		}

		await page.click('[data-testid="rm-side-tab-highlights"]');
		await page.locator('[data-testid="rm-highlights-panel"]').waitFor({ state: 'visible' });
		lists = await visibleLists();
		if (lists.length !== 1 || lists[0] !== 'rm-highlights-panel') {
			fail(`switching to ハイライト left these on screen: ${lists.join(', ')}`);
		}
		log('the three tabs switch, one list at a time');

		// --- 2. The count equals the rows on screen, and the store ---
		/**
		 * The acceptance criterion, in the browser. The tab's number is
		 * compared to the rows rendered, and the rows are compared to
		 * what IndexedDB holds — so a count that merely agreed with a
		 * second in-app query would still fail.
		 */
		const checkCounts = async (tab, rowTestId, storeName) => {
			const shown = await tabCount(page, tab);
			const rows = await readStableCount(page.locator(`[data-testid="${rowTestId}"]`));
			if (shown !== rows) {
				fail(
					`the ${tab} tab says ${shown} but its list shows ${rows} rows — ` +
						'the count and the list disagree',
				);
			}
			const stored = findStoreCount(await readStoreCounts(page), storeName);
			if (rows !== stored) {
				fail(
					`the ${tab} list shows ${rows} rows but ${storeName} holds ${stored} — ` +
						'the count does not match the data',
				);
			}
			log(`${tab}: tab says ${shown}, ${rows} rows rendered, ${stored} in ${storeName}`);
		};

		await checkCounts('highlights', 'rm-highlight-row', 'highlights');
		await page.click('[data-testid="rm-side-tab-bookmarks"]');
		await page.locator('[data-testid="rm-bookmarks-panel"]').waitFor({ state: 'visible' });
		await checkCounts('bookmarks', 'rm-bookmark-jump', 'bookmarks');

		// --- 3. The marks the reader made are the rows on screen ---
		// Read on the list that is showing: only one list is mounted at
		// a time, so asking the other one for its contents would be
		// asking for a node that is deliberately not in the document.
		await page.click('[data-testid="rm-side-tab-highlights"]');
		await page.locator('[data-testid="rm-highlights-panel"]').waitFor({ state: 'visible' });
		const quote = await page.locator('[data-testid="rm-highlight-quote"]').first().textContent();
		if (quote === null || quote.trim() === '') fail('the highlight row shows no words');
		log(`the highlights list shows the dragged words: ${JSON.stringify(quote.slice(0, 40))}`);

		await page.click('[data-testid="rm-side-tab-bookmarks"]');
		await page.locator('[data-testid="rm-bookmarks-panel"]').waitFor({ state: 'visible' });
		const bookmarkLabel = await page
			.locator('[data-testid="rm-bookmark-jump"]')
			.first()
			.textContent();
		if (bookmarkLabel === null || !bookmarkLabel.includes('第 1 ページの栞')) {
			fail(`the bookmark row does not show the name the reader gave it: ${bookmarkLabel}`);
		}
		log('the 栞 list shows the bookmark the reader named');

		// --- 4/5. Narrow: an overlay that behaves like a dialog ---
		await page.click('[data-testid="rm-side-tab-bookmarks"]');
		await page.setViewportSize(NARROW);
		await page.locator('[data-testid="rm-side-panel-dialog"]').waitFor({ state: 'visible' });
		log('narrow viewport: the panel became an overlay');

		const dialogShape = await page.evaluate(() => {
			const sheet = document.querySelector('[data-testid="rm-side-panel-dialog"]');
			const overlay = document.querySelector('[data-testid="rm-side-panel-overlay"]');
			if (sheet === null || overlay === null) return null;
			return {
				role: sheet.getAttribute('role'),
				ariaModal: sheet.getAttribute('aria-modal'),
				// The *overlay* is the layer laid over the document; the
				// sheet is positioned relative to it inside.
				position: getComputedStyle(overlay).position,
				// A sheet that fills the screen would leave no scrim to
				// tap; the panel has to stay narrower than the viewport.
				sheetWidth: sheet.getBoundingClientRect().width,
				overlayWidth: overlay.getBoundingClientRect().width,
			};
		});
		if (dialogShape === null) fail('the narrow panel rendered no sheet');
		if (dialogShape.role !== 'dialog' || dialogShape.ariaModal !== 'true') {
			fail(
				`the narrow panel is not a modal dialog: role=${dialogShape.role} ` +
					`aria-modal=${dialogShape.ariaModal}`,
			);
		}
		if (dialogShape.position !== 'absolute' && dialogShape.position !== 'fixed') {
			fail(`the narrow panel is not laid over the document: position=${dialogShape.position}`);
		}
		if (dialogShape.sheetWidth >= dialogShape.overlayWidth) {
			fail(
				`the sheet fills the viewport (${dialogShape.sheetWidth} >= ` +
					`${dialogShape.overlayWidth}), leaving no scrim to dismiss with`,
			);
		}
		log(
			`the overlay is a modal dialog laid over the document (position: ` +
				`${dialogShape.position}), ${Math.round(dialogShape.overlayWidth - dialogShape.sheetWidth)}px ` +
				'of scrim beside it',
		);

		// The scrim closes it, the way a modal does. This is also the
		// only way out while the overlay is up: it covers the header
		// toggles, which is the point of an overlay.
		await page.click('[data-testid="rm-side-panel-scrim"]', { position: { x: 10, y: 10 } });
		await page.locator('[data-testid="rm-side-panel-dialog"]').waitFor({ state: 'detached' });
		log('tapping the scrim closed the overlay');

		// Reopen through the header, and check focus really moved in.
		await page.click('[data-testid="rm-toggle-bookmarks"]');
		await page.locator('[data-testid="rm-side-panel-dialog"]').waitFor({ state: 'visible' });
		const focusInSheet = await page.evaluate(() => {
			const sheet = document.querySelector('[data-testid="rm-side-panel-dialog"]');
			return sheet?.contains(document.activeElement) === true;
		});
		if (!focusInSheet) fail('opening the narrow panel did not move focus into it');
		log('opening the overlay moved focus into the sheet');

		// Tab is contained: several presses must not escape the sheet.
		for (let press = 0; press < 8; press++) await page.keyboard.press('Tab');
		const stillInside = await page.evaluate(() => {
			const sheet = document.querySelector('[data-testid="rm-side-panel-dialog"]');
			return sheet?.contains(document.activeElement) === true;
		});
		if (!stillInside) {
			fail('Tab walked out of the overlay onto the page behind it — the panel is a trap');
		}
		log('eight Tab presses stayed inside the sheet');

		await page.keyboard.press('Escape');
		await page.locator('[data-testid="rm-side-panel-dialog"]').waitFor({ state: 'detached' });
		const focusRestored = await page.evaluate(
			() => document.activeElement?.getAttribute('data-testid') ?? null,
		);
		if (focusRestored !== 'rm-toggle-bookmarks') {
			fail(
				`Escape closed the panel but focus went to ${focusRestored ?? 'nothing'}, ` +
					'not back to the toggle that opened it',
			);
		}
		log('Escape closed it and returned focus to the toggle');

		// --- 6. A jump moves the document ---
		await page.setViewportSize(WIDE);
		await page.click('[data-testid="rm-toggle-bookmarks"]');
		await page.locator('[data-testid="rm-bookmarks-panel"]').waitFor({ state: 'visible' });
		await page.waitForFunction(
			() =>
				document
					.querySelector('[data-testid="rm-reader-scroll"]')
					?.querySelector('[data-page-index="4"]') !== null,
			undefined,
			{ timeout: 15_000 },
		);
		const before = await scrollTop(page);
		await page.click('[data-testid="rm-bookmark-jump"]');
		await page.waitForTimeout(700);
		const after = await scrollTop(page);
		if (before === after) {
			fail(`jumping the bookmark did not move the document (scrollTop stayed ${before})`);
		}
		log(`a jump moved the document: scrollTop ${before} → ${after}`);

		// --- 7. An orphan note is visible, counted, and explains itself ---
		/**
		 * The note the reader never creates: a free note whose only
		 * position was a highlight that has since been deleted. Injected
		 * into the store, then the reader re-opened so the list is
		 * loaded fresh rather than reconciled by hand.
		 */
		const orphan = await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open('readmark');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const note = await new Promise((resolve) => {
				const request = db.transaction('notes', 'readonly').objectStore('notes').getAll();
				request.onsuccess = () => resolve((request.result ?? [])[0] ?? null);
			});
			db.close();
			return note;
		});
		if (orphan === null) fail('no note row to turn into an orphan; the notes flow did not run');

		await writeRow(page, 'notes', {
			...orphan,
			id: 'orphan-note-for-smoke',
			body: '消えたハイライトへのメモ',
			highlightId: 'highlight-that-was-deleted',
		});
		await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
		await page.click('[data-testid="rm-library-row-read"]');
		await page.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await page.click('[data-testid="rm-toggle-notes"]');
		await page.locator('[data-testid="rm-notes-panel"]').waitFor({ state: 'visible' });

		const orphanShape = await page.evaluate(() => {
			const rows = [...document.querySelectorAll('[data-testid="rm-note-row"]')];
			const row = rows.find((node) => node.textContent?.includes('消えたハイライトへのメモ'));
			if (row === undefined) return null;
			return {
				rows: rows.length,
				hasJump: row.querySelector('[data-testid="rm-note-jump"]') !== null,
				notice: row.querySelector('[data-testid="rm-note-notice"]')?.textContent ?? null,
			};
		});
		if (orphanShape === null) fail('the orphan note is not on screen at all');
		if (orphanShape.hasJump) {
			fail('the orphan note offers a jump button that has nowhere to go');
		}
		if (orphanShape.notice === null || !orphanShape.notice.includes('対象なし')) {
			fail(`the orphan note does not say why it has no jump: ${orphanShape.notice}`);
		}
		log(`the orphan note is on screen with no jump button, saying 「${orphanShape.notice}」`);

		// And it is in the count, because it is a row.
		const shownNotes = await tabCount(page, 'notes');
		const noteRows = await readStableCount(page.locator('[data-testid="rm-note-row"]'));
		if (shownNotes !== noteRows) {
			fail(
				`the notes tab says ${shownNotes} but the list shows ${noteRows} rows — ` +
					'an orphan was dropped from the count',
			);
		}
		log(`the orphan is counted too: tab says ${shownNotes}, ${noteRows} rows rendered`);

		// --- 8. No console errors ---
		if (consoleErrors.length > 0) {
			fail(`console errors during the panels flow:\n${consoleErrors.join('\n')}`);
		}
		log('no console errors');

		await browser.close();
		log('panels smoke passed');
	});
}

main().catch((error) => {
	console.error('[smoke] FAILED');
	console.error(error);
	process.exit(1);
});
