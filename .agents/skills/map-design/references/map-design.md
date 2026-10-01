# Map Design References

Last reviewed: 2026-09-15

地図の visual style をコピーするための一覧ではない。

task に応じて **spatial model / scale / generalization / feature hierarchy / labels / symbols / geographic-vs-topological truth / delivered context** を比較するために使う。

同じ reference family だけで結論を出さず、少なくとも異なる map type を比較する。

## 1. Geographic / reference cartography

### U.S. Geological Survey — 7.5-Minute OnDemand Topo Map Symbol Guide

- URL: https://www.usgs.gov/ngp-standards-and-specifications/75-minute-ondemand-topo-cartographic-specifications-map-symbol
- Type: current official cartographic specification / production map guidance
- Observe:
  - fixed map scale と feature selection の関係
  - point / line / polygon の使い分け
  - road / water / contour / structure / geographic name の hierarchy
  - feature importance を color / pattern / symbol でどう分けるか
  - dense terrain で contour interval 等をどう変えるか
- Useful for:
  - geographic/reference map で何を spatial truth として残すか
  - feature class と representation の対応
  - map scale が content choice を変える evidence
- Avoid copying:
  - USGS 固有の symbol、color、scale、topographic product rules を別 domain の universal rule にしない

### U.S. Geological Survey — US Topo Map Symbol Guide

- URL: https://www.usgs.gov/ngp-standards-and-specifications/us-topo-map-symbol-guide
- Type: official production map / symbol guidance
- Observe:
  - imagery、terrain、road、hydrography、boundary、name の重なり
  - index contour と detail contour の hierarchy
  - road functional classification と line treatment
  - typeface / size / color が feature class をどう区別するか
- Useful for:
  - geographic context を残しつつ layer competition を整理する観点
  - line / area / label の semantic hierarchy
- Avoid copying:
  - U.S. topographic convention を visitor map / transit map / thematic map へそのまま移植しない

### U.S. Geological Survey — Topographic Map Symbols

- URL: https://www.usgs.gov/educational-resources/topographic-map-symbols
- Type: official explanatory reference
- Observe:
  - feature の size/extent に応じた point / line / area representation
  - dense built-up area では individual building を省き area tint にする例
  - landmark と general background information の選択
- Useful for:
  - generalization / aggregation / omission の初歩的で明確な production evidence
- Avoid copying:
  - symbol vocabulary 自体を generic icon library として扱わない

### U.S. Geological Survey — Map projections: A working manual

- URL: https://www.usgs.gov/educational-resources/map-projections-working-manual
- Type: authoritative projection reference
- Observe:
  - projection によって保存/歪曲される spatial property が異なること
  - large-scale topographic、national atlas 等で用途に応じ選択が異なること
  - projection choice が geography の意味と無関係な renderer option ではないこと
- Useful for:
  - area / distance / direction / shape のどれを map が claim するか整理するとき
- Avoid copying:
  - projection 数式や特定 projection を default rule として Skill 本文へ持ち込まない

## 2. Site / visitor maps

### U.S. National Park Service — Map Information / Harpers Ferry Center

- URL: https://www.nps.gov/subjects/hfc/map-information.htm
- Type: official map production overview
- Observe:
  - park ごとに map の重要 feature を変える考え方
  - brochure、mobile/geospatial map、panorama、diagram、site map の役割差
  - carry-away map と現地利用 map の違い
- Useful for:
  - 「一つの standard map を全 site に当てる」発想を避ける
  - task / medium から map content を決める観点
- Avoid copying:
  - NPS visual identity や U.S. park-specific symbol を current project の brand と混同しない

### U.S. National Park Service — Wayside Maps

- URL: https://www.nps.gov/subjects/hfc/wayside-maps.htm
- Type: official site-specific wayfinding map guidance
- Observe:
  - wayside map は carry-away publication と違い location-specific であること
  - map location / purpose / audience によって content を絞ること
  - `You Are Here` が onsite orientation で強い役割を持つこと
  - photograph のような completeness より point A → B の支援を優先すること
- Useful for:
  - site map / fixed-location map の extent と information selection
  - `signage-design` と `map-design` の接点
- Avoid copying:
  - `You Are Here` をすべての map に必須化しない
  - wayside-specific numeric standard を generic map rule にしない

### U.S. National Park Service — NPMap

- URL: https://www.nps.gov/subjects/gisandmapping/npmap.htm
- Type: official digital map production system
- Observe:
  - print map symbol を web 用へそのまま流用せず legibility / accessibility に合わせて適応していること
  - interactive map が NPS identity と usable spatial information を両立させる方法
  - print と digital で同じ semantics を保持しながら representation を変えること
- Useful for:
  - medium-specific symbol adaptation
  - final surface での verification
- Avoid copying:
  - pixel dimension や NPS implementation details を universal symbol sizing rule にしない

### U.S. National Park Service — Map Symbols & Patterns for NPS Maps

- URL: https://www.nps.gov/subjects/gisandmapping/map-symbols-patterns-for-nps-maps.htm
- Type: official maintained symbol/pattern resource
- Observe:
  - map element、POI symbol、area pattern を別 semantic family として管理すること
  - standardization が repeated recognition をどう支えるか
- Useful for:
  - point / area / auxiliary map-element responsibilities の分離
- Avoid copying:
  - public-domain であっても NPS-specific semantics を別 system の meaning として無検討に使わない

## 3. Multi-scale digital cartography

### International Cartographic Association — Commission on Multi-Scale Cartography

- URL: https://generalisation.icaci.org/
- Type: established professional/research body
- Observe:
  - geographic information は複数 scale / device / environment で representation が変わること
  - map generalization と multiple representation が独立した cartographic problem であること
  - route following や planning の task が scale change と結びつくこと
- Useful for:
  - one composition を連続縮小するだけでは multi-scale map にならないという根拠
  - semantic zoom / generalization を考える入口
- Avoid copying:
  - particular algorithm を design rule とみなさない

### Mapbox — Map design and styles

- URL: https://docs.mapbox.com/help/dive-deeper/map-design/
- Type: current official platform guidance / production implementation evidence
- Observe:
  - data source と visual style layer の分離
  - background / fill / line / symbol 等の layer relationship
  - map style と interactive map behavior の責務差
  - basemap を task-specific data の context としてどう扱うか
- Useful for:
  - digital map layer hierarchy
  - renderer configuration と design decision の責務分離
- Avoid copying:
  - Mapbox Standard、3D lighting、style JSON、layer API を cartographic source of truth にしない

### Mapbox — zoom extent

- URL: https://docs.mapbox.com/help/glossary/zoom-extent/
- Type: current official multi-scale implementation evidence
- Observe:
  - detailed data を broad overview に出すと clutter し、low-resolution data を detail scale に残すと不適切になること
  - visibility range が data resolution / intended detail と結びつくこと
- Useful for:
  - feature entry / exit と semantic zoom の evidence
- Avoid copying:
  - Mapbox の zoom number を他 renderer / print scale の universal threshold にしない

### Mapbox Streets v8 — layer reference

- URL: https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/
- Type: current first-party production data/style evidence
- Observe:
  - place / POI / road / building / transit / water 等で available detail が scale により異なること
  - prominent feature が先に現れ、detail が zoom とともに増えること
- Useful for:
  - priority-based feature disclosure
  - feature hierarchy と scale の関係
- Avoid copying:
  - exact min/max zoom を generic rule として固定しない

## 4. Topological / network maps

### Transport for London — Harry Beck's Tube map

- URL: https://tfl.gov.uk/corporate/about-tfl/culture-and-heritage/harry-becks-tube-map
- Type: first-party historical/canonical explanation
- Observe:
  - geographic distance / exact shape を弱め、connection / line / station relationship を優先したこと
  - task に不要な geographic fidelity を捨てることで network reading を改善した構造
  - historical artifact が現在まで revision され続けていること
- Useful for:
  - geographic map と schematic network diagram の境界
  - retained spatial truth を明示する例
- Avoid copying:
  - 45-degree line、station spacing、roundel、line colors を metro-map universal style とみなさない

### Transport for London — current maps

- URL: https://tfl.gov.uk/maps
- Type: current first-party map family
- Observe:
  - Tube/rail、bus、cycle、river、walking、accessibility 等で異なる map products を用意していること
  - one master map ですべての mobility task を解決していないこと
  - accessible / large-print / audio 等の alternate representations
- Useful for:
  - task-specific map family と alternate representation
- Avoid copying:
  - London transport vocabulary を別 transport/service network に一般化しない

### London Transport Museum — Transforming the Tube map: Harry Beck's iconic design

- URL: https://www.ltmuseum.co.uk/collections/stories/design/transforming-tube-map-harry-becks-iconic-design
- Type: canonical historical archive / analysis
- Observe:
  - geographic predecessor と diagrammatic map の違い
  - network growth に伴う revision
  - same concept が physical pocket map / system context で使われた歴史
- Useful for:
  - topology-first abstraction の historical evidence
  - map を frozen masterpiece ではなく maintained information system として見る
- Avoid copying:
  - historical expression を現在の transit map の唯一の正解としない

### MoMA — New York City Subway Diagram, 2012

- URL: https://www.moma.org/collection/works/188381
- Type: canonical museum-held production artifact
- Observe:
  - network diagram としての geometry / route separation / station organization
  - large-format artifact で information density をどう扱うか
  - TfL と比較したときの異なる topology / geometry solution
- Useful for:
  - topology-first map が一つの visual recipe に収束しないことの比較
- Avoid copying:
  - Vignelli 固有の geometry / palette / typographic expression を style preset 化しない

### MTA — Geographic large type subway map

- URL: https://www.mta.info/node/5341
- Type: current first-party alternate map
- Observe:
  - geographic subway representation と larger labels の trade-off
  - transit network を geographic context の中で読む場合の hierarchy
- Useful for:
  - topology-first map と geographic transit map を同一 task と仮定しない比較
- Avoid copying:
  - NYC-specific service symbols / labels / geographic density を generic transit convention にしない

## 5. Cross-surface production systems

### Applied Information Group — Walk Brighton

- URL: https://appliedinformation.group/projects/walk-brighton
- Type: independent production system
- Observe:
  - master map から street sign / hotel guide / event map / mobile / downloadable map へ展開する仕組み
  - visual identity と spatial consistency の関係
  - surface が違っても同一 map semantics を維持しつつ composition を変える方法
- Useful for:
  - cross-artifact map family
  - `map-design` と `signage-design` の責務分離
- Avoid copying:
  - Brighton 固有の identity / mapping expression を city-map style として一般化しない

### Applied Information Group — Walk Rio

- URL: https://appliedinformation.group/projects/walk-rio
- Type: independent production wayfinding/cartography
- Observe:
  - mountain / sea 等の natural landmark を orientation cue として利用すること
  - architectural landmark illustration と map geometry の関係
  - walking route と neighborhood context の組み方
- Useful for:
  - landmark が decoration ではなく orientation information になる条件
  - unique local geography を generic street map より強く使う判断
- Avoid copying:
  - illustrated landmark を every city/site map の必須要素にしない

### Applied Information Group — Princeton Digital

- URL: https://appliedinformation.group/projects/princeton-digital
- Type: independent current campus/digital production example
- Observe:
  - entrance、step、ramp、steep incline 等を campus mobility task へ接続すること
  - on-campus signage と digital map の visual/semantic continuity
  - launch 後の moderated on-site usability testing
- Useful for:
  - accessibility / mobility information を map content selection に含める例
  - real context で map usefulness を検証する例
- Avoid copying:
  - campus-specific feature list を universal visitor-map checklist にしない

### Stamen — maps.stamen.com

- URL: https://stamen.com/work/maps-stamen-com/
- Live maps: https://maps.stamen.com/
- Type: independent/open production cartography family
- Observe:
  - Toner は background/context を削り data overlay のための high-contrast base とする
  - Terrain は landform / label / line generalization を orientation に利用する
  - Watercolor は traditional legibility rule を意図的に弱め expressive map に振る
  - 同じ underlying geography でも intended use により layer prominence / texture / label behavior が変わる
- Useful for:
  - one basemap style がすべての task に適さないこと
  - context map / expressive map / analytical overlay の差
- Avoid copying:
  - Watercolor / Toner の look を style filter として再現しない
  - expression を route/safety/precision task より優先しない

## 6. Comparison prompts

複数 reference を開いたら、次を表にして比較する。

| Axis | Map A | Map B | Current artifact implication |
| --- | --- | --- | --- |
| reader task | | | |
| spatial truth retained | | | |
| intentionally distorted / omitted | | | |
| scale / extent | | | |
| generalization | | | |
| route / landmark / context hierarchy | | | |
| label strategy | | | |
| point / line / area encoding | | | |
| legend burden | | | |
| multi-scale behavior | | | |
| final viewing context | | | |

特に次の比較を行う。

- **USGS ↔ TfL**: geographic metric/topographic reference と topology-first network reading
- **NPS Wayside ↔ NPS general park map**: fixed onsite decision support と carry-away/reference map
- **Mapbox / ICA ↔ static map**: scale-dependent disclosure と fixed composition
- **TfL ↔ MTA geographic map**: same broad transit domain 内の異なる spatial claim
- **Applied ↔ Stamen**: wayfinding-oriented spatial system と expressive/general basemap family

比較で得た差分を、そのまま「どちらが優れているか」へ変換しない。current task が必要とする spatial truth に合わせて選ぶ。

## 7. Freshness notes

- USGS / NPS / TfL / MTA / Mapbox は current operational guidance / products として使うため、task 実行時に更新状態を再確認する。
- route、station、entrance、accessibility、closure、boundary、facility、street 等は visual reference より source data の freshness を優先する。
- Mapbox の style / layer / zoom behavior は platform implementation evidence であり、version change があっても exact values を design rule として固定しない。
- Beck / MoMA の historical/canonical references は historical evidence として保持し、current service truth の source には使わない。
- Stamen の original project explanation は historical production evidenceを含む。current hosted tile availability / attribution は live project 側で再確認する。