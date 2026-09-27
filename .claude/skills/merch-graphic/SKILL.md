---
name: merch-graphic
description: >
  Design graphics for physical merchandise by adapting identity and artwork to product form, substrate, decoration process, placement, scale, collection relationships, and final reproduction instead of pasting flat artwork onto generic mockups.
---

# Merch Graphic

物販・ツアーグッズ・ブランド商品・記念品など、**物体に載って使われる graphic** を設計するときに使う。

`merch-graphic` は T シャツ用の固定レイアウト集ではない。商品形状、素材、加工、装着・使用時の見え方、collection 内での役割を観察し、graphic をその物体へ翻訳する。

## Workflow

1. 商品の役割と権利関係を確認する。
2. 実際の商品、素材、加工方法、装飾可能領域を確認する。
3. relevant references を開き、下記の軸で複数例を比較する。
4. `Retained identity / Product-specific change / Production reason` を決める。
5. artwork を実寸・配置・加工へ適応する。
6. mockup だけでなく、最終サイズの出力と可能なら sample / proof を確認する。

## Observe

- merchandise job: identity/signaling / collectible / souvenir / campaign extension / artwork carrier / functional object
- product silhouette / substrate / seams / folds / closures / usable decoration zones
- viewing state: worn / held / carried / placed / folded / shelved
- placement ownership: front / back / sleeve / pocket / side / edge / object-specific surface
- graphic scale relative to body/object, not only artboard
- one-sided vs multi-surface relationship
- substrate color / texture / absorbency / stretch / pile and their interaction with artwork
- process: screen print / DTG or DTF / embroidery / transfer / other selected production method
- process-dependent survival of line, counter, gap, halftone, gradient, transparency, texture, and small type
- ink/thread/material color vs substrate contribution
- single hero item vs collection; retained identity vs product-specific variation
- brand / campaign / artist / event / artwork source and approved usage
- production quantity / cost constraints only when they materially change the viable process or graphic
- final reproduction, registration, edge, texture, distortion, wash/use behavior where relevant

## References

調査時は [`references/merch-graphic.md`](./references/merch-graphic.md) を開く。

reference 固有の placement、色数、寸法、process spec を universal rule にしない。current vendor guidance は、選択した production process が graphic に何を要求するかを理解する evidence として使う。

## Decision rules

### 1. Flat canvas ではなく object から始める

最初に product/substrate を固定する。

同じ graphic source でも T-shirt、cap、embroidered jacket、keychain、cards では、見える面、曲率、継ぎ目、素材、使用距離、加工が異なる。master artwork を同倍率で載せ替えない。

### 2. Graphic の役割を決める

商品ごとに、少なくとも次を決める。

- 何を認識させるか
- 所有・着用したとき何を表明するか
- collection のどの役割を担うか
- 単体でも意味が成立する必要があるか

logo を置けば merchandise になるとは考えない。一方、identity signaling が目的なら過剰な再解釈で recognition を壊さない。

### 3. Placement を composition として扱う

placement は export 設定ではない。

人体や物体上での視認方向、fold、seam、pocket、zip、handle、曲面、前後関係を見て、graphic の重心・crop・方向・scale を決める。

複数面を使う場合、各面を同じ poster の複製にせず、front/back/sleeve 等へ情報・motif・surprise・identity を分担できる。

### 4. Process を早期に選ぶ

加工方法は最後の変換ではない。

screen print、digital textile print、embroidery 等では、再現できる detail、色、edge、gradient、texture、hand/厚みが異なる。選択した process で重要な recognition cue が失われるなら、detail を再設計するか process を変える。

vendor 固有の minimum size / DPI / color count は、その vendor/product の production constraint として扱い、Skill の magic number にしない。

### 5. Substrate を一色の background とみなさない

素材色・織り・毛足・伸縮・吸収・透け・縫製は最終 graphic の一部になる。

同じ ink/thread 色でも substrate により appearance が変わる。dark/light colorway を mechanical inversion せず、必要なら版・underbase・線幅・色・detail を適応する。

### 6. Collection は clone ではなく family にする

collection では各 product について記録する。

- `Retained`: collection/brand と認識させるもの
- `Changed`: product/process に合わせて変えるもの
- `Reason`: 使用・素材・加工・商品役割の理由

全商品に同じ front-center graphic を縮尺変更して載せることを consistency としない。

### 7. Artwork / brand truth を守る

既存 artwork、写真、artist name、logo、character、archive image、sponsor mark を使う場合、approved source と利用範囲を確認する。

reference の artwork や brand asset を模倣・流用しない。museum/artwork merch のような reproduction は、権利と attribution が成立している production evidence としてのみ観察する。

## Responsibility boundaries

- `merch-graphic`: physical merchandise 上の graphic adaptation、placement、substrate/process relationship、collection variation、final reproduction
- `brand-identity`: durable identity system と governance
- `brand-mark`: canonical mark geometry と optical variants
- `key-visual-design`: campaign/title-wide visual proposition と cross-artifact grammar
- `poster-design`: standalone display encounter と distance hierarchy
- `album-cover-design`: primary music-release artwork
- `typesetting` / `font-mixing`: detailed typography execution

garment pattern cutting、fashion silhouette、industrial product design、packaging structureはこの Skill の source of truth にしない。

## Avoid

- poster / key visual を商品 mockup にそのまま貼って完成扱いする
- blank product mockup の見栄えだけで placement / scale を決める
- screen print / embroidery / DTG 等を同じ再現能力として扱う
- vendor 固有の DPI、色数、線幅、print area を universal design law にする
- garment color を単なる background swatch として扱う
- すべての商品へ同じ graphic を同じ関係で配置する
- embroidery へ細密 raster artwork を無検証で移す
- process の制約を理由に、重要な recognition cue を無言で失う
- 権利未確認の artwork / photo / logo / character を商品化する
- digital mockup を physical proof と呼ぶ

## Verify

### Final-size artwork

- actual intended print/stitch size で detail、counter、line、type、negative space を確認する
- product silhouette と decoration zone に重ね、seam/fold/edge/closure との干渉を確認する
- front/back/side 等の複数面がある場合は物体として連続して読む

### Product context

- worn / held / carried / placed など代表的な使用状態で scale と orientation を確認する
- small/large product size や materially different colorway がある場合、同じ artwork scale が妥当か再確認する
- collection では商品を並べ、identity continuity と過剰な clone 感の両方を見る

### Production representation

選択 process に応じて final representation を確認する。

- screen print: separation / registration / halftone・small detail / substrate interaction
- digital print: source resolution / transparency / color conversion / fabric interaction
- embroidery: digitized/stitch result、small detail、gap、thread direction/texture、distortion
- その他: 実際の加工原理に応じた failure point

可能なら production sample / strike-off / embroidered sample / first article を確認する。sample が作れない段階ではその制約を明記し、mockup-only verification を production approval としない。

### Delivery gate

- approved source assets / rights / credits を再確認する
- final vendor/product template と実寸配置を確認する
- exported production file だけでなく、最終 preview/proof と実物 sample がある場合は実物を確認する
- failure / adjustment を記録し、次回の product/process adaptation に反映する
