---
name: og-image-design
description: >
  Design URL-derived Open Graph and link-preview images as truthful, recognizable preview systems that complement host-rendered metadata across social, messaging, and collaboration surfaces.
---

# OG Image Design

URL を共有したときに crawler が取得し、social / messaging / collaboration surface が title・description・site identity と組み合わせて表示する preview image を設計するときに使う。

これは generic social banner や video thumbnail の Skill ではない。**page/object truth → preview job → metadata ownership → image proposition → generated family → actual unfurl verification** の順で判断する。

## Workflow

1. 対象 URL / page の canonical truth と share 時に伝えるべき destination expectation を確認する。
2. 実際の consumer と current metadata を Inspect する。
3. reference を開き、card 構造・crop・metadata ownership・crawler behavior を比較する。
4. image 内に持たせる情報と host-rendered metadata に委譲する情報を決める。
5. static default / page-specific / generated family / fallback を設計する。
6. realistic content variation で render し、actual unfurl を Verify する。

## Observe

- page/object truth と canonical identity
- preview が支える判断: 記事を読む、project を開く、product/detail を確認する等
- site-level identity と page-specific identity
- image / title / description / site name / host chrome の情報分担
- focal subject、silhouette、crop、negative space、小さい card での識別
- image 内 text の必要性、hierarchy、locale / length variation
- static default と generated per-page family の関係
- source image がない・壊れる・極端な内容になる場合の fallback
- consumer ごとの crop / card / surrounding UI variation
- light / dark surrounding surface と transparency / edge behavior
- crawler fetchability、cache freshness、final compression

## Decision rules

### 1. Page truth を先に固定する

preview image は destination の約束である。page に存在しない人物、機能、結果、status を attention のために追加しない。

page type ごとに preview job を定義する。site home、article、project、product/detail、documentation では同じ template を使えても、強調すべき page-specific evidence は異なり得る。

### 2. Image と metadata を一つの card として設計する

host が title / description / site name を表示するなら、同じ title を image 内へ必ず再掲しない。image 内 text は次のいずれかを担うときに使う。

- visual identity の一部
- metadata だけでは伝わらない短い分類・version・series cue
- image proposition 自体が typography-led

consumer が metadata を省略・truncate する可能性もあるため、image 単体でも destination と無関係な generic decoration にはしない。

### 3. 一枚の platform screenshot を universal canvas にしない

Open Graph は代表 image を提供するが、consumer は独自 card/chrome/crop を持つ。特定 consumer の UI を画像内へ描き込まず、focal information を crop/reduction に耐える構造へする。

固定 pixel safe zone を universal rule にしない。target consumers の actual preview で確認する。

### 4. Default と generated family を分ける

site-wide default は identity/fallback を担う。page-specific image は destination-specific evidence を担う。

大量 page を generated family にする場合、固定 template の美しさより variation robustness を優先する。最低限 stress-test する:

- short / long title
- Japanese / Latin / mixed script
- source image あり / なし
- very bright / dark source image
- unexpected aspect ratio
- missing optional metadata

content が壊れたときは unreadable auto-layout より intentional fallback を選ぶ。

### 5. Framework/API を design rule にしない

Open Graph properties、Next.js metadata files、image renderer、screenshot generator は delivery adapter である。生成 endpoint が成功したことを visual QA の代わりにしない。

### 6. Cache を delivered artifact の一部として扱う

link-preview consumer は crawler と cache を持つ。画像を更新しただけで既存 preview が即時更新されると仮定しない。consumer が inspector / refresh path を提供する場合はそれを使い、**新しく共有した URL の actual card** を確認する。

## References

実行時は `references/og-image-design.md` を開き、対象 consumer に relevant な current source を選ぶ。

## Avoid

- すべてを `1200×630 banner` という一つの composition recipe にする
- host title と同じ長文を画像内へ常に重複させる
- site-wide logo + gradient だけで page-specific preview を済ませる
- platform chrome / fake buttons / fake engagement UI を画像へ焼き込む
- one consumer の crop を全 consumer の保証として扱う
- dynamic generation で long text / missing image / mixed script を未検証にする
- transparent background がすべての consumer / background で安全だと仮定する
- metadata endpoint / HTTP success だけで完成扱いする
- stale cached preview を current artifact と誤認する

## Responsibility boundaries

- `og-image-design`: crawler-derived URL preview image、metadata complementarity、generated family、fallback、unfurl verification
- `thumbnail-design`: platform 内で content/video を選択する browse-preview と content expectation / variant hypothesis
- `social-card-design` candidate: URL crawler ではなく投稿内容そのものとして authored される social graphic
- `key-visual-design`: campaign/title-wide visual proposition と cross-artifact grammar
- `visual-hierarchy` / `typesetting` / `font-mixing` / `internationalization-design`: 各 foundation problem の canonical owner

## Verify

source generation ではなく delivered preview を確認する。

1. **Truth** — image / title / description が destination の current content と矛盾しない。
2. **Rendered image** — final raster を actual preview-scale と大きい inspection scale の両方で見る。
3. **Content stress** — long/short、mixed-language、source-image missing、極端な source image を生成 family で試す。
4. **Crop/context** — target consumer の card/chrome 上で focal information、edge、contrast、text を確認する。
5. **Consumer spread** —少なくとも materially different な複数 consumer（例: social feed + messaging/collaboration）で実際に URL を unfurl する。
6. **Theme/context** — relevant なら light/dark surrounding UI、transparent/solid background behavior を確認する。
7. **Crawler/cache** — public fetchability と current metadata を確認し、cache refresh path がある consumer では refresh 後の新規 preview を見る。
8. **Fallback** — page-specific generation が成立しない case でも broken / blank / misleading preview にならない。

real project trial では、同一 site の materially different な page type を複数選び、default と page-specific preview の責務が適切かまで記録する。