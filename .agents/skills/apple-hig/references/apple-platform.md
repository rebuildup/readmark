# Apple platform references

Last reviewed: 2026-09-13

Apple platform guidance is version-sensitive. Before using a geometry, material behavior, component placement, or platform-specific convention as evidence, reopen the current source.

## Current version anchor

- [Apple Design Resources](https://developer.apple.com/design/resources/)
  - Observe: current UI kits, platform templates, component anatomy, spacing/grouping relationships, symbols, window/device variants.
  - Current check: on 2026-09-13 Apple lists current iOS & iPadOS 27 and macOS 27 design resources; use this page as a freshness anchor instead of assuming an older WWDC screenshot is current.
  - Useful for: checking how current platform components are actually represented across devices and windows.
  - Avoid copying: exact Apple product content, brand assets, or arbitrary geometry into a different product without a semantic reason.

## Current design principles

- [Human Interface Guidelines — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
  - Observe: purpose, agency, familiarity, flexibility, simplicity, craft, delight; how principles trade off rather than behaving as a checklist.
  - Useful for: deciding whether platform adaptation improves the task rather than merely making the UI look native.
  - Avoid copying: no principle implies pixel similarity to Apple first-party apps.

- [WWDC26 — Principles of great design](https://developer.apple.com/videos/play/wwdc2026/250/)
  - Observe: current Apple interpretation of familiarity, flexibility, simplicity, platform context, established metaphors, undo/forgiveness, and device-specific interaction strengths.
  - Useful for: resolving trade-offs when a platform convention, product workflow, and custom expression compete.
  - Avoid copying: examples are evidence of reasoning, not templates or universal component arrangements.

- [WWDC26 — Design guide](https://developer.apple.com/wwdc26/guides/design/)
  - Observe: current Design-session index, platform-wide updates, and which newer guidance supersedes older sessions.
  - Useful for: freshness checks before relying on prior-year design-system material.

## System structure and continuity

- [WWDC25 — Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/)
  - Observe: visual language, information architecture, structure, functional layer above content, grouping, bars/toolbars/tabs/sidebars, source-anchored presentation, and continuity across devices, sizes, and input modes.
  - Useful for: understanding the design intent behind the current cross-platform system and Liquid Glass-era component relationships.
  - Avoid copying: 2025 screenshots and concrete values are historical/current-system-origin evidence; confirm current resources before treating details as present-version requirements.

- [Human Interface Guidelines — Components](https://developer.apple.com/design/human-interface-guidelines/components)
  - Observe: component families and which semantic problems Apple expects system-defined controls/navigation/presentation to solve.
  - Useful for: standard-component-first decisions and identifying when a custom component is duplicating a familiar system role.
  - Avoid copying: selecting a component by visual resemblance instead of task semantics.

- [Human Interface Guidelines — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
  - Observe: command grouping, frequency/importance, overflow, customization, primary action separation, platform differences, relationship to content.
  - Useful for: dense command surfaces and cross-platform adaptation.
  - Avoid copying: any example count, title length, placement, or spacing value as a universal product rule; inspect current platform/task context.

- [Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
  - Observe: persistent top-level destination semantics, current selection, tab identity, and platform-specific presentation.
  - Useful for: deciding whether content belongs in persistent navigation rather than a contextual action surface.
  - Avoid copying: treating tabs as a generic horizontal menu or mixing transient commands into destination navigation.

## Focus, selection, and inclusion

- [Human Interface Guidelines — Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)
  - Observe: distinction between focus and selection, input-specific behavior, platform context, and visible state continuity.
  - Useful for: adapting a shared selection model to touch, pointer, keyboard, and focus-driven contexts.
  - Avoid copying: one platform's focus mechanics into another without checking its input model.

- [Human Interface Guidelines — Inclusion](https://developer.apple.com/design/human-interface-guidelines/inclusion)
  - Observe: inclusive language and representation, accessibility-aware assumptions, localization/cultural considerations.
  - Useful for: checking whether platform adaptation silently narrows who can use or understand the product.
  - Boundary: detailed exclusion discovery remains `inclusive-design`; this reference only supplies Apple-platform context.

## Liquid Glass and material behavior

- [WWDC25 — Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
  - Observe: material as an adaptive functional layer, legibility, tint, interaction behavior, background relationship, and accessibility adaptations such as Reduce Transparency / Increase Contrast / Reduce Motion.
  - Useful for: deciding where current Apple material belongs and how it should degrade under accessibility settings.
  - Avoid copying: glass blur, tint, corner, highlight, or optical effects as a decorative recipe for arbitrary content surfaces.

- [WWDC25 — Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/)
  - Observe: how existing app structure, toolbars, search, controls, and standard framework components participate in the system update.
  - Useful for: evidence that semantic structure and standard components should generally precede custom visual recreation.
  - Avoid copying: SwiftUI API syntax into the design policy; renderer/framework implementation remains downstream.

## How to compare references

Do not ask whether the current product “looks like Apple.” Compare these observable axes instead:

- **semantic role** — is a surface navigation, command, content, status, or presentation?
- **shared anatomy** — what meaning/state should remain identical across Apple platforms?
- **platform expression** — what changes because window size, density, posture, or input model changes?
- **hierarchy** — is importance created by structure/grouping/placement before decorative containment?
- **familiarity** — can a standard component/metaphor make behavior predictable?
- **content relationship** — does chrome/material support content or compete with it?
- **continuity** — can users recognize the same task/state after device, size, or input changes?
- **adaptation** — what happens under light/dark, larger content, increased contrast, reduced transparency, and reduced motion?
- **custom justification** — what product-specific semantic requirement makes a custom control necessary?

## Cross-reference boundaries

Use platform references together with the relevant domain Skill rather than replacing it:

- navigation semantics → `navigation-design`
- general layout/reflow → `layout-system`, `responsive-design`
- keyboard / touch mechanics → `keyboard-interface`, `touch-interface`
- state semantics → `interaction-states`
- color / appearance → `color-system`, `dark-mode-design`, `high-contrast-design`
- typography → `typesetting`
- wording → `content-design`
- motion → `motion-system`
- broad accessibility verification → `accessibility-audit`
- cross-capability exclusion research → `inclusive-design`

If an Apple reference gives a concrete value or arrangement, first ask what semantic/platform constraint produced it. Translate that constraint into the current product; do not universalize the value.