# Internationalization references

Last reviewed: 2026-09-12

Open only the references relevant to the current platform and problem. Extract relationships and constraints; do not copy framework APIs or product-specific styling.

## W3C Internationalization

- [W3C — Internationalization](https://www.w3.org/mission/internationalization/)
  - Observe: internationalization as an early design/development quality property; language, script, culture, direction, and locale formatting as separate concerns.
  - Useful for: scope and vocabulary.

- [W3C — Internationalization Quick Tips for the Web](https://www.w3.org/International/quicktips/index.en)
  - Observe: UTF-8, language declaration, translatable text construction, locale-sensitive forms, localized navigation, RTL setup, validation.
  - Useful for: broad web i18n failure modes.

- [W3C — Structural markup and right-to-left text in HTML](https://www.w3.org/International/questions/qa-html-dir.en)
  - Observe: base direction, structural direction changes, logical ordering, direction as content semantics rather than decorative CSS.
  - Useful for: RTL page structure and mixed-direction boundaries.

- [W3C — Authoring HTML: Handling Right-to-left Scripts](https://www.w3.org/International/docs/bp-html-bidi/)
  - Observe: document/block direction, `dir="auto"` for unpredictable user input, logical text order, bidi-specific form concerns.
  - Useful for: mixed-direction content and input surfaces.

- [W3C Internationalization Checker](https://validator.w3.org/i18n-checker/)
  - Observe: declared language, encoding, direction and other detectable page-level i18n assumptions.
  - Useful for: web verification support; it does not replace rendered localization review.

## Unicode CLDR

- [Unicode CLDR Project](https://cldr.unicode.org/)
  - Observe: locale data as maintained infrastructure for dates, numbers, units, sorting, language/region variation.
  - Current note: CLDR 48.2 is the latest stable release listed on 2026-09-12; CLDR 49 alpha was announced 2026-09-04 and should not be treated as stable production data by default.

- [CLDR — Number Symbols](https://cldr.unicode.org/translation/number-currency-formats/number-symbols)
  - Observe: decimal/grouping symbols and regional-language variation.
  - Useful for: avoiding source-locale numeric assumptions.

- [CLDR — Plurals & Units](https://cldr.unicode.org/translation/getting-started/plurals)
  - Observe: plural categories differ by language; unit strings have locale-specific long/short/narrow forms.
  - Useful for: dynamic count/unit messages and compact UI.

- [CLDR — Date/Time Names](https://cldr.unicode.org/translation/date-time/date-time-names)
  - Observe: locale-specific field names and width variants.
  - Useful for: date/time UI labels and compact variants.

## Apple

- [Apple Developer — Localization](https://developer.apple.com/localization/)
  - Observe: internationalize before translating; language can be selected independently of device settings; adaptable layouts; localized assets/content; native-speaker review; localization testing for missing content, overlap, and RTL problems.
  - Useful for: product-level localization workflow and verification.

- [Apple Developer — Designing for Arabic](https://developer.apple.com/videos/play/wwdc2022/10034/)
  - Observe: RTL affects page/UI flow, not only text alignment; typography, numerals, iconography, and Arabic-specific visual behavior.
  - Useful for: distinguishing structural mirroring from simplistic horizontal flipping.

## Android

- [Android Developers — Localize the UI with Translations Editor](https://developer.android.com/studio/write/translations-editor)
  - Observe: RTL-aware logical start/end, manually exceptional text directions, localized string resources, pseudolocales that expose length, script, hard-coded-string, and mirroring problems.
  - Useful for: pseudolocalization and RTL verification concepts.

- [Android Developers — Per-app language preferences](https://developer.android.com/guide/topics/resources/app-languages)
  - Observe: app language can be a user preference distinct from broader device settings.
  - Useful for: avoiding language == region/device assumptions.

## Microsoft

- [Microsoft Globalization — Software internationalization](https://learn.microsoft.com/en-us/globalization/methodology/software-internationalization)
  - Observe: responsive layouts for translation expansion/contraction, pseudolocalization, pseudo-mirroring, customizable icons/images/colors, IME/keyboard variation.
  - Useful for: pre-localization structural design and testing.

- [Microsoft Globalization — Mirroring](https://learn.microsoft.com/en-us/globalization/fonts-layout/mirroring)
  - Observe: RTL layout consistency, mixed-direction text, touch behavior, and examples of content/icons that should not automatically mirror.
  - Useful for: mirroring decision rules.

- [Microsoft — Globalization and localization for Windows apps](https://learn.microsoft.com/en-us/windows/apps/design/globalizing/globalizing-portal)
  - Observe: current Windows guidance separates date/time/number formatting, layout/fonts/RTL, app resources, scale, contrast, and language-specific assets.
  - Last updated by Microsoft: 2026-08-29 when reviewed.

## What to compare across references

When researching a task, compare at least two relevant sources and record:

- which property varies: language, locale, script, direction, region, or platform
- what is structural vs implementation-specific
- whether the source assumes translated static content or runtime/user-generated content
- whether mirroring is logical/spatial or would alter intrinsic meaning
- how string growth and grammar variation are tested
- how dates/numbers/units/plurals are delegated to maintained locale data
- what pseudolocalization can detect and what still requires real-language review

Do not treat one platform's API, target size, language picker, or file format as a repository-wide internationalization rule.
