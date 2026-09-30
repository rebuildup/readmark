# App Icon Design References

Last reviewed: 2026-09-15

app icon の current behavior は platform update で変わる。target platform の official source を実際に開き、container / mask / rendering mode / layer model / size behavior が現在も同じか確認してから適用する。

ここにある grid、safe-area、asset size、material、rendering mode は **各 platform の production constraint** であり、他 platform へ持ち出す universal design rule ではない。

## Apple platforms

### Apple Human Interface Guidelines — App icons

- https://developer.apple.com/design/human-interface-guidelines/app-icons
- Current-status note:
  - HIG change log は 2026-06-08 に Liquid Glass guidance の refinement を記録している。
  - 2025-06-09 に layered icons、cross-platform consistency、Liquid Glass best practices を反映。
  - 2024-06-10 に iOS / iPadOS の dark / tinted variants guidance が追加された。
- Observe:
  - iPhone / iPad / Mac / Apple Watch で何を共有し、何を platform ごとに調整するか
  - enclosure、layering、appearance mode、material が icon identity とどう分担されるか
  - system label と icon 内 text の役割差
  - platform-owned rendering と author artwork の境界
- Useful for:
  - Apple 向け installed-app icon family
  - current appearance / material model の確認
- Avoid copying:
  - Apple first-party icon の object、color、material treatment
  - platform-specific construction rule を Android / Windows / Web へ一般化すること

### Apple — Icon Composer

- https://developer.apple.com/icon-composer/
- Current-status note:
  - 2026-09-15 時点の page は、single layered design を iPhone / iPad / Mac / Apple Watch へ使用し、platform ごとの customization を許容している。
  - Default / Dark / Mono rendering modes を同一 layered structure 上で annotate できる。
  - current page は Liquid Glass の refraction、specular highlights、shadows 等の system/material workflow を示す。
- Observe:
  - one source family と platform-specific adjustment の関係
  - layer が material/effect の入力になる構造
  - Default / Dark / Mono で retained cue と changed treatment がどう分かれるか
  - marketing 用 flattened output と installed icon の差
- Useful for:
  - layered Apple app icon の state / platform comparison
- Avoid copying:
  - Liquid Glass を app icon 全般の universal style とみなすこと
  - tool control 値を design principle とみなすこと

### Apple — Creating your app icon using Icon Composer

- https://developer.apple.com/documentation/Xcode/creating-your-app-icon-using-icon-composer
- Observe:
  - layered source が Xcode delivery へどう接続されるか
  - authoring representation と final platform rendering の違い
- Useful for:
  - implementation / delivery evidence
- Avoid copying:
  - Xcode 操作手順を cross-platform design rule にすること

## Android

### Android Developers — Adaptive icons

- https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
- Current-status note:
  - Last updated: 2026-08-13 UTC.
  - current guidance は OEM ごとの mask variation、launcher-generated effects、foreground/background layers、monochrome theming を扱う。
  - Android 13 以降 themed app icons を扱い、current guidance は Android 16 QPR 2 以降の automatic theming behavior も記載している。
- Observe:
  - foreground / background / monochrome の責務
  - circle / squircle 等の異なる OEM mask に対する critical cue の survival
  - safe region と outer effect region の差
  - launcher-generated movement/effects と author-added effect の境界
  - themed mode で hue が失われたときの silhouette / negative-space behavior
- Useful for:
  - Android launcher icon の adaptive construction / final QA
- Avoid copying:
  - Android の 108dp container や safe-region 数値を他 platform に転用すること
  - one OEM mask だけを canonical crop とみなすこと

### Android Developers — Themed App Icons AEP guideline

- https://developer.android.com/distribute/aep/aep-req-theme-app-icons
- Current-status note:
  - Last updated: 2026-08-26 UTC.
  - AEP guidance は adaptive icon の `monochrome` layer を themed icon integration の入力として扱う。
- Observe:
  - monochrome source で残すべき semantic silhouette
  - system tint が identity のどの情報を置換するか
  - full-color state と themed state の recognition continuity
- Useful for:
  - Android themed icon の current production requirement / validation
- Avoid copying:
  - wallpaper/theme tint を brand palette の代替として universalize すること

### Android Developers — AdaptiveIconDrawable API

- https://developer.android.com/reference/android/graphics/drawable/AdaptiveIconDrawable
- Observe:
  - foreground/background layer が device mask で clip される runtime model
  - system effect に使われる outer layer region
- Useful for:
  - design guidance の implementation behavior を確認するとき
- Avoid copying:
  - API structure を Skill の design source of truth にすること

## Windows

### Microsoft Learn — App icons

- https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icons
- Current-status note:
  - Last updated: 2026-03-06.
  - Windows app icon を Windows / Store で app を見つけ起動する visual cue として扱い、UI 内 iconography と区別している。
- Observe:
  - Start / taskbar / search / app list 等の materially different surfaces
  - installed app identity と UI icon family の境界
  - platform が size / theme に応じて asset を選ぶ関係
- Useful for:
  - Windows の app-icon responsibility / surface inventory
- Avoid copying:
  - Windows visual language を他 platform の app icon に適用すること

### Microsoft Learn — Design guidelines for Windows app icons

- https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-design
- Current-status note:
  - Last updated: 2026-03-06.
- Observe:
  - focal metaphor / silhouette / detail reduction
  - light/dark background contrast
  - optional theme-sensitive assets
  - layer/shadow/perspective が small-size reading に与える影響
  - neighboring system icons と visual weight を揃える考え方
- Useful for:
  - Windows-specific icon composition と small-size inspection
- Avoid copying:
  - 48px grid、corner radius、metaphor count 等の Windows-specific guidance を universal values にすること
  - Windows の illustrative treatment を brand requirement にすること

### Microsoft Learn — Construct the icon for your Windows app

- https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-construction
- Observe:
  - system が context / scale factor に応じて exact or nearest asset を選ぶ behavior
  - small taskbar/title-bar と larger Start surface の差
  - default/light/dark asset treatment と system plate fallback
- Useful for:
  - final-size asset family / package verification
- Avoid copying:
  - filename/size matrix を conceptual design rule にすること

## Installed Web Apps / cross-platform specification

### W3C — Web Application Manifest

- https://www.w3.org/TR/appmanifest/
- Current-status note:
  - current specification reviewed 2026-09-15.
  - manifest image resources define `any`, `maskable`, `monochrome` purposes.
  - user agents may round, recolor, pad, mask, or otherwise adapt icon resources for platform integration.
- Observe:
  - authored image と user-agent-owned modification の境界
  - `maskable` safe zone と outside region の役割差
  - `monochrome` で RGB information が破棄され alpha silhouette が使われる behavior
  - one web app が異なる host OS / user agent で別 mask / color / padding を受ける可能性
- Useful for:
  - installed PWA / cross-platform web app icon
  - platform-owned transformation を specification level で理解すること
- Avoid copying:
  - spec の safe-zone ratio を native Apple/Android/Windows asset に流用すること
  - browser/OS が必ず同じ rendering を行うと仮定すること

## Comparison matrix

| Source family | Designer supplies | Platform may own/change | Primary stress test |
| --- | --- | --- | --- |
| Apple | layered identity artwork + appearance annotations | enclosure/material/rendering mode/platform rendering | Default/Dark/Mono + supported device families |
| Android | foreground + background + optional/required-context monochrome layer | OEM mask, theme tint, launcher effects | multiple masks + themed/full-color states |
| Windows | icon artwork + required context/size/theme assets | surface selection, scaling, possible system plate | taskbar/Start/search sizes + light/dark |
| Web App Manifest | image resources + declared purposes | mask, padding, recolor, solid fill, host-platform integration | maskable/monochrome across actual UAs/OSes |

この差分から、app icon は「一つの master image の export matrix」ではなく、**recognition invariant を platform-owned transformations の下で保つ adaptation system** として扱う。

## Research extraction

複数 source に共通して観察できる軸:

- identity / recognition cue
- enclosure / mask ownership
- guaranteed vs expendable image region
- flattened vs layered source model
- optical scale and centering
- full-color vs reduced/mono/theme modes
- system-added plate / tint / material / shadow / movement
- smallest relevant delivered size
- background/theme contrast
- neighboring-icon visual weight
- app label relationship
- cross-platform retained vs variable properties
- final installed representation

重要な差分:

- Apple の current icon model は layered material と appearance annotation を強く使う。
- Android は OEM-controlled masks と foreground/background separation、themed monochrome behavior が中心となる。
- Windows は複数 physical/context sizes と surface-specific asset selection の検証比重が大きい。
- Web App Manifest は一つの native visual grammar を定めず、user agent による mask/recolor/padding を specification として許容する。

したがって「rounded square」「特定 safe-area ratio」「特定 layer 数」「単色 variant」「特定 shadow」は app-icon 全般の rule ではない。target platform の current model を先に調べ、identity cue がその transformation 下で生存するよう翻訳する。
