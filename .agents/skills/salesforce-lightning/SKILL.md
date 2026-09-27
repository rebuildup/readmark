---
name: salesforce-lightning
description: >
  Salesforce Lightning / SLDS 上の record-centric・data-heavy な application interface を設計・適応するときに使用する。
  SLDS 2 / Cosmos、record workflow、density、data operation、standard component の意味を current Salesforce context へ翻訳し、
  Salesforce 風の見た目を模倣するのではなく host platform と整合した task flow を作る。
---

# Salesforce Lightning

Salesforce Lightning Design System を visual preset として使わない。

この Skill は、既存 product の task / information model を **current Salesforce Lightning / SLDS の system conventions へ適応する層**として扱う。汎用的な form、table、navigation、color、keyboard、accessibility の設計原則は対応する domain Skill を source of truth とし、ここでは Salesforce 固有の context、host behavior、component semantics、version boundary を判断する。

## When to use

次のようなときに使用する。

- Lightning Experience 内の record / object / operational workflow を設計する
- Salesforce 上で動く application / extension を current SLDS に適応する
- SLDS 1 から SLDS 2 / Salesforce Cosmos への移行を考慮して interface を見直す
- Lightning Base Components と custom UI のどちらを使うべきか判断する
- record form、dense data operation、display density、desktop/mobile support の関係を整理する

Salesforce に似た blue palette、card、rounded control を作りたいだけなら使用しない。

## Workflow

1. **Inspect current Salesforce context**
   - org / product surface、theme、SLDS generation、target devices、record/data model、user task を確認する。
2. **Open current primary references**
   - `references/salesforce-lightning.md` から、今回の問題に関係する current Salesforce source を実際に開く。
3. **Extract system constraints**
   - record semantics、action hierarchy、density、component capability、keyboard model、theme/version difference を比較する。
4. **Translate, do not imitate**
   - product semantics を保ったまま current Lightning convention へ翻訳する。exact token / brand asset / component screenshot は clone しない。
5. **Prefer native system behavior where it fits**
   - standard Lightning component / pattern が task semantics と一致するなら優先し、custom UI は必要性を説明できる場合だけ使う。
6. **Verify the delivered task**
   - screenshot 単体ではなく、実際の record/data task、density、keyboard、narrow/mobile context、error/recovery を通して確認する。

## Observe

reference を開いたら、次を比較する。

### Platform / version context

- current surface が SLDS 1 / SLDS 2 のどちらを前提にするか
- Salesforce Cosmos / custom theme が有効か
- old token / hook / class pattern が current か migration-only か
- component / behavior が target surface・device で実際に support されるか

### Record / task structure

- object / record identity がどこで明示されるか
- view / edit / create が同一 task のどの phase か
- Save / Cancel / error recovery がいつ明示されるか
- page-level、record-level、row/item-level、batch、destructive action がどう分かれるか
- platform が既に持つ metadata / permissions / field layout を custom presentation が不必要に再発明していないか

### Density

- user / org の display density preference
- field label が above / inline のどちらになるか
- container width による density/layout adaptation
- simultaneous information量と editing precision
- compactness が readability / target acquisition / error recovery を犠牲にしていないか

### Data operation

- exact lookup / comparison / bulk operation のどれが中心か
- table/grid が本当に必要か
- datatable の navigation mode と action mode の境界
- editable/custom cells が standard keyboard behavior を維持しているか
- desktop-only component に essential task を閉じ込めていないか

### Standard vs custom component

- Lightning Base Component / current blueprint が task semantics に合うか
- built-in state、focus、keyboard、theme、density adaptation を利用できるか
- custom UI が必要な理由は product semantics か、単なる見た目の差か
- custom implementation が standard behavior を失っていないか

### Theme / styling semantics

- surface / content / border / accent / feedback の role
- global styling hook が何の意味を表すか
- exact value ではなく role relationship が維持されているか
- component internals / unsupported override に依存していないか
- brand emphasis が task hierarchy を上書きしていないか

## Current system boundary

### SLDS 2 を current direction として扱う

Salesforce の current guidance では SLDS 2 は Spring '25 に導入され、Salesforce Cosmos theme と結びつく current system である。

ただし、**全 org / surface が自動的に SLDS 2 だと仮定しない**。SLDS 1 は実運用上まだ存在する。設計前に current theme / environment を確認し、migration state を明示する。

古い screenshot や package name だけで generation を判断しない。

### Semantic hook を value catalog にしない

SLDS 2 では visual design と structure を分離する方向が強く、global styling hooks が semantic adaptation の evidence になる。

次を universal rule にしない。

- exact Salesforce color value
- exact spacing / radius / typography value
- deprecated design token / Aura token
- `--lwc-*` の legacy value
- implementation-specific class selector

current project では **surface / content / accent / feedback などの意味**を先に決め、その意味に対応する current system mechanism を確認する。

現行 guidance 上、component-level `--slds-c-*` hooks は SLDS 2 の一般的な current customization mechanism として扱えない。unsupported internals や DOM/class override を design source of truth にしない。

## Decision rules

### 1. Host information model を尊重する

Salesforce 上の task が object / record を中心に成立するなら、record identity、field groups、record actions、view/edit/create mode を一貫させる。

単に「enterprise UI だから」という理由で、record を無関係な nested card 群へ分解しない。

逆に current product が record-centric でない場合、Salesforce の record page structure を無理に適用しない。

### 2. Standard component を semantics から選ぶ

standard Lightning component が task semantics と一致し、必要な state / input / theme / density behavior を持つなら優先する。

custom UI を選ぶのは、少なくとも次のいずれかを説明できる場合にする。

- standard component では重要な product meaning を表現できない
- target surface で必要な workflow を support しない
- domain-specific interaction に明確な追加価値がある

「見た目を変えたい」だけでは custom control の十分な理由にしない。

### 3. Density を aesthetic preset にしない

Lightning の dense appearance をそのまま「enterprise = compact」と一般化しない。

field / row / toolbar の密度は、次から判断する。

- task frequency
- simultaneous comparison量
- editing precision
- user / org density preference
- available width
- input method
- error consequence

Lightning record form は density と container width の組み合わせで label placement が変化する。固定 desktop screenshot だけで field layout を決めない。

### 4. Record edit は commit / recovery model まで設計する

view → edit → validation → save / cancel → result の流れを一つの task として確認する。

入力 field の appearance だけを Lightning に合わせて、save/cancel、unsaved work、error location、permission failure を別物として放置しない。

詳細な question sequencing / validation policy は `form-design` を使う。

### 5. Datatable を desktop-only truth にしない

Lightning datatable が適切なのは、多列 comparison、selection、row action、editable data operation など 2D structure が task に必要な場合である。

current Salesforce documentation では `lightning-datatable` は mobile device support を持たない。mobile access が requirement に含まれる場合、同じ essential outcome に到達できる alternative representation / workflow を設計する。

responsive に column を無理に押し込むだけで解決したことにしない。

### 6. Datatable の keyboard modes を壊さない

Lightning datatable は keyboard interaction を単なる多数の Tab stop として扱わず、navigation mode と action mode を分ける。

custom cell / editable control を追加する場合、visual integration だけでなく、cell traversal、action entry/exit、focus visibility、disabled/read-only state、error recovery が coherent か確認する。

一般的な table-vs-grid 判断は `table-design`、keyboard composite pattern は `keyboard-interface` を source of truth とする。

### 7. Modal は interruption として選ぶ

Lightning Modal を「中央に出したい情報」の container として乱用しない。

- current task を止める理由があるか
- consequence / decision が明確か
- initial focus が論理的か
- keyboard dismissal / close が可能か
- close 後の workflow 位置が保たれるか

を確認する。

Salesforce documentation 内の具体的 timing/value は platform implementation guidance として扱い、universal design law にしない。

## Responsibility boundaries

この Skill は次を置き換えない。

- `form-design` — question order、grouping、validation、review / recovery
- `table-design` — table/list/grid 選択、row/column semantics、generic data operation model
- `navigation-design` — information-space navigation / orientation
- `interaction-states` — focus / selected / checked / pressed / disabled / read-only 等の state semantics
- `responsive-design` — general layout transformation / reflow policy
- `keyboard-interface` — generic keyboard traversal / composite-widget / overlay focus model
- `touch-interface` — target acquisition / gesture / mixed-input policy
- `color-system` — semantic color-role system
- `content-design` — label / instruction / error wording
- `internationalization-design` — translation expansion、locale、RTL / mixed direction
- `accessibility-audit` — delivered artifact の broad conformance re-test

`salesforce-lightning` が所有するのは、これらの判断を **current Salesforce Lightning / SLDS context、host information model、component capability、theme/version constraint へ翻訳すること**である。

## Avoid

- Salesforce blue、cloud-like shape、rounded card だけで SLDS を再現したとみなす
- old SLDS screenshot / archived source を current design source of truth にする
- SLDS 1 / SLDS 2 / Cosmos の状態を確認せず token / hook を混在させる
- legacy design token、Aura token、`--lwc-*` を new design rule として固定する
- unsupported component internals / DOM / CSS selector override を customization strategy の中心にする
- exact Salesforce spacing / radius / color を unrelated product の magic number にする
- dense enterprise UI を tiny type、narrow hit area、permanent truncation と同義にする
- every record / field / action を card 化する
- datatable を mobile の唯一の task path にする
- custom datatable cell で keyboard navigation/action contract を失う
- modal を routine navigation / detail view の代用にする
- Base Component API や LWC implementation tutorial を design principle と混同する

## Verify

最終 artifact で representative task を実行する。

### Version / theme

- actual target environment の SLDS generation / theme を確認したか
- SLDS 2 / Cosmos 前提なら current source と一致しているか
- migration context なら legacy/current mechanism を意図的に分けているか
- unsupported hook / class override に依存していないか

### Record workflow

少なくとも一つの現実的な record task で確認する。

- record identification / context
- view → edit or create
- field grouping / long realistic values
- validation / permission / save failure
- Save / Cancel / successful completion
- return / next task context

### Density / layout

該当する場合、同じ task を複数 context で比較する。

- Comfy / Compact / Cozy など target が support する density
- wide container / narrow container
- long field labels / localization expansion
- zoom / text resize
- keyboard / pointer、必要なら touch

label placement や action location が変わっても task semantics が維持されることを確認する。

### Data operation

interactive data table がある場合:

- realistic row/column volume
- navigation mode
- action mode
- editable/custom cell
- selection / row action / batch action
- loading / empty / error
- focus visibility / return path

mobile access が requirement なら、datatable 非対応 context でも同じ essential outcome を完了できることを実機または代表 viewport / surface で確認する。

### Standard / custom boundary

custom control ごとに次を確認する。

- standard component では満たせない理由がある
- default / hover / focus / pressed / selected / disabled / read-only / error / loading の relevant state がある
- keyboard / pointer / touch の必要な input path がある
- current theme / density / high-contrast behavior を損なわない

### Completion gate

次を満たすまで「Salesforce adaptation 完了」としない。

- current primary references を実際に確認した
- Salesforce 固有 semantics と generic domain policy を分離した
- exact values / proprietary expression を clone していない
- representative end-to-end task を delivered artifact で通した
- theme/version、density、input、error/recovery、target device capability を確認した
- 未対応 surface / limitation を明記した

## References

current primary URL、観察箇所、version caveat は [`references/salesforce-lightning.md`](./references/salesforce-lightning.md) を読む。
