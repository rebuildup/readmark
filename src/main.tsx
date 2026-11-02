import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

const rootElement = document.getElementById('app-root');
if (!rootElement) {
	throw new Error('readmark: #app-root element not found in index.html');
}

const root = createRoot(rootElement);

/**
 * Mount the app. Directly — there is no start-up gate.
 *
 * What used to be here: `recoverUnmigratableDatabase()` ran before
 * the first render and, on failure, rendered a terminal error
 * screen instead of the app. ADR-0008 removed the premise: with no
 * database there is no schema to repair, no upgrade that can fail,
 * and no storage permission to be denied. The first paint is the
 * library, and the library states the session-only model in one
 * line.
 */
root.render(
	<StrictMode>
		<App />
	</StrictMode>,
);
