# Audio Reactive Video References

Last reviewed: 2026-09-14

この reference は audio-reactive motion / video を、renderer preset ではなく **signal feature → temporal response → visual behavior** の関係として観察するために使う。

単一の visualizer / creator / software から style rule を一般化しない。signal-analysis source、production tooling、materially different audiovisual work を組み合わせて読む。

## 1. Signal analysis foundations

### W3C — Web Audio API 1.1

https://www.w3.org/TR/webaudio-1.1/

Observe:

- `AnalyserNode` が visualization 用に time-domain / frequency-domain data を提供すること
- FFT windowing / smoothing over time
- audio clock / sample-rate context
- implementation mechanism と visual-design decision の境界

Useful for:

- raw waveform / FFT spectrum がどの段階の evidence か整理する
- analysis window と temporal response を混同しない

Avoid copying:

- API defaultsを universal visual timing として固定しない

Current status note:

- Web Audio API 1.1 は current W3C Recommendation-track draft。version/status は適用時に再確認する。

### MDN — AnalyserNode

https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode

Related:

- https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize
- https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/smoothingTimeConstant

Observe:

- frequency data vs time-domain data
- `fftSize` と frequency/time detail の関係
- dB range
- temporal smoothing
- current browser-facing behavior

Useful for:

- Web implementation evidence
- smoothing が response lag / flicker に影響することを確認する

Avoid copying:

- example spectrum bars、default FFT size、default smoothing を design rule にしない

Current status note:

- `AnalyserNode` page was current as of 2026-08-22 when reviewed.

### Essentia — Algorithms overview

https://essentia.upf.edu/algorithms_overview.html

Useful detailed references:

- https://essentia.upf.edu/reference/streaming_OnsetDetectionGlobal.html
- https://essentia.upf.edu/reference/streaming_BeatsLoudness.html
- https://essentia.upf.edu/reference/streaming_SingleBeatLoudness.html
- https://essentia.upf.edu/reference/streaming_OnsetRate.html

Observe:

- waveform/FFTだけでなく Energy / RMS / spectral descriptors / tonal descriptors / rhythm descriptors が別の quantities であること
- onset、beat、band-energy 等がそれぞれ異なる analysis を必要とすること
- descriptor ごとの parameter / assumption / limitation

Useful for:

- 「音に反応」を一つの signal に潰さない
- derived feature と raw signal を区別する
- detector result を ground truth としない

Avoid copying:

- library algorithm の default sample rate / window / band を universal mapping にしない
- mood / genre / high-level classifier を無根拠に visual semantics へ直結しない

### librosa — spectral feature implementation reference

https://librosa.org/doc/main/_modules/librosa/feature/spectral.html

Observe:

- RMS、spectral centroid、spectral contrast 等が数学的に異なる descriptors であること
- frame / window / hop が time-varying feature に影響すること
- spectral centroid が単なる「high frequency amount」ではなく weighted distribution の中心として定義されること

Useful for:

- feature naming を曖昧な low/mid/high aesthetic label にしない
- visual mapping を作る前に measured property を確認する

Avoid copying:

- analysis parameter をそのまま animation duration / range に変換しない

## 2. Current production implementation evidence

### Resolume — Parameter Animation / Audio Analysis

https://www.resolume.com/support/parameter-animation

Observe:

- External / Composition / Clip / Layer / Group など source scope の違い
- Low / Middle / High または bounded frequency range の選択
- Gain
- Fall / decay
- signal が parameter value を直接 drive する場合と speed を drive する場合の違い

Useful for:

- audio source selection → frequency selection → gain → temporal fall → target parameter という mapping pipeline を観察する
- one FFT signal にすべてを接続しない理由を理解する

Avoid copying:

- UI の L/M/H 分割を universal frequency taxonomy にしない
- software parameter structure を Skill の design source of truth にしない

### TouchDesigner — Audio Spectrum CHOP

https://docs.derivative.ca/Audio_Spectrum_CHOP

Observe:

- time-domain audio から spectrum を作る処理
- FFT size / spectrum resolution
- visualization-oriented frequency scaling
- real-time compute / latency trade-off

Useful for:

- live visual pipeline の implementation evidence
- spectrum resolution と responsiveness の balance を考える

Avoid copying:

- operator graph や parameter values を reusable art direction とみなさない

Access note:

- documentation URL is direct; automated fetch may be blocked by the site, so open it in a browser when using the Skill.

## 3. Canonical / established audiovisual mappings

### Golan Levin & Ben Fry — Slamps

https://flong.com/archive/projects/slamps/index.html

Observe:

- room sound を microphone で分析し、frequency spectra と volume に応じて lamp の form / color が変わる
- amplitude だけではなく spectral property が異なる visual behavior を持つ
- architecture / display context が response grammar に影響する

Useful for:

- spectrum / volume → visual property の explicit mapping を観察する
- audio-reactive design が bar spectrum に限定されない evidence

Avoid copying:

- lamp geometry / exact colors / FFT implementation

### Tmema — Footfalls

https://flong.com/archive/projects/footfalls/index.html

Observe:

- foot-stomp sound を discrete interaction event として扱う
- harder stomp に対し virtual object の size / number が増える
- event strength と visual consequence の可読な因果関係

Useful for:

- continuous spectrum response と event/impact response の違い
- input intensity → bounded visual consequence の mapping

Avoid copying:

- falling-object metaphor 自体を universal response にしない

### Tmema — Messa di Voce

https://www.flong.com/archive/projects/messa_inst/index.html

Observe:

- speech / shout / song の nuance を differentiated graphics に変換する
- voice analysis と performer/body position が一つの audiovisual narrative を作る
- source content に応じて複数の visual behavior を使い分ける

Useful for:

- one-feature / one-effect では足りない expressive audio mapping
- audio property と performance context の関係

Avoid copying:

- signature vocal interaction / graphics を style recipe 化しない

## 4. Recent independent production evidence

### MAOTIK — SUPERPOSITION

https://www.maotik.com/superposition/

Production context:

- W1 Curates, London
- exhibited 2024

Observe:

- frequency と tempo など異なる sound data を分析する
- lines / cubic geometry の複数 layer が music の別の側面へ独立して反応する
- composition が simple → complex へ発展し、reactivity が structural progression と共存する
- site-specific multi-screen architecture と visual response の関係

Useful for:

- 一つの master amplitude ですべてをpumpさせない contemporary evidence
- reactive mapping と authored macro-composition を両立させる観察

Avoid copying:

- cubic geometry、screen layout、specific music、artist signature を reusable template にしない

## 5. Comparison axes

複数 reference を並べるときは最低限これを見る。

| Axis | Questions |
| --- | --- |
| Source | live mic / track / bus / stem / precomputed audio のどれか |
| Feature level | waveform / amplitude / spectrum / derived descriptor / semantic estimate のどれか |
| Temporal type | continuous modulation / threshold / onset / beat / discrete event のどれか |
| Window | 何秒・何sampleの情報が response に混ざるか |
| Smoothing | attack / averaging / hold / release / fall はどうなっているか |
| Range | normalization / threshold / clamp / gain はどう扱うか |
| Mapping | feature が position / scale / shape / density / color / speed / spawn / camera の何を drive するか |
| Ownership | primary / secondary / background のどこが反応するか |
| Hierarchy | stable anchor があるか、everything-reacts になっていないか |
| Silence | input がないとき何へ戻るか |
| Latency | audible event と visual event の offset は許容/意図されているか |
| Density | dense section で effect density が runaway しないか |
| Context | live / authored video / installation / projection で requirement がどう違うか |

## 6. Repeated findings

複数source間で反復して確認できること:

1. **audio feature は一種類ではない。** waveform、energy、spectrum、onset、beat、tonal descriptor は意味も temporal behavior も異なる。
2. **analysis 自体に時間幅がある。** FFT/window/smoothing/detector は response latency と detail を変える。
3. **mapping は別の design decision である。** audio analysis の値があるだけでは、scale / color / shape / spawn / speed のどれに割り当てるかは決まらない。
4. **response envelope が必要になる。** raw value 直結だけでなく gain / normalization / smoothing / fall / threshold が motion の性格を作る。
5. **reactivity と composition は分けられる。** strong examples は全画面を同じ signal でpumpさせず、反応主体と安定主体を持つ。
6. **event と continuous modulation は別問題。** Footfalls のような impact mapping と spectrum-driven continuous change を同じ trigger model にしない。
7. **tool capability は art direction ではない。** FFT node / operator / audio modifier は入力を作る手段であり、visual hierarchy の理由ではない。

## 7. Important failure modes

### Everything reacts

全 visual parameter が同じ amplitude / FFT で動く。

Result:

- hierarchy 消失
- constant pumping
- every beat の均質化
- visual fatigue

Check:

- primary reactive owner を説明できるか
- stable anchor が残るか

### Wrong feature, plausible motion

見た目は音に合うが、意図した property と feature が一致していない。

Examples:

- peak amplitude だけで sustained intensity を表す
- broad frequency band だけで instrument identity を断定する
- beat detector を transient detector の代わりに使う

Check:

- feature definition を説明できるか
- controlled fixture で分離できるか

### Latency hidden by smoothing

jitter を抑えるため smoothing を増やし、audible transient より visual response が遅れる。

Check:

- frame/scrub で offset を測る
- smoothing before/after を比較する

### Noise-floor animation

silence / quiet section でも reaction が止まらない。

Check:

- actual silence fixture
- live mic idle state
- threshold / floor / decay-to-rest

### Overfit normalization

一曲に合わせた gain が別 source で dead / clipped response になる。

Check:

- quiet/loud fixtures
- materially different tracks
- live variance where applicable

### Decorative evidence

particle / glow / camera shake が強く、どの audio property が何を drive しているか説明できない。

Check:

- effect-off baseline を見る
- mapping table と artifact を照合する

## 8. Verification reference fixture

Skill を実 project で試す際は最低限:

```text
00 silence
01 quiet steady low-frequency tone
02 loud steady low-frequency tone
03 quiet steady high-frequency tone
04 loud steady high-frequency tone
05 isolated transient
06 repeated transients at known intervals
07 gradual crescendo
08 gradual decrescendo
09 abrupt level change
10 dense broadband passage
```

を含む controlled audio を用意する。

目的は synthetic fixture を作品に使うことではなく、mapping が何へ反応しているかを artifact 上で診断可能にすること。

実楽曲でも別途 full playback し、fixture では現れない phrase / density / dynamics / fatigue を確認する。