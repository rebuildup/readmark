---
name: title-sequence
description: >
  Design authored opening, main-title, title-card, and main-on-end sequences as narrative thresholds that integrate credits,
  image, typography, sound, and temporal structure without reducing title design to presets or creator imitation.
---

# Title Sequence

Title sequence を「文字に motion を付ける工程」や「映像の前に置く decoration」として扱わない。

この Skill は、映画・シリーズ・短編・映像作品などの **物語へ入る／物語から出る temporal threshold** を設計するときに使う。credit、title/logo、image、sound、edit、material を、作品の theme・world・perspective と結びついた一つの時間構造へ統合する。

**Inspect → Extract → Translate → Implement → Verify** の順で進める。

## When to use

使う:

- opening / main-title sequence を設計する
- compact な title card が物語上の明確な役割を持つ
- main-on-end / end-title が鑑賞後の意味を再構成する
- episode / season ごとに変化する title system を設計する
- credit と narrative image / typography / sound の関係を設計する

使わない:

- product / service の promo structure → `promotional-video`
- text 自体の temporal semantics / reading behavior → `kinetic-typography`
- layer integration / matte / grain / blur / grade → `compositing`
- interactive UI transition → `motion-system`

## Workflow

1. **Inspect** surrounding narrative、brief、credit list、music/sound、delivery context と複数の relevant title references を実際に見る。
2. **Extract** sequence が担う narrative job と、reference 間で反復する temporal / typographic / image / sound relationship を比較する。
3. **Translate** creator 固有の look ではなく、concept・motif・progression・credit behavior を current work へ翻訳する。
4. **Implement** 最小の sequence grammar を作り、必要な production technique だけを選ぶ。
5. **Verify** full playback と frame inspection の両方で、credit readability と narrative effect を確認する。

## Observe

reference を比較するときは以下を見る。

- **narrative position** — opening / main title / compact card / main-on-end のどこにあるか
- **sequence job** — tone、world、theme、character perspective、foreshadowing、after-story reinterpretation の何を担うか
- **conceptual motif** — 何が繰り返され、どう変形・発展するか
- **image-source grammar** — abstraction、live action、object/material、archive/editorial、illustration、type-led のどれを使うか
- **credit hierarchy** — grouping、order、scale、placement、reading window、background competition
- **title/logo reveal** — いつ出るか、何を区切るか、前後の情報量との関係
- **type–image relationship** — overlay、embedded、perspective-matched、object-like、independent layer のどれか
- **temporal architecture** — setup、development、escalation、reveal、transition の流れ
- **edit / camera relationship** — cut、continuous move、match、contrast、repetition、hold
- **sound relationship** — cue、rhythm、counterpoint、ambient tension、silence
- **material/process visibility** — paper、optical、film、handmade、screen、archive 等の質感が意味を担うか
- **boundary** — first/last narrative shot へどう接続するか

## Decision rules

### 1. 先に sequence の narrative job を一文で決める

visual style を決める前に、sequence が何をするかを一文で書く。

例:

- 世界のルールを直接説明せず、ある motif の変化から予感させる
- protagonist の視点を material / edit grammar として体験させる
- 本編後に public reaction / archive / evidence を提示して物語を再解釈する
- 強い opening sequence を作らず、短い title card で勢いを壊さず threshold だけ作る

「かっこいい opening」「cinematic」「premium」だけでは開始しない。

### 2. opening / title card / main-on-end を同じ型にしない

位置によって観客が持つ情報量が違う。

**Opening / main title**

- audience がまだ物語を知らないことを前提にする
- explanation より tone / question / motif / world の導入を優先できる
- spoiler になる情報を literal に開示しない

**Compact title card**

- narrative momentum を止めずに identity / threshold を作る
- elaborate sequence が不要な作品へ無理に尺や credit choreography を足さない

**Main-on-end / end title**

- audience がすでに story context を持つ
- evidence、aftermath、public response、motif の変形などで再解釈できる
- opening と同じ reveal logic を機械的に再利用しない

### 3. motif は appearance ではなく transformation rule として定義する

良い motif は「何が見えるか」だけでなく「時間とともにどう振る舞うか」を説明できる。

例:

- grid が abstract field → architecture → lived environment へ変わる
- fragmented letterform が徐々に identity を獲得する
- thread / document / object が story-world の関係を組み立てる
- archival headline が post-story public narrative を構成する

reference 固有の grid、scratch、film burn、thread、double exposure そのものをコピーしない。

### 4. credit は必要情報であり、texture ではない

credit を decorative microtype や motion texture に変えない。

各 credit で確認する:

- 何を読む必要があるか
- どの grouping / hierarchy か
- background の detail / contrast / motion と競合していないか
- normal playback で読む時間があるか
- position / perspective / movement に narrative justification があるか

credit list が長い場合、全 credit を同じ visual emphasis にしない。ただし hierarchy を理由に required credit を判読不能にしない。

### 5. type と image の関係を意図的に選ぶ

**Overlay**

image と credit が別 layer として成立する。background motion / contrast を抑え、読みやすさを守る。

**Embedded / situational**

type が architecture / object / perspective と関係する。novelty のためではなく、world / spatial motif と一致するときに使う。

**Object-like type**

type 自体が material / image event として変形する。essential credit は transformation 中だけでなく readable state を確保する。

**Type-led**

image を減らし、letterform / spacing / reveal / edit が主役になる。effects の量ではなく文字の structure と timing で成立させる。

### 6. title/logo reveal を「一番派手な瞬間」と決めつけない

title reveal は sequence の structural beat として置く。

候補:

- motif が初めて完成する地点
- tension の一度目の解放
- abstract world から narrative world へ切り替わる地点
- main-on-end で interpretation が確定する地点

logo に glow / scale / particle を最大量足すことを reveal としない。

### 7. progression と repetition を分ける

sequence が発展するなら、各 section が何を追加・変化させるかを説明できるようにする。

同じ shot grammar / credit reveal / camera move を繰り返す場合は、反復が ritual、obsession、system、cycle 等の意味を持つか確認する。

尺を埋めるための同型 shot の連続は避ける。

### 8. sound は decoration ではなく構造 evidence として扱う

music / sound を見てから visual timing を決めるが、全 beat へ mechanically cut / flash しない。

確認する:

- major cue が section boundary と一致するか
- visual reveal が sound より先行 / 同時 / 遅延する意味は何か
- ambient sound や silence が tension を支えるか
- credit readability を速い beat synchronization が破壊していないか

composer / sound team と並行する場合、visual cue が music のための有効な timing scaffold になることもある。

### 9. production technique は concept の後に選ぶ

2D animation、live action、handmade material、optical treatment、compositing、CG-derived asset、continuous camera 等は renderer / production choice。

「その tool が使える」ことから concept を逆算しない。

同じ narrative rule を別 technique でも成立させられるかを一度考える。成立しないなら、その material/process が意味を担っている理由を明示する。

### 10. surrounding narrative との boundary を設計する

opening sequence 単体の beauty reel を作らない。

確認する:

- cold open → title へ何を引き継ぐか
- title → first narrative shot で pace / sound / color / direction がどう変わるか
- end scene → main-on-end で emotion を壊さないか
- skip intro / platform chrome が存在しても最初の数秒で重要情報を失わないか

## Responsibility boundaries

### `title-sequence`

owns:

- narrative threshold / sequence job
- concept / motif progression
- opening vs title-card vs main-on-end structure
- credit–image–sound temporal composition
- title/logo reveal
- sequence ↔ narrative boundary

### `kinetic-typography`

owns:

- glyph / word / phrase / line の temporal behavior
- reading window
- typographic semantic motion

### `compositing`

owns:

- matte / alpha / blend
- edge / grain / blur / glow
- color integration
- final composite treatment

### `hand-drawn-animation` / `limited-animation`

own drawing construction and motion-allocation decisions.

### `promotional-video`

owns hook / promise / proof / CTA を中心とする promotional communication structure.

### `motion-system`

owns interactive product/UI motion.

## References

実装前に [`references/title-sequence.md`](./references/title-sequence.md) を開き、少なくとも canonical / historical と materially different current production の両方を比較する。

reference の creator 固有 vocabulary を clone せず、sequence job、motif、credit behavior、temporal structure を抽出する。

## Avoid

- 「Saul Bass風」「Se7en風」「Imaginary Forces風」を style command にする
- credit を unreadable texture にする
- every credit に同じ reveal preset を使う
- opening / main-on-end の役割差を無視する
- logo reveal を effects maximum にする
- footage がないからという理由だけで abstract particles を使う
- narrative concept と無関係な film grain / scratch / light leak を authenticity とみなす
- music の every beat へ cut / scale / flash を同期する
- title sequence 単体では成立するが first/last narrative shot と感情的に切断する
- tool tutorial / template の手順を design rule にする

## Verify

source project の完成ではなく、**final playback artifact** を確認する。

### Full playback

- surrounding narrative shot を含めて beginning-to-end で見る
- normal playback で concept / motif の progression が理解できるか
- credit を止めずに読めるか
- title reveal が structural beat として機能するか
- sound と visual の関係が mechanical すぎないか
- repetitive shot grammar が意味なく続かないか

### Frame / scrub inspection

- representative credit frames の contrast / safe area / hierarchy
- embedded / perspective type の geometry と readability
- cut / dissolve / material transition の discontinuity
- logo/title の completion frame
- first/last narrative frame との visual boundary

### Stress cases

- target delivery resolution / viewing size
- compression 後の thin type / texture / shadow detail
- subtitles / platform overlays / skip controls がある delivery context
- long / short person names と役職差
- localization が必要なら representative translated credit / title treatment
- episodic variants がある場合、共通 system と episode-specific motif の両方

### Completion gate

次を満たすまで completed としない。

1. sequence の narrative job を一文で説明できる
2. motif / image grammar / credit behavior / sound relationship がその job とつながる
3. full playback で required credits が読める
4. title reveal と sequence boundary が surrounding narrative を支える
5. final exported artifact を実際に再生して確認した
