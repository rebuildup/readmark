---
name: data-visualization
description: >
  Use when designing, implementing, or reviewing charts, graphs, dashboards, and
  explanatory data graphics. Start from the analytical question, choose visual
  encodings deliberately, preserve truthful scales, provide accessible redundant
  cues and non-visual alternatives, and verify the rendered visualization with
  realistic data instead of treating chart-library defaults as design decisions.
---

# Data Visualization

Last reviewed: 2026-09-12

chart library の component を選ぶことと、data visualization を設計することを分ける。

**Question → Data shape → Encoding → Annotation → Interaction → Verify**

目的は「見栄えの良い chart」ではなく、
読み手が必要な pattern / comparison / uncertainty / exception を正しく理解できること。

## 1. Start from the question

最初に一文で答える。

> この visualization で何を判断・理解してほしいか。

例:

- 時間変化を見たい
- category 間の大小を比較したい
- part-to-whole を見たい
- distribution を見たい
- two variables の relationship を見たい
- geographic pattern を見たい
- threshold / target からの deviation を見たい

data field の一覧から chart type を決めない。

## 2. Inspect the data

確認する:

- quantitative / ordinal / nominal / temporal
- sample count
- category count
- range / outlier
- zero / negative values
- missing values
- uncertainty
- aggregation level
- update frequency
- units
- source / freshness

realistic data distribution を見ずに styling へ進まない。

## 3. Observe references

### USWDS — Data visualizations

https://designsystem.digital.gov/components/data-visualizations/

Observe:

- common chart type を優先する判断
- one visualization に詰め込む concept 数
- color 以外の distinguishing cue
- line / bar 等の chart-specific guidance
- assistive technology 向け table / text representation

### Apple — Charts

https://developer.apple.com/design/human-interface-guidelines/charts

Observe:

- chart を surrounding interface と統合する方法
- highlight / selection / annotation
- color を補助する shape / pattern
- chart interaction と readability の balance
- small-screen / platform context

### IBM Carbon — Data visualization legends

https://carbondesignsystem.com/data-visualization/legends/

Observe:

- legend が本当に必要か
- direct label と legend の trade-off
- color + texture
- legend interaction
- mobile / overflow behavior

### Carbon Charts — Color palettes

https://charts.carbondesignsystem.com/palettes

Observe:

- series count と palette size の relationship
- categorical palette の assignment
- custom scale を使うときの completeness
- accessibility / harmony を chart-specific palette として扱う構造

### Defra / GOV.UK — Data visualisation

https://digital.defra.gov.uk/design/data-visualisation

Observe:

- chart / map を enhancement として扱う考え方
- essential information の non-visual equivalent
- interactive visualization を user need から選ぶ原則
- public-facing accessibility constraints

### ONS — Data visualisation guidance index

https://service-manual.ons.gov.uk/data-visualisation/about

Use for:

- public statistical communication の追加 guidance
- accessible chart production の reference discovery
- chart specification を深掘りするとき

## 4. Choose encoding deliberately

priority の高い quantitative comparison ほど、
読み取りやすい encoding を使う。

候補:

- position
- length
- angle / area
- color intensity
- shape / texture

「library にあるから radial / gauge / bubble」を選ばない。

重要な exact comparison に面積や角度しか使えない場合、
label / table / annotation で補助する。

## 5. Chart selection

### Trend over time

候補:

- line
- area
- small multiples

確認:

- time interval
- missing period
- event annotation
- too many series

### Category comparison

候補:

- bar
- dot plot
- table

比較が目的なら、category order を意味のある順にする。
alphabetical order を default にしない。

### Distribution

候補:

- histogram
- box / interval
- strip / dot
- density where audience can interpret it

average だけで distribution を隠さない。

### Relationship

候補:

- scatter
- connected scatter when temporal path matters
- small multiples

correlation を causal relationship として装飾しない。

### Part-to-whole

category が多い場合は pie / donut に固執しない。
comparison が主目的なら bar / table も検討する。

### Geospatial

map が必要なのは **location が analytical variable** のとき。

地名があるだけで map にしない。
essential data を non-visual form でも提供する。

## 6. Scales and baselines

scale は story を強めるために恣意的に操作しない。

確認:

- zero baseline が比較に必要か
- truncated axis を使うなら明示されているか
- log scale の必要性と audience literacy
- consistent scale across small multiples
- unit / tick interval
- date interval
- negative value handling

特に bar の長さで magnitude を比較させる場合、
baseline の扱いを慎重に決める。

## 7. Ordering

default data order をそのまま使わない。

候補:

- ascending / descending
- time
- logical workflow
- geographic / spatial
- fixed domain convention
- highlight-first

order 自体が reading path を作る。

## 8. Labels before legends

space と data shape が許すなら、
reader が視線を往復しなくて済む direct label を優先検討する。

legend が必要な場合:

- clear language
- series order と visual order の一致
- overflow behavior
- interactive legend が data を隠す副作用

を確認する。

## 9. Color and redundant cues

UI semantic color と chart category color を分ける。

### Categorical

- distinct categories
- series count を必要以上に増やさない
- status semantic color と衝突させない

### Sequential

- low → high の ordered perception
- background contrast

### Diverging

- meaningful center / baseline が存在するときだけ使う

color だけで distinguish しない。

補助:

- direct label
- point shape
- dash
- texture
- annotation
- ordering

## 10. Annotation and emphasis

すべての data point を同じ強さで見せる必要はない。

annotation 候補:

- threshold
- target
- release / incident / event
- outlier
- latest value
- selected comparison

emphasis は analytical question を助ける場合だけ使う。

brand accent で任意の series を目立たせない。

## 11. Interaction

interaction は information access を増やすために使う。

候補:

- hover / focus details
- series isolate
- range selection
- zoom / pan
- filtering
- drill-down

確認:

- keyboard / touch path
- hover-only information になっていないか
- default state でも central message が読めるか
- filtering で axis / scale が変わる場合の continuity
- loading / empty / error

「interactive にできるから」追加しない。

## 12. Responsive transformation

desktop chart の scale-down だけで終わらせない。

small width で検討:

- label shortening / wrapping
- legend reposition
- horizontal scroll
- chart type transformation
- series reduction
- focus on selected range
- table fallback

critical information を hidden tooltip に押し込まない。

## 13. Non-visual equivalent

public / important data では、
visualization だけを唯一の access path にしない。

候補:

- concise textual summary
- accessible data table
- downloadable structured data
- source / unit / period description

chart と table で値や rounding が食い違わないようにする。

## 14. Dashboard boundary

dashboard layout / widget area allocation は `layout-system` の Dashboard / Data family を使う。

この Skill は各 visualization 内の:

- chart choice
- encoding
- scale
- label
- color
- annotation
- interaction

を担当する。

## 15. Avoid

- chart library default を design decision とみなす
- data field type だけで chart type を決める
- decorative 3D / perspective
- unnecessary gauge / radial visualization
- too many series / too many hues
- color-only distinction
- misleading axis truncation
- dual axes without a strong analytical reason
- legend と plot の視線往復を増やす
- hover しないと essential value が分からない
- map を地名があるという理由だけで使う
- animation で exact comparison を妨げる

## 16. Verify with realistic data

dummy 3-point data だけで完了しない。

stress test:

- minimum / maximum value
- zero / negative
- missing
- outlier
- one series / many series
- long label
- localized number / date
- narrow viewport
- dense dashboard context
- light / dark theme if supported

見る:

- central question に答えられるか
- scale が truthful か
- labels が衝突しないか
- colors / textures が distinguishable か
- source / unit / period が明確か
- non-visual equivalent が一致するか
- interaction なしでも基本理解できるか

## 17. Completion

完了条件:

- analytical question が明確
- chart / encoding selection の理由がある
- scale / baseline / ordering を検証した
- color 以外の redundant cue が必要箇所にある
- realistic edge-case data で render を確認した
- essential information の non-visual path を確認した
- accessibility issue は `accessibility-audit` で再検証した
