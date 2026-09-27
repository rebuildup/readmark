---
name: hand-drawn-animation
description: >
  Use when planning, drawing, refining, or reviewing frame-by-frame 2D animation where pose, timing, spacing,
  exposure cadence, breakdowns, in-betweens, smears, line behavior, and cleanup determine the delivered motion.
---

# Hand-Drawn Animation

手描きアニメーションを「手描き風の線」や software preset として扱わない。

この Skill は、**drawing-to-drawing の時間構造**を設計する。key pose、breakdown、in-between、timing、spacing、exposure、hold、arc、overlap、smear / impact drawing、rough → cleanup の関係を観察し、現在の映像・ループ・カットへ翻訳する。

`motion-system` が担当する interactive product / UI motion、`compositing` が担当する完成素材の matte / grain / blur / color integration とは責務を分ける。

## When to use

次のような task で使用する。

- frame-by-frame の character / object animation
- hand-drawn loop
- rough animation の timing / spacing 改善
- key pose / breakdown / in-between の設計
- limited cadence を含む手描き animation
- smear / impact drawing を使う fast action
- rough line / line boil / redraw variation を含む animation
- cleanup 前後で motion energy が失われていないかの review

cut-out / skeletal rigging の操作手順、3D character animation、最終 composite の撮影処理だけを扱う task には使用しない。

## Workflow

1. **Inspect** — current artifact、storyboard、audio、shot duration、既存 rough、intended material / line language を確認する。
2. **Open references** — `references/hand-drawn-animation.md` から対象に近い複数 source を実際に開く。
3. **Extract action beats** — action を説明する key pose / silhouette / contact / direction change を先に特定する。
4. **Choose construction mode** — pose-to-pose / straight-ahead / hybrid のどれが action と production constraint に合うか決める。
5. **Block rough motion** — main action の timing、spacing、exposure、holds、arcs を rough で成立させる。detail を先に仕上げない。
6. **Shape transitions** — breakdown / in-between / overlap / secondary action / deformation を追加し、path、weight、acceleration、attitude を調整する。
7. **Refine material** — smear、impact drawing、line boil、roughness を必要な箇所だけ残し、style と readability の両方を確認する。
8. **Cleanup** — silhouette、volume、joins、paintable shape を明確にする。ただし rough で成立していた motion energy を均しすぎない。
9. **Verify playback** — normal-speed playback と frame / flipbook inspection の両方で最終 artifact を確認する。

## Observe

reference と current artifact では最低限以下を見る。

- **action beats** — どの pose が action / emotion / direction change を説明しているか
- **silhouette** — key pose が細部なしでも読めるか
- **timing** — action / hold / anticipation / settle が時間上どこに置かれているか
- **spacing** — 連続 drawing の位置間隔が speed / acceleration / weight をどう作るか
- **exposure cadence** — drawing を何 frame 保持し、どこだけ更新密度を上げるか
- **breakdowns** — midpoint ではなく path、arc、body mechanics、attitude をどう定義しているか
- **arcs / path** — body part / object が意図した軌道を通るか
- **overlap / follow-through** — main mass と appendage / clothing / hair / secondary mass の位相差
- **deformation** — squash / stretch / smear / impact pose が speed と readability に寄与しているか
- **form continuity** — volume、proportion、anchor、contact が意図せず drift していないか
- **line behavior** — stable line、rough line、line boil、redraw variation のどれが material language か
- **rough → cleanup change** — cleanup が motion を明確化したか、それとも energy を消したか

## Decision rules

### Timing と spacing を分離する

同じ duration でも drawing の spacing が違えば motion の印象は変わる。

- drawing 間隔が狭い領域は movement が遅く見える
- drawing 間隔が広い領域は速く見える
- mechanical な等間隔が必要な action 以外で、均等 spacing を default にしない

「何秒か」と「その時間内で物体がどう移動するか」を別々に確認する。

### Pose-to-pose / straight-ahead / hybrid を目的から選ぶ

**Pose-to-pose** を優先する条件:

- 明確な story beat / acting pose がある
- timing を事前に制御したい
- character proportion / volume consistency が重要
- shot を reviewable な key poses に分解したい

**Straight-ahead** を検討する条件:

- smoke / water / fire / loose cloth など organic な変化
- drawing-to-drawing の improvisational energy が重要
- shape の継続的変化自体が表現になる

多くの shot は hybrid でよい。major pose を計画しつつ、secondary / fluid motion を straight-ahead で作るなど、責務を分ける。

### Key / breakdown / in-between の役割を混同しない

- **key pose** — action / emotion / contact / direction change の主要 beat
- **breakdown** — key 間の path、attitude、arc、weight、passing relationship を決める drawing
- **in-between** — 定義済み relationship を必要な spacing / cadence に展開する drawing

breakdown を単なる数学的 midpoint にしない。

### Rough で main action を先に解く

rough stage ではまず以下を成立させる。

- pose readability
- timing / holds
- spacing / path
- balance / weight
- main mass の action

face detail、texture、clean contour、secondary detail を早期に仕上げると、弱い motion を修正しにくくなる。detail は main action が playback で成立してから増やす。

### Ones / twos / threes を quality rank にしない

unique drawing 数を多くすること自体を品質にしない。

- fast / highly articulated motion は drawing density を上げる価値がある
- slower passage、graphic timing、limited style では twos / threes / hold が成立する
- 同一 shot 内でも cadence を切り替えてよい

frame exposure は speed、readability、style、production constraint から決める。`24 unique drawings / second` を universal goal にしない。

### Hold を静止 failure と決めつけない

hold は pause、anticipation、reaction、graphic emphasis、limited cadence を作れる。

ただし長い hold で living quality を残したい場合、blink / breathing / secondary movement / purposeful redraw variation が必要かを artifact と style から判断する。常に何かを動かす必要はない。

### Smear / impact drawing は playback 上の役割で判断する

smear、stretch、multiple-image drawing、impact deformation は fast action の direction / speed / force を読ませるために使える。

- isolated still の anatomy realism を基準にしない
- exposure を長くして通常 pose として読ませない
- action direction と silhouette を壊す decorative smear を足さない
- smear が無くても読める action に無理に追加しない

normal-speed playback で必要性を判断する。

### Line boil / redraw variation は optional material language とする

手描きだから contour を無条件に揺らさない。

line boil を使う場合:

- handcrafted / living contour が作品の material language に合うか確認する
- silhouette / joins / contact / facial anchor 等の重要点は認識可能な範囲で安定させる
- random jitter filter のような均一な揺れにしない
- slow / held scene で motion feeling を補う場合も、画面全体へ同量を適用しない

clean/stable line が適切な作品では、不要な boil を作らない。

### Cleanup は motion redesign ではない

cleanup は rough の意図を読みやすく・paintable にする段階として扱う。

- silhouette と overlap を明確にする
- volume / proportion を整える
- accidental tangent / broken join を直す
- line weight / finish language を揃える

一方で、rough の asymmetric deformation、useful overshoot、smear、spacing impression を「きれいにする」ために消さない。

## References

runtime research は [`references/hand-drawn-animation.md`](references/hand-drawn-animation.md) を読む。

reference は tool UI や exact frame count をコピーするためではなく、複数 production / guidance 間で timing、spacing、pose construction、exposure、line material、cleanup の relationship を比較するために使う。

## Responsibility boundaries

### `motion-system`

Web / mobile product の state transition、navigation、feedback、gesture、reduced-motion、runtime performance を担当する。

この Skill は standalone / video / illustrative artifact の **frame-by-frame drawn motion construction** を担当する。

### `compositing`

alpha / matte / mask / grain / blur / glow / color matching / final-frame integration を担当する。

この Skill は composite 前の drawing cadence、pose、spacing、exposure、redraw behavior を担当する。

### renderer / authoring tool

Harmony / Animate / Krita / Blender Grease Pencil / After Effects 等の Xsheet、onion skin、light table、timeline、automatic in-betweening は実装手段であり source of truth ではない。

## Avoid

- unique drawing 数を quality score にする
- timing と spacing を同じ概念として扱う
- breakdown を毎回 50% midpoint にする
- 全 movement を均等 spacing にする
- main action が決まる前に cleanup / detail を完成させる
- smear / impact pose を decorative signature として乱用する
- 「手描きらしさ」のために全線へ random boil を入れる
- rough の energy を cleanup で均してしまう
- onion skin / interpolation feature の存在を animation decision の理由にする
- isolated still frame の美しさだけで motion を評価する

## Verify

最終 artifact は source file の完成ではなく **actual playback** で確認する。

### Playback

- normal speed で action beat / anticipation / action / settle が読める
- timing と hold が意図した rhythm を作る
- acceleration / deceleration が spacing と一致する
- fast action が smear を含め一瞬で読める
- secondary motion が main action を遅延して追従し、競合しない
- unintended pop / flicker / volume jump がない

### Frame / flipbook inspection

- key pose の silhouette が明確
- breakdown が intended path / arc / attitude を作る
- in-between が mechanical midpoint の連続になっていない
- hand / foot / contact point 等の必要な anchor が不用意に滑らない
- form / proportion drift が style 上の意図か error か判別できる
- smear / impact drawing の exposure が長すぎない

### Rough → cleanup comparison

同じ範囲を rough と cleanup で再生・flip 比較する。

- cleanup 後も pose / spacing / weight が維持される
- useful deformation / overshoot が消えていない
- line language が意図した stable / rough / boil behavior になっている
- paint / composite へ渡せる silhouette と joins が成立する

### Delivery-context checks

対象に応じてさらに確認する。

- loop → seam、cycle spacing、first/last pose continuity
- music / dialogue sync → frame-accurate cue と playback
- multiple aspect ratios → crop で key action / silhouette が失われない
- compressed delivery → line flicker / fine-detail loss / smear readability

real-project / real-artifact trial をまだ行っていない場合、この Skill を promotion 完了と扱わない。trial では最低1つの短い hand-drawn shot / loop を rough → in-between → cleanup → playback まで通し、判明した failure / limitation を Issue / PR に記録する。
