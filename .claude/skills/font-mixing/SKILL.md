---
name: font-mixing
description: >
  日本語・Latin・数字・記号など複数script / familyを同一artifactで組み合わせるときに使用する。
  font pairを雰囲気で選ぶのではなく、apparent size、baseline、weight、stroke density、glyph coverage、
  punctuation、fallback、OpenType behaviorを比較し、mixed-script sampleをrenderして調整・検証する。
---

# Font Mixing

Last reviewed: 2026-09-12

font mixing は「相性のよい2書体を選ぶ」作業ではない。

**Inspect → Assign roles → Compare metrics → Mix → Stress-test → Verify** を実行し、
異なるscript / familyが一つの文章・UI・editorial compositionの中で自然に読める状態を作る。

## When to use

使う:

- 和文 + 欧文を別familyで組む
- 日本語本文の英数字だけ別familyへ分ける
- 漢字 / かな / 欧文 / 数字 / 記号に異なる役割を持たせる
- brand typefaceとsystem / fallback fontを混在させる
- editorial / poster / UIで複数familyを意図的に組み合わせる

使わない:

- 単一family内のsize / line-height調整だけ → `typesetting`
- brand typeface自体の選定 → brand / identity側
- 文字ごとのdecorative font切替を大量に行うだけ

## Workflow

1. current projectのfont stack、対応language、existing text rolesを調べる。
2. どのscript / roleへどのfamilyを割り当てるか決める。
3. 下記referenceを実際に開き、候補familyの差を比較する。
4. CSS sizeやweight名をそのまま等価とみなさず、optical relationshipを調整する。
5. realisticなmixed-language sampleをrenderする。
6. fallback、missing glyph、weight、narrow width、zoom / scalingでstress-testする。
7. delivered artifactを目視して完了判定する。

## Observe

候補fontを並べるとき、少なくとも以下を見る。

- apparent body size / x-height / cap-height
- Japanese em-boxに対するLatinの見かけサイズ
- baseline / vertical position
- stroke density / contrast
- weight mapping across families
- width / rhythm / character fit
- punctuation shape and spacing
- numerals: lining / oldstyle / proportional / tabular
- parentheses / slash / colon / percent / currency
- kana / kanji / Latin / symbol coverage
- italic / oblique behavior
- OpenType features
- fallback glyph appearance
- browser / OS / renderer differences

font名の「serif / sans」「明朝 / ゴシック」だけで相性を決めない。

## Decision rules

### Assign roles before choosing families

まず何を分けるかを決める。

例:

- Japanese prose → Japanese family
- Latin words / product names → Latin family
- comparable numbers → numeral treatment with tabular behavior
- code / IDs → monospace where semantically required

scriptごとに別fontを使う必要がないなら分けない。

### Match optical size, not CSS size

同じ `font-size` でも見かけサイズは一致しない。

調整対象:

- scale
- baseline shift
- weight
- letter spacing only when evidence requires it

reference固有の倍率をコピーしない。
実際の組み合わせをsampleで比較して決める。

### Map weights deliberately

`400` と `700` がfamily間で同じ濃さに見えるとは限らない。

regular / medium / boldごとに:

- stroke density
- counter openness
- apparent contrast

を比較する。

一つのweight pairが良かったから全weightを同じ対応表にしない。

### Treat punctuation and numerals as first-class

mixed textでは本文より punctuation / numeralsの違和感が目立つことがある。

特に:

- comma / period
- Japanese punctuation
- parentheses / brackets
- slash / colon
- percent / currency
- decimal / sign
- full-width / half-width symbols

を確認する。

### Prefer stable script mapping

Webでscript別fontを分ける場合、必要ならCSS font fallback / `unicode-range` / composite-face behaviorを利用する。

文字ごとの大量なspan wrappingをdefault solutionにしない。

ただし script coverage や font loading behavior が不安定なら、複雑なmappingを作るより単一familyの方がよい。

## References

### W3C — CSS Fonts Module Level 4

https://www.w3.org/TR/css-fonts-4/

Observe:

- font matching and fallback
- composite faces
- `unicode-range`
- weight / style matching
- variable-font behavior

Use for implementation semantics, not visual pairing advice.

### W3C — Japanese Script Resources

https://www.w3.org/TR/jpan-lreq/

Observe:

- Japanese line-layout requirements
- punctuation
- mixed-script layout concerns
- vertical / horizontal text behavior

### Digital Agency Design System — Typography

https://design.digital.go.jp/dads/foundations/typography/

Observe:

- Japanese production typography
- Noto Sans JP / Mono role separation
- font replacement / user-agent assumptions
- weight / text-role separation
- Japanese glyph density and line-height context

Do not copy its exact token values.

### Adobe — 和欧混植 / 合成フォント

https://blog.adobe.com/jp/publish/2020/11/26/cc-adobefonts-cv-compositefont-01

Observe:

- Japanese / Latin role separation
- apparent-size mismatch
- baseline adjustment
- weight matching
- punctuation / numeral assignment
- composite-font workflow as evidence of the design problem

Do not copy a sample pairing as a universal recommendation.

### Adobe Illustrator — East Asian characters / composite fonts

https://helpx.adobe.com/illustrator/using/formatting-asian-characters.html

Observe:

- composite font capabilities
- East Asian + Roman font assignment
- mojikumi / punctuation context
- renderer-specific constraints

### Adobe Fonts — OpenType features in CSS

https://helpx.adobe.com/jp/fonts/web/language-support-and-opentype-features/open-type-syntax.html

Observe:

- proportional / tabular numerals
- East Asian width features
- kana / glyph variants
- vertical features
- renderer support differences

## Stress-test samples

最低限、以下をrenderする。

- 日本語本文 + English product name
- 日本語 + half-width numerals + unit
- parentheses / slash / colon / %
- long Latin identifier inside Japanese prose
- regular + bold
- fallback font substitution
- narrow measure
- heading-size and body-size
- UI label and long-form prose

必要なら:

- all-caps Latin
- italic Latin
- tabular figures
- ruby
- vertical writing

## Avoid

- font pairの名前だけを根拠に選ぶ
- 同じCSS sizeならoptical sizeも同じとみなす
- weight番号をfamily間で機械的に対応させる
- Japanese + Latinのbaseline差を見ない
- punctuation / numeralsを確認しない
- missing glyphを別familyへ偶然fallbackさせた状態を完成扱いする
- arbitraryなbaseline / scale値をreferenceからコピーする
- decorativeなfont proliferationでhierarchyを作る
- fallback / zoom / localizationを検証しない

## Verify

完了前に実際のrendered artifactを確認する。

- mixed-script lineに不自然な上下ズレがない
- Japanese / Latinの見かけサイズが極端に違わない
- regular / boldで濃さの関係が破綻しない
- punctuation / numeralsが周囲から浮かない
- long Latin stringsでspacing / wrappingが破綻しない
- fallback後も致命的なlayout shiftがない
- narrow / wide widthで読みやすさが維持される
- zoom / font replacement時も情報伝達がfont依存にならない

font名ではなく、実際のmixed textが自然に読めるかで評価する。
