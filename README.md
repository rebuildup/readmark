# readmark

ローカルファーストの読書環境。ブラウザで文書を開いて読むだけでなく、その
文書に対する「読書状態」を継続して保持できます。

- **MVP 対応フォーマット**: PDF
- **将来対応**: EPUB / Markdown / プレーンテキスト
- **対応プラットフォーム**: デスクトップブラウザ（Chrome / Firefox /
  Safari の現行版）
- **対応言語**: 日本語UI、英語コードコメント

## 設計の骨格

readmark はファイルビューアではなく、読書アプリです。

- 文書本体（PDF 等）と読書状態（最終閲覧位置・栞・ハイライト・メモ）は
  分離して管理します（[ADR-0002](./docs/adr/ADR-0002-document-source-and-reading-state-separation.md)）。
- identity は 2 層に分かれます：
  - **`DocumentId`**（論理的）— UUID。読書状態のキー。
  - **`SourceFingerprint`**（物理的）— バイト列の SHA-256。ハイライト
    のキー（特定のバイト列の中の位置だから）。
  - MVP では 1:1。将来的に「同じ本の複数版を束ねる」UI を足せる形に
    なっています。
- 永続化はすべて IndexedDB（Dexie）。`localStorage` に大きなデータは
  入れません。
- PDF レンダラーは `src/reader/pdf/` に閉じ込め、アプリの他の層は
  `pdfjs-dist` を直接 import しません
  （[ADR-0004](./docs/adr/ADR-0004-pdf-renderer-isolation.md)）。
- ネットワーク・アカウント・サーバ・バックエンドは MVP に存在しません。
- my-web-2026 との統合方式（リンク / iframe / 同一origin）は意図的に
  未決定です（[ADR-0006](./docs/adr/ADR-0006-deployment-and-integration-options.md)）。

## クイックスタート

```bash
# 1. ツールチェーン
mise install

# 2. 依存関係
bun install

# 3. 開発サーバ
bun run dev          # http://localhost:5173

# 4. 検証（typecheck + lint + test）
bun run validate:fast

# 5. ビルド（静的バンドル、Containerfile で配信可能）
bun run build
```

## ディレクトリ構成

```
readmark/
├─ AGENTS.md             # 必須のエージェント常駐ルール
├─ README.md             # このファイル
├─ CONTRIBUTING.md       # 人間コントリビュータ向け
├─ LICENSE               # MIT
├─ mise.toml             # ツールチェーン（bun / node / ripgrep）
├─ package.json          # 依存関係 + packageManager pin
├─ tsconfig.json         # strict + verbatimModuleSyntax
├─ vite.config.ts        # pdf.js worker + COOP/COEP
├─ vitest.config.ts      # 単体テスト（happy-dom）
├─ biome.json            # formatter + linter
├─ Containerfile         # 本番は nginx + dist/ を host
├─ docs/
│  ├─ architecture.md
│  ├─ development.md
│  ├─ release.md
│  ├─ troubleshooting.md
│  └─ adr/               # ADR-0001 〜 ADR-0006
├─ src/
│  ├─ main.tsx           # entry
│  ├─ App.tsx            # router shell
│  ├─ styles.css         # デザイントークン + 最小スタイル
│  ├─ domain/            # format-agnostic types（Document / ReadingState）
│  ├─ storage/           # Dexie スキーマ + repositories
│  ├─ reader/            # reader 契約 + per-format 実装（pdf はここ）
│  ├─ annotation/        # W3C-inspired anchor model
│  ├─ library/           # ライブラリ系フロー
│  ├─ ui/                # React 画面
│  ├─ stores/            # Zustand（UI state のみ）
│  ├─ platform/          # navigator.storage 等の薄いラッパー
│  ├─ lib/               # utilities（fingerprint.ts）
│  └─ test/              # vitest setup
├─ public/
│  └─ favicon.svg
└─ scripts/
   └─ nginx.conf         # 本番配信設定
```

## MVP の対象範囲

含む:

1. ローカル PDF の import
2. import した文書をブラウザ内ライブラリへ保存
3. ライブラリから再度開く
4. PDF の閲覧
5. 最後に読んでいたページ・位置の自動保存と復元
6. 栞の追加・削除
7. PDF テキストの選択
8. 選択範囲へのハイライト
9. ハイライトへのメモ
10. 栞・ハイライト・メモの一覧
11. 一覧から該当位置へのジャンプ

含まない：

- アカウント / サーバ / クラウド同期
- 複数端末同期
- PDF ファイル自体への annotation 書き込み
- EPUB / Markdown / テキスト対応
- AI 機能
- テレメトリ
- my-web-2026 との統合方式の固定

## 開発ルール

詳細は `AGENTS.md` を参照。要点だけ：

- Biome のみで format + lint。Prettier / ESLint は使わない。
- テストは `bun run test`（Vitest）。
- 新規 dependency を足す前に `engineering-decisions` Skill を load する。
- 設計判断は `docs/adr/` に ADR を書く。判断を ADR に残さずに行うのは
  禁止。

## my-web-2026 との関係

readmark は rebuildup/my-web-2026 リポジトリから独立した別リポジトリで
開発します。最終的にどう統合するか（リンク / iframe / 同一 origin）は
意図的に未決定です（[ADR-0006](./docs/adr/ADR-0006-deployment-and-integration-options.md)）。
readmark は単体で価値を持つ独立 Web アプリとして成立しています。

両リポジトリは：

- ソースを共有しません
- デザイントークンを共有しません
- CI を共有しません
- 同期されるタイミングもありません（明示的に切った）

## ライセンス

MIT — `LICENSE` を参照。