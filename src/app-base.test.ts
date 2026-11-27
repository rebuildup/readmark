/**
 * The oracle for `APP_BASE`.
 *
 * Every consumer — Vite's `base`, the smoke probes, the dev-server
 * integration test, CI's namespace checks — reads `app-base.ts`, so a
 * wrong value there satisfies all of them. The value is a contract
 * with the host repo, which this repository cannot observe at
 * runtime; it is pinned here instead.
 */

import { describe, expect, it } from 'vitest';

import { APP_BASE } from '../app-base';

/**
 * `my-web-2026/src/tools/manifest.json`, readmark's entry:
 *
 *     "delivery": {
 *       "kind": "same_origin_static",
 *       "artifact_path": "/tools/readmark/app",
 *       …
 *     }
 *
 * A sibling repository, not an import — the contract can only be
 * stated as a literal, and only in this test, where it drives no URL.
 */
const HOST_ARTIFACT_PATH = '/tools/readmark/app';

describe('APP_BASE', () => {
	it("matches the host's delivery.artifact_path", () => {
		// Vite normalizes `base` to a trailing slash, so the constant is
		// the manifest path plus one.
		expect(APP_BASE).toBe(`${HOST_ARTIFACT_PATH}/`);
	});
});
