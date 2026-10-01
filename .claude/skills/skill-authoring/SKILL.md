---
name: skill-authoring
description: >
  design-skills の candidate / research issue / design topic を、綿密な reference research に基づく
  実用的な Agent Skill へ落とし込むときに使用する。一般論を大量に書くのではなく、
  agent が見るべき観点と primary reference URL を中心に、最小で自律実行可能な SKILL.md を作る。
---

# Skill Authoring

Design Skill は長い教科書である必要はない。

**Research deeply → Organize observation axes → Attach primary references → Define verification**

これだけで agent の判断を十分に変えられるなら、`SKILL.md` 1枚で成立させる。

目的は design knowledge を網羅することではなく、agent が必要なときに良い実例を自律的に観察し、現在の artifact へ翻訳できる状態を作ることである。

## 1. Start from the candidate

Issue / user request / roadmap candidate を読む。

最初に決めるもの:

- 何の design problem を扱うか
- 何を扱わないか
- foundation / standard / system / platform-trend / culture-style / scene-trend / artifact / operation のどれに近いか
- 既存 Skill と責務が重複しないか

細かい命名やディレクトリ構成をユーザーへ逐一確認しない。
既存 repository policy と candidate の意図から自律的に仮決定する。

## 2. Research before writing

SKILL.md を先に書かない。

まず reference を十分に集め、複数sourceを比較する。

### Foundation / technique

最低限調べる:

- authoritative guidance / specification / established literature
- 複数の production examples
- 同じ原則が異なるartifactでも反復するか
- failure examples / common misuse

### Standard / design system / platform

優先する:

1. official specification / guidance
2. official component / pattern documentation
3. first-party production implementation
4. public source code where useful
5. strong third-party analysis

version / status が変化するものは `last-reviewed` を持つ。

### Culture / historical style

最低限調べる:

- origin / canonical works
- historical context
- repeated composition / type / color / material rules
- current reinterpretations

文化名を単なる aesthetic keyword に変換しない。

### Current trend / scene

単一creatorや単一作品だけから一般化しない。

- 複数creator / 複数作品
- recent examples
- repeated visual grammar
- trend-specific behavior と普遍的design principleの区別
- fadとして消える可能性

作家名を最終的な style command に固定するより、観察した特徴を再利用可能な vocabulary へ分解する。

### Artifact

- strong finished artifacts
- real production constraints
- delivery format
- audience / viewing context
- export / playback / print behavior

を確認する。

## 3. Extract observation axes

調査結果を百科事典のように要約しない。

agent が reference を開いたときに **何を見るべきか** を列挙する。

例:

```text
Observe:
- composition / dominant alignment
- scale relationships
- type hierarchy
- density / negative space
- image-text relationship
- repeated motif
- motion timing / hold / transition
- material / texture treatment
- responsive or format transformation
```

対象domainに不要な観点は削る。

良い observation axis は、referenceを比較したとき差分を説明できる。

悪い例:

- modern
- cool
- stylish
- premium
- clean

これらを使う場合は observable な構造へ分解する。

## 3.5. Delay commitment when the problem is still underdetermined

複数の構造的に妥当な解釈が残り、最初の案への早期 commitment が後続案を狭めそうな場合だけ、critique / refinement の前に materially different な hypothesis を並列で出す。

固定数の案を要求しない。色・radius・spacing だけの variation は divergence と数えない。truth / safety / accessibility / legal / approved-brand invariants は hard constraint のまま維持する。

発火条件・skip 条件・比較軸・trial protocol は [Divergence before commitment](./references/divergence-before-commitment.md) を参照する。

## 4. Turn findings into lightweight guidance

原則として、調査で十分に確認できたことだけを書く。

必要なのは主に次の4要素。

1. **When to use** — 何を作るときに呼ぶか
2. **Observe** — reference の何を見るか
3. **References** — 実際に開く URL
4. **Verify** — 何を見れば成功/失敗を判断できるか

必要な場合だけ追加する:

- decision rules
- anti-patterns
- variants / substyles
- historical context
- current-version notes
- implementation-specific notes

文章量を増やすことを品質としない。

## 5. Reference URLs are runtime inputs

reference 名だけを書かない。

必ず agent が直接開ける URL を入れる。

各 reference は可能なら次の形式にする。

```markdown
- [Reference name](https://example.com/)
  - Observe: grid, title scale, image crop, density
  - Useful for: editorial landing pages
  - Avoid copying: brand assets and exact values
```

reference の価値が URL を開かないと理解できない場合でもよい。
Skill 本文に reference の全内容を複製しない。

### Reference count

固定数は設けない。

ただし非自明な style / trend / domainを一つのreferenceだけから定義しない。

目安:

- narrow official standard: official source + production evidence
- design system: official docs + first-party examples
- culture/style: several canonical + several current examples
- current scene/trend: enough independent works to prove repetition

## 6. Keep the Skill self-contained

最小構成:

```text
skills/<skill-name>/
└─ SKILL.md
```

これで成立してよい。

reference が多い、category が複数ある、本文が読みづらくなる場合だけ:

```text
skills/<skill-name>/
├─ SKILL.md
└─ references/
   ├─ <category-a>.md
   └─ <category-b>.md
```

scripts / evals / assets は明確な必要性が出るまで追加しない。

## 7. Minimal SKILL.md shape

```markdown
---
name: <skill-name>
description: >
  <when this skill should be used>
---

# <Skill Name>

<short intent / boundary>

## Workflow

1. Inspect current project / artifact context.
2. Open relevant references below.
3. Compare them using the observation axes.
4. Extract repeated rules; do not clone one reference.
5. Translate into the current artifact.
6. Verify the delivered result.

## Observe

- <axis>
- <axis>
- <axis>

## References

- [<name>](<URL>)
  - Observe: <specific properties>
- [<name>](<URL>)
  - Observe: <specific properties>

## Avoid

- <important misuse, only when needed>

## Verify

- <observable verification>
```

これ以上のsectionは必要になったときだけ足す。

## 8. Research quality gate

Skill化する前に確認する。

- reference URLを実際に開いて調査した
- 可能な限りprimary sourceを使った
- 複数reference間の共通点と差分を比較した
- generic aesthetic adjectiveではなくobservable axisへ変換した
- reference固有のasset / code / arbitrary pixel valuesをコピーさせない
- どのreferenceを何のために見るか分かる
- agentがユーザーへroutine design choiceを戻さなくても進められる
- delivered artifactをどう検証するか分かる

条件を満たせなければ、無理にSkillを書かず candidate / research Issue のまま残す。

## 9. Promotion from research Issue

Issueの候補をSkill化するときは、全候補を一括実装しない。

1. Issueから一つのcoherent domainを選ぶ
2. deep researchする
3. scopeが大きすぎればさらに分ける
4. minimal Skillを作る
5. real project / artifactで試す
6. 対象 artifact を実際に inspection / verification し、結果と判明した failure / limitation を記録する
7. 足りない観点だけ追加する

**artifact の inspection / verification と、その結果の記録が完了するまで research candidate を first-class Skill に promotion しない。**

**最初から完全なdesign textbookを作らない。**
reference-driven execution policyとして最小で成立させ、使用結果から育てる。
