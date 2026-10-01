---
name: promotional-video
description: >
  product / service / event / brandの短尺・中尺プロモーション映像を設計するときに使用する。
  hook、brand、message、proof、CTA、audio、supers、safe zone、aspect-ratio adaptationをreferenceから抽出し、
  派手なmotion presetではなく「何を誰にどう伝えるか」からscene / beat構成を作り、exported playbackまで検証する。
---

# Promotional Video

Last reviewed: 2026-09-12

promotional video は「派手なmotion graphicsを足す」Skillではない。

**Objective → Message hierarchy → Reference inspection → Beat structure → Format adaptation → Playback verification**

何を伝え、何を覚えてもらい、何をしてほしいかから映像構造を決める。

## When to use

対象:

- product launch / feature promo
- service introduction
- event promo
- social ad / short-form promo
- app / UI showcase
- portfolio / release teaser
- 6s / 15s / 30s前後のvariant
- 16:9 / 9:16 / 1:1のcross-format delivery

対象外:

- media buying / campaign budget
- generic motion graphics showreel
- music videoのscene grammar
- long-form documentary / narrative film

## Workflow

1. objective、audience、delivery surfaceを特定する。
2. one dominant promiseを決める。
3. referenceを開き、attention / brand / message / CTA / format behaviorを観察する。
4. beat sheetを作る。
5. product / evidenceを早い段階で見せる。
6. sound-on / sound-offの両方で意味が残る構造にする。
7. 16:9 / 9:16 / 1:1を必要に応じてrecomposeする。
8. safe zone / UI overlay / captionを確認する。
9. export後の映像を実速度で視聴して完了判定する。

## Message hierarchy

すべてを同じ強さで伝えない。

基本的な役割:

- **Hook** — 視聴を開始 / 継続する理由
- **Brand / Product identity** — 何の映像か
- **Promise** — 何が得られるか
- **Proof / Demonstration** — 本当に何ができるか
- **Direction / CTA** — 次に何をしてほしいか

全動画で5要素を均等時間に分配する必要はない。
objectiveに応じて役割を削る / 強める。

## Observe

referenceでは以下を見る。

### Opening

- first visible subject
- first readable message
- time to product / brand appearance
- shot scale
- visual contrast
- motion onset
- audio onset

logo animationだけで冒頭を消費しない。

### Brand presence

- logoだけか
- product UI / package / color / type / sonic cueも使うか
- brandがstoryに自然に入っているか
- brand assetsがmessageを邪魔していないか

### Product proof

- actual UI / product / resultを見せるか
- before / after
- feature demonstration
- social proof / claim
- close-up / detail
- outcome visualization

抽象shapeだけでproduct価値を説明しない。

### Text / supers

- text density
- duration
- line count
- position
- contrast
- caption relationship
- legal / disclaimer handling
- safe-zone behavior

視聴者が読む前にtransitionしない。

### Audio

- voiceover
- music rhythm
- sound effect
- sonic brand
- silent-view fallback

audioで意味を補強してよいが、重要messageが音声だけに存在しないようにする。

### Pacing

- shot duration
- message duration
- reveal timing
- variation in intensity
- end-card hold
- loop / replay behavior

速さを「短尺らしさ」と混同しない。

### Format adaptation

- 16:9
- 9:16
- 1:1

で:

- focal subject
- text placement
- crop
- negative space
- UI overlay collision
- CTA position

がどう変わるかを見る。

center cropをdefault adaptationにしない。

## Decision rules

### One dominant promise

短尺では複数featureを同格で詰め込まない。

必要なら:

- main video: dominant promise
- variants: individual feature

へ分ける。

### Show evidence early

product / serviceそのものを見せられる場合、抽象introを長くしない。

「何の映像か」が分かる前にdecorative motionを積み重ねない。

### Brand early, but not as interruption

brandは早く識別可能にする。
ただし長いlogo bumperを必須にしない。

logo、product silhouette、UI、brand color、voice、typeなど複数のbrand signalを使える。

### Design for sound-on and sound-off

音あり:
- pacing
- emotion
- emphasis
- sync

を強化する。

音なし:
- core promise
- product identity
- CTA

が理解できるようにする。

### Recompose, do not merely crop

verticalでは人物 / product / UIの配置を組み直す。
horizontal masterの中心だけを切り取らない。

必要なら shot / graphic / text arrangement 自体をvariantごとに変える。

### Respect platform overlays

重要text / logo / CTAをUI overlay領域へ置かない。

safe zoneは固定magic numberとして暗記せず、current platform reference / templateを確認する。

## References

### Google Ads — ABCDs of effective video ads

https://support.google.com/google-ads/answer/14783551

Observe:

- Attention
- Branding
- Connection
- Direction
- focused message
- audio + supers
- brand visibility
- CTA

Use as performance-oriented evidence, not as a universal film grammar.

### Google Ads — Creative guidance

https://support.google.com/google-ads/answer/13812351

Observe:

- early brand presence
- duration guidance
- voice-over / audio
- orientation coverage
- machine-checkable creative attributes

### Google Ads — Video ad specs / safe zones

https://support.google.com/google-ads/answer/13547298

Observe:

- 16:9 / 9:16 / 1:1
- safe zones
- resolution
- placement-specific constraints
- current delivery requirements

### Meta for Business — Reels ads

https://www.facebook.com/business/ads/facebook-instagram-reels-ads

Observe:

- native 9:16 composition
- audio
- safe-zone placement
- Reels-specific communication style
- adaptation vs generic asset reuse

## Beat-sheet template

必要なroleだけ使う。

```text
0. Hook
1. Identify product / brand
2. Promise
3. Demonstrate / prove
4. Reinforce
5. CTA / end state
```

秒数を固定しない。
duration / platform / objectiveに合わせて圧縮・統合する。

## Avoid

- logo bumperだけで冒頭を消費する
- feature listを高速で読み上げる
- transition種類の多さをqualityとみなす
- abstract motionだけでproduct proofを置き換える
- sound-onでしか意味が分からない
- subtitle / supersをsafe zone外へ置く
- 16:9を単純center cropして9:16化する
- textを読めない速度で切り替える
- CTAを最後の1frameだけ表示する
- legal / required claimsをcrop / compressionで失う
- current platform specを古いtemplateの記憶だけで決める

## Verify

最低限、次の順に確認する。

1. **Muted playback** — core message / brand / CTAが理解できるか
2. **Audio playback** — audioがvisualと競合せず補強しているか
3. **Real-speed playback** — textが実際に読めるか
4. **First seconds** — product / promiseへの到達が遅すぎないか
5. **End state** — CTA / remembered messageが残るか
6. **Small-screen inspection** — text / UI detailが潰れていないか
7. **Safe-zone inspection** — platform chromeと衝突しないか
8. **Aspect-ratio variants** — cropではなくcompositionが成立しているか
9. **Compressed export** — banding / text edge / detail lossが許容範囲か

可能なら representative frames と full playback の両方を残して比較する。

最終評価は「動きが多いか」ではなく、短い時間の中でmessage hierarchyが保たれ、formatが変わっても伝達が崩れないかで行う。
