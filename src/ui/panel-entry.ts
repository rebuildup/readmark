/**
 * readmark — the vocabulary the three side panels share.
 *
 * The reader's side panel is one surface with three lists in it, and
 * every rule that has to hold for *all* of them lives here rather than
 * being written three times in three files. Two of them are worth
 * stating out loud, because both are the kind of thing that looks fine
 * until the day it is not.
 *
 * ## The count is the list
 *
 * `panelCount` is the only way a panel says how many entries it has,
 * and every panel calls it with the length of the very array it maps
 * into rows. That is the whole invariant. A panel that ran a second
 * query to label the list would be describing a different set of
 * entries than the one on screen, and the two would disagree the first
 * time anything changed between the two reads — which is to say, the
 * first time a row's document was deleted out from under the reader.
 *
 * Counting is also *inclusive* of entries the reader cannot jump to. An
 * entry whose target is gone is still a row on screen, still stored,
 * and still counted; dropping it from the count while showing it in the
 * list is the exact failure this module exists to prevent. It is
 * removed from both at once, when the list it came from no longer
 * holds it.
 *
 * ## Every entry says whether it can be jumped to
 *
 * `PanelEntryState` is the answer, and it is an answer the panel can
 * render without asking anything: a state of `'unresolved'` or `'gone'`
 * means there is no jump button on that row, and a reader who is looking
 * for one finds a sentence saying why instead. A button that cannot do
 * what it says is worse than no button, because the reader has no way to
 * tell the two apart.
 *
 * The states are the panel layer's reading of what the reader and the
 * repositories already know. This module decides nothing; it only names
 * the three answers so the three panels cannot invent a fourth.
 */

/**
 * What a panel knows about one of its rows.
 *
 * - `ready` — the row's target is where the panel says it is.
 * - `unresolved` — the row is real and on screen, but *this* reader
 *   cannot place it: the anchor does not resolve against the file in
 *   front of them, or a jump was asked for and did not land.
 * - `gone` — the target itself is not there any more. The repository
 *   reported the row as deleted, or the document it belonged to is.
 *   Nothing can be jumped to, and pretending otherwise is the
 *   empty-success case: the reader clicks and the item simply vanishes
 *   with nobody saying why.
 */
export type PanelEntryState = 'ready' | 'unresolved' | 'gone';

/**
 * What a row shows in place of its jump button.
 *
 * `null` for `ready` — the absence of a notice is the notice. The two
 * states that answer with text are the two where a reader pressing the
 * row would otherwise learn nothing.
 *
 * Wording is deliberately about *what happened*, not about what the
 * reader should do next. The reader knows how to delete a row; they do
 * not know whether their file was re-scanned, and a message guessing at
 * the cause would be a lie whenever it guessed wrong.
 */
export const PANEL_ENTRY_NOTICE: Readonly<Record<PanelEntryState, string | null>> = {
	ready: null,
	unresolved: '位置が見つかりません',
	gone: '対象なし',
};

/** Whether a row in this state offers a jump.
 *
 *  Exported so the panels and their tests agree on one rule rather than
 *  each re-deriving it from the notice strings. */
export function panelEntryIsJumpable(state: PanelEntryState): boolean {
	return state === 'ready';
}

/**
 * The one count format, for all three panels.
 *
 * Takes the length of the list it labels and nothing else — it cannot
 * be handed a second source, which is what makes it an invariant rather
 * than a convention. `0 件` is a real answer (an open panel on a book
 * nobody has marked yet), not a missing one, so this never returns an
 * empty string.
 */
export function panelCount(entries: number): string {
	return `${entries} 件`;
}
