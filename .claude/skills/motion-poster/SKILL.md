---
name: motion-poster
description: >
  Use when designing a poster-like 2D graphic that extends a strong static hierarchy into bounded time-based motion for digital signage, campaigns, event graphics, or looping display.
---

# Motion Poster

静止ポスターの情報階層を保ちながら、時間を追加することで注意、意味、素材感、リズムを強める。単に静止画の全要素を動かさない。

## When to use

- 1画面で主要メッセージが成立する poster / campaign graphic を時間展開したい
- digital signage、event screen、social display 等で短い反復表示を設計する
- static key art と animated variant を同じ concept family として作る

長い message sequence、proof、CTA を持つ広告映像は `promotional-video`、文字そのものの時間的意味は `kinetic-typography`、loop closure の詳細は `loop-animation` を優先する。

## Workflow

1. **Inspect** — static state、表示環境、閲覧距離/時間、loop、sound、aspect、fallback を確認する。
2. **Extract** — 複数 reference を比較し、何が静的 anchor で何が時間変化を担うかを抽出する。
3. **Translate** — 現在の message hierarchy を維持した motion role を割り当てる。
4. **Implement** — static anchor → emphasis/reveal/ambient motion → reset/hold の順で構成する。
5. **Verify** — normal-speed playback、任意時点の frame、複数周、target size、static variant を確認する。

## Observe

reference を開いたら次を見る。

- **poster hierarchy** — title / date / venue / subject / secondary information の優先順位
- **static anchor** — 動かなくても画面を識別可能にする要素
- **motion owner** — type / image / shape / texture / crop / color のどれが時間変化を担うか
- **motion role** — emphasis / reveal / rhythm / material behavior / attention / ambient continuity
- **hold vs change** — 読ませる静止時間と変化時間の比率
- **entry state** — loop途中から見ても主要情報を回収できるか
- **representative frame** — 静止状態でも poster として破綻しない瞬間があるか
- **static ↔ motion relationship** — 同一 concept をどう別 medium に翻訳しているか
- **display context** — viewing distance、screen size、duration、sound-off、周辺情報量
- **repeat behavior** — reset の可視性、反復疲労、複数周での意味変化

## References

詳細な観察ポイントと current/historical の区別は [`references/motion-poster.md`](./references/motion-poster.md) を読む。

優先して比較する:

- Cooper Hewitt — Götz Gramlich, animated/static poster pair
- Motionographer — Istanbul Sport Films Festival motion posters
- Motionographer — Shinjuku Ijigen large-screen work
- Cooper Hewitt — Niklaus Troxler poster rhythm evidence

一つの designer / campaign の motion vocabulary を一般則にしない。

## Decision rules

### 1. まず静止 hierarchy を成立させる

motion を切った状態で、主要 message、identity、必要情報の優先順位が読めることを確認する。motion は弱い composition の補修材にしない。

### 2. motion owner を絞る

全要素を同時に動かさない。最重要 message、concept を担う素材、または視線を次へ送る要素へ motion ownership を集中する。

背景や texture の ambient motion は foreground hierarchy と競合させない。

### 3. movement に役割を与える

各 movement を少なくとも一つへ結びつける。

- hierarchy を一時的に強調する
- 情報を順序立てて reveal する
- static graphic に暗示された material/action を時間化する
- event/music/sport 等の rhythm を構造化する
- display を生きた状態に保つ

説明できない movement は削る候補にする。

### 4. static variant を freeze-frame に限定しない

print/static と motion は同じ concept と hierarchy を共有してよいが、同じ瞬間をそのまま複製する必要はない。

motion で reveal している情報は static では同時配置へ再構成してよい。逆に static の重なりや暗示を motion では時間展開してよい。

### 5. 任意時点から読める設計を考える

digital signage や looping display では viewer が冒頭から見るとは限らない。

必須情報を一瞬しか出さない、長い intro の後にしか identity が出ない、reset 中に意味が消える構造を避ける。必要なら persistent anchor または頻繁に戻る readable state を置く。

### 6. hold を motion の一部として使う

動き続けることを品質にしない。情報を読む hold、変化前後の tension、reset 前の breathing room を設計する。

### 7. detail technique は隣接 Skill に委譲する

- temporal type semantics → `kinetic-typography`
- loop closure / seam / entry-exit → `loop-animation`
- shot/state boundary → `transition-design`
- matte / grain / blur / color integration → `compositing`
- promo narrative → `promotional-video`

motion-poster は poster hierarchy と bounded temporal emphasis の関係を所有する。

## Avoid

- poster の全 layer に異なる animation preset を付ける
- static composition が読めない状態を motion で隠す
- title、date、venue、CTA 等の必須情報を短い通過 frame にしか置かない
- movement の量を sophistication とみなす
- print版をそのまま分解して揺らすだけで concept translation とみなす
- large screen / phone / square を単純 crop だけで共用する
- sound がないと主要 message hierarchy が理解できない構造にする（sound-required artifact を除く）
- creator 固有の type motion、色、texture、exact timing を universal rule にする

## Verify

### Playback

- normal speed で3周以上見る
- loop の途中から見始めても主要 message / identity を回収できるか確認する
- motion owner が hierarchy を強め、secondary motion が競合していないか確認する
- hold が読解に十分か、静止が accidental freeze に見えないか確認する

### Frame inspection

少なくとも start / emphasis peak / readable hold / transition or reset / arbitrary mid-loop frame を静止して確認する。

- text が crop / blur / overlap で読めなくなっていない
- image/type hierarchy が反転していない
- intermediate frame が意図しない broken poster になっていない
- mask、trail、edge、compression artifact がない

### Delivery

- 実際の target size / viewing distance に近い条件で見る
- widescreen / portrait / square 等が必要なら単純 crop ではなく hierarchy を再確認する
- sound-off でも必須情報を理解できるか確認する
- final encoded artifact で type edge、gradient、grain、fast motion の劣化を見る

### Static relationship

static key art / fallback が必要なら並べて確認する。

- concept と hierarchy は同じ family として認識できる
- motion 専用の時間情報を失っても static artifact が自立する
- static を motion の偶然の一 frame にした結果、情報不足になっていない

## Promotion gate

first-class promotion 前に、実際の motion-poster を1件以上 `static/key art → motion role allocation → multiple-repeat playback → representative-frame inspection → target-size/export inspection` まで通し、判明した failure / limitation を記録する。source 作成だけでは完了としない。