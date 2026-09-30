---
name: ibm-carbon
description: >
  Use when adapting data-heavy, enterprise, or productivity interfaces to the current
  IBM Carbon Design System. Translate product semantics into Carbon component roles,
  density, layering, hierarchy, AI-presence, and interaction conventions without
  cloning IBM products or replacing domain-specific design decisions.
---

# IBM Carbon

Last reviewed: 2026-09-13

Carbon を「IBM っぽい灰色・青・角張った UI」を作る style preset として使わない。

この Skill は、current product の task / information model を Carbon の current system convention へ**翻訳する adapter**として使う。

**Inspect → Compare Carbon evidence → Translate semantics → Adapt system → Verify** の順で進める。

## When to use

次のような 2D product UI を Carbon に適応するときに使う。

- data-heavy enterprise application
- operational dashboard / admin surface
- resource management / workflow tool
- dense table / form / filter / toolbar を含む productivity UI
- IBM Carbon を採用済み、または Carbon conventions と整合させる必要がある product
- Carbon の AI presence / explainability convention を使う AI-assisted surface

単に「enterprise look」「IBM look」にしたいだけなら使わない。

## Responsibility boundary

`ibm-carbon` が決めるのは **current Carbon への system adaptation** だけ。

以下は既存 Skill を source of truth にする。

- color role / palette relationship → `color-system`
- page / component spatial composition → `layout-system`
- viewport / container adaptation → `responsive-design`
- table semantics / grid interaction → `table-design`
- form task flow / validation → `form-design`
- navigation model → `navigation-design`
- focus / selected / pressed / disabled 等の意味 → `interaction-states`
- keyboard operation → `keyboard-interface`
- touch / pointer acquisition → `touch-interface`
- wording / information priority → `content-design`
- localization / RTL → `internationalization-design`
- broad accessibility conformance review → `accessibility-audit`

Carbon の component や token が存在することを理由に、これらの domain decision を上書きしない。

## 1. Inspect the current product first

Carbon reference を開く前に current project を確認する。

最低限見るもの:

- primary user tasks and repeated workflows
- information density / simultaneous objects
- current navigation shell
- tables / lists / forms / filters / toolbars
- action hierarchy
- light / dark theme behavior
- component/state inventory
- keyboard-heavy or pointer-heavy workflows
- responsive / narrow-window behavior
- loading / empty / error / batch-operation states
- AI-generated / AI-assisted content or actions, if any

既存 product semantics を Carbon component 名に合わせて作り替えない。

## 2. Open current Carbon references

最初に [`references/carbon-system.md`](references/carbon-system.md) を読む。

current version / stable status / component status を確認してから具体的な component guidance を開く。

古い v10 page が検索で上位に出ることがあるため、exact current behavior / token name / component status は current `carbondesignsystem.com` / preview / public repository で再確認する。

## 3. Observe these axes

### Product structure

- UI shell と main working surface の役割分離
- global / local navigation の階層
- page header / toolbar / data region の関係
- repeated workflow で controls がどこまで persistent か
- content / data が chrome より視覚的に主役になっているか

### Density

- 一度に見せる情報量
- row / control size と task frequency の関係
- scanning と precision の balance
- advanced action を常時露出するか menu / disclosure へ送るか
- compact 化によって label / hit area / state clarity が失われていないか

Carbon の小さい size variant を「professional だから小さくする」理由にしない。

### Action hierarchy

- primary action の scarcity
- page action と row/item action の分離
- batch action が selection 後に contextually 現れるか
- low-frequency action が overflow / menu へ移されているか
- destructive action の prominence が consequence と一致しているか

### Layers and themes

- global background と nested component layer の関係
- light / dark theme で role が保たれているか
- contextual layer に置かれた component が周囲と区別できるか
- border / fill / elevation を重複して hierarchy を作っていないか

raw color value や legacy token 名ではなく role と surrounding layer の関係を見る。

### Typography

- productive information hierarchy と expressive hierarchy の使い分け
- dense operational UI で heading が増えすぎていないか
- IBM Plex 固有値を外部 product の universal rule にしていないか
- label / metadata / data value が task priority と一致しているか

### Standard components

- product need が existing Carbon component semantics に一致するか
- custom control を作る必要が本当にあるか
- standard component が持つ keyboard / focus / state / accessibility behavior を失っていないか
- preview / feature-flagged component を stable と誤認していないか

### AI presence

AI を含む場合だけ観察する。

- AI involvement が broad container 単位か focused fragment 単位か
- provenance / explainability の入口が明示されているか
- AI label が action trigger と混同されていないか
- user edit 後も AI provenance が正しく表現されるか
- AI styling を non-AI content の decorative highlight に流用していないか

## 4. Translate product semantics into Carbon

### Choose component roles by meaning

見た目が似ている component を選ばない。

例:

- navigation destination → navigation/link pattern
- task execution → button/action pattern
- repeated resource lookup → list/table according to information relationship
- supplementary row detail → expansion only when detail is subordinate
- page-wide filter/search → corresponding page/table utility area
- low-frequency row action → overflow/menu when discoverability remains sufficient

component selection は underlying task semantics から決める。

### Keep productive density intentional

Carbon の density を使うときは、次を説明できること。

- なぜ同時表示量が task completion を速くするか
- なぜこの control / row size が input context に適切か
- 何を常時 visible にし、何を progressive disclosure へ送るか
- compact 化しても labels / focus / targets / states が読めるか

情報量が多いことと cramped であることを同一視しない。

### Preserve action scarcity

high-emphasis action を反復しない。

特に table / dashboard / toolbar で、全 row / card に primary visual weight を与えない。

頻度と consequence を見て:

- principal page action
- contextual task action
- row/item action
- batch action
- destructive action

を分離する。

### Use contextual layers, not decorative cards

Carbon の layer model を「何でも card に入れる」ために使わない。

nested surface は:

- grouping
- editable/work area distinction
- selected/contextual region
- overlay/panel relationship

など、意味のある境界があるときに使う。

surface depth を border + shadow + fill + card nesting で過剰に重ねない。

### Adapt grid relationships without copying magic numbers

Carbon の grid / gutter / alignment は alignment relationship の evidence として使う。

current product では:

- text edge
- control edge
- table edge
- section edge
- page header

の repeated alignment を揃える。

Carbon の特定 pixel 値を、別 platform / scale / typography context へ無条件コピーしない。

### Prefer standard components where semantics fit

standard Carbon component を優先する理由は見た目ではなく、current system behavior がすでに encode されていること。

custom component を作るなら最低限説明する:

1. existing component が表現できない product semantics
2. custom state model
3. keyboard / focus behavior
4. pointer / touch behavior
5. theme / contrast behavior
6. localization / content growth
7. responsive behavior
8. loading / error / disabled behavior

説明できなければ既存 component に戻す。

## 5. Treat AI presence as provenance, not decoration

Carbon current system の AI label / AI presence は AI transparency と explainability のために使う。

### Broad AI presence

container 全体が AI によって生成 / transformed / governed される場合だけ broad treatment を検討する。

### Focused AI presence

AI involvement が一部の field / cell / text / region に限られるなら、その範囲へ localized indicator を置く。

### AI label behavior

AI label は:

- AI presence を示す
- explainability への入口になる

ためのもの。

次に使わない。

- regenerate action
- magic action icon
- generic sparkle badge
- premium decoration
- non-AI highlighted content

AI styling が目立つかではなく、AI involvement の scope が正しく理解できるかを確認する。

## 6. Current-version policy

2026-09-13 時点では Carbon v11 を current stable major として扱う。

current release / feature status は runtime reference で再確認する。

- v10 assets / packages を current implementation baseline にしない
- v11 migration page は v10 → v11 difference の evidence として使う
- preview / feature flag / future-v12 behavior を current stable default と書かない
- React / Web Components の exact API を design rule にしない

## Avoid

- IBM product screenshot の pixel clone
- Carbon を blue-gray palette generator として扱う
- IBM Plex / exact spacing / exact radius / exact token value を universal rule にする
- data-heavy = tiny text / tiny controls と解釈する
- every section を nested tile/card にする
- page 内の各 action を primary button にする
- row action を hover-only にして keyboard/touch discoverability を失う
- old v10 token names を current rule として固定する
- preview component を stable default として扱う
- AI aura / AI label を decorative emphasis に流用する
- Carbon component を使っただけで accessibility が完成したとみなす

## Verify

最終 source ではなく、delivered / rendered product を確認する。

### Representative task

最低 1 つの end-to-end task を実行する。

確認する:

- task の principal action が明確
- table / list / form / panel の semantic role が自然
- global action と item action が混ざらない
- selection → batch action → cancel / completion が理解できる
- loading / empty / error / success で task context が維持される

### Density matrix

realistic data / labels を使う。

- short and long labels
- dense rows / sparse rows
- multiple statuses
- repeated item actions
- empty / one-item / many-item cases

compact variant では clipping / hidden meaning / tiny target がないか確認する。

### Theme and layer matrix

最低限:

- representative light theme
- representative dark theme
- nested/contextual layers used by the product

で content / border / focus / selection / disabled / status hierarchy を確認する。

### Keyboard and focus

- Tab order
- menu / overflow operation
- modal / popover focus lifecycle
- table sorting / selection where used
- focus visibility
- action completion後の logical focus

を actual interaction で確認する。

### Accessibility status

Carbon component の current accessibility status は evidence として確認するが、product composition 自体も `accessibility-audit` で再確認する。

standard component の tested status を、custom composition / content / flow 全体の conformance claim に拡張しない。

### Zoom / responsive

Web UI では少なくとも:

- narrow viewport
- continuous resize
- 200% text zoom
- 400% / 320 CSS px equivalent reflow where applicable

を確認する。

table / dense workspace では semantic 2D structure を無理に card 化せず、`table-design` / `responsive-design` の判断を優先する。

### AI presence

AI を含む場合:

- broad vs focused scope が実際の AI involvement と一致する
- explainability popover / path に keyboard で到達できる
- AI indicator が disabled / loading / edited state で誤解を生まない
- user-edited content と AI-generated content の provenance が混ざらない
- non-AI content に AI treatment が漏れていない

を確認する。

### Real-project promotion gate

experimental から先へ進める前に、実 product / realistic prototype で同じ representative task を Carbon adaptation し、少なくとも以下を記録する。

- density decision
- action hierarchy
- layer/theme behavior
- standard vs custom component decisions
- keyboard/focus result
- realistic data stress result
- AI provenance result（該当時）
- discovered limitation / exception

trial を行っていない場合は completed / promoted と報告しない。
