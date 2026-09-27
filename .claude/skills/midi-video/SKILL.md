---
name: midi-video
description: >
  Use when designing authored video or motion graphics from structured MIDI performance data.
  Preserve readable relationships between musical events, time, pitch, duration, parts, and expression,
  choose a representation model deliberately, and verify final playback against the source sequence.
---

# MIDI Video

MIDI を「派手な falling notes を出すための入力」ではなく、**時間上に配置された musical event / performance data** として扱う。

この Skill は MIDI event を可視化する authored video / motion artifact を扱う。一般的な chart encoding は `data-visualization`、文字の時間設計は `kinetic-typography`、最終画面統合は `compositing`、promo 全体の message hierarchy は `promotional-video` を canonical source とする。

## Workflow

1. MIDI source と viewer が読み取るべき musical information を特定する。
2. [runtime reference](./references/midi-video.md) を開き、protocol semantics、production editor representation、複数の graphical-score / visualization model を比較する。
3. time / pitch / duration / part / expression のうち何を data-bearing visual channel にするか決める。
4. piano-roll、falling-note、lane、radial / harmonic、その他 spatial model から、目的に合う表現を選ぶ。
5. decoration と data-bearing geometry を分離して実装する。
6. known MIDI fixture と照合しながら normal-speed playback、frame / scrub、seek、export variant を検証する。

## When to use

使用する:

- MIDI performance visualization
- piano-roll / falling-note video
- graphical score / animated score
- note / chord / phrase structure を見せる music video section
- performance data を比較・解説する motion graphic
- pitch / duration / voice / selected expression data を映像上で読ませる artifact

単なる waveform / spectrum / beat-reactive particle、DAW UI reproduction、MIDI parser 実装には自動適用しない。

## Inspect

実装前に確認する:

- source は MIDI 1.0 / MIDI 2.0 / SMF / live event stream のどれか
- viewer が読む必要があるのは pitch、rhythm/time、duration、voice/part、velocity/expression、harmony、phrase/section のどれか
- exact note reading が必要か、pattern / density / structure を読む artifact か
- piano keyboard metaphor が音楽・audience に適切か
- track / channel / instrument / voice が source 上でどこまで信頼できるか
- tempo change、meter、pickup、rubato-like timing、rests があるか
- sustain / Control Change / pitch bend / per-note expression を可視化する必要があるか
- target frame、aspect ratio、duration、viewing size
- audio と MIDI event の同期 source は同一か、別録音へ合わせる必要があるか

## Observe

### Source semantics

区別する:

- note onset
- note release / end event
- pitch / note number
- event time
- onset-to-release から得る note duration
- velocity / release velocity where available
- track / channel / group / part metadata
- Control Change
- pitch bend / per-note expression where available
- tempo / timing resolution / sequence metadata

MIDI の値を acoustic truth とみなさない。特に velocity を perceptual loudness と同一視しない。

### Time mapping

見る:

- past / present / future の位置関係
- playhead / keyboard collision / viewport edge のどこが「now」か
- pixels-per-beat / pixels-per-second / nonlinear or multi-scale time のどれか
- tempo change で visual speed と musical time がどう変わるか
- seek 後も event position が audio と一致するか

固定 scroll speed を universal rule にしない。

### Pitch mapping

見る:

- low ↔ high の空間方向
- octave / register の識別
- semitone spacing が一定か、harmonic relation を優先して変形するか
- keyboard / staff / radial / pitch-class model のどれを使うか
- microtonal / pitch-bend information を扱う必要があるか

pitch comparison が主要目的なら spatial mapping を途中で恣意的に変えない。

### Duration and overlap

見る:

- note bar / trail / envelope が何を表すか
- onset と release が視覚的に判別できるか
- repeated notes が一つの長音へ誤結合されないか
- legato / overlap / chord simultaneity が潰れていないか
- sustain pedal などで sounding result と key/note event duration が異なる場合、何を描いているか明確か

### Part / voice grouping

track / channel / part / instrument を同義語にしない。

色、lane、depth、shape、grouping を使う場合:

- source metadata と対応が説明できるか
- 同じ voice が途中で別 encoding に変わっていないか
- dense section でも grouping が追えるか
- palette だけに識別を依存していないか

### Expression

velocity / controller / bend を見せる場合:

- visual channel が何を表すか明記する
- size / opacity / brightness / line width / auxiliary lane 等から目的に合う encoding を選ぶ
- note identity / onset / duration を expression effect が隠していないか
- continuous controller data を note geometry と混同していないか

### Representation model

#### Piano roll / scrolling score

向いている:

- pitch と time の比較
- duration / overlap
- polyphony / pattern

注意:

- dense polyphony の occlusion
- long-range structure が viewport 外へ消える
- velocity / voice を geometry に詰め込みすぎない

#### Falling notes / keyboard collision

向いている:

- piano / keyboard performance
- near-future anticipation
- onset と physical key location の対応

注意:

- non-keyboard music に keyboard metaphor を強制しない
- collision timing を音声 onset と正確に合わせる
- particles / glow が key / chord reading を覆わない

#### Lane / part view

向いている:

- instrument / voice separation
- ensemble entry / section comparison

注意:

- pitch comparison を失う trade-off
- channel/track metadata を musical voice と誤認しない

#### Radial / harmonic / spatial view

向いている:

- pitch-class relation
- interval / harmony
- cyclical or structural relationship

注意:

- time / duration / exact register comparison が弱くなる場合がある
- derived harmony analysis と raw MIDI event を明確に分ける
- creator 固有の color wheel や geometry を universal rule にしない

## Decision rules

### 1. 先に reading task を決める

「MIDI を見せる」だけでは representation を決めない。

- performance timing を読む → onset / time anchor を強くする
- pitch / chord を読む → pitch position と simultaneity を安定させる
- orchestration / parts を読む → voice grouping を優先する
- expression を読む → note identity を壊さない副 encoding を追加する
- musical structure を読む → phrase / section / long-range context を追加する

### 2. Core mapping は安定させる

一度 time / pitch / part の意味を割り当てたら、decorative scene change のためだけに途中で意味を交換しない。

representation を切り替える場合は、anchor / transition / legend / overlap period などで対応関係を追えるようにする。

### 3. Source data と derived analysis を分ける

MIDI event から直接得る情報と、chord name / key / phrase / harmonic tension などの解析結果を同じ certainty で表示しない。

analysis を追加するなら:

- derivation / assumption を把握する
- ambiguous case を無理に断定しない
- raw event view と矛盾しない

### 4. Decoration は情報の上に立たない

particle、glow、trail、blur、light、camera movement、beat flash は optional layer とする。

effect off の baseline でも主要な note / time / pitch / part relationship が読めるようにする。

### 5. Dense passage では information budget を減らす

note 数が増えたときに effect も比例して増やさない。

候補:

- decorative particles を減らす
- secondary labels を省略する
- voice grouping を強める
- camera movement を止める
- representative register / section を選ぶ

ただし essential event を勝手に間引いて「演奏そのもの」と誤認させない。

### 6. Aspect ratio は再構成する

16:9 → 9:16 を center crop だけで作らない。

time lookahead、pitch range、keyboard width、labels、part lanes の優先度を delivery frame ごとに再評価する。

## Avoid

- falling piano notes を MIDI visualization の唯一の形とみなす
- velocity = loudness と断定する
- channel = instrument / voice と無条件に断定する
- pitch class へ固定 rainbow mapping を universal rule として適用する
- tempo change を無視した constant-time conversion
- repeated note を一本の長音へ誤結合する
- sustain と raw note duration の意味を曖昧に混ぜる
- particle / glow / blur が onset、duration、chord shape を隠す
- camera zoom / rotation で pitch / time axis の比較可能性を壊す
- every CC stream を同時表示して hierarchy を失う
- renderer preset / plugin setting を design rationale にする

## Responsibility boundaries

- `data-visualization` — generic analytical question、encoding、scale、annotation、accessible alternatives
- `kinetic-typography` — temporal text / reading / semantic hierarchy
- `compositing` — matte、blend、glow、grain、blur、final visual integration
- `promotional-video` — hook、promise、proof、brand、CTA、cross-format promo structure
- `audio-reactive-video` / `music-visualization-video` — waveform / spectrum / audio-feature-driven or broader music-reactive graphics

`midi-video` は **structured musical events を playback-synchronized visual grammar に変換し、event relationship を必要な粒度で読める状態に保つこと**を canonical responsibility とする。

## Verify

source timeline ではなく final playback と known event data を照合する。

### Fixture pass

少なくとも次を含む test sequence を用意する:

- isolated notes
- simultaneous chord
- repeated same-pitch notes
- overlapping / legato notes
- short + long durations
- multiple tracks / parts
- velocity variation
- rest / silence
- dense passage
- tempo change
- sustain / controller / pitch bend where the artifact claims to show them

確認:

- onset が正しい frame / playhead position に来るか
- release / duration が source と一致するか
- chord simultaneity が visual lag で崩れないか
- repeated note boundary が残るか
- tempo change 前後で sync が drift しないか

### Playback pass

normal speed で最初から最後まで見る。

- viewer が intended dimension を追えるか
- dense section で hierarchy が崩れないか
- rests に visual breathing room があるか
- decoration が event reading と競合しないか
- audio と visual onset が持続的に一致するか

### Frame / scrub / seek pass

problem section で:

- one-frame onset mismatch
- collision line / playhead mismatch
- dropped / duplicated events
- clipping / occlusion
- seek 後の state reconstruction
- effect trail が既に終了した note を active に見せていないか

を確認する。

### Delivery pass

必要な全 variant で:

- 16:9 / 9:16 / 1:1 等の frame
- target mobile / desktop / projection size
- compressed export
- long piece / short clip
- effect-on / effect-off baseline comparison

を確認する。

## Promotion gate

completed と扱う前に実 MIDI artifact で:

1. known event fixture と実楽曲の両方を用意する。
2. materially different な少なくとも2 representation を比較し、採用理由を記録する。
3. event mapping table を作り、data-bearing channel と decoration を分ける。
4. normal playback + frame/scrub + seek + export で source event と同期を照合する。
5. chord / dense passage / tempo change / multi-part / aspect-ratio variant を確認する。
6. failure / adjustment / verification result を durable に記録する。

real artifact trial 未実施なら experimental / pending のまま残す。
