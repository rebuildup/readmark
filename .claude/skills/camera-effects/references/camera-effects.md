# Camera Effects References

Last reviewed: 2026-09-14

この reference family は、camera effect を preset catalogue として学ぶためではなく、**viewer-facing shot behavior が何を担当し、どこで止めるべきか**を比較するために使う。

実装 API / renderer の numerical defaults は current implementation evidence に限定し、universal design rule にしない。

## 1. Toon Boom Learn — Camera Moves

https://learn.toonboom.com/modules/the-language-of-storyboards/topic/camera-moves1

Type: official animation guidance

Observe:

- 2D animation で zoom / pan / shake をどう異なる camera move として説明しているか
- zoom が action / detail への attention と reveal の両方に使われること
- pan が panorama の提示だけでなく main action の追従にも使われること
- shake が turbulence / crash 等に結び付き、viewer を scene の chaos に巻き込むこと
- move の speed が shot の機能を変えること

Useful for:

- camera behavior を effect 名ではなく shot purpose から分離する
- shake を random decoration ではなく scene event response として考える

Avoid copying:

- sample shot の exact duration / amplitude
- beginner tutorial の category を完全な cinematography taxonomy とみなすこと

## 2. Toon Boom Learn — Camera Motion with Harmony Advanced

https://learn.toonboom.com/modules/camera-motion1

Type: current first-party production / implementation guidance

Observe:

- camera を独立 owner として animation する構造
- camera truck-in と layer motion の区別
- control points / ease / path の存在
- multiplane setup と camera movement が接続する地点

Useful for:

- camera-owned motion と object/layer-owned motion を分ける
- `2d-parallax` と `camera-effects` の境界を確認する

Avoid copying:

- Harmony node / peg 操作を design principle にすること
- tool の camera path implementation を必須化すること

## 3. Toon Boom Learn — Camera Moves and Rack Focus

https://learn.toonboom.com/modules/adding-camera-peg-and-layer-parameters

Type: current first-party production / implementation guidance

Observe:

- camera move と rack focus が別の operation であること
- focus / blur を foreground-background attention transfer に使うこと
- camera move の easing と focus change を独立して設計できること
- multiplane で focus relationship が成立する条件

Useful for:

- focus transfer を blur preset ではなく attention handoff として扱う
- movement と focus の ownership を分ける

Avoid copying:

- blur node の parameter 値
- rack focus を photographic realism の universal requirement にすること

## 4. Adobe Animate — Camera in Animate

https://helpx.adobe.com/jp/animate/desktop/multimedia-and-video/working-with-camera-in-animate.html

Type: current official implementation guidance

Current status reviewed: 2026-09-14

Observe:

- pan / zoom / rotation / focal-point change を camera layer で分けて扱うこと
- subject follow、detail emphasis、larger-context reveal、attention shift という異なる camera jobs
- camera view を document layer とは別 owner として扱う model

Useful for:

- 2D authored animation に camera-owned view behavior が first-class concept として存在する evidence
- renderer capability と design intention を分ける

Avoid copying:

- Camera tool UI / keyframe tutorial
- tint / color filter を camera design の universal part とすること

## 5. Adobe Learn — Use the virtual camera in Animate

https://www.adobe.com/learn/animate/web/virtual-camera

Type: current official tutorial / implementation evidence

Published: 2026-07-21

Observe:

- pan / zoom / rotate が stage-wide view operation として使われること
- camera treatment を layer-by-layer transform と別に持てること
- current Animate implementation status

Useful for:

- current tool capability freshness confirmation

Avoid copying:

- tutorial の keyframe construction
- specific software workflowを design source of truth にすること

## 6. Adobe After Effects — Cameras, lights, and points of interest

https://helpx.adobe.com/after-effects/desktop/work-with-layers/camera-layer/cameras-lights-points-interest.html

Type: current official camera-model documentation

Current status reviewed: 2026-09-14

Observe:

- angle of view が focal length / film size / zoom の関係から決まる model
- focus distance と depth of field の relationship
- renderer の camera model が real camera behavior の一部を simulate するが完全な physical camera ではないこと
- aperture change が real camera と異なり exposure を連動させない等の implementation boundary

Useful for:

- renderer camera valuesを universal cinematography law と誤認しない
- lens/FOV-like treatment と framing / focus decision を分ける

Avoid copying:

- focal length / aperture / blur level の固定値
- After Effects の physical approximation を全 renderer に一般化すること

## 7. Adobe — Camera shots and movement

https://www.adobe.com/creativecloud/video/production/cinematography/camera-shots-and-angles.html

Type: established first-party cinematography guidance

Observe:

- tracking / pan / dolly-in/out / zoom が別の view behavior であること
- tracking が action と audience orientation を結ぶこと
- pan が reveal / spatial awareness を作れること
- dolly-in/out が viewer と subject / environment の relation を変えること

Useful for:

- 2D camera simulation でも move 名より perceptual result を考える
- scale-only zoom と actual viewpoint move を区別する

Avoid copying:

- live-action rig requirements
- emotional meaningを固定 mapping にすること

## 8. Adobe — Dolly zoom

https://www.adobe.com/nz/creativecloud/video/production/cinematography/camera-shots-and-angles/dolly-zoom-shot.html

Type: established first-party technique analysis

Observe:

- subject sizeを保ちながら background spatial relationship を変える構造
- camera translation と lens/zoom change の組み合わせ
- effect が強い perceptual distortion を持つこと
- technique を story / emotional shift に結び付ける必要性

Useful for:

- `scale animation = camera move` という単純化を避ける
- extreme camera effect に semantic pressure が必要な理由を見る

Avoid copying:

- `Vertigo` 固有の visual signature
- shock / fear だけに意味を固定すること
- flat 2D asset で spatial supportなしに外見だけ再現すること

## 9. BUCK — Sonos

https://buck.co/work/sonos-move

Type: production artifact / studio case study

Observe:

- camera を spaces 間で継続的に動かし、「freedom of movement」という product concept を reinforcement していること
- live action / album content / graphics / typography 間を camera-move library / system として接続していること
- camera movement によって silhouette が変わるため graphic system 側も frame-by-frame 対応していること

Useful for:

- camera behavior を campaign concept に接続する
- camera motion が downstream graphic constraints を発生させることを見る

Avoid copying:

- Sonos の echo-line motif
- constant movement 自体を他 project の rule にすること

## 10. BUCK — Mabel feat. Shygirl, Look At My Body Pt. II

https://buck.co/work/mabel-look-at-my-body

Type: 2D animation production artifact

Observe:

- upward camera anglesを character と viewer の power relationship に結び付けていること
- camera angle が composition / subject meaning と一体になっていること
- complex cel animation と camera framingが同じ sequence 内で役割分担していること

Useful for:

- camera angleを aesthetic preset ではなく narrative / rhetorical relation として扱う
- subject animationとview behaviorの責務を分ける

Avoid copying:

- project固有の retro / psychedelic expression
- low/upward angle = power という一対一の universal mapping

## 11. BUCK — 7UP

https://buck.co/work/7up

Type: brand-motion production artifact

Observe:

- upward camera movementを campaign concept の “UPliftment” と結び付けていること
- camera direction、CG transformation、brand assets が一つの motion identity として働くこと
- directional motif が still / motion / campaign system に翻訳されること

Useful for:

- camera directionを semantic brand motif として設計する
- exact movementではなく role consistencyを抽出する

Avoid copying:

- brand-owned green / visual assets
- upward movement = positive という universal rule

## 12. BUCK — Zapier Motion Library

https://buck.co/work/zapier-motion-library

Type: production system / current spot family

Observe:

- one spot で “extreme camera lensing” が surreal time-reversal concept の一部として使われること
- motion library 全体の中でも camera treatment の intensity / grammar が spot ごとに異なること

Useful for:

- extreme lensingを default cinematic treatment ではなく exceptional concept device として扱う
- system 内で intensity hierarchy を作る

Avoid copying:

- spot固有の surreal galaxy / reverse-time vocabulary
- extreme lensing を全 campaign assetへ均等適用すること

## 13. Motionographer — Plenty / Good Books: We Need to Talk About Alice

https://motionographer.com/2015/10/14/exclusive-interview-plenty-takes-on-alice-in-wonderland-for-good-books/

Type: established production interview / process evidence

Observe:

- camera work を scene の chaos / confusion と viewer attention の両方に使っていること
- studio が「camera movement を常に protagonist にしない」と明示していること
- camera decisions が storyboard と layout / previz の両方で形成されたこと
- 2D illustrated finish と underlying camera planning の relationship

Useful for:

- camera intensity を sequence hierarchy の一部にする
- camera movement の absence / restraint も deliberate choice として扱う

Avoid copying:

- narrow-angle lens choiceを別 projectへ移植すること
- 3D layout workflow自体を repository scope に持ち込むこと

## 14. Motionographer — History Is What We Do Now / M2

https://motionographer.com/2023/07/27/history-is-what-we-do-now-project-breakdown/

Type: independent 2D-animation production breakdown

Observe:

- traditional TVPaint character animationで extreme camera angles を action emphasis に使っていること
- camera angleが kit / pop-art concept と action presentationを接続していること
- storyboard / animatic段階で scene / shot structureを先に検証していること

Useful for:

- 2D animationで camera angleを subject motionとは別の emphasis channel として考える
- camera treatment を final compositing後付けではなく planning段階へ置く

Avoid copying:

- Japanese-animation reference の外見や specific angle
- action shot だから常に extreme camera を使うこと

## Cross-reference comparison

### Static / restrained camera

Plenty の interview は camera movement を常に protagonist にしないと明示している。

Observe:

- subject actionだけで成立する shot
- camera intensityを reserve する場所
- strong camera beat の前後の rest

### Reframe / follow / reveal

Toon Boom と Adobe の guidance を比較する。

Observe:

- subject follow
- previously hidden information の reveal
- environment / context の拡張
- start/end framing の違い

### Viewpoint move vs zoom-like framing

Adobe cinematography / AE camera model と 2D animation tooling を比較する。

Observe:

- spatial position change が parallax / occlusion / perspectiveに影響する場合
- flat scale/crop が frame coverageだけ変える場合
- current artifactがどちらを必要としているか

### Focus transfer

Toon Boom rack-focus guidance と AE camera model を比較する。

Observe:

- outgoing / incoming focal owner
- transfer timing
- settled readable state
- simulated blur と actual scene-depth relationship の違い

### Shake

Toon Boom Camera Moves の narrative explanationを基準に見る。

Observe:

- trigger
- onset
- dominant direction
- response peak
- recovery
- repeated impacts の hierarchy

random noise generatorの parameterは design ruleにしない。

### Semantic camera systems

Sonos / Mabel / 7UP / Zapier を比較する。

共通:

- camera behaviorが concept / message / viewer relationship と結び付く

差分:

- Sonos: traversal / freedom
- Mabel: angle / viewer-character power relationship
- 7UP: direction / brand concept
- Zapier: exceptional lensing / surreal spot-specific world rule

抽出するのは **camera behavior と communication role の結び付き**であり、個別 studio の move vocabulary ではない。

## Failure modes to watch

- every-shot drift: 動きがない不安から全 shot が浮遊する
- scale-only fake dolly: spatial changeが必要なのに layer全体を拡大するだけ
- camera/subject cancellation: cameraとsubjectが同方向に動き focal relationが曖昧になる
- unmotivated shake: trigger / peak / recoveryなしの random wiggle
- focus-as-decoration: information handoffなしに blurが往復する
- lensing-as-style-filter: distortion / roll / extreme FOVを全shotへ適用する
- edge exposure: movement extremeでcanvas / source edgeが見える
- resolution collapse: zoom peakでraster sourceが崩れる
- unreadable graphics: camera treatmentでrequired text / UIが読めない
- flat-depth contradiction: 2D sceneにunsupported perspective changeを要求する
- camera as protagonist everywhere: subject / messageよりcamera techniqueが常に強い

## Verification evidence to preserve

real artifact trialでは可能なら次を durable evidence として残す。

- static baseline playback
- start / key / end framing captures
- strongest movement extreme frame
- focus-transfer before / midpoint / after
- shake trigger / peak / settled frames
- normal-speed final playback
- encoded delivery playback
- failure / adjustment note: which camera treatment was removed, reduced, or changed and why

source file や camera curve の存在ではなく、viewer-facing final artifact を verification source of truth にする。
