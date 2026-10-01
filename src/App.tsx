import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LibraryScreen } from './ui/library-screen.tsx';
import { ReaderScreen } from './ui/reader-screen.tsx';

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<LibraryScreen />} />
				<Route path="/read/:documentId" element={<ReaderScreen />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
