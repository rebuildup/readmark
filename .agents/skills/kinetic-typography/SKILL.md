---
name: kinetic-typography
description: >
  Design authored time-based typography for motion and video artifacts by making text behavior serve meaning,
  reading order, temporal hierarchy, rhythm, and narrative instead of applying generic text-animation presets.
---

# Kinetic Typography

文字を「動かす対象」ではなく、**時間の中で読む・見る・意味を受け取る visual material** として設計する。

この Skill は authored motion / video artifact の kinetic typography を扱う。interactive product UI の transition は `motion-system`、静的な hierarchy / measure / line breaking は `typesetting` を canonical source とする。

## Workflow

1. current artifact の message、audience、delivery context、audio、既存 typography / motion language を確認する。
2. [runtime reference](./references/kinetic-typography.md) を開き、少なくとも established research / canonical production / current independent work を比較する。
3. 読ませる単位と、その単位が時間軸で担う意味を決める。
4. static form と temporal behavior を分けて観察し、現在の artifact へ翻訳する。
5. normal-speed playback を先に評価し、必要に応じて frame-level inspection で原因を特定する。
6. required message が実際に読め、motion が hierarchy / meaning を強めていることを delivered artifact で確認する。

## When to use

使用する:

- title / opener / bumper
- typography-led motion graphic
- promo / explainer の text-led section
- lyric / spoken-word / quote の motion treatment
- motion poster / social video
- words / letters 自体が narrative や visual metaphor を担う sequence

単なる subtitle / caption styling、静的 editorial typography、button label animation、route transition には自動適用しない。

## Inspect

実装前に確認する:

- message の最小 semantic unit は何か
- viewers が **読む必要がある text** と、texture / atmosphere として扱える text は何か
- audio は speech / lyric / beat / ambience のどれか
- final duration と scene / shot structure
- frame / aspect ratio / target viewing size
- existing font family / type hierarchy / brand rules
- reusable motion vocabulary が既にあるか
- sound-off delivery が想定されるか
- loop / repeated playback があるか

font や animation preset より先に message structure を確定する。

## Observe

reference を比較するときは次を見る。

### Semantic unit

- glyph / character
- word
- phrase
- line
- paragraph / block
- composition 全体

細かく分割できることと、細かく動かすべきことを混同しない。

### Temporal behavior

static typography の form と、時間による behavior を分ける。

観察する behavior:

- serial reveal / replacement
- translation / scrolling / travel
- dynamic layout / regrouping
- scale / rotation / depth-like change
- appearance / disappearance
- compression / expansion
- letterform morph / deformation / variable-axis change
- hold / pause

複数 behavior を使う場合、各 motion が同じ意味を重複して主張していないか見る。

### Reading window

各 message unit について:

- entry 中にも読めるか
- settle / hold して読める時間があるか
- exit が comprehension を早く切り上げていないか
- 次の unit と競合していないか
- 一回の normal playback で必要情報を追えるか

固定 duration を universal rule にしない。語数、script、size、motion complexity、audience、delivery context の実物 playback で判断する。

### Temporal hierarchy

時点ごとに確認する:

- 今読むべきものは何か
- context として残るものは何か
- 既に読み終えたものは何か
- dominant motion はどれか
- viewer の attention がどこへ移るか

全語・全文字を同じ motion intensity で処理しない。

### Meaning ↔ motion relationship

motion が担う役割を説明する。

例:

- semantic emphasis
- emotional tone
- direction / relation
- transformation
- interruption
- accumulation / repetition
- contrast
- narrative transition
- voice / performance quality

「beat があるから bounce」「文字だから一文字ずつ出す」のような preset association にしない。

### Spatial continuity

text が再配置・拡大・分解・置換されるとき:

- 同じ phrase / object と認識できるか
- reading order が追えるか
- source と destination の関係が分かるか
- motion path が次の composition を準備しているか
- transform 後も文字として必要な時間だけ識別できるか

### Audio relationship

audio がある場合は、少なくとも次を区別する。

- spoken semantic accent
- phrase boundary
- lyric timing
- musical beat / meter
- sound effect cue
- silence / breath / rest

全 syllable / beat を機械的に同期しない。semantic emphasis と rhythmic emphasis が異なる場合は、message の理解を優先して意図的に選ぶ。

## Decision rules

### 1. 先に読ませる単位を決める

motion primitive から始めない。

- sentence meaning が重要なら phrase / line 単位を基準にする
- 特定の word が message carrier ならそこだけ motion intensity を上げる
- glyph-level behavior は letterform 自体の意味や materiality が必要なときに使う

### 2. Serial presentation と kinetic behavior を混同しない

text が順番に現れるだけなら、それは必ずしも expressive kinetic typography ではない。
position / layout / form / temporal relation が meaning を変える必要がなければ、simple reveal を選んでよい。

### 3. 読解中の変化量を制御する

required text が読解中なら、すべての軸を同時に変化させない。

- position が大きく変わるなら form / tracking / scale を安定させる
- letterform が変形するなら phrase position を安定させる
- dense text では motion を block-level に上げる

これは固定個数の制限ではなく、reading target を保つための trade-off とする。

### 4. Motion intensity を message hierarchy に配分する

新しい effect を sequence 全体へ均等配布しない。

- key word / turn / reveal / climax に差を作る
- supporting text は context を維持する
- every-word emphasis になったら contrast が消えていると判断する

### 5. Typography の静的品質を motion で隠さない

motion を止めた representative frame でも、必要な場面では hierarchy / alignment / contrast / line break が破綻していないことを確認する。
ただし fluid letterform や transitional frame を静止画の美しさだけで評価しない。

### 6. Tool capability を原則にしない

per-character selector、preset、expression、variable-font axis、path animation、text animator は renderer capability である。
「使える」ことを採用理由にしない。

## Avoid

- 全文字を常時動かして kinetic に見せる
- preset を phrase の意味に関係なく繰り返す
- every beat / syllable への機械的同期
- entry animation が終わる前に exit を始め、読める状態を作らない
- required text を歪ませ続けて lexical recognition を失わせる
- 過度な zoom / rotation / travel で reading order を壊す
- 全単語を強調して hierarchy を消す
- transition のために文章を不自然な単位へ分割する
- historical / creator-specific style を universal kinetic-type grammar としてコピーする
- authoring software の preset 名や magic duration を design rule にする

## Responsibility boundaries

- `typesetting` — static hierarchy、measure、line-height、line breaking、paragraph rhythm、mixed-script composition
- `font-mixing` — family / weight / apparent-size / script relationship
- `motion-system` — interactive UI motion、state transition、gesture、reduced-motion/runtime behavior
- `hand-drawn-animation` — drawing-to-drawing pose / spacing / exposure construction
- `limited-animation` — holds / substitutions / cycles / partial-motion allocation for authored animation
- `compositing` — final layers / matte / blur / grain / color integration
- `promotional-video` — promo 全体の hook / proof / brand / CTA / format structure

`kinetic-typography` は **文字の temporal behavior と reading / meaning の関係**だけを canonical responsibility とする。

## Verify

source timeline や keyframe の存在ではなく final playback を確認する。

### Required playback pass

- normal speed で最初から最後まで見る
- required words / phrases を一回で追えるか確認する
- dominant message が時間順に明確か確認する
- motion が意味を補強しているか、単に忙しくしていないか確認する
- audio がある場合、semantic emphasis と sync が矛盾していないか確認する
- typography が essential information を担う場合は sound-off でも message path を確認する

### Frame / scrub pass

problem がある箇所だけ frame / scrub inspection する。

確認:

- entry → readable state → exit の境界
- overlapping phrases の競合
- substitution / morph 中の identity loss
- clipping / off-frame text
- unstable alignment / unintended jitter
- transition 前後の composition continuity

### Delivery-context pass

必要に応じて:

- target mobile / desktop / projection size
- 16:9 / 9:16 / 1:1 等の実 delivery variant
- long / short phrase variation
- mixed-script / numeral sample
- compression 後の fine type / motion clarity
- loop seam と repeated-view fatigue

aspect-ratio variant は単純 crop ではなく、reading order と temporal hierarchy が維持されるか確認する。

## Promotion gate

この Skill を research candidate から completed と扱う前に、実際の短い kinetic-type artifact で以下を行う。

1. transcript / message を semantic unit に分解する。
2. 少なくとも2種類の materially different reference を比較して motion rationale を作る。
3. rough timing / storyboard を作り、normal-speed reading test をする。
4. final animation を playback し、sound-on / sound-off と representative delivery size を確認する。
5. failure / adjustment と verification result を durable に記録する。

real artifact trial を行っていない場合は experimental / pending のまま残す。