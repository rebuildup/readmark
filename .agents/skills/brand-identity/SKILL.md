---
name: brand-identity
description: >
  Use when creating, extending, or auditing a durable visual identity system for a
  product, service, organization, or platform across multiple touchpoints. Define
  recognition invariants, controlled expression, brand architecture relationships,
  and application stress tests without reducing identity to a logo or style preset.
---

# Brand Identity

ブランドを「ロゴ・色・フォントのセット」にしない。

**Brand truth → Recognition system → Expression range → Architecture → Applications → Verify** の順で、時間と媒体をまたいで再利用できる identity system を設計する。

この Skill は full business strategy や naming をゼロから作るものではない。既にある product / organization の truth、positioning、audience、既存 equity を design input として読む。

## When to use

次のようなときに使う。

- 新しい product / service / organization の visual identity を作る
- rebrand / refresh で既存 equity を残しながら system を更新する
- logo はあるが、他の touchpoint に展開できる visual language がない
- parent brand / product / sub-brand / campaign の関係を整理する
- 複数 team / medium で brand expression が drift している
- campaign や一枚の key visual ではなく、長期間使う identity rules が必要

一つの campaign / event / release の temporary grammar が主目的なら `key-visual-design` を使う。identity-bearing mark 自体の silhouette / geometry / optical behavior を深く設計する場合は `brand-mark` を使う。

## 1. Inspect brand truth and existing equity

見た目を変える前に確認する。

- product / service / organization が何を提供するか
- primary audience と usage / cultural context
- positioning / attributes / mission のうち visual decision に効くもの
- current name / logo / mark / colors / type / imagery / iconography / motion
- 既に強く認識されている cue
- parent brand / product / sub-brand / partner / co-brand relationship
- current product UI / marketing / physical / social / event applications
- multilingual / multi-script requirements
- trademark / licensing / commissioned asset constraints
- current system の failure: indistinguishable, rigid, inconsistent, inaccessible, hard to operate など

既存 brand asset を「古いから」だけで捨てない。認識 equity があるなら、何を残し、何を変え、なぜ変えるかを記録する。

## 2. Open references and compare systems

`references/brand-identity.md` から task に近い複数 reference を実際に開く。

一つの brand / studio を style template にしない。少なくとも次の差を見る。

- logo が identity の主 anchor か、複数 cue の一つか
- consistency を asset repetition で作るか、relationship / generative rule で作るか
- expression が restrained か expressive か、どこで loudness を変えるか
- imagery / type / color / layout / motion のうち何が recognition を担うか
- product / sub-brand / campaign が parent identity からどこまで離れられるか
- dense utility surface と brand-forward surface で identity の濃度がどう変わるか
- system を別 team が運用できる程度に rule が明確か

exact color、typeface、grid、logo geometry、creator 固有の image treatment はコピーしない。

## Observe

reference と current brand を次の軸で比較する。

- **truth / equity** — 何を表す brand か、既に何が認識されているか
- **lifetime** — durable parent/product identity か、一時的な campaign expression か
- **recognition invariants** — 変えると brand recognition が壊れる関係は何か
- **variable expression** — audience / content / medium / intensity に応じて変えてよいものは何か
- **mark dependence** — logo/mark がなくても family recognition が残るか、残す必要があるか
- **type role** — voice / hierarchy / personality / utility のどこを担うか
- **color role** — recognition / hierarchy / theme / product-family differentiation のどこを担うか
- **imagery role** — photography / illustration / texture / data / product imagery の ownership と direction
- **graphic grammar** — shape / grid / frame / motif / composition relationship
- **iconography / motion** — brand-facing direction が必要か、product-system rule とどう接続するか
- **architecture** — parent / product / sub-brand / endorsed / co-brand の関係
- **expression range** — quiet ↔ loud、institutional ↔ campaign、utility ↔ storytelling の modulation
- **localization** — script / language / cultural cue が変わっても identity が成立するか
- **governance** — originator 以外が新しい application を作れるか
- **evolution** — 将来何を変更しても accumulated recognition を維持できるか

## 3. Define recognition invariants before asset lists

「logo + palette + font + pattern を必ず揃える」のような固定 checklist を source of truth にしない。

まず、identity を識別可能にする **関係** を定義する。

例:

```text
Retained
- wordmark relationship
- restrained neutral base + one recognizable accent role
- image crop behavior
- type hierarchy contrast

Variable
- campaign palette extension
- illustration carrier
- layout density
- motion intensity

Reason
- recognition cue / audience / medium / content job
```

Retained cue の数に universal な正解はない。logo 依存が強い brand も、type / color / imagery / motion の関係で認識される brand もある。

ただし、`logo を外したら何も共通しない` 状態と、`全 touchpoint が同じ template` の両極端は stress test する。

## 4. Build an expression range

一つの hero composition を全媒体へコピーしない。

必要な application を役割で分ける。

- identity-forward: launch, brand story, flagship campaign, event
- content-forward: editorial, documentation, product information
- utility-forward: application UI, transactional surface, dense data
- compact identity: avatar, favicon, app badge, small lockup
- environmental / physical: signage, packaging, merchandise, print
- temporal: motion, video, interaction where applicable

各 context で何を残し、何を抑え、何を拡張するかを決める。

brand presence を減らすことと、identity を失うことは同じではない。utility surface で decoration を減らしても、type / color role / icon family / spacing / voice / mark placement などの関係で一貫性を保てる場合がある。

## 5. Define architecture relationships

parent / product / sub-brand / service / event / campaign がある場合、同一性を見た目だけで決めない。

各 entity について確認する。

- audience は同じか
- promise / offering はどこまで共有するか
- independent recognition が必要か
- parent endorsement が必要か
- touchpoint が同居する頻度
- naming / legal / trademark constraint
- existing equity

そのうえで relationship を定義する。

- shared mark / lockup
- shared type or layout grammar
- shared core palette + scoped extension
- shared imagery or icon direction
- independent campaign carrier under parent system

一つの architecture model を universal にしない。child identity を色違いだけで量産することも、各 child を完全に別 brand にすることも自動採用しない。

## 6. Delegate detailed domain execution

brand identity は各 foundation Skill の詳細規則を複製しない。

- mark / wordmark / monogram / lockup → `brand-mark`
- semantic palette / theme / interaction color → `color-system`
- text composition → `typesetting`, mixed script → `font-mixing`
- UI/product icon family → `iconography-system`
- campaign-wide temporary visual proposition → `key-visual-design`
- detailed illustration direction → `illustration-direction` がある場合
- detailed motion behavior → relevant motion Skills

この Skill では、それらが **brand recognition のためにどの役割を持ち、互いにどの関係を保つか** を定義する。

## 7. Treat accessibility and localization as system constraints

brand expression を accessibility の例外にしない。

確認する。

- recognizable accent が contrast / state semantics を壊さないか
- decorative brand color だけで meaning を伝えていないか
- brand typeface が required script / weight / fallback を支えられるか
- translated copy で lockup / layout / hierarchy が破綻しないか
- symbol / gesture / imagery が locale で別の意味を持たないか
- motion identity が reduced-motion / non-motion context でも認識可能か
- monochrome / high-contrast / low-brand-presence context でも必要な identity が残るか

trademark / asset-rights / legal approval が必要な brand asset は、その制約を design evidence として記録する。法的判断そのものはこの Skill の責務ではない。

## 8. Avoid

- logo refresh を brand identity 全体と呼ぶ
- `logo + 3 colors + 2 fonts` を universal recipe にする
- moodboard の似た雰囲気だけで system を定義する
- campaign の key visual を永続 identity として固定する
- brand color を every surface / control / status へ塗る
- parent / sub-brand を色違い template だけで区別する
- consistency のために全 application を同じ composition にする
- flexibility の名目で logo 以外の recognition rule をなくす
- creator/studio 固有の asset、exact grid、typeface、graphic treatment を clone する
- global brand なのに one-language lockup / Latin-only typography だけで完了する
- guideline deck の美しさを、運用可能性の証拠にする

## Verify

hero board ではなく **application family** を実際に作って確認する。

最低限、current brand に意味のある materially different context を含める。

- primary brand-forward application
- content-heavy / editorial application
- utility / product or information-dense application
- compact / small-size identity application
- light/dark または monochrome context（該当する場合）
- multilingual / mixed-script application（必要な brand）
- static / motion pair（motion identity を定義した場合）
- parent + child / campaign coexistence（architecture がある場合）

各 artifact について記録する。

```text
Job/context:
Retained identity cues:
Changed expression:
Reason:
Failure found:
Revision:
```

見るもの:

- logo を大きく置かなくても必要な recognition が残るか
- identity-forward と utility-forward の両端で同じ brand family に見えるか
- information hierarchy / usability を brand expression が邪魔していないか
- parent / child / campaign relationship を誤認しないか
- long copy / localization / dense content で system が崩れないか
- small / monochrome / low-contrast-risk context で key cues が消えないか
- new application を rule から生成でき、過去 artifact の模倣に頼らないか
- final raster / browser / print / playback など delivered representation で成立しているか

判断が曖昧なら、minor palette variation ではなく、recognition mechanism や expression range が materially different な2案以上を比較する。

## Completion boundary

Skill 本文を書いただけで brand identity の promotion を完了としない。

少なくとも一つの real brand/project で application family を作り、上の stress test を実施し、failure と revision を durable に記録するまでは experimental として扱う。
