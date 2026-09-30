# Vertical Writing References

Last reviewed: 2026-09-13

この reference set は、縦書きを style preset ではなく reading / composition system として判断するために使う。

## W3C — CSS Writing Modes Level 4

- https://www.w3.org/TR/css-writing-modes-4/
- Type: specification
- Observe:
  - `vertical-rl` / `vertical-lr` の inline / block flow
  - mixed orientation と vertical glyph behavior
  - `text-orientation`
  - `text-combine-upright`
  - principal writing mode と page progression の関係
- Useful for:
  - writing direction と rendering model の基礎
  - vertical writing を transform/rotation と区別する
- Avoid copying:
  - property catalogue を design rule にしない
  - specification に存在する feature を current browser support の証拠にしない

## W3C Internationalization — Styling vertical Chinese, Japanese, Korean and Mongolian text

- https://www.w3.org/International/articles/vertical-text/
- Type: current task-oriented implementation/status guidance
- Observe:
  - current browser interoperability for basic vertical flow
  - CJK upright / embedded Latin rotation
  - `sideways-*` と true vertical CJK の違い
  - current tate-chu-yoko support
  - form / list / table behavior
  - unsupported or partial browser behavior
- Useful for:
  - theory と current browser reality の差を確認する
  - Web artifact の fallback decision
- Current status observed 2026-09-13:
  - basic `vertical-rl` is described as interoperable across major engines
  - `text-combine-upright: all` is supported for explicitly marked short runs
  - automatic `digits <integer>` combining is still reported unsupported
  - vertical form basics work, while select-option presentation remains implementation-sensitive
- Avoid copying:
  - temporary browser workaround を timeless principle にしない

## W3C — Japanese Script Resources

- https://www.w3.org/TR/jpan-lreq/
- Type: current Japanese script resource index / requirements
- Observe:
  - writing mode and direction
  - vertical / horizontal differences
  - line breaking and punctuation
  - ruby / annotations
  - page layout and related tests/gaps
- Useful for:
  - current Japanese-language layout research entry point
  - implementation status と requirement documents の横断

## W3C — Japanese Gap Analysis

- https://www.w3.org/TR/jpan-gap/
- Type: current implementation-gap analysis
- Observe:
  - vertical text support gaps
  - mixed vertical/horizontal behavior
  - tate-chu-yoko and annotation limitations
  - forms/tables/interactive content where implementation may diverge
- Useful for:
  - target renderer capability gate
  - fallback / non-promotion decision
- Avoid copying:
  - current gap を permanent limitation として固定しない。実装時に status を再確認する

## W3C — Requirements for Japanese Text Layout (JLReq)

- https://www.w3.org/International/jlreq/
- Type: authoritative Japanese text-layout requirements / integrated reference
- Observe:
  - vertical and horizontal composition differences
  - basic page/text-area composition (character size, lines, columns, gaps, margins)
  - punctuation / brackets / symbols
  - ruby / annotations
  - headings, figures, tables, notes, running elements
  - page/spread reading relationships
- Useful for:
  - paragraph単位ではなく page/composition 単位で縦組みを考える
  - Japanese publishing convention を理解する
- Avoid copying:
  - example dimensions / historical production convention を universal magic number にしない

## Unicode — UAX #50: Unicode Vertical Text Layout

- https://www.unicode.org/reports/tr50/
- Current reviewed version: Unicode 17.0.0, UAX #50 Revision 33, dated 2025-07-24
- Type: Unicode Standard Annex
- Observe:
  - `Vertical_Orientation` defaults: upright / rotated / transformed variants
  - Han/Kana/Hangul vs Latin behavior
  - glyph changes required for vertical presentation
  - grapheme-cluster orientation
  - quotation marks / vertical alternates
- Useful for:
  - character-level default orientation
  - renderer/font fallback reasoning
- Important boundary:
  - UAX #50 explicitly treats these as stable defaults for interchange and allows higher-level protocols/layout decisions to override them. Do not treat the property as an editorial-style oracle.

## Adobe InDesign — Tate-chu-yoko in vertical text

- https://helpx.adobe.com/indesign/desktop/language-and-proofing/chinese-japanese-and-korean/apply-tate-chu-yoko-in-vertical-text.html
- Type: current production-tool guidance / implementation evidence
- Observe:
  - intended tate-chu-yoko use for short half-width runs
  - short numbers / dates / foreign text
  - difference between compact inline treatment and ordinary vertical glyph orientation
- Useful for:
  - production workflow evidence that tate-chu-yoko is a bounded typographic operation
- Avoid copying:
  - InDesign UI操作や設定値を design source of truth にしない

## Comparison axes

複数 reference を次の軸で比較する。

- principal writing mode
- inline progression
- column/block progression
- page/spread progression
- CJK glyph orientation
- Latin / number / symbol orientation
- punctuation / vertical alternates
- tate-chu-yoko granularity
- ruby / annotation placement
- column count / text-area rhythm
- mixed horizontal/vertical regions
- figure/table/caption relationship
- renderer/font capability
- fallback behavior

## Translation notes

- 仕様は semantic/rendering model の根拠、JLReq は publishing composition の根拠、Unicode は glyph-orientation default の根拠として使い分ける。
- current W3C browser-status guidance は実装可能性の evidence として使い、support 状態は実装時に再確認する。
- production tool guidance は実制作上の判断を補強するが、tool command を universal rule にしない。
- 特定出版社・書籍の版面、フォント、寸法、装飾を模倣せず、reading progression と relationship を抽出する。
