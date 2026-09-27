# Thumbnail Design References

Last reviewed: 2026-09-14

この reference は `thumbnail-design` の runtime inspection 用。

目的は creator/style の模倣ではなく、**small browse preview が何を約束し、どの surface でどう選択を支えるか**を複数 source から比較すること。

platform specification の数値は current adapter evidence であり、universal design rule ではない。

## 1. YouTube — current thumbnail surfaces and constraints

### Add customised thumbnails on YouTube

https://support.google.com/youtube/answer/72431

Observe:

- thumbnail が player / preview で使われること
- long-form / Shorts / podcast で推奨 canvas が異なること
- vertical video の custom thumbnail が一部 mobile browse surface では auto-generated 4:5 thumbnail に置き換わる現在の挙動
- file format / upload size / dimensions は platform adapter であること

Translate:

- source artwork を1 canvasに固定しない
- surface が実際に custom artwork を使うか確認する
- final browse surface で crop / replacement behavior を確認する

Do not copy as universal rule:

- current pixel dimensions
- one aspect ratio
- current upload limits

### Test & Compare thumbnails

https://support.google.com/youtube/answer/13861714

Observe:

- 最大3 thumbnail を比較できる current workflow
- result が単純な CTR ではなく watch-time share を使うこと
- winner が常に出るわけではないこと
- platform 自身が materially different variants の比較を促していること

Translate:

- thumbnail quality を click acquisition だけで評価しない
- variant は layout / background / text / subject placement 等の meaningful hypothesis を変える
- statistical result が不明確なら「細かな差を証明できた」と解釈しない

### Thumbnails policy

https://support.google.com/youtube/answer/9229980

Observe:

- misleading thumbnail が明示的に禁止対象になること
- thumbnail が content とは別の independent promise surface として policy evaluation されること
- shock / sexualization / graphic violence 等の attention tactic に platform constraint があること

Translate:

- content truth を design constraint とする
- engagement を上げるために content にない event / person / result を暗示しない
- platform policy と audience context を公開前に再確認する

### YouTube Blog — Making thumbnails easier on YouTube

https://blog.youtube/news-and-events/youtube-studio-custom-thumbnail-updates/

Published: 2026-07-24

Observe:

- Shorts に custom thumbnail control が拡張されている current state
- suggested frame と custom artwork が並存すること
- YouTube 自身が thumbnail を discovery と expectation setting の surface と説明していること

Translate:

- selected frame / generated suggestion / purpose-built art を同じ source model とみなさない
- current platform capability は変化するため runtime で再確認する

### YouTube Blog — YouTube Studio updates / title A/B testing

https://blog.youtube/news-and-events/youtube-studio-made-on-youtube-2025/

Observe:

- title と thumbnail が discovery 上で組み合わされること
- title / thumbnail combination も test 対象になること
- thumbnail 単体の optimization ではなく surrounding metadata との組み合わせを検討できること

Translate:

- image と title の情報を無条件に重複させない
- image-led / title-led / complementary relationship を比較する

## 2. Netflix — artwork variants and derivative canvases

### Netflix Non-Branded Product Artwork Agencies — Japan

https://npaa.pc.netflix.net/en/regions/japan/

Current page checked: 2026-09-14

Observe:

- one title artwork package から複数 UBA variants が作られる production workflow
- Boxshot / SDP / Billboard / Story Art / Short Panel / Vertical Billboard / Title Card Background 等、複数 derivative が明示的に別 deliverable になっていること
- logos も horizontal / stacked、light / dark として別 asset role を持つこと
- source still / partner key art から derivative を作る production reality

Translate:

- one master crop が全 browse surface を支配する前提を持たない
- same content truth を保持しながら canvas / subject scale / logo relationship を再構成する
- variant production と derivative production を区別する: variant は proposition/hypothesis の差、derivative は surface adaptation の差

Do not copy:

- Netflix proprietary templates / brand treatment
- package count / delivery count as a universal requirement
- exact canvas specifications unless delivering to that Netflix workflow

### Supporting independent analysis — Oliver Eklund, Convergence (2022)

https://journals.sagepub.com/doi/10.1177/13548565211064520

Use as supporting analysis, not as a current platform specification.

Observe:

- streaming thumbnail/artwork が paratext として異なる content appeal を前景化できること
- one title が one immutable preview image に限定されない personalization context
- different artwork can frame the same title through materially different themes/characters

Translate:

- personalization / variants を「別 content を捏造してよい」と解釈しない
- same title 内に実在する複数の truthful proposition がある場合に、audience/contextに応じて何を前景化するか検討する

## 3. Vimeo — thumbnail source, browse context, overlays

### Change the thumbnail image for a video

https://help.vimeo.com/hc/en-us/articles/12426471350289-How-to-change-the-thumbnail-image-for-my-video

Observe:

- auto-selected frame / manual frame selection / custom upload が別経路として存在すること
- custom image は upload 後 compression されること
- video dimensions と artwork dimensions の関係が delivery quality に影響すること

Translate:

- frame grab で十分か purpose-built art が必要かを先に判断する
- final compressed thumbnail を QA する
- authoring canvas だけで sharpness / text readability を判定しない

### Vimeo OTT — thumbnail options

https://help.vimeo.com/hc/en-us/articles/46427320531217

Observe:

- catalog browse で thumbnail が primary visual decision surface になること
- standard thumbnail に加えて alternative image types が存在すること
- content appearance setting がどの image type を表示するかに影響すること

Translate:

- actual browse component と image role をセットで確認する
- surface configuration が変われば final artifact も再検証する

### Vimeo OTT — thumbnail badges

https://help.vimeo.com/hc/en-us/articles/46430473443601

Observe:

- New / New Episode / Ending Soon / Top 10 / Exclusive / Original 等の badge が thumbnail 上に追加され得ること
- badge が Web / mobile / TV browse surfaces で thumbnail composition に重なること

Translate:

- corner / edge を無条件に重要情報の置き場にしない
- platform-owned status と thumbnail-owned message を重複させない
- screenshot/mockだけでなく final badge/chrome 付き card を見る

## Cross-reference comparison

複数 source を比較すると、繰り返し現れるのは次の関係。

### Thumbnail is a preview decision surface

YouTube / Vimeo / Netflix で実装形式は異なるが、thumbnail/artwork は browse 中に content を選択するための visual evidence である。

したがって観察対象は単なる aesthetic quality ではなく:

- what content is this?
- why might I open it?
- what should I expect after opening?
- can I still identify it at delivered size?

となる。

### Accuracy and attraction must coexist

YouTube policy は misleading thumbnail を禁止し、YouTube Test & Compare は watch-time-based evaluation を持つ。

この2点から、clickability を content satisfaction と切断しない。

### One content item can legitimately have multiple truthful views

Netflix の artwork variant / derivative production と YouTube の multi-thumbnail testing は、one-content-one-image を唯一のモデルにしていない。

ただし2種類を区別する:

- **Variant** — proposition / subject / composition hypothesis を変える
- **Derivative** — same proposition を別 surface/canvasへ適応する

### Small-size and context are first-class constraints

platform は thumbnail を card / player / TV / mobile / browse row 等の context 内に置く。

naked high-resolution artwork だけで完成判定しない。

## Observation axes checklist

reference comparison 時に必要なものだけ選ぶ。

- source content / approved assets
- actual content promise
- browse surface / card context
- title / metadata / channel / episode context
- target viewing size / distance
- focal subject / subject scale
- crop / negative space / edge ownership
- expression / action / object state
- image vs text vs logo ownership
- platform chrome / duration / progress / badge
- landscape / portrait / square / alternate derivative
- selected frame / custom artwork / key-art derivative
- family identity / per-item differentiation
- variant hypothesis
- personalization / audience prior knowledge where relevant
- compression / final delivery appearance
- policy / rights / misleading implication
- downstream engagement evidence where available

## Failure modes

### Poster shrink

Large key art looks polished at full size but becomes unreadable/ambiguous as a browse tile.

Check:

- subject scale
- number of competing elements
- text/logo size
- crop at actual surface

### Metadata duplication

thumbnail repeats the exact video title while title is always visible directly below it.

Check whether the embedded text adds a distinct visual proposition or only consumes space.

### False promise

composite / crop / text implies an outcome, character interaction, product state, or event that content does not contain.

Reject even when it improves clicks.

### Universal face rule

faces may be strong when expression/character is the content evidence, but object-, UI-, place-, result-, or process-led content may require another focal subject.

### Over-template family

series identity is strong but every episode looks equivalent.

Retain recurring grammar while changing the content-bearing subject/evidence.

### Micro-variant testing

multiple options differ only in tiny color/effect details and yield no useful learning.

Change one meaningful hypothesis at a time or compare clearly distinct propositions.

### Crop blindness

master art succeeds at 16:9 but fails when mobile/platform re-crops or switches image type.

Render every required delivery surface.

### Naked-image QA

thumbnail itself looks clean, but duration/badge/progress/title/chrome covers important content.

Verify the real card.

## Runtime freshness

Before using platform-specific behavior, reopen the source.

Especially re-check:

- supported custom-thumbnail surfaces
- automatic crop/replacement behavior
- A/B test eligibility and metric
- badge/chrome behavior
- current image types / derivatives
- upload specs only when producing a delivery file

Do not preserve a 2026 platform behavior as permanent design law.
