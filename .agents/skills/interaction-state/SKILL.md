---
name: interaction-state
description: >
  Web / application UI の interaction state、state transition、mutually exclusive な presentation state、
  pending / cancellation / re-entry を設計・改善するときに使用する。
  UI を screenshot の集合ではなく observable state graph として捉え、state ownership、event、transition legality、
  focus / modality、rapid repeated input を実際の interaction で検証する。
---

# Interaction State

GUI を static screen の集合として設計しない。

**Inspect interaction → Enumerate observable states → Assign state authority → Model transitions and invariants → Inspect references → Implement → Stress the interaction**

を基本にする。

Status: experimental  
Last reviewed: 2026-09-16

## Boundary

この Skill が扱うのは **user から観測できる interaction state と、その遷移が破綻しないための design decision** である。

扱う:

- component / region / screen が取り得る observable state
- state 同士の coexistence / mutual exclusion
- user event / system event と state transition の対応
- shared presentation state の authority / ownership
- pending / loading / optimistic / success / error / cancelled state
- interruption / repeated input / re-entry
- async completion が current state にまだ有効か
- dialog / menu / disclosure 等の open / closed と focus / modality の関係
- back / escape / cancel / retry / reopen の behavior
- transition 前後で interaction semantics が一貫しているか
- rendered UI を実際に操作する behavior verification

扱わない:

- animation duration / easing / choreography の設計
- form の質問順序や validation policy そのもの
- backend workflow / transaction architecture
- framework-specific state library の API
- MVP / MVVM / Passive View / Mediator 等の architecture pattern の強制
- application 全体の domain model 設計

隣接 Skill との責務:

- motion-system — **valid な state transition をどう動かすか**を扱う。transition の合法性や state authority はこの Skill が扱う。
- form-design — form 固有の question / validation / recovery / submit flow を扱う。複数 UI region に跨る state coordination や interruption はこの Skillを併用する。
- accessibility-audit — keyboard / screen reader / semantics を含む accessibility regression を監査する。
- responsive-design — viewport / container / input environment による layout transformation を扱う。

## Workflow

1. current implementation / prototype を操作し、trigger → intermediate state → settled state を確認する。
2. user から観測できる state を列挙する。implementation の boolean 名をそのまま state definition にしない。
3. 各 state の owner を確認し、local state と shared / mutually exclusive state を分ける。
4. event ごとに許可される transition、無視される transition、cancel / retry / re-entry を整理する。
5. 同時成立してはいけない state と、必ず成立すべき invariant を明示する。
6. 対象に近い primary reference を開き、state / keyboard / focus / modality / repeated interaction を観察する。
7. current stack の既存 architecture / state primitive へ翻訳する。特定 pattern を先に選ばない。
8. normal path だけでなく rapid input / interruption / stale async completion を実際に発生させて検証する。

必要なら簡単な state table / state graph を作る。

例:

~~~text
closed
  └─ open → opening
opening
  ├─ settled → open
  └─ close → closing
open
  └─ close → closing
closing
  ├─ settled → closed
  └─ open → opening
~~~

diagram 自体を成果物にする必要はない。
重要なのは **どの event がどの state で有効か** を説明できること。

## Observe

### Observable states

reference / current UI について次を見る。

- idle / active / selected / expanded / open / closed
- empty / populated
- loading / pending / optimistic
- success / error / cancelled
- enabled / disabled / unavailable
- editing / viewing
- dragging / resizing / committing
- modal / non-modal
- focused / focus-restored

見た目が同じでも interaction rule が異なるなら別 state として扱える。
逆に implementation 上 boolean が複数あっても、user-observable behavior が同じなら無理に別 state にしない。

### State authority

- 誰が state の source of truth か
- sibling components が互いを直接操作していないか
- mutually exclusive な surface を誰が裁定するか
- local component state で十分なものを global に持ち上げていないか
- shared state なのに複数 component が独立して決定していないか
- animation completion callback が business / interaction state の唯一の authority になっていないか

### Events and transitions

event を「button が押された」だけに限定しない。

確認対象:

- pointer / touch / keyboard input
- route / navigation
- timer
- async resolve / reject
- cancellation
- external data update
- focus loss / restoration
- viewport / orientation change が interaction semantics を変える場合
- repeated event
- conflicting event
- re-entry event

各 event について:

- current state で有効か
- guard / precondition があるか
- next state は一意か
- no-op / ignore / queue / replace / cancel のどれか
- side effect が state transition と矛盾しないか

を見る。

### Async lifetime

async operation は開始時点だけでなく完了時点を設計する。

確認する:

- operation 中に user が cancel / close / navigate した場合
- request A の後に request B を開始し、A が後から完了した場合
- component / screen が unmount / dispose された後に completion が来た場合
- retry が previous attempt の state を誤って引き継がないか
- optimistic state が reject されたとき recovery path があるか

「最後に callback された結果を表示する」だけにしない。
current interaction にまだ属している completion かを判定できる構造にする。

### Focus and modality

visual open / closed だけで完了しない。

dialog / menu / disclosure 等では:

- open 時の focus destination
- close 時の focus restoration
- modal 中に background が interaction 可能か
- Escape / back の behavior
- keyboard traversal が current state と一致するか
- hidden / collapsed content が focusable なまま残っていないか

を確認する。

## Decision rules

### Model behavior before implementation flags

まず user-observable state と transition を整理し、その後で implementation representation を選ぶ。

悪い出発点:

~~~text
isOpen
isClosing
isLoading
hasError
isAnimating
~~~

これらが自由に組み合わさると、実際には存在してはいけない state が生成される可能性がある。

必要に応じて finite state / discriminated union / reducer / state machine 等で不可能な組み合わせを減らす。
ただし simple toggle に大きな state machine library を導入すること自体を目的にしない。

### Give conflicting shared state one authority

同時に成立してはいけない presentation state が複数 component に跨る場合、それらを独立 component が勝手に裁定しない。

例:

- full-screen overlay A と B
- modal と navigation transition
- editor mode と destructive confirmation
- one-at-a-time tool panel
- playback / recording / export の mutually exclusive state

coordination の責務を identifiable な owner / mediator / presentation model / state machine 等へ集約する。

実装 pattern の名前より、**conflict を最終的に誰が決めるかが一意であること**を優先する。

### Keep truly local state local

すべてを root state machine に集約しない。

hover、単独 disclosure、temporary input 等、他 state と conflict せず local lifecycle で閉じるものは component-local でよい。

globalization を「安全そうだから」という理由だけで行わない。

### Define invalid transitions

すべての input を常に受理しない。

current state に対して無効な event は:

- ignore
- reject
- replace current work
- cancel then transition
- queue

のいずれかを意図的に選ぶ。

偶然 handler が存在しないから何も起きない、という状態にしない。

### Design interruption as a normal path

animation / async work / gesture が途中で中断されることを例外扱いしない。

close 中の reopen、loading 中の cancel、drag 中の route change 等で、settled state を経由しなければ次へ進めない設計を避ける。

### Motion follows state semantics

state transition と animation lifecycle を区別する。

- state graph が animation library に依存しない
- reduced motion / zero-duration でも interaction が成立する
- animation cancel 後も logical state が曖昧にならない
- animation completion が来なくても deadlock しない

motion の visual design は motion-system へ委譲する。

### Architecture patterns are references, not requirements

Passive View、Presentation Model、Mediator、responsibility chain、state machine は、state authority と event flow を明確にするための有効な pattern 候補である。

ただし current framework が declarative state / reducer / actor / store 等で同じ invariant を自然に満たせるなら、それを優先する。

pattern stack を reference からそのままコピーしない。

## Primary references

- [WAI-ARIA APG — Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  - Observe: expanded / collapsed state、activation event、aria-expanded と visual state の同期。
  - Useful for: simple local state と keyboard-triggered transition。
  - Last reviewed: 2026-09-16.

- [WAI-ARIA APG — Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
  - Observe: closed → open、focus placement、keyboard event、open state と accessibility property の同期。
  - Useful for: transient surface と focus transition。
  - Last reviewed: 2026-09-16.

- [WAI-ARIA APG — Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  - Observe: modal / background interaction boundary、initial focus、focus containment、Escape、close 後の focus restoration。
  - Useful for: mutually exclusive presentation state と modality。
  - Last reviewed: 2026-09-16.

- [Stately / XState — Events and transitions](https://stately.ai/docs/transitions)
  - Observe: state + event から transition を決定する model、guards、re-entry、parent / child transition。
  - Useful for: explicit transition legality と state graph vocabulary。
  - Avoid copying: XState API を project requirement にしない。
  - Last reviewed: 2026-09-16.

- [Martin Fowler — GUI Architectures](https://martinfowler.com/eaaDev/uiArchs.html)
  - Observe: presentation state を widget 間の直接通信から分離する考え方、MVP / Presentation Model / Passive View の trade-off。
  - Useful for: state authority / presentation logic の placement。
  - Last reviewed: 2026-09-16.

- [Martin Fowler — Presentation Model](https://martinfowler.com/eaaDev/PresentationModel.html)
  - Observe: GUI controls から独立して presentation state / behavior を保持する方法。
  - Useful for: testable presentation state と複数 widget の coordination。
  - Last reviewed: 2026-09-16.

- [Martin Fowler — Passive View](https://martinfowler.com/eaaDev/PassiveScreen.html)
  - Observe: view から application-specific behavior を外し controller 側へ decision を集める pattern。
  - Useful for: complex state coordination の一つの architecture option。
  - Avoid copying: Passive View を universal architecture として要求しない。
  - Last reviewed: 2026-09-16.

## Supporting case study

- [Zenn — UI coordination case study](https://zenn.dev/nrs/articles/9ba91aea587bf5)
  - Observe: Passive View、hierarchical responsibility routing、Mediator、state machine を組み合わせ、複数 UI からの competing presentation request を一箇所で裁定する考え方。
  - Useful for: direct view-to-view coordination が増えた GUI を state authority の観点から再設計する例。
  - Avoid copying: pattern stack 全体を current framework に強制しない。抽出対象は ownership、event routing、conflict arbitration、state transition の原則。
  - Last reviewed: 2026-09-16.

## Avoid

- sibling component が互いの internal state を直接書き換える
- mutually exclusive state を複数 owner が独立して決定する
- boolean の任意組み合わせで impossible state を作れる
- animation callback だけで logical state を確定する
- close 中 / loading 中だから全 input を無条件に捨てる
- race condition 回避のため UI 全体を長時間 disable する
- stale async completion が新しい state を上書きする
- cancel / back / escape を happy path 外として後付けする
- hidden content が keyboard focusable のまま残る
- modal 表示中も background action が実行できる
- state machine library を導入すること自体を architecture 改善とみなす
- reference の MVP / Mediator / Chain of Responsibility を framework に関係なく機械的に移植する

## Verify

source code / unit test が通っても完了にしない。
実際の interaction を操作して stress する。

対象に relevant なものを最低限確認する:

1. normal path を開始 state から完了 state まで通す。
2. 同じ action を短時間に繰り返す。
3. conflicting actions を交互に素早く実行する。
4. enter / exit / layout transition の途中で反対 action を実行する。
5. loading / pending 中に cancel / back / close / retry を実行する。
6. close 完了前に reopen、open 完了前に close を実行する。
7. submit / save / command を重複実行する。
8. async work 中に navigation / unmount / dispose 相当を発生させる。
9. 古い async result が新しい request / state を上書きしないことを確認する。
10. Escape / back が各 transient state から一貫して戻れるか確認する。
11. dialog / menu 等で initial focus と close 後の focus restoration を確認する。
12. keyboard-only と pointer / touch path の state transition が矛盾しないか確認する。
13. narrow viewport / responsive transformation 後も同じ state semantics を維持する。
14. animation を無効化 / reduced motion にしても state transition が成立する。

failure が出たら、見た目の patch より先に state ownership / transition legality / async lifetime を再確認する。

最終成果は state diagram の美しさではなく、**user がどの timing で操作しても impossible / stale / contradictory な UI state に落ちないこと**で評価する。
