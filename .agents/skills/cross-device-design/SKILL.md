---
name: cross-device-design
description: >
  Design task continuity across multiple devices or surfaces by preserving meaningful activity context,
  state, ownership, destination adaptation, and recovery without conflating cross-device handoff with
  responsive layout, cloud synchronization, or platform-specific continuity APIs.
---

# Cross-Device Design

同じ product が複数 device に存在するだけでは cross-device experience にならない。

この Skill は、**ある device で始めた意味のある task を、別の device / surface へ移して継続するとき**に使用する。

`responsive-design` が一つの表示中 interface を available space / input / zoom に適応させるのに対し、ここでは **activity context の移動**を設計する。

> Identify the activity → Preserve the minimum meaningful state → Transfer explicitly → Adapt to the destination → Verify continuity and recovery

## When to use

次のような要求があるときに使う。

- phone で始めた document / form / message / media task を tablet / desktop で続ける
- desktop から mobile へ reading / editing / playback position を引き継ぐ
- native app から別 device の native app または web へ同じ task を再開する
- device capability の違いを利用して task の一部を別 surface へ移す
- platform の Handoff / Continue On / Resume 相当機能を product experience として設計する

単に同じ account data が同期されるだけ、同じ responsive page を複数画面サイズで表示するだけなら、この Skill の主対象ではない。

## Workflow

1. current product の cross-device surface、account model、sync behavior、platform conventions を確認する。
2. 引き継ぐ **activity** を task level で定義する。app 全体を単位にしない。
3. resume に必要な state と、durable sync に任せる state を分離する。
4. transfer / shared session / remote control / companion display のどれかを区別する。
5. destination の capability・input・layout・native/web availability を観察する。
6. initiation、destination selection、acceptance、ownership、source behavior、fallback を決める。
7. platform-specific continuity mechanism は current evidence として使い、product rule と API を同一視しない。
8. 実際に source → destination の end-to-end task を通し、failure / stale state / unavailable target を含めて検証する。

## Observe

### Activity granularity

まず「何を続けるのか」を具体化する。

良い continuity unit の例:

- document + current section / cursor context
- message thread + reply state
- product / record + current operation
- article / book + reading position
- audio / video + item + playback position
- map / route + current destination or region
- multi-step task + completed steps + current step

弱い例:

- app を開く
- dashboard を開く
- home screen に戻す

transfer 後に user が元の task を探し直すなら、continuity state が粗すぎる可能性が高い。

### State fidelity

state を次のように分けて観察する。

- **identity** — 何の object / content / task か
- **position** — page、section、playback time、step、selection など
- **working context** — filter、draft、view mode、editing target など
- **durable data** — server / local sync で保存される本体データ
- **ephemeral state** — hover、open tooltip、一時 animation など destination へ持ち込む価値が低い状態

全 UI state を複製しない。
**destination で task を自然に再開するための最小 state** を選ぶ。

### Handoff vs durable synchronization

activity handoff と data sync を混同しない。

- sync は document / account / preference 等を durable に保つ
- handoff は「今どの task をどこまで進めているか」を伝える
- handoff packet が失われても durable work が失われない構造を優先する
- unsaved work を transfer する場合は source-of-truth / conflict / failure behavior を明示する

continuity mechanism を唯一の保存経路にしない。

### Transfer vs simultaneous session

異なる cross-device model を一つにまとめない。

**Transfer**
- active task の中心が source から destination へ移る
- destination で continuation することが主目的
- source の表示や操作可能性をどうするか決める必要がある

**Shared / simultaneous session**
- 複数 device が同時に同じ experience に参加する
- presentation + controller、共同 session、companion surface 等
- ownership / synchronization / feedback model が transfer と異なる

product が必要としているのがどちらかを先に決める。

### Destination capability

destination を device 名だけで選ばない。

観察する:

- available display space
- touch / pointer / keyboard / pen
- camera / microphone / sensors
- installed native app / web availability
- authentication / account state
- online / offline capability
- privacy level / shared-device context
- task に必要な performance / precision

source と destination の UI は pixel-identical でなくてよい。
**task identity と action semantics を保持し、destination に適した presentation へ翻訳する。**

### Initiation and discoverability

transfer がどう始まるかを見る。

- user が明示的に Continue / Open on… を選ぶ
- OS が recent activity を suggestion として提示する
- destination picker を使う
- proximity / ecosystem signal により候補を出す

重要な task を、user が理解しないまま自動的に別 device へ奪わない。

transfer affordance は、現在の task と destination の関係が理解できる label / context を持たせる。

### Acceptance and ownership

transfer 成功後の「どちらが active か」を曖昧にしない。

- destination が受け取ったことを明確にする
- source を閉じる / passive にする / 継続可能にする、のどれかを task semantics に応じて決める
- destructive / transactional action が両 device から重複実行されないようにする
- bidirectional continuation を提供する場合も current ownership を説明できるようにする

source cleanup は platform API の都合ではなく、user の mental model から判断する。

### Freshness and staleness

continuity suggestion は時間とともに価値が下がる。

観察する:

- activity がまだ resume 可能か
- underlying object が更新 / 完了 / 削除されていないか
- destination が古い draft / position を復元しないか
- suggestion の lifetime が task の性質に合っているか

stale activity を成功扱いで開かず、current state へ reconcile するか明示的な recovery を提供する。

### Fallback

primary transfer path が使えない場合を先に設計する。

- destination app が未 install
- platform / OS version が非対応
- account が異なる / sign-in が必要
- network unavailable
- target device が見つからない
- activity link が期限切れ
- native continuation は不可だが web は利用可能
- destination ではその operation 自体が非対応

fallback は「何も起きない」にしない。
source task を保持し、user が次に取れる action を示す。

### Privacy and context exposure

activity metadata 自体が sensitive な場合がある。

- device picker / lock screen / system suggestion に何が露出するか
- shared device に task title / preview を出してよいか
- destination account が同一である必要があるか
- transfer 前に explicit confirmation が必要な consequence か

必要最小限の context で continuity を成立させる。

## Decision rules

- cross-device continuity の単位は **app** ではなく **user activity / task** から決める。
- destination は source UI の mirror ではない。意味と state を保ち、surface に適した interaction へ翻訳する。
- durable data と handoff context を分け、transfer failure が data loss に直結しないようにする。
- one-way transfer と simultaneous multi-device experience を明示的に分離する。
- receiving device の選択は device label より、task に必要な capability と user context を優先する。
- transfer availability を platform support の存在だけで判断しない。product / account / privacy / task consequence を確認する。
- platform continuity API の exact payload / component / version を universal design rule にしない。
- unsupported destination では task を劣化したまま強行せず、source continuation / web fallback / alternate route を選ぶ。
- source と destination の双方で同じ destructive action が active になる場合、ownership / conflict policy を明示する。
- stale activity を無期限に提示しない。

## Responsibility boundaries

### `responsive-design`

一つの currently rendered interface が viewport / container / zoom / input environment に適応する責務を持つ。

`cross-device-design` は、**別の device context へ task/state を移す責務**を持つ。

### Platform-system Skills

`apple-hig`、`material-design`、`fluent-2` 等は、各 platform で continuity をどう surface / convention に適応するかを担当する。

この Skill は platform を跨いで共通する activity granularity、state fidelity、ownership、fallback、verification を担当する。

### `navigation-design`

product 内の information space 間の movement / orientation を担当する。
device 間の activity migration はこの Skill が担当する。

### Backend / synchronization

conflict-free replication、network protocol、database sync、authentication architecture は implementation domain であり、この Skill の source of truth ではない。

ただし、それらの制約が continuity experience に与える failure / ownership behavior は設計入力として扱う。

## References

実装前に、対象 platform の current status と supported surface を再確認する。
詳細な観察ポイントは [`references/cross-device-continuity.md`](./references/cross-device-continuity.md) を読む。

Primary reference families:

- Apple Handoff / user activity continuation
- Android Continue On / cross-device sessions
- Windows Resume / cross-device continuation

## Avoid

- cross-device design を breakpoint / responsive layout の別名にしない。
- transfer 後に app home を開くだけで「continuity」と呼ばない。
- 全 UI state を serialise して destination に再現しようとしない。
- cloud sync があるだけで handoff experience が成立したと考えない。
- transfer と shared session を同じ interaction model にしない。
- phone / tablet / desktop の名前だけから destination behavior を決めない。
- native app 未 install / unsupported version / offline を無視しない。
- stale suggestion を永続表示しない。
- source task を先に破棄してから transfer success を待たない。
- system API の current limitation を timeless design principle にしない。
- activity title / preview に sensitive content を無条件で露出しない。

## Verify

最終 verification は component screenshot ではなく **source → destination の task continuity** で行う。

1. realistic task を device / surface A で開始し、object identity、position、working state を途中まで作る。
2. A から B へ continuation を開始し、何を続けるのか user が理解できることを確認する。
3. B で generic home ではなく intended task / object / position が復元されることを確認する。
4. B の layout / input model が A と異なっても、task meaning と主要 action が保持されていることを確認する。
5. transfer 後の A の state と ownership が user に矛盾を起こさないことを確認する。
6. app unavailable / unsupported OS / offline / account mismatch / rejected target のうち該当する failure path を実行し、A の work が失われないことを確認する。
7. stale activity を作り、underlying data が変化した後に安全に reconcile / expire できることを確認する。
8. native → web fallback がある場合、同じ object/task へ到達し、必要な authentication context が明確であることを確認する。
9. bidirectional continuation が supported なら B → A も試し、古い state へ巻き戻らないことを確認する。
10. activity title / preview / system surface に confidential data が不要に露出していないか確認する。

platform feature を利用する場合は emulator screenshot だけで完了せず、可能なら **実際の2 device / 2 surface** で transfer を行う。platform-specific feature が preview / limited access の場合は、その status と検証条件を記録する。

real project / representative artifact でこの end-to-end trial を実施するまでは、first-class promotion 完了と扱わない。

last-reviewed: 2026-09-13
