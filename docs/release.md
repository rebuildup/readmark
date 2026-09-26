# readmark — release process

> SemVer リリースと main 保護ルール。rebuildup/project-init の
> release-driven solo profile に準拠。

## 1. バージョン

SemVer（`<major>.<minor>.<patch>`）。

- **major**: 破壊的変更（reader interface、storage schema の破壊変更、
  ADR 番号の整合性が崩れる変更）。
- **minor**: 後方互換な機能追加（例: EPUB 対応）。
- **patch**: バグ修正、文書修正。

タグは `v0.1.0` 形式で `v` prefix 付き。

## 2. ブランチ

- `main` — リリース済み状態のみ。直接 push 禁止。
- `release-X.Y.Z` — リリース準備 branch。`main` への唯一の merge 元。
- `<issue-number>` — 1 つの Issue / PR に対応する作業 branch。
- stacked PR は先行 PR branch を base にする。

## 3. main への到達経路

```
   ┌─────────────────┐         ┌─────────────────┐
   │ 1, 2, 3, …      │         │ release-0.1.0   │
   │ (feature PRs)   │ ──────▶ │                 │
   │                 │         │                 │
   └─────────────────┘         └────────┬────────┘
                                        │
                                        │ merge commit
                                        ▼
                               ┌─────────────────┐
                               │ main            │
                               │ + tag v0.1.0    │
                               └─────────────────┘
```

リリース PR は **`release-X.Y.Z → main` のみ**。その他の branch から
main への PR は rule で拒否する（GitHub ruleset で preflight）。

## 4. リリース手順

1. `git checkout main && git pull`
2. `git checkout -b release-X.Y.Z`
3. バージョンを更新：
   - `package.json` の `version`
   - `README.md` の "MVP の対象範囲"（更新があれば）
4. CHANGELOG を更新（`docs/release-notes/vX.Y.Z.md`）。
5. `bun run validate` をローカルで通す。
6. Draft PR を開く：`base: main`, `compare: release-X.Y.Z`。
7. CI を確認後、Ready for Review。
8. merge commit で `main` に merge。
9. `main` でタグを打つ：`git tag -a vX.Y.Z -m "Release X.Y.Z"`。
10. タグを push：`git push origin vX.Y.Z`。
11. （任意）Container イメージを build / push。

## 5. main 保護ルール（GitHub）

推奨設定：

- **Branch protection / ruleset on `main`**:
  - PR required
  - Required approving reviews: **0**（solo-dev 想定）
  - Conversation resolution required
  - Required status checks: なし（project-init の Ruleset deadlock 回避）
  - Direct push / web edit / force push / delete: 禁止
  - Bypass: 無効

- **Repository merge settings**:
  - `allow_merge_commit`: **true**
  - `allow_squash_merge`: **false**
  - `allow_rebase_merge`: **false**

## 6. CI

`.github/workflows/ci.yml` が PR / `main` push / `release-*` push /
numeric branch push で `bun run validate:fast` を実行する。required
status check にはしない（rule deadlock 回避）。

## 7. Hotfix

緊急の修正：

1. `main` から `hotfix-X.Y.Z+1` を切る（or `release-X.Y.Z+1` を上げる）。
2. 修正を積む。
3. `main` に release PR を立てる。
4. タグを打つ。

## 8. やらないこと

- GitHub Projects（project-init の方針で禁止）。
- required status checks（rule deadlock 回避）。
- auto-merge（squash / rebase merge が無効なので無意味）。