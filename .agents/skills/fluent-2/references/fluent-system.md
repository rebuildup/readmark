# Fluent 2 references

Last reviewed: 2026-09-13

この file は `fluent-2` Skill の runtime reference input。reference 固有の exact values / assets / Microsoft product expression を copy するためではなく、current Fluent 2 の system decision を比較観察するために使う。

## Core system

- [Fluent 2 — Design tokens](https://fluent2.microsoft.design/design-tokens)
  - Observe: global token と alias token の責務分離、semantic naming、light/dark/high-contrast/brand theming の関係。
  - Useful for: project token system を Fluent vocabulary へ翻訳するとき。
  - Avoid copying: raw token values、exact radii、spacing、colors。

- [Fluent 2 — Color](https://fluent2.microsoft.design/color)
  - Observe: neutral / shared / brand palette の役割分担、surface/content hierarchy、brand emphasis の使い方。
  - Useful for: Microsoft-oriented product の color role adaptation。
  - Avoid copying: Microsoft brand palette を unrelated product identity として流用すること。

- [Fluent 2 — Typography](https://fluent2.microsoft.design/typography)
  - Observe: text hierarchy、alignment、emphasis、platform differences、RTL consideration。
  - Useful for: Fluent surface で information hierarchy を翻訳するとき。
  - Avoid copying: exact type ramp を project context を無視して固定すること。

- [Fluent 2 — Motion](https://fluent2.microsoft.design/motion)
  - Observe: functional / natural / consistent / appealing の目的、change / continuity / feedback の説明方法。
  - Useful for: existing `motion-system` decision を Fluent motion vocabulary に適応するとき。
  - Avoid copying: example duration/easing を universal preset とすること。

- [Fluent 2 — Accessibility](https://fluent2.microsoft.design/accessibility)
  - Observe: hierarchy、keyboard/focus、contrast、400% zoom / 320px reflow、200% text zoom、semantic structure。
  - Useful for: Fluent adaptation の system-level verification checklist。
  - Avoid copying: Fluent components を使ったことだけで product 全体の accessibility conformance を主張すること。

## Component evidence

- [Fluent 2 — React Button](https://fluent2.microsoft.design/components/web/react/core/button/usage)
  - Observe: primary action の希少性、secondary emphasis、RTL placement、toggle state の redundant cues。
  - Useful for: action hierarchy と component emphasis。
  - Avoid copying: button styling を全 action に展開すること。

- [Fluent 2 — React Dialog](https://fluent2.microsoft.design/components/web/react/core/dialog/usage)
  - Observe: dialog anatomy、nesting avoidance、open 時 focus、modal focus containment、close 後 focus restoration。
  - Useful for: temporary UI の lifecycle と workflow continuity。
  - Avoid copying: dialog dimensions/padding を universal rule にすること。

- [Fluent 2 — React Skeleton](https://fluent2.microsoft.design/components/web/react/core/skeleton/usage)
  - Observe: dynamic content の high-level structure だけを予告する方針、fixed layout への misuse、loading 後 focus continuity。
  - Useful for: loading state adaptation。
  - Avoid copying: final component の全 detail を skeleton 化すること。

- [Fluent 2 — React Combobox](https://fluent2.microsoft.design/components/web/react/core/combobox/usage)
  - Observe: keyboard type-ahead、selection semantics、screen-reader DOM relationship、content labeling。
  - Useful for: complex standard component を custom 化する前の behavior evidence。
  - Avoid copying: React-specific prop namesを design rule として扱うこと。

- [Fluent 2 — React Searchbox](https://fluent2.microsoft.design/components/web/react/core/searchbox/usage)
  - Observe: 400% zoom 時の responsive presentation、task frequency に応じた compact/full-width transformation。
  - Useful for: component-level adaptation と zoom verification。
  - Avoid copying: icon-only transformation をすべての search experience に機械適用すること。

## Current implementation evidence

- [Microsoft Fluent UI repository](https://github.com/microsoft/fluentui)
  - Observe: current Web project split、React Components v9 の位置づけ、legacy v8 coexistence、Northstar supersession。
  - Useful for: current implementation family を確認し、古い Fluent/Fabric guidance を current rule と誤認しないため。
  - Current note: repository currently describes React Components v9 as the forward-looking implementation; Northstar reached end of life in July 2025.
  - Avoid copying: package architecture や code organization を design principle として扱うこと。

- [Fluent UI React v9 styling handbook](https://github.com/microsoft/fluentui/blob/master/docs/react-v9/contributing/rfcs/react-components/styles-handbook.md)
  - Observe: semantic tokens over exact colors、forced-colors で system colors を使用する実装 evidence。
  - Useful for: token semantics / forced-colors policy が public source implementation にも反復しているか確認する。
  - Avoid copying: Griffel syntax、token identifier、implementation detail を universal design source of truth にすること。

## Freshness checks

current Fluent / implementation state は変化するため、更新時は次を再確認する。

1. `fluent2.microsoft.design` の core system pages が現行 guidance として維持されているか。
2. Web implementation で React Components v9 が current family のままか。
3. deprecated / EOL implementation family を current reference として混在させていないか。
4. accessibility guidance の WCAG / zoom / contrast reference が更新されていないか。
5. component guidance に新しい platform-specific variant / behavior が追加されていないか。
