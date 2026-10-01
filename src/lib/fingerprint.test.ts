/**
 * readmark — fingerprint helper unit test.
 *
 * Locks the SHA-256 hex shape so future changes that break the
 * contract (e.g. switching to xxhash, switching to base64) fail
 * loudly here.
 */

import { describe, expect, it } from 'vitest';
import { fingerprintBytes } from './fingerprint.ts';

describe('fingerprintBytes', () => {
	it('produces a 64-char lowercase hex string', async () => {
		const hex = await fingerprintBytes(new TextEncoder().encode('readmark').buffer);
		expect(hex).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is deterministic for the same input', async () => {
		const a = await fingerprintBytes(new TextEncoder().encode('hello').buffer);
		const b = await fingerprintBytes(new TextEncoder().encode('hello').buffer);
		expect(a).toBe(b);
	});

	it('differs for different input', async () => {
		const a = await fingerprintBytes(new TextEncoder().encode('hello').buffer);
		const b = await fingerprintBytes(new TextEncoder().encode('hellp').buffer);
		expect(a).not.toBe(b);
	});
});
