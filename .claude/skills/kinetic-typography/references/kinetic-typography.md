# Kinetic Typography — runtime references

Last reviewed: 2026-09-14

この reference は kinetic typography を一つの visual style や After Effects preset として固定するためのものではない。
**text form / temporal behavior / reading / semantic emphasis / audio relationship** を分けて観察し、current artifact に必要な規則だけを抽出する。

## Evidence policy

最低でも以下の異なる evidence を比較する。

1. foundational / established research
2. canonical production artifact または established production analysis
3. current independent work
4. renderer/tool documentation は capability evidence としてのみ使う

一作品・一作家・一 software の motion vocabulary を universal rule にしない。

## Foundational research

### Carnegie Mellon — Kinetic Typography research

https://www.cs.cmu.edu/~johnny/kt/

見る:

- kinetic typography を static typography に「effect」を足したものではなく、**time が text expression に与える作用**として扱っている点
- animated text が emotion、spoken/performed quality、attention を担えること
- design corpus と複数 animation behavior を扱っていること

抽出する:

- form と temporal behavior を別 axis として観察する
- motion の採用理由を semantic / expressive function で説明する

コピーしない:

- historical engine architecture
- demo effect 名
- Java-era tooling assumptions

### UIST archive — The Kinetic Typography Engine

https://uist.acm.org/archive/html/keywords/kwkinetic.html

関連 paper:

- Johnny C. Lee
- Jodi Forlizzi
- Scott E. Hudson
- *The kinetic typography engine: an extensible system for animating expressive text*, UIST 2002

見る:

- moving text を expressive communication として扱う framing
- low-level manipulation を組み合わせて異なる behavior を作る構造

使い方:

engine 自体を模倣せず、「effect を最終 rule にせず behavior を分解する」根拠として使う。

### Scott Hudson — research overview

https://www.cs.cmu.edu/~hudson/research.html

見る:

- emotion / spoken-word qualities / attention と kinetic typography の関係
- static text にない temporal communication の役割

注意:

attention capture は readability / comprehension の保証ではない。

### Barbara Brownie — One Form, Many Letters

https://ojs.meccsa.org.uk/index.php/netknow/article/view/20

DOI:
https://doi.org/10.31165/nk.2007.12.20

見る:

- temporal media により type が **behavior** を持つという整理
- letterform が morph / rotate / deconstruct / reorganize して identity を変化させうること
- static form だけでは time-based typography を十分に記述できないこと

抽出する observation axes:

- position / layout の変化
- letterform 自体の変化
- identity が保たれる区間 / deliberately ambiguous になる区間

fluid behavior を every-project の必要条件にはしない。

## Reading / attention evidence

### Visible Language — Impact of Kinetic Typography on Readers' Attention

https://journals.uc.edu/index.php/vl/article/view/4632

Published: 2021-09-30

見る:

- kinetic typography の sub-category と serial presentation を eye-tracking で比較していること
- temporal type が attention duration に影響する一方、すべての kinetic behavior を同じ reading outcome とみなせないこと

使い方:

- 「動けば読まれる」を rule にしない
- required text は actual normal-speed reading で検証する
- attention と comprehension / legibility を別軸で評価する

### Human Interface Society — motion pattern and expressed emotion

https://www.jstage.jst.go.jp/article/his/14/1/14_9/_article/-char/en

DOI:
https://doi.org/10.11184/his.14.1_9

見る:

- word group と motion pattern の組み合わせによって perceived emotional effect が変化すること
- motion pattern 単独の固定意味では説明できないこと

抽出する:

- linguistic content × motion behavior の congruence
- same motion を異なる語へ機械的に割り当てない

### Japanese Society for the Science of Design — movement / music comparison

https://www.jstage.jst.go.jp/article/jssd/59/0/59_275/_article/-char/en

DOI:
https://doi.org/10.11247/jssd.59.0_275

見る:

- kinetic typography が linguistic / visual function と musical / visual rhythm をまたぐこと
- movement と music の関係を独立して観察する必要があること

抽出する:

- beat sync だけでなく semantic phrase / musical phrase / pause を分けて見る

## Canonical production evidence

### North by Northwest — Art of the Title

https://www.artofthetitle.com/title/north-by-northwest/

作品: 1959
Title design: Saul Bass

見る:

- type movement が background grid / architecture と関係を作っていること
- vertical columns の movement、graphic grid、building facade、live-action transition が composition の論理として接続されていること
- text movement が単独 effect ではなく scene progression と組み合わされていること

抽出する:

- spatial system と typography movement の関係
- transition 前後の visual / semantic continuity

コピーしない:

- grid の具体的見た目
- font / color / direction
- Saul Bass 固有の visual language

### Psycho — Art of the Title

https://www.artofthetitle.com/title/psycho-1998/

1998 recreation / preservation discussion。original Bass sequence の構造を扱う established analysis として読む。

見る:

- lines が type を運び、形成し、分解して去る temporal structure
- score と text fragmentation / tension の関係
- assembly → readable state → disassembly の区間

抽出する:

- readable identity を一度成立させてから fragment する構造
- motion material と text content が同じ visual grammar を共有する方法

コピーしない:

- horizontal/vertical bars そのもの
- horror / suspense の style shorthand

## Current independent production evidence

current work は「現在の標準」を示すものではない。互いに異なる use case を比較し、反復する decision axis と作品固有表現を分ける。

### Yu Li — Good Morning — Kinetic Typography

https://www.behance.net/gallery/243915717/Good-MorningKinetic-Typography

Published: 2026-02-10

作者記述では typography と geometric shapes のみを使い、daily walking route を direction / rhythm / gravity / transition gesture で narrative 化している。

見る:

- phrase movement を spatial journey / map-like narrative へ接続する方法
- door / walking gesture を scene transition motif にする方法
- sound effects / piano と atmosphere change の関係

抽出する:

- kinetic type は lyric/beat sync 以外にも spatial narrative を担える
- transition motif は artifact の subject から導ける

コピーしない:

- walking / door gesture を generic transition にすること

### UZOR motion — Typographic Motion Exploration

https://www.behance.net/gallery/228885031/Loopadelic-Kinetic-Typo

Published: 2025-06-24

作者は timing / scale / movement、fast cuts、looping structures、deliberate pacing を使いながら clarity / readability を維持する意図を記述している。

見る:

- short loop で repeated structure をどう成立させるか
- fast cut と readable phrase の切り替え
- piece ごとに movement vocabulary を変えつつ、一つの piece 内では coherence を作る方法

抽出する:

- loopability と reading window を別々に検証する
- repetition が message を補強する場合と fatigue になる場合を区別する

### Gabrielle O'Byrne — Money On The Dash

https://www.behance.net/gallery/234678283/Money-On-The-Dash-Kinetic-Typography

Published: 2025-09-15

作者は fast-paced text、beat timing、cuts / glitch / energetic movement を song の speed / confidence / risk theme と接続している。

見る:

- high-energy audio に motion density を合わせる方法
- beat sync と lyric/message emphasis の重なり
- high-speed treatment でもどの words を readable anchor として残すか

抽出する:

- high-energy = 全要素 nonstop motion ではない
- intensity は message carrier / phrase boundary に配分する

### Xenia Krotova — Kinetic Typography

https://www.behance.net/gallery/221035983/Kinetic-Typography

Published: 2025-03-10

materially different visual treatments を比較する current independent reference として使う。

見る:

- repeated type / distortion / spatial arrangement の違い
- visual experiment と lexical readability の boundary

一つの experimental treatment を broad rule に昇格しない。

## Current implementation evidence

### Adobe After Effects — Animating text

https://helpx.adobe.com/after-effects/using/animating-text.html

Current documentation reviewed 2026-09-14.

capability evidence:

- animator と selector を分離できる
- character / word / line 単位を選べる
- range / wiggly / expression selector がある
- position / opacity / scale 等を複合できる

translation:

- tool が per-character animation を可能にしても、semantic unit は design decision として先に決める
- selector / preset の構造を motion rationale にしない

### Adobe After Effects — Variable Font Axes

https://helpx.adobe.com/after-effects/using/working-with-variable-font-axes.html

current capability evidence として、weight / width 等の variable axis を text animator と selector で時間変化させられることを確認する。

translation:

- letterform parameter 自体を temporal behavior にできる
- axis animation は fluid-type の選択肢であり、必要条件ではない
- lexical identity / hierarchy / font design intent が崩れる場合は使わない

## Cross-reference matrix

| Question | Strong evidence |
| --- | --- |
| time が typography の meaning に何を追加するか | CMU / Hudson |
| form と behavior をどう分けるか | Brownie |
| attention と readability をどう分けるか | Visible Language |
| word meaning と motion の congruence | Human Interface Society |
| music と motion rhythm の関係 | JSSD |
| spatial system と title motion | North by Northwest |
| assemble / fragment / score relationship | Psycho |
| spatial narrative | Good Morning |
| loop / pacing / clarity | UZOR motion |
| high-energy music / type sync | Money On The Dash |
| renderer が何を可能にするか | Adobe current docs |

## Observation axes

reference ごとに最低限記録する:

- semantic unit: glyph / word / phrase / line / block
- linguistic role: statement / emphasis / response / refrain / label / texture
- initial / readable / exit state
- visible duration / overlap
- spatial path / layout relation
- form change / glyph identity
- hierarchy over time
- old text retention / new text arrival
- audio cue type: speech / lyric / beat / effect / silence
- motion density / pause
- repetition / loop behavior
- final delivery size / aspect
- point where readability intentionally yields to texture / abstraction

## Failure modes

### Preset-first

症状:

- phrase meaning と関係なく同じ bounce / slide / glitch を繰り返す

修正:

semantic unit と motion purpose を先に決める。

### Every-word emphasis

症状:

- 全語が scale / color / motion で強調され、dominant message がない

修正:

key phrase と support phrase の motion intensity を分ける。

### No readable state

症状:

- entry と exit が連続し、required text を認識する区間がない

修正:

normal-speed playback で entry → readable → exit を再設計する。

### Beat-only logic

症状:

- musical beat には合うが、sentence / lyric phrase が不自然な位置で切れる

修正:

semantic phrase、voice accent、music phrase、beat を分けて優先順位を決める。

### Identity loss

症状:

- morph / distortion / travel 中に必要な word が lexical object として追えない

修正:

required reading phase では一つ以上の anchor（position / form / phrase grouping）を安定させる。

### Static-design camouflage

症状:

- motion を止めると hierarchy / alignment / contrast が壊れており、動きで隠している

修正:

representative readable frame と full playback の両方を検証する。

### Style imitation

症状:

- Bass、特定 MV、特定 creator の visual motif を kinetic typography の一般則として使う

修正:

複数 reference から behavior / trade-off を抽出し、current message へ翻訳する。

## Verification prompt

最終 artifact を次の順で見る。

1. normal-speed / sound-on playback
2. normal-speed / sound-off playback（essential text がある場合）
3. message を見ずにもう一度再生し、読む順序が一意に追えるか確認
4. scrub / representative-frame inspection
5. target delivery size で再生
6. alternate aspect-ratio variant がある場合は crop ではなく temporal hierarchy を再確認
7. loop がある場合は seam と repeated-view fatigue を確認

source timeline / keyframes が綺麗でも、delivered video が読めなければ不合格とする。