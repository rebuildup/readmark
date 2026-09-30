---
name: shopify-polaris
description: >
  Adapt merchant-facing Shopify app interfaces to current Polaris and Shopify Admin conventions while preserving
  product semantics. Use for App Home, resource-management, settings/save flows, Shopify-hosted navigation/chrome,
  or current Polaris component and pattern decisions.
---

# Shopify Polaris

Polaris を Shopify らしい見た目を作る visual preset ではなく、merchant-facing app を current Shopify Admin の workflow / host surface / interaction conventions へ適応する system layer として使う。

`navigation-design`、`form-design`、`table-design`、`content-design`、`interaction-states`、`responsive-design`、`keyboard-interface`、`touch-interface`、`color-system`、`typesetting`、`accessibility-audit` は、それぞれの underlying design problem の canonical source とする。この Skill は、それらの判断を Shopify Admin / App Home 上でどう表現・組み合わせるかを扱う。

## Workflow

1. merchant の task、resource / object model、primary actions、save model、target Shopify surface を先に確認する。
2. current Shopify App Design Guidelines、App Home patterns、Polaris reference を開く。surface / version status を確認する。
3. reference を `Observe` の軸で比較し、Shopify Admin 共通の workflow と app-specific expression を分ける。
4. product semantics を host chrome、page pattern、resource flow、actions、status、save/discard behavior へ翻訳する。
5. current standard pattern / Polaris component が semantic fit する場合は優先し、custom UI は merchant task 上の必要性を説明できる場合だけ使う。
6. delivered artifact を Shopify Admin context で realistic merchant task として検証する。

## When to use

- Shopify Admin に embedded / App Home app を設計する
- Shopify Admin の app nav / title bar / save bar と app body の責務を整理する
- merchant homepage、resource index、details/edit、settings、onboarding/setup flow を設計する
- resource-heavy workflow の status / item action / batch action / empty state を current Shopify conventions へ適応する
- current Polaris web components / patterns を使うべきか custom UI にするべきか判断する
- desktop と Shopify mobile を跨ぐ merchant workflow を検証する

Shopify と無関係な product を単に Polaris 風の色・radius・spacing にしたいだけなら使わない。

## Observe

### Host and surface context

- Shopify Admin が app nav、page title、page actions、save/discard affordance のどこを所有しているか
- app body が host chrome と重複していないか
- desktop sidebar と Shopify mobile header で navigation presentation がどう変わるか
- App Home / Admin extension / Checkout / Customer Account など surface ごとの component availability
- iframe / extension surface の違いが merchant task semantics を変えるか

### Merchant task and page model

- homepage が status、attention、quick action、metrics、setup progress の何を優先しているか
- index / resource collection が scan、selection、filtering、item action、batch action をどう分けるか
- details / edit page で primary resource information と secondary metadata / status / summary がどう分かれるか
- settings が related options をどう grouping し、contextual help と destructive action をどこへ置くか
- setup guide / onboarding が daily-use homepage とどう共存し、完了後に dominance を下げるか

### Navigation and action hierarchy

- app nav と body 内 secondary navigation の責務
- page title / breadcrumb / Back と current location の関係
- title-bar action、body action、item action、batch action、destructive action の prominence
- key workflow を Shopify Admin の外へ出していないか
- tabs が secondary navigation として限定され、上位 context を不必要に変えないか

### Save, state, and recovery

- long form / settings edit に explicit save/discard が必要か
- unsaved changes を離脱時に保護できるか
- validation error 後に入力内容と task context が残るか
- loading / empty / error / disabled / success state が resource workflow を中断しないか
- destructive action が consequence と recovery / confirmation need に応じた扱いになっているか

### Current system usage

- current Polaris web component / pattern が対象 surface で利用可能か
- component の semantic role と current task が一致するか
- standard component が keyboard / focus / accessibility / responsive behavior をどこまで提供するか
- archived React Polaris の API / token / examples を current guidance と誤認していないか
- current API version / reference window が design assumption に影響するか

## Decision rules

### 1. Adapt merchant workflow before visual style

最初に Polaris の見た目を再現しない。

先に current app で以下を固定する。

- merchant goal
- resource / object model
- page purpose
- navigation hierarchy
- primary / secondary / item / batch actions
- save / discard semantics
- error / recovery model
- target Shopify surface

その後で current Shopify Admin / Polaris conventions へ翻訳する。

Shopify Admin の screenshot に似ていることを acceptance criterion にしない。

### 2. Separate host chrome from app-body responsibility

Shopify Admin / App Bridge が提供する app navigation、title bar、page actions、save bar 等と app body の責務を重複させない。

特に次を避ける。

- app nav と同じ destination list を body に常設する
- page header を main navigation に使う
- host が既に示す app identity / current page context を decorative header として再構築する
- native title-bar action と同じ action を body 上部に重複配置する

body 内の navigation が必要なら、それが local / secondary / resource relationship のどれかを説明できること。

### 3. Make App Home operational, not promotional

merchant が日常的に app を開く理由を homepage の hierarchy にする。

優先候補:

- attention が必要な status / issue
- immediate next action
- resource / workflow summary
- useful metrics
- unfinished setup / onboarding
- contextual help / support

generic hero、feature marketing、巨大な brand message を daily operation より上位に置かない。

新規 merchant と returning merchant で必要な hierarchy が異なる場合は、setup progress が完了後も永久に primary surface を占有しないようにする。

### 4. Choose page patterns by information relationship

Homepage / Index / Details / Settings 等の pattern は semantic starting point として使う。

- collection を比較・検索・操作する → Index / resource-oriented structure
- 一つの object を理解・編集する → Details / edit structure
- product-wide preference を管理する → Settings structure
- initial configuration を段階的に進める → Setup guide / onboarding structure

pattern の grid、card 数、column 数、exact spacing をコピーするために情報モデルを歪めない。

### 5. Preserve explicit save semantics where the workflow expects them

merchant が複数 field / section を編集し、変更の commit timing が意味を持つ場合は Shopify Admin の explicit save/discard model を優先的に検討する。

continuous auto-save を「modern」だから採用しない。auto-save が domain 上本当に必要な場合は、保存状態、失敗、undo / recovery、離脱時 behavior を明示し、host の save affordance と競合させない。

validation error で entered work を失わせない。

`form-design` が question / validation / review structure の canonical source であり、この Skill は Shopify Admin の save / host integration へ適応する。

### 6. Use resource flows when they match the product model

resource-heavy app では collection / index → details / edit という familiar relationship を優先的に検討する。

ただし resource として扱う意味がない settings / singleton task を無理に table/list 化しない。

resource UI では次を分ける。

- resource identity
- status / metadata
- primary row/item action
- batch action
- destructive action
- navigation to detail/edit

status badge や compact row styling だけを真似して resource semantics を曖昧にしない。

### 7. Use current Polaris, not archived React Polaris as current truth

current Shopify documentation の Polaris web components / patterns / App Bridge integration を current implementation evidence とする。

`Shopify/polaris-react-archive` は historical / migration evidence のみに使う。archived React component props、old token names、old examples を current design rule にしない。

Shopify surface / API version により available component が変わるため、実装前に対象 surface の current reference を開く。

### 8. Prefer standard patterns/components when semantics fit

standard Polaris pattern / component を優先する理由は見た目ではなく、Shopify Admin consistency、host integration、state behavior、keyboard/focus、accessibility、responsive behavior を共有できるため。

custom UI は以下の場合に限る。

- merchant domain-specific information relationship を standard component で表現できない
- direct manipulation / visualization が task efficiency に必要
- standard pattern では primary workflow が著しく複雑になる

custom UI でも equivalent focus / keyboard / touch / state / narrow-layout / localization behavior を設計する。

### 9. Keep surface constraints version-sensitive

Polaris は複数 Shopify surface で共通化されているが、利用可能 component / property / host integration は同一とは限らない。

- App Home
- Admin UI extension
- Checkout
- Customer Account
- POS 等

の current reference を task に応じて確認する。

一つの surface の component behavior を他 surface の universal rule にしない。

## Responsibility boundaries

- `navigation-design`: information-space movement / orientation / navigation model
- `form-design`: field / question sequencing / validation / review flow
- `table-design`: tabular comparison / grid interaction / row operations
- `content-design`: wording / information priority / error and status message clarity
- `interaction-states`: component state semantics
- `responsive-design`: viewport / container / reflow policy
- `keyboard-interface`: keyboard traversal / focus lifecycle
- `touch-interface`: target acquisition / gesture / mixed input
- `color-system`: semantic color roles
- `typesetting`: typographic composition
- `accessibility-audit`: broad rendered / semantic / conformance re-test
- `shopify-polaris`: above decisions を current Shopify Admin host / Polaris patterns / merchant workflows へ翻訳する system layer

## References

詳細な observation target と freshness note は [`references/shopify-polaris.md`](./references/shopify-polaris.md) を読む。

実行時は target surface / merchant task に relevant な reference だけを開く。

## Avoid

- Shopify Admin / Polaris screenshot を pixel-copy する
- Shopify color、radius、spacing、token value を unrelated product に移植する
- app nav / title bar / save affordance を app body で二重実装する
- merchant homepage を generic marketing LP にする
- every resource action を primary button にする
- long form を理由なく modal に押し込む
- Shopify Admin の explicit save model と競合する auto-save を無説明で導入する
- old React Polaris API / token / examples を current guidance として使う
- one Shopify surface の component availability を全 surface へ一般化する
- standard pattern に合わせるためだけに product object model を変える

## Verify

最終 artifact を source code だけで判定しない。

- actual Shopify Admin / representative embedded host context で primary merchant task を通す
- desktop と Shopify mobile / narrow context で app nav、title、actions、body relationship を確認する
- homepage → resource index → detail/edit → return の代表 flow を realistic data で通す
- settings / long-form edit では modify → validation error → correction → save/discard を通し、entered work と unsaved-state protection を確認する
- empty / loading / error / success / no-permission / destructive state を該当 task で確認する
- keyboard-only で host chrome から app body、body 内 controls、overlay、back/return まで focus が論理的に動くか確認する
- long resource name、long translated text、multiple statuses、large resource counts で clipping / hidden action / hierarchy collapse を確認する
- custom UI を含む場合、standard Polaris UI と並べて state / focus / touch / narrow-layout behavior が劣化していないか確認する
- target Shopify surface で使う component / pattern が current reference 上 supported か再確認する

real-project trial を行っていない場合、first-class promotion が完了したとは扱わない。
