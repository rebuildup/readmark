# readmark — development

> ローカル開発・環境変数・よく使うコマンド。

## 1. 必要環境

| ツール | バージョン | 入手元 |
| ------ | ---------- | ------ |
| mise   | 2026.9.x 以降 | https://mise.jdx.dev/ |
| bun    | 1.4.2（mise.toml） | mise がインストール |
| node   | 24.11.0（mise.toml） | mise がインストール（bun の fallback 用） |
| ripgrep | 14.1.0（mise.toml） | mise がインストール |

mise が入っていれば：

```bash
mise install                  # mise.toml + bun.lock から全部入る
mise install --locked         # CI 用：lockfile 違反で即失敗
```

`nvm` / `fnm` / `volta` を併用しない。mise が唯一のソース。

## 2. 依存関係

```bash
bun install                   # package.json + bun.lock
bun install --frozen-lockfile  # CI 用
```

`package.json` の `packageManager` フィールドが bun を pin している。
別の package manager に切り替える ADR は未承認。

## 3. スクリプト

| コマンド | 用途 |
| -------- | ---- |
| `bun run dev` | Vite dev server（http://localhost:5173） |
| `bun run build` | `dist/` に静的バンドル出力 |
| `bun run preview` | ビルド成果物をローカルで配信 |
| `bun run typecheck` | `tsc -b --noEmit` |
| `bun run lint` | Biome check（読み取り専用） |
| `bun run lint:fix` | Biome check --write（自動修正） |
| `bun run format` | Biome format --write |
| `bun run test` | Vitest 単体テスト 1 回実行 |
| `bun run test:watch` | Vitest ウォッチモード |
| `bun run validate` | typecheck + lint + test + build |
| `bun run validate:fast` | typecheck + lint + test（PR 前） |
| `bun run skills` | `bunx skills` のショートカット |
| `bun scripts/smoke-import.mjs` | import フロー（#3）のブラウザ smoke |
| `bun scripts/smoke-library.mjs` | ライブラリ一覧（#4）のブラウザ smoke |
| `bun scripts/smoke-reader.mjs` | Reader（#11）のブラウザ smoke |
| `bun scripts/smoke-geometry.mjs` | highlight geometry（#7）のブラウザ smoke |
| `bun scripts/smoke-pdf-assets.mjs` | pdf.js の support table（CMap / standard font / wasm）が `dist/` にあり HTTP で取得できることの smoke |
| `bun scripts/smoke-schema-upgrade.mjs` | 旧スキーマの IndexedDB を app が回復できることの smoke |

> `smoke-geometry` / `smoke-pdf-assets` / `smoke-schema-upgrade` は
> **それぞれ 1 種類の環境依存を検出する**。他の smoke は毎回 Chromium
> profile が新品なので、IndexedDB が壊れている状態と pdf.js の
> support table が `dist/` に無い状態を再現できない。それぞれ
> `docs/troubleshooting.md` §4 / §5 に対応する。

### ブラウザ smoke

`scripts/smoke-*.mjs` は `bun run preview`（= `bun run build` 済み）を
headless Chromium で操作する one-shot のスクリプトで、CI では動かない。
共通の土台（preview 起動、Chromium 起動、count の settle、IndexedDB の
store 件数読み出し）は `scripts/smoke-harness.mjs` にある。

```bash
bun run build
bun scripts/smoke-library.mjs
```

Storage を触る変更（import / delete / schema）は、unit test だけでは
「DOM から消えたが store には残っている」ような取りこぼしを検出できな
い。該当する場合は smoke を走らせてから PR を Ready にする。

描画・layout・Selection に依存する変更（reader / text layer / zoom /
rotation）も同じで、happy-dom には canvas も layout も実 Selection も
無いので、主張の根拠は smoke 側になる。

## 4. 環境変数

> env schema はリポジトリ root の `.env.example` を canonical として
> 扱う。`.env`, `.env.development`, `.env.production` は gitignore。

MVP で必要な env 変数は 1 つだけ：

| 変数 | デフォルト | 用途 |
| ---- | ---------- | ---- |
| `READMARK_EPHEMERAL` | `false` | true で IndexedDB 永続化を拒否（プレビュー / sandbox mode 用） |

それ以外（`READMARK_TELEMETRY` や `READMARK_ENABLE_EPUB` 等）は MVP
では **schema にも存在しない**。テレメトリは ADR-0001 で
「含めない」と決めており、EPUB は ADR-0003 で「post-MVP」と決めて
いるため、YAGNI に従い schema を膨らませない。必要になった時点で
ADR と一緒に追加する。

### `.env.example` の正本

`.env.example` はリポジトリに正本としてコミットされている。
開発を始める際はこれを `.env` にコピーして使う：

```dotenv
# readmark — local development env schema.
#
# Copy this file to .env (gitignored) and edit as needed. The env
# schema here is the canonical contract between local development
# and the runtime; CI does not read .env files.
#
# Why so few variables?
#   - MVP is local-first; no backend, no telemetry, no remote
#     feature flags (ADR-0001, ADR-0003).
#   - YAGNI: variables for unimplemented features belong with the
#     ADR that introduces them. Adding `READMARK_TELEMETRY` or
#     `READMARK_ENABLE_EPUB` here would imply those features are
#     on the MVP roadmap — they are not.

# When true, IndexedDB persistence is bypassed. Useful for
# ephemeral preview / sandbox mode where every reload starts
# from an empty library.
READMARK_EPHEMERAL=false
```

CI は `.env.example` を参照しない（`.env*` を読みに行く step が
ない）。schema が変わったら `.env.example` とこのセクションを同時に
更新する。

## 5. 開発フロー

1. Issue を立てる or 既存の Issue を自分にアサイン。
2. ブランチを切る：`git checkout -b 42`（Issue 番号のみ）。
3. 最初の意味のある commit をする。
4. **Draft PR を開く**。base は main（最初の PR）または先行 PR branch。
5. 実装を進める。PR description の "WIP" チェックを外す準備ができたら
   Ready for Review にする。
6. CI（`validate:fast`）が通ったらレビュアー（自分）をアサイン。
7. merge commit で merge（squash / rebase は無効化されている）。
8. release の流れは `docs/release.md` を参照。

## 6. Skills

このリポジトリでは次の Skill を `bunx skills add` で導入する：

| Skill | 用途 |
| ----- | ---- |
| `writing-discipline` | 永続的な散文（README、ADR、Issue、PR） |
| `engineering-decisions` | 設計判断のエスカレーション判断 |
| `github-delivery` | Issue / PR / release sprint |
| `quality-gate` | quality gate の設計・更新 |
| `worktree-workflow` | worktree 操作 |

```bash
bunx skills add rebuildup/project-init --skill writing-discipline
bunx skills add rebuildup/project-init --skill engineering-decisions
bunx skills add rebuildup/project-init --skill github-delivery
bunx skills add rebuildup/project-init --skill quality-gate
bunx skills add rebuildup/project-init --skill worktree-workflow
```

`AGENTS.md` §9 の表も参照。

## 7. トラブルシューティング

### `bun install` が失敗する

- `mise install` を先に走らせたか確認。
- `bun.lock` がリポジトリに存在するか確認。
- `corepack` を使っていないか。`corepack disable && bun install` で
  凌ぐ。

### `pdfjs-dist` の worker が動かない

- Vite の `?url` で読み込んでいるか確認
  （`vite.config.ts` の `optimizeDeps.exclude`）。
- `pdf.worker.min.mjs`（`.js` ではない）がロードされているか。
- COOP / COEP ヘッダーが dev server から出ているか
  （`curl -I http://localhost:5173/` で確認）。

### Vitest が Web Crypto を找不到

`src/test/setup.ts` が `globalThis.crypto` を Node の `webcrypto` に
polyfill している。`vitest.config.ts` の `setupFiles` から漏れていないか。

### Biome が依存解決で怒る

- `biome.json` の `$schema` URL が `@biomejs/biome` のバージョンと一致
  しているか。
- IDE が `biomejs.biome` 拡張を認識していない場合は VS Code の
  `.vscode/settings.json` を確認。

## 8. ディレクトリ慣習

| 用途 | 場所 |
| ---- | ---- |
| 一時ファイル（生成物・実験） | `.tmp/`（gitignore） |
| クローンした参照リポジトリ | `.reference/`（gitignore） |
| 設計 ADR | `docs/adr/ADR-NNNN-<slug>.md` |
| リリースノート | `docs/release-notes/` |
| Storybook ストーリー | （将来追加）`src/**/*.stories.tsx` |
| E2E テスト | （将来追加）`e2e/` |

## 9. 参考

- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/architecture.md`
- `docs/troubleshooting.md`
- `docs/release.md`
- rebuildup/project-init — meta-template