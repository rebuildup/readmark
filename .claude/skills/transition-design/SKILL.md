---
name: transition-design
description: >
  Design authored transitions between 2D video, motion-graphics, or scene states by deciding what should remain continuous,
  what should break, and how the outgoing and incoming material share the boundary. Use for cuts, matches, blends,
  wipes/reveals, occlusion or motion bridges, split audio edits, and constrained morphs in linear media.
---

# Transition Design

Last reviewed: 2026-09-14

transition は effect preset を選ぶ作業ではない。

**Inspect A/B → Define boundary purpose → Choose continuity anchor → Choose transition model → Construct phases → Verify playback + boundary frames**

scene / shot / graphic state A から B へ移る境界で、何を連続させ、何を断絶させ、viewer にどの関係を理解させるかを設計する。

## When to use

対象:

- authored video / motion-graphics の shot / scene transition
- branded motion package の recurring transition language
- live action と graphic sequence の境界
- image / illustration / typography / UI capture を含む linear media
- montage / explainer / promo / title-related sequence の scene bridge
- audio と picture の切替時点を分離する transition

対象外:

- Web / mobile UI の interactive navigation / state transition → `motion-system`
- matte / alpha / color / grain / edge の final-frame integration → `compositing`
- 文字そのものの temporal reading behavior → `kinetic-typography`
- shot 内の multiplane depth / camera construction → `2d-parallax`
- repeating segment の closure → `loop-animation`
- NLE / After Effects / Resolve の操作手順や preset catalogue

## Workflow

1. current sequence と transition 前後の A / B を normal-speed で見る。
2. effect を置く前に、straight cut で意味が成立するか確認する。
3. boundary の目的を一つ以上特定する。
4. A と B の共通点 / 相違点から continuity anchor を選ぶ。
5. transition model を選び、outgoing / overlap / incoming の責務を決める。
6. source handles、mask、hidden region、interpolation、audio coverage を確認する。
7. sequence 全体で transition prominence と反復頻度を調整する。
8. normal-speed playback → frame/scrub → audio-only / sound-off 必要箇所 → final export の順で検証する。

## Observe

reference と current artifact の両方で見る:

- **Boundary purpose** — continuity / contrast / time passage / relocation / conceptual link / deliberate rupture
- **A/B relationship** — 同じ action / subject / composition / motif か、異なる場所・時間・意味か
- **Continuity anchor** — subject / action / shape / position / color / direction / camera velocity / graphic motif / audio
- **Transition model** — cut / split edit / temporal blend / wipe-reveal / occlusion / motion bridge / morph-interpolation
- **Phase ownership** — outgoing、overlap、incoming のどこが transition を担うか
- **Perceptual midpoint** — viewer が「B に入った」と感じる瞬間が sequence rhythm と合うか
- **Spatial logic** — direction、edge、occluder、camera move、source/destination の関係
- **Coverage** — handles、overscan、hidden region、mask edge、source frame の余裕
- **Interpolation risk** — face / limb / text / line / texture / background が不自然に生成・変形されないか
- **Audio relationship** — cut / lead / carry / crossfade / silence / impact のどれか
- **Prominence** — transition 自体が内容より目立つべき境界か
- **Repetition** — recurring motif が system を作るか、単調さを作るか
- **Delivery** — compression / frame rate / aspect-ratio change 後も boundary が成立するか

## Boundary purpose

### Continuity

同じ action / subject / thought / motion / ambience が続くと理解させる。

候補:

- straight cut / match on action
- graphic / positional match
- J / L split edit
- restrained dissolve
- motion direction / camera velocity の継続

transition effect を増やすより invariant を明確にする。

### Contrast / rupture

時間、場所、感情、情報階層、chapter が切り替わったことを意図的に強く示す。

候補:

- hard cut
- audio break / impact
- clear graphic interruption
- direction / palette / scale の deliberate discontinuity

「滑らかさ」を常に成功条件にしない。

### Passage / compression

時間経過、状態変化、距離の省略を示す。

候補:

- dissolve / temporal blend
- repeated motif transition
- matched composition across time
- graphic interstitial

duration を「時間が経った感」の固定値にしない。前後 shot の hold、audio、内容密度との関係で決める。

### Relocation / spatial bridge

viewer を別の場所 / scene space へ運ぶ。

候補:

- directional wipe / reveal
- foreground occlusion
- camera / whip / pan bridge
- scene edge / portal / mask を使った replacement

direction が前後 shot の camera / subject motion と矛盾しないか確認する。

### Conceptual link

異なる scene を形、動き、音、意味で接続する。

候補:

- graphic match
- match on action
- audio match
- repeated brand / narrative motif

表面上似ているだけでなく、なぜその二つを viewer に結び付けるか説明できること。

## Transition models

### Straight / matched cut

visible effect を使わない。

選ぶ条件:

- shot content / action / rhythm 自体が十分に boundary を担う
- transition effect が情報を遅らせる
- contrast を保ちたい
- visual / audio match が cut を支える

**cut は transition failure ではなく baseline** とする。

### Split audio edit

picture と audio の境界を同時にしない。

- **J-style** — B の audio を先に聞かせ、arrival を予告する
- **L-style** — A の audio を B の picture へ残し、continuity /余韻を維持する

audio overlap が dialogue / ambience / music を濁らせる場合は無理に使わない。

### Temporal blend / dissolve

A と B を一定時間同時に見せる。

確認:

- overlap 中に focal subject が二重化して混乱しないか
- luminance / contrast / color の組み合わせで unintended flash / mud が出ないか
- midpoint が semantic beat と合うか
- duration が shot rhythm を止めていないか

「柔らかい雰囲気」の generic default にしない。

### Wipe / reveal

edge / shape / mask / object が画面領域を置換する。

確認:

- wipe direction の理由
- reveal edge の owner
- before / after の coverage
- mask edge quality
- transition 後に scene space が自然に引き継がれるか

brand shape を使う場合も logo asset 自体のコピーではなく、current brand の geometry / motion principle へ翻訳する。

### Occlusion / motion bridge

foreground object、camera pan、whip、large moving element などが一時的に frame を覆い、その間に scene を交換する。

確認:

- occluder が A / B のどちらに属するか
- cover が十分か
- velocity / direction / blur が境界前後で連続するか
- hidden cut を目的化せず、viewer orientation が保たれるか

### Morph / interpolated repair

similar source states の間を interpolation して jump / discontinuity を減らす。

適する:

- framing / subject / background が十分に近い
- interpolation が補う変化量が限定的
- viewer が「同じ subject の連続」と読むことが目的

避ける:

- unrelated scene 間
- text / logo / precise geometry が補間中に崩れる
- face / hand / edge が rubbery / duplicated / melted になる
- source mismatch を隠すためだけに強く使う

Morph Cut / Smooth Cut 等の名前を universal design rule にしない。

## Phase ownership

transition を「A に effect 50% + B に effect 50%」で自動対称化しない。

必要に応じて分ける:

1. **Outgoing** — A が閉じる / exit motion を作る
2. **Bridge / overlap** — common anchor、mask、audio、motion が state を運ぶ
3. **Incoming** — B が settle / reveal / continue する

例えば B の audio は bridge より前に始まり、A の visual は hard cut で終わることもある。

どの phase が information を持つかを先に決める。

## Source coverage gate

transition 前に確認する:

- A の Out 側と B の In 側に必要な media handles があるか
- freeze / duplicated frames で不足を隠していないか
- speed change / stabilization / retime が handle を実質的に減らしていないか
- wipe / camera move で元画像の edge や未制作領域が露出しないか
- precomp / nested sequence / source replacement 後も boundary timing が保たれるか

coverage 不足なら transition を短くする、edit point を変える、source を延ばす、別 model を選ぶ。

## Build a transition language

複数 transition を持つ sequence / brand package では family を作る。

固定 preset 集ではなく semantic role で整理する。

例:

- ordinary scene change → cut / restrained continuity
- chapter / mode change → stronger graphic bridge
- product / feature progression → shared directional / motif transition
- climax / reveal → rare high-prominence transition

同じ transition を全境界に適用しない。
また毎回違う effect を使って「種類の多さ」を品質にしない。

## Audio relationship

transition は picture だけで評価しない。

見る:

- next ambience が picture より前に入るべきか
- previous dialogue / music tail を残すべきか
- impact / silence が visual cut と同時である必要があるか
- crossfade が phase cancellation / muddy overlap を作らないか
- transition sound effect が映像の構造を説明しているか、単に毎回鳴っているだけか

transition SFX で weak visual logic を隠さない。

## Avoid

- every cut に visible transition を置く
- plugin category を design taxonomy としてそのまま使う
- 「smooth」「cinematic」だけを理由に dissolve / zoom / blur を入れる
- unrelated shots を morph して破綻を隠す
- direction の異なる camera / subject motion を無理に接続する
- insufficient handles を freeze / repeated frame で気付かれないと仮定する
- wipe / mask の edge artifact を motion blur だけで隠す
- every branded transition を同じ強度で使い hierarchy を失う
- visual cut と audio cut を必ず同時にする
- reference 固有の signature transition、duration、brand asset をそのままコピーする

## References

実装前に `references/transition-design.md` を開き、task に近い reference family を複数比較する。

## Verify

### Sequence playback

最低でも transition 前後を含む sequence を normal speed で複数回見る。

確認:

- A → B の関係が transition なしより理解しやすい / 意図的になっているか
- transition 自体へ不要に attention が移っていないか
- continuity anchor が playback 中に認識できるか
- deliberate rupture なら十分に断絶して見えるか
- transition density が sequence hierarchy と合うか

### Boundary frame / scrub

edit point 前後と transition midpoint を frame / scrub で確認する。

- duplicate / dropped / frozen frame
- mask chatter / edge leak
- hidden-region / source-edge exposure
- morph distortion
- abrupt velocity / direction change
- unintended double subject / text overlap
- compression で出る edge / gradient artifact

### Audio

headphones / speakers で transition 周辺を確認する。

- J/L lead / carry の意図
- dialogue intelligibility
- ambience continuity
- music phrase / beat relationship
- unwanted click / phase / level jump

必要なら picture-only / audio-only でも確認する。

### System-level sample

transition language を作った場合は少なくとも:

- ordinary boundary
- important chapter / mode change
- fast / dense boundary
- quiet / slow boundary
- source mismatch が大きい boundary

を通し、同じ rule が異なる素材で成立するか確認する。

### Final delivery

最終 export / encoded playback を再生し、target aspect ratio、frame rate、compression、platform playback で transition timing と edge quality を再確認する。

実 project trial では `straight cut baseline → chosen transition model → normal playback → boundary scrub → audio check → final export` の比較結果を durable に記録する。