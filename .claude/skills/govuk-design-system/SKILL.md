---
name: govuk-design-system
description: >
  Use when adapting public-facing transactional services to the current GOV.UK Design
  System and Service Manual conventions. Translate an end-to-end service journey into
  GOV.UK page, navigation, task, review, recovery, and completion patterns without
  cloning GOV.UK branding or replacing domain-specific design decisions.
---

# GOV.UK Design System

Last reviewed: 2026-09-13

GOV.UK Design System を黒・白・黄色、太い heading、緑 button の visual preset として使わない。

この Skill は current service の user need / transaction / task structure を、GOV.UK の public-service journey convention へ**翻訳する adapter**として使う。

**Inspect service outcome → Compare current GOV.UK evidence → Classify journey → Translate service semantics → Verify end to end** の順で進める。

## When to use

次のような 2D service UI を GOV.UK conventions に適応するときに使う。

- public-facing application / claim / registration / reporting service
- eligibility check から submission / confirmation まで続く transaction
- users が複数 session に分けて完了する長い service
- repeated-use service with multiple tasks / service-level navigation
- GOV.UK Design System を採用済み、または GOV.UK service conventions と整合させる必要がある service
- high-consequence flow で review / correction / completion state を明確にする必要がある service

単に「government look」「GOV.UK look」にしたいだけなら使わない。

## Responsibility boundary

`govuk-design-system` が決めるのは **public-service journey と current GOV.UK system への adaptation**。

以下は既存 Skill を source of truth にする。

- question sequencing / field choice / validation structure → `form-design`
- wording / headings / labels / messages → `content-design`
- global / local / hierarchical navigation model → `navigation-design`
- focus / selected / disabled / loading 等の state semantics → `interaction-states`
- keyboard traversal / focus lifecycle → `keyboard-interface`
- touch / pointer acquisition → `touch-interface`
- viewport / container adaptation → `responsive-design`
- translation / locale / direction → `internationalization-design`
- memory / interruption / resumption burden → `cognitive-accessibility`
- exclusion discovery / lived-experience participation → `inclusive-design`
- broad accessibility conformance review → `accessibility-audit`

GOV.UK に同名 component / pattern があることを理由に、これらの domain decision を上書きしない。

## 1. Inspect the service before opening components

最初に component catalog を見ない。

current service について最低限確認する。

- user が最終的に完了したい outcome
- transaction の start / completion boundary
- mandatory / optional / offline / external steps
- user が 1 session で完了できるか
- task order が固定か、user が選べるか
- user が service を反復利用するか
- submission 前に correction / confirmation が必要か
- consequence / legal / financial / eligibility implications
- expected next step after submission
- current host/header/navigation responsibilities
- save/resume / timeout / interruption behavior
- realistic error / ineligible / unavailable / partial-completion paths

まず journey を分類する。

### Linear transaction

clear start → ordered questions/actions → review → submit → confirmation がある journey。

navigation を増やす前に journey 自体を単純化する。

### Long / multi-session transaction

複数 task を別 session で進める、または task order を user がある程度選ぶ必要がある journey。

### Repeated-use / multi-task service

user が繰り返し戻り、複数 destination / tool / resource 間を切り替える service。

この分類をせずに header nav、task list、sidebar、dashboard を追加しない。

## 2. Open current GOV.UK references

最初に [`references/govuk-service-system.md`](references/govuk-service-system.md) を読む。

その後、current task に関係する direct pattern / component guidance だけを開く。

必ず current lifecycle status と current GOV.UK Frontend / Design System update を確認する。

- Stable と Trial を区別する
- deprecated / superseded guidance を current default にしない
- component API や Nunjucks option は implementation evidence として扱う
- exact spacing / type / color value は GOV.UK 固有 implementation であり universal rule にしない

## 3. Observe these axes

### Service boundary and orientation

- GOV.UK-wide / host-level chrome と service-owned context の分離
- service name / service navigation / phase or service-level messages / page content の順序
- current page の heading が task を明確に表しているか
- page-specific element が service-level message と混ざっていないか
- user が「どの service の、どの段階にいるか」を記憶に頼らず判断できるか

### Journey shape

- linear completion か repeated switching か
- one sitting か multi-session か
- task order が mandatory か user-controlled か
- branching が user answer によって変わるか
- optional branch が critical path を妨げていないか
- user が戻る / change する / resume する時に context が維持されるか

### Page responsibility

- 1 page に何個の decision / question / information task があるか
- heading と current action が一致しているか
- unrelated explanation / secondary action が current task を薄めていないか
- page を分割することで理解と recovery が改善するか、それとも不必要な click を増やすだけか

「one thing per page」は universal page-count rule ではなく、linear public transaction で focused decision を作るための evidence として使う。

### Navigation need

- clear ordered journey に persistent navigation が本当に必要か
- repeated-use service で destination switching が頻繁か
- navigation label と service task が一致しているか
- header / service nav / breadcrumb / back link が同じ orientation 情報を重複していないか

### Multi-task / task-list fit

- user が複数 session を必要とする evidence があるか
- task order を user が選べる必要があるか
- task status が user action に役立つか
- status vocabulary が増えすぎていないか
- task list を追加する前に transaction を単純化できないか

### Review and commitment

- submission が consequential / irreversible / externally processed か
- user が送信前に全体を確認する価値があるか
- change action から edit → review に自然に戻れるか
- edit 後に unrelated pages を再通過させていないか
- submit action が outcome を具体的に示すか

### Error and recovery

- invalid input と eligibility / service failure を混同していないか
- failed submission 後も user input が保持されるか
- page-level error summary と field-level error が同じ問題を指しているか
- error text が correction path を示すか
- banner を generic error container として乱用していないか

### In-journey state vs completion

- current journey 内の temporary outcome / service-wide notice か
- transaction 自体が完了したのか
- completion 後に receipt/reference、next step、time expectation、contact / follow-up が必要か
- completed state から user が次に何をすべきか分かるか

### Lifecycle / confidence

- component / pattern が Stable か Trial か
- guidance に known gaps / research requests があるか
- current release note で behavior / ownership が変わっていないか
- historical GOV.UK pattern を current system rule と誤認していないか

## 4. Translate the journey, not the screenshot

### Start from an explicit service entry

public transaction の入口では、user が最低限理解できるようにする。

- service が何をするか
- 誰が使うべきか / suitability を確認する必要があるか
- 開始前に必要な情報や準備
- online transaction の外側に必要な action があるか
- completion までの大まかな expectation

既存 GOV.UK start-page pattern を unrelated product の marketing hero としてコピーしない。

### Prefer a focused linear path when the task is linear

clear ordered transaction では persistent navigation を追加する前に、completion path を単純化する。

question / decision を分離する場合は、各 page が一つの coherent user task を持つようにする。

分割の目的は:

- question の意味を理解しやすくする
- error の scope を小さくする
- branching を current answer に合わせる
- correction / resume を予測しやすくする

ことであり、page 数を増やすこと自体ではない。

### Add service navigation only when the service behaves like a service hub

repeated-use / multi-task service で user が destinations 間を何度も切り替える場合に service-level navigation を検討する。

linear transaction の中に exploration-oriented navigation を足して completion path と競合させない。

GOV.UK-wide tools / host header と service-owned navigation の責務を混ぜない。

### Use task lists only for genuine multi-task work

Task list / Complete multiple tasks pattern を使う前に、以下を説明できること。

1. なぜ 1 session で完了しにくいか
2. なぜ task 単位の planning が user を助けるか
3. task order がどこまで flexible か
4. status が何を意味し、次の action をどう支援するか
5. save / resume 時に何が保持されるか

単なる wizard progress、dashboard decoration、長い form の見た目上の分割には使わない。

### Put review immediately before consequential submission

small / medium transaction では、必要なら submit 直前に check-answers boundary を置く。

review surface は:

- user が提供した relevant information を確認できる
- sections / values の関係が読み取れる
- change action が何を変更するか明確
- correction 後に review へ戻る
- irrelevant conditional sections を表示しない
- final submit action が具体的 outcome を表す

ようにする。

### Preserve work during correction

validation error や change flow で、既入力内容を消さない。

invalid input では:

- current page を保持
- user が入力した内容を保持
- correction path を明示
- page-level summary と local error を整合

する。

eligibility failure、system outage、not-found 等を field validation として表現しない。

### Match message strength to journey meaning

#### Validation error

user input を直せば進める問題。

#### Interruption

current journey を一度止め、重要な information / consequence を理解してから続行させる必要がある状態。

#### Notification

current page の主 task とは別だが、service や user に関係する status / outcome。

#### Confirmation

transaction が終了した state。

これらを banner の色や component availability だけで選ばない。

### Make completion operationally useful

confirmation では「Success」だけを表示しない。

該当するものを明示する。

- what was completed
- reference / receipt
- what happens next
- expected timing
- who will contact whom
- how to get help
- likely next service / information
- record/save path where the transaction needs one

completion page を次の marketing opportunity に変えない。

## 5. Treat current GOV.UK status as version-sensitive evidence

2026-09-13 時点の GOV.UK Design System は GOV.UK Frontend v6.5.0（2026-08-27 release）を current update として案内している。

Feedback と Language navigation は同 release で Trial component として公開されている。

current run では必ず:

- Design System `What's new`
- component lifecycle status
- direct component/pattern page

を確認する。

Trial component は「使えない」という意味ではないが、change / deprecation risk と research need を current design decision に含める。

package version や Nunjucks/Sass API を design principle にしない。

## 6. Prefer current patterns without outsourcing judgment

current GOV.UK component / pattern を採用する理由は、その visual appearance ではなく、public-service research と expected behavior が蓄積されているため。

custom pattern / component を作るなら最低限説明する。

1. existing GOV.UK pattern では満たせない user/service need
2. current journey での semantic role
3. content / error / recovery behavior
4. keyboard / focus behavior
5. narrow / zoom / reflow behavior
6. accessibility implications
7. localization / long-content behavior where applicable
8. how user research / service evidence will verify it

component を使っただけで service が usable / accessible になったとみなさない。

## Avoid

- GOV.UK screenshot の pixel clone
- black/yellow/green styling を public-service quality と同一視する
- every page を one-question-per-page に機械的に分割する
- clear linear transaction に persistent nav を追加する
- long form という理由だけで task list を追加する
- task list を progress indicator として使う
- breadcrumb / back link / service nav / page heading で同じ context を重複する
- Notification banner を validation error に使う
- check-answers から change した後に journey 全体を再走させる
- error 後に entered data を消す
- confirmation を generic success toast / banner に置き換える
- Trial component を Stable とみなす
- old header/service-name implementation を current guidance として固定する
- GOV.UK Frontend API / exact values を universal design rule にする
- Design System components を使っただけで accessibility が完成したとみなす

## Verify

最終 source file ではなく、delivered service journey を操作して確認する。

### Representative end-to-end transaction

最低 1 つ、realistic data を使って次を最後まで通す。

`entry/start → questions/tasks → error or correction → review → submit → confirmation/next step`

該当する service では resume / returning-session path も通す。

確認する:

- start と completion boundary が明確
- current step/task が理解できる
- optional path が critical path を邪魔しない
- back/change/resume で entered work が保持される
- final submission の consequence が明確
- completion 後の next step が理解できる

### Journey variants

少なくとも relevant なものを試す。

- first-time happy path
- validation error → correction
- change answer from review → return to review
- conditional branch changed by corrected answer
- ineligible / cannot continue
- service unavailable / system error
- multi-session resume
- incomplete task → later completion

### Navigation and shell

wide / narrow で:

- host/global header
- service name / service navigation
- phase/service-level message
- breadcrumbs/back link where used
- page heading

の責務が重複せず、tab order / reading order が自然か確認する。

### Keyboard / focus

actual interaction で:

- skip path
- page load after validation error
- error summary → invalid control
- back/change link
- task-list links/statuses
- final submit
- confirmation / next-step links

を通す。

focus movement は current GOV.UK component behavior を evidence にしつつ `keyboard-interface` で再確認する。

### Responsive / zoom / long content

- narrow mobile-sized viewport
- continuous resize
- 200% text zoom
- 400% browser zoom / 320 CSS px equivalent where applicable
- long names / addresses / identifiers
- realistic error text
- long service/task names

で clipping、horizontal loss、hidden action、heading/context loss がないか確認する。

### Accessibility and inclusion

GOV.UK component の accessibility guidance は baseline evidence として使うが、service 全体は `accessibility-audit` / `inclusive-design` で再確認する。

Design System 自身も、component 使用だけで service accessibility が保証されない前提で扱う。

### Lifecycle freshness

implementation 前と final review 時に:

- direct component/pattern page の status
- current `What's new`
- known gaps / research notes

を再確認する。

Trial component を使った場合は、採用理由と change risk を記録する。

### Real-project promotion gate

experimental から先へ進める前に、real service / realistic service prototype で trial し、最低限次を記録する。

- journey classification
- linear vs navigation-heavy decision
- page/task decomposition
- review/correction behavior
- error/data-preservation result
- confirmation/next-step result
- narrow/zoom/keyboard result
- Trial/current component decisions
- user/service research still missing
- discovered limitation / exception

trial を行っていない場合は completed / promoted と報告しない。
