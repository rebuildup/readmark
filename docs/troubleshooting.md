# readmark — troubleshooting

> 開発中に踏みがちな落とし穴と、復旧手順。

## 1. `bun install` が `crypto` 関連で失敗する

`mise.toml` で bun と node のバージョンが混ざっていないか確認。bun が
`crypto.subtle` を使う場面で Node の古い crypto にフォールバックすると
失敗する。

```bash
mise install --locked
bun --version                  # 1.4.x であること
```

## 2. `pdfjs-dist` の worker が dev server で 404 になる

`vite.config.ts` の `optimizeDeps.exclude` に
`pdfjs-dist/build/pdf.worker.min.mjs` があるか確認。含まれていないと
Vite が worker を prebundle しようとして失敗する。

```ts
// vite.config.ts
optimizeDeps: {
  include: ["pdfjs-dist"],
  exclude: ["pdfjs-dist/build/pdf.worker.min.mjs"],
},
```

ブラウザの DevTools → Network で `pdf.worker.min.mjs` の URL が
200 で返っているか確認。

## 3. PDF.js が「fake worker」で動く警告

`pdfjsLib.GlobalWorkerOptions.workerSrc` が `?url` で取得した
文字列を指していないとき、pdf.js は自動で fake worker にフォールバック
する。`src/reader/pdf/pdf-worker.ts` がエントリの最初に同期で評価されて
いるか確認。

## 4. IndexedDB に書き込めない（QuotaExceededError）

`navigator.storage.estimate()` の値が quota の 90% を超えていないか確認。
超えていれば：

1. 古いドキュメントを Library から削除する。
2. または `navigator.storage.persist()` を再要求（既に persistent
   なら効果なし）。
3. 根本解決は EVICT された storage をユーザーに削除してもらう。

`platform/persistent-storage.ts`（将来追加）で `estimate()` を呼び出して
UI に quota を表示する。

## 5. Vitest が happy-dom で Web Crypto を找不到

`src/test/setup.ts` が Node の `webcrypto` を `globalThis.crypto` に
代入している。`vitest.config.ts` の `setupFiles` から漏れていないか：

```ts
// vitest.config.ts
test: {
  setupFiles: ["./src/test/setup.ts"],
  environment: "happy-dom",
},
```

## 6. React コンポーネントのテストが "Cannot use import statement outside a module" で落ちる

`react-router-dom` を import したテストが、アサーション 1 本も走ら
ないうちに SyntaxError で終わる場合、Vitest の `pool` が
`vmThreads` になっていないか確認する。

react-router 7 は CJS エントリを持ち、その CJS が自分の ESM ビルド
（`react-router/dom` → `dom-export.mjs`）を `require` する。
`vmThreads` ワーカー内では Node の CJS 条件が優先されてその `.mjs`
を CommonJS として parse するため、落ちる。`server.deps.inline` に
足しても解決しない（require は Node 側のローダー内で起きるため）。

```ts
// vitest.config.ts — pool を指定しない（既定の forks を使う）
test: {
  environment: "happy-dom",
  // pool / poolOptions は書かない
}
```

既定の `forks` は test file ごとに process を分けるので、隔離は保たれる。
pdf.js の global worker 状態も test 間で漏れない。

## 7. Biome が依存解決で循環参照を報告する

`useImportType` / `useExportType` ルールが効いている。type-only
import / export は `import type { … }` / `export type { … }` で
明示する（`verbatimModuleSyntax: true` も影響する）。

## 8. COOP / COEP の警告が出る（開発時）

`vite.config.ts` の `server.headers` で両方のヘッダーを出しているか
確認。本番（`vite preview`、nginx）も同様。

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## 9. PR を merge しようとすると "branch is out of date"

GitHub で "Update branch" ボタンを押す **or** `git pull --no-rebase` で
`main` を merge する（**rebase は使わない** — `allow_rebase_merge` が
無効だからといって `git rebase` 自体が禁止されているわけではないが、
PR には影響しない）。

## 10. my-web-2026 から iframe で開けない

- readmark の URL が `<iframe src>` と一致しているか確認。
- Containerfile の nginx が `try_files $uri $uri/ /index.html;` を
  持っているか（client-side routing 用）。
- 親ページが `X-Frame-Options: DENY` を付けていないか。

## 11. Skill のインストールが対話プロンプトで止まる

`bunx skills add …` は通常 agent が non-interactive 扱いで進む。手で
走らせている場合は `-y` を付ける：

```bash
bunx skills add rebuildup/project-init --skill quality-gate -y
```