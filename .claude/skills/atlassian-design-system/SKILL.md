---
name: atlassian-design-system
description: >
  Adapt collaboration, work-management, and productivity interfaces to the current Atlassian Design System
  while preserving product semantics and avoiding Jira/Confluence visual imitation. Use when ADS conventions,
  components, navigation, density, status indicators, drag/reorder behavior, or Rovo AI expression are relevant.
---

# Atlassian Design System

Atlassian Design System (ADS) を、Jira / Confluence に似せるための visual preset ではなく、collaboration / work-management UI を current Atlassian conventions へ適応する system layer として使う。

`color-system`、`layout-system`、`navigation-design`、`table-design`、`form-design`、`interaction-states`、`keyboard-interface`、`touch-interface`、`content-design`、`responsive-design`、`motion-system`、`accessibility-audit` は、それぞれの underlying design problem の canonical source とする。この Skill は、それらの判断を ADS 上でどう表現・組み合わせるかを扱う。

## Workflow

1. current product の task、information model、navigation model、density、input methods、state semantics を先に確認する。
2. current ADS reference を開く。deprecated component を current guidance として使わない。
3. reference 間を `Observe` の軸で比較し、共通する system decision と product-specific expression を分ける。
4. product semantics を ADS component / navigation / token / status vocabulary へ翻訳する。
5. standard component が semantic fit する場合は優先し、custom component は task 上の必要性を説明できる場合だけ使う。
6. delivered artifact を realistic task、content density、keyboard、zoom、theme、reorder、AI state まで含めて検証する。

## When to use

- Jira / Confluence / Trello のような collaboration / work-management product に近い task surface を設計する
- ADS / Atlaskit / Atlassian ecosystem に適合させる
- dense list / table / issue / project / workflow UI で hierarchy と action density を整理する
- current Atlassian navigation system へ product structure を適応する
- status / category / numeric indicator を ADS vocabulary へ整理する
- drag / reorder を含む workflow を ADS conventions に合わせる
- Rovo / AI-powered moment を Atlassian product surface 内へ統合する

単に blue、rounded、compact な見た目にしたいだけなら使わない。

## Observe

reference を開いたら、少なくとも次を比較する。

### Product structure

- global / product / project / local navigation の責務分離
- top nav、side nav、main content、panel の関係
- page title / breadcrumbs / filters / actions の hierarchy
- persistent context と temporary overlay の分離
- content area 内 grid と navigation/layout shell の境界

### Density and hierarchy

- compact UI がどの task frequency / data volume で使われているか
- repeated rows / lists / tables の rhythm
- primary、secondary、item、batch、destructive action の prominence
- text/icon/control の apparent density と hit area の関係
- whitespace が grouping / rank に使われている箇所
- optical adjustment と system spacing の使い分け

### Semantic tokens and foundations

- token が raw value ではなく何の semantic role を表すか
- surface / text / border / interaction-state の role relationship
- typography hierarchy と code/data typography の分離
- icon size / taxonomy / label relationship
- light / dark theme で value が変わっても role が保たれるか

### Status and metadata

- badge が numeric tally / count に使われる場面
- tag が category / organization に使われる場面
- lozenge が status / meaningful attribute に使われる場面
- status color 以外に text / shape / placement が意味を保持しているか
- interactive status control と static status indicator の違い

### Interaction and components

- button / link の semantic distinction
- popup / dropdown / modal の情報量と task interruption level
- standard component が keyboard / focus / state behavior をどう持つか
- loading / empty / error / disabled state の hierarchy
- drag handle、drag surface、drop target、reorder completion の feedback
- pointer drag 以外の movement / reorder path

### Rovo / AI moments

- AI state が通常 UI からどう識別されるか
- AI identity が常時 dominant か、必要な瞬間だけ出るか
- active generation と idle / completed / suggested state の違い
- Rovo color / motion / icon がどの state に限定されているか
- AI operation の provenance、system state、undo/correction path が見えるか
- AI surface が workflow から segregated されず context を保持しているか

## Decision rules

### 1. System adaptation before visual resemblance

最初に「ADS の見た目」を作らない。

先に current product で以下を固定する。

- user goal
- object / entity model
- navigation hierarchy
- action priority
- state semantics
- collaboration context
- input / accessibility constraints

その後で ADS component / layout / token vocabulary へ翻訳する。

Jira の screenshot に似ていることは acceptance criterion ではない。

### 2. Use current navigation, not deprecated shells

current ADS の `Navigation system` / `Layout` を参照する。

`Side navigation`、`Page layout`、`Atlassian navigation` の deprecated package を current source of truth にしない。

legacy product を保守する場合は historical implementation evidence として参照してよいが、新規 design decision の規範にはしない。

navigation meaning 自体は `navigation-design` を canonical とし、この Skill では ADS 上の current presentation / composition を決める。

### 3. Preserve token semantics, not token numbers

ADS の spacing / color / typography / radius / elevation token は semantic system の evidence として使う。

次を universal rule にしない。

- 8px base unit
- exact pixel values
- exact color token names
- exact font sizes / line heights
- Atlassian brand hues
- current radius values

current product の design system が既にある場合は、ADS の raw token を上書きせず、semantic role relationship を translation する。

### 4. Productive compactness is contextual

compactness は simultaneous information と repeated operation を速く扱うための手段であり、small UI 自体が目的ではない。

高密度化する前に確認する。

- frequent repeated task か
- same-screen comparison が重要か
- keyboard / precise pointer が主入力か
- row / object identity が失われないか
- labels / status / error が隠れないか
- zoom / text expansion でも task が成立するか

small text、tiny targets、hover-only action、permanent truncation を「enterprise density」として正当化しない。

### 5. Separate action levels

page / context / item / batch / destructive action を同じ prominence にしない。

primary emphasis は task 上もっとも重要な action に限定する。
repeated row や card の secondary action は、scanability と discoverability を保ちながら hierarchy を落とす。

hidden action を使う場合も keyboard / touch / zoom / discoverability で主要 task が欠落しないことを検証する。

### 6. Badge, tag, and lozenge are not interchangeable

shape が似ていても semantic role で選ぶ。

- **Badge**: numeric value / tally / score
- **Tag**: category / organization / grouping
- **Lozenge**: meaningful status / attribute that changes interpretation or action

既存 project の semantics が異なる場合は、その semantic model を優先し、ADS component 名に合わせるためだけに情報モデルを変えない。

status が editable な場合は static indicator と同じ interaction とみなさず、明確な trigger / focus / update feedback を持たせる。

### 7. Prefer standard components when semantics fit

current standard ADS component を優先する理由は見た目ではなく、system consistency、state behavior、keyboard/focus、theme、accessibility behavior を共有できるため。

custom component は以下の場合に限る。

- standard component では product-specific semantic relationship を表現できない
- task efficiency を著しく損なう
- domain-specific visualization / direct manipulation が必要

custom component を使う場合も equivalent state / focus / keyboard / touch / theme / localization behavior を設計する。

### 8. Drag is an enhancement, not the only outcome path

reorder / move / nest / combine を pointer drag のみにしない。

対象 object と task に応じて menu / move command / modal / form 等で同じ outcome に到達できる path を用意する。

drag handle の visibility は primary vs secondary interaction で変えてよいが、keyboard / assistive technology path と completion feedback を失わない。

`touch-interface` と `keyboard-interface` が interaction model の canonical source であり、この Skill は ADS の production pattern へ適応する。

### 9. Treat Rovo as a scoped dialect

Rovo UI は Atlassian Design Language 内の AI dialect であり、product 全体を AI-looking にするための style theme ではない。

AI expression は state と provenance に結びつける。

- AI-powered action を通常 action と区別する
- active generation indicator は generation 中だけ使う
- Rovo color / branded border / motion を non-AI emphasis に流用しない
- sparkle / AI icon 単独で意味が曖昧なら text label を付ける
- AI surface が workflow の context と task state を引き継ぐ
- output / action の state、risk、correction path を確認できるようにする

Rovo-specific exact color order、brand assets、motion curves は Atlassian product を実装する場合の system constraint であり、他 brand へ universalize しない。

## Responsibility boundaries

- `color-system`: semantic color roles / palette relationship
- `layout-system`: generic spatial composition / grouping / alignment
- `navigation-design`: information-space movement / orientation / navigation model
- `responsive-design`: viewport / container / reflow policy
- `table-design`: exact tabular comparison / grid interaction
- `form-design`: question / validation / review flow
- `interaction-states`: state semantics
- `keyboard-interface`: keyboard traversal / composite-widget behavior / focus lifecycle
- `touch-interface`: target acquisition / gesture / mixed input
- `content-design`: wording / information priority
- `motion-system`: motion necessity / choreography / reduced motion
- `accessibility-audit`: broad rendered / semantic / conformance re-test
- `atlassian-design-system`: above decisions を current ADS conventions / components / navigation / AI dialect へ翻訳する system layer

## References

詳細な観察対象と freshness note は [`references/atlassian-system.md`](./references/atlassian-system.md) を読む。

実行時は task に relevant な reference だけを開く。

## Avoid

- Jira / Confluence screenshot を pixel-copy する
- Atlassian blue、radius、shadow、spacing を unrelated product に貼る
- 8px grid を universal spacing law にする
- deprecated navigation / page-layout package を current guidance として採用する
- compactness の名目で labels / hit targets / focus / error state を削る
- badge / tag / lozenge を単なる pill variants として交換する
- every action を primary / brand color にする
- hover だけで critical row action を公開する
- drag を reorder の唯一の方法にする
- Rovo color / gradient / sparkle / motion を generic AI decoration にする
- generative border を generation していない state に使う
- framework props、package API、lint rule、token identifier を design principle にする

## Verify

最低1つの representative collaboration / work-management task を delivered artifact 上で通す。

### Structure

- current navigation shell で location / scope / parent context が分かる
- page title、filters、primary action、item actions の hierarchy が競合しない
- narrow / wide context で navigation meaning が変わっていない
- deprecated shell を新規 design の根拠にしていない

### Density

- realistic long titles、user names、statuses、counts、dates、labels を入れる
- dense list/table を scan できる
- compactness が tiny text / clipped content / inaccessible target に依存しない
- 200% text zoom と 400% zoom / narrow reflow で primary task を完了できるか確認する

### Interaction

- keyboard-only で primary task と item actions を完了する
- focus が visible で logical order を保つ
- popup / modal を開閉し focus が合理的に戻る
- hover-only information / action がない
- drag/reorder task では non-drag alternative でも同じ outcome に到達できる

### States and themes

- default / hover / focus / pressed / selected / disabled / loading / empty / error を確認する
- light / dark theme で semantic role が保たれる
- status が color だけに依存しない
- badge / tag / lozenge の role が content model と一致する

### Rovo / AI when applicable

- AI-powered action と non-AI action を区別できる
- active generation cue が actual generation state にのみ出る
- completed / idle state でも unnecessary AI decoration が残らない
- AI output / action の provenance、state、correction / undo path を確認できる
- reduced motion / relevant accessibility preference でも state meaning が保たれる

最終確認は source / component tree だけで終わらせず、実際の browser / product surface で行う。
