/**
 * readmark — `<ConfirmDialog>`, a modal confirmation shell.
 *
 * Why hand-rolled instead of `<dialog>` + `showModal()`:
 *   - The native element owns focus trapping and inert-ness
 *     automatically, which is the behavior we want — but happy-dom
 *     (our test environment, see `vitest.config.ts`) does not
 *     implement `showModal`, and the deletion flow is exactly the
 *     path we most want under test.
 *
 * `aria-modal="true"` is a claim, so the implementation has to make
 * it true. Four pieces, all of them testable here:
 *
 *   1. The dialog is rendered through a portal as a direct child of
 *      `document.body`, and every other body child gets `inert`.
 *      That is what keeps the Library behind it out of reach of the
 *      keyboard and of assistive technology, and it is why the
 *      dialog cannot simply be a child of the screen component:
 *      `inert` on a common ancestor would disable the dialog too.
 *   2. Tab and Shift+Tab cycle inside the dialog, and a `focusin`
 *      guard pulls focus back if it escapes by any other route
 *      (programmatic focus, a browser affordance).
 *   3. Focus starts on the cancel button. A destructive confirmation
 *      must not be one stray Enter away.
 *   4. On close, focus returns to whatever had it when the dialog
 *      opened — the delete button, when it still exists. The dialog
 *      is never dismissed by a backdrop click: for an irreversible
 *      action an explicit choice is the safer contract, and it keeps
 *      the dialog usable without a pointer. Escape is disabled while
 *      `busy` so a slow IndexedDB transaction cannot be abandoned
 *      half-done.
 *
 * The description is a `ReactNode` because callers need to name the
 * document and state the reading-state consequence — a flat string
 * cannot carry that.
 */

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './primitives/button.tsx';

/** Focusable, non-disabled descendants, in tab order. Kept as a
 *  selector rather than tabbable library because the dialog has two
 *  buttons and no form fields; extend it if that stops being true. */
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

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
	const panelRef = useRef<HTMLDivElement | null>(null);
	const cancelRef = useRef<HTMLButtonElement | null>(null);
	const titleId = useId();
	const descriptionId = `${titleId}-description`;

	// The portal container is created during the first render (a
	// detached element, so the initializer is free of observable
	// effects) and attached in an effect. Declaring it before the
	// effects below is what lets them see it on the first commit.
	const [container] = useState<HTMLDivElement | null>(() => {
		if (typeof document === 'undefined') return null;
		const element = document.createElement('div');
		element.setAttribute('data-testid', 'rm-dialog-portal');
		return element;
	});
	// Set while unmounting so the focus guards stop interfering with
	// the focus restore, which runs in a later cleanup.
	const closingRef = useRef(false);

	useEffect(() => {
		if (container === null) return;
		document.body.appendChild(container);
		return () => {
			closingRef.current = true;
			container.remove();
		};
	}, [container]);

	useEffect(() => {
		// Capture before anything moves focus. Declared before the
		// focus-on-open effect on purpose: that one would otherwise
		// make the cancel button the thing we later "restore" to.
		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const background = Array.from(document.body.children).filter(
			(child) => child !== container,
		) as HTMLElement[];
		const priorInert = background.map((element) => element.inert);
		for (const element of background) element.inert = true;

		return () => {
			background.forEach((element, index) => {
				element.inert = priorInert[index] ?? false;
			});
			// Only if the trigger still exists: the row that opened
			// the dialog may be the thing the dialog deleted.
			if (previouslyFocused?.isConnected) {
				previouslyFocused.focus();
			}
		};
	}, [container]);

	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	useEffect(() => {
		function focusableElements(): HTMLElement[] {
			const panel = panelRef.current;
			if (panel === null) return [];
			return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape' && !busy) {
				event.stopPropagation();
				onCancel();
				return;
			}
			if (event.key !== 'Tab') return;

			const focusables = focusableElements();
			if (focusables.length === 0) {
				event.preventDefault();
				return;
			}
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			// `first` / `last` exist whenever the list is non-empty;
			// the guard above is what proves it.
			if (first === undefined || last === undefined) return;

			const active = document.activeElement;
			const inside = panelRef.current?.contains(active) ?? false;
			if (event.shiftKey) {
				if (!inside || active === first) {
					event.preventDefault();
					last.focus();
				}
				return;
			}
			if (!inside || active === last) {
				event.preventDefault();
				first.focus();
			}
		}

		function onFocusIn(event: FocusEvent) {
			if (closingRef.current) return;
			const panel = panelRef.current;
			if (panel === null) return;
			if (event.target instanceof Node && panel.contains(event.target)) return;
			// Focus got out some other way. Put it back rather than
			// leaving the reader tabbing through an inert background.
			(cancelRef.current ?? focusableElements()[0])?.focus();
		}

		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('focusin', onFocusIn);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('focusin', onFocusIn);
		};
	}, [busy, onCancel]);

	const dialog = (
		<div className="rm-dialog-backdrop" data-testid="rm-dialog-backdrop">
			<div
				className="rm-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				aria-busy={busy}
				ref={panelRef}
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

	if (container === null) return null;
	return createPortal(dialog, container);
}
