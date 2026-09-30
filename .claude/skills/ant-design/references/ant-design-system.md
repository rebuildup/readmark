# Ant Design System References

Last reviewed: 2026-09-13

この reference は `ant-design` Skill が current Ant Design の middle/back-office operational model を観察するために使う。
React API、CSS variable、token 名、exact spacing / grid value は implementation evidence であり、design rule の source of truth ではない。

## Current status

- Ant Design v6 stable: 2025-11-22
- current public changelog reviewed: v6.6.3, 2026-09-07
- current Design / component documentation: `ant.design`
- current public implementation: `ant-design/ant-design`
- Ant Design Pro / Pro Components: middle/back-office implementation evidence
- deprecated `ant-design-pro-layout`: historical / migration evidence only

current version や component status は実装時に再確認する。

## Design philosophy / operational model

### Design Values

- https://ant.design/docs/spec/values/
  - Observe:
    - `Natural / Certain / Meaningful / Growing` が visual adjective ではなく product behavior にどう翻訳されているか
    - enterprise collaboration で learning / operation cost を下げるための consistency
    - task mission → subgoal → immediate feedback の関係
    - user / system / task context に沿った機能整理
  - Useful for:
    - repeatable operational workflow
    - stable interaction vocabulary
    - task hierarchy / feedback rationale
  - Avoid copying:
    - brand wordingを一般 product principle としてそのまま引用すること
    - 「enterprise だから compact」のような短絡

## Navigation / layout

### Navigation

- https://ant.design/docs/spec/navigation/
  - Observe:
    - global / local orientation
    - stable information architecture
    - operation-intensive application で persistent navigation が支える repeated switching
    - breadcrumb を hierarchy recovery に使う条件と、重複時に省く条件
    - unnecessary page transitions を減らしながら context を保つ方法
  - Useful for:
    - middle/back-office application shell adaptation
    - repeated cross-section operation
  - Avoid copying:
    - side navigation を every enterprise app の default にすること
    - navigation structure を generic `navigation-design` の代替にすること

### Layout

- https://ant.design/docs/spec/layout/
  - Observe:
    - information order と visual hierarchy
    - stable shell / content region relationship
    - repeated operational content が viewport variation にどう適応するか
  - Useful for:
    - Ant Design surface relationship を理解する
  - Avoid copying:
    - 8-grid / 24-grid / reference viewport / exact margin / breakpoint を universal value にすること

## Data display

### Data Display

- https://ant.design/docs/spec/data-display/
  - Observe:
    - information importance / operation frequency / association による presentation priority
    - table / list / card / tree / collapse の semantic fit
    - long content / empty data 等の extreme-state treatment
    - exact comparison と scanning が必要な場合の table choice
  - Useful for:
    - data-intensive operational interface
    - information relationship に基づく component-family selection
  - Avoid copying:
    - structured data をすべて table にすること
    - visual density だけで component を選ぶこと

### Table

- https://ant.design/components/table/
  - Observe:
    - sorting / filtering / pagination / selection / expandable relationship / fixed context 等が task に与える interaction cost
    - responsive column behavior と overflow
    - editable / nested / virtualized examplesを、data operation requirements の evidence として見る
    - loading / empty / error-adjacent stateとの連続性
  - Useful for:
    - current implementation evidence
    - dense operational data stress cases
  - Avoid copying:
    - React props / API catalog を design policy にすること
    - generic `table-design` の decision rules を置き換えること

### Empty

- https://ant.design/components/empty/
  - Observe:
    - no-data state と fresh-start state の違い
    - create / recover / change-filter 等の viable next action
  - Useful for:
    - operational continuity
  - Avoid copying:
    - illustration style を product-independent rule にすること

### Result

- https://ant.design/components/result/
  - Observe:
    - consequential operation result を page/region level で明示する条件
    - status + explanation + recovery/next action の組合せ
  - Useful for:
    - complex operation completion / failure
  - Avoid copying:
    - routine success を毎回 large result screen にすること

## Data entry

### Data Entry

- https://ant.design/docs/spec/data-entry/
  - Observe:
    - user expertise / domain familiarity に応じた labels / terminology
    - defaults / hints / format / context が blank-state guessing を減らす方法
    - data entry と subsequent feedback の continuity
  - Useful for:
    - repeated expert workflow と novice workflow の差分
  - Avoid copying:
    - generic form sequence / validation policyをこの referenceだけで決めること

### Form

- https://ant.design/components/form/
  - Observe:
    - layout variants が information density / label relationship にどう影響するか
    - validation / error locating / preserved input / modal form 等の current implementation patterns
    - large operational form で grouping と action placement がどう保たれるか
  - Useful for:
    - current component behavior evidence
  - Avoid copying:
    - component API / default options を universal UX rule にすること
    - `form-design` の task-flow policy を置き換えること

## Context-preserving subtasks

### Drawer

- https://ant.design/components/drawer/
  - Observe:
    - main task context を保持したまま create / edit / inspect を行う構造
    - popover より重く、独立 page より context continuity が重要な subtask
    - nested / multi-level use の complexity cost
  - Useful for:
    - contextual create/edit/detail workflow
  - Avoid copying:
    - durable / shareable / independent task をすべて Drawer に閉じ込めること
    - navigation を避けること自体を目的にすること

### Modal

- https://ant.design/components/modal/
  - Observe:
    - current page context 内で attention を集中させる短い consequential task
    - confirmation / blocking decision の scope
    - close / cancel / confirmation後の return context
  - Useful for:
    - consequential interruption
  - Avoid copying:
    - low-consequence acknowledgement への過剰使用
    - long independent workflow を modal に詰め込むこと

### Popconfirm

- https://ant.design/components/popconfirm/
  - Observe:
    - action target の近くで軽量 confirmation を行う条件
    - consequence と interruption cost の balance
  - Useful for:
    - localized confirmation
  - Avoid copying:
    - complex explanation / irreversible high-risk task を tiny popover に押し込むこと

## Feedback hierarchy

### Research: Message and Feedback

- https://ant.design/docs/spec/research-message-and-feedback/
  - Observe:
    - consequence / urgency / persistence / recovery need に対する feedback surface の違い
    - immediate feedback と over-feedback の境界
    - local / global、blocking / non-blocking、transient / persistent の選択
  - Useful for:
    - feedback modality decision
  - Avoid copying:
    - one event に複数 feedback layer を重ねること
    - transient Message で important failure を流すこと

### Feedback specification

- https://ant.design/docs/spec/feedback-cn/
  - Observe:
    - Alert / Tooltip / Progress / Popconfirm / Message / Modal の interruption-strength relationship
    - user が次に何をすべきか分かる recovery path
  - Useful for:
    - first-party feedback taxonomy の比較
  - Note:
    - locale-specific pageでも design evidence として使用できるが、current English research pageと合わせて確認する

## Density / grouping implementation evidence

### Space

- https://ant.design/components/space/
  - Observe:
    - loosely grouped controls と tightly connected compound input/action の違い
    - compactness が semantic relationshipを示す場合と、単なる spacing reduction の違い
  - Avoid copying:
    - exact gap value / compact API を universal rule にすること

## Localization / direction implementation evidence

### ConfigProvider

- https://ant.design/components/config-provider/
  - Observe:
    - locale / direction / theme context が component family 全体へ及ぶこと
    - RTL / localization を isolated component styling で済ませないこと
  - Avoid copying:
    - provider API を `internationalization-design` の代替にすること

## Current public implementation

### Ant Design repository

- https://github.com/ant-design/ant-design
  - Observe:
    - current public component implementation / repository activity
    - release cadence / current supported major
  - Avoid copying:
    - source code / CSS / test fixture を design source of truth にすること

### Changelog

- https://github.com/ant-design/ant-design/blob/master/CHANGELOG.en-US.md
  - Observe:
    - current stable release / date
    - semantic structure / CSS variable / component change as freshness evidence
  - Last reviewed state:
    - v6 stable: 2025-11-22
    - v6.6.3: 2026-09-07
  - Avoid copying:
    - package version を design-system-wide immutable version contract とみなすこと

### Ant Design Pro

- https://github.com/ant-design/ant-design-pro
  - Observe:
    - current middle/back-office composition patterns
    - data-dense operations / shell / page-level integration
  - Useful for:
    - public first-party implementation evidence
  - Avoid copying:
    - demo information architectureを unrelated product に移植すること

### Pro Components

- https://github.com/ant-design/pro-components
  - Observe:
    - current higher-level operational composition / data-entry / data-display integration
  - Avoid copying:
    - framework abstraction / component APIを design policy にすること

### Historical / deprecated: Pro Layout

- https://github.com/ant-design/ant-design-pro-layout
  - Status: deprecated / moved to Pro Components
  - Use only for:
    - migration / historical implementation context
  - Never use as:
    - current design-system source of truth

## Cross-reference responsibilities

`ant-design` は Ant Design への system adaptation だけを担当する。
下記は各 Skill が canonical source である。

- table semantics / grid-vs-table / responsive comparison → `table-design`
- question sequence / validation / recovery → `form-design`
- information-space movement / navigation semantics → `navigation-design`
- focus / selected / disabled / loading state semantics → `interaction-states`
- keyboard model → `keyboard-interface`
- pointer / target / gesture behavior → `touch-interface`
- responsive transformation → `responsive-design`
- semantic color system / appearance modes → `color-system`, `dark-mode-design`, `high-contrast-design`
- wording / message clarity → `content-design`
- localization / RTL / mixed-direction / formatting → `internationalization-design`
- broad accessibility re-test → `accessibility-audit`

Neighboring enterprise adapters:

- `ibm-carbon`: contextual layering, Carbon component/density conventions, AI presence / provenance
- `sap-fiori`: business-object floorplans, Fiori shell, FCL, Fiori Elements relationships
- `salesforce-lightning`: record-centric Salesforce host semantics / SLDS
- `atlassian-design-system`: collaboration/work-management host conventions / ADS / Rovo

Ant Design Skill は **middle/back-office repeated operational workflow、context-preserving subtask、feedback interruption hierarchy** を主な system-specific translation surface とする。
