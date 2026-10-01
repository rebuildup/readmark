/**
 * readmark — quota badge for the library header.
 *
 * Renders current storage usage and quota, with a warning when the
 * origin is not marked persistent. The badge is read-only
 * presentation: the actual persistence request lives in
 * `<DocumentImport>`, because the browser is most likely to grant
 * persistent storage after a real import.
 *
 * Why a `refreshKey` prop instead of a callback:
 *   - The library screen already drives its own refresh cadence
 *     (after import, after delete). Forcing the badge into that
 *     loop would mean a callback prop and a sibling setState; the
 *     key prop is one prop and no coupling.
 *   - The badge can refresh on its own whenever the caller bumps
 *     the key; it does not need to know why.
 *
 * Why we render nothing when `quota: 0`:
 *   - `readQuotaUsage()` returns zeros when the browser does not
 *     support `estimate()` (older Safari) or the call rejects
 *     (private mode). Hiding the badge is more useful than showing
 *     "0 B / 0 B", which would look broken.
 */

import { useEffect, useState } from 'react';
import { formatByteSize } from '../library/library-list.ts';
import { type QuotaSnapshot, readQuotaUsage } from '../platform/persistent-storage.ts';

interface QuotaBadgeProps {
	/**
	 * Increment to force the badge to re-read `navigator.storage.estimate()`.
	 * The library screen bumps it after every successful import / delete.
	 */
	readonly refreshKey: number;
}

type BadgeState =
	| { readonly kind: 'loading' }
	| { readonly kind: 'unsupported' }
	| { readonly kind: 'ready'; readonly snapshot: QuotaSnapshot };

export function QuotaBadge({ refreshKey }: QuotaBadgeProps) {
	const [state, setState] = useState<BadgeState>({ kind: 'loading' });

	useEffect(() => {
		let cancelled = false;
		readQuotaUsage()
			.then((snapshot) => {
				if (cancelled) return;
				if (snapshot.quota <= 0) {
					setState({ kind: 'unsupported' });
					return;
				}
				setState({ kind: 'ready', snapshot });
			})
			.catch(() => {
				if (cancelled) return;
				setState({ kind: 'unsupported' });
			});
		return () => {
			cancelled = true;
		};
	}, [refreshKey]);

	if (state.kind === 'loading') {
		return (
			<p className="rm-quota-badge" data-testid="rm-quota-badge-loading">
				ストレージ使用量: 計測中…
			</p>
		);
	}

	if (state.kind === 'unsupported') {
		return null;
	}

	const { usage, quota, persistent } = state.snapshot;
	const percent = Math.min(100, Math.round((usage / quota) * 100));

	return (
		<div className="rm-quota-badge" data-testid="rm-quota-badge">
			<span className="rm-quota-badge__usage">
				ストレージ使用量: {formatByteSize(usage)} / {formatByteSize(quota)} ({percent}%)
			</span>
			{!persistent && (
				<span
					className="rm-quota-badge__warning"
					role="status"
					data-testid="rm-quota-badge-warning"
				>
					永続化が未要求です。ディスク容量圧迫時に削除される可能性があります。
				</span>
			)}
		</div>
	);
}
