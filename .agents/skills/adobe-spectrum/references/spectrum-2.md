# Adobe Spectrum 2 references

Last reviewed: 2026-09-13

この reference は `adobe-spectrum` Skill の runtime research source として使用する。

Spectrum は version-sensitive な design system なので、exact token / component anatomy / implementation status を使う前に current page を再確認する。

## Current Spectrum 2 direction

- [Spectrum 2 — Adobe](https://s2.spectrum.adobe.com/index.html)
  - Observe: Rational / Human / Focused / Collaborative の system direction、cross-platform adaptation、accessibility / personalization、professional tool と approachable expression の両立。
  - Useful for: Spectrum 2 を単なる visual refresh ではなく system evolution として理解する。
  - Avoid copying: promotional illustration、Adobe brand asset、具体的な mockup appearance。

- [Introducing Spectrum 2 — Adobe Design](https://adobe.design/ideas/introducing-spectrum-2)
  - Observe: icon/type relationship、color system と Adobe brand の関係、Spectrum 2 の visual-system change がどの product problem を解こうとしているか。
  - Useful for: iconography / brand emphasis / system evolution の intent を確認する。
  - Avoid copying: Adobe-specific icon artwork、restricted font、brand paletteそのもの。

- [Adobe unveils Spectrum 2 design system — Adobe Blog](https://blog.adobe.com/en/publish/2023/12/12/adobe-unveils-spectrum-2-design-system-reimagining-user-experience-over-100-adobe-applications)
  - Observe: Express / Photoshop Web / Acrobat / Journey Optimizer 等で、consumer-friendly surface と complex professional workflow がどう異なる形で Spectrum 2 を使うか。
  - Useful for: 単一 product screenshot から system 全体を一般化しないための first-party production comparison。
  - Avoid copying: individual Adobe product layout、product-specific assets、exact styling。

## Spectrum principles and legacy/current foundations

以下の `spectrum.adobe.com` pages には Spectrum 1 時代からの guidance も含まれる。Spectrum 2 の current implementationと突き合わせ、普遍的な system intent と legacy-specific exact value を分離して読む。

- [Principles — Spectrum](https://spectrum.adobe.com/page/principles/)
  - Observe: real-world evidence、attention economy、cross-platform quality、accessibility、internationalization、system evolution。
  - Useful for: system-level decision criteria。
  - Avoid copying: historical wordingを current component specification と誤認すること。

- [Platform scale — Spectrum](https://spectrum.adobe.com/page/platform-scale/)
  - Observe: cursor-oriented desktop と touch-oriented mobile で、component proportion / typography / iconography を分ける考え方。
  - Useful for: scale を input/context adaptation として扱う根拠。
  - Avoid copying: historical exact scale ratio を universal constant にすること。current Spectrum 2 implementation の scale options と actual product context を再確認する。

- [Color system — Spectrum](https://spectrum.adobe.com/page/color-system/)
  - Observe: neutral foundation、semantic hierarchy、theme variation、perceptual lightness、interactive-state relationship。
  - Useful for: Spectrum が color を hierarchy/state system として扱うことを確認する。
  - Avoid copying: old token index / hex value を current Spectrum 2 token として固定すること。

- [Using color — Spectrum](https://spectrum.adobe.com/page/using-color/)
  - Observe: background layering、interactive state progression、color-only meaning avoidance、data-viz palette separation、brand/accent restraint。
  - Useful for: dense tool UI で color を selective signal として扱う判断。
  - Avoid copying: old token identifiers / exact indices。`color-system` の semantic role を置き換えない。

- [Iconography — Spectrum](https://spectrum.adobe.com/page/iconography/)
  - Observe: metaphor consistency、platform-specific icon exceptions、fill/stroke choice、interactive state relationship。
  - Useful for: Spectrum adapter が `iconography-system` とどう接続するか。
  - Avoid copying: Adobe proprietary icon artwork。family geometry の source of truth は current project / licensed asset set に置く。

## Current implementation / status anchors

- [React Spectrum releases](https://react-spectrum.adobe.com/releases/)
  - Current status at review: Spectrum 2 stable implementation was announced in `v1.0.0` on 2025-12-16; the current releases page lists `v1.7.0` on 2026-09-01.
  - Observe: current Spectrum 2 implementation status、component additions、intentional visual/interaction updates。
  - Useful for: stale Spectrum 1 assumptions を検出する freshness anchor。
  - Avoid copying: package API / version-specific implementation detail into design policy。

- [React Spectrum v1.0.0 — Spectrum 2 stable](https://react-spectrum.adobe.com/releases/v1-0-0)
  - Observe: Spectrum 2 stable milestone、accessibility / performance / styling flexibility の current implementation direction。
  - Useful for: Spectrum 2 が preview ではなく stable implementation phase に入っていることを確認する。

- [Migrating to Spectrum 2 — React Spectrum](https://react-spectrum.adobe.com/migrating)
  - Observe: old component assumptions が Spectrum 2 で削除・再構成されている箇所、current component semantics。
  - Useful for: legacy Spectrum behavior を current rule と誤認しないための comparison evidence。
  - Avoid copying: migration commands / props を design source of truth にすること。

- [Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/)
  - Observe: current public implementation、keyboard/screen-reader/contrast support、framework-independent component behavior。
  - Useful for: standard component がどの system behavior を encode しているか確認する。
  - Avoid copying: Lit / package API を design rule にすること。

- [Migrating to Spectrum 2 — Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/migrating-to-spectrum2/)
  - Observe: Spectrum 2 system/theme/scale separation と migration boundary。
  - Useful for: current Spectrum 2 theme / scale model の implementation evidence。
  - Avoid copying: CSS import path / custom element syntax を Skill policy に固定すること。

- [Theme API — Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/tools/theme/api/)
  - Observe: system (`spectrum-two`) / color (`light`, `dark`) / scale (`medium`, `large`) が独立 dimension として扱われること。
  - Useful for: appearance と scale を一つの preset に潰さない判断。
  - Avoid copying: token names や implementation API を universal rule にすること。

- [Support and compatibility — Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/support-and-compatibility/)
  - Observe: browser support、versioning、mobile testing limitation。
  - Useful for: Web implementation を Spectrum 全体の platform guarantee と誤認しないための boundary evidence。

## Comparison notes

複数 source を比較すると、繰り返し現れる system-level signal は次の通り。

- Adobe product 間の共通 language を保ちながら、platform / audience / workflow complexity に応じて presentation を変える。
- professional tool の power と approachable / expressive presentation は両立対象であり、一方を万能化しない。
- content / work object を主役にし、UI chrome は task orientation と control に徹する。
- scale は device name だけではなく input precision / interaction context と結び付く。
- color / brand expression は hierarchy と orientation の signal であり、dense UI 全体を着色する目的ではない。
- standard component implementation は accessibility / keyboard / localization / contrast behavior の evidence になるが、framework API は design source of truth ではない。
- Spectrum 2 は現在も更新中なので、exact component / icon / token / typography detail は current release/documentation を毎回確認する。

## Verification targets

real-project trial では、同じ representative task を少なくとも次の2 contextで比較する。

1. dense cursor/keyboard-oriented workspace
2. materially different touch-oriented / larger-scale context（product scope に存在する場合）

両方で次を確認する。

- task semantics / information hierarchy が保たれる
- control scale を変えても important content が押し出されない
- primary / contextual / destructive action hierarchy が明瞭
- light / dark で semantic role が維持される
- keyboard focus / pointer / touch behavior が predictable
- high contrast / forced colors で essential state が残る
- realistic long labels / localization / RTL で clippingしない
- loading / empty / error state で structure と focus continuity が崩れない
