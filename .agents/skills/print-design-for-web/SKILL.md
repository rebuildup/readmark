---
name: print-design-for-web
description: >
  Use this skill when adapting a screen-first website or web application view for browser printing or PDF output,
  where interactive UI, page fragmentation, links, wide content, color simplification, and paged verification matter.
---

# Print Design for Web

screen-first な Web artifact を、そのまま縮小・スクリーンショット化するのではなく、**interaction のない paged medium へ意味を保ったまま翻訳する**。

対象は browser print / print-to-PDF である。最初から report / book / handout として paginated artifact を設計する場合は `document-design` を使う。

CSS property や browser API は実装手段であり、design decision の source of truth にしない。

## Workflow

1. 現在の page / view で、印刷時に残す情報と screen-only interaction を分ける。
2. 下記 reference を開き、paged-media、fragmentation、print color adjustment、production implementation を比較する。
3. continuous viewport から page sequence へ変わることで失われる context を特定する。
4. content hierarchy を維持しつつ、navigation / controls / transient state / decorative treatment を print 用に削除・置換・簡略化する。
5. heading、figure、caption、table、code、URL 等の break / overflow policy を決める。
6. print preview と実際の PDF または印刷結果を page-by-page で検証する。

## Observe

reference と current artifact では次を見る。

- **print purpose**: 保存、申請控え、receipt、reference、reading、sharing のどれか
- **content survival**: 印刷後も task / meaning に必要な情報は何か
- **screen-only UI**: global nav、menu、button、filter、pagination control、tooltip、sticky action 等が紙面で意味を持つか
- **interaction replacement**: collapsed content、selected state、URL destination、dynamic result を静的表現へ置き換える必要があるか
- **page architecture**: paper size、orientation、margin、content measure、page sequence
- **fragmentation**: heading/body、figure/caption、label/value、table header/row、code block がどこで分割されるか
- **wide / monolithic content**: tables、pre/code、charts、images、long URL、fixed-width regions が page box を超えないか
- **link meaning**: underline だけでなく、紙面上で destination/context が必要か
- **color dependence**: background fill、status color、zebra stripe、chart cue が printer / user-agent adjustment 後も意味を保つか
- **density**: screen spacing や large navigation chrome が不要な page count を増やしていないか
- **repetition**: repeated header/footer が paper navigation に役立つか、単なる screen chrome の複製になっていないか
- **output variance**: paper/PDF、browser、background printing setting が変わっても critical meaning が残るか

## Decision rules

### 1. Print is a different representation, not another breakpoint

print を mobile breakpoint の延長として扱わない。

screen では viewport 内を scroll できるが、print では content が discrete page boxes に fragmentation される。sticky / fixed / overlay / scroll container の意味も変わる。

viewport width を縮めるだけで済ませず、**page sequence と non-interactive delivery** を別条件として設計する。

### 2. Remove interaction chrome, preserve task evidence

印刷後に操作できない control は、原則としてその control 自体を残さない。

ただし control が示していた state / result が task evidence なら、その意味は静的表現へ変換して残す。

例:

- selected filter button → 「Filter: …」の summary
- collapsed disclosure → 印刷目的に必要なら内容を展開
- pagination controls → 非表示。ただし page 内に欠落した data がないか確認
- primary action / floating CTA → 非表示
- confirmation result / reference number → 残す

「button を消したから完了」ではなく、その UI が持っていた情報まで消えていないか確認する。

### 3. Preserve semantic relationships across page breaks

page break は見た目だけの問題ではない。

意味的に強く結び付く要素は、可能な範囲で同じ page / adjacent page に保つ。

優先して確認する:

- heading と直後の content
- figure と caption / legend
- term / label と value
- table header と rows
- list marker と item body
- warning / status heading と説明
- code example とその導入文

全要素へ無差別に `avoid` 相当の keep-together を適用しない。大きな block が page に収まらない場合、過剰な keep-together は空白や overflow を生む。

### 4. Treat fragmentation as negotiation, not exact pagination

browser print は printer setting、font metrics、paper size、browser implementation で pagination が変わり得る。

特定ページ番号へ arbitrary に content を押し込むより、break opportunity と relationship を設計する。

- semantic section boundary では明示的 page break が有効な場合がある
- heading の直後で break しにくくする
- paragraph の極端な widow / orphan を避ける
- oversized content は keep-together より split / scale / alternate representation を検討する

### 5. Make links useful without interaction

Web 上では link text と pointer behavior だけで destination を辿れるが、紙では辿れない。

印刷目的に応じて:

- URL 自体が後で必要なら destination を text として露出する
- long tracking URL / implementation URL を無差別に本文へ展開しない
- navigation-only links は削除する
- document内参照は見出し名など静的に理解できる context を残す

すべての link の後ろへ URL を機械的に出力することを universal rule にしない。

### 6. Let print simplify color unless color itself carries necessary meaning

printer / browser は ink 節約等のため background や color を変更できる。

その前提で:

- body text / boundary / state を subtle background だけに依存させない
- dark surface をそのまま大量印刷することを既定にしない
- background fill が消えても grouping / hierarchy が壊れない構造を作る
- exact color が意味上必要な局所要素だけ、明示的な print fidelity を検討する

`print-color-adjust: exact` 相当を root / page 全体へ blanket に適用しない。user preference は author fidelity より優先され得る。

### 7. Recompose wide content instead of clipping it

screen の horizontal scroll を print へ持ち込めない。

wide table / chart / code / image は、目的に応じて:

- column reduction / lower-priority column removal
- alternate summary
- page orientation change
- controlled scaling
- line wrap / code continuation
- multi-page table with repeated context

を選ぶ。

「幅に入れるため unreadably small に縮小」も「右端を切る」も避ける。

### 8. Keep production implementation as evidence, not a template

GOV.UK Frontend のような production source からは、print で link destination を補う、screen-only component を隠す、colored surface を transparent/currentColor へ簡略化する等の**判断パターン**を観察する。

class 名、exact color、font、spacing、component-specific selector をそのまま current project へコピーしない。

## Responsibility boundaries

- `document-design`: 最初から paginated document として hierarchy / page architecture / export semantics を設計する
- `responsive-design`: viewport / container / zoom に対する continuous layout adaptation を設計する
- `content-design`: wording、information order、label/link text を設計する
- `color-system`: screen を含む project-wide semantic color roles を設計する
- `table-design`: table 自体の comparison / lookup / grid behavior を設計する
- `print-design-for-web`: **screen-first Web artifact を paged / non-interactive representation へ変換する**

## References

詳細 observation と direct URL は [`references/print.md`](./references/print.md) を読む。

最低限、W3C Paged Media / Fragmentation / Color Adjustment と、production implementation を比較してから current artifact へ翻訳する。

## Avoid

- screen screenshot をそのまま印刷版とみなす
- print を narrow responsive breakpoint と同一視する
- global nav / CTA / sticky controls を意味なく紙面へ残す
- interactive control を消す際、その control が表していた current state / result まで消す
- heading と直後の本文、figure と caption を不用意に分離する
-すべての block を keep-together にして巨大な空白や overflow を作る
- long URL を無差別に展開して本文 rhythm を壊す
- screen background / gradient / shadow が必ず印刷されると仮定する
- exact color preservation を全ページへ強制する
- wide content を unreadable な縮小か clipping だけで処理する
- print CSS property catalog を Skill の中心にする

## Verify

### Print preview

少なくとも以下を print preview で確認する。

- first / middle / last page
- section boundary
- heading が page bottom に孤立していない
- figure と caption / legend が意味的に分離していない
- table header / row context が失われていない
- code / URL / table / image が page edge で clip していない
- hidden UI によって必要情報が欠落していない
- screen-only navigation / CTA / overlays が不要に残っていない
- body/background が printer-friendly でも hierarchy を維持している

### Output artifact

print-to-PDF または physical print の representative pages を実際に見る。

- browser preview だけでなく final output の page count / break positions を確認する
- background printing on/off で critical meaning が失われないか確認する
- common paper size と、必要なら alternate paper size/orientation を確認する
- grayscale / low-color output でも status / grouping / chart meaning が壊れないか確認する
- long realistic content、wide table、long URL、image、code 等を含む stress sample を使う

source CSS が valid、build が green、screen view が正しいだけでは完了にしない。

## Current status

Experimental initial skill. Real screen-first page → print/PDF trial と page-by-page inspection 後に fragmentation / interaction-replacement policy を refinement する。

Last reviewed: 2026-09-12
