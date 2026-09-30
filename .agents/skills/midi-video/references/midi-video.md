# MIDI Video References

Last reviewed: 2026-09-14

この reference は renderer 操作を覚えるためではなく、MIDI event semantics と複数の visualization grammar を比較するために使う。

## MIDI semantics / timing

- [The MIDI Association — Summary of MIDI 1.0 Messages](https://midi.org/summary-of-midi-1-0-messages)
  - Observe: Note On / Note Off、Control Change、Pitch Bend、channel voice message の責務。
  - Useful for: source event と visual encoding の意味を混同しないための protocol anchor。
  - Avoid copying: byte-level implementationを visual design rule にしない。

- [The MIDI Association — MIDI 1.0 Control Change Messages](https://midi.org/midi-1-0-control-change-messages)
  - Observe: controller data が note event と別の expression stream であること、controller ごとに意味が異なること。
  - Useful for: CC を auxiliary visualization として扱う判断。
  - Avoid copying: 全 CC を可視化すること、0–127 をそのまま opacity / size に universal mapping すること。

- [The MIDI Association — The State of MIDI 2.0: High-Resolution Performance and the Rise of Profiles](https://midi.org/the-state-of-midi-2-0-high-resolution-performance-and-the-rise-of-profiles-update-feb-2026)
  - Observe: MIDI 2.0 で velocity / controller / pitch / per-note expression の resolution と capability が拡張されていること。
  - Useful for: MIDI 1.0 の 7-bit 前提を timeless rule にしないための current-status evidence。
  - Avoid copying: high resolution 自体を visual complexity の理由にしない。

- [The MIDI Association — Details about MIDI 2.0, MIDI-CI, Profiles and Property Exchange](https://midi.org/details-about-midi-2-0-midi-ci-profiles-and-property-exchange-updated-june-2023)
  - Observe: sequence timing / Delta Clockstamp と MIDI 1.0 / MIDI 2.0 file semantics の違い。
  - Useful for: event time を frame / seconds へ変換するとき timing model と tempo を確認すること。
  - Avoid copying: transport / packet implementationを motion grammar にしない。

## Production editor representations

- [Apple Logic Pro User Guide — Edit notes in the Piano Roll Editor](https://support.apple.com/guide/logicpro/edit-notes-in-the-piano-roll-editor-lgcpb19f2d0d/mac)
  - Observe: horizontal time、vertical pitch、note length、velocity representation の分離。
  - Useful for: conventional piano-roll encoding を production evidence として確認すること。
  - Avoid copying: Logic の UI chrome、exact colors、editor interaction。

- [Ableton Live Manual — Editing MIDI](https://www.ableton.com/en/live-manual/12/editing-midi/)
  - Observe: note geometry と velocity / expression editor を別 lane として扱えること。
  - Useful for: expression を note geometry に詰め込まない alternative。
  - Avoid copying: Live の workflow / shortcuts / theme。

## Canonical graphical-score evidence

- [Stephen Malinowski — Music Animation Machine](https://www.musanim.com/)
  - Observe: animated graphical score という artifact family と、同じ music data から複数 renderer / visual model を作る姿勢。
  - Useful for: falling notes 一択ではないことを確認する。
  - Avoid copying: creator 固有の color / camera / geometry vocabulary。

- [Music Animation Machine — Background / techniques](https://www.musanim.com/Background/)
  - Observe: color、harmony / tonality、scrolling、multiple time scales、sync を別々の visualization decisions として研究していること。
  - Useful for: time scale、color、harmony、surprise/effect を一つの preset に束ねない判断。

- [Music Animation Machine MIDI Player](https://www.musanim.com/Player/)
  - Observe: original bar graph、circle-of-fifths、interval、harmonic staff、part motion など materially different な visualization model。
  - Useful for: question / musical relation に応じ representation を切り替える比較 evidence。

- [Music Animation Machine Player User Guide](https://www.musanim.com/Player/MAMPlayerUserGuide.pdf)
  - Observe: original display では time を horizontal、pitch を vertical、color を part または pitch class に割り当てられること。
  - Useful for: time / pitch / part-color が独立した encoding decision である evidence。
  - Avoid copying: exact orientation / color wheel を universal rule にしない。

- [Stephen Malinowski — Harmonic Coloring](https://www.musanim.com/mam/circle.html)
  - Observe: color mapping が harmonic model と tonic assumption を持つこと。
  - Useful for: color-by-pitch は neutral default ではなく analytical model であることの evidence。
  - Avoid copying: twelve-color mapping を普遍的 pitch palette として適用すること。

- [Seeing Music — the art of Stephen Malinowski](https://www.musanim.com/mam/rustarticle.html)
  - Observe: early graphical score で horizontal line length = duration、height = pitch、color = instrument とした mapping と、その後 animated form へ発展した経緯。
  - Useful for: data-bearing dimensionsを明示してから animation を足す考え方。

## Current production / application evidence

- [SeeMusic — Features](https://www.seemusicapp.com/)
  - Observe: MIDI / MusicXML / live input、timing / velocity / note placement、2D/3D falling notes、particles / reactive lighting、preview、vertical / square / widescreen export が別機能として存在すること。
  - Useful for: structural note visualization と decorative effect、delivery format を別 decision として扱う evidence。
  - Avoid copying: proprietary effect vocabulary / renderer controls。

- [Synthesia — Sheet Music and Falling Notes](https://synthesiagame.com/support/guide/fallingNotes)
  - Observe: sheet music と falling-note view を別 display layer として選択できること。
  - Useful for: keyboard-collision / falling-note representation は MIDI data model そのものではないという current product evidence。
  - Avoid copying: game-specific scoring / UI。

## Comparison axes

reference を開いたら、少なくとも次を比較する。

- time axis / now anchor / lookahead
- pitch axis / register / pitch-class treatment
- onset / release / duration geometry
- chord / simultaneity readability
- repeated / overlapping note separation
- part / voice / track grouping
- velocity / controller / pitch-bend encoding
- raw event vs derived harmony / phrase analysis
- long-range context vs local performance detail
- color semantics and redundant grouping cues
- camera / scrolling / time-scale behavior
- effect density vs event readability
- audio-event synchronization
- aspect-ratio transformation

## Failure modes to watch

- MIDI 1.0 resolutionを current MIDI 全体へ固定する
- velocity を acoustic loudness と断定する
- channel / track を musical instrument / voice と同一視する
- tempo / timing resolution を無視して frame mapping する
- decorative trails / particles で note end を誤認させる
- derived chord / key analysis を raw MIDI fact として表示する
- falling notes / pitch-color / keyboard mapping を universal visual grammar とする
- 9:16化で pitch range / lookahead / labels を単純 crop する