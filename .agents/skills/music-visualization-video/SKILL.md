---
name: music-visualization-video
description: >
  Use when designing authored 2D visual music or music visualizations that translate musical form,
  phrase, repetition, timbre, layer, tension, and long-range development into visual composition.
  Keep musical interpretation distinct from signal-driven audio reactivity, MIDI-event visualization,
  lyric timing, and music-release promotion, then verify the complete playback against a musical/form map.
---

# Music Visualization Video

音を「反応させる入力」だけとして扱わず、**楽曲の phrase / section / layer / timbre / repetition / tension-release / long-range development を、時間を持つ visual composition へ翻訳する**。

この Skill の中心は `music → visual form` の correspondence 設計である。FFT / amplitude / onset 等から parameter を駆動する処理は `audio-reactive-video`、MIDI note event を読める構造へ変換する処理は `midi-video`、歌詞の時間設計は `lyric-video`、release campaign は `music-promo-video` を canonical source とする。

## Workflow

1. source music と、viewer に感じ取らせる / 読み取らせる musical relationship を決める。
2. [runtime reference](./references/music-visualization-video.md) を開き、canonical visual-music works と materially different current works を比較する。
3. signal / symbolic event / musical-form interpretation / associative interpretation を区別する。
4. phrase / section / recurrence / climax / ending を含む music map を作る。
5. musical unit と visual unit の対応、stable motif と variation の範囲を決める。
6. normal-speed full playback と section comparison、representative-frame、final export で検証する。

## When to use

使用する:

- abstract / non-narrative music visualization
- visual music / audiovisual animation
- full-track / long-form visualizer を authored composition として設計する場合
- phrase / section / timbre / instrumentation / musical development を visual motif や scene development に翻訳する場合
- audio-reactive technique を使っていても、最終判断が song-level / form-level composition にある場合
- narrative より music-image correspondence が中心の experimental music video

自動適用しない:

- waveform / spectrum / amplitude / onset / beat 等の signal mapping 自体が中心 → `audio-reactive-video`
- note / pitch / duration / part 等の structured MIDI relation が中心 → `midi-video`
- lyrics / vocal text の可読 timing が中心 → `lyric-video`
- teaser / announcement / platform / campaign role が中心 → `music-promo-video`
- recognizable MV scene/trend vocabulary の選択が中心 → #12 系 Skill

## Inspect

実装前に確認する:

- source は full track / excerpt / movement / album sequence のどれか
- composition 上の major section / phrase / return / break / climax / ending はどこか
- music-image relation を viewer が明確に読める必要があるか、associative でよいか
- primary musical owner は melody / rhythm / harmony / texture / instrumentation / vocal / overall form のどれか
- exact hit sync が必要な箇所と、phrase-level / section-level correspondence でよい箇所
- repeated musical material が同一か、variation / orchestration / intensity が変化しているか
- silence / rest / sustain / sparse passage を visual state として扱えるか
- target duration / frame / aspect ratio / viewing size / playback context

## Observe

### 1. Interpretation level

最初に何を visualized しているかを区別する。

- **signal** — waveform、energy、spectrum、detected onset 等
- **symbolic event** — note onset/release、pitch、duration、part 等
- **musical structure** — phrase、section、refrain、development、reprise、climax、cadence
- **perceptual / associative reading** — weight、tension、surface quality、spatial feeling、emotional state、imagined environment

この Skill は主に後者2つを扱う。

signal / event を evidence として使ってよいが、signal mapping の存在だけで musical interpretation が成立したとみなさない。

### 2. Musical scale

対応させる単位を混同しない。

- attack / gesture
- beat / pulse group
- measure-like unit
- phrase
- section
- movement
- whole track

すべてを最小単位へ分解して反応させない。長い phrase や section が意味を持つ場合、その時間幅を visual composition の単位として保持する。

### 3. Form / section map

最低限、timeline 上で以下を特定する:

- introduction / opening state
- phrase boundaries
- major section change
- recurring section / refrain / reprise
- break / sparse state
- buildup
- climax / maximum structural contrast
- release / resolution
- ending / tail

verse / chorus 等の名称が source に合わない場合は無理に当てはめず、A / B / return / development のような実際の構造で記録する。

### 4. Phrase duration and visual duration

short note や beat ではなく phrase が主語なら、visual gesture / shot / state の長さも phrase relationship を反映できる。

見る:

- phrase start / continuation / closure
- phrase間の overlap / pickup / anticipation
- visual state change が音楽より早すぎないか、遅すぎないか
- phrase終端まで意味が持続する visual owner があるか

cut 数を BPM から機械的に決めない。

### 5. Recurrence / variation

同じ musical material が戻るときは visual identity の retention を検討する。

保持候補:

- motif / silhouette
- spatial relation
- palette family
- material / texture family
- motion direction / rhythm family
- framing / composition anchor

変化候補:

- scale
- density
- deformation
- palette state
- layer count
- spatial regime
- secondary motif

完全コピーでも全面刷新でもなく、音楽上の「同じもの」と「変化したもの」に対応して variation を決める。

### 6. Musical layer ownership

すべての audible event に別 object を割り当てない。

見る:

- primary musical layer
- supporting layer
- background texture / ambience
- transient accent
- stable harmonic / pedal / drone layer
- voice / instrument entry and exit

visual hierarchy も layer hierarchy を持つ。主役が変わる場合は visual ownership の handoff を明確にする。

### 7. Timbre / articulation / texture

音色を固定の色辞書へ変換しない。

観察する:

- hard / soft attack
- sustained / percussive
- dry / reverberant
- dense / porous
- smooth / granular
- stable / noisy
- bright / dark spectral impression

これらを shape edge、material、continuity、density、spatial depth、deformation 等へ翻訳できるが、source固有の relation として成立させる。

### 8. Rhythm and micro-sync

exact synchronization は一つの手段であり、quality metric そのものではない。

区別する:

- exact onset hit
- repeated pulse alignment
- phrase-level rhythmic character
- syncopation / off-beat relation
- deliberate visual lag / anticipation
- independent visual rhythm that still supports musical form

every beat flash / zoom / cut へ縮退させない。

### 9. Density / rest / silence

quiet / sparse / sustained passage でも motion を埋め続けない。

visual options:

- hold
- reduced density
- fewer active owners
- slower transformation
- negative space
- residual trail / decay
- static or nearly static state

silence を error / no-data state と扱わない。

### 10. Tension / release / climax

loudness だけで climax を定義しない。

見る:

- harmonic / rhythmic / textural accumulation
- register / instrumentation expansion
- phrase shortening / extension
- repetition pressure
- density
- unresolved continuation
- release / cadence / decay

visual climax も単なる「最大scale / 最大effect量」にせず、これまでの vocabulary がどう集約・破壊・反転・解放されるかを見る。

### 11. Visual vocabulary

piece 全体で stable な grammar を持つ。

候補:

- form family
- palette logic
- material logic
- spatial model
- transformation family
- compositional anchor
- motif recurrence

section change のたびに別style presetへ交換しない。大きな grammar change は musical structure 上の根拠を持たせる。

### 12. Associative interpretation

literal mapping が不要な場合でも「何となく雰囲気」で終えない。

例えば:

```text
musical observation
→ perceptual reading
→ visual property
→ section behavior
```

の関係を説明できるようにする。

associative visual は source の mood / texture / motion character を拡張できるが、creator固有の imagery を style command としてコピーしない。

## Decision rules

### Build the macro map before micro-sync

最初に full-track / section-level structure を固定する。

その後に必要な箇所だけ:

- onset sync
- accent
- beat subdivision
- reactive modulation

を追加する。

micro-sync が macro-form を見えなくする場合は減らす。

### Give each recurrence an identity contract

repeated section ごとに:

- retained property
- changed property
- reason for change

を決める。

source 上でほぼ同じなのに visual が無関係へ飛ぶ、または source が大きく発展しているのに同じ loop を貼り直す状態を避ける。

### Choose correspondence strength deliberately

各主要 section / motif について、relation がどの程度 literal かを決める。

- legible / structural
- material / timbral
- spatial / kinetic
- associative / emotional

associative interpretation を分析的 data visualization のように提示しない。

### Use few owners before adding detail

まず primary musical relationship を1–3個程度の visual owners / systems で成立させる。

追加する layer ごとに:

- 新しい musical distinction を表しているか
- existing owner と競合しないか
- full playback の hierarchy を改善するか

を確認する。

固定数を universal rule にはしない。

### Let stillness carry structure

motion がない区間も composition の一部にする。

hold / near-static state が phrase closure、rest、anticipation、sustain に合う場合は、常時 movement より優先できる。

### Keep downstream techniques downstream

camera move、transition、loop closure、glow / blur / grain / particle は music-image correspondence 自体ではない。

- shot内 view behavior → `camera-effects`
- scene boundary → `transition-design`
- loop closure → `loop-animation`
- final treatment → `compositing`

を併用し、effect量で musical reading の弱さを隠さない。

## References

実作業では [runtime reference](./references/music-visualization-video.md) を開き、少なくとも canonical/historical reference と、materially different な current production reference を複数比較する。

## Avoid

- every beat を flash / scale / cut にする
- BPM から cut interval を自動決定して form design の代わりにする
- loudness = importance / climax と固定する
- bass = 大きい形、treble = 小さい形、特定楽器 = 特定色等を universal rule にする
- waveform / FFT / particle visualizer があるだけで musical structure を可視化できたとみなす
- MIDI event と acoustic/perceptual meaning を混同する
- section change ごとに unrelated style を切り替える
- repeated section を意味なく完全コピーする
- repeated material の recognizable anchor を毎回捨てる
- silence / sustain を filler motion で埋める
- 全 instrument / event を同時に独立 animation して hierarchy を失う
- climax を effect量の最大化だけで作る
- creator固有の shape / palette / character / exact timing を模倣する
- final playback を見ず、timeline / keyframe 配置だけで完成扱いする

## Responsibility boundaries

- `audio-reactive-video` — waveform / energy / spectrum / onset / beat estimate 等の analyzed signal feature → visual parameter mapping
- `midi-video` — MIDI note / time / pitch / duration / part / expression 等の structured event visualization
- `music-visualization-video` — musical form / phrase / layer / timbre-texture / recurrence / tension-release / long-range development → authored visual composition
- `lyric-video` — approved lyrics、vocal timing、repeated lyric section、voice ownership、full-song lyric readability
- `music-promo-video` — release lifecycle、excerpt selection、reveal budget、campaign family、platform role
- `kinetic-typography` — text の temporal meaning / reading behavior
- `camera-effects` — shot 内の viewer-facing view behavior
- `transition-design` — authored scene / shot boundary
- `loop-animation` — repeat unit / closure / seam / entry-exit
- `compositing` — matte / blend / edge / grain / blur / final integration
- #12 scene/trend Skill — recognizable scene vocabulary / trend grammar

## Verify

source timeline ではなく、音付きの final representation を最初から最後まで確認する。

### Music-map pass

実装前後で同じ map を使って比較する:

```text
time range
→ musical function / observation
→ visual state / owner
→ retained motif
→ intentional change
→ sync requirement
```

確認:

- major phrase / section boundary が意図通り visual state に反映されるか
- recurrence の retained / changed property が説明できるか
- climax / release / ending が piece 全体の development と整合するか

### Full playback pass

normal speed で最初から最後まで見る。

- 30秒程度の局所 loop ではなく long-range development が感じ取れるか
- micro-sync が attention を奪いすぎていないか
- repeated material が recognizable か
- variation が musical development と対応しているか
- sparse / silent passage に breathing room があるか
- visual intensity が最初から最後まで均一でないか
- visual grammar が途中で無根拠に交換されていないか
- ending が accidental cutoff に見えないか

### Section comparison pass

同一 / 類似 section を並べて比較する。

- motif identity
- palette / material family
- spatial relation
- density
- primary owner
- changed orchestration / intensity への response

「同じだからコピー」「違うから全交換」の二択にしない。

### Frame / scrub pass

representative point を静止確認する:

- opening state
- first clear motif
- recurring section
- sparse / rest point
- transition midpoint
- climax
- resolution / final state

normal playback で自然でも single frame で composition / hierarchy が破綻していないかを見る。

### Sync pass

exact sync を主張する箇所だけ frame / waveform / event evidence と照合する。

- intended onset offset
- anticipation / lag が意図的か
- encode 後に A/V drift がないか

associative passage を frame-accurate sync の基準で誤評価しない。

### Delivery pass

最終 encoded output で:

- target frame rate
- aspect ratio / crop
- target display size
- compression
- audio start/end
- silent leading/trailing frame
- playback restart

を確認する。

aspect variant を作る場合は center crop だけで primary motif / section relationship が壊れないかを見る。

## Promotion gate

completed / promoted と扱う前に real artifact で:

1. complete track または structurally meaningful な長さの source を使う。
2. phrase / section / recurrence / climax / ending を含む music map を作る。
3. materially different な少なくとも2つの correspondence strategy を比較する。
4. 採用案について retained motif / variation / musical layer ownership を記録する。
5. normal-speed full playback、section comparison、representative-frame、sync claim、final encoded output を確認する。
6. `audio-reactive-video` または `midi-video` を併用した場合も、signal/event mapping と musical-form interpretation を別々に検証する。
7. failure / adjustment / verification result を durable に記録する。

real artifact trial 未実施なら experimental / pending のまま残す。
