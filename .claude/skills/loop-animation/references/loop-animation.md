# Loop Animation References

Last reviewed: 2026-09-17

この reference は、loop を software feature ではなく **repeatable temporal structure** として観察するために使う。

同じ「loop」という語でも、forward cycle、ping-pong、continuous continuation、drawing cycle、ambient background、interactive middle state では成立条件が異なる。単一 tool / creator の vocabulary を一般化しない。

## Implementation semantics

### Adobe After Effects — Expression language reference

- https://helpx.adobe.com/after-effects/desktop/work-with-expressions/expression-language-reference/expression-language-reference.html
- https://helpx.adobe.com/after-effects/desktop/work-with-expressions/expression-examples/expression-examples.html

Observe:

- `cycle` / `pingpong` / `offset` / `continue` が別の temporal behavior として定義されていること
- segment repeat と velocity-based continuation の違い
- loop 範囲を keyframe / duration で切り出せること

Useful for:

- renderer に複数の repetition model が存在することを確認する
- forward repeat と reversal / accumulation / continuation を設計上同一視しない根拠

Avoid copying:

- expression syntax を design rule にしない
- tool default の `cycle` を artifact の default にしない

### Rive — Timeline

- https://rive.app/docs/editor/animate-mode/timeline

Observe:

- One-Shot / Ping-Pong / Loop が明示的に異なる playback type として存在すること
- work area が大きな animation の一部分を扱えること

Useful for:

- artifact の repeat model を renderer selection より先に分類する
- ping-pong を seamless cycle の代替として無条件に使わない

Avoid copying:

- editor の mode 名を universal vocabulary として固定しない

### Toon Boom Harmony — Creating an Exposure Cycle

- https://docs.toonboom.com/help/harmony-22/advanced/timing/create-cycle.html
- https://learn.toonboom.com/modules/walk-cycle-animation
- https://learn.toonboom.com/modules/four-legged-walk-cycle-animation

Observe:

- drawing / exposure の series が cycle として再利用されること
- walk cycle が repeatable action として construction されること
- cycle 内の main action と secondary motion の relationship

Useful for:

- hand-drawn / exposure-based animation における repeat unit の production evidence
- `hand-drawn-animation` と `loop-animation` の境界確認

Avoid copying:

- exact drawing count / exposure count を universal cycle length にしない
- walk cycle の anatomy を generic graphic loop へ移植しない

## Production artifacts

### BUCK — Spark Arena Byte

- https://buck.co/work/spark-arena-byte

Observe:

- narrative が intro / outro / middle looping segments に分割されていること
- middle loop が live duration を吸収し、milestone に応じて別 sequence へ移れる構造
- multi-screen でも story / presence が破綻しないように設計されていること

Useful for:

- **intro → stable loop → exit** が必要な live / interactive artifact
- loop を narrative 全体ではなく state の middle segment として扱う判断
- indefinite duration と explicit state change を両立する構造

Avoid copying:

- snake / game / screen choreography 自体
- 3D production technique を repository-wide rule にしない

### BUCK — WeTransfer Outernet

- https://buck.co/work/wetransfer-outernet

Observe:

- real-time 8K delivery
- modular design system 内で複数の looping background を mix / match していること
-同じ asset が複数 stage で利用されても sequence を一様にしない構造

Useful for:

- ambient loop を reusable module として扱う場合
- loop layer と composition / template の責務を分離する場合
- high-resolution installation で final runtime playback を検証する必要性

Avoid copying:

- specific brand palette / visual vocabulary
- modularityそのものを全 loop artifact の要件にしない

### Cub Studio — Inspector Norse

- https://www.cubstudio.com/inspector-norse

Observe:

- song の methodical build から複数 animated loop を設計していること
- musicians ごとの loop を timeline 上の repeated section に layer していること
- 一つの永遠に同じ loop ではなく、music structure に応じて loop combination が変わること

Useful for:

- music section と loop structure の関係
- nested / layered loops の hierarchy
- repeatable unit を musical phrase / section と対応させる場合

Avoid copying:

- rough animation style や instrument motif を reusable rule にしない
- beat ごとに mechanical sync することを universal rule にしない

## Accessibility / persistent motion

### W3C Media Queries Level 5 — `prefers-reduced-motion`

- https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion

Observe:

- user が non-essential motion の reduction / replacement を request できること
- motion preference が appearance や renderer style ではなく user preference として扱われること

Useful for:

- Web / application 上で persistent ambient loop を提供する場合
- reduced variant / still state の requirement を決める場合

Avoid copying:

- reduced motion = every animation 0ms と固定しない
- authored standalone video の全 motion をこの Web feature だけで評価しない

### W3C WAI — Easy Checks / moving content

- https://www.w3.org/WAI/test-evaluate/preliminary/

Observe:

- automatically moving / blinking / scrolling content が長く続く場合の pause / stop / hide responsibility
- persistent motion が reading / concentration と競合する可能性

Useful for:

- indefinitely running Web / application loops
- decorative motion が content consumption を妨げる surface

Avoid copying:

- standalone exported video の playback controls と Web UI の requirement を混同しない

## Comparison axes

複数 reference を比較するときは次を記録する。

| Axis | Questions |
| --- | --- |
| Repeat unit | property / action / character / layer / scene のどこが一周か |
| Repeat model | forward / ping-pong / accumulating / continuous / intro-loop-outro のどれか |
| Closure | seam で何が invariant になり、何が reset するか |
| Motion continuity | direction / pace / phase / contact / deformation がどう接続するか |
| Semantic stability | 同じ action/state を繰り返してよい区間はどこまでか |
| Entry / exit | loop に入る・抜ける transition が必要か |
| Phase hierarchy | nested loop は同期 / 非同期のどちらで、何が dominant か |
| Repetition visibility | 周回が見えることは問題か、rhythm として意図されるか |
| Effect state | trail / particle / blur / camera / mask が seam をまたぐか |
| Delivery | finite / indefinite / live / export / multi-screen のどれか |
| Accessibility | pause / still substitute / reduced motion が必要か |

## Extracted principles

### Loop は repeated state である

loop の成立条件は「同じ frame に戻ること」ではない。

一周後に viewer が同じ action / state が継続していると解釈できることを先に確認する。state が変わったなら、新しい loop / transition / exit が必要になる。

### Loop mode は meaning を変える

forward repeat、reversal、accumulation、continuous continuation は motion の意味を変える。

software 上で簡単に切り替えられても、artifact 上では別の behavior として検証する。

### Closure は temporal relationship を見る

静止 first / last frame だけではなく、seam 前後の direction、pace、contact、deformation、effect residue を比較する。

意図的な visible reset も許容できるが、reset が accident ではなく rhythm / cut / graphic event として読めることを確認する。

### Entry / exit を middle loop から分離できる

indefinite duration や stateful experience では、intro と outro を every cycle に含めず stable middle loop を独立させると、duration と state transition を切り離せる。

### Repetition は hierarchy を露出させる

複数 loop が同じ周期・同じ phase で動くと、意図せず全画面が一つの pulse に見える場合がある。

sync が必要なものと independent なものを区別し、period / phase を arbitrary variation ではなく hierarchy から決める。

## Failure modes

- loop API を適用しただけで closure を確認しない
- first/last appearance だけ合わせ、velocity / direction / contact の hitch を見逃す
- ping-pong の endpoint reversal が action の意味に合っていない
- intro / impact / reveal を毎周再演して semantic emphasis を失う
- cycle の途中で intention / direction / state が変わっている
- nested loops がすべて同時 reset し、mechanical pulse になる
- seam を隠すため effects / particles / camera shake を増やす
- background loop が本文・UIより attention を取り続ける
- long-running loop を一周だけ見て完了にする
- source timeline だけ確認し、export/runtime での duplicated pause / drift / sync failure を見ない

## Verification target

最低限、一つの representative artifact で次を試す。

1. repeat unit と repeat model を明文化する
2. normal speed で 3 周以上再生する
3. seam 前後を frame / scrub で往復する
4. stateful artifact は intro → loop → arbitrary-duration exit を試す
5. nested loop があれば phase / sync relationship を確認する
6. final export / runtime でも同じ seam behavior か確認する
7. long-running surface では pause / reduced-motion / visibility behavior を確認する

実 project trial では、「seam が見えない」だけではなく **repetition が artifact の意味を壊していないか**を記録する。
