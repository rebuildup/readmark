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

## 4. PDF の文字が一切描画されない（日本語 PDF で多い）

**症状**: PDF は開く。ページ数・スクロール・ズームも動く。
`getTextContent()` は正しい文字列を返す。それなのに **glyph が 1 つも
描画されない**。fallback フォントに置き換わるのではなく、空になる。

**原因**: pdf.js は CMap / standard font / wasm を **描画時に URL で
fetch する**。モジュールグラフから import されないので、バンドラが出力
する理由がない。`vite build` の既定では `dist/` にこれらのファイルが
存在せず、該当リクエストは 404 になる。

```bash
# 確認: dist に support table があるか
ls dist/assets/pdfjs/cmaps | head
ls dist/assets/pdfjs/standard_fonts | head
```

**対策**: `vite.config.ts` の `pdfjsSupportTables()` プラグインが
`dist/assets/pdfjs/` へコピーし、`src/reader/pdf/pdf-document.ts` が
`cMapUrl` / `standardFontDataUrl` / `wasmUrl` / `iccUrl` を
`getDocument()` に渡す。どちらか一方でも欠けると再現する。

**切り分け**: console に
`Ensure that the cMapUrl API parameter is provided` が出ていればこれが
原因。`bun scripts/smoke-pdf-assets.mjs` が dist と HTTP の両方を検証する。

**dev と build で path がズレる（重要）**: support table の base URL は
`import.meta.env.BASE_URL` から導く。worker の URL から誘導しては
いけない。Vite は dev では worker を `/node_modules/pdfjs-dist/build/…`
から配信するため、その directory を切ると存在しない path になり、
**`bun run dev` だけ全 PDF の文字が消え `bun run preview` は正常**という
最も調査しづらい形になる。`smoke-support-tables.mjs` が dev と build の
両方を検証する。

**未解決の制約**: 極端に大きい画像（`/Width` `/Height` が 16-bit の
上限を超える）は Chromium の canvas がデコードできない。pdf.js は
`InvalidStateError: The source image could not be decoded` を console に
出すだけで、ページは「画像だけが欠けた」状態で描画される。設定では直せない。

**注意**: PDF 側のフォントが埋め込まれている PDF だけは、この設定が
なくても描画される。**埋め込みのない PDF**（日本の PDF の大半は
Type0 / Identity-H で CMap に依存する）だけが落ちるため、
「特定の PDF でだけ壊れる」ように見える。

## 5. `UpgradeError: Not yet support for changing primary key`

**症状**: ライブラリが空のまま。import が入らない。console に
`SchemaDiff` / `Unable to patch indexes of table documents`。
リロードしても直らない。

**原因**: `db.version(N)` を、**互換性のないスキーマに再利用**した。
IndexedDB は object store の主キー（keyPath）を変更できず、Dexie は
その upgrade を拒否する。ブラウザに残った古い DB は恒久的に壊れる。

**効かない回避策**: 次の 3 つは**いずれも期待どおりに働かない**。

| 試した変更 | 結果 |
| --- | --- |
| 古いスキーマを低い version として宣言する | **再現する**。Dexie は宣言された version を順に再生するので、古い browser を pre-split スキーマへ walk してから主キー変更を要求される |
| 間に空の version を挟む | 効かない。`.stores()` は累積なので、最終差分に主キー変更が残る |
| version number だけ上げる | 必要だが不十分。古い DB の破棄は別途必要 |

**正しくやるには**:

- 過去の `version()` ブロックは**編集・削除しない**。
- 次の version は**主キーを触らない追加**に留める。table / index の
  追加は通常の upgrade として rows を保持したまま通る。
- 主キーの変更が避けられないなら、破棄してよい理由を
  `recoverUnmigratableDatabase()` のコメントに明記する。

**確認方法**: `bun scripts/smoke-schema-upgrade.mjs`。

## 6. IndexedDB に書き込めない（QuotaExceededError）

`navigator.storage.estimate()` の値が quota の 90% を超えていないか確認。
超えていれば：

1. 古いドキュメントを Library から削除する。
2. または `navigator.storage.persist()` を再要求（既に persistent
   なら効果なし）。
3. 根本解決は EVICT された storage をユーザーに削除してもらう。

`platform/persistent-storage.ts`（将来追加）で `estimate()` を呼び出して
UI に quota を表示する。

## 7. Vitest が happy-dom で Web Crypto を找不到

`src/test/setup.ts` が Node の `webcrypto` を `globalThis.crypto` に
代入している。`vitest.config.ts` の `setupFiles` から漏れていないか：

```ts
// vitest.config.ts
test: {
  setupFiles: ["./src/test/setup.ts"],
  environment: "happy-dom",
},
```

## 8. React コンポーネントのテストが "Cannot use import statement outside a module" で落ちる

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

## 9. Biome が依存解決で循環参照を報告する

`useImportType` / `useExportType` ルールが効いている。type-only
import / export は `import type { … }` / `export type { … }` で
明示する（`verbatimModuleSyntax: true` も影響する）。

## 10. COOP / COEP の警告が出る（開発時）

`vite.config.ts` の `server.headers` で両方のヘッダーを出しているか
確認。本番（`vite preview`、nginx）も同様。

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## 11. PR を merge しようとすると "branch is out of date"

GitHub で "Update branch" ボタンを押す **or** `git pull --no-rebase` で
`main` を merge する（**rebase は使わない** — `allow_rebase_merge` が
無効だからといって `git rebase` 自体が禁止されているわけではないが、
PR には影響しない）。

## 12. my-web-2026 から iframe で開けない

- readmark の URL が `<iframe src>` と一致しているか確認。
- Containerfile の nginx が `try_files $uri $uri/ /index.html;` を
  持っているか（client-side routing 用）。
- 親ページが `X-Frame-Options: DENY` を付けていないか。

## 13. Skill のインストールが対話プロンプトで止まる

`bunx skills add …` は通常 agent が non-interactive 扱いで進む。手で
走らせている場合は `-y` を付ける：

```bash
bunx skills add rebuildup/project-init --skill quality-gate -y
```