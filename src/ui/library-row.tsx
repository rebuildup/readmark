/**
 * readmark — one row of the Library list.
 *
 * Row anatomy (and why):
 *   - Title is a `<Link>` to `/read/:documentId`. The document id
 *     is the LOGICAL key (ADR-0002) — the reader resolves the
 *     physical source from it — so the URL survives re-imports of
 *     the same bytes.
 *   - "読む" is a second link to the same route, styled as a
 *     button. It is deliberately NOT a `<button>` inside the title
 *     link: nesting interactive elements is invalid HTML and leaves
 *     keyboard and AT behaviour up to the browser. The row's
 *     `library-screen.test.tsx` pins the shape.
 *   - "削除" IS a `<button>`: it must not navigate, and it is an
 *     action on the list rather than a destination.
 *   - Actions are revealed on hover / focus-within via CSS, not
 *     conditionally rendered. Removing them from the DOM would make
 *     them undiscoverable by keyboard and by touch, where there is
 *     no hover at all.
 *
 * Wording note: `Document.lastReadAt` is the timestamp of the last
 * *open* (see `domain/document.ts`). readmark stores no
 * finished-reading state, so the row says "最終閲覧" / "未閲覧" and
 * never claims the reader finished the book.
 */

import { Link } from 'react-router-dom';

import type { DocumentId } from '../domain/document.ts';
import {
	displayAuthor,
	displayTitle,
	formatByteSize,
	formatImportedAt,
	formatLastReadStructured,
} from '../library/library-list.ts';
import type { LibraryEntry } from '../storage/documents-repo.ts';
import { Button } from './primitives/button.tsx';

interface LibraryRowProps {
	readonly entry: LibraryEntry;
	/** Injected so relative dates are deterministic under test, and
	 *  so the displayed dates are re-based when the list is
	 *  re-fetched rather than drifting with a long-lived mount. */
	readonly now: number;
	readonly onRequestDelete: (documentId: DocumentId) => void;
}

export function LibraryRow({ entry, now, onRequestDelete }: LibraryRowProps) {
	const { document, primarySource } = entry;
	const title = displayTitle(document.metadata);
	const author = displayAuthor(document.metadata);
	const lastRead = formatLastReadStructured(document.lastReadAt, now);
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
					<span>{lastRead === null ? '未閲覧' : `最終閲覧 ${lastRead.label}`}</span>
					<span aria-hidden="true">・</span>
					<span>{imported}に追加</span>
				</div>
			</div>
			<div className="rm-library-row__actions">
				<Link
					className="rm-button rm-button--secondary"
					to={`/read/${document.id}`}
					data-testid="rm-library-row-read"
				>
					読む
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
