# GitHub Primer system references

Last reviewed: 2026-09-13

この reference file は GitHub Primer を visual preset として模倣するためのものではない。

**context hierarchy / navigation semantics / action priority / dense developer workflow / theme / accessibility** を観察し、current product へ翻訳するために使う。

## Product system

- [Primer Product UI](https://primer.style/product/)
  - Observe: current Primer Product UI の scope、components / primitives / patterns の分離。
  - Useful for: current public system entry point の確認。
  - Avoid copying: GitHub brand identity を generic developer-product rule にしない。

- [Primer — Layout](https://primer.style/product/getting-started/foundations/layout/)
  - Observe: app header、context region、local navigation、main content の責務分離。特に context region が full breadcrumb ではない点。
  - Useful for: repository / project / organization のような parent context を持つ application shell。
  - Avoid copying: GitHub 固有 shell の寸法・spacing・exact placement。

- [Primer — Figma libraries](https://primer.style/product/getting-started/figma/)
  - Observe: Primer Web components と developer-facing React / ViewComponents / CSS の対応関係。
  - Useful for: design component と implementation component が同一 system を共有していることの evidence。
  - Avoid copying: Figma 操作手順を design rule にしない。

## Navigation and page identity

- [Primer — Navigation pattern](https://primer.style/product/ui-patterns/navigation/)
  - Observe: URL-changing navigation、same-context panels、parent-detail layout、navigation proximity、heading hierarchy の選択条件。
  - Useful for: linked navigation と panel selection を visual style ではなく semantics で分ける。
  - Avoid copying: Primer component choice を一般 navigation principle の代替にしない。

- [Primer — PageHeader](https://primer.style/product/components/page-header/)
  - Observe: current page identity、description、actions、navigation が viewport/context で再配置される関係。
  - Useful for: page identity と actions を同じ top-level context に整理する。
  - Avoid copying: component slots / React props を source of truth にしない。

- [Primer — PageHeader accessibility](https://primer.style/product/components/page-header/accessibility/)
  - Observe: heading hierarchy と landmark role / accessible name の関係。
  - Useful for: visually correct header が semantic page structure を壊していないか確認する。

- [Primer — NavList](https://primer.style/product/components/nav-list/)
  - Observe: current context 内の vertical navigation、current item、affected content との関係。
  - Useful for: persistent local/context navigation。
  - Avoid copying: generic action list と navigation list を visual similarity だけで交換しない。

- [Primer — UnderlineNav](https://primer.style/product/components/underline-nav/)
  - Observe: related linked views を current context 内で切り替える用途。
  - Useful for: URL-changing linked navigation。
  - Avoid copying: same-context tab panel へ linked navigation semantics を持ち込まない。

- [Primer — Breadcrumbs](https://primer.style/product/components/breadcrumbs/)
  - Observe: deep taxonomical ancestry を示す secondary navigation。
  - Useful for: full hierarchy が必要な deep pages。
  - Avoid copying: context region、history、progress indicator の代替にしない。

## Actions, lists, and dense workflows

- [Primer — ActionList](https://primer.style/product/components/action-list/)
  - Observe: interactive item anatomy、leading/trailing visuals、description、selection、danger grouping。
  - Useful for: action / option collections with metadata。
  - Avoid copying: ActionList を navigation / table / arbitrary card list の万能 primitive にしない。

- [Primer — ActionList guidelines](https://primer.style/product/components/action-list/guidelines/)
  - Observe: section grouping、single vs multiple selection、danger item、touch adaptation、divider trade-offs。
  - Useful for: dense action list の parseability と state clarity。

- [Primer — ActionMenu](https://primer.style/product/components/action-menu/)
  - Observe: quick actions / command / selection が overlay context へ入る条件。
  - Useful for: lower-frequency actions や compact selection surface。
  - Avoid copying: frequently needed actions を無条件に menu の奥へ隠さない。

- [Primer — ActionBar](https://primer.style/product/components/action-bar/)
  - Observe: action-only toolbar、grouping、responsive overflow behavior。
  - Useful for: frequent horizontal command sets。
  - Avoid copying: current state / notification / selection meaning を action toolbar へ混ぜない。

- [Primer — ActionBar guidelines](https://primer.style/product/components/action-bar/guidelines/)
  - Observe: buttons-only policy、tooltip の action description、selected state を置かないこと、overflow/grouping behavior。
  - Useful for: action semantics と state semantics の分離。
  - Avoid copying: documentation 内の exact spacing value を universal rule にしない。

- [Primer — DataTable](https://primer.style/product/components/data-table/)
  - Observe: repository-like realistic data、sorting、header/context、accessible row/column grouping の current behavior。
  - Useful for: dense exact lookup / comparison surfaces の Primer-specific evidence。
  - Avoid copying: generic table decisionsは `table-design` に委ねる。DataTable は current implementation evidence として扱う。

- [Primer — Banner](https://primer.style/product/components/banner/)
  - Observe: critical / warning / info / success / upsell tone、dismissal、actions、confined-space variants。
  - Useful for: status/attention communication の system evidence。
  - Avoid copying: tone を color だけで表現しない。

## Color and themes

- [Primer — Color usage](https://primer.style/product/getting-started/foundations/color-usage/)
  - Observe: light / dark color modes、multiple themes、semantic abstractions。
  - Useful for: theme-capable system adaptation。
  - Avoid copying: current raw colors / GitHub-specific theme values。

- [Primer accessibility — Color considerations](https://primer.style/accessibility/design-guidance/color-considerations/)
  - Observe: default Day / Night accessibility guarantees、token usage、color-only meaning avoidance。
  - Useful for: theme verification and responsibility boundaries。
  - Avoid copying: non-default theme policy を unrelated product の compliance policy として一般化しない。

## Accessibility and input

- [Primer — Accessibility at GitHub](https://primer.style/accessibility/foundations/accessibility-at-github/)
  - Observe: WCAG 2.2 AA を baseline としつつ accessibility を ongoing product process として扱う方針。
  - Useful for: standard component adoption 後も task-level verification が必要な根拠。

- [Primer — Designer Checklist](https://primer.style/accessibility/tools-and-resources/checklists/designer-checklist/)
  - Observe: color、hierarchy、content、interactive states、forms、layout、keyboard operability の design-time checks。
  - Useful for: final rendered artifact review。
  - Avoid copying: checklist completionだけを product usability evidence にしない。

- [Primer — Links and buttons](https://primer.style/accessibility/design-guidance/links-and-buttons/)
  - Observe: navigation vs action semantics、visual affordance と underlying semantic element の一致。
  - Useful for: link/button role confusion の防止。

- [Primer — Keyboard shortcuts](https://primer.style/accessibility/patterns/keyboard-shortcuts/)
  - Observe: shortcut は enhancement であり唯一の task route にしないこと、browser/OS/AT collision の考慮。
  - Useful for: developer productivity shortcut design。
  - Avoid copying: GitHub-specific shortcut inventory。

- [Primer — Annotation Toolkit](https://primer.style/accessibility/tools-and-resources/annotation-toolkit/)
  - Observe: system feedback、flow、metadata、component anatomy、screen-reader/live-region intent を design-to-development handoff へ残す方法。
  - Useful for: complex custom component / interaction を設計するときの verification evidence。
  - Avoid copying: Figma asset自体を design principle にしない。

## Public implementation evidence

- [primer/react](https://github.com/primer/react)
  - Observe: current public React implementation、component readiness、accessibility fixes、responsive behavior。
  - Useful for: docs と shipped implementation の status を cross-check する。
  - Avoid copying: component API / prop name / CSS implementation を design source of truth にしない。

- [Primer React releases](https://github.com/primer/react/releases)
  - Current evidence on review date: `@primer/react@38.39.0` was published 2026-09-11.
  - Observe: accessibility / navigation / DataTable / overflow behavior が active に更新されていること。
  - Useful for: current-vs-historical implementation status の確認。
  - Avoid copying: package version を Primer design guidance 全体の version number とみなさない。

## Cross-reference boundaries

Primer reference を開いたあと、generic design problem は既存 Skill へ戻す。

- information-space / hierarchy navigation → `navigation-design`
- table vs list / grid behavior → `table-design`
- focus / selected / pressed / disabled semantics → `interaction-states`
- keyboard traversal / shortcuts → `keyboard-interface`
- responsive transformation → `responsive-design`
- semantic color roles → `color-system`
- appearance transformation → `dark-mode-design`
- general accessibility retest → `accessibility-audit`

`github-primer` に残すのは、それらを current Primer / GitHub product-system convention へどう適応するかという system-level translation だけにする。
