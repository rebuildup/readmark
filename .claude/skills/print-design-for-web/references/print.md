# Print Design References

Last reviewed: 2026-09-12

この reference は browser print / print-to-PDF の design decision を裏付けるために使う。

仕様の property をそのまま recipe にせず、**continuous screen → fragmented pages / interactive → static / author color → printer or user adjusted color** の変換を観察する。

## Paged media / page architecture

- [W3C — CSS Paged Media Module Level 3](https://www.w3.org/TR/css-page-3/)
  - Observe: page box、page area、page margins、size / orientation、named pages、page selectors、page-margin boxes
  - Useful for: viewport ではなく page sequence として output architecture を考える
  - Trade-off: specification feature と current browser interoperability を同一視しない
  - Avoid copying: fixed paper size / margin values を project-independent default にしない

- [MDN — Printing](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing)
  - Observe: `print` media、`@page`、screen-only content の removal、print request handling
  - Useful for: current browser-facing implementation surface を確認する
  - Boundary: MDN の code example を design rule とみなさず、何を print representation に残すかを先に決める

## Fragmentation / break relationships

- [W3C — CSS Fragmentation Module Level 3](https://www.w3.org/TR/css-break-3/)
  - Observe: break-before / after / inside、forced vs avoided breaks、widows / orphans、monolithic content、fragmentation constraints
  - Useful for: heading/body、figure/caption、table rows、large blocks の page-break policy
  - Key point: `avoid` は絶対保証ではなく fragmentation algorithm 内の preference。forced break は別の意味を持つ
  - Failure to watch: oversized keep-together block、scroll/overflow content、replaced elements が page box を超える

## Printer / user-agent color adaptation

- [W3C — CSS Color Adjustment Module Level 1](https://www.w3.org/TR/css-color-adjust-1/)
  - Observe: `print-color-adjust` の `economy` / `exact`、user preference の優先、background/color の printer-oriented adjustment
  - Useful for: screen color fidelity と printer economy の trade-off
  - Key point: `exact` は semantic importance がある局所的 treatment の hint。page 全体を screen appearance に固定するための universal switch ではない
  - Failure to watch: background fill が消えただけで grouping / state / readability が崩れる design

## Advanced paged-media evidence

- [W3C — CSS Generated Content for Paged Media Module](https://www.w3.org/TR/css-gcpm-3/)
  - Status: Working Draft; implementation support must be checked before relying on a feature
  - Observe: running heads / footers、footnotes、cross-reference / generated paged navigation concepts
  - Useful for: paged medium が screen とは異なる navigation / repeated-context needs を持つことを理解する
  - Do not universalize: draft-only mechanisms or renderer-specific support

## Production implementation — GOV.UK Frontend

GOV.UK Frontend は screen styles をそのまま print せず、component / role ごとに print behavior を調整している。exact selectors / values ではなく判断を観察する。

- [GOV.UK Frontend — print-friendly links](https://github.com/alphagov/govuk-frontend/blob/main/packages/govuk-frontend/src/govuk/helpers/_links.scss)
  - Observe: screen では辿れる link destination を print でどう補うか
  - Useful for: printed link context
  - Avoid copying: every URL を機械的に露出する rule。current content / URL length / print purpose で判断する

- [GOV.UK Frontend — typography print handling](https://github.com/alphagov/govuk-frontend/blob/main/packages/govuk-frontend/src/govuk/helpers/_typography.scss)
  - Observe: print environment で type treatment を screen と分けること
  - Useful for: screen font assumptions を紙へ固定しない判断
  - Avoid copying: GOV.UK 固有 font stack / exact point sizes

- [GOV.UK Frontend — functional colours](https://github.com/alphagov/govuk-frontend/blob/main/packages/govuk-frontend/src/govuk/custom-properties/_functional-colours.mixin.scss)
  - Observe: print text / border / input colors を semantic role として調整すること
  - Useful for: ink economy と readable monochrome-like output
  - Avoid copying: GOV.UK palette values

- [GOV.UK Frontend — panel component print treatment](https://github.com/alphagov/govuk-frontend/blob/main/packages/govuk-frontend/src/govuk/components/panel/_mixin.scss)
  - Observe: colored surface を print で transparent / currentColor ベースへ簡略化しても hierarchy を残す方法
  - Useful for: confirmation / status surface adaptation
  - Failure to watch: background を消した結果、status block の境界まで消えること

- [GOV.UK Frontend — Exit this page print treatment](https://github.com/alphagov/govuk-frontend/blob/main/packages/govuk-frontend/src/govuk/components/exit-this-page/_mixin.scss)
  - Observe: screen interaction としてのみ意味がある urgent control を print では残さない判断
  - Useful for: screen-only control removal
  - Boundary: control を非表示にする際、印刷物に必要な safety / status information 自体まで消さない

## Compare across references

複数 reference を開いたら、少なくとも次を比較する。

| Axis | Questions |
| --- | --- |
| Output model | continuous scroll から page boxes へ何が変わるか |
| Interaction | 操作不能になる control / state を消すか、静的意味へ置換するか |
| Fragmentation | 何を一緒に保ち、何は分割を許すか |
| Wide content | horizontal scroll の代わりに何をするか |
| Links | clickable destination を紙面でどう理解可能にするか |
| Color | background / accent が省略・変更されても意味が残るか |
| Repetition | repeated header/footer が print navigation に必要か |
| Verification | browser preview と final PDF/physical output の差をどう確認するか |

## Translation guardrails

- specification の existence を browser support の証拠にしない
- one production system の class / font / spacing / color value を universalize しない
- paper fidelity より current project の print purpose を優先する
- exact page count を arbitrary に固定しない
- screen UI を全部消すことを print optimization と同一視しない
- print/PDF artifact を raster/page view で inspection せず completion としない
