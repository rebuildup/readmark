# IBM Carbon system references

Last reviewed: 2026-09-13

この reference file は `ibm-carbon` Skill の runtime input。

Carbon の exact component API / token value を暗記するためではなく、current system の component semantics、density、layer、accessibility、AI-presence behavior を再確認するために使う。

## Current status / freshness

- [Carbon Design System](https://carbondesignsystem.com/)
  - Observe: current component/guideline surface、stable / feature-flag status、current documentation navigation。
  - Useful for: 実装時点の canonical current guidance を探す入口。
  - Avoid copying: homepage visual stylingを product-specific rule にしない。

- [Carbon release radar](https://github.com/carbon-design-system/carbon/wiki/Release-radar)
  - Observe: active major line、stable release cadence、current stable version、future target release。
  - Reviewed state: 2026-09-09 の `11.116.0` が stable、2026-09-23 の `11.117.0` は unreleased と記載されている。
  - Useful for: current-version anchor。
  - Avoid copying: package version numberを design principle として扱わない。

- [Carbon deprecations](https://carbondesignsystem.com/deprecations/)
  - Observe: v10 package/assets の support state と current replacement line。
  - Useful for: old search result を current guidance と誤認しないため。
  - Current note: v10 assets は 2024-09-30 に end of support、v11.x が replacement。

- [Carbon v11 design migration guide](https://preview.carbondesignsystem.com/getting-started/migrating/guide/design)
  - Observe: v11 の token/layering change、contextual layer、theme changes、component naming/sizing migration。
  - Useful for: current v11 behavior と old v10 guidance の差を理解する。
  - Avoid copying: migration implementation手順を design source of truth にしない。

## Foundations

- [Color — current Carbon](https://preview.carbondesignsystem.com/building-blocks/foundations/color/overview)
  - Observe: semantic color roles、light/dark themes、alternating/contextual layer relationship。
  - Useful for: surface hierarchy と surrounding-layer relationship。
  - Avoid copying: raw palette valuesや exact token namesを unrelated productへ固定しない。

- [Typography — Carbon](https://carbondesignsystem.com/elements/typography/overview/)
  - Observe: productive / expressive type sets、hierarchy と layout/template structure の関係。
  - Useful for: dense operational UI と expressive communication の役割分離。
  - Avoid copying: IBM Plex 固有の calibrated size/weight を universal typography rule にしない。

- [Carbon accessibility overview](https://carbondesignsystem.com/guidelines/accessibility/overview/)
  - Observe: Carbon components と IBM Accessibility Checklist / WCAG-based expectations の関係。
  - Useful for: standard component の accessibility responsibility と product-level responsibility を分ける。
  - Avoid copying: Carbon component 採用だけで product 全体の accessibility conformance を主張しない。

- [Component accessibility status — current preview](https://preview.carbondesignsystem.com/building-blocks/core/components/overview/accessibility-status)
  - Observe: Tested / Partially tested / Manually tested / Not tested の status vocabulary、latest component testing matrix。
  - Useful for: custom component を作る際に失う baseline behavior の確認。
  - Avoid copying: library-level test status を current composition / content / workflow の証明に拡張しない。

## Productive density / data-heavy workflow

- [Data table — usage](https://carbondesignsystem.com/components/data-table/usage/)
  - Observe: row-size variants、toolbar、sorting、selection、batch actions、inline/overflow actions、expansion、loading、placement。
  - Useful for: dense resource-management surface と action hierarchy。
  - Important: current guidance gives data tables generous space and warns against nesting them in cramped containers。
  - Avoid copying: table を spreadsheet substitute や every-data-view default にしない。

- [Data table — accessibility](https://preview.carbondesignsystem.com/building-blocks/core/components/data-table/accessibility)
  - Observe: sortable header keyboard operation、interactive control behavior、current component accessibility evidence。
  - Useful for: standard-component-first decision と keyboard verification。

- [Menu buttons — usage](https://carbondesignsystem.com/components/menu-buttons/usage/)
  - Observe: menu button / combo button / overflow menu の action-importance と space-constraint differences。
  - Useful for: low-frequency / advanced action disclosure と high-emphasis action scarcity。
  - Current note: current page states the newer overflow behavior is feature-flagged and expected to become default in a future v12; do not treat future behavior as current stable default without checking status。

- [Form — usage](https://carbondesignsystem.com/components/form/usage/)
  - Observe: default vs fluid form architecture、grid relationship、cohesive dense forms、paired-column behavior。
  - Useful for: dense operational form presentation。
  - Avoid copying: form layout rules instead of `form-design` task-flow decisions。

- [Modal — usage](https://carbondesignsystem.com/components/modal/usage/)
  - Observe: modal scope、attention isolation、AI presence broad vs focused behavior。
  - Useful for: temporary task surface と AI attribution scope。
  - Avoid copying: modal を generic content container にする。

## AI presence / explainability

- [AI label — usage](https://carbondesignsystem.com/components/ai-label/usage/)
  - Observe: AI presence indicator、broad vs focused placement、explainability popover、revert behavior、when-not-to-use rules。
  - Useful for: AI provenance / transparency。
  - Key boundary: AI label は AI action trigger や decoration ではない。

- [AI label — current accessibility](https://preview.carbondesignsystem.com/building-blocks/core/components/ai-label/accessibility)
  - Observe: trigger focus、Enter/Space、popover keyboard progression / dismissal。
  - Useful for: explainability path の keyboard verification。

- [AI label — current specifications](https://preview.carbondesignsystem.com/building-blocks/core/components/ai-label/specifications)
  - Observe: state/token relationship と hierarchy-relative sizing。
  - Useful for: implementation evidence。
  - Avoid copying: exact token/valueを semantic rule にしない。

- [Data table — AI presence style](https://carbondesignsystem.com/components/data-table/style/)
  - Observe: entire table / row-column / individual cell で AI involvement scope の表示が変わること。
  - Useful for: broad vs focused provenance の具体的 production pattern。
  - Avoid copying: AI gradient / shadow treatmentを generic emphasis styling にしない。

## Public implementation evidence

- [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon)
  - Observe: current packages、React/Web Components status、release history、source implementation。
  - Useful for: documentationと actual public implementation の整合確認。
  - Avoid copying: package prop / Sass API / token identifier を design decision にする。

## Comparison questions

複数 reference を開いたら、最低限次を比較する。

- 同じ task importance が page / table / modal でどう異なる action placement になるか。
- density が information throughput を助けるケースと cramped UI になるケースの差は何か。
- layer / theme の value が変わっても、どの semantic relationship が維持されるか。
- standard component が持つ keyboard/state/accessibility behavior のうち、customization で何を失うか。
- AI involvement が container 全体・row/cell・field/text fragment で変わると attribution scope がどう変わるか。
- old v10 search result と current v11 guidance で token/component behavior が異なる場合、どちらを current source とすべきか。

## Freshness rule

- current component behavior / feature status / token name は実装直前に current Carbon page で再確認する。
- `v10.carbondesignsystem.com` は historical / migration comparison の evidence としてのみ扱い、current default の根拠にしない。
- preview page の future / feature-flag behavior は stable page / release status と照合する。
- Carbon v12 が stable になった場合は、この reference と `SKILL.md` の current-version policy を再調査する。
