# Material / Android platform references

Last reviewed: 2026-09-13

この file は `material-design` Skill の runtime reference map である。固定 token 値や framework API をコピーするためではなく、current Material / Android の system intent、adaptive behavior、production evidence を比較するために使う。

## 1. Material 3 system and theming

- [Android Developers — Material Design 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)
  - Observe: color / typography / shape の subsystem、semantic color roles、dynamic color、tonal elevation、component emphasis、navigation component variation、accessibility notes。
  - Useful for: current Material 3 の role vocabulary と Android integration を確認する。
  - Avoid copying: Reply sample の exact color、font size、corner radius、code snippet、component API。
  - Current note: 2026-09-13 時点のページは Material You と Material 3 Expressive を Material 3 の current evolution として説明している。

- [AndroidX — Compose Material 3 release notes](https://developer.android.com/jetpack/androidx/releases/compose-material3)
  - Observe: current stable / alpha status、new expressive component/state behavior、deprecated / superseded element。
  - Useful for: guidance が現行 implementation surface と一致しているか確認する freshness anchor。
  - Current note: current page reports stable `1.4.0`; page latest update is 2026-09-09. Material Icons library is no longer the recommended current icon path; Material Symbols is recommended.
  - Avoid copying: library versionを design rule にすること。

## 2. Adaptive structure

- [Android Developers — Adapt layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout)
  - Observe: handset-only assumption を捨てる rationale、window/form-factor adaptation、key/hero screens の adaptation planning。
  - Useful for: adaptive を optional tablet polish ではなく default design concern として扱う。
  - Avoid copying: class size を content-independent な universal breakpoint として扱うこと。

- [Android Developers — Canonical layouts](https://developer.android.com/develop/ui/views/layout/canonical-layouts)
  - Observe: list-detail / supporting pane / feed の情報関係、各 layout がどの task で有効か、small-to-large form-factor transformation。
  - Useful for: multi-pane / browsing structure の候補を semantic relationship から選ぶ。
  - Avoid copying: large screen だから canonical layout を必ず採用すること。

- [AndroidX — Compose Material 3 Adaptive release notes](https://developer.android.com/jetpack/androidx/releases/compose-material3-adaptive)
  - Observe: current adaptive library status、window configuration / posture support、list-detail / supporting-pane evolution、RTL / edge-to-edge integration。
  - Useful for: adaptive guidance が現在も active に更新されているか確認する freshness anchor。
  - Current note: stable `1.3.0` was released 2026-08-12; current page also exposes newer alpha work.
  - Avoid copying: scaffold/API availability を information architecture の根拠にすること。

## 3. First-party production/sample evidence

- [android/compose-samples](https://github.com/android/compose-samples)
  - Observe: official Reply sample の Material 3 theming、dynamic color、navigation transformation、phone/tablet/desktop/foldable adaptation。
  - Useful for: guideline が real multi-screen sample でどう組み合わされるかを見る。
  - Avoid copying: sample app の information architecture、brand、exact layout、source implementation。

- [android/adaptive-apps-samples](https://github.com/android/adaptive-apps-samples)
  - Observe: CanonicalLayouts、AdaptiveJetStream、Adaptive navigation 等で form factor / navigation / pane strategy がどう変化するか。
  - Useful for: one binary / shared product semantics を複数 form factor へ翻訳する production-like evidence。
  - Avoid copying: sample-specific media/content model を universal pattern とすること。

- [Adaptive JetStream README](https://github.com/android/adaptive-apps-samples/blob/main/AdaptiveJetStream/README.md)
  - Observe: mobile / tablet / foldable / Chromebook / TV / automotive / XR で shared product をどう分岐させるかという surface assumption。
  - Useful for: cross-device continuity と form-factor specialization の差を考える。
  - Avoid copying: 3D/XR scene guidance。本 repository の source-of-truth scope は2D design。

## 4. Material 3 Expressive — current evolution, not a style preset

- [Android Developers — Material 3 Expressive design language for Wear](https://developer.android.com/design/ui/wear/guides/get-started/design-language)
  - Observe: deeper tonal palette、variable font axes、shape morphing、grouped containers、motion-led feedback と round form factor の関係。
  - Useful for: expressive vocabulary が hierarchy / feedback / form factor に結び付いていることを確認する。
  - Avoid copying: edge-hugging / round-screen / Wear-specific shape patterns を phone/tablet の universal Material rule にすること。
  - Current note: page last updated 2025-05-20; use it as form-factor-specific evidence, not as the sole current Material source.

- [Android Developers — Wear Material 3 overview](https://developer.android.com/design/ui/wear/guides/get-started)
  - Observe: round canvas、glanceability、springs、shape morphing、rich color、variable fonts が watch constraints とどう結び付くか。
  - Useful for: expression should exploit surface constraints rather than add decoration generically.
  - Avoid copying: watch-specific density / navigation / edge pattern outside Wear.

## 5. Comparison axes

複数 reference を比較するときは、以下を table / notes にする。

| Axis | Questions |
| --- | --- |
| Semantic role | component / token / pane は何の task meaning を持つか |
| Emphasis | high / medium / low priority を何で区別しているか |
| Theme role | concrete color ではなくどの role pair が使われるか |
| Personalization | dynamic/user-derived value と product identity の境界はどこか |
| Shape | grouping / state / identity / expression のどれを担うか |
| Elevation | tonal / shadow / layer relation のどれを使うか |
| Navigation | destination semantics を保ったまま presentation がどう変わるか |
| Adaptive layout | width / posture / input 変化で何を reveal / split / reflow するか |
| Input | touch / keyboard / pointer で behavior がどう変わるか |
| System integration | edge-to-edge / bars / insets / system theme とどう協調するか |
| Expressiveness | shape / motion / type / color の増加に semantic purpose があるか |
| Failure mode | sample visual の imitation に落ちていないか |

## 6. Responsibility boundary reminders

- general semantic palette → `color-system`
- light/dark transformation → `dark-mode-design`
- forced/increased contrast → `high-contrast-design`
- destination / hierarchy → `navigation-design`
- generic viewport/container adaptation → `responsive-design`
- touch acquisition / gesture → `touch-interface`
- keyboard traversal → `keyboard-interface`
- state meaning → `interaction-states`
- animation purpose / timing → `motion-system`
- icon family / metaphor → `iconography-system`
- broad accessibility retest → `accessibility-audit`

Material reference はこれらの canonical domain policy を置換せず、Android / Material context への adaptation evidence として使う。
