---
name: social-card-design
description: >
  Design authored social-feed graphics and multi-image card sequences whose visual content is consumed directly in the post, while coordinating image, caption, platform chrome, accessibility text, and campaign identity.
---

# Social Card Design

SNS の投稿本文として直接消費される静止画・カード列を設計するときに使う。

この Skill が扱うのは、投稿者が意図して作る **authored feed artifact** である。URL crawler が生成する OG / link preview、動画を開くための thumbnail、遠距離で遭遇する poster は扱わない。

固定サイズの「SNS テンプレート」を作るのではなく、**投稿の仕事 → image / caption の責務 → single / sequence 構造 → feed 文脈への適応 → final post verification** の順で判断する。

## Workflow

1. 投稿の canonical truth、対象 audience、公開時点、投稿が支える判断を確認する。
2. 実際に使う platform / surface の current behavior を一次資料で開く。
3. production reference を複数比較し、表現そのものではなく情報分担・系列化・変形規則を抽出する。
4. `image/card`、`caption`、`account identity / platform chrome`、`alt text` の責務を決める。
5. single card か multi-card sequence かを、情報量ではなく communication job から決める。
6. current brand / campaign language を feed-size artifact へ翻訳する。
7. realistic feed context、実サイズ、複数画像時の順序、alt text、最終書き出しで確認する。

## Observe

reference を開いたら次を見る。

- 投稿が `announce / explain / evidence / quote / schedule / reminder / update / participation` のどれを主に担うか
- canonical content truth と、画像だけを見たときに誤解されうる内容
- 画像、caption、account name/avatar、platform UI がそれぞれ何を伝えているか
- single image と multi-image で communication structure がどう変わるか
- 最初に見える card が何を約束し、続く card が何を追加するか
- 各 card が独立情報なのか、前後関係を必要とするのか
- subject / type / image / shape / negative space の feed-size での優先順位
- in-image text が caption の複製か、画像自体の意味・識別・series grammar を担っているか
- campaign / brand から何を retained し、投稿ごとに何を variable にしているか
- 同じ内容を別 platform / canvas に出すとき crop だけか、recomposition しているか
- multi-image layout / crop / order が platform 上でどう見えるか
- screenshot / reshare / individual-card exposure で失われる context があるか
- 日付、時刻、価格、出演者、出典、引用 attribution など、切り離されると危険な情報が何か
- informative image ごとの alt text / image description が成立するか
- final compression、small display、surrounding post copy の中で hierarchy が残るか

## References

詳しい比較観点と current status は [`references/social-card-design.md`](./references/social-card-design.md) を読む。

実タスクでは最低でも次を組み合わせる。

- current platform guidance: upload / crop / multi-image / accessibility behavior
- independent production references: 実 campaign で social content を運用している複数事例
- current project / campaign assets: brand rule、approved image、copy、date / source truth

一つの studio、creator、platform の表現を social-card の style として一般化しない。

## Decision rules

### 1. まず post job を一つ主語にする

「SNS用画像を作る」ではなく、この投稿が何を成立させるかを書く。

例:

- event の日時を認識させ、詳細へ進ませる
- product update の一つの変更点を理解させる
- report の一つの finding を証拠付きで伝える
- campaign の participation action を理解させる

一投稿に複数目的がある場合も、first read で支える主目的を決める。全情報を画像へ詰めることで解決しない。

### 2. Image と caption の責務を先に分ける

画像へ何を書くかは、caption を無視して決めない。

**画像側へ残す価値が高いもの:**

- feed を流し見しても識別すべき proposition
- image / diagram / typography 自体が意味を担う内容
- card が単独で share / screenshot されたとき失うと重大な context
- series / campaign を識別する visual cue

**caption 側へ任せやすいもの:**

- 長い説明、補足、link、conversation context
- platform UI が既に確実に示す account identity
- 画像に入れると hierarchy を壊す詳細

同じ headline / paragraph を caption と画像へ機械的に二重掲載しない。ただし単独共有時の意味保持や accessibility / distribution context に合理的理由があれば重複を許す。

### 3. Single と sequence を情報量だけで決めない

一枚で理解すべき message なら single card を優先する。

multi-card にする場合は、各 card に役割を持たせる。固定の `hook → problem → solution → CTA` 枚数テンプレートは使わない。

役割の例:

- proposition / announcement
- evidence / example
- comparison / breakdown
- schedule / lineup / detail
- next step / source

card を増やすたびに、その card が新しい理解を作るか確認する。単に文章をページ送りにしただけなら sequence 化を再検討する。

### 4. First card は「派手な表紙」ではなく sequence の契約にする

最初に見える card は、続きを見る理由と何についての列かを分かるようにする。

ただし、後続 card の内容を誇張した clickbait promise にしない。series の visual grammar を示しても、全情報を最初に詰め込まない。

### 5. 各 card の context dependency を意識する

platform により複数画像は gallery、grid、horizontal scroll など異なる形で現れる。個別画像だけが repost / screenshot されることもある。

重大な誤読が起きる card には、必要な範囲で title、source、date、unit、category、series marker などを保持する。

一方で全 card に campaign title、logo、URL、長い disclaimer を反復して noise を増やさない。

### 6. Brand consistency は template cloning にしない

系列認識を作るものを分ける。

- **Retained:** 何が残れば同じ campaign / account family と分かるか
- **Variable:** subject、message、crop、composition、color emphasis 等の何を変えられるか
- **Reason:** platform、content、phase、locale、subject に応じてなぜ変えるか

同じ layout に文字だけ差し替えることも、毎回完全に別 design にすることも自動正解にしない。

### 7. Platform rule は adapter constraint として扱う

image count、aspect ratio、crop behavior、composer preview、alt-text capability は変化する。

現在の target platform の公式 guidance を確認して適応するが、その数値を universal design rule として Skill に固定しない。

crop が変わる surface では、重要情報を単に中央へ寄せるのではなく、representative render で subject / text / continuation cue の生存を確認する。

### 8. Accessibility は export 後の付帯作業にしない

informative image には platform が提供する alt text / image description を使う。multi-image post では各画像を別々に説明できるか確認する。

画像内に長文 text がある場合、alt text は「文字がある」とだけ書かず、その投稿で必要な情報を理解できる形にする。装飾情報を過剰に読み上げさせない。

色、位置、画像内文字だけに意味を依存させる場合は、caption や alt text を含む post system 全体で代替 cue を持つ。

### 9. Time-sensitive content は freshness を設計する

`today`、`tomorrow`、`out now`、deadline、価格、lineup、version 等は、投稿後に stale になる。

- absolute date / context が必要か
- reshare 後にも意味が通るか
- evergreen asset と campaign-phase asset を分けるべきか

を判断する。

### 10. Engagement metric を design truth にしない

likes / clicks / impressions は distribution と audience に左右される。比較 evidence として使えても、誤解を生む強調や brand / content truth の破壊を正当化しない。

## Responsibility boundaries

- `social-card-design`: authored feed graphic、image-caption ownership、single / multi-card 構造、feed adaptation、post-level verification
- `og-image-design`: URL crawler が作る link preview と metadata / cache / unfurl behavior
- `thumbnail-design`: content を開く・見るか判断する browse-preview
- `key-visual-design`: campaign / title 全体の visual proposition と cross-artifact grammar
- `poster-design`: display environment での encounter / distance hierarchy
- `content-design`: wording、content sequence、plain-language responsibility
- `typesetting` / `font-mixing` / `internationalization-design`: text composition と mixed-language behavior
- `visual-hierarchy`: cross-channel priority orchestration

下位 Skill の責務をここで再発明しない。social context に固有の transformation / ownership / verification だけを持つ。

## Avoid

- `1:1`, `4:5` 等、一つの canvas を social graphic の普遍形とする
- platform dimension list を design policy にする
- poster / slide / OG image をそのまま縮小して social card と呼ぶ
- caption 全文を小さな文字で画像へ再掲する
- fixed card count や固定 carousel story formula を全投稿へ適用する
- first card だけを過剰に煽り、後続内容と promise が一致しない
- series consistency のため全 card / post を同じ構図にする
- crop preview を確認せず edge に重要 text / subject を置く
- informative text/image に accessibility description を付けない
- date / unit / source を失うと誤読する data card を文脈なしで切り離せる状態にする
- engagement 数値だけを根拠に誇張・誤認表現を採用する
- creator / studio 固有の palette、type、illustration、brand asset を style recipe として模倣する

## Verify

source file の完成ではなく **投稿として見える最終 representation** を確認する。

1. **Truth check** — name、quote、date、time、price、number、source、product/event state を canonical source と照合する。
2. **Feed-size check** — authoring canvas ではなく、representative mobile / desktop feed size で first read と supporting detail を見る。
3. **Post-system check** — image 単体だけでなく account identity、caption、platform chrome と一緒に見て、重複・欠落・競合を確認する。
4. **Sequence check** — multi-card なら順番どおり通読し、各 card の役割、continuation、最後までの理解を確認する。
5. **Partial-context check** — 後続 card 単体、screenshot / reshare 相当で重大な誤読がないかを見る。
6. **Platform-layout check** — target surface の実際の multi-image layout / crop / preview で確認する。複数 platform へ出すなら各 surface を別に見る。
7. **Content stress** — long / short copy、日本語・Latin・mixed-language、long proper noun、missing image、unexpected aspect のうち現実に起きる条件を試す。
8. **Accessibility check** — informative image ごとに alt text / image description を用意し、画像を見なくても投稿の必要情報が取得できるか確認する。
9. **Freshness check** — time-sensitive wording が publish / reshare 時点で誤解を生まないか確認する。
10. **Final output check** — platform に投入する実 raster / compression 後の細線、文字、crop、banding、artifact を見る。

判断が自明でなければ、minor color 差ではなく **single vs sequence、image-led vs type-led、caption-heavy vs image-self-contained、fixed family vs variable family** のような materially different proposal を比較する。

実 project trial が済むまでは、この Skill を promotion 完了として扱わない。
