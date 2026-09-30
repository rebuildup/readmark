---
name: 2d-parallax
description: >
  Use when designing or reviewing authored 2D / 2.5D animation or video that creates depth through separated image planes,
  relative camera/layer motion, occlusion, reveal, and multiplane composition rather than full 3D scene construction.
---

# 2D Parallax

2D parallax を「foreground を速く、background を遅く動かす preset」として扱わない。

この Skill は、平面素材を **どの空間 plane に分け、どの相対 depth に置き、camera / layer motion に対してどう見え方を変えるか**を設計する。

歴史的な physical multiplane、切り抜き素材、layered illustration、写真の2.5D化、motion graphic scene では実装方法が異なる。それでも、depth ordering、relative motion、occlusion / reveal、coverage、flat-plane limit という共通の観察軸を持つ。

`compositing` が素材同士の matte / edge / color / grain / blur 統合を担当するのに対し、この Skill は **plane segmentation と camera-relative spatial behavior** を担当する。

## When to use

- foreground / middleground / background を分けた 2D animation
- illustration / collage / cut-out を multiplane として動かす shot
- still photo / key visual を layered 2.5D shot にする task
- 2D background に camera truck / pan / push / pull を与える scene
- camera に固定する title / HUD / frame と world-space element を分ける motion graphic
- flat artwork のまま奥行きと視点移動を作りたい authored video

次にはこの Skill を主 source of truth としない。

- interactive Web / UI の scroll-linked parallax
- 3D modeling / 3D scene layout / 3D lighting / 3D rendering
- matte / key / edge cleanup 自体
- camera blur / lens artifact / optical effect 自体

## Workflow

1. **Inspect** — source artwork、shot purpose、subject、camera intent、aspect ratio、duration、既存 layers を確認する。
2. **Open references** — `references/2d-parallax.md` から historical / current / production reference を複数開く。
3. **Segment the scene** — visual object ではなく spatial relationship に基づいて plane を分ける。
4. **Define depth** — foreground / middleground / background と camera-locked element の順序・距離関係を決める。
5. **Choose motion ownership** — camera が動くのか、layer/object が動くのか、その両方かを分ける。
6. **Prepare coverage** — camera move で露出する hidden region、overscan、mask edge、source resolution を先に確保する。
7. **Animate relative motion** — depth relationship に対応する apparent displacement / scale / occlusion を作る。
8. **Constrain flatness** — plane の薄さや元画像の perspective が破綻する前に camera move を制限するか artwork を追加する。
9. **Integrate** — 必要なら `compositing` で edge / color / grain / focus cue を合わせる。
10. **Verify** — normal-speed playback と extreme frame / scrub の両方で depth と technical continuity を確認する。

## Observe

- **scene segmentation** — 何を一つの plane として扱い、なぜ同じ depth に属するか
- **depth ordering** — foreground / middleground / background の前後関係
- **depth separation** — plane 間の距離差が motion で認識できるか、過剰ではないか
- **motion ownership** — camera、world layer、subject animation のどれが screen displacement を作っているか
- **relative apparent speed** — camera motion に対し近い plane と遠い plane の screen-space movement がどう異なるか
- **scale / perspective** — push / pull / lateral move で元 artwork の perspective と矛盾しないか
- **occlusion / reveal** — 前景が何を隠し、camera move で何が新しく見えるか
- **hidden-region coverage** — 元画像で隠れていた領域を十分に再構成しているか
- **cutout boundary** — hair、foliage、smoke、transparent edge 等が plane separation で破綻しないか
- **point of interest** — camera move 中も viewer が追う subject / focal region が明確か
- **camera-locked layer** — subtitle / frame / HUD / graphic overlay が world movement と混ざっていないか
- **overscan / crop** — extreme position で canvas edge や不足 pixels が露出しないか
- **depth cue support** — blur / haze / contrast / scale / texture が geometry と同じ depth story を支えているか
- **flat-plane exposure** — camera move が大きすぎて cardboard-like side / impossible turn として見えないか

## Decision rules

### Plane は object count ではなく spatial relationship で分ける

一つの object = 一つの plane と決めない。

同じ depth behavior を持つ要素は一つの plane にまとめられる。逆に一枚の背景画像でも、camera move で異なる相対運動や occlusion が必要なら foreground / middle / far background に分ける。

分割判断では次を見る。

- camera からの相対距離
- occlusion relationship
- independent motion の必要性
- edge complexity
- hidden region を補完できるか
- subject readability に depth 分離が必要か

layer 数の多さを品質にしない。

### Speed preset ではなく depth relationship から motion を決める

「foreground 100%、middle 50%、background 20%」のような比率を universal rule にしない。

parallax の screen-space displacement は、intended depth、camera path、framing、scene scale に依存する。

まず近い / 遠い / 同一 depth の関係を決め、preview で相対 motion を調整する。

近景が常に大きく動けば良いわけではない。過大な displacement は scene を miniature / card stack のように見せることがある。

### Camera motion と layer motion を分離する

**camera motion** は scene 全体の viewpoint を変える。

適する:

- environment を truck / pan / push / pull して探索する
- foreground / background の depth relationship を一貫して見せる
- subject を同じ world 内で reframe する

**layer/object motion** は world 内の object 自体を動かす。

適する:

- cloud / foliage / character / prop の independent movement
- limited animation の selective motion
- camera が静止したまま depth cue を作る場合

両方を同時に使う場合、camera-derived motion と object-derived motion を混同して accidental drift を作らない。

### Camera-locked element は depth plane に混ぜない

subtitle、HUD、frame、screen-space title 等が camera と一緒に固定される必要があるなら world plane と分ける。

world-space graphic と screen-space overlay を同じ transform hierarchy に入れると、意図しない parallax や scale change が起きる。

### Hidden region を animation 前に準備する

still image を分解すると、foreground を動かした時に元画像で隠れていた background が露出する。

camera path を決めたら、先に extreme position を確認して必要な coverage を特定する。

- background reconstruction
- extended texture / painting
- alternate crop
- extra foreground continuation
- matte extension
- source replacement

不足領域を blur や crop で常に隠す前提にしない。

### Occlusion / reveal を depth の evidence として使う

relative speed だけでなく、前後関係が視覚的に成立するかを見る。

- foreground が適切に middle/background を横切る
- reveal される順序が depth order と一致する
- contact / overlap relationship が camera move 中に pop しない
- transparent / soft edge の前後関係が破綻しない

必要な overlap がない scene では、parallax を過剰にして depth を証明しようとしない。

### Flat plane の限界を越えない

2D plane は volume を持たない。

大きな lateral / rotational camera move では、元 image の perspective と新しい viewpoint が矛盾する。

破綻が見えたら次から選ぶ。

- camera displacement を小さくする
- shot duration / framing を変える
- additional angle / side artwork を作る
- layer segmentation を細分化する
- controlled warp / redraw を使う
- task が本当に要求するなら別の production technique を選ぶ

「2.5Dだから3D cameraを自由に回せる」と考えない。

### Blur / haze は supporting cue として使う

focus blur、atmospheric haze、contrast falloff、grain/texture差は depth perception を補助できる。

ただし geometry が矛盾した parallax を blur で隠さない。

`compositing` が final blur / edge / grain / color integration を所有する。この Skill では cue が plane relationship と同じ direction を向いているかだけ判断する。

### Stylized flatness を failure と決めつけない

physical cut-out、collage、paper theatre のように plane の存在自体を visual language とする作品もある。

目的が photographic realism なら cutout edge / perspective mismatch を抑える。
flat materiality が意図なら、plane separation や physical shadow / texture を見せてもよい。

reference の realism level と current artifact の意図を混同しない。

## References

runtime research は [`references/2d-parallax.md`](references/2d-parallax.md) を読む。

physical multiplane、current digital layer-depth implementation、layered still-photo workflow、independent mixed-media production を比較し、一つの renderer や一つの studio の vocabulary を universal rule にしない。

## Responsibility boundaries

### `compositing`

alpha / matte / mask、edge、color、grain、blur、focus、final-frame integration を担当する。

`2d-parallax` は **どの plane がどの depth にあり、camera / layer movement に対してどう相対移動・occlusion・reveal するか**を担当する。

### `limited-animation`

hold / substitution / transform / cycle / redraw の motion allocation を担当する。

`2d-parallax` は background / environment / cutout plane の spatial relationship と camera-relative movement を担当する。

### `hand-drawn-animation`

drawing-to-drawing の key pose / breakdown / spacing / exposure / cleanup を担当する。

完成した drawing を spatial plane として配置する場合、その depth behavior はこの Skill で扱える。

### `motion-system`

Web / mobile UI の interactive motion、scroll-linked behavior、runtime performance、reduced-motion を担当する。

この Skill は **authored 2D animation / video shot** の multiplane construction を担当する。Web landing page の scroll parallax trend 自体はこの Skill の canonical scope にしない。

### `loop-animation`

parallax shot が loop する場合の closure、seam、entry / exit、repeat semantics は `loop-animation` が担当する。

### 3D production

3D modeling、volumetric scene layout、3D lighting、3D rendering は repository scope 外。

renderer が z-position / virtual camera を提供しても、この Skill の source of truth は flat source planes の visual relationship である。

## Avoid

- foreground / middle / background に固定 percentage speed を割り当てる
- depth を考えず layer 数だけ増やす
- camera move を決めてから hidden background 不足に気づく
- foreground cutout の edge を final dark background だけで確認する
- flat plane を大きく横から見せて perspective mismatch を放置する
- blur / haze / glow を depth geometry の代わりにする
- world element と camera-locked overlay を同じ transform hierarchy にする
- parallax を「静止画を豪華に見せるため」の default effect にする
- tool の z-value、camera preset、focal lengthを universal design rule にする
- physical multiplane / Disney vocabulary を stylistic template としてコピーする

## Verify

### Normal-speed playback

- depth order が説明なしでも読める
- camera move が subject / narrative purpose を支える
- near / far plane の relative motion が過剰でも不足でもない
- camera motion と independent object motion が accidental drift に見えない
- occlusion / reveal が spatial relationship と一致する
- flatness が unintended cardboard artifact として目立たない
- camera-locked element が安定している

### Extreme frames / scrub

start / middle / end と camera path の extreme position で確認する。

- canvas / layer edge が露出しない
- hidden-region reconstruction が不足しない
- foreground matte / cutout boundary が破綻しない
- contact / overlap が pop しない
- source resolution が不足していない
- push / pull で scale / perspective が不自然にならない
- blur / haze / focus cue が depth order と矛盾しない

### Final artifact

- target aspect ratio で crop と overscan を再確認する
- compression 後にも fine edge / transparent detail が破綻しない
- final export を再生し、preview と camera path / framing / timing が一致する
- loop の場合は少なくとも複数周再生し `loop-animation` の seam gate も通す

### Promotion trial

experimental から promotion する前に、一つの representative artifact を実際に通す。

1. layered illustration / photo / cut-out scene を選ぶ
2. plane segmentation と intended depth map を記録する
3. camera path と layer motion ownership を決める
4. hidden/reveal region を準備する
5. parallax shot を実装する
6. normal-speed playback と extreme-frame inspection を行う
7. edge / perspective / coverage failure を修正する
8. final export を target aspect で再検証する

source setup だけで完了扱いにしない。最終 playback で depth が成立し、plane model の限界が artifact として許容できることを確認する。
