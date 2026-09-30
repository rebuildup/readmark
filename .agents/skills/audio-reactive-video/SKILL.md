---
name: audio-reactive-video
description: >
  Use when designing 2D motion or video whose visual behavior is driven by analyzed audio signals.
  Choose meaningful audio features, map them to visual parameters with deliberate temporal response and hierarchy,
  and verify the delivered playback against controlled audio material rather than relying on generic visualizer presets.
---

# Audio Reactive Video

音に反応すること自体を design goal にしない。

この Skill は、**audio signal から何を観測し、その時系列をどの visual parameter に、どの応答速度・範囲・階層で割り当てるか**を設計する。

MIDI note / pitch / duration / part など structured event data は `midi-video`、interactive product UI motion は `motion-system`、final glow / blur / grain / blend は `compositing` を canonical source とする。

## Workflow

1. source audio と、視覚化で感じ取らせる / 読み取らせる audio property を特定する。
2. [runtime reference](./references/audio-reactive-video.md) を開き、signal analysis、production mapping、materially different audiovisual works を比較する。
3. raw signal / spectrum / derived feature / higher-level interpretation を区別する。
4. audio feature → visual parameter の mapping と response envelope を決める。
5. reactive layer と非reactiveな visual hierarchy を分けて実装する。
6. controlled fixture と実楽曲の両方で playback / frame / export を検証する。

## When to use

使用する:

- audio-reactive motion graphics
- music visualizer / live visual
- waveform / spectrum を source にした authored animation
- amplitude / frequency band / onset / tempo 等で motion や形状を駆動する映像
- live input に反応する 2D projection / screen graphics
- music video 内の audio-driven section

自動適用しない:

- MIDI event relationship を読ませる映像 → `midi-video`
- lyric / text の timing が主題 → `kinetic-typography`
- scene / MV trend 自体の選択
- final compositing effect の調整だけを行う作業

## Inspect

最初に確認する:

- source は prerecorded / live input / composition bus / isolated stem のどれか
- mono / stereo / multichannel のどこを分析するか
- viewer に伝えたいのは energy、transient、spectral balance、pulse、texture、section contrast のどれか
- exact analytical reading が必要か、perceptual correspondence が目的か
- visual response は live / deterministic offline render のどちらか
- target frame rate / output duration / aspect ratio / display size
- audio latency と visual render latency を計測できるか
- silence、very quiet passage、sustained tone、dense mix、abrupt transient が含まれるか

## Observe

### 1. Signal level

raw waveform をそのまま「音楽の意味」と扱わない。

区別する:

- time-domain sample / waveform
- amplitude / peak
- RMS / energy
- loudness-oriented descriptor
- normalized value

同じ音量感でも waveform shape は異なり、同じ peak でも sustained energy は異なり得る。

### 2. Frequency representation

FFT / spectrum を使う場合に見る:

- analysis window / FFT size
- frequency-bin resolution
- temporal resolution
- windowing
- dB range / normalization
- low / mid / high または bounded band の選択
- adjacent band の cross-talk

より細かい spectrum 表示が常に良いわけではない。frequency detail と temporal responsiveness の trade-off を確認する。

### 3. Derived audio feature

feature 名を interchangeable に扱わない。

例:

- RMS / energy — frame-level energy
- spectral centroid — spectral distribution の中心傾向
- band energy — 選択した周波数範囲の energy
- onset function — transient / change の検出
- beat / tempo estimate — pulse の推定
- pitch / chroma / tonal descriptor — tonal property の解析

必要な property に合う feature だけを採用する。

### 4. Continuous vs event-like response

#### Continuous

向いている:

- energy → scale / displacement / density
- spectral balance → shape distribution / spatial bias
- envelope → deformation / brightness / flow rate

見る:

- attack
- smoothing
- hold
- release / fall
- range compression

#### Event-like

向いている:

- onset → spawn / impulse / cut / accent
- detected beat → discrete state change
- threshold crossing → trigger

見る:

- false positive / missed event
- retrigger interval
- double-trigger
- visual event duration
- actual transient との offset

連続値を無理に trigger として扱ったり、event detector を連続 modulation の代わりに使ったりしない。

### 5. Response envelope

analysis output を visual parameter に直結する前に temporal behavior を決める。

観察する:

- attack speed
- decay / fall speed
- smoothing amount
- peak hold
- hysteresis / threshold
- interpolation
- clamping

反応が速すぎると jitter、遅すぎると音との因果関係が失われる。

### 6. Normalization / dynamic range

固定 gain だけで成立すると仮定しない。

確認する:

- source-specific level
- quiet passage
- loud passage
- silence / noise floor
- unexpected peak
- live-input variance

必要に応じて:

- bounded mapping
- floor / threshold
- local or global normalization
- compression
- separate calibration per source/stem

を使う。

ただし automatic normalization で楽曲内の意図的な dynamic contrast を消さない。

### 7. Mapping ownership

一つの audio feature を全部の visual parameter に配らない。

各 mapping について明示する:

```text
source feature
→ preprocessing / normalization
→ response envelope
→ visual owner
→ parameter range / polarity
→ fallback at silence
```

例として「bass = scale」「treble = color」を universal rule にしない。

### 8. Visual hierarchy

reactivity が hierarchy を上書きしないようにする。

見る:

- primary reactive element
- secondary response
- stable anchor
- background response
- camera response
- typography / UI / label の非reactive領域

全要素が同時に最大反応すると、music structure ではなく noise に見えやすい。

### 9. Latency / phase relationship

live input と rendered playback の両方で audio → analysis → visual の遅延を見る。

確認する:

- transient と visual accent の offset
- smoothing による意図的 lag
- buffering / capture latency
- render / display latency
- seek / restart 後の state

「beat に合って見える」だけで frame-accurate sync を断定しない。

### 10. Silence and reset behavior

silence は invalid state ではない。

決める:

- rest position
- decay-to-rest
- residual trail
- ambient baseline
- reset after seek / source switch

noise floor に反応し続けて静止できない状態を避ける。

## Decision rules

### Start from the perceptual task

まず何を response として感じさせるかを決める。

- impact / attack → onset / transient evidence を優先
- overall intensity → RMS / energy / appropriate loudness proxy を検討
- spectral contrast → frequency-band / spectral descriptor を検討
- pulse → beat / tempo estimate を検討
- timbral / tonal structure → dedicated descriptor が必要か確認

available feature があることを採用理由にしない。

### Separate measurement from interpretation

raw FFT bin、band energy、detected onset、estimated beat、estimated pitch/chord は certainty と意味が異なる。

higher-level inference を使う場合は:

- detector が推定値であることを理解する
- failure material を確認する
- raw response と同じ certainty で扱わない

### Use few meaningful mappings first

初期実装では primary feature / primary visual owner を絞る。

mapping を追加するたびに:

- 新しい audible distinction を表しているか
- 既存 mapping と競合しないか
- visual hierarchy を改善するか

を確認する。

### Preserve authored composition

audio input は layout engine ではない。

reactive value に許可する範囲を決め、以下を壊さない:

- focal hierarchy
- safe area
- text readability
- silhouette
- composition balance
- edge / crop relationship

### Treat smoothing as a design variable

smoothing / fall は単なる jitter fix ではない。

- percussive response → attack を保持しつつ必要な decay を設計
- sustained response → unnecessary flicker を抑える
- slow ambient response → long integration が意味を持つ場合のみ使う

すべての feature に同じ smoothing を適用しない。

### Distinguish live from offline

live:

- unpredictable level
- input switching
- latency
- dropout
- noise floor

を重視する。

offline/rendered:

- deterministic analysis
- precomputed normalization
- exact timeline alignment
- repeatable export

を利用できる。

同じ implementation constraint を両者へ強制しない。

### Keep effects downstream

glow、blur、trail、particle、chromatic effect、camera shake は mapping の証拠ではない。

まず effect-off / low-treatment state で intended audio relationship が成立することを確認する。final integration は `compositing` と併用する。

## References

実作業では [runtime reference](./references/audio-reactive-video.md) を開き、少なくとも signal-analysis source と materially different production examples を比較する。

## Avoid

- waveform = 音楽そのものの構造、と扱う
- FFT bar visualizer を唯一の audio-reactive grammar とみなす
- low / mid / high を固定の色・方向・形へ普遍化する
- bass、snare、vocal 等を band range だけから確定的に識別する
- peak value だけを perceived loudness とみなす
- every beat を flash / zoom / cut にする
- 全 layer / camera / effect を同じ signal で駆動する
- smoothing を増やして latency を見えなくする
- source level ごとの差を無視して clipping / dead response を起こす
- silence でも noise floor に反応し続ける
- detector の推定値を ground truth とみなす
- visualizer preset / renderer node graph を design source of truth にする
- final effect が mapping の破綻を隠している状態で完成扱いする

## Responsibility boundaries

- `midi-video` — note onset/release、pitch、duration、part、MIDI expression 等の structured event relationship
- `audio-reactive-video` — audio signal から得る continuous / detected feature と visual behavior の temporal mapping
- `data-visualization` — generic analytical question、encoding、scale、annotation、accessible alternative
- `motion-system` — interactive product/UI motion
- `kinetic-typography` — temporal text / reading semantics
- `compositing` — matte / blend / glow / grain / blur / final color integration
- #12 scene / trend Skill — visual grammar / scene vocabulary の選択

## Verify

source node graph ではなく final playback を確認する。

### Controlled fixture

少なくとも次を含む audio fixture を用意する:

- silence
- low-level steady tone
- loud steady tone
- isolated transient
- repeated transient
- low-frequency dominant section
- high-frequency dominant section
- broad-band / dense section
- gradual crescendo / decrescendo
- abrupt level change

必要なら追加する:

- tempo change
- syncopated rhythm
- vocal / speech
- live microphone noise

確認:

- intended feature だけが主に反応しているか
- silence で expected rest state に戻るか
- threshold 周辺で chatter しないか
- transient が visually late / early でないか
- sustained sound で unnecessary flicker がないか
- source level が変わっても useful response range が残るか

### Playback pass

normal speed で最初から最後まで見る。

- audio と visual cause/effect が追えるか
- response density が music density と競合していないか
- quiet / loud contrast が潰れていないか
- visual hierarchy が保たれているか
- camera/effect が primary mapping を覆っていないか
- long passage で fatigue / repetitive pumping がないか

### Frame / scrub pass

問題区間を frame / scrub で確認する:

- transient offset
- detector double-trigger
- response overshoot / clipping
- decay tail
- smoothing lag
- source switch / seek 後の stale state

### Effect-off pass

可能なら decorative treatment を弱める / 無効化して確認する。

- mapping の意味が残るか
- audio response と単なる particle density を区別できるか
- focal structure が effects に依存していないか

### Delivery pass

最終 export / playback environment で:

- target frame rate
- compressed video
- target aspect ratio
- target display size
- live projection / capture path where applicable

を確認する。

## Promotion gate

completed と扱う前に実 artifact で:

1. controlled fixture と実際の music/audio の両方を用意する。
2. materially different な少なくとも2 feature/mapping strategy を比較する。
3. mapping table に source feature、normalization、response envelope、visual owner、range を記録する。
4. normal playback + frame/scrub + silence/dense/transient checks を行う。
5. effect-off baseline と final treatment の両方を確認する。
6. live artifact なら latency / noise / level variance、offline artifact なら deterministic sync / export を確認する。
7. failure / adjustment / verification result を durable に記録する。

real artifact trial 未実施なら experimental / pending のまま残す。