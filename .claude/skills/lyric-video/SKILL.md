---
name: lyric-video
description: >
  Design full-song lyric-led videos by aligning approved lyrics, vocal timing, song sections, repeated refrains,
  multiple voices, imagery, and readable typography into a coherent complete-track visual structure.
---

# Lyric Video

lyric video は「歌詞に text animation を付ける」だけの Skill ではない。

**Approved lyrics → Song map → Vocal/reading timing → Section grammar → Visual interpretation → Full-song verification**

1曲を通して、歌詞を正確に追え、反復する section の関係が分かり、visual が歌詞や音楽を補強する構造を設計する。

`kinetic-typography` は文字自体の temporal behavior、`audio-reactive-video` は audio signal feature の mapping、`promotional-video` は promo message hierarchy を canonical responsibility とする。この Skill は **full-song lyric structure と vocal/section/image の時間的関係**を扱う。

## When to use

使用する:

- official / promotional lyric video
- typography-led full-song video
- illustration / animation と歌詞を組み合わせた lyric-led music video
- visualizer と歌詞を組み合わせるが、歌詞理解が主要目的の映像
- duet / group vocal / call-and-response を含む lyric video
- 16:9 / 9:16 / square へ展開する lyric-led release asset

自動適用しない:

- 通常の subtitle / caption
- 一部分だけの kinetic type treatment
- waveform / spectrum / beat visualizer
- 歌詞が補助情報でしかない一般的な music video

## Workflow

1. current project の approved lyric source、final audio、delivery format、brand/art direction を確認する。
2. [runtime reference](./references/lyric-video.md) を開き、複数の materially different lyric video を比較する。
3. 曲を section と vocal event に分解する。
4. lyric timing unit と readable window を決める。
5. chorus / refrain / bridge / instrumental gap / overlapping voice の扱いを決める。
6. typography-led / image-led / mixed treatment の ownership を section ごとに設計する。
7. まず full-song rough timing を通してから、個々の text motion を磨く。
8. final export を approved lyric と照合しながら normal speed で全編確認する。

## Inspect

実装前に確認する:

- final master audio か
- approved lyric / official lyric sheet はどれか
- intro / verse / pre-chorus / chorus / bridge / instrumental / outro の section
- lead / backing / duet / harmony / ad-lib / spoken part の ownership
- repeated lyric と lyric variation
- fast / dense / sustained / whispered / overlapping vocal
- 曲中の silence / breath / rest / no-vocal interval
- title / artist / credits の必要性
- target aspect ratio / viewing size / platform overlay
- lyrics が primary information か、image と同格か

transcription を memory や自動認識だけに依存しない。公開物では approved source を canonical text とする。

## Observe

reference を比較するときは次を見る。

### Lyric source and segmentation

- phrase / line の区切り
- punctuation / capitalization / Japanese line break
- repeated phrase の表記
- parenthetical / backing vocal / ad-lib
- vocal が連続していても semantic phrase を保っているか

歌唱の breath 位置だけで文章を不自然に分割しない。

### Timing unit

候補:

- section
- phrase
- line
- word
- syllable / mora

最小単位を細かくできることを品質としない。

word / syllable 単位は、発音との対応自体が viewer の理解や participation に必要な場合だけ使う。通常は phrase / line の readable state を優先する。

### Vocal timing vs reading timing

観察する:

- vocal onset より前に lyric を出すか
- singing 中に reveal するか
- vocal end 後にどこまで残すか
- 次の phrase と overlap させるか
- fast passage で読む猶予が不足していないか

**sync accuracy と readability は同じではない。**

完全な onset 一致で文字を一語ずつ出すより、少し先行して phrase を見せた方が歌詞を追いやすい場合がある。artifact の目的から選ぶ。

### Section grammar

intro / verse / chorus / bridge / outro で見る:

- composition の continuity
- type hierarchy
- image/material language
- motion density
- palette / contrast
- camera/edit rhythm
- repeated motif

section change を毎回まったく別の style へする必要はない。曲の構造が視覚的にも追える程度の continuity と contrast を作る。

### Repeated chorus / refrain

同じ chorus が再登場するとき:

- recognition に必要な anchor は何か
- lyric が完全に同じか一部違うか
- composition / motif / motion の何を保つか
- energy 上昇や narrative progression をどこで変化として出すか

first chorus をそのまま複製することも、毎回完全に作り直すことも default にしない。

**recognizable repetition + purposeful variation** を設計する。

### No-vocal / instrumental states

instrumental、break、rest、long sustain では:

- lyric を消す / hold する理由
- visual motif を前面に出すか
- 次 lyric を予告するか
- section transition を担うか

歌がないのに直前の lyric を無期限に残さない。逆に、空白が意味を持つなら不要な text を埋めない。

### Multiple voices

複数 vocal がある場合:

- speaker / singer identity
- lead vs backing hierarchy
- call-and-response
- simultaneous lines
- harmony / doubled line
- ad-lib / parenthetical role

色だけで speaker を区別することに依存しない。

位置、alignment、type role、label、motion ownership、composition grouping などを必要に応じて組み合わせる。

### Lyric ↔ visual interpretation

visual の役割を区別する:

- **literal support** — lyric の具体物 / action を見せる
- **semantic metaphor** — lyric の関係・感情・変化を抽象化する
- **world / narrative support** — song や関連作品の世界観を継続する
- **material / graphic response** — type、shape、texture、color で mood/rhythm を作る
- **atmospheric support** — lyric を邪魔せず空気を作る

全 line を literal illustration にしない。
全 line を beat-only motion にもしない。

### Typography-led / image-led balance

lyric comprehension が主要目的なら、image / character / particle / camera が text の reading target を奪わないようにする。

image-led section でも:

- lyric contrast
- readable area
- line length
- safe area
- timing

を守る。

## Decision rules

### 1. Approved lyric を先に固定する

animation を始める前に final audio と lyric source を照合する。

最低限確認:

- wording
- repeated lines
- punctuation / notation
- names / foreign words
- ad-libs / backing vocal を表示するか
- censored / alternate version があるか

音源差し替え後は timing と text を再確認する。

### 2. Song map を作ってから scene を作る

先に全曲を section map にする。

```text
Intro
Verse A
Pre-chorus
Chorus 1
Verse B
Chorus 2
Bridge / instrumental
Final chorus
Outro
```

名称や構造は曲に合わせる。

section map は scene template ではなく、反復・contrast・energy・lyric density を判断するための骨格とする。

### 3. Phrase-level readability を baseline にする

exact karaoke highlighting を要求されていない限り、phrase / line が一度に理解できる状態を baseline にする。

word / syllable animation は:

- pronunciation emphasis
- call-and-response
- rhythmic repetition
- semantic contrast

など明確な役割がある箇所へ限定する。

### 4. Refrain は identity を保って進行させる

refrain の再登場では少なくとも1つ以上の recognisable anchor を保つ。

例:

- type arrangement
- recurring object/motif
- camera relationship
- color family
- motion phrase

ただし final chorus の energy / meaning が変わるなら、variation を許す。

### 5. Instrumental gap を text で埋めない

歌詞がない時間は visual-only state を正当な構成として扱う。

次 section への anticipation、motif development、breathing room として使える。

### 6. Multiple voices は hierarchy を作る

simultaneous lyric が読めない場合、すべてを同格で full-size 表示しない。

主 vocal、support vocal、ad-lib の情報優先度を決め、必要なら同時表示ではなく visual grouping / stagger / selective transcription を選ぶ。

approved requirement を勝手に省略しない。

### 7. Style transition を section meaning に結び付ける

verse→chorus、bridge、final refrain などで visual grammar を変える場合、曲の構造や lyric meaning との関係を説明できること。

「飽きるから毎 section 別 effect」にしない。

### 8. Aspect ratio は crop ではなく recompose する

9:16 / 1:1 では:

- reading order
- line breaks
- focal image
- singer grouping
- lyric safe area
- platform chrome

を再設計する。

horizontal master の中央切り抜きで lyric を欠損させない。

## References

詳細な observation は [runtime reference](./references/lyric-video.md) を使用する。

実行時は少なくとも:

- current official / first-party lyric video
- materially different production approach
- typography-heavy と image-led の両方

を比較する。

単一 creator の見た目を style recipe にしない。

## Avoid

- lyric source を未確認の自動 transcription のまま公開する
- 全単語を vocal onset と同時に機械的に pop させる
- karaoke-like highlighting を lyric video の必須条件にする
- fast lyric を短い exposure のまま流して読解不能にする
- chorus を毎回コピーして progression を失う
- 逆に repeated chorus の visual identity を毎回完全に捨てる
- instrumental gap に stale lyric を残し続ける
- lead / backing / ad-lib を同じ hierarchy で重ねて読めなくする
- color だけで singer identity を表す
- lyric の全 line を literal illustration に変換する
- image / particles / camera が text を常時横切る
- beat sync だけを semantic interpretation とみなす
- section ごとに無関係な style を切り替える
- 16:9 master を単純 crop して vertical lyric を欠損させる
- renderer preset / exact duration / exact font size を universal rule にする

## Responsibility boundaries

- `kinetic-typography` — glyph / word / phrase の temporal behavior、reading window、motion intensity、form transformation
- `typesetting` — static hierarchy、line break、measure、mixed-script typographic quality
- `audio-reactive-video` — amplitude / spectrum / onset / beat 等の audio feature → visual mapping
- `promotional-video` — hook / promise / proof / brand / CTA を持つ promo structure
- `compositing` — matte / blend / grain / blur / color / final layer integration
- #12 scene/trend research — MV scene grammar、creator/scene-level trend

`lyric-video` は **approved lyric、full-song section map、vocal timing、repeat/variation、voice ownership、no-vocal state、lyric-image continuity** を canonical responsibility とする。

## Verify

source timeline や keyframe の存在では完了しない。final audio と final export で確認する。

### 1. Text accuracy pass

approved source と全編照合する。

- missing / duplicated lyric
- typo
- wrong repeated phrase
- wrong speaker
- wrong foreign-language spelling
- alternate audio version mismatch

### 2. Full-song normal-speed pass

最初から最後まで一度停止せず見る。

確認:

- lyric を追えるか
- visual が毎 line の読解を奪っていないか
- section structure が coherent か
- chorus repetition が単調すぎない / 別物すぎないか
- instrumental gap が意図的か
- full-song fatigue がないか

### 3. Timing pass

特に確認する箇所:

- first lyric entry
- fast/dense verse
- sustained word
- chorus onset
- repeated chorus
- bridge
- overlapping voices
- ad-lib
- final lyric / outro

vocal onset/offset と text visibility を scrub し、遅延・早すぎる消失・誤った phrase association を確認する。

### 4. Readability pass

- target viewing size
- high-motion section
- low-contrast image section
- long lyric line
- narrow aspect ratio
- compression 後

で actual frame を確認する。

### 5. Voice / overlap pass

複数 vocal がある場合:

- lead が追えるか
- backing/ad-lib が main lyric を隠さないか
- identity cue が color-only でないか
- simultaneous information 量が過剰でないか

### 6. Format pass

必要な 16:9 / 9:16 / 1:1 等をそれぞれ playback する。

- crop
- line break
- safe area
- focal image
- text size
- lyric order

を実 export で確認する。

## Promotion gate

research candidate を completed / promoted と扱う前に、実 lyric-video artifact で以下を行う。

1. final audio + approved lyric から full song map を作る。
2. 少なくとも2種類の materially different production reference を比較する。
3. verse / chorus / no-vocal / repeated section / dense lyric を含む rough timing を作る。
4. complete track を normal speed で playback し、approved lyric と照合する。
5. target delivery size / aspect variant の final export を確認する。
6. failure / adjustment / remaining limitation を durable に記録する。

real artifact trial を完了していない場合は experimental / pending のまま残す。