---
name: github-primer
description: >
  Adapt developer collaboration and repository-centric product interfaces to current GitHub Primer Product UI conventions
  while preserving product semantics, contextual hierarchy, action structure, responsive behavior, and accessibility.
---

# GitHub Primer

GitHub Primer を「GitHub 風の見た目」として適用しない。

この Skill は developer collaboration / repository-centric product の意味を、current Primer の **context hierarchy、navigation、action surface、density、theme、interaction convention** へ翻訳するときに使う。

**Inspect → Extract → Translate → Implement → Verify** の順を崩さない。

Last reviewed: 2026-09-13

## When to use

以下のような product surface を Primer conventions へ適応するときに使う。

- repository / project / organization のような強い parent context を持つ画面
- issue / pull request / workflow / security / settings のような developer collaboration workflow
- dense list / table / metadata / status / action を同時に扱う productivity UI
- context を保ったまま local view を頻繁に切り替える application surface
- narrow / wide で action や navigation の presentation が変化する UI

単に developer tool らしい dark UI、monospace、bordered card、GitHub blue を再現するためには使わない。

## Boundary

- `navigation-design` は information space と orientation の一般原則を担当する。ここではそれを **Primer の app/context/local navigation/page header model** へ適応する。
- `table-design` は exact lookup / comparison / grid semantics を担当する。ここでは Primer の dense developer workflow に合わせた system adaptation のみ扱う。
- `interaction-states` は focus / selected / pressed / disabled 等の state semantics を担当する。ここでは Primer component role に沿ってそれを表現する。
- `keyboard-interface` は keyboard interaction model の canonical source。Primer の shortcut / focus guidance は system-specific evidence として使う。
- `responsive-design` は一般的 adaptation policy を担当する。ここでは context / action priority / overflow が Primer conventions でどう保持されるかを見る。
- `color-system` / `dark-mode-design` は semantic color / appearance transformation を担当する。Primer token/theme は raw value ではなく system evidence として使う。
- `accessibility-audit` は broad conformance retest を担当する。Primer component を使っただけで task-level accessibility が完了したとはみなさない。

React / Rails / CSS / Figma API、Octicons の asset catalog、GitHub 固有 brand asset は design source of truth にしない。

## Workflow

1. current artifact の parent context、task、resource model、navigation、action、density を Inspect する。
2. [`references/primer-system.md`](./references/primer-system.md) の current primary references を実際に開く。
3. 下の observation axes で複数 reference を比較する。
4. GitHub 固有表現ではなく、Primer がどの semantic relationship を system 化しているか Extract する。
5. current product の語彙・brand・information model を保ったまま Translate する。
6. current project design system を優先し、Primer component semantics が fit する部分だけ Implement する。
7. realistic developer task を実際に操作して Verify する。

## Observe

### Context hierarchy

- global/app shell、parent context、local navigation、page identity、affected content がどう分離されているか
- context region が「現在どの repository / project / entity にいるか」をどう示すか
- context region と breadcrumb、page title、local navigation が重複していないか
- deep link から入っても parent context と page purpose が理解できるか

### Navigation semantics

- URL / route を変える navigation と same-context panel switching をどう分けているか
- current view / current parent / hierarchy-up が同じ visual treatment に潰れていないか
- navigation が affected content の近くに置かれているか
- narrow state でも destination / current-state / wording が保たれるか

### Action surfaces

- primary task、secondary action、rare action、destructive action がどこに置かれるか
- ActionBar が「action」だけを扱い、selection/state indicator を抱え込んでいないか
- width が減ったとき、action が消えるのではなく priority に応じて overflow へ移るか
- ActionList / ActionMenu / NavList が visual similarity ではなく action / selection / navigation semantics で選ばれているか
- icon-only action に accessible name と discovery path があるか

### Developer-workflow density

- resource identity、status、author、time、counts、labels、secondary metadata の優先順位
- frequent scanning と exact comparison に必要な情報が残っているか
- metadata を全部同じ weight で並べて scanability を落としていないか
- hover しないと essential action / state / meaning が分からない構造になっていないか
- compactness が small targets / tiny text / truncation dependency に変質していないか

### Theme and visual roles

- light / dark で surface、content、border、accent、status の semantic role がどう維持されるか
- token role を使っているか、raw color を GitHub の current value からコピーしていないか
- default theme 以外でも essential state / contrast / focus が壊れないか
- brand color が information hierarchy を上書きしていないか

### Accessibility and input

- keyboard だけで primary task が完了するか
- shortcut が enhancement であり、唯一の操作経路になっていないか
- link と button が visual treatment ではなく underlying action semantics と一致しているか
- focus、status、error、success、selection、live feedback が visual-only になっていないか
- zoom / long names / narrow layout / screen reader announcement を考慮した構造か

## Decision rules

### 1. Preserve context before adding chrome

repository / project / organization 等の parent entity が task understanding に必要なら、その context を page structure の上位に保持する。

ただし context region を full breadcrumb や arbitrary toolbar にしない。context、local navigation、page heading、actions の責務を分ける。

### 2. Choose navigation by semantic change

underline style を見て component を選ばない。

- activation で URL / navigable view が変わる → linked navigation
- 同一 context 内の mutually exclusive panel を切り替える → panel / selection model
- current parent scope の destination を切り替える → local navigation

既存 `navigation-design` の判断を Primer convention へ translate する。

### 3. Keep action surfaces action-only

ActionBar 相当の surface には command を置く。selected state、counter、notification、filter state を action icon の装飾として混ぜない。

同じ row に command が多い場合は、頻度・重要度・reversibility を比較して primary visibility を決め、lower-priority action は overflow へ移す。

### 4. Do not equate density with concealment

frequent developer workflow では metadata と action density が高くてもよい。

ただし density を成立させるために以下へ依存しない。

- essential label の icon-only 化
- pointer hover だけの disclosure
- excessive truncation
- small hit target
- low-contrast metadata

必要な情報を削る前に、grouping、alignment、weight、progressive disclosure、overflow priority を調整する。

### 5. Use standard Primer semantics before custom behavior

current Primer component / pattern が task semantics に合うなら、その state / keyboard / responsive / accessibility behavior を evidence として優先する。

custom component は product requirement が standard pattern で表現できない場合だけ採用し、同等の以下を持たせる。

- role / state clarity
- keyboard and focus lifecycle
- narrow-width behavior
- theme support
- accessible name / status feedback
- error / loading / empty / destructive states

### 6. Treat tokens as relationships, not values

Primer の exact color、spacing、radius、type size、icon size を unrelated product の universal rule にしない。

current project の token vocabulary を使い、surface/content/border/accent/status 等の semantic relationship だけを translation evidence として持ち込む。

## Avoid

- GitHub の screenshot を pixel-for-pixel 再現する
- GitHub blue / dark theme / monospace を使うだけで Primer 適応とみなす
- context region、breadcrumb、page title、sidebar に同じ hierarchy を重複表示する
- URL-changing navigation と same-context tab panel を underline の見た目だけで統一する
- toolbar に selected state / counter / filter meaning を押し込む
- narrow layout で重要 action を説明なしに消す
- dense UI を理由に essential label、focus ring、target size を削る
- pointer hover を唯一の action discovery にする
- React/Rails props や CSS variables を design rule として固定する
- internal-only GitHub shared component を public Primer の canonical pattern とみなす
- Octicons / GitHub logos / proprietary assets を別 product の identity として流用する

## Verify

source / component tree が valid でも完了しない。最終 artifact で代表 task を通す。

### Context and navigation

- repository/resource 相当の parent context から deep page へ直接入る
- current parent、current page、local destination が矛盾なく理解できることを確認する
- linked navigation と same-context panels を実際に操作し、URL/history/context semantics が一致するか確認する

### Action priority and overflow

- primary / secondary / destructive / rare action を含む realistic row/page を作る
- wide → narrow へ連続 resize する
- lower-priority action が overflow しても primary task と destructive consequence が理解できるか確認する
- overflow 後も keyboard で全 action に到達できるか確認する

### Realistic density

- 長い repository/resource 名、複数 labels、counts、author、time、status、secondary metadata を入れる
- 省略記号だけで identity を判別不能にしていないか確認する
- list/table の scan path と row action の位置が一貫するか確認する

### Appearance and accessibility

- light / dark を確認する
- keyboard-only で representative task を完了する
- focus visibility、selection、error、warning、success、loading、empty state を確認する
- 200% text zoom と 400% browser zoom / 320 CSS px 相当で clipping、unreachable action、context loss を確認する
- long labels / localization-like expansion で layout を確認する
- color-only / hover-only / shortcut-only の task path がないことを確認する

### Completion gate

次を説明できるまで完了扱いにしない。

- Primer を採用する system-level 理由は何か
- parent context / local navigation / page identity / actions の責務をどう分けたか
- dense workflow で何を常時 visible にし、何を overflow / progressive disclosure にしたか
- standard Primer semantics から外れた custom behavior は何で、なぜ必要か
- light/dark、narrow/wide、keyboard、zoom、realistic content、error/recovery を実物で確認したか
