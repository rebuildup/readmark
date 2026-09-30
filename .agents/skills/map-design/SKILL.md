---
name: map-design
description: >
  Design task-specific 2D maps by choosing the right spatial model, scale, generalization,
  feature hierarchy, labels, symbols, and geographic-vs-topological truth, then verify the
  delivered map at its actual size and relevant scales or route tasks.
---

# Map Design

地図を「場所のデータを全部描くもの」や「既存 basemap を装飾するもの」として扱わない。

まず利用者が地図で何を判断するのかを定義し、その判断に必要な **spatial truth** と、読みやすさのために変形・省略してよい情報を分ける。

`geographic accuracy`、`network connectivity`、`site orientation`、`route following` は同じ問題ではない。地図の種類を決める前に task を決める。

## When to use

次のような2D spatial artifact を設計するときに使う。

- geographic / reference map
- park / campus / venue / site map
- walking / visitor / route map
- transport / network map
- interactive / multi-scale web or app map の cartographic layer
- printed or exported map

定量データを geography 上へ encode する thematic map は `data-visualization` と併用する。物理空間の sign placement / journey system は `signage-design`、非地理的な構造図は `diagram-design` を優先する。

## Workflow

1. **Task と spatial claim を固定する**
   - 誰が、どこで、何を判断するための地図かを書く。
   - 誤解したときの consequence を確認する。
   - 距離、方向、形状、面積、順序、接続、ランドマークのうち、何を正しく読める必要があるかを決める。

2. **spatial model を選ぶ**
   - geographic / reference
   - site / venue
   - route-focused
   - network / topological schematic
   - quantitative thematic map の場合は `data-visualization` と責務を分担する。

3. **reference を比較する**
   - [`references/map-design.md`](./references/map-design.md) を開く。
   - geographic map、site map、multi-scale digital map、topology-first network map を少なくとも比較する。
   - 一つの creator / platform / symbol set を style template にしない。

4. **spatial contract を明示する**
   主要な spatial property ごとに次を決める。

   | Property | Treatment | Reason |
   | --- | --- | --- |
   | distance | Exact / Approximate / Abstracted / Not claimed | task に必要か |
   | direction | Exact / Approximate / Abstracted / Not claimed | orientation に必要か |
   | shape / geometry | Exact / Simplified / Displaced / Abstracted | scale と readability |
   | adjacency / order | Exact / Simplified | route / network understanding |
   | area / extent | Exact / Approximate / Not claimed | analytical meaning |

   schematic map で距離や方向を崩す場合は、それを geographic truth のように見せない。

5. **extent / scale / orientation を決める**
   - task 完了に必要な context と recovery information を含める。
   - 周辺情報を増やすこと自体を安心材料にしない。
   - north-up、route-up、user-up を慣習だけで固定せず、利用 context と spatial claim に合わせる。
   - projection は、面積・距離・方向・形状の distortion が task の意味へ影響する場合だけ明示的に検討する。GIS の projection tutorial にしない。

6. **generalization と hierarchy を設計する**
   - 現在の scale / zoom で必要な feature を選ぶ。
   - 過密なら単純縮小ではなく、selection / simplification / aggregation / displacement / omission を検討する。
   - point / line / area / label / route / landmark / terrain / boundary の優先順位を task から決める。
   - foreground task information と contextual basemap を競わせない。

7. **labels / symbols / legend を組む**
   - 地名、施設名、route、station、boundary 等の label priority を決める。
   - collision した label を無差別に縮小しない。重要度、placement、abbreviation、feature selection を見直す。
   - point / line / area の semantic difference を visual encoding に反映する。
   - symbol は feature の役割を識別するために使い、装飾アイコンを大量投入しない。
   - 直接 label で十分なら legend を増やさない。legend が必要なら map と往復しやすい grouping にする。

8. **multi-scale の場合は semantic zoom を設計する**
   - vendor 固有の zoom number を universal rule にしない。
   - overview / regional / local / detail 等、task が変わる materially different state を選ぶ。
   - zoom すると単にすべてが大きくなるのではなく、feature selection、label priority、geometry detail、route/context emphasis が適切に変わるようにする。
   - scale 間で主要 anchor が突然消えたり意味が反転したりしないか確認する。

9. **delivered representation で Verify する**
   - source file / GIS render / style JSON の生成成功で終わらない。
   - 実際の print size、browser/app viewport、exported raster/PDF、または設置 context で確認する。

## Observe

reference を開いたら、見た目ではなく次を観察する。

### Task / spatial model

- map が支援する判断は何か
- geographic / site / route / topological のどれか
- reader が距離・方向・形状・順序・接続のどれを信頼できる設計か
- 何を intentionally distort / simplify / omit しているか

### Extent / scale / generalization

- どこまでの範囲を見せ、どこで切っているか
- scale が変わると feature selection がどう変わるか
- small-scale で detail を残す代わりに何を省いているか
- simplify / aggregate / displace した feature が意味を変えていないか

### Feature hierarchy

- route / destination / station / landmark / terrain / road / boundary / water / background の優先順位
- point / line / area の区別
- contextual layer が主 task を圧迫していないか
- visual prominence と semantic importance が対応しているか

### Labels / symbols

- label priority と placement
- collision / abbreviation / repetition
- line や area と label の関係
- symbol の semantic role と family consistency
- direct labeling と legend の分担
- multilingual / long-name で hierarchy が維持できるか

### Geographic vs topological truth

- metric distance / direction を保持しているか
- station order / adjacency / interchange を優先して geometry を変えているか
- schematic distortion が利用者へ暗黙に誤解を与えないか
- geographic reference が必要な地点だけ landmark / river / district 等を戻しているか

### Multi-scale / digital

- scale ごとの feature entry / exit
- label と symbol の visibility threshold
- overview から detail まで anchor が継続しているか
- pan / zoom / rotation 後に orientation を回復できるか
- map style と interaction state が task を邪魔していないか

### Truth / maintenance

- source / naming / update date
- temporary closure / route change / construction / changed boundary 等の freshness
- uncertainty や approximate geometry が必要なら表現されているか
- data が正確でも、visual treatment が誤った certainty を与えていないか

## Decision rules

### Geographic map を選ぶ

次を読む必要があるなら geographic relationship を優先する。

- real-world direction
- relative distance
- shape / terrain
- street / path relationship
- area / boundary
- landmark との位置関係

必要以上の feature を載せず、task に必要な spatial reference を残す。

### Topological / schematic map を選ぶ

route sequence、connectivity、interchange、branch relationship が distance/shape より重要なら topology を優先してよい。

その場合:

- order / connection は正確に保つ
- geometric simplification の規則を一貫させる
- distance / angle / area を正確に読めるような偽の精密さを避ける
- geographic landmark を追加する場合は network reading を弱めない範囲にする

TfL や Vignelli の angle / spacing / line treatment を universal recipe にしない。

### Site / venue map を選ぶ

現地で orientation / destination finding が主 task なら、建物、入口、path、landmark、accessible route 等を task に合わせて選ぶ。

- map location 自体が固定される場合は `You Are Here` と現地 orientation の関係を検証する
- site 全体の completeness より、その地点から次の判断に必要な情報を優先できる
- sign 上に載る場合、map 本体は `map-design`、設置位置・decision point・sign family は `signage-design` が所有する

### Thematic map を扱う

geography 上に quantitative / statistical data を encode する場合:

- spatial reference / generalization / labels / base hierarchy = `map-design`
- quantitative scale / classing / comparison / uncertainty / data encoding = `data-visualization`

basemap が美しくても quantitative reading を阻害するなら後退させる。

### Projection を検討する

projection 名を先に選ばない。

- area comparison が重要 → area distortion を無視しない
- distance / direction が主 claim →それに影響する distortion を確認する
- local/site scale で projection difference が practical に無視できる場合、不要な理論説明を artifact に持ち込まない

exact projection choice はデータ・地域・用途の authoritative cartographic / GIS guidance に従う。

## References

runtime reference と比較観点は [`references/map-design.md`](./references/map-design.md) に保持する。

優先順:

1. task に合う official / authoritative map guidance
2. current production map / system
3. materially different な map type の比較例
4. canonical historical work は構造上の判断を学ぶために使う

reference 固有の palette、angles、font、line width、symbol shape、zoom threshold をコピーしない。

## Avoid

- basemap screenshot をそのまま最終 map にする
- 全 feature を表示して completeness を品質とみなす
- map 全体を縮小するだけで別 scale を作る
- route / destination より roads / terrain / decoration を強くする
- label collision を極小文字だけで解決する
- color だけで route / category / state を区別する
- schematic map で metric distance / direction の正確さを暗示する
- geographic map を見た目の整列だけのために topology へ変形する
- north-up、固定 zoom、固定 POI 数、固定 label size を universal rule にする
- platform/vendor の zoom level や style layer API を design principle にする
- decorative illustrated landmarks を actual navigation landmark と混同する
- stale route / entrance / boundary / facility informationを visually polished なまま配布する

## Verify

### 1. Spatial truth

- map の source / date / naming / route state を確認する。
- geographic map は主要 control point、route、boundary、landmark の位置関係を source と比較する。
- schematic map は station/order/connection/interchange を source network と比較する。
- intentional distortion / approximation が、読者が期待する spatial claim と矛盾しないか確認する。

### 2. Actual-size inspection

最終成果物を実サイズまたは実 viewport で表示する。

- label が source canvas の拡大表示でのみ読める状態ではないか
- thin line / small symbol / subtle boundary が export 後も残るか
- route と contextual features の hierarchy が一目で分かるか
- legend と map を過剰に往復しなくてよいか

### 3. Scale / zoom ladder

multi-scale map は materially different な複数 state を実際に render する。

各 state で記録する:

`Task → Visible features → Hidden/generalized features → Primary labels → Anchor continuity → Failure`

- detail が増えるほど clutter が増えるだけになっていないか
- zoom out で重要 route / destination / region が消えないか
- scale transition の直前直後で label / feature が不自然に点滅・競合しないか

### 4. Route / orientation task

代表 task を map だけで辿る。

例:

- current location を見つける
- destination を見つける
- route / interchange を追う
-曲がり / branch / entrance を確認する
- 誤った route から recovery する

答えを知っている designer の視線ではなく、必要な情報が map 上で発見できるかを見る。

### 5. Label / symbol stress

必要に応じて次を試す。

- long place names
- Japanese / Latin / mixed-language labels
- dense center vs sparse edge
- similar POI / route categories
- selected / highlighted / unavailable state

文字を小さくするだけで stress case を通さない。

### 6. Accessibility / alternate reading

- key route/category/state が color のみに依存していないか
- text/symbol/line pattern 等の redundant cue が必要か確認する
- low vision / large text / high contrast / alternate list or directions が product requirement の場合、map 単体だけで essential outcome を閉じない
- tactile/audio map 等を必要とする domain は専門 guidance を追加調査し、この Skill の generic visual rule だけで compliance を主張しない

### 7. Final delivered artifact

- print → exported PDF / rasterized page / physical-size proof
- static digital → final PNG/SVG/browser representation
- interactive map → target browser/app で pan/zoom/rotation、loading/error、representative scales
- signage map → calibrated/actual-size map + `signage-design` の installed-context verification

real project trial が済んでいない場合は、この Skill を promoted/completed と記録しない。

## Responsibility boundaries

- **`map-design`**: spatial model、extent/scale、generalization、feature hierarchy、labels/symbols、geographic-vs-topological truth、multi-scale disclosure、map artifact verification
- **`signage-design`**: physical journey、decision point、map/sign placement、sign family、installed environment
- **`data-visualization`**: quantitative question、scale/classing、statistical encoding、analytical comparison
- **`diagram-design`**: non-geographic explanatory structure / process / architecture
- **`navigation-design`**: website/application information-space navigation
- **`iconography-system`**: icon family の construction; map 上で何を symbol として使うかは `map-design`
- **inclusive/accessibility Skills**: broader exclusion / compliance; map-specific application は本 Skill

GIS software、geocoding、routing engine、surveying、spatial database、legal boundary determination は design source of truth ではない。