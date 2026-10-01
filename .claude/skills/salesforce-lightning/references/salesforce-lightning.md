# Salesforce Lightning references

Last reviewed: 2026-09-13

この reference set は `salesforce-lightning` Skill の runtime input である。Salesforce / SLDS は version・theme・component support が変化するため、exact implementation detail が task に影響する場合は stored note より current linked page を優先する。

## Current system / version

- [Compare Salesforce Lightning Design System Versions](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds1-slds2.html)
  - Primary / current Salesforce Developers guidance.
  - Observe: SLDS 1 と SLDS 2 の coexistence、Spring '25 の SLDS 2 introduction、Salesforce Cosmos theme、structure と visual design の separation。
  - Useful for: current generation / theme boundary を最初に判定する。
  - Avoid copying: version nameだけから current org state を推定しない。

- [Lightning Design System 2](https://www.lightningdesignsystem.com/)
  - Canonical current SLDS 2 design-system surface。
  - Observe: current component / foundation vocabulary、system direction、current visual/system relationship。
  - Useful for: exact current system guidance が material なときの freshness anchor。
  - Note: documentation surface は dynamic / JS-rendered であるため、specific component status は current page を都度確認する。

- [Style with Lightning Design System](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds)
  - Observe: standard Lightning Base Components、SLDS 1 / SLDS 2 adaptation、custom styling の supported boundary。
  - Useful for: standard-component-first と migration strategy。
  - Avoid copying: internal markup / CSS class を public stable API とみなさない。

- [SLDS Validator — Interpret Your Results](https://developer.salesforce.com/docs/platform/slds-validator/guide/interpret-your-results.html)
  - Observe: SLDS 2 migration findings、deprecated design code、current validator interpretation。
  - Useful for: current-vs-legacy implementation evidence と migration risk。
  - Avoid copying: validator rule を design rationale の代替にしない。

- [SLDS Linter — Get Started](https://developer.salesforce.com/docs/platform/slds-linter/guide/get-started-intro.html)
  - Observe: current linter scope と SLDS 1 / SLDS 2 transition support。
  - Useful for: implementation verification が必要なときの supporting evidence。
  - Avoid copying: lint success を delivered design verification の代替にしない。

## Styling semantics / theming

- [SLDS Styling Hooks](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-custom-properties)
  - Observe: global styling hooks と component-level hooks の current support boundary、semantic customization、fallback behavior。
  - Useful for: supported customization strategy と current SLDS 2 limitation を確認する。
  - Important: current guidance では component-level `--slds-c-*` styling hooks を SLDS 2 の一般的 mechanism として使えない。task 時点で再確認する。
  - Avoid copying: exact hook value、hardcoded theme value、unsupported component internals。

- [SLDS Design Tokens (Deprecated)](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-design-tokens)
  - Historical / migration evidence。
  - Observe: legacy design token / Aura token / `--lwc` patterns と SLDS 2 global styling hooks への transition。
  - Useful for: existing code の legacy source を分類する。
  - Avoid copying: deprecated token を new Skill rule / current system vocabulary として固定しない。

- [Base Component Design Variations](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-variants.html)
  - Observe: semantic variants → utilities → supported styling hooks という customization choices。
  - Useful for: visual customization より semantic component role を先に選ぶ。
  - Avoid copying: implementation API を design source of truth にしない。

- [Style a Component](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-intro.html)
  - Observe: base components が SLDS styling / system behavior を担う範囲、custom component の boundary。
  - Useful for: standard vs custom control の判断。

- [New skill: applying-slds](https://developer.salesforce.com/developer-centers/agentforce-vibes/announcements/skill-applying-slds)
  - Published: 2026-06-12.
  - First-party current agent/developer policy evidence。
  - Observe: Lightning Base Components preference、global styling hooks with fallbacks、surface/accent/feedback pairings、hardcoded value avoidance、validator integration。
  - Useful for: current Salesforce が agent-assisted implementation に何を canonical としているかを確認する。
  - Avoid copying: implementation workflow や package/tool command を本 Skill の design source of truth にしない。

## Record workflow / density

- [Lightning Record Form](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html)
  - Observe: view / edit / create mode、record / object identity、field layout、Save / Cancel、record metadata/security integration、density behavior。
  - Useful for: record-centric task の host semantics を理解する。
  - Avoid copying: every custom workflow を record form に強制しない。

- [Change the Form Display Density](https://developer.salesforce.com/docs/platform/lwc/guide/data-display-density)
  - Observe: user / org display density preference、Comfy / Compact / Cozy、auto density、container-width による label placement adaptation。
  - Useful for: enterprise density を fixed spacing preset と扱わないための evidence。
  - Avoid copying: one density の exact spacing を universal value にしない。

## Data operation / keyboard behavior

- [Lightning Datatable](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-datatable.html)
  - Observe: supported data operations、selection / sorting / editing / row actions、current device support。
  - Useful for: Salesforce 上で data grid が適切な task と component capability を照合する。
  - Important: current documentation states `lightning-datatable` is not supported on mobile devices. mobile requirement がある task では current status を再確認し alternative path を設計する。
  - Avoid copying: desktop table を universal responsive representation にしない。

- [Datatable Accessibility](https://developer.salesforce.com/docs/platform/lwc/guide/data-table-a11y.html)
  - Observe: navigation mode / action mode、Tab / arrow / Enter / Space behavior、custom data type の keyboard contract。
  - Useful for: visual custom cell が interaction semantics を壊していないか確認する。
  - Avoid copying: key list を generic keyboard design の代替にしない。generic composite-widget policy は `keyboard-interface` が canonical。

- [Customize Data Type Layout and Styles](https://developer.salesforce.com/docs/platform/lwc/guide/data-table-custom-types-styling)
  - Observe: standard cell layout と bare layout の behavior difference、custom data type で accessibility / keyboard support を維持する条件。
  - Useful for: custom-cell justification と verification。
  - Avoid copying: arbitrary cell styling を standard behavior より優先しない。

## Interruption / overlay

- [Lightning Modal](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-modal.html)
  - Observe: modal が main task を block する意味、focus placement、close / dismissal、accessibility obligations。
  - Useful for: deliberate interruption surface が必要か判断する。
  - Avoid copying: documentation 内の exact time/value を universal design rule にしない。generic overlay focus lifecycle は `keyboard-interface` を参照する。

## Current public source implementation

- [`salesforce-ux/design-system-2`](https://github.com/salesforce-ux/design-system-2)
  - Current public Salesforce UX repository; created 2026-03 and active in 2026 at review time。
  - Observe: current repository structure / source direction when public implementation evidence is needed。
  - Useful for: canonical docs と implementation status の cross-check。
  - Avoid copying: source identifiers / implementation detail を design principle に昇格させない。

- [`salesforce-ux/design-system-2-starter-kit`](https://github.com/salesforce-ux/design-system-2-starter-kit)
  - Current public starter / implementation evidence。
  - Observe: Lightning Base Components preference、current SLDS 2 project integration、tooling expectations。
  - Useful for: current implementation path が material な場合だけ参照する。
  - Avoid copying: starter architecture を unrelated product の architecture rule にしない。

## Historical / migration sources

旧 `salesforce-ux/design-system`、old starter kit、Sketch plugin、legacy markup repositories 等は historical / migration evidence としてのみ扱う。current SLDS 2 system の source of truth にしない。

## Cross-reference boundaries

必要に応じて repository 内の以下の Skill を canonical domain policy として併用する。

- `form-design` — form task / validation / recovery
- `table-design` — table / list / grid semantics
- `navigation-design` — information-space navigation
- `interaction-states` — state semantics
- `responsive-design` — generic reflow / layout adaptation
- `keyboard-interface` — focus / composite widget / overlay interaction
- `touch-interface` — target / gesture / mixed input
- `color-system` — semantic color roles
- `content-design` — labels / error / instruction content
- `internationalization-design` — locale / text expansion / direction
- `accessibility-audit` — delivered conformance re-test
