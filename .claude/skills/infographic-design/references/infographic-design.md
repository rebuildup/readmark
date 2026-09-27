# Infographic Design References

Last reviewed: 2026-09-15

この file は infographic の visual style catalog ではなく、説明構造・representation assignment・source truth・accessibility を比較する runtime reference として使う。

## Primary / official communication guidance

- [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/)
  - Observe: chart / graph / diagram の essential information を short alt text だけに押し込まず、structured text / long description と組み合わせる考え方
  - Useful for: complex infographic の non-visual equivalent と reading order
  - Avoid copying: example の specific chart structure。content に必要な equivalent を設計する
  - Status: page updated 2026-04-08

- [CDC — Visual Communication Resources](https://www.cdc.gov/health-literacy/php/develop-materials/visual-communication.html)
  - Observe: visual が main message を支え、heading / label / caption と組み合わされること、visual は単独で一意に解釈されるとは限らないこと
  - Useful for: public-facing explanation、health / numeracy-sensitive communication
  - Avoid copying: health-domain imageryを一般 artifact の style にすること

- [CDC — Clear Communication Index](https://www.cdc.gov/ccindex/widget.html)
  - Observe: words と visuals が同じ main message を reinforce すること、visual overload を避けること、caption/label と action の関係
  - Useful for: infographic が communication outcome を持つか確認するとき
  - Avoid copying: checklist score を visual quality の代理にすること

- [CDC — Global Health Protection Infographics](https://www.cdc.gov/global-health-protection/php/resources/infographics.html)
  - Observe: Snapshot / By the Numbers など、同じ組織でも communication job に応じて artifact を分けること
  - Useful for: current public-health production artifact と downloadable delivery の確認
  - Avoid copying: CDC brand / exact layout / color
  - Current page date: 2026-02-12

- [GOV.UK publishing guidance — Images / Infographics](https://guidance.publishing.service.gov.uk/formatting-content/images/)
  - Observe: infographic が data / chart / text / process overview を含む complex image になり得ること、magnification で全体理解が崩れる risk、plain-text equivalent の必要性
  - Useful for: Web delivery / zoom / accessible alternative の判断
  - Avoid copying: SVG を使えば accessibility が自動的に解決すると解釈すること

- [ONS — Data visualisation guidance](https://service-manual.ons.gov.uk/data-visualisation/guidance)
  - Observe: chart text / annotation / axis / ordering / accessibility を個別に扱い、advanced/interactive form は必要性から選ぶこと
  - Useful for: infographic 内の quantitative representation を `data-visualization` へ委譲するとき
  - Avoid copying: ONS chart styling を infographic 全体へ拡張すること

- [IBM Design Language — Infograms](https://www.ibm.com/design/language/infographics/infograms/)
  - Observe: small-space information graphic と full chart の責務差、real data と pictogram-like expression の境界、data accuracy を visual grid より優先する例
  - Useful for: key statistic / marginal data graphic の role を考えるとき
  - Avoid copying: IBM 固有の grid / type / color / chart family を universal rule にすること

## Production systems

- [Pentagram — RAND Art + Data](https://www.pentagram.com/work/rand-art-data)
  - Observe: mental health / connected body / income inequality という異なる evidence を、2D infographic / animation / physical data sculpture へ別々に翻訳していること
  - Useful for: one visual grammar を全 topic に強制せず、claim と evidence に representation を合わせる比較
  - Avoid copying: brain-wave metaphor、material、Giorgia Lupi 固有の expression

- [Pentagram — Deloitte Insights](https://www.pentagram.com/work/deloitte-insights)
  - Observe: publication system 内で standard chart と custom infographic template を併存させ、情報の種類に応じて visual model を変えること
  - Useful for: repeatable infographic family、template と semantic variation の境界
  - Avoid copying: ledger-inspired grid、brand typography、exact template styling

- [Pentagram — The Room of Change](https://www.pentagram.com/work/the-room-of-change)
  - Observe: macro topic → pattern → granular story、panoramic overview と detail、legend を使った dense information navigation
  - Useful for: overview/detail、multi-scale reading、dense long-form information graphics
  - Avoid copying: tapestry/pattern language を infographic の一般形にすること

- [Pentagram — Science Stack: Tools Within Reach](https://www.pentagram.com/work/science-stack-tools-within-reach)
  - Observe: 24 cards を category と specific feature で整理し、collection overview と item-level detail を同じ interactive infographic に共存させる構造
  - Useful for: taxonomy / collection / card-like unit を持つ explanatory infographic
  - Avoid copying: card layout をあらゆる infographic の default にすること

## Comparison notes

### What repeats

- infographic の価値は「visual が多いこと」ではなく、複雑な explanation を reader が扱える unit と path に変換することにある。
- representation は interchangeable ではない。quantitative comparison、relationship/process、spatial relation、concrete scenario、caveat はそれぞれ異なる carrier が向く。
- visual と prose は競合させず、互いに不足する information を補う。
- source/evidence と visual story の距離が大きくなるほど誤読 risk が増える。
- complex infographic は final visual だけでなく equivalent text / underlying data まで delivery system として設計する必要がある。

### Material differences

- CDC は public-health comprehension / action と plain communication を強く優先する。
- GOV.UK は complex image の magnification / non-visual access failure を強く警戒する。
- IBM Infograms は small-space single-data snapshots の system であり、long explanatory infographic とは異なる。
- RAND Art + Data は topic ごとに representation medium 自体を変える。
- Deloitte Insights は repeatable publication template family を重視する。
- The Room of Change は panoramic/dense overview → granular detail を扱う。
- Science Stack は collection/taxonomy exploration を interactive card units で扱う。

この差分から、vertical canvas、big number、icon row、card grid、illustration、data-art のいずれも universal infographic grammar としない。

## Failure signals to inspect

- visual story が source evidence より強い causality / magnitude を暗示する
- chart/diagram/map の semantic rules が composition のために崩れている
- text と visual が同じ情報を重複し、artifact が長くなるだけ
- decorative icons の個数・面積・位置が quantitative encoding に見える
- every section が同じ template で、情報関係の違いが消える
- source / unit / period / uncertainty が遠すぎる、または読めない
- zoom すると全体構造が失われ、代替の logical text path もない
- single raster image だけが delivery され、essential text/data へ別経路で到達できない
- final artifact ではなく authoring canvas の見た目だけで QA が終わる
