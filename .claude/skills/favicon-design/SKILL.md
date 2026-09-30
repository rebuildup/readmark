---
name: favicon-design
description: >
  Design and validate browser- and search-facing site icons that preserve site or product
  recognition at tiny sizes across user-agent selection, themes, fallbacks, caching, and
  materially different browser surfaces without conflating favicons with app icons.
---

# Favicon Design

favicon を「logo を小さく書き出す作業」で完了させない。

**Identity scope → Recognition cue → Tiny-size adaptation → Resource strategy → Browser/search context → Verify** の順で、site を browser UI と search surface 上で識別させる compact identity asset として扱う。

この Skill は canonical brand mark の形状そのものを設計しない。mark の geometry / optical system は `brand-mark`、installed application の launcher / dock / taskbar / platform mask は `app-icon-design`、UI 内の icon family は `iconography-system` が担当する。

## When to use

- website / web product の favicon を新規設計または改修するとき
- full logo / wordmark が browser tab の小サイズで成立しないとき
- site family / subdomain / product ごとの favicon identity policy を決めるとき
- SVG / raster / ICO 等を含む複数 icon resource の役割を整理するとき
- light/dark 等の環境差で favicon の contrast / recognition が崩れるとき
- browser tab では見えるが bookmark / history / search result では認識しにくいとき
- framework default favicon や古い cached favicon が残っているとき
- rebrand 後に browser/search surface の identity が source asset と一致しているか監査するとき

## Workflow

1. **Inspect identity scope**
   - favicon が organization、site、product、hostname のどの単位を識別するか確認する。
   - approved mark / compact mark と brand architecture を確認する。
2. **Inspect current delivery behavior**
   - current HTML specification と target browser/search guidance を開く。
   - `type` / `media` / `sizes` / format / crawler / cache の役割を implementation evidence として確認する。
3. **Extract the tiny recognition cue**
   - silhouette、negative space、letterform、counter、color relationship のうち、小サイズで残すものを決める。
4. **Define resource strategy**
   - target surface に必要な scalable / raster / fallback / theme variant だけを用意する。
   - exact file set は current support requirements から決める。
5. **Render in real contexts**
   - authoring canvas ではなく、tab / bookmark / history / browser UI / search preview 等の target representation で見る。
6. **Verify retrieval and freshness**
   - browser が意図した resource を取得しているか確認する。
   - crawler / cache 更新が関係する surface は source 更新直後の screenshot だけで完了扱いにしない。

## Observe

reference と current artifact を次の軸で比較する。

### Identity scope

- favicon は organization 全体、site、product、subdomain のどれを表すか
- page ごとに変える必要が本当にあるか、それとも site-level recognition を壊すか
- parent brand と product identity のどちらを tiny surface で優先するか
- browser title / hostname / surrounding chrome と合わせて何が識別に必要か

### Recognition cue

- silhouette だけで区別できるか
- negative space / counter / gap が小サイズで閉じないか
- full wordmark の文字が unreadable microtype になっていないか
- color を失った場合にも最低限の形状差が残るか
- canonical mark と異なる drawing が必要なら、どの recognition cue を retained しているか

### Tiny-size behavior

- large SVG preview ではなく actual rendered size で shape が崩れないか
- thin line、small counter、fine texture、gradient boundary、anti-aliasing が recognition を弱めないか
- neighboring tabs / bookmarks の icon と並んだとき visual weight が過大・過小にならないか
- browser chrome の light/dark/background state で edge が沈まないか

### User-agent selection / resource family

- 複数 resource がある場合、`type` / `media` / `sizes` 等から user agent がどれを選び得るか
- scalable source と raster-specific source の役割が重複していないか
- unsupported format や fetch failure 時に usable fallback があるか
- implementation metadata が実 asset の format / available size と一致しているか

### Theme / background

- one asset で複数背景へ耐えるのか、media-conditioned variant を使うのか
- theme variant で brand identity 自体が変わって見えないか
- transparent area と surrounding browser surface の組み合わせで silhouette が消えないか
- current browser support を確認せず dark variant を universal requirement にしていないか

### Browser / search surface

- tab、bookmark、history、browser suggestion、search result 等で表示サイズ・周辺情報がどう違うか
- browser title / site name / hostname が近接する surface で icon 内 text が冗長になっていないか
- search crawler が取得できる URL か
- site/hostname identity policy と search surface の grouping が矛盾していないか

### Freshness / cache

- favicon URL / metadata 更新後に browser/search surface がいつ反映されるか
- stale cache を source-file failure と誤認していないか
- reverse に、local cache が新 asset を見せているだけで public crawler delivery を確認したことにしていないか
- rebrand 時に legacy resource / framework default / old fallback が残っていないか

## References

実装前に [`references/favicon-design.md`](./references/favicon-design.md) を開き、target surface に近い current source を複数比較する。

優先順位:

1. current HTML / browser / search specification or official guidance
2. current project の approved identity assets / brand architecture
3. current production design-system favicon implementation
4. supporting compatibility documentation when needed

reference 固有の pixel size、format bundle、色、filename、brand architecture を universal rule にしない。

## Decision rules

### 1. Site identity の単位を最初に決める

favicon は tiny artwork の自由枠ではない。

まず次を記録する。

```text
Identity owner:
Site / hostname / product scope:
Canonical upstream mark:
Tiny recognition cue:
Surrounding label/context:
```

組織全体で一つの favicon を使う system も、product ごとに controlled variant を持つ system も成立する。どちらを採用するかは brand architecture と site grouping から決める。

search engine や browser が site identity を特定の単位で扱う場合、その current behavior を delivery constraint として確認する。

### 2. Full logo を mechanical downscale しない

wordmark、fine detail、複数色の関係が actual tiny render で失われる場合、approved compact mark を使うか favicon 用 optical adaptation を定義する。

ただし favicon adaptation のために canonical mark を無断で改変しない。上流の mark system 自体に compact state が必要なら `brand-mark` へ戻す。

favicon 固有 adaptation は次のように理由を残す。

```text
Failure at target surface:
Retained cue:
Removed / changed detail:
Why this remains the same identity:
```

### 3. One file を design principle にしない

HTML の icon resource は user agent が選択する。scalable source 一つで target support が十分な場合も、互換 fallback / raster-specific source が必要な場合もある。

resource family は current target support から最小限決める。`SVG + ICO + PNG を必ず全部作る`、`favicon.ico 一枚で十分`のどちらも universal rule にしない。

### 4. Theme variant は recognition failure があるときに使う

light/dark variant を作る前に、primary asset が materially different な browser surface で本当に失敗するか確認する。

variant を使う場合:

- primary silhouette / identity cue を保持する
- contrast correction と別 brand 化を混同しない
- `media` 等の current selection behavior / browser support を確認する
- fallback asset でも recognition が残るようにする

### 5. Favicon と app/home-screen icon を同一 artifact にしない

同じ upstream mark を共有しても delivery context は異なる。

- favicon: browser/search による site/page identity、user-agent resource selection、tiny browser context
- app icon: installed application の platform mask / material / theme / launcher context
- touch/home-screen icon: shortcut/install surface の platform-specific delivery
- OG image: URL preview の large social/link representation

一つの大きな square asset を全用途へ流用して QA を省略しない。

### 6. Search/crawler requirements は design と delivery の両方で確認する

search surface を対象にする場合、current official guidance で site grouping、crawlability、resource stability、format/aspect requirements を確認する。

これらは search delivery constraint であり、browser tab の universal composition rule ではない。

### 7. Cache を含む final state を検証する

HTML specification は icon list の変更後に user agent が必ず即時更新することを要求していない。search crawler も反映に時間を要し得る。

そのため rebrand / replacement では:

- source metadata
- network-fetched resource
- clean/fresh browser context
- cached existing context
- public/search crawler context（対象なら）

を分けて確認する。

`hard reload で見えた`だけを deployment 完了の証拠にしない。

## Avoid

- full wordmark / detailed logo を縮小して読めないまま使う
- favicon を arbitrary な rounded-square app icon に変換する
- app icon / touch icon / OG image と一つの asset packageだから同じ design rule と考える
- framework / starter の default favicon を残す
- one large SVG / raster の authoring preview だけで small-size quality を判断する
- transparent edge が browser background に溶けるのを見逃す
- dark/light variant を browser support / fallback 確認なしで追加する
- format / file-size / pixel-size の current platform値を universal design law にする
- subdirectory / page ごとに理由なく favicon を変えて site identity を分裂させる
- local browser cache だけを見て crawler/public delivery を確認したことにする
- rebrand 後も旧 `/favicon.ico` や legacy fallback を放置する

## Verify

source SVG / ICO / PNG の生成成功では完了しない。**利用者が見る browser/search representation** を確認する。

### 1. Scale ladder

current target で意味のある tiny sizes へ実際に rasterize / render する。

見るもの:

- silhouette recognition
- counter / gap / stroke survival
- visual weight
- edge/background separation
- color dependency
- canonical mark との identity continuity

zoomed vector preview は代替にならない。

### 2. Browser-context check

対象 browser / platform のうち materially different な context を実際に開く。

最低でも target に該当するものから複数選ぶ。

- active tab / inactive tab
- tab strip with neighboring sites
- bookmark / favorites UI
- history / address-bar suggestion 等
- light / dark browser chrome

browser が実際に選んだ resource を DevTools / network / page metadata 等で確認できる場合は、見た目と resource identity の両方を確認する。

### 3. Search-context check

search exposure が要件なら current official guidance を再確認し、少なくとも:

- home/site metadata が crawler から到達可能
- icon resource が crawlable / stable
- intended site/hostname identity と矛盾しない
- search preview が利用可能になった時点で実表示を確認

を行う。

crawler recrawl 待ちを visual failure と誤認しない一方、source configuration だけで search appearance を確認済みと主張しない。

### 4. Fallback / theme check

複数 source / variant を持つ場合:

- preferred source が使われる context
- fallback source が使われる context
- light/dark 等の intended variant
- unsupported / stale resource scenario

を可能な範囲で検証する。

fallback だけ古い brand、theme variant だけ別 silhouette、といった drift を探す。

### 5. Rebrand / freshness check

replacement task では clean profile / fresh session と既存 cached session を区別して確認する。

記録する。

```text
Surface / browser:
Expected resource / identity:
Observed resource / identity:
Cache/freshness state:
Failure:
Revision:
Retest:
```

## Responsibility boundaries

- `brand-mark`: canonical symbol / wordmark / monogram / compact-mark geometry、recognition、optical correction
- `favicon-design`: browser/search site identity への tiny adaptation、resource strategy、theme/fallback/cache/crawler と final browser-context QA
- `app-icon-design`: installed-app platform mask / layer / material / launch-surface adaptation
- `iconography-system`: product UI 内の action / object / navigation / status icon family
- `og-image-design`: crawler-derived URL preview の large image / metadata relationship
- `brand-identity`: organization/product の durable identity architecture。favicon がどの entity を表すかの上流判断

境界に迷ったら、**identity-bearing shape 自体の問題は上流 `brand-mark`、browser/search がその identity を tiny site resource として選択・表示する問題はこの Skill** と切り分ける。

## Completion boundary

Skill 本文を書いただけで first-class promotion を完了としない。

少なくとも一つの real site/product で approved/current identity を favicon resource family へ翻訳し、actual tiny render、materially different browser contexts、fallback/theme（該当時）、search/crawler delivery（要件時）、cache/rebrand freshness を確認し、failure / revision を durable に記録するまでは experimental として扱う。
