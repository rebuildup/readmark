/**
 * readmark — vitest setup.
 *
 * jsdom / happy-dom do not implement Web Crypto out of the box in a way
 * that matches browser semantics for SubtleCrypto.digest. Polyfill to the
 * Node built-in so unit tests on `fingerprint.ts` work.
 */

import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
	Object.defineProperty(globalThis, 'crypto', {
		value: webcrypto,
		configurable: true,
	});
}
