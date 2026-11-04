/**
 * Component test for the router shell.
 *
 * ## Why this file exists
 *
 * `App` hands Vite's serving base to `BrowserRouter`. Drop that prop
 * and the router matches `*` on the host path, `Navigate to="/"`
 * rewrites the document URL out of the tool's namespace, and load,
 * navigation and reload all break — the defect PR #87 fixed. Nothing
 * else catches it: every screen test mounts its own `MemoryRouter`
 * and never goes through `App`, so removing the prop leaves
 * `bun run validate` green.
 *
 * ## What is asserted, and why the value is not `/`
 *
 * The assertion is on the `basename` prop itself, compared against
 * `import.meta.env.BASE_URL`. Under vitest that value is `/`, so a
 * check on the rendered `href` prefix would pass against a hard-coded
 * `/` and prove nothing. The test therefore stubs `BASE_URL` to the
 * host namespace first: a dropped prop and a prop that stopped being
 * derived from the env both fail.
 *
 * `BrowserRouter` is wrapped, not replaced — `vi.fn` records the props
 * and the real component renders, so the mount below proves the app
 * actually came up under the basename it was given.
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type * as ReactRouterDom from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { listLibrary } from './storage/documents-repo.ts';

const capture = vi.hoisted(() => vi.fn<(props: { basename?: string }) => void>());

vi.mock('react-router-dom', async (importOriginal) => {
	const actual = await importOriginal<typeof ReactRouterDom>();
	function RecordedBrowserRouter(props: { basename?: string; children?: ReactNode }) {
		capture(props);
		return <actual.BrowserRouter {...props} />;
	}
	return { ...actual, BrowserRouter: RecordedBrowserRouter };
});

/**
 * The storage boundary: this file must not touch the store.
 * `library-list.test.ts` covers the list rules and
 * `scripts/smoke-library.mjs` covers the real cascade.
 */
vi.mock('./storage/documents-repo.ts', () => ({
	listLibrary: vi.fn(),
	deleteDocument: vi.fn(),
}));

/** Importing a PDF is #3's tested flow; here it is only a mounted control. */
vi.mock('./ui/document-import.tsx', () => ({
	DocumentImport: ({ onImported }: { onImported?: (result: unknown) => void }) => (
		<button type="button" onClick={() => onImported?.({ documentId: 'stub' })}>
			PDF を import
		</button>
	),
}));

const mockListLibrary = vi.mocked(listLibrary);

beforeEach(() => {
	// Not `/`: `BASE_URL` is `/` under vitest, and the point of this test
	// is that the prop follows the env rather than any literal.
	vi.stubEnv('BASE_URL', '/tools/readmark/app/');
	// The document URL has to sit under that base, as it does on the
	// host: a router given a basename renders nothing for a location
	// outside it, and the happy-dom default is `/`.
	window.history.pushState({}, '', '/tools/readmark/app/');
	mockListLibrary.mockReset();
	mockListLibrary.mockResolvedValue([]);
	capture.mockReset();
});

afterEach(() => {
	window.history.pushState({}, '', '/');
	vi.unstubAllEnvs();
});

describe('App', () => {
	it('hands Vite’s serving base to BrowserRouter', async () => {
		render(<App />);

		expect(capture).toHaveBeenCalledTimes(1);
		expect(capture.mock.calls[0]?.[0].basename).toBe(import.meta.env.BASE_URL);
		// The library screen finished loading under that basename.
		expect(await screen.findByTestId('rm-library-empty')).toBeInstanceOf(HTMLElement);
	});
});
