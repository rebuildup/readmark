# CONTRIBUTING

> readmark へのコントリビュートガイド。
> 人間・AI どちらの contributor も、この文書と `AGENTS.md` を最初に
> 読むこと。

## 1. 行動規範

これは個人プロジェクト（rebuildup 個人サイト群の一部）です。
コントリビュート前に Issue もしくは Discussion で提案してください。
独断での大きな変更は取り込まれない可能性が高いです。

## 2. 開発の始め方

```bash
git clone <this-repo>
cd readmark
mise install             # bun / node / ripgrep
bun install              # 依存関係
bun run validate:fast    # 動作確認（typecheck + lint + test）
bun run dev              # 開発サーバ（http://localhost:5173）
```

Node は mise が入れたものを使う。`nvm` / `fnm` / `volta` を併用しない
（project-init ADR-0022）。

## 3. 提案の出し方

- **機能追加 / 仕様変更**: GitHub Issue を立てる。
  - 「現状」「動機」「提案」「受け入れ条件」を書く（短い散文でよい）。
  - 大きな変更は design-refinement Skill を load してから書く。
- **バグ修正**: GitHub Issue を立てるか、直接 Draft PR を出す。
  - 再現手順と期待する挙動を書く。

## 4. ブランチ / PR

- ブランチ名は **Issue 番号のみ**（例: `42`）。`issue/42` のような
  prefix は禁止。
- 最初の意味のある commit の直後に **Draft PR を開く**。
  PR を最後に開くのは禁止。
- stacked PR は先行 PR の branch を base にする。`main` を直接 base
  にしない。
- merge commit のみ。squash / rebase merge は **このリポジトリでは
  無効化されている**。
- PR description には最低限：
  - 解決する Issue 番号（`Closes #N`）
  - 変更内容の要約
  - 動作確認手順
  - 該当 ADR 番号（変更が ADR に触れる場合）

## 5. コーディング規約

- TypeScript strict mode + `verbatimModuleSyntax: true`。
- Biome のみで format + lint。`bun run lint:fix` で自動修正。
- 1 タブインデント、LF、UTF-8、trim trailing whitespace（`.editorconfig`）。
- 単一引用符（`'`）、JSX 内は二重（`"`）、末尾カンマあり、セミコロンあり
  （`biome.json`）。
- `any` は警告。やむを得ない場合は理由コメントを付ける。
- 関数の戻り値型は明示する（暗黙 return 型は可だが、export は型注釈必須）。

## 6. 依存関係の追加

新しい dependency を追加する前に：

1. 既存の同等の dependency と本当に競合しないか確認する。
2. bundle size / メンテナンス状況 / ライセンスを確認する。
3. `engineering-decisions` Skill を load する。
4. ADR を書く（`docs/adr/ADR-NNNN-<slug>.md`）。

React Router / Zustand / Dexie のようなカテゴリの重複（例: 「TanStack
Query を追加する」）は ADR 必須。

## 7. テスト

- 単体テスト: Vitest（`bun run test`）。`src/**/*.test.ts` / `.tsx`。
- E2E: 将来追加予定。Playwright を Containerfile で動かせる段階になったら
  ADR を書く。
- カバレッジ閾値は強制しない（project-init ADR の方針）。`bun run
  test:coverage` でオプトイン計測のみ。

## 8. コミットメッセージ

- 1 行目: 命令形・現在形・英語（例: `Add PDF import to library`）。
- 2 行目: 空行。
- 3 行目以降: 必要なら日本語で詳細。
- 1 コミット = 1 論理変更。fixup / wip を積んだまま PR を出さない。

## 9. リリース

詳細は `docs/release.md` を参照。要点：

- SemVer。`<major>.<minor>.<patch>`。
- release branch は `release-X.Y.Z` 形式。
- main への merge は `release-X.Y.Z → main` の PR だけ。
- タグは release commit に打つ。

## 10. 問い合わせ

GitHub Issue / Discussion のみ。メーリングリスト / Slack はなし。

## 11. 言語ポリシー

- コード: 英語
- ドキュメント / Issue / PR / レビューコメント: 日本語
- コミット 1 行目: 英語
- コミット詳細: 日本語可

詳細は `AGENTS.md` §1。