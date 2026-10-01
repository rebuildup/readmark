---
name: slide-design
description: >
  Use this skill when designing presentation decks or slide-based visual narratives that must communicate
  clearly at presentation distance, preserve a coherent story across slides, and survive export or projection.
---

# Slide Design

presentation / lecture / pitch / keynote 等の slide deck を、単なる「ページの集合」ではなく**時間順に提示される visual narrative**として設計する。

PowerPoint / Google Slides / Keynote / PPTX / PDF は renderer / delivery format であり、design decision の source of truth にはしない。

## Workflow

1. audience、purpose、presentation time、live presentation / async reading のどちらかを確認する。
2. deck 全体を section / claim / evidence / transition に分け、各 slide の役割を決める。
3. 下記 reference を開き、message density、visual hierarchy、layout variation、brand consistency を比較する。
4. 1枚に複数の独立主張を詰めず、主張・根拠・visual の関係を明確にする。
5. template の見た目をコピーせず、current brand / content / delivery environment へ翻訳する。
6. slideshow / exported PDF / target display で最終成果物を確認する。

## Observe

- deck sequence: introduction → development → evidence → conclusion の流れ
- slide role: title / section / claim / comparison / process / chart / quote / demo / summary
- focal hierarchy: 最初にどこを見るか、次に何へ視線が移るか
- text density: presenter が話す内容と slide 上に残す内容の分離
- distance readability: title / body / labels が実際の表示距離で読めるか
- visual routing: image / diagram / chart が message を補強しているか
- repetition and variation: grid / type / color / footer は一貫し、構成は内容に応じて変化するか
- continuity: consecutive slides 間で位置・scale・narrative の変化が理解を助けるか
- accessibility: unique title、reading order、contrast、non-color cues、alt text
- delivery robustness: different machine / projector / PDF export でも崩れないか

## Decision rules

- **live presentation** では audience が presenter を聞けるよう、slide を原稿にしない。短い文・visual cue・必要な証拠を優先する。
- **async / handout-like deck** では、speaker 不在でも claim と evidence の関係が復元できる情報量を残す。
- chart / diagram / image は「空きを埋める装飾」ではなく、文章より速く理解できるときに使う。
- template は consistency を得るために使い、すべての slide を同じ composition に固定しない。
- slide transition / animation は message progression を明確にするときだけ使う。motion 自体の設計は `motion-system` を優先する。

## References

- [Microsoft — Tips for creating and delivering an effective presentation](https://support.microsoft.com/en-us/powerpoint/tips-for-creating-and-delivering-an-effective-presentation)
  - Observe: distance readability, text量、visual の役割、background consistency、projection constraints
  - Useful for: live presentation の基本的な information density 判断
- [Microsoft — Make your PowerPoint presentations accessible](https://support.microsoft.com/en-us/accessibility/powerpoint/make-your-powerpoint-presentations-accessible-to-people-with-disabilities)
  - Observe: unique titles, reading order, contrast, color redundancy, alt text, accessible layouts
  - Useful for: slide structure と export 前 accessibility review
- [GitHub Brand — Presentations](https://brand.github.com/brand-in-action/presentations)
  - Observe: brand system を slide master / layout family / image treatment にどう展開しているか
  - Useful for: branded presentation system
- [MIT Brand Guide — Templates](https://brand.mit.edu/applying-brand/templates)
  - Observe: title / section / columns / charts / photo layouts を一つの system として用意する方法
  - Useful for: reusable deck template family
- [IBM Design Language — Layout](https://www.ibm.com/design/language/layout/overview/)
  - Observe: hierarchy, negative space, systematic alignment, asymmetry, repetition
  - Useful for: slide composition を arbitrary placement にしないための layout reference

## Avoid

- slide を speaker notes の全文コピーにする
- 1枚に独立した複数主張を押し込み、visual focus を失う
- every slide を card / panel の集合にする
- decorative stock image や icon を information substitute として置く
- template 固有の色・フォント・装飾を current brand と無関係に複製する
- source が編集できることだけを確認して、実際の slideshow / export を見ない

## Verify

- slide sorter で title だけを追い、deck の argument / story が復元できるか確認する。
- slideshow を実サイズで再生し、最も遠い想定閲覧距離で主要情報が読めるか確認する。
- representative slides を画像化し、alignment / overflow / crop / density / contrast を目視確認する。
- PDF 等へ export し、font substitution、line wrap、image crop、missing asset、reading order を確認する。
- live deck なら実際に通して発表し、slide 上の情報量が presenter の説明と競合していないか確認する。

## Current status

Experimental initial skill. Real-project trial 後に slide density / narrative / handout boundary を refinement する。

Last reviewed: 2026-09-12
