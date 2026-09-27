---
name: music-promo-video
description: >
  Use when designing video assets around a music release campaign. Plan campaign phase,
  audio excerpt, reveal budget, release identity, asset-family continuity, and platform-specific
  adaptations for teasers, announcements, release-day pieces, social shorts, and streaming loops.
---

# Music Promo Video

music promo を「曲に派手な映像を付けること」や generic な beat-sync motion として扱わない。

この Skill は、**music release の campaign phase、audio excerpt、reveal budget、visual identity、asset family、platform role を一貫した rollout へ翻訳する**ために使う。

汎用 promotional structure は `promotional-video`、full-song の approved lyric / vocal structure は `lyric-video`、audio signal → visual parameter mapping は `audio-reactive-video`、MIDI event visualization は `midi-video`、loop の seam / closure は `loop-animation` が source of truth である。

## When to use

使用する:

- single / EP / album の teaser
- release announcement / date reveal
- release-day / out-now video
- post-release reminder / catalog reactivation
- short-form social cut
- streaming service の now-playing / looping visual
- music visualizer を campaign asset として使う場合
- cover artwork / artist imagery / video / motion を複数 touchpoint へ展開する release campaign

自動適用しない:

- full music video の narrative / scene grammar
- 歌詞理解が主要目的の full-song video
- generic product / service promo
- waveform / spectrum / onset 等を visual parameter へ直接 mapping する作業

## Workflow

1. release unit、campaign phase、audience state、delivery surface を確認する。
2. `references/music-promo-video.md` の current platform guidance と複数 production campaign を実際に開く。
3. campaign job と reveal budget を先に決める。
4. audio excerpt と visual source を選ぶ。
5. asset family の共通 identity と、各 surface で変える部分を定義する。
6. teaser → announcement → release → post-release の progression を必要範囲で設計する。
7. platform overlay / metadata / loop / crop を考慮して各 asset を recompose する。
8. final audio を使った normal-speed playback と exported delivery variants を確認する。

## Inspect

最初に確認する:

- release は single / EP / album / anniversary / catalog moment のどれか
- release date と campaign calendar
- pre-release / release-day / post-release のどの phase か
- approved master / excerpt / artwork / logo / artist image / music-video material
- audience が artist / song / campaign motif を既に知っているか
- cover / single artwork / profile / merch / music video 等の既存 visual language
- reveal してよい title / artwork / artist / footage / lyric / hook の範囲
- platform が artist / title / artwork / CTA を既に表示するか
- sound が必ず再生される surface か、silent preview があり得るか
- target aspect ratio / safe area / overlay / loop behavior
- campaign message が `pre-save`, date, `out now`, listen/watch 等のどの状態か

時間依存の campaign state を artifact 内へ hard-code する場合は、公開時点と終了条件を確認する。

## Observe

### Campaign phase / job

reference ごとに、video が何を担当しているかを見る。

- **teaser** — mood / motif / recognizable fragment を提示し、全体をまだ確定しすぎない
- **announcement** — release identity、title/date 等を明確化する
- **release-day** — music/release が利用可能になったことを理解させる
- **post-release** —別 hook、performance、story、catalog connection 等から再接触する
- **now-playing loop** — listening 中の track と visual world を継続する

同じ visual treatment を phase 名だけ変えて再利用しない。

### Audience state / reveal budget

見るもの:

- viewer が既に artwork / title / chorus / artist image を見たことがあるか
- teaser が何を隠し、何を識別 anchor として見せるか
- announcement で何を初めて確定するか
- release 後に secrecy を維持する意味が残っているか
- major music-video shot / artwork reveal を campaign のどこで使うか

mystery を品質としない。認知に必要な情報まで隠さない。

### Audio excerpt

excerpt を単なる background music として選ばない。

比較する:

- intro / verse / pre-chorus / chorus / bridge / instrumental / outro
- lyric hook / melodic hook / rhythmic hook / texture
- recognition speed
- excerpt の開始点 / 終了点
- cut の途中で phrase / cadence が不自然に切れないか
- visual reveal と musical reveal の関係
- teaser と release-day で同じ excerpt を使う意味があるか

最も音量が大きい drop や chorus を自動的に採用しない。

### Visual source

候補を区別する:

- artist performance / portrait
- release artwork / graphic motif
- music-video footage / narrative fragment
- archive / behind-the-scenes / studio material
- typography / date / title / credits
- visualizer / abstract material
- product-like object: record / cassette / package / merch

複数 asset で同じ source を使ってもよいが、同じ edit を別比率へ crop するだけにしない。

### Asset-family continuity

coherence を exact frame repetition と同一視しない。

維持候補:

- motif / symbol
- type relationship
- image treatment
- color/material logic
- transition language
- framing logic
- recurring object / archive source
- artist portrayal

変化候補:

- pace
- shot role
- text density
- reveal amount
- audio section
- camera / edit rhythm
- format composition

campaign は同じ世界に見えつつ、asset ごとの job を識別できるようにする。

### Platform role / metadata ownership

platform が既に提供する情報を観察する。

- artist name
- track title
- cover
- playback control
- share / save / pre-save
- caption / UI overlay

同じ metadata を video 内で反復する必要があるかを判断する。

Spotify Canvas のように listening UI 内で track metadata が既に存在する surface では、title/artist を大きく再掲することを default にしない。

### Sound-on / silent-preview

music asset では audio 自体が primary content になり得る。

ただし silent autoplay / feed preview が想定される surface では、目的に必要な最低限の release identity / visual hook が音なしでも残るか確認する。

全 asset を generic caption-heavy silent ad に変えない。

## Decision rules

### 1. Visual style より campaign job を先に決める

同じ曲でも teaser、announcement、release-day、post-release では viewer に必要な情報が違う。

`teaser = glitch`, `release = fast cuts` のような style preset から開始しない。

### 2. Audio excerpt を editorial decision として選ぶ

excerpt は次の複数条件から選ぶ。

- campaign phase の情報量
- audience recognition
- lyric / melody / rhythm の hook
- visual reveal との対応
- length / loop / cut behavior
- artist / label が reveal 可能とした範囲

beat に合わせやすいことだけを理由にしない。

### 3. Beat sync を visual system 全体にしない

music との temporal relationship には複数種類がある。

- exact accent sync
- phrase / section alignment
- counter-rhythm
- long hold against dense music
- visual change only at major structural beat
- atmosphere with weak local synchronization

全 element を kick / snare へ反応させる必要はない。
signal-driven behavior が主目的なら `audio-reactive-video` を使う。

### 4. Pre-release では reveal budget を設計する

teaser は final artifact の縮小版である必要はない。

- campaign motif を先に提示する
- artist / artwork / footage の一部だけを使う
- later asset が初見として機能する余地を残す

一方、release の identity が分からないほど情報を削らない。

### 5. Campaign identity は medium-specific に翻訳する

Jade Bird の campaign のように同じ concept を video、artwork、print で同じ処理にせず、それぞれの medium に適した material / motion へ変換できる。

共通 concept を保持し、exact effect / frame / composition の複製を要求しない。

### 6. Platform rule を universal rule にしない

Spotify Canvas の duration / UI behavior、YouTube Shorts の distribution role 等は platform adapter である。

- current platform guidance を task 時点で再確認する
- platform-specific safe area / duration / metadata behavior は current delivery にだけ適用する
- 一つの platform rule を campaign 全 asset の creative principle に昇格させない

### 7. Release-state text を lifecycle として扱う

`pre-save`, `tomorrow`, date, `out now`, `listen now` は同時に使える decoration ではない。

publication timing に応じて state を切り替え、post-release asset に stale pre-release wording を残さない。

### 8. Artist presence を必須にしない

artist performance / portrait は強い identity source だが、すべての release が lip-sync / portrait teaser を必要とするわけではない。

artwork、archive、object、graphic motif、visualizer だけで campaign identity が成立する場合もある。

## Responsibility boundaries

- `promotional-video` — generic objective / hook / promise / proof / CTA / sound-on-off / safe-zone / cross-format promo structure
- `music-promo-video` — music release phase、audio excerpt、reveal budget、release identity、asset-family progression、music-platform role
- `lyric-video` — approved lyrics、vocal timing、section grammar を含む full-song lyric-led video
- `audio-reactive-video` — audio feature analysis と visual parameter mapping
- `midi-video` — MIDI event relationship の readable visualization
- `loop-animation` — seamless / intentional loop closure、entry/exit、repeat fatigue
- `kinetic-typography` — text 自体の temporal behavior
- full music-video narrative / scene grammar —この Skill の canonical responsibility 外

## References

runtime research は [`references/music-promo-video.md`](./references/music-promo-video.md) を読む。

current platform behavior は task のたびに official source を再確認する。production artifact は style template としてコピーせず、campaign phase、identity continuity、reveal、medium translation の比較に使う。

## Avoid

- music があるという理由だけで waveform / particle / equalizer を追加する
- 全 element を beat に同期する
- teaser を完成 music video の短い切り抜きに固定する
- pre-release asset で later reveal を理由なく消費する
- mystery のため release identity まで読めなくする
- streaming UI が既に表示する metadata を無条件に video 内で重複する
- one master edit を全 platform へ center crop する
- artwork / video / social asset を exact frame repetition だけで統一する
- trend / creator 固有 effect を campaign identity とみなす
- `pre-save` / date / `out now` を公開時期と無関係に残す
- full lyrics を promo text として扱い `lyric-video` の責務を重複させる
- platform-specific duration を universal rule にする

## Verify

source timeline の完成だけで終わらず、実際の release asset family を確認する。

### Campaign-role review

少なくとも今回作る asset ごとに記録する:

- campaign phase / job
- audience state
- audio excerpt
- reveal amount
- visual source
- release-state message
- target platform / ratio

複数 asset がある場合、横並びにして「同じ campaign に見えるか」「同じ動画の反復に見えないか」の両方を見る。

### Playback

final / approved audio で normal speed 再生する。

- excerpt の開始/終了が musical phrase を不自然に壊していない
- visual reveal と audio section の関係が意図どおり
- text がある場合、読む前に消えない
- beat-sync が過密で music の hierarchy を平坦化していない
- teaser が必要以上に final material を reveal していない
- release-day asset で release identity が十分明確

### Silent-preview check

silent feed があり得る surface では mute でも確認する。

-何の campaign か理解するための visual anchor がある
-音なし対応のために画面を説明 text で埋めていない

### Platform / overlay check

実 platform の current UI / preview / safe area を確認し、必要なら screenshot / device preview で:

- artist/title metadata との重複
- caption / controls / buttons との collision
- focal subject の crop
- release-state text の位置
- readability at actual size

を確認する。

### Loop assets

Canvas 等の loop asset は 3回以上連続再生して fatigue / seam / reset を見る。
closure 自体の detailed rule は `loop-animation` に従う。

### Exported variants

必要な 16:9 / 9:16 / 1:1 / platform-specific variant を実際に encode し:

- crop / recomposition
- compression
- text / thin detail
- audio sync
- first / final frame
- platform thumbnail / preview state

を確認する。

### Real artifact trial gate

promotion 前に、少なくとも一つの実 release / representative fixture で次を通す。

1. campaign job map
2. approved audio + artwork / visual source inventory
3. excerpt / reveal decisions
4. minimum 2 materially different delivery roles（例: teaser + now-playing loop、announcement + release-day short）
5. final playback
6. platform overlay / target-size inspection
7. exported artifact inspection
8. observed failure / refinement の記録

この trial が未実施なら initial implementation を completed / promoted と扱わない。
