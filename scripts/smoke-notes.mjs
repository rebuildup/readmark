#!/usr/bin/env bun
/**
 * readmark — one-shot browser smoke for #8 notes.
 *
 * NOT a permanent E2E harness. Run once with:
 *
 *   bun scripts/smoke-notes.mjs
 *
 * What it verifies, against the real built app in headless Chromium:
 *
 *   1. A real mouse drag across the text layer produces a selection,
 *      and the selection toolbar offers メモ.
 *   2. Writing a note on that selection marks the words first and then
 *      writes a `notes` row carrying the highlight's id — read back
 *      out of IndexedDB, because a row can be missing while the panel
 *      still looks right.
 *   3. **Newlines survive the round trip.** The body is typed with a
 *      blank line and a trailing newline, and the stored row has to
 *      come back byte-identical. This is the acceptance criterion that
 *      fails silently: a note that comes back as one run-on line still
 *      looks like a feature.
 *   4. **Newlines survive the display too.** `getComputedStyle` on the
 *      rendered body has to report `pre-wrap`, and the element's height
 *      has to be more than one line tall. The unit test asserts the
 *      rule is in `src/styles.css`; only a browser can say it was
 *      applied.
 *   5. Editing rewrites the body, leaves the highlight link and the
 *      page alone, and the panel shows the new text with its breaks.
 *   6. A note with no highlight at all is distinguishable from one with
 *      a highlight: it is in the same list, and asking IndexedDB for
 *      the notes of a highlight id that does not exist returns none.
 *   7. Jumping from a note on a highlight lands on the highlight's
 *      page from somewhere else in the document.
 *   8. Re-opening the document keeps the note: the panel lists it, the
 *      body still has its line breaks, and the stored anchor is
 *      resolved against the file again.
 *   9. Deleting asks first, and the confirmed delete removes the row.
 *  10. No console errors, and no note body in any of them.
 *
 * Why this exists rather than a unit test: happy-dom has no layout, no
 * real Selection, no computed styles and no canvas. Every claim above
 * is about something the browser computes.
 *
 * Preview server, browser launch and store counting come from
 * `scripts/smoke-harness.mjs`.
 */

import { setTimeout as wait } from 'node:timers/promises';
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

/**
 * The body this smoke writes.
 *
 * Three lines, a blank one between the first two and a trailing
 * newline — every shape a `white-space: normal` element or a
 * trim-on-save would quietly destroy. A single line would pass under
 * both bugs.
 */
const NOTE_BODY = 'readmark のメモ 1行目\n\n3行目は空行のあと\n';
/** What an edit writes: still multi-line, so the edit path is tested
 *  for the same property as the create path rather than assumed. */
const EDITED_BODY = '書き直した\n2行目\n';
/** A body with no highlight behind it — a note about the book. */
const FREE_BODY = 'free note\nwith a break\n';

async function makeFixturePdf() {
	const pdf = await PDFDocument.create();
	for (let index = 1; index <= PAGE_COUNT; index++) {
		const page = pdf.addPage([420, 900]);
		page.drawText(`readmark page ${index} of ${PAGE_COUNT}`, { x: 40, y: 520, size: 18 });
		page.drawText(`selectable text for the notes smoke on page ${index}`, {
			x: 40,
			y: 480,
			size: 12,
		});
	}
	pdf.setTitle('readmark notes smoke');
	pdf.setAuthor('readmark smoke');
	return await pdf.save();
}

/** Every `notes` row, read straight out of IndexedDB. */
async function readNoteRows(page) {
	return await page.evaluate(async () => {
		const db = await new Promise((resolve, reject) => {
			const request = indexedDB.open('readmark');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const rows = await new Promise((resolve) => {
			const request = db.transaction('notes', 'readonly').objectStore('notes').getAll();
			request.onsuccess = () => resolve(request.result ?? []);
			request.onerror = () => resolve([]);
		});
		db.close();
		return rows;
	});
}

/** The notes whose `highlightId` is a non-empty string, i.e. the ones
 *  that are in the `highlightId` index at all. IndexedDB does not index
 *  a null key, so a note with no highlight is simply absent from it —
 *  and this is the browser-level statement of that. */
async function readHighlightIndexedNotes(page, highlightId) {
	return await page.evaluate(async (id) => {
		const db = await new Promise((resolve, reject) => {
			const request = indexedDB.open('readmark');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const rows = await new Promise((resolve) => {
			const store = db.transaction('notes', 'readonly').objectStore('notes');
			const request = store.index('highlightId').getAll(id);
			request.onsuccess = () => resolve(request.result ?? []);
			request.onerror = () => resolve([]);
		});
		db.close();
		return rows;
	}, highlightId);
}

/** Every `highlights` row. A note's target, so a dangling link is
 *  visible as a fact rather than inferred. */
async function readHighlightRows(page) {
	return await page.evaluate(async () => {
		const db = await new Promise((resolve, reject) => {
			const request = indexedDB.open('readmark');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const rows = await new Promise((resolve) => {
			const request = db.transaction('highlights', 'readonly').objectStore('highlights').getAll();
			request.onsuccess = () => resolve(request.result ?? []);
			request.onerror = () => resolve([]);
		});
		db.close();
		return rows;
	});
}

/**
 * Drag a real selection across page 1's text layer and return the
 * selected text.
 *
 * The span is *revealed* first, not just measured. The reader opens at
 * fit-width, so a page is often several screens tall and the first line
 * of text sits far below the fold — and `page.mouse.move` to a
 * coordinate outside the viewport presses nothing, so the drag would
 * silently select nothing and the smoke would report a broken text
 * layer when the text layer is fine. What is under test is "the text
 * layer is selectable", and that has to be tested on text a reader
 * could actually see and drag across.
 *
 * The drag then covers the whole measured span: a fixed pixel distance
 * covers a whole word at one zoom and half of one at another, so the
 * smoke would be testing the zoom rather than the text.
 */
async function dragSelectFirstPageText(page) {
	const revealSpan = async () =>
		await page.evaluate(() => {
			const host = document.querySelector('[data-page-index="1"]');
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (host === null || scroller === null) return false;
			const headerBottom =
				document.querySelector('.rm-reader-header')?.getBoundingClientRect().bottom ?? 0;
			for (const candidate of host.querySelectorAll('.rm-text-layer span')) {
				const rect = candidate.getBoundingClientRect();
				if (rect.width < 4 || rect.height < 4) continue;
				if (rect.top < headerBottom) continue;
				const box = scroller.getBoundingClientRect();
				if (rect.top >= box.top && rect.bottom <= box.bottom) return true;
				// The span itself, not the host and not a computed
				// delta: at a rotated viewport a delta lands nowhere
				// useful and clamps to 0 when the span is already past.
				candidate.scrollIntoView({ block: 'center' });
				if (candidate.getBoundingClientRect().top < headerBottom) scroller.scrollTop = 0;
				return true;
			}
			return false;
		});

	const measureSpan = async () =>
		await page.evaluate(() => {
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			const header = document.querySelector('.rm-reader-header');
			if (scroller === null || header === null)
				return { span: null, headerBottom: 0, spanCount: 0 };
			const headerBottom = header.getBoundingClientRect().bottom;
			const spans = [...document.querySelectorAll('[data-page-index="1"] .rm-text-layer span')];
			const box = scroller.getBoundingClientRect();
			for (const candidate of spans) {
				const rect = candidate.getBoundingClientRect();
				if (rect.width < 4 || rect.height < 4) continue;
				if (rect.top < headerBottom + 4) continue;
				if (rect.top < box.top || rect.bottom > box.bottom) continue;
				return {
					span: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
					headerBottom,
					spanCount: spans.length,
				};
			}
			return { span: null, headerBottom, spanCount: spans.length };
		});

	await revealSpan();
	let measured = await measureSpan();
	if (measured.span === null) {
		await page.locator('[data-page-index="1"]').scrollIntoViewIfNeeded();
		await wait(150);
		measured = await measureSpan();
	}
	if (measured.span === null) {
		fail(
			`no text-layer span on page 1 is both inside the scroller and clear of the header ` +
				`(header ends at ${measured.headerBottom}, ${measured.spanCount} spans) — ` +
				`the drag would test the chrome rather than the page`,
		);
	}
	const box = measured.span;
	await page.evaluate(() => window.getSelection()?.removeAllRanges());
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + 1, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width - 1, y, { steps: 8 });
	await page.mouse.up();
	const selected = await page.evaluate(() => (window.getSelection()?.toString() ?? '').trim());
	if (selected === '') fail('the drag produced an empty selection — it hit no text');
	return selected;
}

/** The rendered body elements and how the browser is actually laying
 *  their text out. */
async function readRenderedBodies(page) {
	return await page.evaluate(() => {
		return Array.from(document.querySelectorAll('[data-testid="rm-note-body"]')).map((node) => {
			const style = getComputedStyle(node);
			const rect = node.getBoundingClientRect();
			const lineHeight = Number.parseFloat(style.lineHeight);
			return {
				text: node.textContent ?? '',
				whiteSpace: style.whiteSpace,
				height: rect.height,
				lines: Number.isFinite(lineHeight) && lineHeight > 0 ? rect.height / lineHeight : 0,
			};
		});
	});
}

/**
 * Show the notes panel, clicking the header toggle only if it is not
 * already up.
 *
 * The panel choice lives in the UI store, which outlives the reader
 * route: leaving a document with the notes panel open and coming back
 * finds it open. A smoke that clicks the toggle unconditionally would
 * be asserting "the panel is closed", which is a claim about the
 * toggle, not about the notes.
 */
async function showNotesPanel(page) {
	if ((await page.locator('[data-testid="rm-notes-panel"]').count()) > 0) return;
	await page.click('[data-testid="rm-toggle-notes"]');
	await page.locator('[data-testid="rm-notes-panel"]').waitFor({ state: 'visible' });
}

async function main() {
	await withPreview(async () => {
		log('preview server is up');
		const browser = await launchBrowser();
		const page = await browser.newPage();

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
				name: 'notes-smoke.pdf',
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

		// --- 1. A real drag, and the toolbar offers メモ ---
		const selected = await dragSelectFirstPageText(page);
		log(`dragged a selection: ${JSON.stringify(selected)}`);
		await page.locator('[data-testid="rm-selection-toolbar"]').waitFor({ state: 'visible' });
		await page.locator('[data-testid="rm-selection-note"]').waitFor({ state: 'visible' });
		log('selection toolbar offers メモ');

		// --- 2. Writing the note marks the words, then writes the row ---
		const highlightsBefore = (await readHighlightRows(page)).length;
		await page.click('[data-testid="rm-selection-note"]');
		await page.locator('[data-testid="rm-note-editor"]').waitFor({ state: 'visible' });
		await page.locator('[data-testid="rm-notes-panel"]').waitFor({ state: 'visible' });
		log('the notes panel opened with an editor');

		await page.locator('[data-testid="rm-note-body-input"]').fill(NOTE_BODY);
		await page.click('[data-testid="rm-note-save"]');
		await page.locator('[data-testid="rm-notes-list"]').waitFor({ state: 'visible' });

		const stored = await readStableCount(page.locator('[data-testid="rm-note-row"]'));
		if (stored !== 1) fail(`expected one note in the panel, found ${stored}`);

		const highlightsAfter = await readHighlightRows(page);
		if (highlightsAfter.length !== highlightsBefore + 1) {
			fail(
				`the selection was not marked: highlights went ${highlightsBefore} → ` +
					`${highlightsAfter.length}, so the note would be about nothing`,
			);
		}
		const highlightId = highlightsAfter[0].id;
		const notes = await readNoteRows(page);
		if (notes.length !== 1) fail(`expected one notes row, found ${notes.length}`);
		const note = notes[0];
		if (note.highlightId !== highlightId) {
			fail(`the note points at ${note.highlightId}, not at the highlight ${highlightId}`);
		}
		log(`stored a notes row on highlight ${highlightId}`);

		// --- 3. Newlines survive the round trip ---
		if (note.body !== NOTE_BODY) {
			fail(
				`the stored body is not what was typed.\n  expected ${JSON.stringify(NOTE_BODY)}` +
					`\n  actual   ${JSON.stringify(note.body)}`,
			);
		}
		log('the stored body kept its blank line and its trailing newline');

		// --- 4. Newlines survive the display ---
		const rendered = await readRenderedBodies(page);
		if (rendered.length !== 1) fail(`expected one rendered body, found ${rendered.length}`);
		const body = rendered[0];
		if (body.whiteSpace !== 'pre-wrap') {
			fail(`the body element computes white-space: ${body.whiteSpace}, not pre-wrap`);
		}
		if (body.text !== NOTE_BODY) {
			fail(`the rendered body is not the stored body: ${JSON.stringify(body.text)}`);
		}
		// Three line boxes, and the threshold is the interesting part.
		//
		// A `white-space: normal` element renders this exact text in
		// exactly ONE, so anything above 1.5 proves the breaks are
		// being shown. It is not 4: per CSS Text, a preserved segment
		// break at the very end of the line is *hanging* — it does not
		// create a further line box — so the trailing newline costs no
		// height, and expecting 4 would be asserting a browser bug.
		// The trailing newline is still in the stored body, which is
		// checked above; what is checked here is that it is not what
		// the reader sees as a fourth line.
		if (body.lines < 2.5) {
			fail(
				`the body rendered in ${body.lines.toFixed(2)} line-heights; ` +
					`its line breaks are not being shown`,
			);
		}
		if (body.lines > 3.5) {
			fail(`the body rendered in ${body.lines.toFixed(2)} line-heights, expected 3`);
		}
		log(`the body renders in ${body.lines.toFixed(2)} line-heights, white-space: pre-wrap`);

		// --- 5. Editing rewrites the body and nothing else ---
		await page.click('[data-testid="rm-note-edit"]');
		await page.locator('[data-testid="rm-note-body-input"]').waitFor({ state: 'visible' });
		await page.locator('[data-testid="rm-note-body-input"]').fill(EDITED_BODY);
		await page.click('[data-testid="rm-note-save"]');
		await page.locator('[data-testid="rm-note-editor"]').waitFor({ state: 'hidden' });

		const edited = (await readNoteRows(page))[0];
		if (edited.body !== EDITED_BODY) {
			fail(`the edit stored ${JSON.stringify(edited.body)}, not ${JSON.stringify(EDITED_BODY)}`);
		}
		if (edited.highlightId !== highlightId) fail('the edit dropped the highlight link');
		if (edited.pageIndex !== note.pageIndex) {
			fail(`the edit moved the note from page ${note.pageIndex} to ${edited.pageIndex}`);
		}
		log('an edit rewrote the body and left the position and the link alone');

		// --- 6. A free note is distinguishable from one on a highlight ---
		await page.click('[data-testid="rm-note-create"]');
		await page.locator('[data-testid="rm-note-body-input"]').waitFor({ state: 'visible' });
		await page.locator('[data-testid="rm-note-body-input"]').fill(FREE_BODY);
		await page.click('[data-testid="rm-note-save"]');
		await page.locator('[data-testid="rm-note-editor"]').waitFor({ state: 'hidden' });

		const afterFree = await readNoteRows(page);
		if (afterFree.length !== 2) fail(`expected two notes, found ${afterFree.length}`);
		const freeNote = afterFree.find((row) => row.kind === 'free');
		if (freeNote === undefined) fail('the free note was not stored as kind=free');
		if (freeNote.highlightId !== null) {
			fail(`a note with no highlight stored highlightId=${JSON.stringify(freeNote.highlightId)}`);
		}
		// The point of modelling absence as absence: the free note is
		// NOT in the highlightId index, so a query for a highlight
		// cannot return it.
		const indexed = await readHighlightIndexedNotes(page, highlightId);
		if (indexed.length !== 1 || indexed[0].id !== edited.id) {
			fail(
				`the highlightId index returned ${indexed.length} rows for ${highlightId}; ` +
					`expected only the note on that highlight`,
			);
		}
		const forNothing = await readHighlightIndexedNotes(page, 'no-such-highlight');
		if (forNothing.length !== 0) fail('a highlight that does not exist still has notes');
		// And the free note has no jump, because there is nowhere to go.
		const jumps = await page.locator('[data-testid="rm-note-jump"]').count();
		if (jumps !== 1)
			fail(`expected one jumpable note, found ${jumps} (the free note must have none)`);
		log('a note with no highlight is stored as absence and offers no jump');

		// --- 7. Jumping from a note lands on the highlight's page ---
		await page.evaluate(() => {
			const scroller = document.querySelector('[data-testid="rm-reader-scroll"]');
			if (scroller !== null) scroller.scrollTop = 0;
		});
		await page.locator('[data-testid="rm-reader-scroll"]').hover();
		await page.mouse.wheel(0, 2500);
		await page.locator('[data-testid="rm-reader-scroll"]').evaluate((scroller) => {
			return new Promise((resolve) => {
				if (scroller.scrollTop > 0) {
					resolve();
					return;
				}
				const started = Date.now();
				const poll = setInterval(() => {
					if (scroller.scrollTop > 0 || Date.now() - started > 5_000) {
						clearInterval(poll);
						resolve();
					}
				}, 50);
			});
		});
		const beforeJump = await page
			.locator('[data-testid="rm-reader-scroll"]')
			.evaluate((scroller) => scroller.scrollTop);
		if (beforeJump <= 0)
			fail('the reader did not scroll away from the top; the jump proves nothing');

		await page.click('[data-testid="rm-note-jump"]');
		await page.locator('[data-testid="rm-reader-scroll"]').evaluate((scroller, from) => {
			return new Promise((resolve) => {
				if (scroller.scrollTop < from - 1) {
					resolve();
					return;
				}
				const started = Date.now();
				const poll = setInterval(() => {
					if (scroller.scrollTop < from - 1 || Date.now() - started > 5_000) {
						clearInterval(poll);
						resolve();
					}
				}, 50);
			});
		}, beforeJump);
		const afterJump = await page
			.locator('[data-testid="rm-reader-scroll"]')
			.evaluate((scroller) => scroller.scrollTop);
		if (afterJump >= beforeJump) {
			fail(`jumping from the note did not move the reader (${beforeJump} → ${afterJump})`);
		}
		const indicator = await page.locator('[data-testid="rm-reader-page-indicator"]').textContent();
		log(
			`jumped from the note: scrollTop ${beforeJump} → ${afterJump}, page indicator ${indicator}`,
		);

		// --- 8. Re-opening keeps the note and re-resolves its anchor ---
		await page.click('[data-testid="rm-reader-back"]');
		await page.locator('[data-testid="rm-library-row-read"]').waitFor({ state: 'visible' });
		await page.click('[data-testid="rm-library-row-read"]');
		await page.locator('[data-testid="rm-reader-toolbar"]').waitFor({ state: 'visible' });
		await showNotesPanel(page);
		await page.locator('[data-testid="rm-notes-list"]').waitFor({ state: 'visible' });

		const afterReopen = await readStableCount(page.locator('[data-testid="rm-note-row"]'));
		if (afterReopen !== 2) fail(`re-opening showed ${afterReopen} notes, expected 2`);

		const reopenedBodies = await readRenderedBodies(page);
		const reopenedEdited = reopenedBodies.find((node) => node.text === EDITED_BODY);
		if (reopenedEdited === undefined) {
			fail(
				`the edited note did not come back with its line breaks: ` +
					`${JSON.stringify(reopenedBodies.map((node) => node.text))}`,
			);
		}
		if (reopenedEdited.whiteSpace !== 'pre-wrap') {
			fail(`after re-opening the body computes white-space: ${reopenedEdited.whiteSpace}`);
		}
		// The anchor was resolved against the file again, and the
		// refreshed geometry is what is on disk. A note whose position
		// does not survive a re-open is a note pointing at nothing.
		const reopenedRow = (await readNoteRows(page)).find((row) => row.id === edited.id);
		if (reopenedRow === undefined) fail('the edited note is not on disk after re-opening');
		if (reopenedRow.anchor === null || reopenedRow.anchor === undefined) {
			fail('the note lost its anchor across a re-open');
		}
		if (
			reopenedRow.anchor.format !== 'pdf' ||
			typeof reopenedRow.anchor.payload !== 'object' ||
			!Array.isArray(reopenedRow.anchor.payload.rects) ||
			reopenedRow.anchor.payload.rects.length === 0
		) {
			fail('the stored anchor is not a usable PDF anchor after re-opening');
		}
		log('re-opening kept both notes, with their line breaks and their anchors');

		// --- 9. Deleting asks first, and the confirmed delete removes the row ---
		await page.click('[data-testid="rm-note-delete"]');
		await page.locator('[data-testid="rm-dialog-confirm"]').waitFor({ state: 'visible' });
		if (findStoreCount(await readStoreCounts(page), 'notes') !== 2) {
			fail('the store changed before the deletion was confirmed');
		}
		await page.click('[data-testid="rm-dialog-confirm"]');
		await page.locator('[data-testid="rm-dialog-confirm"]').waitFor({ state: 'hidden' });
		const remaining = await readStableCount(page.locator('[data-testid="rm-note-row"]'));
		if (remaining !== 1) fail(`after the delete ${remaining} notes are listed, expected 1`);
		if (findStoreCount(await readStoreCounts(page), 'notes') !== 1) {
			fail('the confirmed delete left the row on disk');
		}
		log('the confirmed delete removed the row');

		// --- 10. No console errors, and no note body in any of them ---
		const leaked = consoleErrors.filter((text) =>
			[NOTE_BODY, EDITED_BODY, FREE_BODY].some((body) => text.includes(body.trim())),
		);
		if (leaked.length > 0) {
			fail(`a note body reached the console:\n${leaked.join('\n')}`);
		}
		if (consoleErrors.length > 0) {
			fail(`console errors during the notes flow:\n${consoleErrors.join('\n')}`);
		}
		log('no console errors, and no note body in any of them');

		await browser.close();
		log('notes smoke passed');
	});
}

main().catch((error) => {
	console.error('[smoke] FAILED');
	console.error(error);
	process.exit(1);
});
