// readmark — the URL prefix the host serves this app under.
//
// my-web-2026 mounts the build at its `delivery.artifact_path`, which is
// `/tools/readmark/app/`. Two build-side consumers have to agree on it:
//
//   - `vite.config.ts` passes it to Vite as `base`, so every emitted URL
//     (index.html, chunks, the pdf.js worker, the support tables) is
//     prefixed with it.
//   - the smoke scripts build their preview and dev-server fetch URLs
//     with it. Divergence there is silent: the probe asks for
//     `/assets/...`, the server answers under `/tools/readmark/app/assets/...`,
//     and the run dies on a 404 that names neither copy.
//
// The app itself never imports this module. It reads
// `import.meta.env.BASE_URL`, which Vite derives from `base`.

export const APP_BASE = '/tools/readmark/app/';
