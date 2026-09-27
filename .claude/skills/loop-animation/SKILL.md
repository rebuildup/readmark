---
name: loop-animation
description: >
  Use when designing or reviewing authored 2D motion/video whose temporal segment repeats and the loop boundary,
  repeat semantics, entry/exit, phase, and long-run playback quality must remain intentional.
---

# Loop Animation

Loop を「同じ keyframe を繰り返す設定」として扱わない。

この Skill は、**何を反復単位にするか、どのように閉じるか、何回見ても意味と motion continuity が保たれるか**を設計する。renderer の loop switch や expression は実装手段であり、design source of truth ではない。

`limited-animation` が cycle を含む reuse の配分を担当するのに対し、この Skill は **repeatable temporal state の closure / entry / exit / phase / repeated playback** を担当する。

## When to use

- seamless / intentionally resetする短尺 animation
- character / object / mechanical action cycle
- ambient background / motion poster / installation loop
- social / signage / display で反復再生される motion asset
- intro → indefinite middle loop → outro を持つ live / interactive sequence
- music section に合わせて繰り返す visual segment
- 複数の independent loop layer を組み合わせる composition

一度だけ再生する transition、generic UI state motion、単なる clip duplication には使用しない。

## Workflow

1. **Inspect** — delivery surface、再生回数、audio、interaction/state、既存 animation、reduced-motion 条件を確認する。
2. **Open references** — `references/loop-animation.md` から複数 source を開き、loop の役割と repeat behavior を比較する。
3. **Choose the repeat unit** — property / object action / character cycle / layer / scene segment のどこまでを一つの loop とするか決める。
4. **Choose the repeat model** — forward cycle / ping-pong / accumulating-offset / continuous / intro-loop-outro を選ぶ。
5. **Design closure** — seam 前後の visible state、方向、pace、phase、contact、effect state を揃えるか、意図した reset として設計する。
6. **Define break conditions** — intention、state、direction、speed、contact、section が変わる点では loop を抜ける。
7. **Coordinate nested loops** — 複数 loop の hierarchy / phase / synchronization を設計する。
8. **Verify repeated playback** — normal speed で複数周見た後、seam と entry/exit を frame/scrub で診断する。

## Observe

- **repeat unit** — 何が一周で意味的に完結するか
- **loop mode** — forward / ping-pong / offset / continuous / bounded middle loop のどれか
- **wrap continuity** — seam の前後で position、shape、direction、pace、phase、contact がどうつながるか
- **entry / loop / exit** — loop に入る前、安定反復中、抜けた後の責務
- **semantic stability** — 同じ action / state を反復し続ける意味があるか
- **phase relationship** — 複数 loop が同時に reset するか、ずれて動くか、その理由は何か
- **repetition visibility** — 何周目から pattern が機械的に露出するか
- **effect state** — trail、particle、blur、mask、camera、grain 等が seam で不自然に reset しないか
- **audio relationship** — musical phrase / beat / silence と loop period の関係
- **delivery behavior** — finite / indefinite、autoplay、pause、offscreen、multi-screen sync の条件

## Decision rules

### Repeat unit を先に決める

loop command を適用する前に「一周で何が完結するか」を決める。

- property だけが周期運動するのか
- object action が一周するのか
- character performance の一 beat が反復するのか
- ambient layer だけが繰り返すのか
- narrative の middle state が任意時間継続するのか

異なる意味の区間を一つの loop に押し込まない。

### Repeat model を同一視しない

**forward cycle** は終端から始端へ戻って同じ進行を繰り返す。

**ping-pong** は終端で方向を反転する。往復そのものが意味的に自然な motion だけで使う。単に seam が作れないことの回避策にしない。

**accumulating / offset repetition** は一周ごとに位置・角度等が累積する。完全に同じ state へ戻る loop ではないので、drift が意図した spatial progression か確認する。

**continuous motion** は周期 segment を見せるより、一定速度等を継続する方が自然な場合に使う。

**intro → loop → outro** は開始・待機・終了の state が異なる live / interactive / narrative artifact で使う。middle loop に intro/outro の意味を毎周再演させない。

### Seam は静止 frame だけで判断しない

first / last frame の見た目が似ていても、normal-speed playback で pop / hitch / reversal が出ることがある。

seam 前後で確認する。

- position / scale / rotation / shape
- movement direction
- motion の pace と easing のつながり
- contact point / foot plant / object attachment
- deformation / silhouette
- camera / crop / background phase
- trail / particle / blur 等の残留 state

完全 seamless が目的でない場合も、reset が rhythm / impact / graphic cut として意図的に読めるようにする。

### Semantic state が変わるなら loop を抜ける

以下が materially 変わる場合は同じ cycle を延命しない。

- intention / emotion
- direction / destination
- acceleration / deceleration
- contact / obstacle
- music / narration section
- product / gameplay / narrative state

loop は「動きを省略する仕組み」ではなく、**同じ意味が継続している区間を表現する仕組み**として扱う。

### Nested loops は hierarchy と phase を持たせる

複数要素を反復させる場合、全要素を同じ周期・同じ位相で pulse させることを default にしない。

先に dominant loop を決め、secondary loop が:

- dominant beat を補強する
- 独立した ambient rhythm を作る
- intentionally synchronize する
- intentionally desynchronize する

のどれかを説明できる状態にする。

周期比や exact offset を universal rule にしない。

### Variation は repetition の弱さを隠すために足さない

mechanical repetition が問題なら、まず repeat unit / duration / semantic fit を見直す。

variation を入れる場合も:

- loop identity を壊さない
- hierarchy を変えすぎない
- seam を新しく増やさない
- audio / narrative state と矛盾しない

ことを確認する。

### Persistent motion は delivery context に合わせる

Web / application / installation 等で long-running loop を使う場合、非本質的 motion が reading / task / comfort を妨げないようにする。

- user の reduced-motion preference がある surface では static / reduced substitute を定義する
- pause / stop が必要な delivery では control を用意する
- hidden / offscreen の loop を無意味に動かし続けない

loop の存在自体を重要情報の唯一の伝達手段にしない。

## References

実行時には [`references/loop-animation.md`](references/loop-animation.md) を開き、implementation source と production artifact を分けて比較する。

## Responsibility boundaries

### `hand-drawn-animation`

key pose、breakdown、in-between、timing、spacing、exposure、cleanup 等、frame-to-frame motion construction を担当する。

この Skill は完成した motion segment を**どう反復可能な時間構造として閉じるか**を担当する。

### `limited-animation`

hold / substitution / transform / cycle / redraw の使い分けと animation effort の配分を担当する。

この Skill は cycle を採用した後の repeat unit、closure、entry/exit、phase、長時間反復 quality を担当する。

### `motion-system`

interactive UI の feedback / state transition / navigation / gesture と general runtime accessibility を担当する。

この Skill は authored loop construction を担当する。UI 内の ambient loop では `motion-system` の purpose / interruption / reduced-motion policy も併用する。

### `compositing`

matte / blend / grain / blur / glow / color integration を担当する。

この Skill は effect の見た目ではなく、effect state が temporal seam をまたいで破綻しないことだけを扱う。

## Avoid

- renderer の `loop` checkbox を設計判断にする
- first frame と last frame が同じだけで seamless と判定する
- seam を隠すためだけに ping-pong にする
- character/state の意味が変わっても cycle を流し続ける
- 全 repeating element を同一周期・同一位相にする
- arbitrary な 2 秒 / 4 秒 / 8 秒等を universal loop length にする
- repetition が目立つたびに decorative variation を増やす
- intro / reveal / impact を middle loop の毎周で再演する
- long-running decorative motion に pause / reduced-motion の検討をしない

## Verify

### Normal-speed repeated playback

最低 3 周以上、seam を意識せず普通に見る。

- wrap point が意図せず attention を奪わない
- repeated action の意味が周回後も変わらない
- movement pace / direction に hitch がない
- repetition が composition hierarchy を平坦化しない
- secondary loops が dominant rhythm と競合しない
- long-running loop で fatigue / distraction が強まらない

### Seam inspection

wrap の直前・直後を frame / scrub で往復する。

- position / shape / contact / crop が pop しない
- direction / pace が不自然に反転・停止しない
- trail / particle / blur / camera state が abrupt に消えない
- deliberate reset なら reset point が visual rhythm として成立する

### Entry / exit inspection

intro-loop-outro 構造では:

- intro が stable loop state へ自然に着地する
- loop が何周続いても exit trigger を受けられる
- outro が cycle の途中 state から不自然に teleport しない
- state change 後に旧 loop が残らない

### Delivery stress

該当するものを確認する。

- final exported file / runtime playback
- sound-on / sound-off
- target aspect ratio / crop
- finite repeat vs indefinite repeat
- reduced-motion / pause behavior
- offscreen / visibility change
- multi-screen / synchronized playback

source timeline が正しく見えても、final playback で seam / drift / duplicated pause / sync failure が出るなら完了ではない。
