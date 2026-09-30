# Atlassian Design System references

Last reviewed: 2026-09-13

この reference file は current Atlassian Design System を system-adaptation evidence として観察するための runtime input である。

exact token values、brand assets、private Figma libraries、framework API を universal rule としてコピーしない。deprecated component は current design source of truth にしない。

## System overview

- [Atlassian Design System](https://atlassian.design/design-system)
  - Observe: foundations / components / Rovo UI の責務分離、current system entry points。
  - Useful for: task に relevant な current reference family を選ぶ起点。
  - Avoid copying: marketing presentation / Atlassian brand expression itself.

- [Foundations](https://atlassian.design/foundations)
  - Observe: tokens, accessibility/content guidance, spacing, grid, color, typography, iconography, elevation, border, radius の system decomposition。
  - Useful for: concrete valuesより semantic relationship を理解する。

- [Components](https://atlassian.design/components)
  - Observe: component がどの interaction need を所有するか、current / beta / caution / deprecated status。
  - Useful for: standard component semantic fit と current status の確認。
  - Avoid copying: component catalog を product information architecture の代替にすること。

## Tokens and foundations

- [Design tokens](https://atlassian.design/components/tokens)
  - Observe: UI decisions を named tokens へ分離する考え方、current selected-state migration note。
  - Useful for: role-based styling / theme adaptation。
  - Avoid copying: exact token identifiersを unrelated design system へ持ち込むこと。

- [Use tokens in design](https://atlassian.design/foundations/tokens/use-tokens-in-design)
  - Observe: tokens が design / theme / component system を跨ぐ source of truth として扱われること。
  - Useful for: hard-coded visual value と semantic role の分離。

- [Spacing](https://atlassian.design/foundations/spacing)
  - Observe: grouping、ranking、visual rhythm、optical adjustment、compact / medium / layout spacing の使い分け。
  - Useful for: productive density と relationship hierarchy。
  - Avoid copying: 8px base unit や exact scale を universal law にすること。特に optical adjustment guidance を同時に観察する。

- [Grid](https://atlassian.design/foundations/grid-beta/applying-grid)
  - Observe: main content area 内の columns / gutters / margins と、navigation / panel shell との責務境界。
  - Useful for: work surface の alignment / hierarchy。
  - Status note: URL 自体が `grid-beta` を含む。current release status を使用時に再確認する。

- [App typefaces and scale](https://atlassian.design/foundations/typography/product-typefaces-and-scale)
  - Observe: UI text と code/data typography の role separation、tabular figures 等の task-specific features。
  - Useful for: dense data / technical content の typography relationship。
  - Avoid copying: proprietary Atlassian Sans / Mono を unrelated product の requirement にすること。

- [Applying typography](https://atlassian.design/foundations/typography/applying-typography)
  - Observe: heading hierarchy、semantic HTML structure、long-form vs UI typography、scanability。
  - Useful for: hierarchy / information density verification。

- [Typography system reaches General Availability](https://atlassian.design/whats-new/new-typography-in-general-availability)
  - Observe: current typography system が 2025-09-09 に GA となり、legacy / modernized systems が deprecated になった version context。
  - Useful for: old screenshots / docs の typography を current guidance と誤認しないための freshness anchor。

- [Iconography](https://atlassian.design/foundations/iconography)
  - Observe: metaphor clarity、perspective constraints、size / spacing / text relationship、density context。
  - Useful for: system-adaptation時の icon role。
  - Avoid copying: exact icon artwork / proprietary assets。

## Navigation and page structure

- [Navigation system](https://atlassian.design/components/navigation-system)
  - Observe: current Atlassian app navigation system、selected-state treatment、current component family。
  - Useful for: current navigation shell の primary reference。

- [Navigation system — Layout](https://atlassian.design/components/navigation-system/layout)
  - Observe: page structure、navigation areas、main content、panels の relationship。
  - Useful for: product shell adaptation。

- [Navigation system — Layout usage](https://atlassian.design/components/navigation-system/layout/usage)
  - Observe: current layout composition and intended usage。
  - Useful for: implementation shape が design semantics と一致しているか確認する。

- [Page header](https://atlassian.design/components/page-header)
  - Observe: title と breadcrumbs / buttons / search / filters の optional composition。
  - Useful for: page hierarchy / action placement。

### Deprecated navigation evidence

以下は migration / historical evidence としてのみ使う。新規 design の current source of truth にしない。

- [Side navigation — Deprecated](https://atlassian.design/components/side-navigation)
- [Page layout — Deprecated](https://atlassian.design/components/page-layout/)
- [Atlassian navigation — Deprecated](https://atlassian.design/components/atlassian-navigation)

Observe: all direct users to the new navigation system.

## Component semantics and action hierarchy

- [Button](https://atlassian.design/components/button)
  - Observe: action semantics、appearance / emphasis、icon/text composition、state behavior。
  - Useful for: page / contextual / item action hierarchy。

- [Evolving buttons and links](https://atlassian.design/whats-new/evolving-button-and-links)
  - Observe: button / link semantics were deliberately split to improve correctness, consistency, accessibility, and performance; migration across many call sites。
  - Useful for: visual resemblanceより semantic element choiceを優先する evidence。
  - Avoid copying: implementation API details / migration tooling as design rules.

- [Popup](https://atlassian.design/components/popup)
  - Observe: brief overlay content and interaction boundaries。
  - Useful for: transient contextual UI vs modal interruption の比較。

- [Dropdown menu](https://atlassian.design/components/dropdown-menu/)
  - Observe: action / option collections、selection variants、grouping。
  - Useful for: secondary item / contextual actions。

- [Dynamic table](https://atlassian.design/components/dynamic-table)
  - Observe: sorting / pagination / reorder を含む dense data interaction、selected-state treatment。
  - Useful for: collaboration / issue list surfaces。
  - Boundary: table structure自体は `table-design` が canonical。

## Status, categorization, and compact metadata

- [Lozenge](https://atlassian.design/components/lozenge)
  - Observe: meaningful status / attribute as a compact prominent label; current GA / feature-flag status note。
  - Useful for: workflow status、priority-relevant attribute。

- [Lozenge dropdown trigger](https://atlassian.design/components/lozenge/lozenge-dropdown-trigger)
  - Observe: static status indicator と interactive status update control の違い。
  - Useful for: editable workflow state。

- [Tag](https://atlassian.design/components/tag/)
  - Observe: subtle categorization / organization role。
  - Useful for: labels、topics、groups。

- [Badge](https://atlassian.design/components/badge/usage)
  - Observe: numeric status data / tallies / scores。
  - Useful for: unread count、item total 等。

- [Legacy lozenge](https://atlassian.design/components/lozenge/lozenge/)
  - Observe: caution / planned deprecation state。
  - Useful for: current-vs-legacy disambiguation only。

## Drag and reorder

- [Pragmatic drag and drop — Design guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/)
  - Observe: primary vs secondary drag action、drag handle disclosure、drop visibility、movement outcome、tree/list differences。
  - Useful for: reorder / move / nesting UI。
  - Caution: timing constants and implementation details are Atlassian-specific evidence, not universal design defaults。

- [Pragmatic drag and drop — Accessibility guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines/)
  - Observe: pointer drag と同じ outcome に到達する accessible action alternatives; menus / modal / forms used when more input is needed。
  - Useful for: drag-only interaction を避ける concrete production guidance。
  - Boundary: generic pointer/keyboard model is owned by `touch-interface` / `keyboard-interface`.

## Rovo UI / AI dialect

Rovo は core ADS の代替ではなく、AI-powered moments の scoped dialect として観察する。

- [About Rovo UI](https://atlassian.design/rovo-ui/about-rovo-ui)
  - Observe: Rovo Dialect が Atlassian Design Language に nested し、AI interaction を recognizable but integrated にする構造。
  - Observe principles: integrated not segregated、earned expression、motion with intent、color as signal、familiar through consistency。
  - Useful for: AI expression の scope / intensity decision。

- [AI interaction guidelines](https://atlassian.design/rovo-ui/ai-interaction-guidelines)
  - Observe: proactive context use、flow preservation、dynamic form、system transparency、multiplayer collaboration、risk / course correction。
  - Useful for: AI actionを単なる visual signifier ではなく workflow behavior として扱う。

- [Rovo color](https://atlassian.design/rovo-ui/color)
  - Observe: branded color is reserved for generative / active / in-progress signifiers and is restrained against core product UI。
  - Useful for: AI state/provenance signal。
  - Avoid copying: Rovo brand palette / color ordering into unrelated brands。

- [Rovo motion](https://atlassian.design/rovo-ui/motion)
  - Observe: motion inherits ADS foundation but adds AI presence / responsiveness; purpose remains clarity / state / continuity。
  - Useful for: AI state motion vs decorative animation distinction。
  - Boundary: motion decision remains owned by `motion-system`.

- [Generative border](https://atlassian.design/rovo-ui/generative-border)
  - Observe: animated border is explicitly reserved for active AI content generation; not decoration or generic prominence.
  - Useful for: state-specific AI treatment and failure-mode evidence.

- [Rovo icon](https://atlassian.design/rovo-ui/icon)
  - Observe: AI-powered action identification; pair with text when meaning is not obvious.
  - Useful for: AI provenance / discoverability.

- [Rovo elevation](https://atlassian.design/rovo-ui/elevation)
  - Observe: special overlay distinction is scoped; ordinary Rovo menus still use core ADS elevations.
  - Useful for: avoiding AI-specific surface styling everywhere.

## Current refresh / freshness anchors

- [Atlassian UI refresh updates and how to apply them](https://atlassian.design/whats-new/atlassian-ui-refresh-updates)
  - Published: 2025-04-22.
  - Observe: current brand/design refresh, rollout state, and warning that some features were early access at publication time.
  - Use: visual screenshots from transition period require current component/status re-check before becoming guidance.

- [Typography and iconography updates](https://atlassian.design/whats-new/typography-and-iconography-updates)
  - Published: 2025-03-18.
  - Observe: transition context for new fonts/iconography and the fact that those systems were beta at publication time.
  - Use with the later typography GA page to distinguish rollout history from current status.

## Verification notes

When this reference family is used, final verification should include as applicable:

- current ADS navigation / layout rather than deprecated shell
- realistic collaboration data: long issue titles, user names, statuses, counts, labels, dates
- dense repeated rows / cards / tables and action hierarchy
- keyboard-only task completion and visible focus
- overlay open / close / focus restoration
- 200% text zoom and 400% zoom / narrow reflow
- light / dark theme role continuity
- status meaning beyond color alone
- drag/reorder via pointer plus a non-drag alternative
- AI action provenance and active-generation state when Rovo/AI is relevant
- reduced-motion / relevant accessibility preference for AI/motion state meaning

Do not treat Figma/component source generation success as final verification; inspect the delivered browser/product representation.
