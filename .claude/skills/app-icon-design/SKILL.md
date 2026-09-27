---
name: app-icon-design
description: >
  Design and adapt installed-application icons across platform-owned masks, rendering modes,
  themes, layers, sizes, and launch surfaces while preserving product recognition.
---

# App Icon Design

installed application の launcher / home screen / dock / taskbar / Start 等で表示される app icon を設計・適応するときに使う。

この Skill が扱うのは canonical brand mark の新規設計ではない。既存または正当に設計中の identity cue を、platform が container・mask・theme・material・rendering mode・size を部分的に所有する **app-icon system** へ翻訳する。

`brand mark を正方形へ置く`、`一つの大きな raster を全環境へ縮小する`、`一つの platform の grid を全 platform へ転用する`ことを原則にしない。

## When to use

- mobile / desktop / installed web app の app icon を新規設計または改修するとき
- 同じ product identity を Apple / Android / Windows / installed Web へ展開するとき
- full-color icon から dark / monochrome / themed / high-contrast 等の platform mode を作るとき
- platform mask や launcher crop で既存 mark が破綻するとき
- 小サイズ、taskbar、dock、Start、home screen 等で recognition が弱いとき
- platform 更新により icon material / mask / theming / asset model が変わったとき

canonical symbol / wordmark / monogram / lockup の geometry・optical correction 自体を設計する場合は `brand-mark` を使う。UI 内の icon family は `iconography-system`、browser tab / bookmark / pinned-tab 固有の asset は `favicon-design` の責務とする。

## Workflow

1. **Inspect identity truth**
   - 現行の approved mark / product identity / trademark constraints を確認する。
   - app icon が保持すべき recognition cue を言語化する。
2. **Inspect target platform contexts**
   - current official guidance を開き、container / mask / layer / rendering mode / theme / size / system effect を確認する。
   - store artwork と installed icon、UI icon、favicon を混同しない。
3. **Extract adaptation contract**
   - `Retained identity cue / Platform-owned behavior / Adaptable property / Failure risk` を整理する。
4. **Translate into icon states**
   - 必要な platform / theme / monochrome / size state だけを作る。
   - variant は「仕様上要求されるから」だけでなく、その state で何が失われるかを確認して調整する。
5. **Render in system-like contexts**
   - authoring canvas ではなく、実際の mask・theme・background・size・neighbor icons を含む表示へ近づける。
6. **Verify delivered representations**
   - final asset を launcher / home screen / dock / taskbar / Start / installed-app surface で確認し、必要なら state ごとに optical correction する。

## Observe

reference を比較するときは次を見る。

### Identity / recognition

- app を識別させる primary cue は silhouette、symbol、letterform、object、color relationship のどれか
- product name が system label として近接する場合、icon 内 typography は何を追加しているか
- canonical mark と app icon のどこが同一で、どこが delivery context に合わせて変形されているか
- brand equity を保つために絶対に残す relationship は何か

### Container / mask

- enclosure shape を designer と platform のどちらが所有するか
- platform が mask を変える可能性があるか
- edge まで届く background と、mask 内に留める recognition cue をどう分けるか
- crop / mask が変わっても semantic cue が残る領域はどこか
- optical center と geometric center が一致しているか

### Layer model

- flattened artwork か、foreground/background 等の分離 layer か
- layer separation が platform-generated motion / depth / material / tint の入力になるか
- author-added shadow / bevel / material が system effect と二重化しないか
- layer 間の overlap・contrast が mode 変更後も読めるか

### Rendering modes / themes

- full color、dark、monochrome/themed、high-contrast 等で system が何を保持・破棄・再着色するか
- hue に依存していた recognition が monochrome 化で消えないか
- light/dark background 上で edge や silhouette が沈まないか
- alternate mode が primary icon の単純 filter で成立するか、別 optical treatment が必要か

### Scale / reproduction

- large preview では成立する detail が smallest relevant surface で残るか
- system が exact size asset を選ぶか、downscale / crop / rasterize するか
- thin gap、small counter、fine texture、soft shadow が縮小後にどう変わるか
- neighboring app icons と並べたとき visual weight が過大/過小にならないか

### Cross-platform relationship

- platform 間で保持する cue と、platform convention に合わせて変える cue を分ける
- enclosure、material、layering、theming を brand invariant にしてしまっていないか
- platform adapter が canonical brand asset を恒久的に変更していないか

## References

current platform behavior は変化する。実装前に [`references/app-icon-design.md`](./references/app-icon-design.md) を開き、target platform の current source と `Last reviewed` を確認する。

優先順位:

1. target platform の current official guidance / specification
2. target platform の current construction / delivery guidance
3. first-party rendered examples
4. current project の approved identity assets

platform-specific 数値・grid・safe zone・file requirements は、その platform の delivery constraint として扱う。他 platform の普遍則へ昇格させない。

## Decision rules

### 1. Recognition cue を container より先に決める

まず「この app を何で認識するか」を決める。rounded square、circle、Liquid Glass、adaptive mask 等は platform context であり、identity cue そのものとは限らない。

canonical mark を使う場合も、その mark が app-icon scale / crop / mode で成立するかを再検証する。成立しなければ `brand-mark` 側の compact state を参照するか、app-icon delivery 用の optical adaptation を明示する。

### 2. Platform-owned shape を artwork に焼き込まない

platform が mask / enclosure を適用する系では、同じ rounded rectangle を artwork 側へ重ねて二重 contour を作らない。

ただし platform が enclosure を designer 側へ要求する場合や、background が identity の一部として full-bleed する場合は current guidance に従う。`角丸を付ける/付けない`を cross-platform rule にしない。

### 3. Safe region は「重要情報を守る領域」として使う

official safe-area / mask guidance がある場合、identity-critical cue を guaranteed region に残す。背景・texture・非 essential detail は outer region へ拡張してよい。

safe-area の数値を他 platform へコピーしない。safe region は mask model の仕様であって、普遍的な composition ratio ではない。

### 4. Rendering mode ごとに失われる情報を確認する

monochrome/themed mode では color information が消える可能性がある。dark mode では edge contrast が逆転する場合がある。system-generated plate/material/highlight が追加される場合もある。

mode variant は primary artwork への mechanical filter ではなく、**recognition cue が残るか**で判断する。必要なら silhouette、negative space、layer relation、stroke/fill balance を state ごとに調整する。

### 5. Layering は platform behavior の入力として設計する

layered icon を要求/推奨する platform では、foreground/background 分離を単なる editor organization にしない。mask、depth、parallax、material、theming に対して各 layer がどう振る舞うかを確認する。

逆に flattened asset を使う surface では、layer effect に依存しない recognition も残す。

### 6. One master raster を quality strategy にしない

platform が複数 size asset や scale を扱う場合、最小 relevant size まで実際に rasterize して確認する。必要なら detail reduction、gap/counter correction、weight adjustment を行う。

exact required sizes は current platform docs から取得する。Skill 本文に固定しない。

### 7. Cross-platform consistency は pixel identity ではなく recognition continuity で取る

Apple、Android、Windows、Web で enclosure / mask / material / theme model が異なっても、primary recognition cue と product relationship が連続していればよい。

platform convention を無視して全 platform を一枚絵に揃えることも、各 platform で別 brand に見えるほど作り直すことも避ける。

## Avoid

- canonical logo を arbitrary な rounded square の中央へ置いて完了する
- platform が適用する mask / corner / shadow / material を artwork 側でも二重適用する
- largest source image の縮小だけで smallest state を確認しない
- Android の一つの mask だけで adaptive icon を検証する
- monochrome/themed mode を色変換だけで済ませ、silhouette / negative space の崩壊を見逃す
- dark/light state を screenshot mockup だけで確認する
- platform grid / safe-area / corner radius / asset size を別 platform の universal rule にする
- UI icon family の線幅・metaphor rule を app icon の identity rule と混同する
- app icon adaptation のために approved brand mark の canonical geometry を無断変更する
- store listing preview や marketing mockup だけを最終 QA にする

## Verify

source asset の生成成功では完了しない。target platform ごとに該当する最終 representation を確認する。

### Required checks

- **Identity**: 最小 relevant size でも primary recognition cue が残る
- **Mask/container**: target platform が取り得る materially different mask / enclosure で critical content が失われない
- **Optical weight**: neighboring app icons と並べて過大/過小・上下左右の偏りを確認する
- **Theme/mode**: supported light/dark/mono/themed/high-contrast state を実際に render する
- **Layer/system effect**: platform が追加する mask、material、shadow、tint、motion/depth がある場合、それ込みで確認する
- **Scale**: large preview と smallest relevant delivered size の双方を確認する
- **Context**: launcher / home screen / dock / taskbar / Start / installed-app surface のうち実際に提供する context で確認する
- **Label relationship**: app name label が近接する surface では、icon 内 text の冗長性や unreadable microtype を確認する
- **Final asset**: exporter/editor preview ではなく、package/build/install 後または production-equivalent renderer の出力を確認する

### Cross-platform trial

複数 platform を対象にする場合は表を残す。

| Platform/context | Retained identity cue | Platform-owned behavior | Adaptation | Failure found | Revision |
| --- | --- | --- | --- | --- | --- |
| A |  |  |  |  |  |
| B |  |  |  |  |  |

同じ source concept が materially different な container/mask/theme model でも同じ product と認識できるかを比較する。

判断が自明でない場合は、色違いだけでなく `mark-led vs object-led`、`flat vs layered`、`full-color dependency vs silhouette-led` 等の materially different proposal を比較する。

## Responsibility boundaries

- `brand-mark`: canonical symbol / wordmark / monogram / lockup の geometry、recognition、optical correction、reproduction survival
- `brand-identity`: durable identity system、expression range、brand architecture
- `app-icon-design`: installed-app container / mask / layer / rendering mode / platform adaptation と最終 launch-surface QA
- `iconography-system`: application UI 内 icon family の metaphor / grid / stroke / fill / state consistency
- `favicon-design`: browser tab / bookmark / pinned-tab 等の browser-specific compact asset
- `apple-hig` 等 platform Skill: application UI 全体の platform convention。app icon では current platform guidance の入口として併用する

境界に迷ったら、**canonical identity asset を変える問題は上流 Skill、OS/launcher が処理する container へ適応する問題はこの Skill** と切り分ける。
