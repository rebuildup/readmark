import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

const rootElement = document.getElementById('app-root');
if (!rootElement) {
	throw new Error('readmark: #app-root element not found in index.html');
}

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
