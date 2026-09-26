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
