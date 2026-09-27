---
name: limited-animation
description: >
  Use when designing or reviewing authored 2D animation where motion is intentionally allocated through holds,
  partial movement, drawing substitution, cycles, reusable assets, sparse redraws, and concentrated animation beats.
---

# Limited Animation

Limited animation を「低 FPS」「安く作るアニメーション」「動かさないこと」として扱わない。

この Skill は、**どこを動かし、どこを保持し、どの変化へ新しい drawing / pose / asset を使うか**を設計する。movement density を均一に下げるのではなく、story / acting / rhythm / readability に必要な箇所へ animation effort を集中させる。

`hand-drawn-animation` が drawing-to-drawing の pose / breakdown / spacing / cleanup を担当し、`compositing` が完成素材の統合を担当するのに対し、この Skill は **motion allocation と temporal reuse** を担当する。

## When to use

- limited 2D character animation
- cut-out / replacement / pose-library を使う animation
- mouth / eye / hand 等の drawing substitution を含む shot
- hold と selective motion を組み合わせる dialogue / acting scene
- walk / run / mechanical repetition 等の cycle を再利用する scene
- weekly / episodic / short-form production で drawing budget を意図的に配分する task
- sparse motion を graphic composition、editing、sound と組み合わせる animation

単に source footage の frame rate を落とす処理や、interactive UI motion には使用しない。

## Workflow

1. **Inspect** — storyboard、shot duration、audio、acting beat、camera/edit、既存 asset / rig / drawing library を確認する。
2. **Open references** — `references/limited-animation.md` から複数 reference を実際に開く。
3. **Map motion ownership** — shot の意味を運ぶ body part / object / camera / graphic change を特定する。
4. **Classify change type** — hold / transform / substitution / cycle / partial redraw / full redraw のどれで各変化を作るか決める。
5. **Allocate density** — key acting beat、impact、direction change、complex spatial change へ新規 drawing と高密度 motion を集中する。
6. **Design reuse** — cycle / pose / mouth / hand / background / camera move の reuse 範囲と variation point を決める。
7. **Protect joins** — held region と moving region の seam、pivot、silhouette、registration、volume を確認する。
8. **Verify playback** — normal speed と frame/flipbook の両方で sparse motion が意図として読めるか確認する。

## Observe

- **motion ownership** — scene の意味を実際に運ぶ moving element は何か
- **hold duration** — 何を何 frame / beat 保持し、hold が pause / emphasis / deadness のどれとして読まれるか
- **change type** — full redraw、partial redraw、substitution、transform、camera movement、cycle の比率
- **motion density contrast** — 静かな区間と高密度区間の差が beat を強めているか
- **partial-body boundary** — moving part と held part の join / pivot / silhouette が破綻していないか
- **reuse visibility** — cycle / repeated pose / background reuse が自然か、mechanical repetition として露出しているか
- **pose library coverage** — mouth / hand / eye / head / body pose の substitution が semantic range を十分に持つか
- **sound / edit support** — sparse visual motion を dialogue、SFX、music、cut、camera change がどう補完しているか
- **spatial continuity** — held asset を再利用しても position、scale、contact、screen direction が continuity を保つか
- **artifact rhythm** — 「常に少し動く」状態ではなく、stop / move / accent の rhythm があるか

## Decision rules

### Limited animation と低 frame rate を分ける

frame rate や exposure cadence だけで limited animation を定義しない。

同じ shot 内で次を併用できる。

- 長い hold
- transform だけで動く layer
- mouth / hand の drawing substitution
- cycle の再利用
- 数 frame だけの新規 redraw
- key beat の full frame-by-frame animation

全 layer を同じ cadence に落とすのではなく、**意味のある変化単位ごとに方法を選ぶ**。

### まず motion ownership を決める

各 beat で「何が動けば意味が伝わるか」を一つずつ特定する。

- dialogue の中心が facial / mouth change なら body 全体を常時動かさない
- reaction が posture shift で成立するなら、その beat へ body redraw を集中する
- camera move が spatial change を説明するなら foreground character の unnecessary drift を足さない
- impact / contact / direction change は sparse scene でも必要な redraw 密度を確保する

「画面が止まって見えるから」という理由だけで idle motion を増やさない。

### Hold を absence ではなく timing decision として使う

hold は anticipation、reaction、deadpan、graphic emphasis、dialogue focus を作れる。

hold 中に追加 motion が必要かは以下で判断する。

- viewer が次の beat を待つ必要があるか
- character が alive であることを示す必要があるか
- stillness 自体が performance か
- blink / mouth / hand / prop だけで十分か

全身 breathing loop を default にしない。

### Substitution と transform の責務を分ける

**substitution** は shape / pose / semantic state が変わる箇所で使う。

- mouth shape
- eyelid / eye direction
- hand pose
- head turn stage
- object state

**transform** は同じ drawing identity の translation / rotation / scale / controlled deformation で成立する movement に使う。

transform だけで anatomy / perspective / silhouette が不自然になる箇所は新しい drawing / pose に切り替える。

### Partial animation は join を設計する

body part の一部だけを動かす場合、held region と moving region の境界を artifact として見る。

確認する。

- pivot が anatomical / graphic relationship に合う
- seam が開閉しない
- contour が二重化 / kink しない
- moving part だけ volume / scale が drift しない
- held torso と animated head/arm の weight relationship が不自然にならない

rig が分割できること自体を採用理由にしない。

### Cycle は反復の意味が安定している時だけ使う

cycle が適する例:

- walk / run の steady phase
- machine / wheel / repetitive mechanism
- patterned crowd / ambience
- repeated background element

break / variation を入れる条件:

- character intention が変わる
- acceleration / deceleration が必要
- contact / obstacle / turn がある
- repetition が viewer に mechanical loop として見え始める
- speech / music / edit beat と位相が衝突する

cycle length や exact frame count を universal rule にしない。

### Drawing budget を均等配分しない

新規 drawing / pose は以下へ優先配分する。

- acting / expression の主要 beat
- anticipation → action → settle の turning point
- impact / contact
- perspective / orientation の大きな変化
- silhouette が materially 変わる箇所
- cycle から外れる transition

静かな connecting interval に同じ密度を使う必要はない。

### Sound と editing は補完であり隠蔽ではない

sound / dialogue / SFX / cut / camera move は sparse motion を強くできる。

ただし visual information が必要な action を音だけで説明してはいけない。mute playback でも主要な pose change / contact / screen direction が追えるかを確認する。

## References

runtime research は [`references/limited-animation.md`](references/limited-animation.md) を読む。

historical work、current production implementation、異なる cut-out / weekly-TV / stylized animation の reference を比較し、一つの studio や author の表現を universal rule にしない。

## Responsibility boundaries

### `hand-drawn-animation`

key pose、breakdown、in-between、timing、spacing、exposure cadence、smear、rough → cleanup 等、**新しい drawing 同士の motion construction** を担当する。

この Skill は、新規 drawing を使う前段で **どこを hold / reuse / substitute / partially animate するか**を決める。

### `motion-system`

Web / mobile product の state transition、navigation、feedback、gesture、reduced-motion、runtime performance を担当する。

この Skill は authored 2D animation / video sequence を担当する。

### `compositing`

alpha / matte / mask / grain / blur / glow / color matching / final-frame integration を担当する。

この Skill は composite 前の temporal reuse / motion allocation を担当する。

### renderer / authoring tool

Harmony の drawing substitution、peg、Xsheet、cycle、library、hold timing 等は production evidence であり design source of truth ではない。

## Avoid

- limited animation = low FPS と決めつける
- 全 layer を同じ exposure cadence にする
- static-looking shot を恐れて全身 idle motion を追加する
- rig の部品分割に合わせて、不自然な joint motion を許容する
- cycle を transition / intention change を越えて流し続ける
- mouth swap だけで acting 全体を済ませる
- reused pose を camera / perspective / contact の変化に無理に合わせる
- drawing 数の少なさ自体を品質目標にする
- software の reuse 機能があることを design decision の理由にする

## Verify

### Normal-speed playback

- viewer が見るべき element に motion が集中している
- hold が意図した pause / emphasis / deadpan として読める
- sparse interval と dense beat の contrast が rhythm を作る
- reused cycle が mechanical loop として不用意に目立たない
- partial motion の seam / pivot / silhouette が気にならない
- dialogue / sound / edit と visual beat が競合しない
- mute でも主要 action / contact / direction change が追える

### Frame / flipbook inspection

- held region と moving region の registration が安定する
- substitution の切替で volume / baseline / contact が pop しない
- transform で無理な perspective / deformation が発生していない
- cycle の entry / exit frame に discontinuity がない
- repeated drawing / pose の reuse point が意図した箇所に限定される

### Stress trial

実 project trial では最低1 shot / loop を次の順で検証する。

1. full intended action beats を決める
2. hold / substitution / transform / cycle / redraw を分類する
3. limited plan で制作する
4. normal-speed playback する
5. frame-by-frame で seam / pop / repeated-cycle pattern を確認する
6. 必要な beat だけ redraw / variation を追加する

source file が valid でも actual playback が弱ければ完了としない。
