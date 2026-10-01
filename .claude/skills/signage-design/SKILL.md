---
name: signage-design
description: >
  Design physical environmental signage and wayfinding systems by mapping real journeys,
  decision points, destination language, viewing conditions, accessibility constraints, and
  maintenance needs, then verify the installed or full-scale representation along actual routes.
---

# Signage Design

Signage は flat canvas に情報を載せる作業ではない。

**Journey → Decision points → Information roles → Sign family → Environment → Verify** の順で、建築・landmark・命名・map・staff/help point と協調する physical information system として設計する。

目的は sign の数を増やすことではなく、人が実環境で **現在地を理解し、次の判断を行い、判断後に正しい経路だと確認できること**。

Last reviewed: 2026-09-15

## When to use

以下を設計・再設計するときに使う。

- building / campus / hospital / museum / airport / station / public realm の wayfinding
- entrance / room / floor / zone の identification signs
- directional / confirmation / directory / informational signs
- physical instruction / rule / regulatory signs
- map・directory・pictogram を含む environmental sign family
- temporary destination / construction phase / event operation を含む physical guidance
- multilingual な physical navigation system

website / application の information-space navigation が主目的なら `navigation-design` を使う。
standalone promotional display が主目的なら `poster-design` を使う。
map そのものの geographic / topological abstraction が主問題なら `map-design` を使う。

## Workflow

1. **Inspect the journey** — destination、利用者、route、decision point、approach、environment、error consequence を調べる。
2. **Open primary references** — [`references/signage-design.md`](./references/signage-design.md) から jurisdiction / environment に relevant な official guidance と production evidence を実際に開く。
3. **Extract the information system** — sign role、nomenclature、route hierarchy、placement、confirmation、accessibility、maintenance の差分を比較する。
4. **Translate to the place** — current architecture / brand / language / operation / regulation に合わせ、何を sign が担い、何を architecture / map / staff / landmark に任せるか決める。
5. **Implement a sign family** — destination vocabulary と route logic を先に固定し、必要な sign types だけを作る。
6. **Verify in context** — flat artwork ではなく、actual-size または calibrated full-scale proxy を real approach path / decision point / lighting / crowd condition で確認する。

## Observe

reference と現地を Inspect するとき、最初に style ではなく次を見る。

### Journey and consequence

- 誰が、どこから、どの destination へ移動するか
- first-time visitor / frequent user / staff / delivery / emergency response で必要情報がどう違うか
- arrival 前に利用者が知っている destination name と、現地の表示名が一致するか
- route 上の decision point はどこか
- 間違った判断の consequence が detour / delay / missed appointment / unsafe route / emergency failure のどれか
- accessible route、restricted route、temporary closure 等で route が分岐するか

### Sign role

各 sign を最低限次のどれかとして説明する。

- **Identification** — ここが何処かを識別する
- **Orientation** — 現在地と周辺構造を理解する
- **Direction** — decision point で次の進行方向を選ぶ
- **Confirmation / reassurance** — 選択後、route が正しいと確認する
- **Information / instruction** — 行動方法、利用条件、営業時間等を伝える
- **Regulation / safety** — 禁止、義務、hazard、egress 等を伝える

一枚が複数 role を持つ場合も、情報ごとの責務を分ける。

### Route and placement

- sign は判断が必要になる前に見えるか
- approach direction / approach angle ごとに情報が見えるか
- junction を通過してから arrow が見える状態になっていないか
- decision 後に confirmation があるか
- sign 間隔を均等にするより、route complexity と uncertainty に対応しているか
- architecture / doorway / corridor / landmark が既に提供する cue と sign が重複していないか
- crowd / parked vehicle / open door / furniture / vegetation / temporary display で遮蔽されないか

### Information hierarchy and nomenclature

- destination name / floor / zone / gate / room number が system 全体で一貫するか
- pre-arrival information、ticket、appointment notice、map、staff guidance と同じ vocabulary を使うか
- parent destination と sub-destination の hierarchy が読み取れるか
- arrow と destination の grouping が曖昧でないか
- 同じ方向の destination を合理的に group できるか
- destination list が多すぎる場合、route hierarchy / information architecture 自体を再構成できないか

### Viewing condition

- viewing distance と obstacle によりどこまで近づけるか
- user の移動速度 / dwell time
- sign の高さ、方向、mounting plane と sightline
- ambient light、backlight、shadow、reflection、glare
- competing posters / retail / architecture / screens の visual noise
- day / night、indoor / outdoor、weather の変化
- actual-size で letterform / counter / symbol / arrow / spacing が生きるか

固定 font size や sign size を universal rule にしない。applicable standard、viewing geometry、environment から決める。

### Accessibility and modality

- applicable law / standard が visual / tactile / braille / symbol / mounting 等に何を要求するか
- visual information と tactile information を同一 sign で担うか分離するか
- contrast だけでなく glare / finish / illumination が読解を妨げないか
- color のみに route / zone / state の意味を載せていないか
- pictogram が文字を補助するのか、standardized symbol として単独で意味を持つのか
- wheelchair route、step-free route、hearing assistance 等の access information が route decision 前に届くか
- cognitive load を architecture、landmark、zone cue、confirmation で減らせるか

数値要件は jurisdiction と sign type により異なる。ADA、MLIT、fire/traffic code 等の値を別 context へ移植しない。

### Language and symbols

- audience に必要な language / script は何か
- language order と hierarchy が毎 sign で変わっていないか
- translation 後の長さで grouping / line break / arrow alignment が壊れないか
- station / gate / route number 等、language independent な identifier を補助 cue にできるか
- pictogram が地域・system の standardized symbol と整合するか
- unfamiliar icon を decorative shortcut として導入していないか

### Sign family and place

- identification / direction / confirmation / directory が同じ system と認識できるか
- sign role の違いが visual hierarchy で区別できるか
- place / brand expression が route information を上回っていないか
- material / shape / color / typography が architecture と協調しつつ、必要な visual prominence を確保するか
- brand color や custom type が applicable accessibility / safety requirement と衝突する場合、機能を優先できるか

### Change and maintenance

- destination / tenant / floor use / temporary closure がどの頻度で変わるか
- update される部分と permanent な部分を分離できるか
- modular panel / digital content / replaceable insert が必要か
- outdoor exposure、cleaning、vandalism、wear で contrast / surface / attachment が劣化しないか
- source of truth と現地 sign が drift したとき誰が更新するか
- legacy sign が残り conflicting instruction を作らないか

## Decision rules

### 1. Start from route decisions, not a sign inventory

既存 sign を一枚ずつ redesign する前に、代表 journey を route と decision point に分解する。

各 decision point で記録する。

- user がここで判断すること
- 判断に必要な destination / route information
- information を見るべき approach
- 判断後に必要な confirmation
- 誤りから recovery する方法

必要性を説明できない sign は削除候補にする。

### 2. Reduce uncertainty before adding more signs

迷いが発生したとき、即座に sign を追加しない。

先に確認する。

- destination naming が inconsistent ではないか
- building / floor / zone numbering が理解しにくくないか
- architecture が入口や route を隠していないか
- map と現地 vocabulary がずれていないか
- confirmation が欠けているだけではないか
- 一つの sign に destination を詰めすぎていないか

signage は spatial / information problem を隠す decoration にしない。

### 3. Separate role from visual form

「totem」「wall panel」「hanging sign」から設計を始めない。

先に role と context を決め、その後で mounting / form を選ぶ。

同じ directional role でも、広い concourse、狭い corridor、street、doorway では適切な physical form が異なりうる。

### 4. Keep nomenclature stable across the whole journey

一つの destination を途中で略称、brand name、building name、department name に無理由で切り替えない。

名称変更が必要なら、transition cue を明示する。

pre-arrival material / booking / website / map / physical sign / staff script の vocabulary も可能な限り揃える。

### 5. Put directional information before the decision

arrow / destination label は junction の後ではなく、判断前に認識できる位置へ置く。

placement は floorplan 上の座標だけで決めず、actual approach sightline から評価する。

### 6. Reassure after consequential decisions

長い corridor、level change、building transition、outdoor route 等では、次の decision point まで無情報にしない。

ただし reassurance sign を等間隔で機械的に置かない。uncertainty が上がる区間で用いる。

### 7. Apply standards by scope

applicable authoritative requirement を最初に特定する。

例:

- permanent room identification
- directional / informational sign
- accessibility symbol
- life-safety / egress sign
- public transport guidance
- traffic sign

同じ sign board 内でも content role により requirement が異なる場合がある。

**official numeric rule はその jurisdiction / sign category に限定して適用する。**
standard が違う project へ magic number として転用しない。

### 8. Use symbols as redundant cues, not private language

standardized / well-understood pictogram が存在する場合は reference を確認する。

custom symbol が必要なら、brand style より recognition と family consistency を優先し、user evaluation を行う。

critical destination を unfamiliar icon だけで示さない。

### 9. Treat multilingual content as hierarchy, not duplication

language を増やすだけで完成としない。

- same destination の language variants を視覚的に group する
- arrow / number / pictogram を共有 cue として利用する
- long translation を actual sign width で試す
- reading order が sign family 全体で安定するようにする

対象 audience と governing guidance が要求しない language を数合わせで増やさない。

### 10. Let identity support orientation

brand / place character は secondary layer として使える。

有効な例:

- zone recognition を助ける retained cue
- entrance / destination を環境から識別しやすくする material / color
- architecture と sign family の関係を一貫させる

避ける例:

- brand palette を守るため contrast / safety coding を壊す
- expressive type を long-distance directional copy に強制する
- environmental graphic が directional sign と競合する

### 11. Design updates as part of the system

頻繁に変わる content を permanent fabrication に固定しない。

change rate に合わせて replaceable / modular / digital / temporary layer を選び、更新後も alignment、hierarchy、accessibility、material quality が壊れない方式にする。

## Responsibility boundaries

### `navigation-design`

website / app 内の information-space movement、current state、route semantics を担当する。
`signage-design` は physical journey、sightline、decision point、environment、installed sign family を担当する。

### `poster-design`

promotional / editorial display の first-read / second-read hierarchy を担当する。
通路で大きく見える artifact でも、route selection / place identification / instruction が主目的なら `signage-design` を使う。

### `map-design`

map の spatial abstraction、scale、label、route depiction を担当する。
`signage-design` は map をどこで何の判断に使うか、周辺 signs と nomenclature / orientation をどう繋ぐかを担当する。

### `brand-identity` / `brand-mark`

durable identity と canonical mark を担当する。
`signage-design` はそれらを physical guidance の hierarchy・contrast・material constraints に適応する。

### `iconography-system`

icon family の metaphor / geometry / family consistency を担当する。
`signage-design` は standardized pictogram の選択と environmental deployment を担当する。

### `inclusive-design` / accessibility guidance

cross-capability exclusion と applicable standards の broad evidence を担当する。
`signage-design` は physical wayfinding 固有の visual / tactile / route / placement requirement を journey に適用する。

architecture、interior / landscape design、structural / fabrication / electrical engineering、fire / traffic code interpretation は collaborating domain とし、この Skill で代替しない。

## References

詳細は [`references/signage-design.md`](./references/signage-design.md) を開く。

最低限、task に relevant な **official source + 複数の independent production system** を比較する。

current platform / regulation / public guidance は date/status を再確認する。

## Avoid

- floorplan 上だけで sign placement を決める
- sign を一定間隔で配置すれば wayfinding system になると考える
- confusion を sign 数の追加だけで解決する
- destination の呼び方を sign ごとに変える
- junction 通過後に directional sign を置く
- arrow と destination の association を曖昧にする
- color だけで floor / route / status を区別する
- unfamiliar custom pictogram だけで critical information を伝える
- brand expression を accessibility / safety / legibility より優先する
- one jurisdiction の numeric requirement を universal rule にする
- mockup 上の wall に sign を貼った画像だけで readability を証明する
- pristine initial installation だけを見て update / maintenance / weathering を無視する
- signage で architecture / naming / circulation の根本的な矛盾を隠す

## Verify

source artwork、spec sheet、mockup の生成成功だけでは完了しない。

### 1. Journey matrix

代表 journey ごとに記録する。

| Step | Decision / confirmation | Needed information | Sign / other cue | Approach | Failure consequence |
| --- | --- | --- | --- | --- | --- |
| arrival | destination entrance を選ぶ | building / zone identity | facade + identification | street approach | wrong entrance |
| junction | route を選ぶ | destination + direction | directional sign | walking | detour |
| after turn | route を確認する | destination / zone cue | confirmation | corridor | uncertainty |

実 project の journey に置き換える。表の項目数を固定 rule にしない。

### 2. Full-scale / calibrated-size inspection

重要な sign type を actual size または viewing geometry を保持した calibrated proxy で render / prototype する。

確認する。

- intended viewing distance から primary information を発見・識別できる
- approach angle を変えても必要な moment で見える
- actual copy / longest required translation で hierarchy が成立する
- arrow / symbol / number / destination の association が一意
- glare / shadow / background competition で cue が消えない
- tactile / braille 等が必要な場合、applicable standard に従う placement と fabrication が可能

### 3. Walk the route

可能なら現地、難しければ spatially faithful prototype / walkthrough で、representative user journey を最初から最後まで辿る。

各 decision point で **sign を知っている前提で探さない**。

- decision 前に cue を発見できるか
- sign を読んだ後、physical route と arrow が一致するか
- turn / level change 後に reassurance が得られるか
- wrong turn から recovery できるか
- conflicting legacy / temporary sign がないか
- crowd / obstruction / alternate approach でも route が成立するか

### 4. Accessibility / language stress test

project に relevant な condition を選んで確認する。

- low vision / glare / reduced contrast
- tactile / braille requirement
- wheelchair / step-free route distinction
- Japanese / Latin / mixed or other required scripts
- longest destination / translated labels
- standardized accessibility / transport pictograms
- cognitive load: similar names, similar corridors, repeated floors

heuristic inspection を disabled user validation と呼ばない。可能なら relevant users と representative route を trial する。

### 5. Family and change test

minimum で identification / direction / confirmation など materially different な sign roles を並べる。

- 同じ system と認識できるか
- role hierarchy は混同されないか
- temporary update / tenant change / closure を入れても system が壊れないか
- new panel と old panel が矛盾しない update workflow を持つか

### 6. Final installed representation

production-ready output 後、可能なら installation / prototype を撮影または現地 inspection する。

flat elevation だけでなく、利用者 eye-level の approach view、decision point、after-turn confirmation、day/night または relevant lighting state を残す。

### Completion gate

次を evidence とともに説明できるまで promotion 完了としない。

- representative journey と critical decision points
- sign role と、sign 以外の environmental cue の責務分担
- applicable accessibility / safety / transport standard と scope
- nomenclature / route hierarchy / confirmation logic
- viewing condition と full-scale readability
- multilingual / pictogram strategy が必要な場合の実物確認
- maintenance / content-change strategy
- real route / installed or spatially faithful artifact trial の結果と remaining limitations
