---
name: album-cover-design
description: >
  Design primary artwork for a music single, EP, or album as a persistent release identity across
  library, browse, now-playing, campaign, and physical contexts. Use when the task requires a cover
  proposition, image/type relationship, small-to-large scale behavior, release-family continuity,
  and final delivered-artwork verification rather than a genre preset or upload-spec checklist.
---

# Album Cover Design

音楽リリースの cover を、単なる「正方形の poster」ではなく、**release identity の persistent anchor** として設計する。

**Release truth → Cover proposition → Representation → Scale behavior → Family relationship → Delivery verification**

style 名や genre stereotype から先に作らず、その release が何であり、何を視覚的に記憶させるべきかから始める。

## When to use

対象:

- single / EP / album の primary cover artwork
- deluxe / anniversary / reissue で既存 identity との関係を再設計する場合
- singles → album の artwork family を設計する場合
- digital release と physical / campaign derivative の共通 visual source を定める場合
- streaming library / browse / now-playing で同じ artwork が複数scaleに現れる場合

対象外:

- video thumbnail の click / browse hypothesis 最適化
- full campaign / key visual system 全体
- poster の viewing-distance hierarchy
- vinyl / CD package 全面の editorial / prepress設計
- music promo video の timing / excerpt / rollout
- genre 名だけから色・写真・typeを決める style recipe

## Workflow

1. release の事実と関係を整理する。
2. current platform constraint と、異なる cover grammar を持つ reference を実際に開く。
3. reference を下記 observation axes で比較する。
4. 一つの dominant cover proposition を言語化する。
5. image / type / artist presence / symbol / material の ownership を決める。
6. small browse と large display の両方で成立する構造へ翻訳する。
7. singles / album / deluxe 等の family がある場合、保持するものと変えるものを明示する。
8. platform context と derivative context で render する。
9. 最終 raster / delivered artwork を確認して完了判定する。

## Observe

reference を「好み」で見るのではなく、以下を観察する。

### Release truth

- single / EP / album / compilation / reissue のどれか
- artist / project identity は既知か、新規か
- title / concept / recurring theme は何か
- adjacent release とどの程度 continuity が必要か
- portrait や人物 likeness が本当に release identity を担うか
- archive / found image / illustration / type / symbol の権利と出典は明確か

### Cover proposition

一枚で何を記憶させるのかを見る。

例:

- 一人の artist / character / presence
- 一つの object / symbol / scene
- 一つの photographic situation
- 一つの typographic proposition
- 一つの abstract / systemic relationship
- 一つの material / production gesture

全曲の意味を一枚へ列挙しない。

### Representation mode

- portrait / performance image
- documentary / source photography
- staged photography
- illustration
- object / symbol
- abstraction / geometric system
- typography-led
- archive / found material
- physical-process-led image

どの mode が優れているかではなく、その release の identity を何が担っているかを見る。

### Image / type relationship

- artist name / release title が artwork 内に必要か
- platform metadata がすでに何を表示するか
- type は identification、concept、structure のどれを担うか
- image と type のどちらが dominant か
- type を除いても cover が識別できるか、または type 自体が mark か
- long / multilingual title でも hierarchy が壊れないか

text を必須にも禁止にもしない。

### Small / large scale

- 小さな library tile で残る silhouette / focal relation
- subject が潰れたときにも残る大きな shape / contrast relationship
- large now-playing / editorial view で初めて読める secondary detail
- texture / grain / halftone / fine type が縮小・圧縮でどう変化するか
- artwork 周囲の title / artist / explicit badge / platform chrome と競合しないか

small-size 対応を「detail を全部消す」ことと混同しない。primary read と secondary discovery の階層を作る。

### Family continuity

singles / album / deluxe / anniversary / campaign がある場合:

- retained property
- changed property
- change reason

を明示する。

保持候補:

- image treatment
- crop logic
- type system
- recurring mark / motif
- material/process
- palette relationship
- framing / composition grammar

全 artwork を template clone にしない。

### Medium translation

primary cover と次を区別する。

- streaming cover
- physical sleeve / package
- poster / OOH
- social / campaign graphic
- motion / visualizer
- merch

同一 artwork の単純貼り付けではなく、**concept を medium に翻訳する**。

physical process が concept を担う場合でも、digital cover ではその意味が一枚の raster で読めるか確認する。

## References

runtime の詳細 reference と観察ポイントは [references/album-cover-design.md](./references/album-cover-design.md) を読む。

最初に current platform source を確認し、その後、少なくとも materially different な canonical / production reference を複数比較する。

## Decision rules

### Release before style

genre 名、artist の既存 aesthetic、trend keyword だけから cover grammar を決めない。

まず:

- release の title / concept
- artist/project identity
- previous / adjacent artwork
- audience familiarity
- required deliverables

を確認する。

### One dominant proposition

front cover で複数の competing concept を同格にしない。

「曲数が多いから visual motif も多数必要」とは限らない。
一つの cover proposition が full release を represent できるかを優先する。

### Text is a role, not a requirement

artist / title text は次のいずれかなら artwork 内に置く意味がある。

- identification 自体を担う
- typographic form が concept の主要部分である
- physical / off-platform context で metadata がない
- release-family system を成立させる

platform metadata が十分で、image/symbol が identity を担うなら text を省くことも valid。

### Make two scales intentional

少なくとも次を別々に見る。

- **small read** — library / search / browse で識別できる構造
- **large read** — now-playing / editorial / physical で得られる detail / texture / secondary information

authoring canvas の full-size view だけで判断しない。

### Preserve truth

cover は release の permanent metadata-adjacent asset として扱う。

次を勝手に追加しない。

- 関与していない artist / celebrity
- unrelated brand / retailer
- false edition / date / pricing claim
- release に合わない explicit/advisory implication
- rights が不明な image / logo / artwork

platform-specific 禁止事項は current source で再確認する。

### Separate master from derivatives

primary cover は family の source になり得るが、poster / promo video / social graphic / physical package の完成形ではない。

各 medium で:

- viewing distance
- metadata availability
- crop / aspect
- time dimension
- physical material

が変わるなら recompose / extend する。

### Family means recognition plus distinction

series continuity は同じ layout を複製することではない。

同じ family と読める retained property と、各 release を区別する changed property の両方を持たせる。

## Avoid

- genre stereotype をそのまま palette / font / image recipe にする
- streaming の minimum pixel spec を design quality とみなす
- poster を正方形へ crop しただけで cover とする
- platform metadata と同じ artist/title を理由なく巨大に重複させる
- detail を詰め込み、small size で primary read が消える
- small size 対策として全 detail / personality を削除する
- 一つの creator / label / era の vocabulary を album-cover 一般則にする
- singles / album を完全 clone して区別不能にする
- family continuity のために release concept の違いを消す
- physical trick が digital raster では意味を失うのに、そのまま cover master にする
- mockup の vinyl texture / shadow / room scene だけを見て artwork 本体を評価する
- source file の見た目だけ確認し、final raster / compression を見ない

## Responsibility boundaries

### `album-cover-design`

所有するもの:

- music release の primary artwork proposition
- release truth と visual identity の対応
- image / type / symbol / artist-presence relationship
- small / large scale behavior
- release-family continuity
- primary cover と derivative の境界
- cover-specific final verification

### `thumbnail-design`

video / content の browse preview として、viewer expectation、selection hypothesis、variant testing を扱う。

album cover は release の persistent identity であり、CTR 最大化を主目的にしない。

### `music-promo-video`

release phase、audio excerpt、reveal budget、campaign asset family、time-based playback を扱う。

### `key-visual-design`

複数 artifact class をまたぐ campaign/title visual language の source を扱う。

### `poster-design`

large standalone surface、viewing distance、event/information hierarchy を扱う。

### typography Skills

`typesetting` / `font-mixing` / `numeric-typography` は detailed type composition を所有する。
この Skill は artwork 全体の中で type が何の役割を持つかだけを決める。

## Verify

最低限、**最終 artwork file** を次の順で確認する。

### 1. Truth check

- artist / project / title / release state が正しい
- artwork が別 artist / product / edition を誤認させない
- image / illustration / mark の rights/source が確認できる
- platform policy 上の prohibited metadata を不用意に入れていない

### 2. Small browse render

実際の小さな square tile 相当で表示する。

確認:

- dominant subject / shape が読める
- cover 同士を並べても識別できる
- fine type / texture が accidental noise になっていない
- title / artist metadata を周囲に置いた card context でも hierarchy が崩れない

### 3. Large display render

large now-playing / editorial 相当で確認する。

- low-resolution source / unintended blur / bad crop が露出しない
- detail がただの decoration ではなく concept を補強する
- intended texture / processing が破綻しない

### 4. Family comparison

family がある場合、最低3点または存在する全 relevant release を並べる。

- family recognition がある
- individual release differentiation がある
- accidental template drift / unrelated style drift がない

### 5. Derivative test

少なくとも一つ、実際に必要な別 context に置く。

例:

- physical front sleeve
- campaign/poster crop
- social announce
- motion opening frame

primary artwork をそのまま貼るのではなく、何を保持し何を変えたか確認する。

### 6. Final raster / color / compression

- required aspect / dimensions / color space を current target で確認する
- export 後に edge / gradient / grain / fine type / banding / compression を見る
- mockup ではなく uploaded/delivered file 自体を確認する

### 7. Materially different alternative

cover proposition が自明でない場合、minor cosmetic variants ではなく、少なくとも2つの materially different な案を比較する。

変える候補:

- artist presence vs indirect symbol
- photography vs type-led structure
- single focal object vs systemic abstraction
- title ownership
- crop / scale relationship

比較理由を release truth と desired identity に戻して決める。

## Promotion gate

この Skill を first-class / promoted と扱う前に、実際の release brief / audio-context / approved assets を使った trial を行う。

trial では最低限:

- release truth / proposition を記録
- materially different な2案以上を比較
- small + large render
- metadata/chrome context
- family がある場合は family comparison
- derivative 1種以上
- final delivered raster inspection

を実施し、失敗点と修正を Issue / PR に durable に残す。
