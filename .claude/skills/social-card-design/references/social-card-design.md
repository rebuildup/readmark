# Social Card Design References

Last reviewed: 2026-09-15

この reference は、SNS 上で投稿内容そのものとして配信される authored image / card / multi-image sequence を観察するために使う。

platform の仕様値や creator 固有表現をコピーせず、**post system / sequence / feed adaptation / accessibility / family variation** を比較する。

## Current platform behavior

### X — How to Post pictures or GIFs

- URL: https://help.x.com/en/using-x/posting-gifs-and-pictures
- Status: current platform guidance; reviewed 2026-09-15
- Observe:
  - single image と multi-image post の違い
  - multiple image の ordering
  - composer preview と actual display の関係
  - supported aspect range / display behavior が current platform constraint であること
- Useful for:
  - naked image ではなく post surface で card を検証する
  - multi-image の順序を communication structure として扱う
- Avoid copying:
  - current image count / aspect values を universal social-design rule に固定しない

### X — How to add image descriptions

- URL: https://help.x.com/en/using-x/add-image-descriptions
- Status: current accessibility guidance; reviewed 2026-09-15
- Observe:
  - image description が image 単位で付与されること
  - multiple image でも各 image に description を持たせる model
  - image が何を伝えるかを visual delivery と accessibility delivery の両方で考える必要
- Useful for:
  - text-heavy graphic / data card / sequence の accessibility ownership
- Avoid copying:
  - alt text の character limit を design composition の target にしない
  - visual copy を無条件に全文読み上げへ変換しない

### LinkedIn — Share photos on LinkedIn

- URL: https://www.linkedin.com/help/lms/answer/a527229
- Status: current help; reviewed 2026-09-15
- Observe:
  - single / multiple photos が post copy と同じ authored post system に入ること
  - multiple image の reorder と preview
  - crop/edit と alt text が publish flow の一部であること
- Useful for:
  - image と caption の責務分担
  - sequence/order を authoring decision に含める
- Avoid copying:
  - current image limit や UI 操作を Skill の design law にしない

### LinkedIn — Add alternative text to images for accessibility

- URL: https://www.linkedin.com/help/recruiter/answer/a519856
- Status: current accessibility guidance; reviewed 2026-09-15
- Observe:
  - feed image に explicit alt text が提供されること
  - visual post の理解が image pixels だけに依存しないこと
- Useful for:
  - informative social graphic の accessibility verification
- Avoid copying:
  - auto-generated alt text が存在しうることを、人間が context を設計しなくてよい理由にしない

### LinkedIn — Page posts FAQ

- URL: https://www.linkedin.com/help/linkedin/answer/a565070
- Status: current help; reviewed 2026-09-15
- Observe:
  - multiple image の layout が画像数と orientation に依存すること
  - post は upload file そのものとは異なる composite presentation になること
- Useful for:
  - platform chrome / grid / crop context を含む verification
- Avoid copying:
  -一つの platform layout を他 surface へ一般化しない

## Production systems

### Studio Dumbar — D&AD Festival 2020, Imagine Everything

- URL: https://studiodumbar.com/work/imagine-everything-d-ad
- Type: first-party production case study
- Observe:
  - physical festival から digital-only へ変化した際の identity adaptation
  - personalized social media post と landing page へ同じ idea を異なる artifact として翻訳する方法
  - recurring `imagine` language と variable typography の retained / variable relationship
- Useful for:
  - campaign grammar を card family へ落とす
  - social adaptation を poster crop ではなく artifact-specific transformation として考える
- Avoid copying:
  - Marfa の変形 typography や campaign phrase を generic social style として模倣しない

### Studio Dumbar — MTV VMAs 2022

- URL: https://studiodumbar.com/work/mtv-vmas-2022
- Type: first-party production case study
- Observe:
  - artists / categories / awards / platforms が多数ある campaign で consistency と variation を両立する方法
  - social visuals が broadcast / print / billboard 等と同じ identity を共有しつつ platform-specific output になる点
  - motion-first language と static/digital social asset の関係
- Useful for:
  - large content family の post variation
  - campaign-wide invariants と post-specific subject の分離
- Avoid copying:
  - MTV 固有の loudness、palette、graphic asset を universal engagement tactic にしない

### Studio Moross — Future1000

- URL: https://www.studiomoross.com/work/future1000
- Type: first-party production case study
- Observe:
  - sticker / logo / color / graphic parts を reusable toolkit として client に渡す model
  - large variation を許しながら campaign recognition を維持する仕組み
  - social content が poster / merchandise 等と同じ visual vocabulary を異なる組み合わせで使う点
- Useful for:
  - repeated social content を rigid template ではなく bounded toolkit で運用する
- Avoid copying:
  - sticker aesthetic、具体的な palette、school-notebook expression を scene rule にしない

### Studio Moross — Glitterbox Ibiza 2025

- URL: https://www.studiomoross.com/work/glitterbox-ibiza
- Type: first-party production case study
- Observe:
  - 少数の retained brand rules で billboard / club visual / social content まで展開する方法
  - recognizability のため何を固定し、surface に応じて何を変えるか
- Useful for:
  - social series の retained / variable / reason を考える
- Avoid copying:
  - shocking pink、X motif、club-specific attitude を generic social-card recipe にしない

### Pentagram — Remember Who Made Them

- URL: https://www.pentagram.com/work/remember-who-made-them
- Type: first-party production case study
- Observe:
  - Instagram を主要な community surface と見なし、asset を audience が再利用・共有できるよう設計する考え方
  - campaign の language / assets が participation と redistribution を支える関係
  - social-native distribution が brand identity の application requirement になっている点
- Useful for:
  - share / reuse / participation を想定した social asset
  - card 単体 exposure でも campaign context が残る設計
- Avoid copying:
  - proprietary campaign slogans、illustration、visual identity を再利用しない

### Pentagram — Cha Cha Festival

- URL: https://www.pentagram.com/work/cha-cha-festival
- Type: first-party production case study
- Observe:
  - one festival identity を multiple tea-house sub-identities と social campaign へ展開する方法
  - content category ごとの差分と umbrella identity の共存
  - vintage illustration / frame / typography の役割分担
- Useful for:
  - category-rich event social series
  - parent campaign と post-specific content の hierarchy
- Avoid copying:
  - Asian vernacular signs の表層特徴を文化横断の decorative style として一般化しない

## Cross-reference comparison

比較するときは、reference を「良い見た目」の一覧にしない。

| Axis | Compare |
| --- | --- |
| Post job | announcement / participation / identity / evidence 等、何を直接成立させるか |
| Information ownership | image / caption / account / platform UI / alt text のどこが何を伝えるか |
| Unit model | single card / multi-image set / campaign family |
| Sequence | order が意味を作るか、各 image が独立か |
| Recognition | campaign を識別する retained cue と post-specific variable |
| Recomposition | 他媒体の crop か、social 用に構成を変えているか |
| Portability | screenshot / share / individual card で必要 context が残るか |
| Accessibility | informative image ごとの description が成立するか |
| Freshness | date / announcement state / phase 変化で stale にならないか |
| Verification | authoring canvas ではなく actual feed presentation を見ているか |

## Failure patterns to watch

- platform spec sheet だけを reference にし、communication structure を設計しない
- poster / slide / OG image を縮小して投稿するだけ
- caption と画像へ同じ長文を二重掲載する
- multi-card を文章のページ分割としてだけ使う
- first card の promise と後続内容が一致しない
- series identity を exact template repetition と取り違える
- cropped grid / gallery / feed preview で title や subject が欠ける
- card 単体で出回ると source / date / unit が消え、意味が変わる
- alt text を未設定または「graphic with text」のような無情報な説明で済ませる
- time-sensitive phrase を evergreen template に固定する
- engagement metric を truth / clarity より優先する
