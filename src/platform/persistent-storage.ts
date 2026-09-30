/**
 * readmark — persistent storage platform wrapper.
 *
 * Single responsibility (AGENTS.md §3 boundary):
 *   - Wrap `navigator.storage.persist()`, `navigator.storage.persisted()`,
 *     and `navigator.storage.estimate()` behind typed functions.
 *   - Never touch React, Dexie, or the DOM beyond reading the API
 *     surface `navigator` exposes.
 *
 * Why this lives in `platform/` (AGENTS.md §3 lists it):
 *   - `navigator.storage` is a small surface but its semantics
 *     matter: `persist()` can prompt the user, and asking repeatedly
 *     is hostile UX. The "request once per tab" policy is a product
 *     decision that belongs in code, not in every UI callsite.
 *   - Browser support varies. `persist()` / `estimate()` are absent
 *     on older Safari. The wrapper degrades to a sensible "unknown"
 *     snapshot instead of throwing.
 *
 * What this module deliberately does NOT do:
 *   - Touch `sessionStorage` or `localStorage`. Persistence is
 *     tracked via a module-level flag so the "once per tab" scope is
 *     automatic and survives no reload.
 *   - Cache the snapshot. `estimate()` is microseconds, and the
 *     callers want a fresh number after every import.
 *   - Touch Dexie / IndexedDB. The estimate numbers come from the
 *     browser, not from our DB schema.
 */

/** What we hand back to the UI: how much we're using, how much
 *  we're allowed, and whether the browser has promised not to evict
 *  us under disk pressure. All numbers are bytes. */
export interface QuotaSnapshot {
	readonly usage: number;
	readonly quota: number;
	readonly persistent: boolean;
}

/** Threshold above which `<DocumentImport>` refuses to start a new
 *  import. 90% of the origin's quota leaves a thin margin so the
 *  next IndexedDB transaction does not race the eviction policy.
 *  The constant is exported so tests and UI badges can name the
 *  number they are enforcing, not duplicate `0.9` literals. */
export const QUOTA_REFUSE_THRESHOLD = 0.9;

/** Cached result of the first persistence attempt in this tab.
 *  `null` means "have not asked yet". `persist()` is spec'd as
 *  idempotent but some browsers surface the prompt on every call,
 *  which would be hostile to the reader; we cache so the browser is
 *  asked at most once per tab. The flag dies with the tab — exactly
 *  the "once per session" scope we want. */
let persistenceResult: boolean | null = null;

/** For tests only. Production code never resets this. */
export function _resetPersistenceRequestFlag(): void {
	persistenceResult = null;
}

/**
 * Ask the browser to mark this origin as persistent. Idempotent
 * within a tab: the first call asks the browser and caches the
 * answer; subsequent calls return the cached answer without
 * touching the browser.
 *
 * Returns `true` if storage is persistent (was already, or the
 * browser granted the request), `false` otherwise. Returns `false`
 * without throwing when `navigator.storage.persist` is not
 * supported.
 *
 * Why we never throw:
 *   - The callers are UI components that already render a fallback
 *     for "not persistent". A thrown error would force every caller
 *     to re-implement the same try/catch.
 *   - `persist()` may reject if the user dismissed the prompt; that
 *     is a normal user choice, not an error.
 */
export async function requestPersistenceIfNeeded(): Promise<boolean> {
	if (persistenceResult !== null) return persistenceResult;

	const storage = globalThis.navigator?.storage;
	if (storage?.persist === undefined) {
		persistenceResult = false;
		return false;
	}

	try {
		if (await storage.persisted()) {
			persistenceResult = true;
			return true;
		}
		const result = await storage.persist();
		persistenceResult = result;
		return result;
	} catch {
		persistenceResult = false;
		return false;
	}
}

/**
 * Read the current storage estimate. Returns `{ usage: 0, quota: 0,
 * persistent: false }` (instead of throwing) when the browser does
 * not support `estimate()` — the badge renders nothing in that case.
 *
 * Why we never throw:
 *   - `estimate()` can reject transiently (e.g. Safari private
 *     mode). The library screen already has enough to recover from
 *     a missing quota display; it does not need an error overlay.
 *   - The caller is a `QuotaBadge` that already has a "loading"
 *     state. A thrown error would force every caller to re-implement
 *     the same fallback.
 */
export async function readQuotaUsage(): Promise<QuotaSnapshot> {
	const storage = globalThis.navigator?.storage;
	if (storage?.estimate === undefined) {
		return { usage: 0, quota: 0, persistent: false };
	}

	let estimate: { usage?: number; quota?: number };
	try {
		estimate = await storage.estimate();
	} catch {
		return { usage: 0, quota: 0, persistent: false };
	}

	let persistent = false;
	try {
		persistent = (await storage.persisted?.()) ?? false;
	} catch {
		persistent = false;
	}

	return {
		usage: estimate.usage ?? 0,
		quota: estimate.quota ?? 0,
		persistent,
	};
}

/** Is the snapshot at or above the refuse threshold? Pure: callers
 *  pass the threshold they want to enforce so the UI can render
 *  different bands (info / warning / refuse) without this module
 *  growing presentation logic. Returns `false` when `quota` is 0,
 *  because "0 of 0" should not register as "over the limit". */
export function isQuotaOverThreshold(
	snapshot: QuotaSnapshot,
	threshold: number = QUOTA_REFUSE_THRESHOLD,
): boolean {
	if (snapshot.quota <= 0) return false;
	return snapshot.usage / snapshot.quota >= threshold;
}
