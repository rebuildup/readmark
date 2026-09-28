import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { recoverUnmigratableDatabase } from './storage/db.ts';
import './styles.css';

const rootElement = document.getElementById('app-root');
if (!rootElement) {
	throw new Error('readmark: #app-root element not found in index.html');
}

const root = createRoot(rootElement);

/**
 * Clear a database Dexie cannot upgrade, then mount.
 *
 * Why this is a hard gate on the first render:
 *   - The failure it prevents is total and silent from the UI. Every
 *     query throws, the library renders empty, and the user has no way
 *     to tell that a hidden IndexedDB database is the cause. Letting
 *     the app mount first means the first thing a user sees is an
 *     error they cannot act on.
 *   - Any repository call opens the database, so there is no "safe"
 *     component to mount first and repair from later.
 *
 * A failure here is NOT swallowed: if recovery cannot even run, the
 * reason belongs on screen rather than in a console the user has not
 * opened. Mounting the app anyway would replace an honest message with
 * a misleading "could not load library" one, so the error render is
 * terminal.
 */
recoverUnmigratableDatabase()
	.then(() => {
		root.render(
			<StrictMode>
				<App />
			</StrictMode>,
		);
	})
	.catch((err: unknown) => {
		// Deliberately terminal: no `finally` that also mounts the app.
		// Rendering both would replace this message with a misleading
		// "could not load library" one and hide the real cause.
		console.error('readmark: database recovery failed', err);
		root.render(
			<StrictMode>
				<p role="alert" style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
					ローカルストレージを初期化できませんでした。ブラウザのストレージ許可を確認してから、
					ページを再読み込みしてください。
				</p>
			</StrictMode>,
		);
	});
