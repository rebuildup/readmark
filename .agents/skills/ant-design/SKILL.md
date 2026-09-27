---
name: ant-design
description: >
  Adapt repeatable middle/back-office and data-intensive operational interfaces to current Ant Design conventions while preserving product semantics, contextual subtasks, feedback hierarchy, and task-level accessibility.
---

# Ant Design

Ant Design を「compact な enterprise UI の見た目」として適用しない。

この Skill は、**反復される middle/back-office 業務、structured data、data entry、context-preserving subtask、feedback hierarchy** を current Ant Design の operational model へ翻訳するときに使う。

`table-design`、`form-design`、`navigation-design`、`interaction-states`、`keyboard-interface`、`responsive-design`、`content-design`、`internationalization-design`、`accessibility-audit` 等は、それぞれの underlying problem の canonical source のままにする。

## Workflow

1. current product の user role、task repetition、data relationship、consequence を確認する。
2. current Ant Design reference を実際に開き、version/status を確認する。
3. 下記 observation axes で複数 reference を比較する。
4. generic enterprise pattern と Ant Design-specific operational convention を分離する。
5. current project の IA / brand / design system / accessibility constraints を優先して翻訳する。
6. representative end-to-end task を delivered artifact 上で検証する。

## When to use

次のような interface を Ant Design / Ant Design Pro 系の current convention に適応するときに使う。

- admin / operations / management console
- repeated CRUD / review / approval / configuration workflow
- data-heavy list → inspect → edit / act workflow
- experienced users が頻繁に使う middle/back-office surface
- table / form / contextual edit / feedback が連続する task
- Ant Design component ecosystem を利用する既存 product の design refinement

単に「enterprise っぽくしたい」「中国系 SaaS の見た目にしたい」という理由では使わない。

## Observe

reference を開いたら、少なくとも次を見る。

### Task / user context

- user は novice / occasional / domain expert のどれに近いか
- task は daily repeated operation か、rare consequential task か
- user が比較・入力・判断・確認する主要 object は何か
- completion を妨げる context switching はどこで起きるか

### Information / operation density

- data の primary identifier / status / metadata / action は何か
- exact cross-column comparison が必要か
- operation frequency が高い action は何か
- long text / empty / loading / error / partial data で hierarchy が壊れないか
- compactness が scanabilityを高めているか、単に cramped になっているか

### Navigation / context

- global / section / object / page context をどこが担うか
- repeated switching に persistent navigation が必要か
- hierarchy recovery に breadcrumb が必要か、それとも page title / nav current state と重複するか
- current context を保持した subtask にする価値があるか

### Subtask presentation

- task は independent / durable / shareable か
- main task の data/context を見ながら完了する必要があるか
- action consequence は軽量か重大か
- page / Drawer / Modal / Popconfirm の interruption cost が task weight と一致するか

### Feedback

- feedback は local / global のどちらか
- transient / persistent のどちらが必要か
- user action を block する必要があるか
- consequence / urgency / recovery need はどれくらいか
- user が次に取れる action が明確か

### Data entry

- domain terminology は user に既知か
- blank input から推測させていないか
- default / hint / format / constraint を事前に示せるか
- validation後に入力・位置・task context が保たれるか

### System adaptation

- current Ant Design major / component status は何か
- standard component が既に task semantics を表現できるか
- custom UI が必要な product-specific reason はあるか
- light/dark/theme、RTL/localization、keyboard/focus、zoom/reflow で意味が保持されるか

## References

詳細な direct URL と observation guidance は [`references/ant-design-system.md`](./references/ant-design-system.md) を読む。

最低限、実装前に次を current source として開く。

- https://ant.design/docs/spec/values/
- https://ant.design/docs/spec/navigation/
- https://ant.design/docs/spec/data-display/
- https://ant.design/docs/spec/data-entry/
- https://ant.design/docs/spec/research-message-and-feedback/
- https://ant.design/components/table/
- https://ant.design/components/form/
- https://ant.design/components/drawer/
- https://ant.design/components/modal/
- https://github.com/ant-design/ant-design/blob/master/CHANGELOG.en-US.md

Last reviewed: 2026-09-13

## Decision rules

### 1. Ant Design を operational adapter として使う

Ant Design 固有の価値は、blue/gray palette、rounded control、compact table ではない。

次をまとめて扱う operational model として見る。

- repeated task の orientation
- structured data display / entry
- frequent action の discoverability
- context を保持する subtask
- consequence に比例した feedback
- standard component 間の predictable behavior

current product がこれらを必要としないなら、Ant Design の surface vocabulary を無理に移植しない。

### 2. stable navigation は repeated operation を支える場合だけ使う

side navigation / persistent shell は operation-intensive な複数 section を頻繁に切り替える task で有効。

次の場合は増やさない。

- journey がほぼ linear
- section switching が稀
- page 内の task completion が primary
-既存 host shell が navigation を所有している

breadcrumb も hierarchy recovery が必要な場合だけ使う。
page title、current nav、parent context と同じ情報を重複表示しない。

### 3. data presentation は relationship と operation から選ぶ

Table を default enterprise component にしない。

- exact row/column comparison → table を検討
- lightweight collection / heterogeneous summary → list / card を検討
- hierarchy → tree を検討
- optional nested detail → collapse / expandable structure を検討

具体的な static table / interactive grid / responsive comparison policy は `table-design` に従う。

重要度、operation frequency、association の強さで visible information を優先する。
「全部見える」ことより、primary identifier / state / next action を短時間で識別できることを優先する。

### 4. productive density と cramped UI を区別する

frequent expert task では同時に多くの object / state / action を見せる価値がある。
しかし density のために次を犠牲にしない。

- readable labels
- target acquisition
- clear row/object identity
- state distinction
- keyboard focus visibility
- error / warning / destructive consequence
- essential action discoverability

hover-only action、icon-only action、過剰 truncation、小さすぎる control を「Ant Designらしい compactness」として正当化しない。

### 5. page と context-preserving subtask を task independence で分ける

#### Page

次なら独立 page / route を優先する。

- task 自体が primary destination
- URL/share/deep-link/back history が重要
- content が長い / multi-section
- task が main context を見なくても成立する
- nested overlay が増えそう

#### Drawer

次なら Drawer を候補にする。

- main task の context/data を見ながら inspect / create / edit したい
- subtask は popover より substantial
- 完了後に main context へ自然に戻る
- independent destination にするほど task weight が大きくない

Drawer を「ページ遷移を嫌うための default」にしない。
多段 nested Drawer は orientation / focus / recovery cost を明示的に評価する。

#### Modal

次なら Modal を候補にする。

- current context 内で attention を一時的に集中させる
- decision / short task / consequential confirmation が bounded
- dismiss / cancel 後の return context が明確

long form、deep workflow、multi-section task を modal に押し込まない。

#### Popconfirm

次なら lightweight local confirmation を候補にする。

- action target と confirmation context が近い
-説明量が少ない
- consequence を短い decision で理解できる

高リスクで説明・alternative・recovery が必要な operation を tiny confirmation に押し込まない。

### 6. feedback strength を consequence に合わせる

feedback surface は見た目ではなく次で選ぶ。

- urgency
- consequence
- persistence need
- blocking need
- recovery action
- scope: component / region / page / application

原則:

- lightweight acknowledgement → transient feedback を候補にする
- user がしばらく参照すべき warning / error → persistent feedback を候補にする
- process duration / progress が意味を持つ → progress/loading state を示す
- localized consequential action → local confirmation を検討する
- important blocking decision / failure → stronger interruption を検討する
- completed consequential workflow → result / next-action presentation を検討する

重要な failure を transient Message だけで消さない。
routine success を毎回 Modal で止めない。
同じ event に toast + alert + modal などを重ねて over-feedback にしない。

### 7. data entry は expertise を前提に調整する

`form-design` の task flow を canonical としつつ、Ant Design adaptation では user expertise を確認する。

- expert が familiar な domain label を unnecessary prose で薄めない
- novice が意味を推測する必要がある field には context / hint / example を与える
- predictable default があるなら blank state から推測させない
- format / constraint を error 後だけでなく適切な時点で示す
- error 後も entered work / location / correction context を保つ

compact horizontal form を「enterprise default」として固定しない。

### 8. Empty / Result を operational state として扱う

Empty は decoration ではない。

- 初回利用で data がない
- filter により 0 件
- permission / scope により見えない
- resource が削除済み

を区別し、可能な場合は viable next action を示す。

Result は consequential outcome が page/region level で説明を必要とするときに使う。
small inline state で十分な outcome を large status screen にしない。

### 9. v6 の implementation detail を universal rule にしない

current Ant Design v6 の semantic structure、CSS variables、token/component behavior は **current implementation evidence** として使う。

次を current project の universal design law にしない。

- exact grid count
- spacing unit
- reference viewport
- breakpoint
- radius
- font size
- token name
- CSS variable
- React prop / component API

現在の version/status は changelog と current docs で再確認する。
deprecated Ant Design Pro package を current guidance として使わない。

### 10. standard component first、ただし blind trust しない

standard Ant Design component が task semantics に適合するなら優先する。

custom component を作る場合は、少なくとも次を同等に保つ。

- semantic state
- keyboard operation
- focus entry / exit / restoration
- touch/pointer target
- responsive behavior
- localization / RTL
- theme / contrast behavior
- loading / error / disabled behavior
- accessible name / relationship

standard componentを使用していること自体を accessibility verification の代替にしない。

## Boundaries with existing Skills

- table/list/grid semantics → `table-design`
- form task flow / validation / review → `form-design`
- navigation IA / movement / orientation → `navigation-design`
- focus / selected / checked / disabled / busy semantics → `interaction-states`
- keyboard traversal / composite operation → `keyboard-interface`
- touch target / pointer interaction → `touch-interface`
- layout adaptation / reflow → `responsive-design`
- semantic colors / appearance transformation → `color-system`, `dark-mode-design`, `high-contrast-design`
- labels / instructions / error wording → `content-design`
- locale / RTL / formatting → `internationalization-design`
- broad conformance / assistive-technology retest → `accessibility-audit`

Neighboring system adapters とも責務を混ぜない。

- `ibm-carbon` → Carbon の layer / density / AI-presence conventions
- `sap-fiori` → Fiori の business-object floorplan / shell / FCL conventions
- `salesforce-lightning` → Salesforce record-centric host / SLDS conventions
- `atlassian-design-system` → Atlassian work-management / collaboration conventions

`ant-design` は **middle/back-office repeated operation + contextual subtask + feedback hierarchy** への translation を中心にする。

## Avoid

- Ant Design を side-nav + cards + compact table の style preset として使う
- enterprise だから全画面を table にする
- every action を icon-only / hover-only にする
- raw 8-grid / 24-grid / breakpoint / token value を universal rule にする
- Drawer を page navigation の代わりとして乱用する
- nested Drawer / Modal を重ねて context を不透明にする
- important failure を消える Message のみにする
- routine acknowledgement を Modal で毎回 interrupt する
- exact Ant Design Pro demo IA を別 product へコピーする
- deprecated Pro Layout を current source of truth にする
- React API / CSS variable / component props を design principle として教える
- component library を使っただけで accessibility が成立したとみなす

## Verify

source/build success だけで完了しない。
realistic operational task を実物で通す。

### Representative task

少なくとも一つ、次のような full flow を選ぶ。

`collection/search → inspect → contextual edit/action → validation/confirm → feedback/result → return to collection`

realistic data / names / statuses / permissions / failures を使う。

### Wide / narrow

- wide desktop で primary data / actions / navigation がscanできる
- narrow width で essential task path が消えない
- horizontal overflow / column reduction / alternative presentation が task semantics と一致する
- Drawer / Modal が viewport 内で usable で、close / back context が明確

### Density

- long identifier / label / status / numeric data を入れる
- high-frequency actions と low-frequency actions の優先度が分かる
- truncation 後も identity / consequence が復元できる
- pointer hover 無しでも essential action を発見できる

### Keyboard / focus

keyboard-only で representative flow を完了する。

- logical focus order
- visible focus
- overlay entry / containment where required / dismissal / restoration
- table/form/action操作で trap がない
- validation errorへ移動しても user context が失われない

### Zoom / text scaling

- 200% text zoom 相当で labels / actions / validation が欠けない
- 400% browser zoom / narrow reflow 相当で essential task が完了できる
- fixed-height / clipped overlay がない

### States

少なくとも確認する。

- loading / processing
- empty initial state
- filtered zero-result state
- field / operation error
- partial failure if domain supports it
- success / completion
- destructive confirmation / cancellation
- disabled / unavailable action where applicable

feedback strength が consequence と一致するかを見る。

### Localization / RTL

対象 product が多言語対応するなら、実際の長い locale sample と RTL context を使う。

- label expansion
- table/header/action overflow
- Drawer/Modal layout
- icon / directional relationship
- numeric / identifier mixed direction

詳細な policy は `internationalization-design` に従う。

### Theme / contrast

current product が light/dark/theme variation を持つなら両方で確認する。
high contrast / forced colors を support する surface では semantic boundary、focus、status、selected state が残ることを確認する。

### Final questions

- Ant Designを外したとしても product semantics が説明できるか
- component choice は visual resemblance ではなく task/data relationship で説明できるか
- page vs contextual subtask の選択理由を説明できるか
- feedback modality は consequence/urgency/recovery need で説明できるか
- density は repeated operation を助けており、重要情報を隠していないか
- current Ant Design reference を直接確認したか
- standard/custom choice の accessibility/input cost を実物で確認したか

実 project trial が promotion condition の場合、上記を実 artifact で完了していない状態を completed と報告しない。
