import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LibraryScreen } from './ui/library-screen.tsx';
import { ReaderScreen } from './ui/reader-screen.tsx';

export function App() {
	// `BASE_URL` is Vite's serving base (`/tools/readmark/app/` when the
	// host embeds this artifact, `/` standalone). Without it the router
	// matches `*` on the host path and `Navigate to="/"` rewrites the
	// document URL out of the tool's namespace (Issue #896 / CodeRabbit
	// on PR #87). With it, load, navigation and reload all stay under the
	// base; standalone (base `/`) behaves exactly as before.
	return (
		<BrowserRouter basename={import.meta.env.BASE_URL}>
			<Routes>
				<Route path="/" element={<LibraryScreen />} />
				<Route path="/read/:documentId" element={<ReaderScreen />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
