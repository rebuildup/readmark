/// <reference types="vite/client" />

declare module '*?url' {
	const src: string;
	export default src;
}

declare module '*?worker' {
	const ctor: new () => Worker;
	export default ctor;
}

declare module '*?worker&inline' {
	const ctor: new () => Worker;
	export default ctor;
}

/**
 * Provided by the `readmark:pdfjs-support-tables` plugin in
 * `vite.config.ts`: how many files each pdf.js support-table
 * directory held at build time.
 */
declare module 'virtual:readmark-pdfjs-assets' {
	export const SUPPORT_TABLE_COUNTS: Readonly<{
		cmaps: number;
		standard_fonts: number;
		wasm: number;
		iccs: number;
	}>;
}
