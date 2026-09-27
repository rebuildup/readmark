# Divergence before commitment

Last reviewed: 2026-09-17

この reference は、Skill authoring / artifact trial 中に最初の妥当案へ早すぎる収束が起きる場合だけ使う。常時「複数案を作る」規則ではない。

## When to invoke

次のいずれかが成立する場合、最初の案を critique / refine する前に divergence を検討する。

- brief / reference translation に複数の構造的に妥当な解釈が残る
- 最初の案への commitment 後の rework cost が大きい
- reference や design system が constraint ではなく solution template として探索空間を狭めている
- generic convergence / self-fixation 自体が既知の failure mode である
- task evidence より familiarity だけで最初の pattern を選びそうである

次の場合は原則 skip する。

- normative accessibility / safety / legal requirement で解が強く拘束される
- 原因と修正が特定済みの narrow defect
- cosmetic difference しか作れない
- reversible / low-consequence な routine decision で探索 cost が上回る

## Workflow

```text
Inspect
→ Extract
→ Translate
→ decide whether divergence is needed
→ generate independent structural hypotheses before critique
→ compare side by side
→ select / combine / reject with explicit evidence
→ reconcile with project / brand / design-system constraints
→ Implement
→ Verify delivered representation
```

truth / safety / accessibility / legal / approved-brand invariants は divergence 中も hard constraint として維持する。spacing vocabulary、component choice、surface treatment などの system consistency が仮説を不必要に早く潰す場合だけ、convergence filter として後段で再適用する。

## Material difference

案数そのものを evidence にしない。少なくとも一つの task-relevant structural axis が変わり、異なる user / artifact behavior を予測するときだけ independent hypothesis と数える。

比較軸:

- problem / user-value framing
- information architecture
- interaction / task model
- composition / hierarchy strategy
- representation model
- constraint trade-off

色、radius、spacing、typeface、装飾だけを変えた variant は divergence と数えない。

## Trial protocol

promotion 前の controlled trial では、可能なら同一 brief / hard constraints で次を比較する。

1. serial baseline: first plausible concept → critique → refinement
2. divergence-assisted: independent structural hypotheses → side-by-side comparison → convergence
3. selected concept を current project / brand / design system へ reconciliation
4. final rendered / exported / played-back artifact を同じ verification criteria で inspection

記録するもの:

- structural axes explored
- cosmetic-only variant rate
- constraint violations
- rationale traceability
- task / hierarchy / communication quality
- rework introduced or avoided
- exploration cost
- convergence 後にも意味のある差分が残ったか

改善が確認できなければ standalone operation Skill を増やさず、domain Skill / authoring policy 内の条件付き gate に留める。

## Failure modes

- critique 後に「別案」を作り、最初の incumbent の表層変形しか出ない
- design system を外すこと自体を目的化し、hard constraint まで破る
- 3案など固定数を品質基準にする
- creator persona / style imitation を divergence の代替にする
- materially different な案を作っただけで比較・収束・最終 verification を省略する
- exploration cost を無視して routine decision に発散を強制する

## Research basis

- Design Council — Framework for Innovation / Double Diamond
  - https://www.designcouncil.org.uk/our-resources/framework-for-innovation/
  - Observe: problem-space / solution-space の divergence と convergence、Develop で複数回答を探索し Deliver で test / reject / improve する構造。
- Dow et al. — Parallel Prototyping Leads to Better Design Results, More Divergence, and Increased Self-Efficacy
  - https://hci.stanford.edu/publications/2010/parallel-prototyping/ParallelPrototyping2010-final.pdf
  - Observe: critique 前に alternatives を並列保持する条件と serial iteration の差。固定案数や対象 artifact 固有値は一般化しない。
- Cocoda / カナリー — ありがちなUIに収束させない生成フロー。「デザイナー人格」のskill化について
  - https://cocoda.design/varhirac/p/pe1f4d8e389b2
  - Observe: production workflow で design-system-first convergence を避け、異なる reasoning emphasis を持つ案を先に発散させてから system と reconciliation する実践例。固有 persona 名や表現を universal rule にしない。

## Boundary

これは `visual-hierarchy` や各 domain Skill の代替ではない。domain Skill が「何が妥当か」を所有し、この reference は **いつ commitment を遅らせるべきか** と **alternatives が本当に構造的に異なるか** だけを補助する。
