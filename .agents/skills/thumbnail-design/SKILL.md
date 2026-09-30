---
name: thumbnail-design
description: >
  Design small browse-preview artwork for video and media content when the viewer must quickly recognize what the content is, form an accurate expectation, and decide whether to open it. Use this skill for thumbnail proposition, small-size hierarchy, crop/variant strategy, title-metadata complementarity, and in-context browse verification rather than clickbait recipes or upload-spec tutorials.
---

# Thumbnail Design

Last reviewed: 2026-09-14

thumbnail は poster の縮小版でも、動画から適当に抜いた1 frameでもない。

**Content truth → Browse job → Preview proposition → Small-size composition → Surface adaptation → Variant test → In-context verification**

閲覧者が一覧・検索・推薦面で短時間に判断するとき、何の content かを識別し、何を期待してよいかを誤解なく伝えるための preview artwork として設計する。

## When to use

対象:

- video / VOD / stream archive の custom thumbnail
- episode / series / course / tutorial の browse preview
- content library / media catalog の preview artwork
- key art から thumbnail derivative を作る場合
- 同じ content に複数 thumbnail variant を用意して比較する場合
- desktop / mobile / TV / embedded card など複数 browse surface へ適応する場合

対象外:

- 独立して鑑賞される poster / key visual の設計全般
- time-based promotional video の hook / proof / CTA 構成
- recommendation algorithm / media buying / ranking implementation
- platform upload API / encoder tutorial
- creator 固有の clickbait style の模倣

## Workflow

1. **Inspect content truth**
   - 実際の内容、主要人物・対象、出来事、成果、tone、source assetsを確認する。
   - thumbnail で約束してはいけないものを先に除外する。
2. **Inspect browse context**
   - thumbnail が単独で見えるのか、title / channel / duration / badge / metadata と並ぶのか確認する。
   - target surface の実表示サイズ・crop・overlayを確認する。
3. **Choose one preview proposition**
   - 「この content を開くと何を見られるか」を1つの dominant visual proposition に絞る。
4. **Compose for small-size recognition**
   - focal subject、scale、crop、contrast、negative space、必要最小限のtext/logoを決める。
5. **Adapt, do not merely crop**
   - materially different な canvas / orientation / overlay 条件では derivative を recomposeする。
6. **Create variants only when they test a hypothesis**
   - subject、crop、layout、text ownership、background、emphasis など意味のある差を持たせる。
7. **Verify in the delivered browse context**
   - naked image ではなく card / feed / search / TV row 等の実サイズで比較する。
   - 利用可能なら downstream engagement まで確認する。

## Observe

reference を開くときは以下を見る。

### Content truth / proposition

- thumbnail が示している人物・対象・結果・状況は実 content に存在するか
- content の中心と thumbnail の中心が一致しているか
- curiosity を作っていても、実際には起きない出来事を暗示していないか
- tone / genre / difficulty / outcome の期待を過度に変えていないか
- frame grab のままで十分か、purpose-built artwork が必要か

**attention と accuracy は対立軸として放置しない。**
thumbnail が強くても、その promise と content が一致しなければ成功扱いしない。

### Browse context

- title / channel / episode number / duration / badge / progress / status が周囲に既に表示されるか
- thumbnail 内の text が metadata と重複していないか
- platform chrome が四隅や下辺を覆わないか
- grid 内で近接する他 thumbnail と識別できるか
- standalone embed と browse card で必要な情報量が変わるか

thumbnail 単体で全情報を背負わせない。

### Focal hierarchy

- 最初に識別される subject は何か
- subject の silhouette / face / object / UI / result が small size でも分かるか
- background detail が subject と競合していないか
- crop によって重要な action / expression / relationship が失われていないか
- negative space は text/logo のためか、それとも単に情報が弱いだけか

face を universal rule にしない。人物の表情が content proposition を担う場合にのみ強い evidence になる。

### Text / logo ownership

text を入れる前に、以下を確認する。

- surrounding title だけで意味が成立するか
- thumbnail text は title の繰り返しか、新しい visual evidence / framing を追加するか
- small size で読めない text を decoration として残していないか
- logo / series mark は recognition を助けるか、focal subject と競合するか
- localized title や long text が必要なら derivative / alternate layout が必要か

**thumbnail text は short であること自体が目的ではない。**
役割がなければ0文字でもよい。

### Crop / canvas adaptation

- landscape / portrait / square / platform-specific crop で何を保持するか
- safe focal region はどこか
- crop 後に subject relationship が変わらないか
- title/logoを画像内に固定した結果、別 canvas で破綻しないか
- desktop / mobile / TV で apparent subject scale が適切か

同じ master image の center crop を全 surface に使うことを default にしない。

### Family continuity

series / channel / collection では:

- recurring identity は何か: framing grammar / mark / type / color role / subject treatment 等
- episode 固有の proposition は何か
- family resemblance と item differentiation のどちらが不足しているか
- 同じ template が内容差を隠していないか

毎回同じ顔・同じ背景・同じ文字位置にすることを consistency と呼ばない。

### Variant hypothesis

variant は変更点を説明できるようにする。

例:

- A: result を主役にする / B: process を主役にする
- A: person relationship / B: central object
- A: image-led / B: concise text + image
- A: tight crop / B: contextual wide crop

避ける:

- hue を少し変えただけ
- shadow や outline の強さだけを微調整
- 何を検証しているか説明できない複数案

platform の experiment が利用できる場合も、**CTR だけを絶対的成功指標にしない。**
YouTube の Test & Compare が watch time share を用いるように、preview が content consumption へつながったかまで見る。

## Decision rules

### 1. Frame grab vs purpose-built thumbnail

**Frame grab でよい:**

- 1 frame が content proposition を明確に表す
- motion blur / subtitle / transient UI が邪魔をしない
- target cropでも focal relationship が残る

**purpose-built が有効:**

- important relationship が1 frameでは成立しない
- content内の合法・正確なassetを再構成した方が small-size recognition が良い
- series identity / title treatment / multi-canvas derivative が必要

purpose-built でも、content に存在しない人物・結果・イベントを合成して promise を捏造しない。

### 2. Image-led vs text-assisted

image-led を default 候補にするが、text が以下を担うなら使用できる。

- image alone では区別しづらい concept / version / challenge / result
- surrounding metadata では伝わらない短い framing
- recurring series label が browse recognition を改善する

読めない text を「雰囲気」として残すくらいなら削る。

### 3. One artwork vs derivatives

一つの artwork をそのまま使うのは、実 target surfaces で crop / scale / overlay が同等に成立すると確認できた場合だけ。

materially different な aspect / device / chrome では:

- subject scaleを調整する
- cropを再決定する
- text/logo位置を組み替える
- 必要なら別 still / composition を選ぶ

### 4. One variant vs multiple hypotheses

variant を増やすのは、どの visual proposition が content discovery と consumption に適しているか不確実なとき。

variant 数そのものを品質としない。
各案に「何を変え、何を保持したか」を記録する。

## References

詳細な runtime reference と比較メモは [`references/thumbnail-design.md`](./references/thumbnail-design.md) を開く。

優先して見る current primary sources:

- [YouTube Help — Add customised thumbnails](https://support.google.com/youtube/answer/72431)
- [YouTube Help — Test & Compare thumbnails](https://support.google.com/youtube/answer/13861714)
- [YouTube Help — Thumbnails policy](https://support.google.com/youtube/answer/9229980)
- [YouTube Blog — Making thumbnails easier on YouTube](https://blog.youtube/news-and-events/youtube-studio-custom-thumbnail-updates/)
- [Netflix NPAA — artwork package deliverables](https://npaa.pc.netflix.net/en/regions/japan/)
- [Vimeo Help — change/select/upload a thumbnail](https://help.vimeo.com/hc/en-us/articles/12426471350289-How-to-change-the-thumbnail-image-for-my-video)
- [Vimeo OTT — thumbnail options](https://help.vimeo.com/hc/en-us/articles/46427320531217)

## Avoid

- `face + arrow + red circle + huge text` のような recipe を普遍化する
- poster/key art を縮小するだけで small-size QA を省く
- title を thumbnail 内でもそのまま繰り返す
- 内容にない人物、出来事、結果、before/afterを暗示する
- focal subject より effect / glow / outline / texture を目立たせる
- auto-generated platform chrome を無視して corner に重要情報を置く
- one master crop を全 surface に押し込む
- series template を固定しすぎて各 item の違いを消す
- tiny cosmetic variants を大量に作り「A/B testした」とみなす
- CTRだけを最大化し、短時間離脱や期待不一致を無視する
- platform の現在のpixel specを universal design law にする

## Verify

source file ではなく **delivered browse artifact** を見る。

### Required artifact checks

1. **Truth check**
   - thumbnail の人物・対象・状態・結果が content と一致する
   - title / thumbnail を組み合わせても誤解を作らない
2. **Actual-size check**
   - target browse surface と同程度の小サイズで表示する
   - first focal subject と dominant proposition を説明できる
3. **Context check**
   - title / channel / duration / badge / progress / platform overlay と一緒に見る
   - image単体ではなく card 全体で hierarchy を確認する
4. **Crop check**
   - 必要な landscape / portrait / square / platform crop を実際にrenderする
   - important subject / relationship / text が切れない
5. **Compression check**
   - platform / delivery に近い compressed output で細部とtypeを確認する
6. **Family check**
   - seriesなら最低3 itemを並べ、同じfamilyと分かりつつ各itemを区別できるか見る
7. **Variant check**
   - 比較する案は materially different な hypothesis を持つ
   - test metric が利用できるなら click だけでなく downstream engagement / watch behavior を確認する

### Trial before promotion

この Skill を experimental から promotion する前に、実 content を1件以上使う。

最低条件:

- actual title / metadata / source assets を使う
- 少なくとも2つの materially different thumbnail hypothesis を作る
- small browse size で比較する
- platform chrome / overlay を含む card context を確認する
- 2種類以上の materially different canvas/crop が必要な案件なら両方renderする
- content truth と期待一致を確認する
- 可能なら公開後 / controlled test の downstream engagement を記録する
- 判明した failure / adjustment を Issue または PR に durable に残す

この trial が終わるまで completed / promoted と扱わない。

## Responsibility boundaries

- `thumbnail-design` — browse-preview proposition、small-size recognition、crop/variant、card context、content-truth verification
- `visual-hierarchy` — artifact横断のpriority-to-emphasis orchestration
- `promotional-video` — time-based hook / message / proof / CTA / playback
- `poster-design` — standalone posterとしてのlarge-format hierarchy
- `key-visual-design` — title/campaignのmaster visual language

renderer、platform uploader、image generator は implementation adapter であり、design source of truth ではない。
