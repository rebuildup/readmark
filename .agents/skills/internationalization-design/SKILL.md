---
name: internationalization-design
description: >
  Design interfaces that remain structurally usable across languages, scripts, locales,
  writing directions, and cultural formatting conventions. Use when UI or content must
  survive localization without assuming English word order, fixed text length, LTR flow,
  or one regional date/number format.
---

# Internationalization Design

Localization を完成後の文字列差し替えとして扱わない。

**Inspect → Extract → Translate → Implement → Verify** を順に実行し、language / locale / writing system の変化を UI の設計条件として扱う。

この Skill は翻訳そのものではなく、**翻訳・locale変更・RTL・異なる入力/表記規則が入っても task structure と意味が壊れない設計**を担当する。

## Workflow

1. current artifact の supported / likely locales、content type、platform assumptions を確認する。
2. `references/internationalization.md` の relevant source を実際に開く。
3. 複数 reference を下の observation axes で比較する。
4. current UI が暗黙に固定している language / locale / direction assumptions を列挙する。
5. 固定値をコピーせず、logical relationships と locale-aware rules へ翻訳する。
6. pseudolocalization と representative real locales で delivered artifact を再検証する。

## Observe

reference と current artifact で最低限確認する。

### Language / locale model

- interface language と region / locale preference が同一前提になっていないか
- date / time / number / currency / unit / calendar / collation の locale dependency
- language fallback と untranslated content の見え方
- language switch 後に current task / navigation context が維持されるか

### Text variability

- translation expansion / contraction
- long compound words / short labels / multiline labels
- plural / grammatical variation
- noun / adjective / variable placement が English word order に固定されていないか
- strings が sentence fragments に分割され、翻訳者が並び替えられなくなっていないか
- dynamic values に十分な context があるか

### Script / direction

- LTR / RTL の base flow
- logical start / end と absolute left / right の混同
- navigation / hierarchy / progress / disclosure direction
- icon / image / chart / media-control の mirroring eligibility
- mixed-direction text: URL、email、code、ID、number、Latin text in RTL UI
- user-generated text の direction が予測不能な場合の扱い

### Layout / density

- fixed width / fixed height が翻訳後も成立するか
- text wrap で sibling alignment や hit target が壊れないか
- labels と values の関係が文字数に依存していないか
- narrow viewport + long translation + zoom の複合 stress
- clipping / ellipsis が task-critical content を失わせないか

### Locale-sensitive content

- ambiguous numeric-only dates
- decimal / grouping separators
- currency symbol placement
- unit / plural form
- name / address / phone assumptions
- locale-dependent sorting / grouping
- culturally dependent imagery / gestures / symbols / colors が意味を変えないか

## Decision rules

### Separate language, locale, region, and direction

一つの `country` や `language` 値からすべてを推測しない。

- language: UI / content の言語
- locale: 表示・入力・並べ替え等の地域的 convention
- region: market / legal / availability 等の地理的 context
- direction: script / content による reading flow

platform / product が別々に preference を持てるなら、それを設計上も別物として扱う。

### Design for variable text, not one source string

source-language の文字幅に合わせて container を固定しない。

- content-driven sizing を優先する
- necessary wrapping を許す
- label length で control semantics を変えない
- important action / status を安易な truncation に逃がさない

長文化を理由に font size を無条件に下げない。まず container、flow、wrapping、grouping を見直す。

### Do not assemble human sentences from rigid fragments

`"You have " + count + " items"` のような source-language-specific composition を design assumption にしない。

plural / grammar / word order が locale ごとに変わる message は、translator / locale system が全体を再構成できる unit として扱う。

UI 上で prefix / variable / suffix を別々の視覚 object に固定する場合も、他言語で順序変更できるか確認する。

### Use locale-aware formatting

日付・時刻・数値・通貨・単位・plural を handwritten format string や source locale の punctuation で固定しない。

CLDR / platform locale data のような maintained source を使える前提で design し、表示と入力の双方で locale variation を stress-test する。

保存形式や API payload と user-facing representation を混同しない。

### Mirror relationships, not every pixel

RTL では navigation flow、logical alignment、start/end relationship 等が反転する場合がある。

ただし次を一律に mirror しない。

- brand marks
- text / numerals that have their own intrinsic direction
- media symbols whose established meaning is direction-independent in the target platform
- maps / graphs / scientific or chronological visuals when mirroring changes represented meaning
- real-world objects where handedness/direction is semantically meaningful

各 asset / icon は **spatial relation に従うものか、intrinsic meaning を持つものか**で判定する。

### Treat mixed-direction content as normal

RTL UI に LTR URL / email / code / number が入り、LTR UI に RTL user content が入ることを例外扱いしない。

base direction を global styling で強制するだけで済ませず、content boundary と入力箇所で directionality が正しく保たれるか確認する。

### Keep locale-sensitive imagery replaceable

text embedded in images、culture-specific gestures、flags-as-language、market-specific screenshots 等を universal asset として固定しない。

language selector では、国旗を language 自体の proxy にしない。language と country/region は一対一ではない。

## Responsibility boundaries

### `content-design`

owns:

- user need
- information order
- wording clarity
- labels / instructions / errors / status message quality

this Skill owns:

- whether those structures remain translatable / reorderable
- locale / script / direction assumptions
- localization stress behavior

### `typesetting` / `font-mixing`

owns:

- visual type composition
- apparent size / baseline / family relationships
- mixed-script typographic quality

this Skill owns:

- whether the interface can support the required script / direction / locale variation at all

### `responsive-design`

owns viewport / container adaptation.

Translation expansion and RTL are additional stress dimensions. Do not invent locale-specific breakpoints when flexible layout can solve the problem.

### `accessibility-audit`

owns broad accessibility re-testing.

This Skill defines i18n-specific conditions that the resulting UI must survive.

## Avoid

- translating after layout freeze and repairing each overflow manually
- equating language with country or region
- using flags as the primary language identity
- fixed-width controls sized to English labels
- sentence concatenation that assumes one word order
- hard-coded MM/DD/YYYY, decimal separators, currency placement, or singular/plural pairs
- absolute `left` / `right` assumptions where logical `start` / `end` is intended
- mirroring every icon/image mechanically
- forcing one direction onto mixed user content
- treating pseudolocalization as proof of translation quality
- shrinking text until a poor layout happens to fit

## References

Open [`references/internationalization.md`](./references/internationalization.md) before making non-trivial decisions.

Choose references relevant to the current surface; do not apply one platform's implementation API as a universal design rule.

## Verify

Verification is not complete because source strings compiled successfully.

### Pseudolocalization pass

Use an available pseudo-locale / synthetic test that exposes:

- expanded strings
- accented / non-ASCII characters
- unlocalized hard-coded strings
- RTL / pseudo-RTL flow where supported

Check clipping, wrapping, overlap, hidden actions, broken hierarchy, and absolute-direction assumptions.

### Representative real locales

Pseudolocalization is structural testing only. Before production confidence, inspect real localized content with native / qualified review where practical.

At minimum include samples that exercise:

- a long-text locale
- a non-Latin script relevant to the product
- an RTL locale when the product claims RTL support
- locale-specific dates / numbers / currency / units / plurals
- mixed-direction content

### Interaction pass

Perform realistic tasks after switching locale/language:

- navigation context survives language change
- forms accept / explain locale-appropriate input
- validation messages remain associated with the right field/action
- dynamic counts and units use valid grammar
- keyboard / touch interactions remain reachable after reflow
- user-generated text keeps readable directionality

### Visual stress pass

Inspect at normal and narrow widths plus zoom:

- no critical clipping or overlap
- labels can wrap without detaching from controls
- action hierarchy survives text expansion
- RTL hierarchy and alignment remain understandable
- mirrored and unmirrored assets are intentionally chosen

### Completion gate

Do not call the artifact internationalization-ready until:

- source-language layout assumptions have been identified
- pseudolocalization has been inspected
- locale formatting is not hard-coded
- RTL / mixed-direction behavior is tested when relevant
- representative real localized content has been visually reviewed
- remaining unsupported locales / scripts / assumptions are explicitly documented
