---
name: infographic-design
description: >
  Use when designing an explanatory information graphic that combines text, data,
  diagrams, maps, pictograms, illustration, and annotations into one reader journey.
  Structure claims and evidence first, assign each unit to the right representation,
  preserve source truth and accessible alternatives, and verify the delivered artifact.
---

# Infographic Design

infographic を「chart に装飾を足したもの」や「縦長 poster」として作らない。

**Question → Evidence → Explanation architecture → Representation assignment → Reading path → Verify**

`data-visualization` / `diagram-design` / `map-design` の専門判断を束ねながら、infographic 全体の説明構造・読み順・representation 間の関係を設計する。

## When to use

次の条件で使う。

- 一つの説明に text / statistic / chart / diagram / map / pictogram / illustration など複数の representation が必要
- overview から detail へ reader を導く必要がある
- 複数の claim / section / evidence を一つの visual artifact として理解させたい
- poster 的な first impression より、説明・理解・比較・行動が主目的

次の場合は infographic を作らないことも選ぶ。

- body text と見出しだけで十分理解できる
- quantitative comparison 一つが中心なら chart / `data-visualization` だけで足りる
- relationship / process 一つが中心なら `diagram-design` だけで足りる
- spatial task が中心なら `map-design` を使う
- 長い連続本文と複数ページの読書が中心なら `document-design` を使う

## Workflow

1. reader が最後に理解・判断・実行すべきことを一文にする。
2. source / data / approved copy を確認し、claim と evidence を分ける。
3. references を開き、説明構造・representation ownership・reading path を比較する。
4. explanation を section / evidence unit に分け、各 unit に最も適した representation を割り当てる。
5. overview → section → detail の hierarchy と、local / global reading order を設計する。
6. source / unit / period / uncertainty / qualifier を該当 claim から切り離さない。
7. final artifact と equivalent text/data path を実物で検証する。

## Observe

- reader question / desired understanding or action
- claim と evidence の境界
- explanation model: overview / sequence / comparison / taxonomy / process / spatial / mixed
- section/chunk boundary と reading path
- representation ownership: prose / key statistic / chart / diagram / map / pictogram / illustration / annotation
- visual と text の complementarity / redundancy
- data-bearing / explanatory / decorative graphics の違い
- headline / key claim / evidence / context / source の hierarchy
- whole-artifact scan order と section 内 reading order
- source / unit / period / uncertainty / provenance の近接性
- dense / sparse region と progressive detail
- section 単体で抜き出された場合の context survival
- target-size / reduction / zoom / narrow surface / paged behavior
- equivalent text / underlying data path
- long copy / Japanese / Latin / mixed-script expansion
- final raster / PDF / Web representation

詳細 reference は [references/infographic-design.md](references/infographic-design.md) を読む。

## Decision rules

### 1. Claim before composition

visual treatment を決める前に、各 section を次で整理する。

- **Claim** — reader に理解してほしいこと
- **Evidence** — claim を支える data / source / relationship / example
- **Qualifier** — unit / period / scope / uncertainty / exception
- **Representation** — 何で見せると最も誤解が少ないか

visual が evidence より強い主張を作ってはいけない。

### 2. Representation を役割で選ぶ

- exact wording / caveat / instruction → prose / label
- hero statistic → number + context。数値だけを孤立させない
- quantitative pattern / comparison → `data-visualization`
- process / relationship / hierarchy → `diagram-design`
- geographic / route / spatial relation → `map-design`
- concrete object / scenario / metaphor の補助 → illustration / pictogram / image

同じ情報を paragraph・icon・chart・large number で重複して「情報量」を増やさない。

### 3. Visual role を区別する

- **Data-bearing** — 値・量・位置・関係を encode する。source truth を保持する。
- **Explanatory** — concept / process / object / scenario の理解を助ける。
- **Decorative** — mood / identity / rhythm を作るが、essential information を所有しない。

装飾を data-bearing に見せない。面積・個数・位置が量を意味しそうな表現を、意味なしに使わない。

### 4. Reading path を一本の線に固定しない

infographic は overview から section を選択して読む場合もある。

- 最初に artifact の主題と dominant claim が分かる
- section boundary が見える
- section 内の reading order が復元できる
- secondary detail が primary claim と競合しない
- section を単体で共有・切り出すなら必要な title / unit / source context が残る

矢印を足す前に hierarchy / grouping / alignment で順序を表せないか確認する。

### 5. Source truth を visual story に従属させない

- data source / period / unit を確認する
- comparison denominator / population / scope を落とさない
- estimate / uncertainty / projection を observed fact と同じ見せ方にしない
- decorative metaphor の面積・距離・個数で偽の quantitative meaning を作らない
- source note を読めない大きさへ追いやって claim の qualifier を実質消さない

### 6. Accessibility は別 artifact への丸投げにしない

W3C / GOV.UK の complex-image guidance に従い、visual を見られなくても essential information に到達できる path を持たせる。

- concise alt text だけで足りない complex infographic は surrounding body text / structured long description を用意する
- quantitative content は可能なら underlying table / data へ到達できるようにする
- text alternative の順序は visual の座標説明ではなく、meaningful reading order にする
- zoom / magnification で二方向 scroll が必要になる場合、全体構造を失わない代替も検討する

## Responsibility boundaries

- `infographic-design`: claim/section architecture、representation assignment、mixed-media reading path、provenance placement、whole-artifact QA
- `data-visualization`: chart choice、quantitative encoding、scale、baseline、annotation、data alternative
- `diagram-design`: node / connector / grouping / process / relationship semantics
- `map-design`: spatial abstraction、scale/generalization、geographic/topological truth
- `document-design`: long-form paginated document hierarchy
- `content-design`: wording、information clarity、instruction/message quality
- `visual-hierarchy`: cross-channel salience / priority orchestration

## Avoid

- infographic が必要か検討せず、長い text を image 化する
- chart / diagram / map の semantic rule を decorative composition のために壊す
- icon の個数や面積が量を表すように見えるのに data と一致しない
- every section に同じ card / big number / icon formula を機械的に当てる
- visual と text で同じ sentence を繰り返す
- source / unit / period / qualifier を footnote に追いやって実質読めなくする
- illustration / metaphor で evidence にない causality や magnitude を示唆する
- one giant raster image だけを accessible delivery とみなす
- Figma / Illustrator / Canva template の構造を design source of truth にする

## Verify

### Truth check

- source と final claim / number / unit / period / qualifier を照合する
- chart は `data-visualization`、diagram は `diagram-design`、map は `map-design` の verification を通す
- visual metaphor が evidence より強い意味を作っていないか確認する

### Reading check

- target size で主題と dominant claim を特定できるか
- overview → section → evidence の hierarchy を辿れるか
- section 単体でも必要な context が残るか
- どこから読むか不明な領域、salience competition、過剰な legend 往復がないか確認する

### Representation check

- text / statistic / chart / diagram / map / illustration の各 role を説明できるか
- decorative element を消しても information truth が変わらないか
- data-bearing element を消すと失われる情報が text/equivalent path に存在するか

### Stress check

- actual target size と縮小 view
- zoom / magnification
- narrow / mobile embed または paged/PDF context（対象なら）
- long label / long source / Japanese / Latin / mixed-language sample
- grayscale / non-color cue where meaning uses color
- final raster / PDF / browser render and compression

### Accessibility check

- complex visual の essential information を logical text order で取得できるか
- underlying data が必要な artifact では data/table path が visual と一致するか
- text alternative が単なる「infographic showing ...」で終わっていないか

## Completion

初版は experimental とする。

first-class promotion 前に real infographic を一つ以上、`source truth → claim architecture → representation assignment → final artifact → equivalent text/data path` まで通し、誤読・density・reading order・source context・accessibility の failure と revision を記録する。

Last reviewed: 2026-09-15
