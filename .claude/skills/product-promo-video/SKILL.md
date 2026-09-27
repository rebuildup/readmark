---
name: product-promo-video
description: >
  Design product-focused promotional videos by translating product claims, features, interactions,
  mechanisms, and outcomes into credible visual proof while preserving product truth, continuity,
  and readability instead of relying on feature lists, beauty shots, or generic promo structure.
---

# Product Promo Video

product promo は product を美しく見せるだけでも、feature 名を順番に表示するだけでもない。

**Claim → Evidence → Product continuity → Sequence → Playback verification**

`promotional-video` が映像全体の objective / hook / promise / brand / CTA / format を設計するのに対し、この Skill はその中で **product claim を何で、どこまで、どう証明するか**を担当する。

## When to use

対象:

- hardware / device launch film
- app / software feature film
- product feature module
- technology / mechanism explainer film
- product reveal + demonstration
- product page / keynote / social campaign向けの product asset
- physical productとUI / output / internal mechanismを横断する紹介映像

対象外:

- campaign media strategy / media buying
- generic hook / CTA / safe-zone設計
- industrial designや3D modelingそのもの
- generic product photography / cinematography curriculum
- renderer / NLE / screen-recording tutorial

## Workflow

1. productのapprovedなclaim / feature / spec / UI state / resultを確認する。
2. claimごとに、視聴者が何を見ればそのclaimを理解できるかを定義する。
3. referenceを複数開き、proofの型とproduct anchorを比較する。
4. evidence modeを決める: literal / demonstrated / simulated / abstracted / sensorial。
5. dominant product storyとsecondary featureを分ける。
6. shot / sceneごとに claim → evidence の対応を追跡できるようにする。
7. product geometry / UI state / mechanism / resultのcontinuityを保ったままmotion・camera・typeを加える。
8. normal-speed playbackとrepresentative frameの両方でproofが読めるか確認する。
9. actual product / UI / known outputと照合し、誤認を生む表現を除く。
10. final encoded variantを実寸で確認する。

## Observe

referenceではstyle名ではなく次を見る。

### Claim / evidence relationship

- 何をclaimしているか
- viewer benefitは何か
- 何が実際のevidenceになっているか
- evidenceがliteralか、simulationか、abstractionか
- textだけでclaimしていないか
- visualだけで意味を過剰推測させていないか

### Evidence mode

区別する:

- **Physical form** — 薄さ、形状、素材、部品、可動機構、仕上げ
- **Context of use** — 手に持つ、装着する、設置する、操作する等の利用関係
- **UI / workflow** — input → state change → result
- **Mechanism / process** — 内部構造、流れ、変換、物理・技術的プロセス
- **Performance / result** — output、処理結果、比較可能な変化
- **Invisible technology** — 直接撮影できない信号、音、データ、微細構造等の説明的可視化
- **Sensorial / desirability** — texture、taste、sound impression、luxury、material feeling等の知覚的表現

一つのfilmで全型を使う必要はない。

### Product anchor

- whole productがいつ読めるか
- silhouette / screen / package / material / controlなど何がidentityを保つか
- feature detailへ寄ったあとwhole productへ戻れるか
- abstract sceneでもproductとの関係が失われないか
- colorway / orientation / physical stateがshot間で矛盾していないか

### Physical truth

- geometry / proportion
- material / finish
- scale
- port / button / control location
- hinge / rotation / deformation
- contact / assembly
- moving-part range

誇張表現を使う場合でも、何がproduct factで何がvisual metaphorかを曖昧にしない。

### UI / workflow truth

- actual UIかconcept UIか
- inputとresultの順序
- loading / transition / state change
- data / resultの出所
- cropで重要contextを失っていないか
- interaction speedが実behaviorを誤解させないか

UIを斜めに置いたbeauty shotだけでworkflow proofとみなさない。

### Invisible mechanism

- real featureとvisual abstractionの対応
- input / process / output
- direction / flow
- relative scale
- causal order
- labelやproduct shotへの再接続

particleやwaveが「technologyっぽい」だけになっていないかを見る。

### Feature hierarchy

- dominant product story
- supporting feature
- specification detail
- emotional / desirability layer

全featureを同じ尺・同じ演出強度にしない。

### Detail vs whole

- macro / close-upが何を証明するか
- context shotが何を説明するか
- hero stateがどこにあるか
- detailからwholeへ戻るorientation cue

### Motion / camera / transition

- productが読めるhold
- feature revealのownership
- cameraがdetail理解を助けるか
- transitionがcause-effectを切断していないか
- effectsがproduct edge / UI / mechanismを隠していないか

詳細なcamera behaviorは `camera-effects`、shot boundaryは `transition-design`、最終統合は `compositing` を使う。

## Decision rules

### Claim before shot

shotを先に考えない。

最低限、次を対応させる。

```text
Claim
→ Viewer should understand
→ Evidence available
→ Representation mode
→ Shot / sequence
→ Verification
```

beautiful shotが存在してもclaimに寄与しないなら、proof sceneとして数えない。

### Prefer direct evidence when it is sufficient

実物product、actual UI、実際のoutput、明確なcontext-of-useで説明できる場合は、それを不要なmetaphorで置き換えない。

直接見えないもの、時間尺度が違うもの、微細すぎるもの、複雑すぎるものだけ abstraction / simulation の必要性を検討する。

### Label the truth level internally

制作中は少なくとも次を区別する。

- **literal** — product / UI / resultそのもの
- **demonstrated** — 実際の操作や機構を代表的に見せる
- **simulated** — 観察しにくい挙動をmodel化して再現する
- **abstracted** — 関係や原理を説明するvisual metaphor / diagrammatic treatment
- **sensorial** — 感触やdesirabilityを喚起する表現

abstracted / sensorial表現をliteral evidenceのように見せない。

### Preserve cause and effect

feature demonstrationでは:

- before / input
- operation / mechanism
- after / output

のどれが必要かを判断する。

transitionやcamera moveで原因と結果の関係を飛ばさない。

### One dominant product story

一つのfilmで全specを同格に扱わない。

feature同士が同じmechanism / benefit / usage storyでまとまらない場合は:

- hero film
- feature module
- social cutdown
- product-page clip

などへ分割する。

### Abstract invisible technology, not accountability

見えない技術を可視化するときも:

- productのどこで起きているか
- 何がinputか
- 何が変わるか
- viewerに何が返るか

の接続を残す。

抽象空間へ入りっぱなしでproductへ戻らない構成を避ける。

### Keep text and proof complementary

spec label / superは、visual evidenceが示している対象を明確にするために使う。

数値・feature名だけを表示してvisual proofを省略しない。
逆にvisual metaphorだけで正確なspecを推測させない。

### Protect the product anchor

macro、exploded view、UI、abstract mechanism、context-of-useを切り替える場合、viewerが同じproduct storyを追えるanchorを持たせる。

anchorは必ずlogoである必要はない。

- silhouette
- material
- screen
- component geometry
- recurring orientation
- feature location
- controlled color role

などから選ぶ。

## Responsibility boundaries

### `promotional-video`

所有する:

- objective / audience
- hook
- dominant promise
- brand presence
- promo-level proof slot
- CTA
- sound-on / sound-off
- platform safe zone
- campaign-level aspect adaptation

`product-promo-video` は、その proof slot の中身をproduct factから構成する。

### `compositing`

所有する:

- matte / alpha / blend
- edge
- color / grain / blur
- source integration

この Skill はcomposite techniqueではなく、何がproofとして保持されるべきかを決める。

### `camera-effects`

所有する:

- shot内のviewer-facing camera behavior
- reframe / push / zoom-like treatment / focus / shake / roll

この Skillはcamera treatment中にproduct detail / scale / UI / evidenceが失われない条件を決める。

### `transition-design`

所有する:

- shot / state間のcontinuity / rupture

この Skillはproduct stateやcause-effect continuityが何を跨いで残るべきかを決める。

### `kinetic-typography`

所有する:

- temporal text behavior
- reading window
- typographic semantic motion

この Skillはどのclaim / labelがproofに必要かを決める。

## References

実際の観察項目とdirect URLは [`references/product-promo-video.md`](./references/product-promo-video.md) を読む。

referenceのvisual vocabularyをcloneしない。
productのclaim、evidence、material、usage context、brand systemへ翻訳する。

## Avoid

- spec listを順番にanimated text化する
- beauty shotをproofと呼ぶ
- invisible technologyをgeneric particle / waveで済ませる
- actual UIとconcept UIを区別しない
- product geometryや可動範囲を演出都合で変える
- result / performanceをunsupported comparisonで誇張する
- textだけでclaimし、何が変わるか見せない
- metaphorだけでproduct connectionを失う
- macro detailだけでwhole-product orientationを失う
- every featureに同じcamera move / transition / glowを与える
- CG / 3D rendererの能力をdesign rationaleにする
- creator固有のlighting、camera、material、color vocabularyをproduct-film ruleとしてコピーする

## Verify

### 1. Claim trace

claim / featureごとに:

- どのshot / sequenceがevidenceか
- literal / demonstrated / simulated / abstracted / sensorialのどれか
- viewerが何を理解する想定か

を追えることを確認する。

visual evidenceが存在しないclaimは、必要性を再検討するか別形式へ移す。

### 2. Product truth pass

approved product sourceと比較する。

- geometry
- proportion
- material
- control / port / moving part
- colorway
- UI state
- workflow order
- result / output
- feature location

演出とproduct factの境界を確認する。

### 3. Normal-speed playback

一時停止せず見る。

- productが何か分かるか
- featureとbenefitが接続するか
- mechanism / workflow / resultの順序が追えるか
- textを読まなくても主要evidenceが認識できるか
- textが必要な箇所では読む時間があるか

### 4. Representative frames

少なくとも:

- whole-product hero state
- strongest feature proof
- mechanism / UI state
- result state
- maximum macro / camera extreme

を静止確認する。

crop、edge、geometry、UI readability、label関係を見る。

### 5. Actual-vs-conceptual check

UI capture、simulation、CG mechanism、benchmark/result imageryについて:

- actual behaviorと誤認させないか
- real scale / timing / stateを不必要に偽装していないか
- required qualifier / contextを失っていないか

を確認する。

### 6. Variant / delivery check

必要な16:9 / 9:16 / 1:1 / keynote / product-page等で:

- product silhouette
- feature location
- UI detail
- evidence sequence
- label association

がcropで崩れていないか確認する。

### 7. Final encoded playback

最終codec / platform previewで:

- fine product detail
- material texture
- thin edges
- screen/UI text
- gradients
- spec labels
- rapid feature transitions

を確認する。

実project / artifact trialが未実施なら、Skillをcompleted / promotedと扱わない。
