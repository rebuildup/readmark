# SAP Fiori system references

Last reviewed: 2026-09-17

この reference は SAP Fiori / SAP Design System の **current behavior と判断軸を観察するための runtime input**。

version number・token value・control API を暗記して複製するために使わない。SAP Design System は page ごとに公開 version が異なるため、実装時は direct URL を開き、deprecated notice / replacement link / current framework support を再確認する。

## Current system / freshness anchors

- [SAP Fiori for Web](https://www.sap.com/design-system/fiori-design-web/)
  - Observe: current SAP Design System entry point, modular/multi-technology scope, current “What’s New”.
  - Useful for: 最初の freshness check と current information architecture の確認。
  - Avoid copying: product branding、UI kit asset、current visual values を unrelated product の default にすること。

- [SAP Fiori Elements](https://www.sap.com/design-system/fiori-design-web/v1-151/discover/frameworks/sap-fiori-elements)
  - Observe: current supported floorplan families, table/list guidance, analytical/overview entry points, current framework capability boundaries.
  - Useful for: floorplan / framework evidence が current か確認するとき。
  - Avoid copying: annotation/API configuration を design rule にすること。

- [SAP Fiori — SAP Design System](https://www.sap.com/design-system/fiori-design-web/v1-148/discover/sap-design-system/sap-fiori)
  - Observe: Fiori の business-application scope、current design-system relationship、theme / accessibility context。
  - Useful for: 「Fiori をどの product context に適用するか」の system-level framing。
  - Avoid copying: SAP product identity を generic enterprise aesthetic として流用すること。

## Floorplan / page-type decisions

- [Get Started — Page Types](https://www.sap.com/design-system/fiori-design-web/v1-148/discover/get-started)
  - Observe: page layout と floorplan の役割差。floorplan が特定 use case に対応する構造になっていること。
  - Useful for: predefined floorplan と freestyle/page-layout のどちらを調べるべきか決める入口。
  - Avoid copying: template が存在するという理由だけで task を template に合わせること。

- [Analytical List Page](https://www.sap.com/design-system/fiori-design-web/v1-108/page-types/floorplans/analytical-list-page)
  - Observe: large dataset、filter/search、chart + table、drilldown、transactional action の関係。table-only/list-report で十分なケースとの境界。
  - Useful for: analysis → root-cause discovery → action が一つの workflow になっている場合。
  - Freshness note: direct page の guideline version は古い。実装時は current SAP Fiori Elements entry point から replacement/current support も再確認する。
  - Avoid copying: chart が存在するだけの page を analytical list page とみなすこと。

- [Object Page — SAP Fiori Elements](https://www.sap.com/design-system/fiori-design-web/v1-136/discover/frameworks/sap-fiori-elements/object-page/object-page-overview-sap-fiori-elements)
  - Observe: one business object の identity、dynamic header、sections/subsections、display/edit/create、related information の構造。
  - Useful for: single-object detail / edit workflow。
  - Avoid copying: multi-object editing、large-dataset discovery、guided creation を object page に押し込むこと。

- [Dynamic Page Layout](https://www.sap.com/design-system/fiori-design-web/v1-136/page-types/page-layouts/dynamic-page-web-component/)
  - Observe: title/header/content/footer の関係、header collapse、freestyle foundation と predefined floorplan の境界。
  - Useful for: predefined floorplan では満たせないが Fiori page behavior が必要な freestyle surface。
  - Avoid copying: every page を dynamic-page configuration exercise にすること。

- [Flexible Column Layout](https://www.sap.com/design-system/fiori-design-web/v1-96/page-types/page-layouts/flexible-column-layout)
  - Observe: list-detail / list-detail-detail relationship、one/two/three-column state、focus/expand、responsive transition、back-navigation context。
  - Useful for: parent context を残したまま child / subchild を連続処理する task。
  - Avoid copying: IDE/workbench、dashboard、unrelated tools、one object の arbitrary split に使うこと。

- [Worklist — SAP Fiori Elements](https://www.sap.com/design-system/fiori-design-web/v1-136/discover/frameworks/sap-fiori-elements/list-report/worklist-sap-fiori-elements)
  - Observe: focused work-item processing と list-report-like large-set exploration の差、search/action emphasis。
  - Useful for: relatively bounded work queue / processing surface。
  - Avoid copying: rich filtering/analytics が必要な large dataset を worklist に縮退させること。

## Shell / host context

- [SAP Fiori Launchpad Spaces](https://www.sap.com/design-system/fiori-design-web/v1-148/foundations/integration-and-services/sap-fiori-launchpad/sap-fiori-launchpad-spaces)
  - Observe: role-based app access、spaces/pages、launchpad-owned navigation and personalization responsibilities。
  - Useful for: app chrome と host shell の責務境界を確認するとき。
  - Avoid copying: launchpad navigation を individual app body に重複実装すること。

## Density / input context

- [Content Density — Cozy and Compact](https://www.sap.com/design-system/fiori-design-web/v1-136/foundations/visual/cozy-compact)
  - Observe: touch vs mouse/keyboard context、cozy/compact の control/spacing relationship、hybrid device/user preference、application-level consistency。
  - Useful for: dense enterprise workflow を input context に適応するとき。
  - Avoid copying: published rem/px values を universal comfort target にすること、同じ hierarchy で cozy/compact を混在させること。

## Tables / responsive capability

- [Table Overview](https://www.sap.com/design-system/fiori-design-web/v1-145/foundations/best-practices/ui-elements/tables/table-overview)
  - Observe: fully responsive table と desktop-centric grid/analytical/tree table の capability difference、mobile alternative の考え方。
  - Useful for: same business task を desktop / tablet / phone でどう提供するか決めるとき。
  - Avoid copying: desktop-centric table を phone に縮小して唯一の task path にすること。

- [Table Features — SAP Fiori Elements](https://www.sap.com/design-system/fiori-design-web/v1-148/discover/frameworks/sap-fiori-elements/tables-and-lists/table-features-sap-fiori-elements)
  - Observe: selection model、responsive column behavior、sorting、sticky header、row loading、table-type-specific feature differences。
  - Useful for: Fiori Elements table capability と product requirement の fit を確認するとき。
  - Avoid copying: default row limitsや framework configuration を universal UX rule にすること。

## Themes / semantic color

- [Theming](https://www.sap.com/design-system/fiori-design-web/v1-136/foundations/visual/theming)
  - Observe: theme families、semantically named control/theme relationships、Morning/Evening Horizon と high-contrast variants。
  - Useful for: theme adaptation と custom branding の境界。
  - Avoid copying: raw theme values、exact colors/radii/spacing を unrelated product に固定すること。

- [Colors Overview](https://www.sap.com/design-system/fiori-design-web/v1-136/foundations/visual/colors-overview)
  - Observe: reference colors と semantic theme parameters の差、states / controls / theme variation。
  - Useful for: Fiori-specific semantic theming evidence。
  - Avoid copying: reference palette を controls に直接適用すること。

- [Evening Horizon](https://www.sap.com/design-system/fiori-design-web/v1-136/foundations/visual/colors/evening-horizon)
  - Observe: dark appearance が semantic roles をどう変換するか、dark theme と high-contrast theme の責務差。
  - Useful for: dark Fiori context の verification。
  - Avoid copying: dark palette を high contrast の代替とみなすこと。

## Accessibility / custom controls

- [Accessibility in SAP Fiori](https://www.sap.com/design-system/fiori-design-web/v1-148/discover/sap-design-system/product-standards/accessibility-in-sap-fiori)
  - Observe: framework/app responsibility、standard controls が持つ keyboard / resizing / theming / assistive behavior、custom control の risk。
  - Useful for: standard-component-first policy と final verification scope。
  - Avoid copying: framework compliance を app-level accessibility の証明とみなすこと。

## Public implementation evidence

- [UI5 / OpenUI5](https://github.com/UI5/openui5)
  - Observe: public implementation of responsive controls, themes, keyboard behavior, localization/globalization support。
  - Useful for: guidance の実装上の成立性を確認するとき。
  - Avoid copying: private/internal implementation detail、exact CSS/class/API structure を design principle にすること。

- [UI5 Web Components](https://github.com/UI5/webcomponents)
  - Observe: cross-framework current web-component implementation、theme/input/accessibility integration。
  - Useful for: standard component behavior の implementation evidence。
  - Avoid copying: component API catalog を Skill の source of truth にすること。

- [UI5 Documentation source](https://github.com/UI5/docs)
  - Observe: current public documentation source and implementation-facing guidance。
  - Useful for: design guideline と implementation docs の差を確認するとき。
  - Avoid copying: implementation snippetsを design decision に昇格させること。

## Comparison checklist

複数 reference を比較するときは最低限次を見る。

- task type: find / process / inspect / edit / analyze / guide
- object relationship: collection / single object / parent-child / drilldown
- information density and input precision
- shell vs app-body responsibility
- cross-device capability rather than visual scaling
- theme role preservation rather than raw value matching
- standard-vs-custom behavior cost
- loading / empty / error / selection / save-recovery states
- keyboard / touch / localization / high-contrast survivability

一つの Fiori application や一つの floorplan から enterprise UI 全体を一般化しない。
