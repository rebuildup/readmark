/**
 * readmark — library list presentation logic (pure).
 *
 * The Library screen shows one row per `LibraryEntry` (a Document
 * joined with its primary source). Sorting and filtering live here
 * rather than in the screen so the rules are unit-testable without a
 * DOM and so the same rules can serve a future list-in-a-sidepanel
 * without being copy-pasted.
 *
 * Rules that are product decisions, not implementation details:
 *
 *   - `recently-read` is the default. Reading state is the thing a
 *     reader opens readmark for; import order is not.
 *   - A never-opened document sorts by its import time under
 *     `recently-read`, i.e. "the next thing I was going to read is
 *     the one I just added".
 *   - Ties break on `documentId` so the order is total and stable
 *     across reloads. Without that, a same-millisecond import pair
 *     (or a same-day import with no clock resolution) would shuffle
 *     between renders.
 *   - Title order uses `Intl.Collator('ja')` because the library is
 *     expected to hold Japanese titles; a plain `<` comparison
 *     sorts kana by code point, which is not what a reader expects.
 *     Untitled documents sort last in every mode — they are the
 *     "needs attention" rows, not the reading list.
 *
 * No React, no DOM, no IndexedDB: this module is a projection of
 * data the screen already holds.
 */

import type { LibraryEntry } from '../storage/documents-repo.ts';

/** Sort modes offered by the Library screen. `recently-read` is the
 *  default; the other two are explicit user choices. */
export const LIBRARY_SORTS = ['recently-read', 'imported-newest', 'title-asc'] as const;

export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const DEFAULT_LIBRARY_SORT: LibrarySort = 'recently-read';

/** Japanese labels for the sort control. Kept next to the union so
 *  adding a mode cannot leave the UI without a label. */
export const LIBRARY_SORT_LABELS: Readonly<Record<LibrarySort, string>> = {
	'recently-read': '最近読んだ順',
	'imported-newest': '追加した順',
	'title-asc': 'タイトル昇順',
};

export interface LibraryQuery {
	/** Free-text filter over title and author. Case-insensitive,
	 *  whitespace-trimmed, empty means "no filter". */
	readonly search: string;
	readonly sort: LibrarySort;
}

/** Sort by `sort`. Returns a new array; the input is untouched. */
export function sortLibrary(
	entries: readonly LibraryEntry[],
	sort: LibrarySort,
): readonly LibraryEntry[] {
	const sorted = [...entries];
	switch (sort) {
		case 'recently-read':
			sorted.sort(compareRecentlyRead);
			break;
		case 'imported-newest':
			sorted.sort(compareImportedNewest);
			break;
		case 'title-asc':
			sorted.sort(compareTitleAsc);
			break;
	}
	return sorted;
}

/** Filter by `search` over title and author. Returns a new array;
 *  the input is untouched. */
export function filterLibrary(
	entries: readonly LibraryEntry[],
	search: string,
): readonly LibraryEntry[] {
	const needle = search.trim().toLocaleLowerCase();
	if (needle === '') return [...entries];
	return entries.filter((entry) => matchesSearch(entry, needle));
}

/** Filter, then sort — the exact pipeline the screen renders.
 *  Order matters: sorting a smaller array is cheaper, and the
 *  visible count is computed after filtering anyway. */
export function selectVisibleLibrary(
	entries: readonly LibraryEntry[],
	query: LibraryQuery,
): readonly LibraryEntry[] {
	return sortLibrary(filterLibrary(entries, query.search), query.sort);
}

/** Documented export so tests and future callers can assert the
 *  tie-break contract directly. */
function matchesSearch(entry: LibraryEntry, needle: string): boolean {
	const title = entry.document.metadata.title ?? '';
	const author = entry.document.metadata.author ?? '';
	return title.toLocaleLowerCase().includes(needle) || author.toLocaleLowerCase().includes(needle);
}

function compareRecentlyRead(a: LibraryEntry, b: LibraryEntry): number {
	// `lastReadAt ?? importedAt` is the "when did I last touch this
	// book" instant. Never-read documents fall back to import time.
	const aTime = a.document.lastReadAt ?? a.document.importedAt;
	const bTime = b.document.lastReadAt ?? b.document.importedAt;
	if (aTime !== bTime) return bTime - aTime;
	return a.document.id.localeCompare(b.document.id);
}

function compareImportedNewest(a: LibraryEntry, b: LibraryEntry): number {
	if (a.document.importedAt !== b.document.importedAt) {
		return b.document.importedAt - a.document.importedAt;
	}
	return a.document.id.localeCompare(b.document.id);
}

const titleCollator = new Intl.Collator('ja', { sensitivity: 'base', numeric: true });

function compareTitleAsc(a: LibraryEntry, b: LibraryEntry): number {
	const aTitle = a.document.metadata.title;
	const bTitle = b.document.metadata.title;
	if (aTitle === undefined && bTitle === undefined) {
		return a.document.id.localeCompare(b.document.id);
	}
	// Untitled documents sort last regardless of direction, so
	// "import the missing metadata" rows are where the eye lands
	// last, not at the top of the alphabet.
	if (aTitle === undefined) return 1;
	if (bTitle === undefined) return -1;
	const byTitle = titleCollator.compare(aTitle, bTitle);
	if (byTitle !== 0) return byTitle;
	return a.document.id.localeCompare(b.document.id);
}

// --- display helpers -----------------------------------------------------
//
// Pure string formatting for the list rows. They live here (not in
// the screen) so the unit tests can pin the exact strings the user
// sees, including the byte-size rounding.

const KB = 1024;
const MB = KB * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Byte size as a short human string: `912 B` / `248.0 KB` /
 *  `12.4 MB`. PDF sizes span three orders of magnitude between a
 *  single-page form and a 400-page scan, so a single unit would
 *  render the small ones as `0.0 MB`. */
export function formatByteSize(bytes: number): string {
	if (bytes < KB) return `${Math.max(0, Math.round(bytes))} B`;
	if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
	return `${(bytes / MB).toFixed(1)} MB`;
}

/** "When was this document added", relative to `now` in local time:
 *  `今日` / `昨日` / `3 日前` / `2026/9/14`. `now` is a parameter so
 *  the output is deterministic under test. */
export function formatImportedAt(importedAt: number, now: number): string {
	const days = wholeDaysBetween(importedAt, now);
	if (days === 0) return '今日';
	if (days === 1) return '昨日';
	if (days < 7) return `${days} 日前`;
	return formatDate(importedAt);
}

/** "When did I last read this", relative to `now`. `null` means the
 *  document has never been opened — shown as `未閲覧` so the
 *  `recently-read` order is legible instead of looking arbitrary.
 *
 *  The wording stops at "last opened": readmark stores no
 *  finished-reading state, so no surface may render this as "read
 *  through". */
export function formatLastReadAt(lastReadAt: number | null, now: number): string {
	if (lastReadAt === null) return '未閲覧';
	const days = wholeDaysBetween(lastReadAt, now);
	if (days === 0) return '今日';
	if (days === 1) return '昨日';
	if (days < 7) return `${days} 日前`;
	return formatDate(lastReadAt);
}

/** Whole local calendar days between two instants. A document read
 *  at 23:50 and viewed at 00:10 the next morning is "昨日", not
 *  "0 日前" — hence calendar-day arithmetic rather than ms / DAY_MS. */
function wholeDaysBetween(from: number, to: number): number {
	const fromDay = startOfLocalDay(from);
	const toDay = startOfLocalDay(to);
	return Math.round((toDay - fromDay) / DAY_MS);
}

function startOfLocalDay(timestamp: number): number {
	const date = new Date(timestamp);
	date.setHours(0, 0, 0, 0);
	return date.getTime();
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	const month = date.getMonth() + 1;
	const day = date.getDate();
	return `${date.getFullYear()}/${month}/${day}`;
}
