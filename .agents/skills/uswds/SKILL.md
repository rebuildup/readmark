---
name: uswds
description: >
  Adapt U.S. federal public-service websites and transactional flows to current USWDS conventions while preserving service semantics, trust, agency identity, progress, and accessibility.
---

# USWDS

U.S. Web Design System を「政府らしい見た目」として模倣せず、米国連邦政府の public-service context における trust、agency identity、service journey、progress、component semantics へ現在の artifact を適応するときに使う。

`form-design`、`navigation-design`、`content-design`、`interaction-states`、`keyboard-interface`、`responsive-design`、`internationalization-design`、`cognitive-accessibility`、`inclusive-design`、`accessibility-audit` は各 underlying problem の canonical source とする。この Skill は USWDS 固有の system adaptation だけを担当する。

## Workflow

1. 対象が U.S. federal service / agency context か確認する。そうでなければ USWDS の federal identity conventions を持ち込まない。
2. 現在の USWDS version、component guidance、accessibility test status を確認する。
3. service outcome、responsible agency、official-site trust signal、site/service chrome、task content を分離する。
4. relevant な component / pattern reference を複数開き、下記の observation axes で比較する。
5. exact token、logo、markup をコピーせず、意味・責務・trade-off を current project へ翻訳する。
6. realistic end-to-end task を rendered artifact で検証する。

## Observe

- official-site trust signal と product/agency branding の責務境界
- highest-level responsible agency と service/product identity の階層
- site-wide chrome と page/task content の分離
- linear / nonlinear / conditional process と progress representation の対応
- current / complete / pending state の区別と、progress と navigation の分離
- complex form での expectation、privacy/security explanation、progression、review/record
- identity/profile data が domain requirement と user dignity の双方をどう扱うか
- component の current version、accessibility test status、implementation-specific caveat
- narrow/wide、keyboard、zoom、long/localized content で意味が維持されるか

## Decision rules

### Federal trust と identity を分ける

Banner は official U.S. government website であることを説明する trust surface として扱う。Identifier は highest-level responsible agency と required federal links を示す accountability surface として扱う。どちらも decorative federal branding や generic footer/header preset にしない。

parent agency、service/product、site footer の情報を重複させない。Identifier に product logo を入れて agency identity と product identity を混同しない。

### Progress を navigation にしない

Step indicator は、複数 page にまたがり、安定した high-level chapter を持つ linear process にだけ使う。conditional input により step 数・順序が変わる場合、nonlinear completion、短い process では別の orientation model を選ぶ。

Step indicator 自体を forward/back navigation にしない。current / completed / pending を視覚だけでなく意味として区別し、page heading と navigation controls は別に持つ。

### Complex form は field collection より service interaction として見る

長い申請・登録では、開始前に必要情報、情報利用、privacy/security、所要・保存・再開条件を必要に応じて説明する。途中では入力を失わせず、現在地と次の行動を理解可能にする。submission 後は回答・receipt・reference 等、利用者が interaction の記録を保持できる方法を service requirement に応じて用意する。

個別 field の label、validation timing、question sequence は `form-design` を優先する。

### Current implementation を evidence として扱う

USWDS の component badge や accessibility test result は baseline evidence であり、customized implementation の conformance 保証ではない。current version と latest update を確認し、実装後に project context で再検証する。

Web Components、Sass settings、exact token names、markup snippets は implementation evidence に留め、design source of truth にしない。

## References

実行時は [`references/uswds-system.md`](./references/uswds-system.md) を開き、必要な primary URL だけを再確認する。

## Avoid

- U.S. federal context ではない product に .gov / federal identity の visual language を借用する
- Banner、Identifier、Header、Footer を同じ「政府らしい chrome」として扱う
- federal seal、agency logo、USWDS exact colors/type/spacing を universal design rule にする
- progress indicator を navigation、task list、nonlinear workflow の代替にする
- USWDS component を使っただけで accessibility/compliance 済みとみなす
- GOV.UK の journey convention と USWDS の federal trust/agency convention を同一視する

## Verify

- representative task を entry → required information → form/task progression → error/recovery → review/submit → receipt/record まで通す
- Banner / Identifier / agency-service identity が互いに重複・矛盾せず、official-site status と responsible agency を正しく説明することを確認する
- linear process では current/completed/pending と page heading、Back/Next が独立して理解できることを確認する。conditional/nonlinear flow に固定 step indicator を使っていないことも確認する
- realistic agency/service names、長い説明、required links、validation errors、saved/submitted information で確認する
- narrow / wide viewport、keyboard-only、visible focus、200% text zoom、400% browser zoom 相当、long/localized content を確認する
- current USWDS documentation の component status / accessibility tests / latest updates を再確認する
- customized component は upstream test status を流用せず、実 artifact で task-level accessibility を再検証する
- real-project trial 未実施なら experimental のままとし、promotion 完了と報告しない
