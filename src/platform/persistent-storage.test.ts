/**
 * Unit tests for the persistent-storage platform wrapper.
 *
 * Coverage:
 *   - `requestPersistenceIfNeeded`:
 *       - Returns false when `navigator.storage` is absent.
 *       - Returns false when only `persist` is missing.
 *       - Calls `persist()` once when not already persistent.
 *       - Skips `persist()` when already persistent.
 *       - Only asks once per tab, even if called repeatedly.
 *       - Returns false (without throwing) when `persist()` rejects.
 *   - `readQuotaUsage`:
 *       - Returns zeros when `navigator.storage` is absent.
 *       - Returns usage, quota, and persistent from `estimate()`.
 *       - Returns zeros when `estimate()` rejects.
 *       - Treats missing `persisted()` as `persistent: false`.
 *   - `isQuotaOverThreshold`:
 *       - Pure: no DOM access.
 *       - Treats `quota: 0` as "unknown, not over".
 *       - Default 90% threshold respected.
 *       - Custom threshold respected.
 *
 * Why we override `navigator.storage` directly instead of mocking
 * the module: the wrapper reads `globalThis.navigator.storage` at
 * call time, so the only faithful seam is to swap the property. The
 * override is `configurable: true` so each test can install or
 * remove it without leaking state across files.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	_resetPersistenceRequestFlag,
	isQuotaOverThreshold,
	QUOTA_REFUSE_THRESHOLD,
	readQuotaUsage,
	requestPersistenceIfNeeded,
} from './persistent-storage.ts';

interface MockStorage {
	persist?: ReturnType<typeof vi.fn>;
	persisted?: ReturnType<typeof vi.fn>;
	estimate?: ReturnType<typeof vi.fn>;
}

function installMockStorage(overrides: Partial<MockStorage> = {}): MockStorage {
	const mock: MockStorage = {
		persist: vi.fn().mockResolvedValue(true),
		persisted: vi.fn().mockResolvedValue(false),
		estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 10000 }),
		...overrides,
	};
	Object.defineProperty(globalThis.navigator, 'storage', {
		value: mock,
		configurable: true,
	});
	return mock;
}

function removeMockStorage(): void {
	Object.defineProperty(globalThis.navigator, 'storage', {
		value: undefined,
		configurable: true,
	});
}

describe('requestPersistenceIfNeeded', () => {
	beforeEach(() => {
		_resetPersistenceRequestFlag();
		removeMockStorage();
	});
	afterEach(() => {
		_resetPersistenceRequestFlag();
		removeMockStorage();
	});

	it('returns false when navigator.storage is undefined', async () => {
		removeMockStorage();
		expect(await requestPersistenceIfNeeded()).toBe(false);
	});

	it('returns false when the persist() API is missing', async () => {
		installMockStorage({ persist: undefined });
		expect(await requestPersistenceIfNeeded()).toBe(false);
	});

	it('asks persist() when not already persistent', async () => {
		const mock = installMockStorage({
			persisted: vi.fn().mockResolvedValue(false),
			persist: vi.fn().mockResolvedValue(true),
		});
		expect(await requestPersistenceIfNeeded()).toBe(true);
		expect(mock.persisted).toHaveBeenCalledTimes(1);
		expect(mock.persist).toHaveBeenCalledTimes(1);
	});

	it('returns true without calling persist() when already persistent', async () => {
		const mock = installMockStorage({
			persisted: vi.fn().mockResolvedValue(true),
			persist: vi.fn().mockResolvedValue(true),
		});
		expect(await requestPersistenceIfNeeded()).toBe(true);
		expect(mock.persisted).toHaveBeenCalledTimes(1);
		expect(mock.persist).not.toHaveBeenCalled();
	});

	it('only asks once per tab, even if called many times', async () => {
		const mock = installMockStorage({
			persisted: vi.fn().mockResolvedValue(false),
			persist: vi.fn().mockResolvedValue(true),
		});
		expect(await requestPersistenceIfNeeded()).toBe(true);
		expect(await requestPersistenceIfNeeded()).toBe(true);
		expect(await requestPersistenceIfNeeded()).toBe(true);
		// `persist()` was asked once; the subsequent calls only re-read
		// `persisted()`. This is the contract that prevents the browser
		// from re-prompting the user on every import.
		expect(mock.persist).toHaveBeenCalledTimes(1);
	});

	it('returns false when persist() rejects', async () => {
		installMockStorage({
			persisted: vi.fn().mockResolvedValue(false),
			persist: vi.fn().mockRejectedValue(new Error('user declined')),
		});
		await expect(requestPersistenceIfNeeded()).resolves.toBe(false);
	});
});

describe('readQuotaUsage', () => {
	beforeEach(removeMockStorage);
	afterEach(removeMockStorage);

	it('returns zeros when navigator.storage is undefined', async () => {
		removeMockStorage();
		const snapshot = await readQuotaUsage();
		expect(snapshot).toEqual({ usage: 0, quota: 0, persistent: false });
	});

	it('returns zeros when estimate() is missing', async () => {
		installMockStorage({ estimate: undefined });
		const snapshot = await readQuotaUsage();
		expect(snapshot).toEqual({ usage: 0, quota: 0, persistent: false });
	});

	it('returns usage, quota, and persistent from estimate()', async () => {
		installMockStorage({
			estimate: vi.fn().mockResolvedValue({ usage: 5000, quota: 50000 }),
			persisted: vi.fn().mockResolvedValue(true),
		});
		const snapshot = await readQuotaUsage();
		expect(snapshot).toEqual({ usage: 5000, quota: 50000, persistent: true });
	});

	it('returns zeros when estimate() rejects', async () => {
		installMockStorage({
			estimate: vi.fn().mockRejectedValue(new Error('private mode')),
		});
		const snapshot = await readQuotaUsage();
		expect(snapshot).toEqual({ usage: 0, quota: 0, persistent: false });
	});

	it('treats missing persisted() as persistent: false', async () => {
		installMockStorage({
			estimate: vi.fn().mockResolvedValue({ usage: 100, quota: 1000 }),
			persisted: undefined,
		});
		const snapshot = await readQuotaUsage();
		expect(snapshot.persistent).toBe(false);
		expect(snapshot.usage).toBe(100);
		expect(snapshot.quota).toBe(1000);
	});

	it('coerces missing usage/quota fields to zero', async () => {
		installMockStorage({
			estimate: vi.fn().mockResolvedValue({}),
		});
		const snapshot = await readQuotaUsage();
		expect(snapshot).toEqual({ usage: 0, quota: 0, persistent: false });
	});
});

describe('isQuotaOverThreshold', () => {
	it('exposes a named default threshold', () => {
		expect(QUOTA_REFUSE_THRESHOLD).toBe(0.9);
	});

	it('returns false when quota is zero (estimate unsupported)', () => {
		// "0 of 0" must NOT register as over the limit; the badge hides
		// itself in that case and the import must not refuse.
		expect(isQuotaOverThreshold({ usage: 100, quota: 0, persistent: false })).toBe(false);
	});

	it('returns false below the default 90% threshold', () => {
		expect(
			isQuotaOverThreshold({ usage: 8000, quota: 10000, persistent: true }),
		).toBe(false);
	});

	it('returns true at the threshold', () => {
		expect(
			isQuotaOverThreshold({ usage: 9000, quota: 10000, persistent: true }),
		).toBe(true);
	});

	it('returns true above the threshold', () => {
		expect(
			isQuotaOverThreshold({ usage: 9500, quota: 10000, persistent: true }),
		).toBe(true);
	});

	it('respects a custom threshold', () => {
		expect(
			isQuotaOverThreshold({ usage: 5000, quota: 10000, persistent: true }, 0.5),
		).toBe(true);
		expect(
			isQuotaOverThreshold({ usage: 4999, quota: 10000, persistent: true }, 0.5),
		).toBe(false);
	});
});