---
name: event-flyer
description: >
  Design distributed and close-reading event flyers that balance event identity, actionable logistics,
  handling context, and a clear next step without reducing the artifact to a small poster.
---

# Event Flyer

イベント告知を、遠距離で一瞬だけ見る poster ではなく、**配布され、手に取られ、近距離で読み、必要なら持ち帰られる情報 artifact** として設計するときに使う。

`poster-design` の縮小版を作らない。flyer の主問題は、event への関心を作りながら、日時・場所・出演/内容・条件・次の行動を、実際の配布・保持・再参照の文脈で成立させることにある。

## Workflow

1. event truth と distribution context を確認する。
2. runtime reference を実際に開き、複数例を比較する。
3. `Attraction / Logistics / Next step` の3責務を分離する。
4. single face / front-back / fold / panel の情報配分を決める。
5. current event/campaign language へ翻訳し、必要な event-specific variation を作る。
6. actual-size の final artifact を handling context と final output で検証する。

## Inspect first

最初に確定する:

- 何の event か。名称、主催、内容、出演/登壇/展示等の truth は何か
- 誰へ、どこで、いつ配布されるか
- 手渡し / counter stack / venue pickup / street-community distribution / invitation-mail / digital derivative のどれか
- 受け手は数秒で捨てる可能性が高いか、持ち帰って再参照するか
- 必須 logistics: date / time / venue / address / price / eligibility / access / lineup / organizer 等
- next step: walk-in / ticket / registration / map / contact / URL / QR 等
- event series / campaign / parent brand の既存 visual language があるか
- front/back、fold、panel、stock/process、digital derivative の制約

情報が未確定なら、架空の日時・価格・出演者・会場・アクセス条件を補完しない。

## Observe

reference を次の軸で比較する。

- distribution / pickup context
- event proposition と first recognition
- attraction / logistics / next-step の hierarchy
- event name / date / venue の見つけやすさ
- participant / programme / lineup の grouping と scan order
- close-reading density と text hierarchy
- front / back / fold / panel の役割分担
- image / type / symbol / texture / material の ownership
- event-series invariant と edition-specific variable
- campaign/key visual から flyer への recomposition
- map / QR / URL / contact の handoff role
- physical size / handling / pocket or bag retention
- print process / paper / fold が意味を持つか、単なる装飾か
- digital/raster derivative で失われる material cue
- final output での small text、edge、fold、compression、contrast

## References

詳細な観察先は [`references/event-flyer.md`](./references/event-flyer.md) を読む。

単一 scene の visual grammar を一般化しない。museum ephemera、historical flyer、current event identity / programme collateral を比較してから判断する。

## Translate

### 1. Attraction / Logistics / Next step を分離する

flyer の情報をまず3つに分類する。

- **Attraction** — 何の event で、なぜ見る価値があるかを認識させる
- **Logistics** — いつ、どこで、誰が、どの条件で参加できるかを判断させる
- **Next step** — その場で何をするか、後でどこへ戻るかを示す

3つを同じ強さで並べない。event と distribution context に応じて優先順位を決める。

### 2. Poster の距離 hierarchy をそのまま縮小しない

flyer は pickup 後の close read が重要である。poster の first/second read を参考にしてよいが、flyer では logistics の再参照性と携帯性を独立して設計する。

大きな hero と極小 logistics だけに二極化しない。手に持った状態で date / venue / next step を探せる grouping を作る。

### 3. 面を情報量から決める

single face を default にしない。

- 情報が少なく即時 action が中心なら single face で成立し得る
- event proposition と詳細 logistics の競合が強いなら front/back を分担する
- programme、map、複数日程、説明が増えるなら fold/panel を検討する
- brochure/programme 級の長文になるなら flyer の責務を超えていないか再確認する

裏面や内面へ必須情報を隠す場合は、反対面を読む cue が必要かを実物で確認する。

### 4. Handoff mechanism を目的とセットにする

QR / URL / map / contact は「置けば便利」ではない。

- destination が ticket / registration / details / map のどれか分かる label を持たせる
- QR だけに event identity や必須 logistics を委譲しない
- offline / camera unavailable / printed copy degradation を考慮し、必要なら readable URL や contact を併記する
- destination が current event state と一致しているか final QA で開く

固定 QR size を universal rule にしない。実際の印刷・表示条件で scan test する。

### 5. Series は fixed と variable を分ける

複数 event / edition がある場合、各 flyer について次を記録する。

- Retained: series/campaign recognition のため残すもの
- Variable: event-specific content に応じて変えるもの
- Reason: なぜその差分が必要か

日付や出演者だけ差し替えた template cloning も、毎回完全に別 identity にすることも自動選択しない。

### 6. Production process を概念と混同しない

photocopy、risograph、offset、foil、特殊紙、gate fold 等は、その event / distribution / budget / material language に意味がある場合だけ design input とする。

historical punk/rave/museum flyer の粗さや印刷制約を、scene の意味を無視した texture filter にしない。

## Responsibility boundaries

- `event-flyer` — distributed / hand-held event promotion、close-read logistics、handling、next-step handoff、flyer-specific final QA
- `poster-design` — standalone display encounter、distance/passing first read、display-scale composition
- `key-visual-design` — campaign/title-wide visual proposition と cross-artifact transformation grammar
- `content-design` — wording、information priority、label/instruction clarity
- `typesetting` / `font-mixing` — detailed text composition と mixed-script execution
- `visual-hierarchy` — generic priority-to-salience orchestration
- programme/brochure/document が長文化する場合は `document-design` / editorial 系 Skill の責務を検討する

## Avoid

- poster を縮小して logistics を最下部へ押し込む
- date / venue / ticket condition を decorative text と同じ扱いにする
- QR code だけを next step とし、destination の意味を示さない
- visual identity を優先して event truth や参加条件を読めなくする
- front が映えるという理由だけで必須情報を裏面へ無秩序に逃がす
- fold/process/texture を event concept と無関係な premium/underground 記号として足す
- historical scene の photocopy、handwriting、distress 等を style preset 化する
- digital mockup だけで physical flyer の可読性・handling を完了判定する

## Verify

最終 source ではなく、**配布される representation** を確認する。

1. final copy / date / time / venue / address / participants / price / eligibility / organizer を source of truth と照合する。
2. actual-size print または calibrated 1:1 proxy で front/back/folded states を読む。
3. pickup stack / hand-held / table-counter / venue handoff 等、代表的 distribution context で first recognition を確認する。
4. 数秒後に event name と dominant proposition が分かるか確認する。
5. close read で date/time、venue、participation condition、next step を迷わず見つけられるか確認する。
6. front/back/fold がある場合、読む順序と面間 cue を実物で確認する。
7. QR / URL / map / contact がある場合、final output から実際に destination を開き、目的・freshness・scanability を確認する。
8. series がある場合、最低3点程度を並べ、recognition と event-specific differentiation の両方を見る。
9. print と digital derivative が必要なら、両方を final size で確認し、material cue 消失後も hierarchy が成立するかを見る。
10. final PDF/raster/print で clipping、fold/trim edge、small text、image resolution、contrast、compression を確認する。

実 project trial では、少なくとも `brief/truth → information classification → materially different allocation if needed → final-size output → handling/context test → next-step test → revision` を記録する。trial 未実施なら first-class promotion 完了としない。