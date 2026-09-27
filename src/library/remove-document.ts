/**
 * readmark — library remove flow (pure).
 *
 * Single responsibility (AGENTS.md §3 boundary): turn "the reader
 * asked to delete this document" into a typed outcome, without
 * knowing anything about React or IndexedDB.
 *
 * What deletion means, and why it is not the caller's problem:
 *   - `deleteDocument()` in the storage layer removes the Document,
 *     its sources, its blobs, and every reading-state row keyed by
 *     its `DocumentId`, in one transaction (see the cascade
 *     rationale there and ADR-0002).
 *   - This flow adds the two things the screen needs on top: a
 *     `not-found` error for "the row was already gone" (a second
 *     device tab, or a re-render race), and a summary of what was
 *     removed so the screen can report it instead of guessing.
 *
 * Why there is no `quota-exceeded` kind here: unlike import,
 * deletion frees space and never raises it. A quota error here would
 * mean a broken quota accounting in the browser, which belongs in
 * the `unknown` bucket with its cause attached.
 *
 * Non-goal: undo. The MVP has no undo buffer (ADR-0002), so the
 * screen must confirm before calling this. Recovering a deleted
 * document means re-importing the file; its highlights and notes
 * were deleted with it and are NOT restored by the re-import
 * (different bytes → different `SourceFingerprint`).
 */

import type { DocumentId } from '../domain/document.ts';
import type { DeleteDocumentSummary } from '../storage/documents-repo.ts';
import { deleteDocument } from '../storage/documents-repo.ts';
import type { Result } from './result.ts';

export type RemoveDocumentError =
	| { readonly kind: 'not-found'; readonly documentId: DocumentId }
	| { readonly kind: 'unknown'; readonly cause: unknown };

/** What the screen reports back to the user after a successful
 *  delete. `summary` is the storage layer's per-table count. */
export interface RemoveDocumentSuccess {
	readonly documentId: DocumentId;
	readonly summary: DeleteDocumentSummary;
}

export async function removeDocument(
	documentId: DocumentId,
): Promise<Result<RemoveDocumentSuccess, RemoveDocumentError>> {
	try {
		const summary = await deleteDocument(documentId);
		if (summary === null) {
			return { ok: false, error: { kind: 'not-found', documentId } };
		}
		return { ok: true, value: { documentId, summary } };
	} catch (cause: unknown) {
		// Do not narrow the cause here: a Dexie failure (blocked
		// upgrade, closed connection, corrupted store) is a bug we
		// want in the log, not a user-facing category. `console.error`
		// stays at the UI boundary, which owns the console.
		return { ok: false, error: { kind: 'unknown', cause } };
	}
}

/** User-facing text for a remove failure. Lives next to the error
 *  union so a new `kind` cannot reach the screen without a message.
 *  (The screen still owns the case that says "nothing happened and
 *  the list is unchanged".) */
export function removeErrorMessage(error: RemoveDocumentError): string {
	switch (error.kind) {
		case 'not-found':
			return 'この文書はすでに削除されています。一覧を更新しました。';
		case 'unknown':
			return '削除に失敗しました。時間をおいて再度お試しください。';
	}
}
