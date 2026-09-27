/**
 * readmark — `<ConfirmDialog>`, a modal confirmation shell.
 *
 * Why hand-rolled instead of `<dialog>` + `showModal()`:
 *   - The native element owns focus trapping and inert-ness
 *     automatically, which is the behavior we want — but happy-dom
 *     (our test environment, see `vitest.config.ts`) does not
 *     implement `showModal`, and the deletion flow is exactly the
 *     path we most want under test. A `role="alertdialog"` div with
 *     explicit focus handling is testable and behaves the same in
 *     every browser we target.
 *
 * Accessibility contract, kept deliberately small but real:
 *   - `role="alertdialog"` + `aria-modal` + `aria-labelledby` /
 *     `aria-describedby` wired to the caller's title / description.
 *   - Focus moves to the cancel button on open. Destructive
 *     confirmations must not be one stray Enter away.
 *   - The dialog is left by pressing Escape or activating either
 *     button. There is deliberately NO click-outside-to-dismiss:
 *     for an irreversible action an explicit choice is the safer
 *     contract, and it keeps the dialog usable without a pointer.
 *     Escape is disabled while `busy` so a slow IndexedDB
 *     transaction cannot be abandoned half-done.
 *   - The description is a `ReactNode` because callers need to name
 *     the document and state the reading-state consequence — a flat
 *     string cannot carry that.
 */

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from './primitives/button.tsx';

interface ConfirmDialogProps {
	readonly title: string;
	readonly description: ReactNode;
	readonly confirmLabel: string;
	readonly cancelLabel?: string;
	/** Label shown on the confirm button while `busy`. Defaults to
	 *  `confirmLabel`; destructive flows pass their own verb
	 *  ("削除中…") so the button never reads as a second prompt. */
	readonly busyLabel?: string;
	/** Visual weight of the confirm button. `danger` is for
	 *  irreversible actions; the default fits everything else. */
	readonly tone?: 'primary' | 'danger';
	/** Rendered inside the dialog, below the buttons — used for
	 *  error feedback when the action failed and the dialog stayed
	 *  open. */
	readonly errorMessage?: string | null;
	/** Disable both actions and relabel the confirm button while
	 *  the caller's async work is in flight. */
	readonly busy?: boolean;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
}

export function ConfirmDialog({
	title,
	description,
	confirmLabel,
	cancelLabel = 'キャンセル',
	busyLabel = '処理中…',
	tone = 'primary',
	errorMessage = null,
	busy = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const cancelRef = useRef<HTMLButtonElement | null>(null);
	const titleId = useId();
	const descriptionId = `${titleId}-description`;

	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== 'Escape' || busy) return;
			event.stopPropagation();
			onCancel();
		}
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [busy, onCancel]);

	return (
		<div className="rm-dialog-backdrop" data-testid="rm-dialog-backdrop">
			<div
				className="rm-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				aria-busy={busy}
			>
				<h2 className="rm-dialog__title" id={titleId}>
					{title}
				</h2>
				<div className="rm-dialog__description" id={descriptionId}>
					{description}
				</div>
				{errorMessage !== null && (
					<p className="rm-dialog__error" role="alert" data-testid="rm-dialog-error">
						{errorMessage}
					</p>
				)}
				<div className="rm-dialog__actions">
					<Button
						ref={cancelRef}
						variant="ghost"
						onClick={onCancel}
						disabled={busy}
						data-testid="rm-dialog-cancel"
					>
						{cancelLabel}
					</Button>
					<Button
						variant={tone}
						onClick={onConfirm}
						disabled={busy}
						aria-busy={busy}
						data-testid="rm-dialog-confirm"
					>
						{busy ? busyLabel : confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
