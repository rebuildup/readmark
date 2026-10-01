# Shopify Polaris references

Last reviewed: 2026-09-17

この reference set は Shopify Admin / App Home に merchant-facing app を適応するときの current system evidence をまとめる。

Polaris の exact token / component API を一般的な design law として使わない。対象 surface の current reference を実行時に再確認する。

## Current system and version anchors

- [Shopify App Design Guidelines](https://shopify.dev/docs/apps/design)
  - Observe: Shopify Admin との continuity、merchant-first principle、host surface と embedded app の関係、mobile adaptability。
  - Useful for: Polaris を visual style ではなく Shopify-hosted app system として扱うための最上位 boundary。
  - Avoid copying: screenshot 固有の spacing / card composition。

- [Polaris references](https://shopify.dev/docs/api/polaris)
  - Observe: unified Polaris system、Shopify surfaces の区分、current reference への入口。
  - Useful for: target surface ごとに current component set を確認する。
  - Avoid copying: one surface の API を別 surface へ一般化すること。

- [Apps in App Home](https://shopify.dev/docs/apps/build/app-home)
  - Observe: App Home の building blocks、App Bridge と Polaris の責務、iframe / UI extension model。
  - Useful for: Shopify Admin host chrome と app-owned content の boundary。
  - Avoid copying: implementation snippet を design source of truth にすること。

- [Using Polaris web components](https://shopify.dev/docs/api/polaris/using-polaris-web-components)
  - Observe: semantic component usage、built-in accessibility behavior、contextual styling constraints、labels/errors/focus expectations。
  - Useful for: standard-component-first の implementation evidence。
  - Avoid copying: property catalog、exact style value、framework-specific setup を design rule にすること。

- [App Home — latest Polaris web components](https://shopify.dev/docs/api/app-home/latest/web-components)
  - Observe: current stable component reference と Polaris version loading model。
  - Useful for: App Home で component availability が current か確認する。
  - Avoid copying: `latest` の状態を長期固定すること。実行時に再確認する。

## Design guidance

- [Navigation](https://shopify.dev/docs/apps/design/navigation)
  - Observe: app nav / app header / page title の責務、desktop vs Shopify mobile、secondary tabs、back/breadcrumb、page actions。
  - Useful for: host navigation と app body の重複を避ける。
  - Avoid copying: app name lengthや icon crop 等の product-specific implementation detail を universal navigation rule にすること。

- [Visual design](https://shopify.dev/docs/apps/design/visual-design)
  - Observe: Shopify Admin への visual integration、hierarchy、color / typography / icon usage、state の非 color-only representation。
  - Useful for: current host surface に異物感なく統合する。
  - Avoid copying: Shopify brand asset / exact visual value を unrelated product へ持ち出すこと。

- [Forms](https://shopify.dev/docs/apps/design/user-experience/forms)
  - Observe: form complexity、section grouping、progressive disclosure、modal limits、save model、validation / auto-save trade-off。
  - Useful for: settings / resource edit / long-form merchant task。
  - Avoid copying: field count の例を全 domain の magic number にすること。

- [App Home page](https://shopify.dev/docs/apps/design/user-experience/app-home-page)
  - Observe: daily merchant value、status / attention / quick action / metrics / setup hierarchy、support placement。
  - Useful for: generic marketing landing ではない operational homepage を設計する。
  - Avoid copying: example content / metrics を app の実 user need より優先すること。

## Current App Home patterns

- [Patterns](https://shopify.dev/docs/api/app-home/latest/patterns)
  - Observe: Homepage / Index / Details / Settings と composition family の役割分担。
  - Useful for: page purpose と情報関係から starting pattern を選ぶ。
  - Avoid copying: pattern を mandatory template とみなすこと。

- [Homepage pattern](https://shopify.dev/docs/api/app-home/latest/patterns/templates/homepage)
  - Observe: attention hierarchy、performance / status summary、immediate action、onboarding coexistence。
  - Useful for: returning merchant が daily operation を開始する surface。
  - Avoid copying: dashboard widgets を目的なく増やすこと。

- [Index pattern — current Patterns index](https://shopify.dev/docs/api/app-home/latest/patterns)
  - Observe: resource collection、search/filter/selection、resource actions、collection-to-detail transition。
  - Useful for: repeated first-class resources を管理する app。
  - Avoid copying: singleton settings / low-volume content を無理に index 化すること。

- [Details pattern](https://shopify.dev/docs/api/app-home/latest/patterns/templates/details)
  - Observe: primary resource information と secondary metadata/status、actions、return context。
  - Useful for: one resource の理解 / inspection / edit。
  - Avoid copying: two-column layout 自体を universal rule にすること。

- [Settings pattern](https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings)
  - Observe: logical option grouping、contextual help、save state、destructive actions。
  - Useful for: app-wide preference / integration configuration。
  - Avoid copying: every editable object を settings page に集約すること。

- [Resource list composition](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list)
  - Observe: compact scanability、resource identity / metadata / action relationship、小規模 collection での use case。
  - Useful for: full data table より軽量な resource collection。
  - Avoid copying: table-level comparisonが必要な data を list に変換して精度を落とすこと。

- [Setup guide composition](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide)
  - Observe: onboarding task、progress、completion、homepage への組み込み方。
  - Useful for: merchant が initial configuration を完了するまでの temporary guidance。
  - Avoid copying: setup completion 後も permanent primary content として残すこと。

- [Interstitial navigation composition](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/interstitial-nav)
  - Observe: deeper child destinations と main app nav の分離。
  - Useful for: main nav を増やさず local child structure を提示する。
  - Avoid copying: main navigation responsibility を body に再実装すること。

- [App Bridge title bar](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/title-bar)
  - Observe: current page context、page-specific actions、breadcrumb/back relationship、host-owned title area。
  - Useful for: app body と native host chrome の boundary。
  - Avoid copying: title-bar controls を body header と重複させること。

## Version / migration evidence

- [Polaris unified web components are now stable — 2025-10-01](https://shopify.dev/changelog/polaris-unified-web-components-are-now-stable)
  - Observe: unified Polaris web components の GA status と supported Shopify surfaces。
  - Useful for: old framework-specific Polaris を current canonical implementation とみなさない根拠。
  - Avoid copying: release-time component set を現在の availability として固定すること。

- [Removing outdated Polaris reference docs — 2026-04-01](https://shopify.dev/changelog/removing-outdated-polaris-reference-docs)
  - Observe: Polaris reference が Shopify API versioning window に追従する current documentation policy。
  - Useful for: stored old URL / old version の freshness risk を理解する。
  - Avoid copying: historical reference page を current API guarantee とみなすこと。

- [Shopify AI Toolkit for upgrading extensions to Polaris web components — 2026-06-11](https://shopify.dev/changelog/shopify-ai-toolkit-for-upgrading-extensions-to-polaris-web-components)
  - Observe: 2025-10+ API versions の current Polaris web-component direction と legacy migration pressure。
  - Useful for: legacy extension/component assumptions が current か判断する supporting evidence。
  - Avoid copying: migration tooling の操作手順を design principle にすること。

## Historical implementation evidence only

- [Shopify/polaris-react-archive](https://github.com/Shopify/polaris-react-archive)
  - Status: GitHub 上で 2026-08-11 に archive 済み。read-only。
  - Observe: historical component architecture / migration context が必要な場合のみ。
  - Useful for: legacy Shopify app の既存 UI を理解する。
  - Avoid copying: React Polaris component props、token names、examples、visual defaults を current Polaris の source of truth にすること。

## Comparison checklist

複数 reference を見るときは次を比較する。

- host chrome が何を所有し、app body が何を所有するか
- page purpose と resource relationship
- primary / secondary / item / batch / destructive action hierarchy
- explicit save / discard と unsaved-change protection
- homepage の daily-use value と onboarding / marketing の balance
- index / details / settings の情報量と density
- empty / loading / error / permission state
- desktop / mobile Admin で保持される semantics
- current surface / API version での component availability
- standard component と custom UI の behavior gap
