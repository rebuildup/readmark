/**
 * Unit tests for the library list presentation rules.
 *
 * These are the rules the Library screen's sort control and search
 * box depend on, so they are pinned here rather than exercised
 * through the DOM: the screen test proves the wiring, this file
 * proves the ordering and matching semantics (tie-breaks, untitled
 * rows, Japanese collation, calendar-day arithmetic).
 *
 * No IndexedDB and no React: `LibraryEntry` is a plain object
 * (`Document` + its primary `DocumentSource`), so fixtures are
 * literals.
 */

import { describe, expect, it } from 'vitest';

import type {
	Document,
	DocumentId,
	DocumentSource,
	SourceFingerprint,
} from '../domain/document.ts';
import type { LibraryEntry } from '../storage/documents-repo.ts';
import {
	filterLibrary,
	formatByteSize,
	formatImportedAt,
	formatLastReadAt,
	selectVisibleLibrary,
	sortLibrary,
} from './library-list.ts';

/** Local-time constructor: the date helpers compare calendar days,
 *  so a fixture built from a UTC ISO string would move a day in
 *  non-UTC timezones and make these tests pass or fail by host TZ. */
function at(year: number, monthIndex: number, day: number, hour = 12, minute = 0): number {
	return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

let seq = 0;

function makeEntry(overrides: {
	title?: string | null;
	author?: string | null;
	importedAt: number;
	lastReadAt?: number | null;
	byteSize?: number;
	pageCount?: number;
}): LibraryEntry {
	seq += 1;
	const n = String(seq).padStart(2, '0');
	const id = `00000000-0000-4000-8000-0000000000${n}` as DocumentId;
	const metadata: { title?: string; author?: string } = {};
	if (overrides.title != null) metadata.title = overrides.title;
	if (overrides.author != null) metadata.author = overrides.author;

	const document: Document = {
		id,
		metadata,
		importedAt: overrides.importedAt,
		lastReadAt: overrides.lastReadAt ?? null,
	};

	const sourceMetadata: { pageCount?: number } = {};
	if (overrides.pageCount !== undefined) sourceMetadata.pageCount = overrides.pageCount;

	const primarySource: DocumentSource = {
		sourceFingerprint: `${n.repeat(64).slice(0, 64)}` as SourceFingerprint,
		documentId: id,
		format: 'pdf',
		byteSize: overrides.byteSize ?? 1024 * 1024,
		importedAt: overrides.importedAt,
		metadata: sourceMetadata,
	};

	return { document, primarySource };
}

function titlesOf(entries: readonly LibraryEntry[]): string[] {
	return entries.map((entry) => entry.document.metadata.title ?? '(untitled)');
}

describe('sortLibrary', () => {
	it('orders recently-read documents by lastReadAt, newest first', () => {
		const old = makeEntry({ title: 'old', importedAt: at(2026, 0, 1), lastReadAt: at(2026, 8, 1) });
		const recent = makeEntry({
			title: 'recent',
			importedAt: at(2026, 0, 2),
			lastReadAt: at(2026, 8, 20),
		});
		const middle = makeEntry({
			title: 'middle',
			importedAt: at(2026, 0, 3),
			lastReadAt: at(2026, 8, 10),
		});

		expect(titlesOf(sortLibrary([old, recent, middle], 'recently-read'))).toEqual([
			'recent',
			'middle',
			'old',
		]);
	});

	it('falls back to importedAt for documents that were never opened', () => {
		const neverReadOld = makeEntry({ title: 'never-old', importedAt: at(2026, 0, 1) });
		const neverReadNew = makeEntry({ title: 'never-new', importedAt: at(2026, 8, 1) });
		const readOnce = makeEntry({
			title: 'read',
			importedAt: at(2026, 0, 2),
			lastReadAt: at(2026, 8, 25),
		});

		// 'read' has the newest instant overall (lastReadAt beats any
		// import time), so it leads even though it was imported
		// first and the never-read rows fall back to their own
		// import time.
		expect(titlesOf(sortLibrary([neverReadOld, neverReadNew, readOnce], 'recently-read'))).toEqual([
			'read',
			'never-new',
			'never-old',
		]);
	});

	it('breaks ties on documentId so the order is stable across reloads', () => {
		const sameTime = at(2026, 8, 27);
		const first = makeEntry({ title: 'b', importedAt: sameTime });
		const second = makeEntry({ title: 'a', importedAt: sameTime });

		const once = titlesOf(sortLibrary([first, second], 'imported-newest'));
		const twice = titlesOf(sortLibrary([second, first], 'imported-newest'));

		expect(once).toEqual(twice);
	});

	it('sorts by import time for imported-newest, ignoring lastReadAt', () => {
		const newest = makeEntry({
			title: 'newest',
			importedAt: at(2026, 8, 20),
			lastReadAt: at(2026, 0, 1),
		});
		const oldest = makeEntry({
			title: 'oldest',
			importedAt: at(2026, 0, 1),
			lastReadAt: at(2026, 8, 25),
		});

		expect(titlesOf(sortLibrary([oldest, newest], 'imported-newest'))).toEqual([
			'newest',
			'oldest',
		]);
	});

	it('sorts titles with a Japanese collator instead of code points', () => {
		// 'apple' vs 'Banana' differ only by case; a plain `<`
		// comparison puts the uppercase one first. The `ja` collator
		// ignores case and orders latin before kana (CLDR root
		// order), which is what a Japanese reader expects from a
		// mixed Japanese / latin shelf.
		const upper = makeEntry({ title: 'Banana', importedAt: at(2026, 0, 1) });
		const lower = makeEntry({ title: 'apple', importedAt: at(2026, 0, 2) });
		const japanese = makeEntry({ title: 'あおぞら', importedAt: at(2026, 0, 3) });

		expect(titlesOf(sortLibrary([upper, lower, japanese], 'title-asc'))).toEqual([
			'apple',
			'Banana',
			'あおぞら',
		]);
	});

	it('sorts untitled documents last in title order', () => {
		const untitled = makeEntry({ importedAt: at(2026, 8, 27) });
		const titled = makeEntry({ title: 'zzz', importedAt: at(2026, 0, 1) });

		expect(titlesOf(sortLibrary([untitled, titled], 'title-asc'))).toEqual(['zzz', '(untitled)']);
	});

	it('does not mutate its input', () => {
		const a = makeEntry({ title: 'a', importedAt: at(2026, 0, 1) });
		const b = makeEntry({ title: 'b', importedAt: at(2026, 8, 1) });
		const input = [a, b];
		const snapshot = [...input];

		sortLibrary(input, 'imported-newest');

		expect(input).toEqual(snapshot);
	});
});

describe('filterLibrary', () => {
	const entries = [
		makeEntry({ title: '吾輩は猫である', author: '夏目漱石', importedAt: at(2026, 0, 1) }),
		makeEntry({ title: '雪国', author: '川端康成', importedAt: at(2026, 0, 2) }),
		makeEntry({ title: 'undefined title', importedAt: at(2026, 0, 3) }),
	];

	it('matches a title substring', () => {
		expect(filterLibrary(entries, '猫')).toHaveLength(1);
	});

	it('matches an author substring', () => {
		expect(titlesOf(filterLibrary(entries, '川端'))).toEqual(['雪国']);
	});

	it('ignores case for latin text', () => {
		expect(filterLibrary(entries, 'UNDEFINED')).toHaveLength(1);
	});

	it('trims the query and treats whitespace-only as no filter', () => {
		expect(filterLibrary(entries, '   雪国  ')).toHaveLength(1);
		expect(filterLibrary(entries, '   ')).toHaveLength(entries.length);
	});

	it('returns nothing when the query matches no row', () => {
		expect(filterLibrary(entries, '存在しない書名')).toHaveLength(0);
	});

	it('does not throw on entries without title or author metadata', () => {
		const sparse = [makeEntry({ importedAt: at(2026, 0, 1) })];
		expect(filterLibrary(sparse, 'x')).toHaveLength(0);
		expect(filterLibrary(sparse, '')).toHaveLength(1);
	});
});

describe('selectVisibleLibrary', () => {
	it('applies the filter and then the sort', () => {
		const a = makeEntry({ title: 'alpha', importedAt: at(2026, 0, 1), lastReadAt: at(2026, 0, 1) });
		const b = makeEntry({ title: 'alps', importedAt: at(2026, 0, 2), lastReadAt: at(2026, 0, 5) });
		const c = makeEntry({ title: 'beta', importedAt: at(2026, 0, 3), lastReadAt: at(2026, 0, 9) });

		const visible = selectVisibleLibrary([a, b, c], { search: 'al', sort: 'recently-read' });

		expect(titlesOf(visible)).toEqual(['alps', 'alpha']);
	});

	it('switches to title order when asked, keeping the same filter', () => {
		const a = makeEntry({ title: 'alpha', importedAt: at(2026, 0, 1), lastReadAt: at(2026, 0, 1) });
		const b = makeEntry({ title: 'alps', importedAt: at(2026, 0, 2), lastReadAt: at(2026, 0, 5) });

		expect(titlesOf(selectVisibleLibrary([a, b], { search: 'al', sort: 'title-asc' }))).toEqual([
			'alpha',
			'alps',
		]);
	});
});

describe('formatByteSize', () => {
	it('reports bytes below 1 KB', () => {
		expect(formatByteSize(0)).toBe('0 B');
		expect(formatByteSize(912)).toBe('912 B');
	});

	it('reports kilobytes with one decimal below 1 MB', () => {
		expect(formatByteSize(1024)).toBe('1.0 KB');
		expect(formatByteSize(1024 * 1024 - 1)).toBe('1024.0 KB');
	});

	it('reports megabytes with one decimal at and above 1 MB', () => {
		expect(formatByteSize(1024 * 1024)).toBe('1.0 MB');
		expect(formatByteSize(12_400_000)).toBe('11.8 MB');
	});
});

describe('formatImportedAt / formatLastReadAt', () => {
	const now = at(2026, 8, 27, 15);

	it('uses calendar days, not elapsed hours, for 今日 / 昨日', () => {
		// 23:50 yesterday → 00:10 today is under 15 minutes elapsed
		// but a different calendar day.
		expect(formatImportedAt(at(2026, 8, 26, 23, 50), now)).toBe('昨日');
	});

	it('counts days for the last week and switches to a date after that', () => {
		expect(formatImportedAt(at(2026, 8, 24), now)).toBe('3 日前');
		// Six days back is still relative; a week or more switches to
		// an absolute date, because "7 日前" stops being useful.
		expect(formatImportedAt(at(2026, 8, 21), now)).toBe('6 日前');
		expect(formatImportedAt(at(2026, 8, 20), now)).toBe('2026/9/20');
		expect(formatImportedAt(at(2026, 0, 5), now)).toBe('2026/1/5');
	});

	it('reports 今日 for the same calendar day', () => {
		expect(formatImportedAt(at(2026, 8, 27, 1), now)).toBe('今日');
		expect(formatLastReadAt(at(2026, 8, 27, 23), now)).toBe('今日');
	});

	it('reports 未閲覧 for a document that was never opened', () => {
		expect(formatLastReadAt(null, now)).toBe('未閲覧');
	});
});
