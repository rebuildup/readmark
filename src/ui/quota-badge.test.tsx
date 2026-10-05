/**
 * Component test for the quota badge.
 *
 * Coverage:
 *   - Loading state is the initial render until `readQuotaUsage` resolves.
 *   - `usage / quota / percent` is rendered after resolution.
 *   - The "not persistent" warning appears only when `persistent: false`.
 *   - The badge renders nothing when `quota: 0` (estimate unsupported).
 *   - The badge re-reads when `refreshKey` changes.
 *
 * Why we mock `readQuotaUsage`:
 *   - The wrapper has its own dedicated tests in
 *     `persistent-storage.test.ts`. This file proves the wiring
 *     (props → effect → render), not the wrapper's logic.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readQuotaUsage } from '../platform/persistent-storage.ts';
import { QuotaBadge } from './quota-badge.tsx';

vi.mock('../platform/persistent-storage.ts', () => ({
	readQuotaUsage: vi.fn(),
}));

const mockReadQuotaUsage = vi.mocked(readQuotaUsage);

afterEach(() => {
	vi.restoreAllMocks();
});

describe('QuotaBadge', () => {
	it('renders the loading state before readQuotaUsage resolves', () => {
		// Never-resolving promise to keep the loading state visible.
		mockReadQuotaUsage.mockReturnValue(new Promise(() => {}));
		render(<QuotaBadge refreshKey={0} />);
		expect(screen.getByTestId('rm-quota-badge-loading')).toBeTruthy();
		expect(screen.queryByTestId('rm-quota-badge')).toBeNull();
	});

	it('renders usage / quota / percent after readQuotaUsage resolves', async () => {
		mockReadQuotaUsage.mockResolvedValue({
			usage: 5000,
			quota: 50000,
			persistent: true,
		});
		render(<QuotaBadge refreshKey={0} />);
		const badge = await screen.findByTestId('rm-quota-badge');
		// 5000 bytes = 4.9 KB (1024-byte base). 50000 = 48.8 KB.
		// 5000 / 50000 = 10 %.
		expect(badge.textContent).toContain('4.9 KB');
		expect(badge.textContent).toContain('48.8 KB');
		expect(badge.textContent).toContain('10%');
		// No warning when storage is persistent.
		expect(screen.queryByTestId('rm-quota-badge-warning')).toBeNull();
	});

	it('shows a warning when storage is not persistent', async () => {
		mockReadQuotaUsage.mockResolvedValue({
			usage: 1000,
			quota: 10000,
			persistent: false,
		});
		render(<QuotaBadge refreshKey={0} />);
		await screen.findByTestId('rm-quota-badge');
		const warning = screen.getByTestId('rm-quota-badge-warning');
		expect(warning.textContent).toContain('永続化が未要求');
	});

	it('renders nothing when readQuotaUsage returns zeros (unsupported)', async () => {
		mockReadQuotaUsage.mockResolvedValue({ usage: 0, quota: 0, persistent: false });
		const { container } = render(<QuotaBadge refreshKey={0} />);
		// The unsupported branch hides the badge entirely. Wait for
		// the loading state to be replaced.
		await waitFor(() =>
			expect(container.querySelector('[data-testid="rm-quota-badge"]')).toBeNull(),
		);
		expect(container.querySelector('[data-testid="rm-quota-badge-loading"]')).toBeNull();
	});

	it('renders nothing when readQuotaUsage rejects', async () => {
		mockReadQuotaUsage.mockRejectedValue(new Error('private mode'));
		const { container } = render(<QuotaBadge refreshKey={0} />);
		await waitFor(() =>
			expect(container.querySelector('[data-testid="rm-quota-badge"]')).toBeNull(),
		);
	});

	it('re-reads when refreshKey changes', async () => {
		mockReadQuotaUsage
			.mockResolvedValueOnce({ usage: 100, quota: 1000, persistent: true })
			.mockResolvedValueOnce({ usage: 200, quota: 1000, persistent: true });
		const { rerender } = render(<QuotaBadge refreshKey={0} />);
		await screen.findByTestId('rm-quota-badge');
		expect(mockReadQuotaUsage).toHaveBeenCalledTimes(1);

		rerender(<QuotaBadge refreshKey={1} />);
		await waitFor(() => expect(mockReadQuotaUsage).toHaveBeenCalledTimes(2));
	});

	it('caps the percent at 100 even when the estimate is slightly over', async () => {
		// Defensive: a buggy browser returning usage > quota must NOT
		// render "150%" in the badge. The bar / label caps at 100.
		mockReadQuotaUsage.mockResolvedValue({
			usage: 1500,
			quota: 1000,
			persistent: true,
		});
		render(<QuotaBadge refreshKey={0} />);
		const badge = await screen.findByTestId('rm-quota-badge');
		expect(badge.textContent).toContain('100%');
		expect(badge.textContent).not.toContain('150%');
	});

	it.each([
		['0 of 0', { usage: 0, quota: 0, persistent: false }, false],
		['0 of a real quota', { usage: 0, quota: 5_000_000, persistent: true }, true],
		['0 bytes against an absent quota', { usage: 0, quota: 0, persistent: true }, false],
	])('never renders NaN or Infinity for %s', async (_label, snapshot, expectBadge) => {
		// `0 / 0` is `NaN` and `n / 0` is `Infinity`, so a badge that
		// divided without guarding would print exactly those. The
		// guard is `quota <= 0 -> render nothing`; this asserts the
		// rendered output, not merely that the component mounted.
		mockReadQuotaUsage.mockResolvedValue(snapshot);
		const { container } = render(<QuotaBadge refreshKey={0} />);
		await waitFor(() =>
			expect(container.querySelector('[data-testid="rm-quota-badge-loading"]')).toBeNull(),
		);
		const rendered = container.querySelector('[data-testid="rm-quota-badge"]')?.textContent ?? '';
		expect(rendered).not.toContain('NaN');
		expect(rendered).not.toContain('Infinity');
		if (expectBadge) {
			// A real quota still renders, and its percent is a real
			// integer — here exactly 0, not `NaN`.
			expect(rendered).toMatch(/\(\d+%\)/);
			expect(rendered).toContain('(0%)');
		} else {
			// No quota means no ratio to show, so nothing is rendered.
			expect(rendered).toBe('');
		}
	});
});
