---
name: sap-fiori
description: >
  Use when adapting business-object, transactional, analytical, or enterprise workflow
  interfaces to the current SAP Fiori design system. Translate task and information
  relationships into Fiori floorplans, density, shell, theming, table, and interaction
  conventions without cloning SAP products or turning SAPUI5 APIs into design policy.
---

# SAP Fiori

Last reviewed: 2026-09-13

SAP Fiori を「enterprise-looking UI」や Horizon の見た目を再現する style preset として使わない。

この Skill は current product の business task / object relationship を、current SAP Fiori の floorplan・shell・density・theme・component convention へ翻訳する **system adapter** として使う。

**Inspect → Compare Fiori evidence → Choose floorplan/system roles → Adapt → Verify** の順で進める。

## When to use

次のような 2D product UI を SAP Fiori に適応するときに使う。

- business object の検索・一覧・処理・編集を中心とする enterprise application
- list report / worklist / object page / analytical workflow を持つ product
- SAP Fiori Launchpad / SAPUI5 / Fiori Elements と整合する必要がある application
- dense table / form / filter / action workflow を持つ operational surface
- desktop / tablet / phone / hybrid input をまたぐ SAP business application

単に「SAPっぽい」「enterpriseっぽい」「Horizon風」にしたいだけなら使わない。

## Responsibility boundary

`sap-fiori` が決めるのは **current SAP Fiori への system adaptation** だけ。

以下は既存 Skill を source of truth にする。

- table semantics / grid interaction → `table-design`
- form task flow / validation → `form-design`
- information-space navigation → `navigation-design`
- viewport/container adaptation → `responsive-design`
- page/component spatial composition → `layout-system`
- focus / selected / pressed / disabled 等の意味 → `interaction-states`
- keyboard operation → `keyboard-interface`
- touch / pointer acquisition → `touch-interface`
- semantic color role → `color-system`
- light/dark transformation → `dark-mode-design`
- forced/high-contrast adaptation → `high-contrast-design`
- wording / information priority → `content-design`
- locale / RTL → `internationalization-design`
- broad accessibility conformance review → `accessibility-audit`

Fiori に component / floorplan が存在することを理由に、underlying domain decision を上書きしない。

## 1. Inspect the current product first

reference を開く前に current project を確認する。

最低限見るもの:

- primary user tasks
- business object / work item / dataset の関係
- known-item lookup か large-set discovery か
- item processing か analysis / drilldown か
- single-object display/edit/create か multi-object operation か
- launchpad / host shell が何を既に提供しているか
- desktop / touch / hybrid input context
- current table types and density
- object state / draft / save / cancel / recovery
- responsive / narrow-window behavior
- light / dark / high-contrast theme behavior
- loading / empty / error / message states

既存 product semantics を Fiori floorplan 名に合わせて作り替えない。

## 2. Open current references

最初に [`references/fiori-system.md`](references/fiori-system.md) を読む。

current SAP Design System / Fiori guidance を優先し、検索結果に出る古い versioned pages は historical evidence として扱う。

SAPUI5 / OpenUI5 / UI5 Web Components の API は implementation evidence であり、design source of truth にしない。

## 3. Observe these axes

### Task / floorplan fit

- large dataset から relevant item を探して action するのか
- focused work item set を順に処理するのか
- one business object の overview / display / edit / create なのか
- chart と table を組み合わせて root cause を drilldown するのか
- step-by-step guidance が必要なのか
- known identifier から特定 item に直行するのか

floorplan を visual template として選ばない。

### Shell and app responsibility

- launchpad shell が home / back / search / settings / help 等を所有しているか
- app body が host chrome を重複していないか
- page title / context / app-level action が host と競合していないか
- deep-link / back-navigation 時も orientation が維持されるか

### Information relationship

- list → detail / list → detail → subdetail の親子関係があるか
- side-by-side 表示が task continuity を実際に改善するか
- independent tools/panels を無理に flexible column layout へ押し込んでいないか
- object state / selection / filters が navigation 後に失われないか

### Density and input

- touch / mouse-keyboard / hybrid のどれが主要 context か
- cozy / compact が task efficiency と target acquisition に合うか
- user preference がある context で density を固定していないか
- compact 化によって label / focus / hit area / state clarity が壊れていないか
- 一つの page hierarchy 内で density mode が混在していないか

### Tables and data work

- row-oriented responsive table で task が成立するか
- cell-level analysis / large row count / hierarchy / frozen columns が本当に必要か
- analytical/grid/tree table を narrow/touch context にそのまま持ち込んでいないか
- small-screen alternative が同じ essential task outcome を提供するか

### Theming

- Morning Horizon / Evening Horizon / high-contrast themes で semantic role が保たれるか
- raw reference color ではなく semantically named theme/control role を使っているか
- custom color が state / theme / high contrast を壊していないか
- SAP brand asset / 72 font / exact radius・spacing を unrelated product の universal rule にしていないか

### Standard components / framework support

- current standard component / Fiori Elements floorplan が task semantics に合うか
- freestyle/custom control が必要な理由を説明できるか
- custom control で keyboard / resize / theme / globalization / RTL / accessibility behavior が失われていないか
- framework support と product requirement の差を visual hack で埋めていないか

## 4. Translate into Fiori decisions

### Choose floorplans from the job

原則として次の関係から開始する。

- **List report**: large dataset から search / filter / sort / group して relevant item を見つけ、action する。
- **Worklist**: relatively focused な work items を processing する。large-set exploration や rich analytics が主目的ではない。
- **Object page**: one business object の overview / display / edit / create と、複数 section の related information を扱う。
- **Analytical list page**: chart/table を組み合わせ、large dataset を slice / drilldown して root cause を見つけ transactional action へつなぐ。
- **Wizard**: completion に ordered steps と guided progression が必要。
- **Initial page / direct lookup**: known identifier から特定 object を探すことが主目的。
- **Dynamic page / freestyle**: predefined floorplan が task semantics を満たさないが、Fiori page/header/footer behavior は必要。

component availability ではなく user task と information model で選ぶ。

### Use flexible column layout only for real hierarchy

FCL は list-detail または list-detail-detail の continuity が価値を持つ場合に使う。

使わない例:

- IDE/workbench の arbitrary side panes
- independent dashboard cards
- unrelated tools を並べるだけの workspace
- one object を意味なく複数 column に分割するだけの構成

wide screen だから multi-column にするのではなく、同時表示すべき parent/child context があるかで決める。

### Respect shell ownership

launchpad / host shell が提供する global navigation / search / settings / help / home/back を app body に再実装しない。

app content では task-specific context と actions に集中する。

standalone surface では host responsibility が変わるため、実際の delivery context を確認してから shell assumption を適用する。

### Adapt density by input context

cozy / compact を aesthetic density preset として選ばない。

- touch-first → cozy を優先
- mouse/keyboard-first → compact が productive なら使用
- hybrid → user choice / current platform behavior を尊重

一つの application hierarchy 内で無秩序に混在させない。

### Keep theming semantic

Horizon の exact visual values を複製しない。

current product では:

- background / surface
- text / label
- field / button
- selection / focus
- semantic status
- theme-specific contrast

の role relationship を保つ。

Morning/Evening/high-contrast で role が成立することを確認する。

### Prefer standard Fiori behavior when semantics fit

standard component / Fiori Elements を優先する理由は外観ではなく、responsive / keyboard / globalization / theme / accessibility / message behavior が encode されているため。

customization が必要なら:

1. standard behavior で requirement を満たせない理由を特定する
2. custom UI の semantic role を定義する
3. keyboard / touch / resize / localization / theme / high contrast を同等に維持する
4. source implementation の private detail を design rule にしない

## Avoid

- Horizon の色・角丸・72 font だけをコピーして Fiori と呼ぶ
- every enterprise page を list report にする
- worklist と list report を visual resemblance だけで交換する
- analytical list page を「chart があるから」という理由だけで使う
- FCL を generic workbench layout にする
- phone/touch でも desktop-centric table を唯一の task path にする
- cozy / compact を一ページ内で恣意的に混在させる
- raw theme value を universal token として固定する
- launchpad-owned chrome を app body で二重化する
- SAPUI5 / Fiori Elements API や annotation catalog を Skill 本文の source of truth にする
- standard component を visual styling だけで置き換え、keyboard/theme/globalization behavior を失う

## Verify

最終 source ではなく、実際に利用者が操作する rendered artifact を確認する。

最低限:

1. representative business task を end-to-end で完了する。
2. floorplan が task / business-object relationship に合っているか確認する。
3. desktop と narrow/mobile 相当で同じ essential outcome に到達できるか確認する。
4. touch / mouse-keyboard / hybrid context が relevant なら density と target behavior を比較する。
5. table を使う場合、realistic data / long labels / many columns / empty / loading / error / selection / actions を確認する。
6. FCL を使う場合、one / two / three-column 状態と narrow-screen navigation を確認する。
7. Morning Horizon 相当 light、Evening Horizon 相当 dark、high-contrast path で hierarchy / states / focus / status が維持されるか確認する。
8. keyboard-only で primary task、table/list operation、overlay、save/cancel/recovery を確認する。
9. representative long translation / RTL が relevant なら layout と action order を確認する。
10. launchpad/embedded context では host shell と app chrome の重複がないか確認する。
11. custom control がある場合、standard control から失った behavior がないか比較する。

実 project trial を行っていない場合、promotion 完了と報告しない。
