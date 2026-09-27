---
name: material-design
description: >
  Material 3 / Android の current design system に沿って application UI を適応するときに使用する。
  Material を見た目の preset として模倣せず、component role、semantic theming、adaptive layout、
  system integration、input/accessibility behavior を current product へ翻訳する。
---

# Material Design

Material 3 を「丸い card・大きい radius・Google 風 color」の style filter として使わない。

この Skill は **Material / Android platform-system adaptation** を担当する。underlying design problem は既存 domain Skill を優先し、その結果を Material の component / theme / adaptive / system convention へ翻訳する。

## When to use

次のような task で使用する。

- Android / Material 3 を主要 UI system とする app を新規設計・再設計する
- 独自 design system を Material component behavior と共存させる
- handset-only UI を tablet / foldable / desktop-size window へ適応する
- Material 2 / legacy UI から current Material 3 へ design migration する
- Material 3 Expressive の current direction を product に取り込むか判断する

単なる Web UI、Google 製品の見た目コピー、Compose API の使い方説明には使用しない。

## Responsibility boundary

この Skill を domain Skill の代わりにしない。

- `navigation-design`: destination / hierarchy / orientation の構造
- `responsive-design`: general reflow / breakpoint / container adaptation
- `interaction-states`: focus / selected / pressed / disabled 等の state semantics
- `keyboard-interface`: keyboard focus movement / composite-widget operation
- `touch-interface`: touch target / gesture / direct manipulation
- `color-system`: semantic color-role architecture
- `typesetting` / `font-mixing`: typography composition
- `motion-system`: motion purpose / timing / reduced-motion policy
- `accessibility-audit`: broad conformance / rendered re-test
- `iconography-system`: icon family / metaphor / optical consistency

`material-design` が所有するのは、これらの判断を **current Material / Android convention と system behavior へどう適応するか** である。

## Workflow

1. current product / task / information architecture を確認する。
2. current Material / Android reference を実際に開き、status と version を確認する。
3. component role、theme role、window context、input context、system UI integration を観察する。
4. default Material と product-specific adaptation を分離する。
5. phone layout を拡大するのではなく、content relationship に応じて adaptive presentation を決める。
6. standard component が semantic fit する場合は優先し、custom component は理由を明示する。
7. Material 3 Expressive の shape / motion / typography / color は役割がある場合だけ使う。
8. representative device/window/input/theme で delivered artifact を検証する。

## Observe

reference を開いたら、少なくとも以下を比較する。

### Product / surface assumptions

- handset / tablet / foldable / desktop-size window / Wear のどれを前提にしているか
- touch-only か、keyboard / pointer も想定しているか
- single-pane / multi-pane のどちらが task relationship に合うか
- edge-to-edge / system bars / cutout / hinge / posture が content にどう影響するか

### Component roles

- component が担う semantic role
- emphasis の序列
- navigation / action / selection / input / container の責務
- standard behavior と product-specific behavior の境界
- component variant を見た目ではなく task priority で選んでいるか

### Theming

- primary / secondary / tertiary / surface / container / on-* role の使い分け
- light / dark transformation
- dynamic color と product brand color の関係
- typography role と product hierarchy の対応
- shape が hierarchy / grouping / state / brand expression のどれを担うか
- elevation が shadow だけでなく tonal relationship として扱われているか

### Adaptive structure

- window size / posture が変化したとき、何を reflow し、何を reveal / persist / split するか
- navigation bar / rail / drawer 等の切り替えで destination semantics が保たれているか
- list-detail / supporting pane / feed 等の canonical relationship が actual information model と一致するか
- extra space が単なる whitespace ではなく task efficiency / context preservation に使われているか

### Expressive layer

- shape variation が relationship / state / hierarchy を強めているか
- motion が continuity / feedback / spatial relation を伝えているか
- typography variation が emphasis を明確にしているか
- color expansion が role を増やしているのか、単に彩度を増やしているだけか
- expressive treatment が interaction readability を壊していないか

## Decision rules

### Material を visual preset として適用しない

「Material らしくする」こと自体を目的にしない。

先に task / hierarchy / state / navigation / adaptation を決め、その意味を Material の role vocabulary と component behavior へ対応させる。

reference 固有の Roboto、corner radius、spacing、color value を universal rule としてコピーしない。

### Standard component first, semantic fit first

standard Material component が task semantics を表現できる場合は優先する。

理由:

- familiar interaction behavior を継承できる
- theme / state / input / accessibility adaptation を得やすい
- current platform change に追従しやすい

ただし standard component が product need を歪める場合は custom component を許可する。

custom にする場合は最低限、次を明示する。

- standard component では不足する product semantic
- focus / selection / pressed / disabled / loading 等の state model
- touch / keyboard / pointer behavior
- light/dark / contrast / typography scaling behavior

### Theme は role を先に決める

色、type、shape を独立した装飾 palette として扱わない。

- color は semantic role と foreground/background pairing を保つ
- typography は information role に対応させる
- shape は grouping / identity / state / expression の目的を持たせる
- elevation は layer relationship を表す

product に必要な subset だけを使ってよい。Material の全 role / type style を無理に消費しない。

### Dynamic color は personalization であり brand replacement ではない

dynamic color が利用可能でも、無条件に全 surface / brand identity をユーザー wallpaper 由来に置換しない。

確認する:

- user personalization を優先すべき surface か
- brand recognition / semantic status color を固定する必要があるか
- dynamic scheme と static brand asset が衝突しないか
- unsupported environment の fallback が成立するか

具体値ではなく role relationship を維持する。

### Adaptive は phone layout の拡大ではない

window が広くなったら margin を増やすだけで終えない。

content relationship に応じて次を検討する。

- navigation を bar → rail → drawer 等へ変える
- hidden detail / supporting context を同時表示する
- repeated navigation を減らす
- input method と reachability を再評価する
- fold / hinge / posture による usable region を分ける

ただし「large screen だから multi-pane」にしない。detail が大きい canvas/media/editor を必要とするなら single-pane の方がよい場合もある。

### Canonical layout は information relationship から選ぶ

- list-detail: collection と selected item の関係を同時に保つ価値がある
- supporting pane: primary task と補助 context / tools を並行して保持する価値がある
- feed: repeated heterogeneous content を browsing する

scaffold API が存在することを採用理由にしない。

### Material 3 Expressive は controlled expansion として扱う

current Material 3 Expressive は Material 3 の拡張であり、別の decorative theme ではない。

shape / motion / type / color の表現量を増やす場合、少なくとも一つを説明できること。

- hierarchy を明確にする
- relationship を示す
- direct manipulation / feedback を強める
- product character を表現する
- form factor の特徴を活かす

説明できない expressive treatment は削る。

Wear の round-screen pattern を phone/tablet にそのまま移植しないなど、form-factor-specific evidence を一般化しない。

## References

詳細な current URL と observation point は [`references/material-platform.md`](./references/material-platform.md) を読む。

最低限、次を current source として確認する。

- Android Developers — Material Design 3 in Compose
- Android Developers — Adapt layouts / Canonical layouts
- AndroidX — Compose Material 3 / Material 3 Adaptive release notes
- Android official Compose / adaptive app samples
- Material 3 Expressive の current platform guidance

## Avoid

- Google app screenshot の pixel clone
- 「Material = rounded card + FAB + bright palette」とする
- default token / radius / spacing の盲目的コピー
- every surface を card/container 化する
- dynamic color を brand color の自動置換として使う
- large screen で handset UI を中央に拡大表示するだけにする
- large screen なら必ず multi-pane にする
- canonical scaffold を information architecture より先に選ぶ
- custom component で platform-standard focus / touch / state behavior を失う
- Expressive を shape morph / spring / saturated color の盛り合わせにする
- Wear / round-screen 固有 pattern を他 form factor の universal Material rule とする
- Compose API 名や parameter value を design source of truth にする

## Verify

source code や component tree の存在だけで完了しない。実際に表示・操作される artifact を確認する。

### Minimum rendered matrix

対象 product に該当する範囲で最低限:

- compact handset window
- medium / expanded window
- resizable large window または tablet / foldable
- light / dark appearance
- dynamic color on/off または product-defined fallback
- touch と keyboard/pointer（対応 product の場合）

### Task verification

同一 representative task を各 context で実行し、次を比較する。

- destination / hierarchy / state meaning が変わっていない
- navigation presentation の変化で current location を失わない
- extra width が task context / efficiency に使われている
- selected / focused / pressed / disabled 等が component variant を跨いでも識別できる
- system bar / edge / inset / hinge で重要 content/action が隠れない
- custom component が standard component 相当の input/accessibility behavior を失っていない
- Expressive treatment を減らしても task semantics が残る

### Final gate

- current Material / Android reference をこの実行で開いた
- version-sensitive source に `Last reviewed` がある
- multiple first-party references / production samples を比較した
- arbitrary sample values を universal rule にしていない
- domain Skill と責務が重複していない
- final artifact を複数 window/context で実物確認した

実 project trial をしていない場合は experimental candidate のままとし、promotion 完了と報告しない。
