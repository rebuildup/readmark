---
name: brand-mark
description: >
  Use when designing, refining, or auditing an identity-bearing symbol, wordmark,
  monogram, compact mark, or lockup across materially different sizes, backgrounds,
  and reproduction contexts. Focus on recognition, optical correction, variant roles,
  and final-representation survival rather than treating one geometric master as sufficient.
---

# Brand Mark

brand mark を「きれいなベクター形状」で完了させない。

**Role → Recognition → Form → Optical correction → Variants → Contexts → Verify** の順で、識別性を保ちながら実際の表示条件へ耐える mark system を設計する。

この Skill は brand 全体の color / typography / imagery / architecture を定義しない。それらを含む durable identity system は `brand-identity` が担当する。

## When to use

次のようなときに使う。

- symbol / pictogram / wordmark / monogram / lockup を新しく設計する
- 既存 logo を refresh し、認識 equity を残しながら形状を改善する
- full wordmark が favicon / avatar / compact UI で成立しないため compact mark が必要
- positive / reversed / monochrome / background variants の関係を整理する
- symbol と wordmark を常に lock すべきか、独立使用を許すべきか判断する
- 小サイズ、crop、低解像度、印刷、刺繍、signage などで detail が失われる
- co-brand / product lockup で optical balance が崩れる

UI icon family を作る場合は `iconography-system` を使う。app icon の platform-specific mask / safe area / rendering は `app-icon-design`、browser favicon の implementation と browser behavior は `favicon-design` が担当する。

## 1. Inspect role, context, and existing equity

形を描く前に、mark が何を担当するか確認する。

- entity / product / organization の正式名称と既存 recognition
- current symbol / wordmark / monogram / shorthand と accumulated equity
- primary contexts: product, web, print, signage, packaging, social, video, merchandise など
- compact contexts: avatar, favicon, app surface, badge, watermark など
- full name を読ませる必要がある場面と、symbol だけで識別できる場面
- neighboring marks / partner logos / parent brand と同居する頻度
- multilingual name / transliteration / legal-name requirements
- trademark / licensing / commissioned asset / approval constraints
- production limits: color count, minimum stroke/detail, crop, engraving/embroidery/print process など

既存 mark がある場合、変更理由を `old-looking` のような形容詞で済ませない。小サイズで潰れる、wordmark と symbol の比率が不安定、reversed で counter が閉じる、他 mark と誤認する、など observable な failure を記録する。

## 2. Open references and compare mark systems

`references/brand-mark.md` から task に近い複数 reference を実際に開く。

少なくとも次の差を比較する。

- full logotype と compact mark を同一形状の縮小で済ませるか、別 drawing / state を持つか
- geometry をどこまで保持し、どこで optical correction するか
- positive と reversed が同じ outline か、視覚重量に合わせて補正されるか
- symbol と wordmark が固定 lockup か、独立 usage を持つか
- recognition が silhouette / letterform / counter / proportion / color relationship のどこに依存するか
- small size / constrained surface で何を捨て、何を残すか
- crop / avatar / background / neighboring marks の条件で placement がどう変わるか
- mark の具体形状が wider graphic system へ展開される場合、何が mark 固有で何が system rule か

一つの studio、logo genre、construction grid を style recipe にしない。

## Observe

reference と current mark を次の軸で比較する。

- **role** — symbol / wordmark / monogram / lockup / compact mark のどれが何を担当するか
- **recognition cue** — silhouette、letterform、negative space、counter、proportion、color sequence など何が識別を支えるか
- **full ↔ compact relationship** — compact 版が縮小か、distillation / redrawing か
- **silhouette** — blur / distance / tiny size でも外形差が残るか
- **internal detail** — counter、gap、stroke、layer が縮小・反転・低品質出力で残るか
- **optical balance** — 数学的中心と知覚中心、同寸と同重量が一致しているか
- **polarity** — positive / reversed / monochrome で同じ知覚重量を保てるか
- **lockup behavior** — symbol / wordmark / product name / partner mark の関係が固定か可変か
- **spacing / alignment** — clear space、baseline、cap height、visual center を何に基づけるか
- **background / crop** — contrast、busy image、circle/square crop、safe area で認識が壊れないか
- **reproduction** — screen / print / low-resolution / physical process で detail がどう変わるか
- **ownership / governance** — approved master、variant、trademark、third-party use の制約があるか

## 3. Choose a mark system, not a required logo type

symbol、wordmark、monogram を必ず全部作らない。

必要な role だけ定義する。

例:

```text
Primary recognition:
- full wordmark

Compact recognition:
- distinct symbol derived from the same recognition cue

Allowed independence:
- symbol can stand alone only where brand context is already established

Required lockup:
- external / corporate introduction
```

full と compact の形状が異なっても、同じ identity と判断できる retained cue を説明できること。

compact mark を「頭文字を丸に入れる」ことへ自動変換しない。full mark のどの認識要素を constrained context で保持すべきかから決める。

## 4. Correct optically, not only geometrically

construction grid は説明・再現・整合の道具であり、知覚品質の証明ではない。

確認する。

- 同じ数値幅でも一方だけ重く見えないか
- curve と straight、diagonal と vertical、positive と reversed で知覚重量が変わらないか
- circular / asymmetric mark を container に置いたとき mechanical center がずれて見えないか
- counter / gap / join が縮小時に閉じないか
- wordmark の特定文字だけ突出して lockup の幅や重心を壊さないか

必要なら master geometry から small-size / reversed / production-specific variant を別 drawing として持つ。

ただし reference 固有の stripe thickness、clear-space ratio、grid、minimum pixel value を universal rule にしない。

## 5. Define variants by failure they solve

variant を装飾的な選択肢として増やさない。

各 variant に理由を持たせる。

```text
Variant:
Context:
Failure in primary mark:
Retained recognition cue:
Changed geometry / color / lockup:
```

典型的な variant reason:

- compact surface で full name が読めない
- reversed で counter / stroke の重量が変わる
- monochrome production で layer/color relationship が消える
- avatar crop で visual center がずれる
- co-brand / product context で full lockup が冗長
- physical process で fine detail を再現できない

理由のない horizontal / vertical / badge / outline variant を数だけ揃えない。

## 6. Separate mark design from downstream containers

avatar、favicon、app icon は mark を載せる **delivery context** になり得るが、同一 artifact ではない。

- mark: identity-bearing form と recognition relationship
- avatar: platform crop / neighboring feed context
- favicon: browser rendering / tiny raster or vector behavior
- app icon: platform mask / material / platform-specific visual rules

mark が container 内で成立するかはこの Skill で stress-test するが、container の platform rules を mark geometry の universal truth にしない。

## 7. Avoid

- golden ratio / grid があることを quality proof にする
- master vector を全サイズ・全背景へ mechanical scale する
- positive logo を単純反転しただけで reversed 完了とする
- compact mark を full wordmark の縮小で済ませ、読めない状態を許す
- small-size 問題を単に stroke を太くするだけで処理する
- symbol と wordmark を常に固定 lockup にし、context を無視する
- inverse に symbol と wordmark を無関係に分離し、recognition relationship を失う
- exact clear-space ratio / minimum pixel size を別 brand からコピーする
- mockup の大きな hero view だけで silhouette / detail を評価する
- trademarked / commissioned mark を approval なしに改変する
- logo refresh を `brand-identity` 全体の完成と扱う
- reference creator の特徴的 shape や proprietary asset をなぞる

## Verify

vector editor の拡大表示ではなく、**final representation family** を確認する。

current project に意味のある materially different conditions を選ぶ。

- primary full-size use
- compact / smallest meaningful use
- black-only または monochrome
- light background / dark background
- reversed variant（必要な場合）
- avatar / circle or square crop（実際に使う場合）
- wordmark + symbol / product / partner lockup（必要な場合）
- low-resolution raster または representative physical reproduction（該当する場合）

### Scale ladder

同じ画面を zoom するだけでなく、各 target size へ実際に rasterize / render する。

見るもの:

- recognition cue が残るか
- silhouette が他 mark と区別できるか
- counter / gap / join が閉じないか
- thin detail が消えないか
- positive / reversed で視覚重量が不自然に変わらないか
- compact variant が full mark と同一 identity に見えるか
- mechanical center ではなく optical center が container 内で成立するか

### Blur / silhouette check

細部を見ない状態でも dominant outer form と major negative space が区別できるか確認する。これは「単純な形ほど良い」という規則ではなく、どの detail が recognition に必要かを切り分けるために使う。

### Lockup check

mark を単体で見ず、実際に同居する name / product / partner mark / UI chrome と並べる。

- 一方だけ不必要に大きく見えないか
- baseline / cap height / visual center のどれを基準にしたか説明できるか
- spacing が empty value ではなく separation / ownership を伝えているか
- compact context で redundant label が増えていないか

### Final output

SVG master だけで完了しない。task に応じて browser、PNG raster、PDF/print proof、avatar crop、physical sample など利用者が見る representation を開いて確認する。

failure を見つけたら記録する。

```text
Context / size:
Failure:
Likely cause:
Revision:
Retest result:
```

## Completion boundary

Skill 本文を書いただけで promotion を完了としない。

少なくとも一つの real brand/project で、full/compact relationship と materially different なサイズ・背景・polarity・lockup条件を含む artifact family を作るか監査し、final representation で failure / revision を記録するまでは experimental として扱う。
