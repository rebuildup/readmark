---
name: camera-effects
description: >
  Use when designing or reviewing authored 2D animation, motion graphics, or video where shot-level view behavior—framing movement,
  focus transfer, shake, roll, zoom/FOV-like treatment, or other camera-owned emphasis—must guide attention or meaning without becoming a generic cinematic preset.
---

# Camera Effects

`camera-effects` は pan / zoom / shake preset を追加する Skill ではない。

**Shot purpose → View owner → Start/end framing → Camera behavior → Attention/readability → Playback verification**

画面内の subject を動かすのではなく、**viewer が scene をどう見るか**を shot 内で設計する。

`2d-parallax` が plane / depth / occlusion と camera-relative geometry を担当し、`compositing` が blur / grain / glow / chromatic treatment 等の最終統合を担当するのに対し、この Skill は **framing path、camera-owned movement、focus handoff、shake、roll、zoom/FOV-like emphasis** の意味と時間構造を担当する。

## When to use

対象:

- authored 2D animation / motion graphics / video の shot 内 camera movement
- subject を追う / reveal する / approach・withdraw する framing
- push / pull / pan / vertical reframe / tracking-like movement
- zoom / crop / angle-of-view-like emphasis
- roll / tilted view を使う shot
- rack-focus / focal handoff を模した attention transfer
- impact / turbulence / instability を表す camera shake
- text / UI / illustration / footage を含む shot で camera treatment が readability に影響する場合

主 source of truth にしないもの:

- 3D scene layout / 3D camera rigging / 3D rendering
- physical camera rig / lens purchase / shooting operation
- multiplane plane segmentation / hidden-region reconstruction
- cut / transition between shots
- matte / grain / bloom / chromatic aberration / color matching 自体
- interactive Web / mobile UI motion

## Workflow

1. **Inspect shot context** — subject、message、duration、audio、aspect ratio、source resolution、既存 camera / layer motion を確認する。
2. **State the view purpose** — follow、reveal、approach、withdraw、reframe、attention transfer、destabilize、scale/power、perceptual distortion のどれを担うか言語化する。
3. **Open references** — [`references/camera-effects.md`](references/camera-effects.md) の official / production reference を複数比較する。
4. **Choose motion ownership** — camera、subject、world layer、transition のどれが screen-space movement を所有するか分ける。
5. **Define framing states** — start / key moment / end の subject size、position、negative space、focal region を決める。
6. **Choose one primary camera behavior** — static / reframe / track / push-pull / zoom-like / roll / focus transfer / shake を purpose から選ぶ。
7. **Shape temporal response** — onset、acceleration、cruise、settle、impact、recovery を shot rhythm に合わせる。
8. **Protect information** — text / UI / face / product / focal detail が movement 中に失われないようにする。
9. **Check spatial credibility** — depth-aware move が必要なら `2d-parallax` へ渡し、単純 scale/crop で perspective change を偽装しない。
10. **Verify delivered playback** — normal-speed playback → motion extremes / focus change / impact frames → final encoded output の順に確認する。

## Observe

reference では effect 名より以下を見る。

### View purpose

- viewer に何を見せ始め、何を見せ終えるか
- follow / reveal / approach / withdraw / reframe のどれか
- attention を一箇所に固定するか、別の場所へ移すか
- 安定 / 不安定 / intimacy / distance / scale / power のどれを camera が担うか
- camera が動かないことに意味があるか

### Framing trajectory

- start framing
- end framing
- subject scale
- subject position
- headroom / surrounding context / negative space
- frame edge から出入りする情報
- movement 中の visual hierarchy

start と end が良くても途中で focal subject を失う場合は成立していない。

### Motion ownership

screen-space displacement が何由来かを分ける。

- camera / view
- subject / character / object
- background / environment layer
- transition between shots
- compositing/effect distortion

camera と subject を同時に同方向へ動かして accidental drift を作らない。

### Path / axis

- horizontal / vertical / diagonal reframe
- toward / away from subject
- lateral follow / track
- rotation / roll
- compound path
- subject lock vs environment reveal

複合 movement は、各 component の役割が説明できる場合だけ使う。

### Temporal profile

- movement onset
- acceleration / deceleration
- steady movement
- stop / settle
- overshoot / correction when intentional
- impact response
- recovery to stable view

camera easing を generic smoothness preset にしない。

### Zoom / viewpoint relationship

- frame の拡大縮小だけか
- angle of view / perspective を変える意図か
- world の occlusion / parallax が変わるべきか
- subject size を保ちながら background relation を変える必要があるか

2D scale-up は、spatial model が変わらないなら単なる framing change として扱う。

### Focus ownership

- 何が最初に readable / sharp / dominant か
- focus がどこへ移るか
- focus transfer が information handoff と一致するか
- focus 変更後も重要 text / subject が読めるか
- foreground / background の関係が画として理解できるか

blur amount を決める前に **attention owner の交代**を決める。

### Shake / instability

- trigger: impact / engine / turbulence / subjective instability / environment
- movement axis / rotation relationship
- onset
- amplitude hierarchy
- frequency / cadence character
- decay / recovery
- repeated impacts の差分
- subject readability / horizon readability

shake を常時 random noise にしない。

### Roll / tilted view

- horizon / frame axis の傾きが何を意味するか
- subject と typography の vertical reference がどう変わるか
- roll-in / hold / roll-out のどこが perceptual beat か
- disorientation が意図か accident か

### Coverage / technical limits

- source resolution
- overscan
- frame edge / canvas exposure
- crop margin
- hidden regions
- raster detail at maximum zoom
- blur / motion-blur consistency
- compression後の細部

## Decision rules

### Static camera is a valid baseline

camera motion を入れる前に static version を見る。

static で message、action、composition が成立しているなら、「動きが足りない」という理由だけで camera drift を追加しない。

camera motion は次のような仕事を持つ場合に使う。

- subject を追う
- scene の新情報を reveal する
- viewer と subject の心理的距離を変える
- scale / environment relation を見せる
- attention を別 region へ渡す
- impact / instability を viewer の view に伝える
- concept と camera direction / angle を結び付ける

### Start/end framing before curves

最初に key framing states を固定する。

最低限:

- start
- primary beat / reveal
- end

を確認してから path / easing を設計する。

camera curve を先に作り、あとから subject を画面に収める順序にしない。

### Reframe, track, push/pull, zoom are not interchangeable

**Reframe / pan-like move**
- 見えていなかった横・縦方向の情報を見せる
- subject movement を追う
- frame 内 hierarchy を移す

**Track / viewpoint-like move**
- viewer と world の位置関係を変える
- depth-aware scene では parallax / occlusion が変化しうる

**Push / pull**
- subject への心理的 / visual distance を変える
- context を削る / 増やす

**Zoom / crop-like change**
- frame 内 scale / field coverage を変える
- flat 2D asset を拡大するだけなら perspective / occlusion は自動では変わらない

必要な spatial change があるのに scale animation だけで dolly を偽装しない。
`2d-parallax` の plane model が必要ならそちらを使う。

### Camera movement must preserve an anchor

camera が大きく動く場合でも viewer が追えるものを残す。

anchor 候補:

- character / face
- product
- text block
- graphic shape
- horizon / architectural line
- movement direction
- color / contrast focal region

意図的な disorientation では anchor を一時的に崩してよいが、どこで再取得するか決める。

### Focus transfer is information transfer

rack-focus-like treatmentは「cinematic blur」ではない。

使う前に:

1. outgoing focal owner
2. incoming focal owner
3. transfer trigger
4. overlap / ambiguity window
5. settled readable state

を決める。

blur で background を隠すためだけに focus change を使わない。

flat artwork で depth relationship が成立しない場合、focus blurだけで無理に photographic depth を作らない。

### Shake has a source and recovery

shake は source event へ紐付ける。

例:

- impact
- vehicle / machine vibration
- earthquake / turbulence
- character POV instability
- deliberate graphic beat

設計するもの:

- onset
- dominant axis
- translation vs rotation
- strongest point
- secondary oscillation
- decay
- stable recovery

impact の前から同じ強さで震え続ける random wiggle を避ける。

連続する impact は全て同じ shake pattern にせず、event の大小 / direction / interval と response hierarchy を合わせる。

### Roll and extreme lensing need semantic pressure

roll、strong perspective distortion、dolly-zoom-like treatment、極端な lens/FOV-like look は attention を強く奪う。

次のどれかが説明できる場合だけ使う。

- psychological shift
- instability / imbalance
- power relationship
- surreal world rule
- brand / concept-specific directional motif
- spatial revelation that simpler framing cannot carry

「cinematic に見えるから」は理由にしない。

### Camera concept can be a system, not a one-off effect

複数 shot / campaign で camera behavior を使う場合、同じ numerical preset ではなく **役割の一貫性**を持たせる。

例:

- upward movement = conceptually positive / uplift direction
- constant traversal = freedom / continuity
- low/upward viewpoint = power relation

production reference の exact move をコピーせず、current project の message から意味を再定義する。

### Protect typography / UI / supers

information-bearing graphics がある shot では:

- zoom 中の minimum readable size
- movement 中の safe region
- focus blur の影響
- shake 中の edge stability
- roll 中の reading axis
- compression後の text edge

を確認する。

camera effect を優先して required information を読めなくしない。

### Renderer camera values are evidence, not universal rules

focal length、film size、aperture、blur level、camera Z、shake frequency 等を universal value として記憶しない。

renderer によって camera model は異なる。たとえば After Effects の camera model は angle of view / depth of field を提供する一方、real camera の aperture と exposure の coupling をそのまま再現しない。

current artifact では **見え方 / relation / attention** を source of truth にする。

## References

runtime research は [`references/camera-effects.md`](references/camera-effects.md) を読む。

official animation guidance、current renderer/camera model、production artifacts を比較し、一つの camera vocabulary や studio の演出を universal preset にしない。

## Responsibility boundaries

### `2d-parallax`

plane segmentation、relative depth、camera / layer motion の spatial relation、occlusion / reveal、hidden-region coverage、flat-plane limit を担当する。

`camera-effects` は **viewer-facing shot behavior** を担当する。

camera push で actual parallax / occlusion が必要なら `2d-parallax` を併用する。

### `transition-design`

shot A → shot B の boundary、continuity / rupture、outgoing / overlap / incoming を担当する。

`camera-effects` は一つの shot 内での view behavior を担当する。

camera whip / occlusion が transition bridge になる場合、boundary logic は `transition-design` に渡す。

### `compositing`

alpha、matte、blend、edge、color、grain、blur、glow、chromatic artifact、flare 等の最終 visual integration を担当する。

`camera-effects` は focus / lens-like treatment を **どの attention / shot purpose のために使うか**だけを所有する。blur kernel、chromatic cleanup、grain integration 自体は `compositing`。

### `hand-drawn-animation` / `limited-animation`

character / drawing の motion construction と motion allocation を担当する。

camera が subject motion を補助しても、character acting の不足を camera shake / zoom で隠さない。

### `motion-system`

interactive product / UI state motion、gesture、interruption、runtime performance、reduced-motion を担当する。

この Skill は authored video / animation shot の camera treatment を対象とする。

### 3D production

3D scene design、camera rigging、lighting、rendering は repository scope 外。

3D / virtual-camera documentation は、最終2D frameで観察できる angle-of-view / focus / framing relationship の evidence としてだけ使う。

## Avoid

- 全 shot に subtle camera drift を入れる
- pan / zoom / push / track を同義語として扱う
- flat 2D scale-up を自動的に dolly と呼ぶ
- random wiggle を camera shake とみなす
- impact 前後で同じ強さの shake を続ける
- rack focus を blur presetとして使う
- required text / UI を focus blur / shake / roll で読めなくする
- lens distortion / roll / dolly-zoom-like treatment を「cinematic」presetにする
- camera movement と subject animation を同時に盛り、motion ownershipを失う
- camera move の端で canvas / source edge を露出する
- source resolution を無視して大きく zoom する
- renderer 固有 focal length / aperture / shake value を universal rule にする
- `2d-parallax` の depth geometry や `compositing` の optical integration を重複実装する

## Verify

### 1. Static baseline

camera treatment を切った状態で確認する。

- shot の subject / message が何か分かる
- camera motion が必要な理由を説明できる
- subject animation の不足を camera が隠していない

### 2. Normal-speed playback

最終速度で見る。

- view purpose が読み取れる
- focal subject を追える
- movement onset / settle / recovery が shot rhythm と一致する
- text / UI / supers が読める
- camera と subject の motion ownership が混乱しない
- shake / roll / focus transfer が decorative effect だけになっていない

### 3. Key framing states

start / primary beat / end を止めて見る。

- subject scale / position
- negative space
- crop
- hierarchy
- required information
- horizon / axis where relevant

を比較する。

### 4. Motion extremes / scrub

camera path の extreme、maximum zoom、strongest shake、focus-transfer midpoint、largest roll を確認する。

- canvas / source edge が露出しない
- source resolution が不足しない
- focal subject が accidental crop されない
- text / UI が safe region を外れない
- focus blur が wrong layer / wrong information を優先しない
- shake が layer separation や matte failure を露出しない

### 5. Event response

shake / impact / focus cue がある場合:

- trigger 前
- trigger frame / onset
- peak
- decay
- settled state

を比較する。

複数 event では大小・方向・spacing と response hierarchy が一致するか見る。

### 6. Sequence context

前後 shot を含めて再生する。

- camera intensity が全 shot で均一になっていない
- cut / transition と camera settle が競合しない
- camera direction が continuity を壊していない
- strong treatment の前後に visual rest があるか

### 7. Final artifact

- target aspect ratio で reframe / crop を確認する
- compressed export を実速度で見る
- mobile / small display が対象なら actual viewing size で見る
- final encode 後も text edge、focus cue、shake readability が保たれる

### Promotion trial

experimental から promotion する前に representative artifact を実際に作り、少なくとも次を含める。

1. static shot baseline
2. purpose-driven smooth reframe / push or track
3. focus handoff または別の attention transfer
4. triggered shake / impact response
5. text / graphic element を含む readability case
6. final encoded playback

normal-speed playback と extreme-frame inspection の両方を行い、どの treatment が有効 / 過剰 / 不要だったかを Issue / PR に記録する。

real artifact trial を通していない状態を first-class promotion 完了と扱わない。
