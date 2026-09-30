# Favicon Design References

Last reviewed: 2026-09-15

この reference set は favicon の見た目を一つの style に固定するためではなく、**browser/search が site identity resource をどう選び、異なる brand system が tiny identity をどう統治・適応しているか**を比較するために使う。

current platform / browser / search behavior は変化する。実作業では target environment の current guidance を再確認する。

## Primary specification / platform guidance

### WHATWG HTML Living Standard — Link type `icon`

https://html.spec.whatwg.org/multipage/links.html#rel-icon

- Observe:
  - icon が page / site を user interface で表す external resource として定義されていること
  - 複数 icon がある場合、user agent が `type` / `media` / `sizes` を使って resource を選択すること
  - equally appropriate な resource の選択順と unsupported resource 時の fallback
  - `sizes` が raw pixel size を表し、`any` が scalable resource を表すこと
  - icon list が変化しても user agent が更新を必ず行うわけではないこと
  - explicit icon がない場合の `/favicon.ico` fallback behavior
- Useful for:
  - resource family / fallback / cache behavior を browser implementation の思い込みではなく canonical HTML model から確認する
  - `one SVG`、`one ICO`、固定 size set 等を universal rule にしない
- Avoid copying:
  - specification example 内の特定 format / size set を現在の project の必須 asset bundle とみなさない

### Google Search Central — Define a favicon to show in search results

https://developers.google.com/search/docs/appearance/favicon-in-search

- Observe:
  - Google Search が favicon を hostname/site 単位で扱うこと
  - home page と favicon resource の crawlability
  - site brand を視覚的に代表することへの要求
  - current aspect / minimum / recommended size / supported format requirements
  - stable favicon URL と recrawl/process delay
- Useful for:
  - search result を delivery surface に含む site identity
  - hostname / subdomain と favicon governance の境界
  - rebrand 後の crawler-visible verification
- Avoid copying:
  - Google Search の current numeric/file requirements を browser tab 全体の universal composition rule にする
  - source configuration だけで search result 上の反映を確認済みとする

## Current production / design-system evidence

### GOV.UK Frontend — Using GOV.UK Frontend without GOV.UK branding

https://frontend.design-system.service.gov.uk/using-govuk-frontend-without-govuk-branding/

- Observe:
  - favicon を browser tabs / bookmarks 用 asset と定義していること
  - favicon と mobile homepage icons と sharing/Open Graph image を別 asset family として扱うこと
  - current GOV.UK Frontend が browser compatibility のため複数 favicon resource を期待していること
  - own branding を使う service は GOV.UK asset をそのまま流用せず branded asset を置き換えること
- Useful for:
  - favicon / app-home shortcut / social preview の責務分離
  - production template と asset family の整合
- Avoid copying:
  - GOV.UK 固有 filename / color / asset bundle を別 project の universal requirement にする

### Ontario Design System — Favicon

https://designsystem.ontario.ca/components/detail/favicon.html

- Observe:
  - favicon が tab だけでなく bookmark / history / search 等の複数 surface で site recognition を担うこと
  - current browser compatibility のため SVG / ICO / PNG 等を組み合わせる production strategy
  - SVG と raster resource の性質差
  - official Government of Ontario site として consistency を優先する governance
  - favicon guidance と native app を明確に分けていること
- Useful for:
  - tiny recognition と delivery compatibility を別軸として考える
  - official multi-site organization で favicon identity を統一する例
- Avoid copying:
  - Ontario の exact size / format package を target browser support の再確認なしに転用する

### UCLA Design System — Favicon

https://designsystem.brand.ucla.edu/build/v2.0.0/docs/components/favicon.html

- Observe:
  - favicon を website / page を識別する brand element として扱うこと
  - UCLA ecosystem では approved favicon のみを使い、site ごとの arbitrary custom favicon を禁止すること
  - framework default favicon を残さないという governance
- Useful for:
  - parent organization の recognition を site-specific expression より優先する architecture
  - governance failure と visual failure を分けて考える
- Avoid copying:
  - `one institution = one favicon` を product family / multi-brand organization 全般の universal rule にする

### Honeycomb Design System — Favicon

https://honeycomb.style/components/favicon/

- Observe:
  - product/brand variation ごとに favicon variant を持つこと
  - default と dark-mode resource を分け、`media` condition で選択する実装例
  - favicon と touch icon を別 asset として扱うこと
- Useful for:
  - controlled product-family variation
  - theme/background failure が実在する場合の variant strategy
  - HTML の `media`-based icon selection を production system へ翻訳する例
- Avoid copying:
  - light/dark variant が全 browser / site に必須だと一般化する
  - Honeycomb 固有 product taxonomy / asset names / color treatment を模倣する

## Supporting compatibility reference

### MDN — `rel` HTML attribute / `icon`

https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel#icon

- Observe:
  - current browser-facing explanation of multiple `rel="icon"` resource selection
  - implementation caveats that may differ between browser engines
- Useful for:
  - WHATWG rule を current browser compatibility の観点から補助確認する
- Avoid copying:
  - MDN の compatibility note を canonical specification より上位の design source of truth にする

## Comparison matrix

| Reference | Identity scope | Resource model | Theme / variant | Distinct downstream assets | Main lesson |
| --- | --- | --- | --- | --- | --- |
| WHATWG HTML | page / site representation | UA selects by type/media/sizes | media can participate | outside scope | delivered icon is UA-selected, not merely authored |
| Google Search | hostname/site | crawler-selected site favicon | not the main model | search-specific | search identity, crawlability, stable URL, delayed refresh |
| GOV.UK | service/site | compatibility asset family | implementation-specific | home icons + OG separated | browser identity is not app/share artwork |
| Ontario | government site family | SVG + raster compatibility family | one controlled official system | mobile/app-like assets documented separately | recognition governance and compatibility are separate axes |
| UCLA | institution-wide | approved branded favicon | no arbitrary site variants | outside page scope | architecture may require one parent identity |
| Honeycomb | product family | default + product/theme resources | explicit light/dark/product variants | touch icon separated | controlled variation can be legitimate |

## Extraction summary

複数 source を比較すると、favicon の repeatable decision は次へ収束する。

1. **identity scope を asset より先に決める** — organization/site/product/hostname のどれを browser/search 上で識別するか。
2. **tiny recognition cue を抽出する** — full logo の情報量ではなく、小サイズで残る silhouette / negative space / letterform / color relationship を選ぶ。
3. **resource strategy と visual design を分ける** — format / size / fallback は current user-agent support、visual cue は identity と tiny rendering failure から決める。
4. **variant は architecture / failure で正当化する** — parent-wide統一も product/theme variation もあり得る。理由なく増やさない。
5. **favicon と app/home/share asset を分離する** — upstream identity は共有できても platform container / browser selection / social-preview role は異なる。
6. **cache / crawlability を final QA に含める** — authored file と利用者が見る resource が一致するとは限らない。

## Failure modes observed / implied by the references

- full wordmark を mechanical downscale し、文字・counter が潰れる
- framework default icon が残り site identity と不一致になる
- app icon / touch icon / favicon / OG image を同じ artwork と delivery rule で扱う
- unsupported resource 一つだけに依存し fallback が成立しない
- theme variant を作ったが fallback/unsupported browser では silhouette が消える
- organization-wide identity policy を無視して subsite ごとに arbitrary favicon を作る
- reverse に、product family の識別要件があるのに parent favicon へ強制統一する
- local cache の表示だけで public/search delivery を確認したことにする
- favicon URL / metadata の変更後、crawler/cache refresh delay を visual defect と混同する
- current platform の exact pixel/file requirements を timeless design rule にする
