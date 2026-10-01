---
name: key-visual-design
description: >
  Create a campaign, title, event, or release-wide visual proposition and transformation grammar that stays recognizable across materially different artifacts without reducing the system to one master image, one crop, or one fixed template.
---

# Key Visual Design

キャンペーン、イベント、作品、リリースなどに対して、複数の成果物を同じ世界として認識できる **visual proposition と変換規則** を設計する。

ここでいう key visual は「最も豪華な1枚」ではない。poster、banner、social、motion、signage、packaging などへ展開したときに、媒体固有の構成へ変わっても campaign/title の認識が残る visual system を扱う。

## When to use

次のような仕事で使う。

- 一つの campaign / event / title を複数媒体へ展開する
- hero artwork だけでなく poster / banner / social / motion などの family を作る
- 各媒体を同じテンプレートにするのではなく、同じ concept から別構成へ展開したい
- parent brand を保ちながら、期間限定 campaign に独自の visual identity を持たせる
- series / phase / locale / performer / venue などの差分を一つの visual grammar で扱う

単一 poster の encounter、単一 thumbnail の browse decision、album cover の primary release identity だけを設計する場合は、それぞれ専用 Skill を優先する。

## Workflow

1. current brief / campaign truth / parent brand / required artifacts を確認する。
2. [runtime references](./references/key-visual-design.md) を開き、異なる production system を比較する。
3. campaign/title が何を一貫して伝えるべきかを一文で定義する。
4. visual proposition と、その proposition を担う carrier を分離する。
5. recognition に必要な retained properties と、媒体・内容に応じて変えてよい properties を決める。
6. content variants と surface derivatives を分離して family rule を作る。
7. materially different な artifact へ実際に展開し、同じ campaign として認識できるか、各 artifact の仕事も成立しているか確認する。
8. final delivered outputs を比較し、hero mockup だけで判断しない。

## Observe

reference を見るときは、見た目の雰囲気ではなく次を比較する。

- campaign / title の truth、theme、message、audience
- parent brand と campaign identity の関係
- dominant visual proposition
- proposition を担う carrier
  - photography
  - illustration
  - object / symbol
  - typography
  - material / texture / physical process
  - recurring composition
  - mixed system
- recognition を支える retained properties
- content ごと、format ごとに変化する properties
- one-off hero と serial content の差
- image / type / logo / metadata の ownership
- motif / subject / palette / type / crop / composition / material / motion の反復方法
- fixed artwork か rule-generated / combinatorial system か
- content variant と surface derivative の違い
- aspect / orientation / scale / density に対する recomposition
- static と motion の共通 identity
- large display と small/dense digital surface の読み方
- locale / copy length / venue / date / sponsor / campaign phase による変化
- asset source / commission / rights / truthful representation
- repetition fatigue と recognizability の均衡
- print / screen / compression 後に残る cue

## Translate

### Visual proposition と carrier を分ける

最初に「何をどう見せるか」の proposition を決め、その後で carrier を選ぶ。

例えば「複数の感情を一つの event theme として可視化する」という proposition は、portrait、paper object、illustration、type system など複数の carrier で実現できる。

reference 固有の carrier を universal rule にしない。

### Key visual を single master image にしない

一枚の master artwork を作り、それを全媒体へ center crop することを system design とみなさない。

代わりに、少なくとも次を明示する。

- 何が残れば同じ campaign と認識できるか
- 何は artifact の仕事に合わせて変えてよいか
- image / type / logo / metadata の優先順位をどう変えられるか
- portrait / landscape / narrow / motion で何を再構成するか

同一性は pixel-identical layout ではなく、認識可能な関係で保つ。

### Retained / variable / reason で family を記述する

family rule は exact template ではなく、次の形式で整理する。

- **Retained** — campaign recognition に必要な property
- **Variable** — content / format / phase に応じて変わる property
- **Reason** — なぜ変えるか

全 property を固定すると artifact-specific adaptation が死ぬ。全 property を変えると campaign recognition が失われる。

固定すべき数や比率を universal に決めない。reference と required family を比較して必要最小限の cue を見つける。

### Content variant と surface derivative を分ける

**Content variant** は同じ system 内で subject / message / performer / category / phase などが変わるもの。

**Surface derivative** は同じ content を別の viewing context / format へ適応するもの。

この2つを混同すると、内容差と媒体差の両方を一つの crop/template rule で処理し、family が脆くなる。

### Parent brand と campaign identity の hierarchy を決める

campaign が parent brand を上書きする前提にしない。

確認する。

- parent brand のどの cue が必須か
- campaign が独自に所有できる cue は何か
- logo / name が常に主要 cue なのか、周辺 metadata で足りるのか
- campaign 終了後も残る identity と、一時的な表現を混同していないか

長期的な organization/product identity 自体を作る場合は `brand-identity` の責務とする。

### Medium-specific adaptation を許す

同じ concept でも、poster、social card、wide banner、motion、packaging は同じ構成を要求しない。

媒体ごとに次を再判断する。

- first read / dwell time
- available space / crop risk
- surrounding metadata / platform chrome
- text volume
- motion availability
- physical material / print process
- interaction / playback context

concept continuity を守りながら composition technique を変えてよい。

### Static ↔ motion は identity relation を保つ

motion 化するときに、静止 key visual へ単に camera move / particle を足すことを規則にしない。

static と motion で共通するものが、subject、shape grammar、type behavior、sequence logic、material transformation など何なのかを明示する。

時間設計そのものは `promotional-video` / `music-promo-video` / motion 系 Skill が担当する。

### Truth / source / rights を system rule に含める

campaign recognition の核が人物、product、archive、commissioned illustration、photography、licensed material などに依存する場合、その source が derivative でも利用可能か確認する。

- 実在しない人物・商品状態・結果を campaign truth のように見せない
- approved asset がない surface で勝手に代替 asset を作らない
- source-specific な crop / edit / recolor 制限を無視しない
- generated / simulated / commissioned asset の status が重要なら downstream artifact でも誤認させない

## Decision rules

### One artwork or a generative family?

required artifacts が実質同じ viewing condition で、同じ composition が無理なく成立するなら一つの artwork family でよい。

次の差が大きい場合は transformation grammar を設計する。

- orientation / aspect
- viewing scale
- copy量
- content variants
- motion/static
- platform chrome
- campaign phase
- locale

### One visual carrier or several?

一つの carrier が proposition を十分表現し、必要な媒体へ適応できるなら無理に増やさない。

一つの carrier だけでは campaign の required content / phase / medium を扱えない場合は、複数 carrier を同じ grammar へ接続する。carrier を増やすこと自体を richness とみなさない。

### Same layout or same identity?

同じ layout でなくても retained cue が十分なら family として成立する。

逆に、logo と色だけ共通で、composition / imagery / type / motion の関係が毎回無関係なら、system は弱い可能性がある。

## References

実行時は [references/key-visual-design.md](./references/key-visual-design.md) を開く。

単一 project の appearance をコピーせず、複数 source 間で何が retained / transformed されているか比較する。

## Avoid

- 一枚の hero image を全媒体へ crop するだけで system と呼ぶ
- `key visual = portrait + huge title` のような固定 recipe
- campaign concept より先に trend / effect / renderer technique を決める
- parent brand と temporary campaign identity の責務を混ぜる
- 全 artifact を同一 template にして媒体固有の読み方を失う
- 逆に毎 asset を別 style にして campaign recognition を logo だけへ押し付ける
- content variant と surface derivative を同じ variation として扱う
- asset rights / truth / source constraints を最後の production 問題へ追いやる
- one creator / studio 固有の type、palette、mask、texture、camera、illustration language を style preset 化する
- presentation board / mockup の美しさだけで完成判定する

## Verify

source file が作れたことではなく、artifact family を実物で確認する。

### 1. Family map

required artifact ごとに記録する。

- artifact job / context
- content variant or surface derivative
- retained property
- changed property
- reason for change

理由のない variation と、媒体差を無視した clone を両方検出する。

### 2. Materially different contexts

campaign に必要な範囲で、異なる viewing condition の final artifact を比較する。

例:

- large / distance-oriented display
- small or dense digital surface
- wide / narrow orientation
- static / motion
- print / screen

すべてを必須にはしない。実 campaign の delivery set に存在する materially different context を実際に render/export する。

### 3. Recognition without template cloning

family を並べて確認する。

- 同じ campaign/title と認識できるか
- recognition が logo だけに依存していないか
- variation が内容・媒体・phase の違いを説明しているか
- exact layout repeat が artifact の仕事を壊していないか

### 4. Artifact-specific QA

poster / thumbnail / album cover / video などの専用 Skill がある場合、その artifact の verification を追加する。

key visual が成立していても、poster の distance read や thumbnail の browse clarity が失敗していれば完成ではない。

### 5. Locale / serial / campaign-phase stress

該当する場合、長い copy、別言語、別 performer/content、別 venue/date、launch後 phase などへ展開する。

文字を縮める、subject を無理に crop する、logo を増やすだけで continuity を維持しない。

### 6. Final delivery

最終の raster / vector / print proof / encoded motion など production-representative output を確認する。

- crop / edge behavior
- small-size recognition
- large-size artifacts / weak detail
- compression
- color / material translation
- text / logo readability
- approved source / rights constraints

mockup だけでは完了しない。

## Responsibility boundaries

- `key-visual-design` — campaign/title-wide visual proposition、retained/variable rules、cross-artifact transformation grammar
- `design-intent` — project-wide visual brief と unresolved decision の整理
- `brand-identity` — durable organization/product identity
- `poster-design` — standalone poster encounter と display-scale hierarchy
- `thumbnail-design` — browse-preview proposition と small-card context
- `album-cover-design` — primary music-release artwork
- `promotional-video` / `music-promo-video` — time-based message / campaign structure
- `visual-hierarchy` / `typesetting` / `font-mixing` / `color-system` — underlying visual foundation

この Skill は downstream artifact Skill の代替ではなく、それらが共有する campaign/title visual language を定義する。