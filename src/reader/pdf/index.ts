/**
 * readmark — PDF reader entry point.
 *
 * The one module outside `src/reader/pdf/` that generic code imports
 * for PDF reading. It re-exports the format-agnostic contract's
 * implementations and nothing else, so `pdfjs-dist` types and the
 * pdf.js-shaped classes stay inside the folder (ADR-0004 §Boundary,
 * enforced by Biome `noRestrictedImports`).
 *
 * The screen imports this module dynamically so the Library route
 * does not load pdf.js before a document is opened.
 */

export {
	nextRotation,
	pdfPointToScreen,
	pdfRectToScreen,
	rotationSwapsDimensions,
	type ScreenPoint,
	type ScreenRect,
	screenPointToPdf,
	type ViewportLike,
	viewportSize,
} from './pdf-coords.ts';
export { PdfInvalidError } from './pdf-errors.ts';
export { PDF_PAGE_CLASS, PdfPageHandle } from './pdf-page.ts';
export { createPdfReader, PdfReaderHandle } from './pdf-reader.ts';
export type { GlyphRun } from './pdf-text-layer.ts';
