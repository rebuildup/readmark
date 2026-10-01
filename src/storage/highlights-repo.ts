/**
 * readmark — highlights repository.
 *
 * A highlight is "the reader marked these words on this page". Unlike a
 * bookmark it cannot exist without an anchor: there is no text region
 * to paint without one, so a highlight with `anchor: null` would be a
 * row that says a thing happened and cannot be shown.
 *
 * The identity rules are the bookmark's (ADR-0002): rows are keyed by
 * `documentId` **and** `sourceFingerprint`, because a position in a
 * file means nothing in a re-encoded copy of it. Two books read from
 * two sources keep two highlight lists.
 *
 * Ordering is by page, then by creation. Page first because that is
 * the order a painter needs — it walks pages in reading order and
 * paints each page's highlights together — and a list ordered by time
 * would make a reader's own later mark on an earlier page arrive after
 * the pages that follow it. Within a page, creation order is the only
 * order that means anything.
 *
 * ## The one mutation a resolver may cause
 *
 * `replaceHighlightAnchor` is the write-back for
 * `ResolvedAnchor.updatedAnchor`, and it is deliberately the *only*
 * mutation on this table that does not come from a reader action. It
 * takes an `Anchor` it does not read: the payload is the format's, the
 * resolver produced it, and this repository's job is to store it
 * unchanged. A repository that inspected the payload to "check" it
 * would be the format-specific reading that ADR-0007 forbids outside
 * `reader/<format>/`, and it would break the first time a second format
 * stored something PDF-shaped was not.
 *
 * The other rule that goes with it: `resolveAnchor` answering `null`
 * is not a reason to call anything here. Deleting a highlight is a user
 * action.
 */

import type { Anchor } from '../domain/annotation/index.ts';
import type { DocumentId, SourceFingerprint } from '../domain/document.ts';
import type { Highlight, PageIndex } from '../domain/reading-state.ts';
import { getDb } from './db.ts';
import type { HighlightScope } from './scope.ts';

/** Re-exported so callers can keep importing from `./highlights-repo.ts`
 *  without changing their call sites. */
export type { HighlightScope } from './scope.ts';

/**
 * The colour a new highlight is stored with, as a name rather than a
 * CSS value.
 *
 * A name, because a stored hex is a stored *theme decision*: change the
 * palette and every existing highlight is pinned to a colour the app no
 * longer uses, with no way to tell which ones. A name the painter
 * resolves keeps the row valid across a theme change. The MVP has one
 * colour and no UI to change it; the field is on the row because
 * ADR-0002 puts it there and because a highlight list without colour
 * is a list the reader cannot scan.
 */
export const DEFAULT_HIGHLIGHT_COLOR = 'yellow';

/** What the caller supplies to mark a text region. The generated
 *  fields (`id`, `createdAt`) are the repository's business. */
export interface NewHighlight {
	readonly documentId: DocumentId;
	readonly sourceFingerprint: SourceFingerprint;
	readonly pageIndex: PageIndex;
	/** Format-specific payload included, stored unread. */
	readonly anchor: Anchor;
	/** The exact text that was selected. Mirrors the anchor's quote for
	 *  formats that carry one, duplicated so a list can show the words
	 *  without consulting the reader. */
	readonly selectedText: string;
	/** Defaults to {@link DEFAULT_HIGHLIGHT_COLOR}. */
	readonly color?: string;
}

/**
 * Mark a text region.
 *
 * `anchor` and `selectedText` are stored as given, including a
 * disagreement between them. A recovery pass that rebuilt one without
 * the other is a bug in the reader, and a repository that "fixed" it
 * would be inventing a third answer that nothing else can reach.
 */
export async function addHighlight(input: NewHighlight): Promise<Highlight> {
	const highlight: Highlight = {
		id: crypto.randomUUID(),
		documentId: input.documentId,
		sourceFingerprint: input.sourceFingerprint,
		pageIndex: input.pageIndex,
		anchor: input.anchor,
		selectedText: input.selectedText,
		color: input.color ?? DEFAULT_HIGHLIGHT_COLOR,
		createdAt: Date.now(),
	};
	await getDb().highlights.put(highlight);
	return highlight;
}

/** Every highlight in a source, in painting order: by page, then by
 *  when it was made. Hits the compound
 *  `[documentId+sourceFingerprint]` index and post-filters by the
 *  scope pair in memory — keeping the secondary index read narrow
 *  for the same cost as the prior single-column scan. */
export async function listHighlights(scope: HighlightScope): Promise<readonly Highlight[]> {
	const rows = await getDb()
		.highlights.where('[documentId+sourceFingerprint]')
		.equals([scope.documentId, scope.sourceFingerprint])
		.toArray();
	return [...rows].sort(
		(a, b) =>
			a.pageIndex - b.pageIndex ||
			a.createdAt - b.createdAt ||
			(a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
	);
}

/** The highlights on one page, in the order they were made. Hits the
 *  `[documentId+sourceFingerprint+pageIndex]` compound index directly
 *  so the painter's query is a single indexed read with no
 *  post-filter. */
export async function listHighlightsOnPage(
	scope: HighlightScope,
	pageIndex: PageIndex,
): Promise<readonly Highlight[]> {
	const rows = await getDb()
		.highlights.where('[documentId+sourceFingerprint+pageIndex]')
		.equals([scope.documentId, scope.sourceFingerprint, pageIndex])
		.toArray();
	return [...rows].sort(
		(a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
	);
}

/**
 * Store a refreshed anchor — the write-back for
 * `ResolvedAnchor.updatedAnchor`.
 *
 * The payload is not read, and neither is anything else about the row
 * except its id. Returns whether the row was there, so the caller can
 * tell "the refreshed anchor was stored" from "the highlight is gone":
 * a resolver that has just decided an anchor is still valid is not in
 * a position to create it, and reporting success for a row that does
 * not exist would hide a highlight that vanished.
 *
 * The caller is responsible for detecting a page mismatch between the
 * stored row and the resolver-supplied `Anchor` (the `Anchor.page`
 * field against `Highlight.pageIndex`); this repository stays
 * format-agnostic on purpose, per ADR-0007.
 *
 * ADR-0007 leaves the quote alone on a recovery, which is why
 * `selectedText` is not touched either: it mirrors the quote, and
 * rewriting one without the other would be the disagreement this
 * repository refuses to invent.
 */
export async function replaceHighlightAnchor(id: string, anchor: Anchor): Promise<boolean> {
	// The count is the answer, and there is no read in front of it. A
	// read-then-write reports what was true a moment ago: another tab
	// deleting the row in between leaves the write matching nothing while
	// the function still says it stored something. A resolver that has
	// just decided an anchor is valid would then report success for a
	// highlight that is gone.
	return (await getDb().highlights.update(id, { anchor })) > 0;
}

/** Remove a highlight. A reader action — see the file header.
 *
 *  Race: same shape as `bookmarks-repo.deleteBookmark` — a `get`
 *  outside a transaction cannot answer "was there a row" atomically
 *  with the subsequent `delete`. Wrapping in `rw` serialises the two
 *  so a second concurrent caller reads `undefined` and returns
 *  `false`. */
export async function deleteHighlight(id: string): Promise<boolean> {
	return await getDb().transaction('rw', getDb().highlights, async () => {
		const existing = await getDb().highlights.get(id);
		if (existing === undefined) return false;
		await getDb().highlights.delete(id);
		return true;
	});
}
