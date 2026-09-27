/**
 * Component tests for `<ConfirmDialog>`.
 *
 * `aria-modal="true"` is a claim, so these tests check the claim
 * rather than the attribute:
 *   - Focus lands on cancel, never on the destructive action.
 *   - Tab / Shift+Tab wrap at the ends of the dialog instead of
 *     walking the list behind it, and focus that escapes by any
 *     other route is pulled back.
 *   - Everything outside the dialog is `inert` while it is open, and
 *     that is undone on close.
 *   - Focus returns to whatever opened the dialog.
 *
 * The dialog is driven through a small stateful wrapper rather than
 * through the Library screen, so the trap is pinned independently of
 * the list UI. Note what the wrap assertions do NOT claim: the
 * mid-dialog Tab steps are the browser's own sequential focus
 * navigation, which happy-dom does not implement. What this component
 * owns is the boundary.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './confirm-dialog.tsx';

interface HarnessProps {
	readonly onConfirm?: () => void;
}

function Harness({ onConfirm }: HarnessProps) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				開く
			</button>
			<a href="/somewhere">戻る</a>
			{open && (
				<ConfirmDialog
					title="削除しますか？"
					description={<p>読書状態も失われます。</p>}
					confirmLabel="削除する"
					busyLabel="削除中…"
					tone="danger"
					onConfirm={() => onConfirm?.()}
					onCancel={() => setOpen(false)}
				/>
			)}
		</>
	);
}

const panel = () => screen.getByRole('alertdialog');
const trigger = () => screen.getByRole('button', { name: '開く' });
const cancel = () => screen.getByTestId('rm-dialog-cancel');
const confirm = () => screen.getByTestId('rm-dialog-confirm');

/** Open the dialog from the trigger, which is how a row's delete
 *  button reaches it. The trigger holds focus at that moment, so the
 *  restore target is meaningful — the explicit `focus()` stands in
 *  for the browser moving focus on mousedown, which a synthetic
 *  click does not do. */
function openDialog(): void {
	trigger().focus();
	fireEvent.click(trigger());
}

describe('ConfirmDialog', () => {
	it('puts focus on cancel, not on the destructive action', () => {
		render(<Harness />);
		openDialog();

		expect(document.activeElement).toBe(cancel());
		expect(document.activeElement).not.toBe(confirm());
	});

	it('wraps forward from the last focusable back to the first', async () => {
		render(<Harness />);
		openDialog();
		confirm().focus();

		fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab' });

		await waitFor(() => expect(document.activeElement).toBe(cancel()));
	});

	it('wraps backward from the first focusable to the last', async () => {
		render(<Harness />);
		openDialog();
		cancel().focus();

		fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: true });

		await waitFor(() => expect(document.activeElement).toBe(confirm()));
	});

	it('pulls focus back when it escapes by another route', async () => {
		render(<Harness />);
		openDialog();
		// Programmatic focus (or a browser affordance) landing on the
		// background must not be left there while the dialog is modal.
		trigger().focus();

		await waitFor(() => expect(document.activeElement).toBe(cancel()));
	});

	it('marks the background inert while open and restores it on close', () => {
		const { container } = render(<Harness />);
		openDialog();
		// The whole app root is a sibling of the dialog's portal, so
		// one flag takes the list, the import control and every row
		// out of reach at once.
		expect(container.inert).toBe(true);

		fireEvent.click(cancel());

		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(container.inert).toBe(false);
	});

	it('returns focus to the trigger when it closes', async () => {
		render(<Harness />);
		openDialog();
		expect(document.activeElement).not.toBe(trigger());

		fireEvent.click(cancel());

		await waitFor(() => expect(document.activeElement).toBe(trigger()));
	});

	it('cancels on Escape', async () => {
		render(<Harness />);
		openDialog();

		fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
	});

	it('confirms on the confirm button', () => {
		const onConfirm = vi.fn();
		render(<Harness onConfirm={onConfirm} />);
		openDialog();

		fireEvent.click(confirm());

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it('renders the description the caller supplies', () => {
		render(<Harness />);
		openDialog();

		const text = panel().textContent ?? '';
		expect(text).toContain('削除しますか？');
		expect(text).toContain('読書状態も失われます。');
	});
});
