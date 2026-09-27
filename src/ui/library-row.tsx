/**
 * readmark — one row of the Library list.
 *
 * Row anatomy (and why):
 *   - Title is a `<Link>` to `/read/:documentId`. The document id
 *     is the LOGICAL key (ADR-0002) — the reader resolves the
 *     physical source from it — so the URL survives re-imports of
 *     the same bytes.
 *   - "読む" is a second, explicitly labelled link to the same
 *     route. The title alone is not a discoverable affordance: a
 *     reader scanning the list should be able to hit a button.
 *   - "削除" is a real `<button>`, not a link: it must not navigate
 *     and must be reachable by keyboard as an action.
 *   - Actions are revealed on hover / focus-within via CSS, not
 *     conditionally rendered. Removing them from the DOM would make
 *     them undiscoverable by keyboard and by touch, where there is
 *     no hover at all.
 */

import { Link } from 'react-router-dom';

import type { DocumentId } from '../domain/document.ts';
import { formatByteSize, formatImportedAt, formatLastReadAt } from '../library/library-list.ts';
import type { LibraryEntry } from '../storage/documents-repo.ts';
import { Button } from './primitives/button.tsx';

interface LibraryRowProps {
	readonly entry: LibraryEntry;
	/** Injected so relative dates are deterministic under test and
	 *  so a re-render at midnight does not silently change the text
	 *  of rows the reader did not touch. */
	readonly now: number;
	readonly onRequestDelete: (documentId: DocumentId) => void;
}

export function LibraryRow({ entry, now, onRequestDelete }: LibraryRowProps) {
	const { document, primarySource } = entry;
	const title = document.metadata.title ?? '(タイトルなし)';
	const author = document.metadata.author ?? '(著者なし)';
	const lastRead = formatLastReadAt(document.lastReadAt, now);
	const imported = formatImportedAt(document.importedAt, now);

	return (
		<li className="rm-library-row" data-testid="rm-library-row" data-document-id={document.id}>
			<div className="rm-library-row__body">
				<Link className="rm-library-row__title" to={`/read/${document.id}`}>
					{title}
				</Link>
				<div className="rm-library-row__meta">
					<span>{author}</span>
					<span aria-hidden="true">・</span>
					<span>{primarySource.format.toUpperCase()}</span>
					{primarySource.metadata.pageCount !== undefined && (
						<>
							<span aria-hidden="true">・</span>
							<span>{primarySource.metadata.pageCount} ページ</span>
						</>
					)}
					<span aria-hidden="true">・</span>
					<span>{formatByteSize(primarySource.byteSize)}</span>
				</div>
				<div className="rm-library-row__status">
					<span>{lastRead === '未読' ? '未読' : `${lastRead}に読了`}</span>
					<span aria-hidden="true">・</span>
					<span>{imported}に追加</span>
				</div>
			</div>
			<div className="rm-library-row__actions">
				<Link to={`/read/${document.id}`}>
					<Button variant="secondary" data-testid="rm-library-row-read">
						読む
					</Button>
				</Link>
				<Button
					variant="ghost"
					onClick={() => onRequestDelete(document.id)}
					data-testid="rm-library-row-delete"
				>
					削除
				</Button>
			</div>
		</li>
	);
}
