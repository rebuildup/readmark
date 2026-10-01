---
name: adobe-spectrum
description: >
  Adobe Spectrum 2 の design language を現在の creative / productivity product へ適応するときに使用する。
  Spectrum を見た目の preset として模倣せず、component role、density、scale、theme、brand emphasis、
  platform context を current product semantics に翻訳して検証する。
---

# Adobe Spectrum

Adobe Spectrum 2 を **system-adaptation layer** として使う。

目的は Photoshop / Acrobat / Express の見た目を複製することではない。current product の task、information architecture、content、state model を維持したまま、Spectrum が持つ component role・scale・theme・hierarchy・interaction convention へ翻訳する。

`color-system`、`layout-system`、`navigation-design`、`interaction-states`、`keyboard-interface`、`touch-interface`、`iconography-system`、`content-design`、`internationalization-design`、`accessibility-audit` 等の domain Skill が underlying design problem の source of truth であり、この Skill はそれらを Spectrum 文脈へ適応する。

## When to use

使う:

- Adobe Spectrum / Spectrum 2 を design system として採用する product
- creative tool、document tool、professional productivity UI を Spectrum conventions へ寄せるとき
- Spectrum 1 / legacy implementation から Spectrum 2 へ design intent を移行するとき
- dense desktop workflow と touch-oriented context の間で同じ task semantics を保ちつつ presentation を変えるとき
- React Spectrum / Spectrum Web Components を使う実装で、component API ではなく design decision を決めるとき

使わない:

- Adobe 製品を pixel-perfect に再現したいだけのとき
- generic な「プロ向け」「グレー基調」「丸い UI」の style prompt として
- domain-specific 問題を Spectrum token / component だけで決めようとするとき
- Adobe Clean など restricted asset の利用権限を推測するとき

## Workflow

1. **Inspect product semantics** — task、content、state、navigation、primary/secondary action、input context、density need を先に確認する。
2. **Inspect current Spectrum references** — `references/spectrum-2.md` を開き、current Spectrum 2 status と relevant pattern を確認する。
3. **Extract system decisions** — component role、scale、surface hierarchy、brand emphasis、theme、icon/text relationship、platform variation を比較する。
4. **Translate** — exact value や Adobe 固有 asset をコピーせず、current brand / product / platform に適応する。
5. **Implement with standard semantics first** — standard component が task semantics を表現できるなら優先する。custom control は理由を明示する。
6. **Verify delivered artifact** — light/dark、input/scale context、keyboard/focus、contrast、localization、realistic density/state で実物確認する。

## Observe

Reference を開いたら、少なくとも以下を見る。

### Product / workflow structure

- workspace で content と controls のどちらが視覚的主役か
- persistent tool / contextual tool / primary action / secondary action の役割分離
- complex workflow を一度に露出するか、context に応じて段階的に出すか
- panel / toolbar / dialog / popover / menu がどの task boundary を表すか
- novice と expert の両方にどう entry point を提供しているか

### Density and scale

- cursor / keyboard 前提の dense context と touch-oriented context の差
- target size、spacing、type、icon の関係が context でどう変わるか
- scale change で component semantics や action priority が変わっていないか
- mixed-input device で一つの固定 density を強制していないか

### Hierarchy and surfaces

- content canvas / document / media を chrome より優先しているか
- grouping が border/card の反復ではなく proximity、surface、divider、heading、placement で成立しているか
- surface depth / shadow / layer color が task structure を補助しているか
- high-density tool UI で unnecessary decoration が増えていないか

### Color and brand

- neutral surface と product/brand color の役割分担
- accent が current action / selection / orientation を助けているか
- brand color が全 control や全 surface を支配していないか
- light/dark で semantic role が維持され、単純 inversion になっていないか
- color-only meaning に依存していないか

### Components and states

- standard component の semantic role が current task に合っているか
- high-emphasis action が scarce か
- hover / focus / pressed / selected / disabled / pending / invalid の意味が混ざっていないか
- overlay / dialog の focus entry、dismissal、restoration が task flow と一致するか
- loading / empty / error state が content structure と continuity を保つか

### Iconography and content

- icon が standalone で十分明確か、text label が必要か
- icon と surrounding text の optical size / baseline が整っているか
- platform-specific metaphor が必要な場合に generic icon を強制していないか
- localization / RTL / mixed-script で label、icon、layout relationship が壊れないか

## Decision rules

### 1. Spectrum を visual preset にしない

最初に product semantics を決め、その後に Spectrum role へ mapping する。

`rounded`, `gray`, `Adobe-like`, `professional` といった見た目だけから component や surface を選ばない。

### 2. Dense workflow では content / work state を主役にする

creative / productivity tool では、編集対象・document・timeline・asset・data などが主役であることが多い。

chrome の brand color、shadow、container、large heading が work surface を圧迫する場合は削る。expressiveness は task orientation や approachability を助ける範囲に限定する。

### 3. Scale は input/context の翻訳として決める

Spectrum の legacy guidance や implementation token にある exact ratio / size を universal rule にしない。

代わりに以下を観察して scale を決める。

- primary input precision
- target acquisition difficulty
- viewing distance
- device posture
- information density requirement
- task frequency
- mixed touch / pointer / keyboard use

同じ feature でも semantic anatomy を保ちつつ target、spacing、type、icon、navigation presentation を変えてよい。

### 4. Brand color は orientation と priority に使う

brand / product color は identity、selection、important action、cross-product orientation を助けるために使う。

全 button を accent にする、全 panel を brand tint にする、decorative color で dense workflow を埋める、といった適用は避ける。

### 5. Standard component first, custom by semantic necessity

standard Spectrum component が task semantics を十分に表現できるなら優先する。

custom component を作る場合は最低限次を満たす。

- standard pattern では表現できない task-specific semantics がある
- focus / keyboard / touch / pointer model を定義できる
- interaction states を区別できる
- theme / contrast / localization / zoom で壊れない
- standard pattern から外れる learning cost を正当化できる

単に exact visual match が欲しいことは custom component の理由にしない。

### 6. Current Spectrum 2 と legacy Spectrum を混ぜない

古い Spectrum documentation / implementation は historical or migration evidence として扱う。

current product で exact token、font、component anatomy、icon sizing を採用する前に Spectrum 2 の current source を確認する。

React Spectrum / Spectrum Web Components の package API は implementation evidence であり、この Skill の source of truth ではない。

## Responsibility boundaries

- `color-system` — semantic color role、theme role pairing、normal palette system
- `layout-system` / `responsive-design` — spatial composition と general adaptation policy
- `navigation-design` — information-space movement / orientation
- `interaction-states` — state semantics
- `keyboard-interface` / `touch-interface` — input model
- `iconography-system` — icon family / metaphor / optical consistency
- `content-design` — wording / information priority
- `internationalization-design` — locale / RTL / translation robustness
- `accessibility-audit` — broad conformance / rendered retest
- `adobe-spectrum` — 上記 decisions を current Spectrum conventions へ翻訳し、system-level coherence を確認する

## Avoid

- Photoshop / Acrobat / Express の screenshot を single source として clone する
- old Spectrum 1 token values を current universal constants として固定する
- Spectrum の exact radius / spacing / type size / color index を unrelated product へ盲目的にコピーする
- dense professional UI = small text + cramped target と解釈する
- touch UI = desktop UI を一律 125% にする、といった固定倍率化
- primary / accent action を増やして hierarchy を平坦化する
- brand color を status / category / data visualization の意味へ無計画に兼用する
- custom control を visual uniqueness のためだけに作る
- React Spectrum / Spectrum Web Components の prop/API catalog を design rule にする
- Adobe Clean や proprietary illustration / icon / brand asset の使用権限を前提にする

## Verify

最終 artifact を実際に操作・描画して確認する。

### Representative task

少なくとも一つの end-to-end task を選び、以下を通す。

- entry / navigation
- primary work
- selection / editing / manipulation
- secondary/contextual action
- loading または pending
- realistic error / recovery
- completion / save / export 等の outcome

### Context matrix

該当する組み合わせを比較する。

- light / dark
- medium-density cursor/keyboard context / larger touch-oriented context
- keyboard-only / pointer / touch where supported
- default contrast / representative high-contrast or forced-color path
- narrow / wide or resizable workspace
- short / long localized labels
- empty / loading / populated / error state

### Inspect visually

- content/work surface が chrome より優先されている
- primary action が明確で、high-emphasis control が過剰でない
- dense areas が cramped ではなく scanable
- scale change 後も semantic grouping と task order が同じ
- text / icon / control の optical relationship が崩れていない
- surface / divider / shadow が意味のない decoration になっていない
- brand color が orientation を助け、content を圧迫していない

### Inspect behaviorally

- standard component semantics と actual behavior が一致する
- focus entry / movement / restoration が予測可能
- pointer と keyboard で同じ task outcome に到達できる
- touch context で target acquisition と scrolling が破綻しない
- loading/error で focus や entered work が不必要に失われない
- localization / RTL / zoom で clipping や hidden action が生じない

実装ライブラリが Spectrum であるだけでは verification 完了としない。delivered artifact の task behavior と visual hierarchy を確認する。

## References

詳細と current-version anchor は [`references/spectrum-2.md`](./references/spectrum-2.md) を読む。
