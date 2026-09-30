---
name: fluent-2
description: >
  Adapt application interfaces to the current Microsoft Fluent 2 design system by translating product semantics into Fluent component roles, hierarchy, theming, density, motion, and accessibility behavior without copying Microsoft products or framework APIs.
---

# Fluent 2

Fluent 2 を「Microsoft っぽい見た目」にする style preset として使わない。

この Skill の責務は、current product の task / information architecture / component semantics を保ったまま、Fluent 2 の system vocabulary へ翻訳することにある。色、typography、navigation、state、responsive、keyboard、motion などの underlying design problem は各 domain Skill を source of truth とし、この Skill は Fluent-specific adaptation を担当する。

## When to use

次のような場合に使う。

- Microsoft ecosystem と整合する application UI を設計する
- Fluent 2 / Fluent UI を採用した product の画面や component を設計・改善する
- Fluent 1 / Fabric 系の legacy UI を current Fluent 2 direction へ移行する
- custom design system を Fluent の component / token / interaction conventions に合わせて翻訳する
- Web / Microsoft-oriented application で Fluent component の採用可否を判断する

単に角丸、neutral surface、Microsoft blue、Segoe 系 typography を使いたいだけならこの Skill を呼ばない。

## Workflow

1. current product の task、information hierarchy、primary action、platform/input context、brand constraints を確認する。
2. [runtime references](./references/fluent-system.md) から task に関係する current Fluent 2 guidance を実際に開く。
3. reference 間を `Observe` の軸で比較し、Fluent 固有の system decision と generic design principle を分離する。
4. current product semantics を Fluent component role / token role / hierarchy / interaction vocabulary へ翻訳する。
5. standard Fluent component が semantic fit する場合はそれを優先し、custom component は明示的な product reason がある場合だけ選ぶ。
6. 最終 artifact を light/dark、高 contrast / forced colors、keyboard、zoom、loading/state change、realistic content で確認する。

## Observe

reference を見るときは最低限次を観察する。

- component role: button / dialog / combobox / menu / toolbar 等が何の task semantics を担当しているか
- action hierarchy: primary / secondary / subtle action の数と配置、同一 surface 内での emphasis の希少性
- information hierarchy: grouping、surface、divider、spacing、typography がどの関係を可視化しているか
- density: information-rich surface と task-focused surface で component emphasis / spacing がどう変わるか
- token semantics: raw value ではなく alias role がどの目的に割り当てられているか
- color responsibility: neutral / shared / brand color の役割分担
- state behavior: hover / focus / pressed / selected / disabled / loading が task semantics をどう維持するか
- focus lifecycle: temporary UI を開閉したときに focus がどこへ入り、どこへ戻るか
- responsive / zoom behavior: container が狭くなったときに機能と hierarchy がどう保たれるか
- accessibility adaptation: dark / high contrast / forced colors / keyboard / assistive technology で何が変わるか
- motion purpose: change、continuity、feedback を説明するために motion が使われているか
- content behavior: labels、status、error、loading が component semantics と一致しているか

## Decision rules

### 1. Fluent を visual preset ではなく system adapter として扱う

まず product の task と component semantics を確定する。その後で Fluent component を割り当てる。

`Fluent らしく見えるから` を component 選択理由にしない。

### 2. domain Skill を上書きしない

次の責務は既存 Skill を canonical とする。

- semantic color roles → `color-system`
- navigation model → `navigation-design`
- responsive / reflow policy → `responsive-design`
- focus / selected / pressed 等の state semantics → `interaction-states`
- keyboard interaction model → `keyboard-interface`
- touch target / gesture → `touch-interface`
- typography composition → typography 系 Skill
- motion purpose / timing → `motion-system`
- broad accessibility verification → `accessibility-audit`

Fluent 2 は、それらの決定を Microsoft system conventions へ翻訳する layer として使う。

### 3. raw token value を universal rule にしない

Fluent の token architecture では global token が raw value、alias token が usage semantics を持つ。

current product へ持ち込むのは semantic relationship であり、reference の hex、radius、spacing、font size、shadow 値そのものではない。

既存 product token が同じ semantic role を持つなら、Fluent の値へ無条件に置き換えない。

### 4. neutral / shared / brand color の役割を混ぜない

- neutral は surface、content、structure の基盤に使う
- brand は product identity と選択的 emphasis に使う
- shared color は reusable status / category / people / calendar 等、system 横断で共通意味を持つ場合に使う

brand color を surface 全体や多数の action に広げて hierarchy を平坦化しない。

### 5. high-emphasis action を希少に保つ

同一 task surface で複数 action をすべて primary / accent にしない。

最も重要な次の action を一つ特定し、その他は task consequence と頻度に応じて emphasis を下げる。

list / dense tool / repeated row 内で primary styling を反復し、全行を同じ強さで主張させない。

### 6. standard component を semantic fit で選ぶ

Fluent standard component が task semantics を十分表現できる場合はそれを優先する。

custom component が必要なのは、少なくとも次のいずれかを説明できる場合。

- standard component の interaction model が product task と衝突する
- domain-specific state / data relationship を標準 anatomy で表現できない
- platform / device constraint により standard presentation が成立しない

custom 化しても focus、keyboard、state、high contrast、zoom、loading/error behavior を失ってはいけない。

### 7. density は task type から決める

Fluent component の compact な見た目を理由に情報を詰め込まない。

- scan / compare / operate を反復する tool surface では density と stable alignment を優先できる
- confirmation / onboarding / focused decision では competing emphasis を減らす
- dense surface でも grouping と hierarchy を spacing / typography / divider / surface role で維持する

固定 padding 値を universal density rule にしない。

### 8. temporary UI は focus lifecycle まで含めて設計する

dialog / popover / menu 等は表示だけで完了しない。

- open 時に logical な target へ focus を移す
- modal interaction の範囲を明確にする
- keyboard で閉じる経路を持つ
- close 後は原則 trigger または次の logical workflow position へ focus を戻す

nested dialog や temporary UI の連鎖で original task context を失わせない。

### 9. loading は final structure の意味を予告する

skeleton を固定 UI 全体へ敷かない。

動的 content の high-level structure を伝える範囲で使い、細かな decoration / badge / secondary metadata まで忠実に skeleton 化しない。

loading 完了時に keyboard focus を不用意に失わせない。

### 10. Fluent accessibility behavior を post-process にしない

Fluent adoption は accessibility audit の代替ではないが、system adaptation 自体に次を含める。

- logical focus order
- temporary UI の focus restoration
- light / dark / high contrast / forced colors
- 400% zoom / 320 CSS px 相当での reflow
- 200% text zoom での clipping
- state の color-only dependence 回避
- keyboard-only completion

## Current implementation context

Fluent 2 の Web 実装を見るときは current Fluent UI React v9 を primary implementation evidence とする。

ただし React component props、Griffel API、package structure、exact token names を design principle にしない。implementation detail は current artifact への実装時にだけ参照する。

legacy Fluent UI React v8 / Fabric / Northstar の pattern を current Fluent 2 rule として無条件に継承しない。特に Northstar は current v9 の代替 source として扱わない。

## Avoid

- Microsoft 365 の特定画面を pixel-for-pixel で模倣する
- blue accent、角丸、shadow、Segoe 系 type だけで Fluent と判定する
- raw token / component default 値を unrelated product に固定コピーする
- every action を accent / primary にする
- every region を card / elevated surface にする
- high contrast を dark mode の強い版として扱う
- custom component で standard keyboard/focus behavior を失う
- skeleton を画面全体の decorative placeholder として使う
- implementation library の API catalog を Skill 本文の source of truth にする
- Fluent を使っていることだけで accessibility conformance を主張する

## Verify

final artifact で representative task を実行して確認する。

### Hierarchy / component fit

- primary action が一目で特定できる
- repeated controls が過剰に high-emphasis になっていない
- standard component の semantics が task と一致する
- custom component は標準 component を避けた理由を説明できる
- neutral / shared / brand color の役割が混ざっていない

### State / focus

- keyboard だけで task を完了できる
- focus と selected / pressed state を区別できる
- dialog / popover / menu の open → operate → close → restore が連続して成立する
- loading 完了や dynamic update で focus が消失・不意移動しない

### Appearance / accessibility

同じ task を最低限次で比較する。

- default light
- dark
- high contrast / representative forced-colors environment
- keyboard-only
- 400% zoom または 320 CSS px 相当
- 200% text zoom

meaningful hierarchy、state、boundary、action priority が各条件で残ることを確認する。

### Realistic content

- short / long labels
- realistic list / table / form density
- validation / error / empty / loading / success state
- localized or expanded text where relevant

を入れ、reference screenshot の理想的文字量だけで検証しない。

### Promotion gate

この Skill を experimental から promotion する前に、real project で一つの representative task を Fluent 2 へ適応し、少なくとも次を記録する。

- original product semantics のうち維持したもの
- Fluent component / token / hierarchy へ変換したもの
- standard component では足りず custom 化した箇所と理由
- keyboard / focus / zoom / high-contrast の結果
- Fluent 固有 rule と project 固有 decision の境界

Skills CLI discovery / standalone install と runtime reference 到達性も current branch head で確認する。
