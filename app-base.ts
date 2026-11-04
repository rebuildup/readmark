// readmark — the URL prefix the host serves this app under.
//
// my-web-2026 mounts the build at its `delivery.artifact_path`, which is
// `/tools/readmark/app/`. The readers of this value all have to agree:
//
//   - `vite.config.ts` passes it to Vite as `base`, so every emitted URL
//     (index.html, chunks, the pdf.js worker, the support tables) is
//     prefixed with it.
//   - the smoke scripts build their preview and dev-server fetch URLs
//     with it. Divergence there is silent: the probe asks for
//     `/assets/...`, the server answers under the namespace, and the run
//     dies on a 404 that names neither copy.
//   - the dev-server integration test probes the running dev server with
//     it.
//   - CI's "Resolve host namespace" step reads it to verify the output of
//     both build targets.
//
// Because every check reads this one value, a wrong value here would pass
// all of them; `src/app-base.test.ts` pins it to the host's manifest,
// whose literal exists only in that test.
//
// The app itself never imports this module. It reads
// `import.meta.env.BASE_URL`, which Vite derives from `base`.

export const APP_BASE = '/tools/readmark/app/';
