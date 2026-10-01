# Motion Poster References

Last reviewed: 2026-09-14

この reference set は motion poster を「動く装飾」ではなく、poster hierarchy と時間変化の関係として観察するために使う。

## Canonical static ↔ animated relationship

- [Cooper Hewitt — The Animated Poster: Götz Gramlich](https://www.cooperhewitt.org/2015/05/23/goetz-gramlich-animated-posters/)
  - Observe: 同一 concept の screenprinted poster と animated version の差。静止版では partially turned letter と shadow が状態を同時提示し、animation では letters が順に peel して event information を reveal する。
  - Useful for: static と motion を frame-identical にせず、同じ material idea を medium に合わせて翻訳する判断。
  - Avoid copying: letter-peeling 自体、festival identity、exact colors/timing。

## Current independent motion-poster production

- [Motionographer — Istanbul Sport Films Festival Motion Posters Series](https://motionographer.com/quickie/mahmut-kalyoncu-istanbul-sport-films-festival-motion-posters-series/)
  - Observe: restrained transitions、staggered text、negative space、stillness と movement の contrast。運動量を増やさず competition / breath / tension を表現している。
  - Useful for: motion density、hold、type emphasis、poster hierarchy を保つ current campaign evidence。
  - Avoid copying: Helvetica-like treatment、sports-specific vocabulary、exact stagger timing。

- [Motionographer — Yen & Liz / Shinjuku Ijigen](https://motionographer.com/quickie/liz-yen/)
  - Observe: outdoor billboard という viewing context、large-screen composition、複数 category を短い video work へ整理する方法。
  - Useful for: phone/social だけではない public display、viewing distance、screen context を考える evidence。
  - Avoid copying: Shinjuku/Kabukicho imagery、campaign assets、creator-specific palette。

## Static poster rhythm as pre-motion evidence

- [Cooper Hewitt — Jazz Motions / Niklaus Troxler](https://www.cooperhewitt.org/2018/05/29/jazz-motions/)
  - Observe: static poster 内で stripes、complementary color、figure direction が vibration / syncopation / perceived movement を作る。text legibility のため foreground/background crossing に応じて letter color も変化する。
  - Useful for: motion を加える前に static composition 自体が rhythm / directional energy を持てることを確認する。
  - Avoid copying: Willisau identity、specific stripe/color construction。

- [Cooper Hewitt — A Rhythmic Portrait](https://www.cooperhewitt.org/2017/02/06/a-rhythmic-portrait/)
  - Observe: repetition、cropped circles、layering による rhythm。literal animation がなくても反復構造が時間感覚を暗示する。
  - Useful for: repeated motif を animation owner にする前の static structure 観察。
  - Avoid copying: portrait treatment、Troxler quotation、exact circle layout。

## Current implementation evidence only

- [Adobe Learn — Bring a poster to life with animation](https://www.adobe.com/learn/photoshop/web/animate-poster-text-images)
  - Published: 2025-12-17.
  - Observe: layered poster artwork が timeline animation へ移される current production workflow。
  - Useful for: static artwork と time-based layer state が実装上接続可能であることの確認。
  - Do not use as source of truth for: Photoshop UI、specific animation technique、preset/timeline操作。

## Cross-reference guidance

motion poster 内で詳細が必要になったら次へ委譲する。

- animated text の semantic/readability timing → `kinetic-typography`
- seamless / deliberate reset、entry/exit、multi-repeat phase → `loop-animation`
- state/scene 間の boundary → `transition-design`
- matte / blend / grain / blur / final integration → `compositing`
- hook / proof / CTA を持つ長い広告構造 → `promotional-video`

## Comparison axes

reference 間を次の軸で比較する。

- static hierarchy は motion を外しても成立するか
- motion owner は何か、なぜその要素なのか
- motion は emphasis / reveal / material / rhythm / ambience のどの役割か
- movement と hold の contrast はどう作られるか
- viewer が途中から見た場合に何が残るか
- static variant と animated variant は何を共有し、何を再構成するか
- representative still frame は poster として成立するか
- viewing distance / display size / duration は motion density をどう変えるか
- repetition は意味を保つか、疲労や mechanical repetition を生むか

これらから creator 固有の表現ではなく、現在の artifact に適応できる hierarchy / temporal-role / verification rule だけを抽出する。