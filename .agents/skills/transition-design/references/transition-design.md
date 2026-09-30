# Transition Design References

Last reviewed: 2026-09-14

この reference は transition preset の catalog ではない。

A / B の関係、continuity anchor、source coverage、audio-picture timing、transition prominence を比較するために使う。

## Current editing / implementation evidence

- [Adobe Premiere — Transitions overview](https://helpx.adobe.com/jp/premiere/desktop/add-video-effects/apply-video-transitions/transitions-overview.html)
  - Type: official / current implementation guidance
  - Observe: default cut boundary、transition が cut point をまたいで source media を共有する構造、media handles / insufficient frames の扱い。
  - Useful for: source coverage と edit-point reality を確認するとき。
  - Avoid copying: default duration、specific UI operation、preset name を design rule にしない。

- [Adobe Premiere — Video transition list](https://helpx.adobe.com/premiere/desktop/add-video-effects/effects-and-transitions-library/list-of-video-transitions.html)
  - Type: official / current implementation catalogue
  - Observe: dissolve / iris / slide / wipe / zoom 等は renderer category であり、boundary purpose の分類とは別であること。
  - Useful for: implementation possibility の確認。
  - Avoid copying: category の多さを transition quality と見なさない。

- [Adobe Premiere — Video dissolve transitions / Morph Cut](https://helpx.adobe.com/premiere/desktop/add-video-effects/effects-and-transitions-library/list-of-video-dissolve-transitions.html)
  - Type: official / current implementation guidance
  - Observe: Morph Cut は similar interview-style shots など、source similarity を前提に jump を滑らかにする constrained repair であること。
  - Useful for: interpolation / morph を使う条件と artifact risk を考えるとき。
  - Avoid copying: unrelated scenes の万能 bridge として使わない。

- [Apple Final Cut Pro — Intro to transitions](https://support.apple.com/en-tm/guide/final-cut-pro/ver2833f6b2/mac)
  - Type: official / current implementation guidance
  - Observe: transition が隣接 shot を一定時間置換 / overlap する構造、media handles、video transition と audio crossfade の関係。
  - Useful for: transition duration と source-frame availability を分離して考えるとき。
  - Avoid copying: software default を editorial intent に置き換えない。

- [Apple Final Cut Pro — Create split edits](https://support.apple.com/en-gb/guide/final-cut-pro/ver1632d82c/mac)
  - Type: official / current editing guidance
  - Observe: picture と audio の edit point を分離し、next sound を先行させる / previous sound を残す構造。media handles と audio overlap の確認も見る。
  - Useful for: J/L-style audio bridge、dialogue / ambience continuity。
  - Avoid copying: split edit をすべての scene transition に入れること。

- [Blackmagic Design — DaVinci Resolve Edit](https://www.blackmagicdesign.com/products/davinciresolve/edit)
  - Type: official / current implementation guidance
  - Observe: Smooth Cut が optical flow を用いて similar shots の jump cut を隠す specific repair として位置付けられていること。
  - Useful for: morph/interpolation の適用条件、B-roll / second angle 等の別解との比較。
  - Avoid copying: interpolation artifact を「smooth だから成功」と扱わない。

## Editing relationship references

- [Adobe — Match cut](https://www.adobe.com/creativecloud/video/post-production/cuts-in-film/match-cut.html)
  - Type: first-party editing guidance / established examples
  - Observe: graphic、action、audio の match が異なる continuity anchor を作ること。shape / composition / movement / sound / concept のどれが接続を担っているかを見る。
  - Useful for: visible transition effect を使わず A/B を強く結び付けるとき。
  - Avoid copying: cited films の iconic image pair を style recipe 化しない。

- [Adobe Premiere — J and L cuts](https://helpx.adobe.com/in/premiere/desktop/edit-projects/trim-clips/perform-j-cuts-and-l-cuts.html)
  - Type: official / current editing guidance
  - Observe: incoming sound の anticipation と outgoing sound の carry が picture boundary の意味をどう変えるか。
  - Useful for: visual transition より audio continuity が重要な boundary。
  - Avoid copying: timeline shape 自体を design rationale にしない。

## Production evidence

- [BUCK — Circle HQ Screen](https://www.buck.co/work/circle-hq-screen)
  - Type: production artifact / motion system
  - Observe: 30-minute block から perpetual presence まで組み替えられる modular system、3D narrative / live action / type を結ぶ seamless 2D transitions、time-of-day variation と run-of-show の関係。
  - Useful for: recurring transition language が individual effect ではなく sequence system を支える例。
  - Avoid copying: Circle 固有の portal、material、palette、exact visual treatment。

- [BUCK — Playgrounds In Motion](https://buck.co/work/playgrounds-in-motion)
  - Type: production artifact / brand motion system
  - Observe: logo 由来の wave を static brand asset ではなく image/video を受ける window / recurring motion device に翻訳している点。異なる medium でも motif relationship を維持している点。
  - Useful for: branded wipe / reveal motif を current identity から導くとき。
  - Avoid copying: N/M wave shape や具体的 animation language。

- [Motionographer — Wednesday Studio, Ying & Yang breakdown](https://motionographer.com/2025/04/30/breakdown-ying-yang-by-wednesday-studio-a-motion-poem-to-duality-design/)
  - Type: recent production breakdown / independent work
  - Observe: animatic で sequence を計画し、music が pacing / tone / transitions を導いたこと。transition を isolated effect ではなく sequence rhythm の一部として扱っている点。
  - Useful for: audio、animatic、scene progression と transition timing を一緒に設計するとき。
  - Avoid copying: studio 固有の color、texture、Taoist motif、straight-ahead expression。

## Compare across references

最低 2 family を比較する。

### Cut / match vs temporal overlap

見る:

- cut だけで continuity anchor が読めるか
- dissolve / overlap が semantic information を追加するか
- overlap が subject / text を二重化して逆に読みにくくしないか

### Visual boundary vs audio boundary

見る:

- audio を先に切り替えると B を予告できるか
- audio を残すと A の余韻 / continuity が保たれるか
- picture と sound を同時に切ることが rupture に必要か

### Spatial reveal vs conceptual match

見る:

- direction / occlusion / edge が scene space を説明しているか
- graphic/action/audio match の方が短く強く関係を作れるか
- branded shape が content の bridge になっているか、単なる overlay か

### Repair vs authored expression

見る:

- morph / smooth-cut が small source mismatch を補うのか
- transition 自体を見せる expressive purpose があるのか
- source selection / edit-point change / B-roll / hard cut の方が artifact risk が少ないか

## Extract these axes

reference を開いたら最低限記録する:

- boundary purpose
- A / B relationship
- continuity anchor
- transition model
- outgoing / overlap / incoming ownership
- perceptual midpoint
- direction / velocity / spatial logic
- media handles / hidden-region coverage
- mask / edge / interpolation risk
- audio lead / carry / silence / impact
- prominence within sequence
- repeated motif / exception logic
- final delivered playback behavior

## Failure evidence to actively seek

reference を admiration-only で見ない。current artifact では次を探す:

- source handle 不足による freeze / duplicated frame
- dissolve 中の unintended double face / text / high-contrast flash
- mask chatter / matte leak / uncovered edge
- whip / motion bridge 前後の direction / velocity discontinuity
- morph 中の face / hand / letter / precise geometry deformation
- branded transition の過剰反復
- visual effect が sequence pacing より長く居座る状態
- audio crossfade の濁り、level jump、click
- compression 後に transition midpoint だけ block / banding / edge artifact が強くなる状態

## Verification reference use

最終 verification は software timeline ではなく delivered representation で行う。

1. A → B を straight cut baseline で見る。
2. chosen transition を normal-speed playback で見る。
3. edit point 前後と midpoint を frame / scrub する。
4. picture-only / audio-only が有効なら分けて確認する。
5. sequence 内の複数 transition を連続視聴して prominence / repetition を確認する。
6. final encoded output を再生し、source edge、mask、interpolation、audio、compression を再確認する。

reference 固有の duration、brand asset、signature move、plugin setting は current project へ直接移植しない。