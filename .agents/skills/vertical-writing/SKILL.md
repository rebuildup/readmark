---
name: vertical-writing
description: >
  Design and verify Japanese/CJK vertical composition as a reading and page-flow system, including
  column progression, mixed-script orientation, tate-chu-yoko, annotations, mixed orientations, and safe fallbacks.
---

# Vertical Writing

縦書きを、横組みを90度回転した visual effect として扱わない。

**Inspect → Extract → Translate → Implement → Verify** を順に実行する。

この Skill は、縦組みを採用する artifact で **文字の進行、行・段の進行、ページ/画面の読書経路、文字向き、縦中横、横組み領域との関係**を一体で設計する。

一般的な文字 hierarchy / measure / line breaking は `typesetting`、書体の混植は `font-mixing`、locale/script adaptability は `internationalization-design`、一般的な paginated artifact は `document-design` を canonical source とする。

## When to use

次のような場合に使用する。

- 日本語・中国語・韓国語の縦組み本文、editorial、書籍、雑誌、ポスター、タイトル
- 縦書きと横書きが同じ page / spread / screen に共存する composition
- 数字、Latin acronym、英単語、記号を含む縦組み
- 縦中横、ruby、注記、caption、running element を含む組版
- Web / EPUB / document renderer で縦組み capability を確認する必要がある場合

縦書きが project requirement ではなく「日本らしさ」の装飾として提案されているだけなら、まず horizontal composition のまま目的を満たせないか確認する。

## Workflow

1. **Inspect** artifact の言語、媒体、読書距離、page/screen progression、既存 typography、renderer capability を確認する。
2. **Extract** reference から inline progression、column progression、glyph orientation、mixed orientation、annotation、page structure の規則を比較する。
3. **Translate** reference 固有の書体・版面寸法・出版社表現をコピーせず、current artifact の情報構造へ翻訳する。
4. **Implement** vertical principal writing mode と必要な horizontal sub-runs / regions を最小限に組み合わせる。
5. **Verify** 実際の mixed-script content と最終 renderer で page/screen を確認する。

## Observe

### Reading progression

- 文字が行内でどちらへ進むか
- 次の行/段がどちらへ進むか
- page / spread / carousel / scroll がどちらへ進むか
- heading、caption、folio、running head がその progression を補強しているか
- visual placement と logical reading order が矛盾していないか

日本語の一般的な縦組みでは、文字は上から下へ進み、行/段は右から左へ進む。ただし page progression は媒体・binding・reader UI の責務も含むため、CSS の writing mode だけから自動決定しない。

### Glyph orientation

- Han / Kana / Hangul が upright で読めるか
- Latin word / sentence は sideways の方が自然か
- acronym / short Latin run は upright の方が識別しやすいか
- punctuation / brackets / prolonged sound marks 等が vertical form へ適切に変わるか
- renderer / font が vertical glyph substitution を持つか

Unicode の default orientation は reliable fallback だが、editorial intent を自動決定する規則ではない。

### Horizontal-in-vertical

- 2–3桁程度の数字、短い日付、initialism を縦中横にする意味があるか
- 一文字分の幅へ押し込んだ結果、glyph が極端に圧縮されていないか
- `10,000` のような punctuation を含む値が途中だけ combine されていないか
- 長い英単語や数値列を縦中横にしていないか

### Text area / columns

- 一段の文字数・視線移動距離
- 段数 / column count
- 行間と段間の区別
- character size と page/screen size の関係
- margins / surrounding whitespace
- image / figure / table が column progression を阻害していないか

横組みの「line measure」をそのまま90度置き換えず、縦方向の読み距離と右→左の段移動を実表示で確認する。

### Mixed orientation regions

- horizontal chart/table/code/URL を縦組みへ無理に変換していないか
- 横組み region を挿入した場合、どこから読み始め、どこへ戻るか分かるか
- figure / image 自体を回転していないか
- caption の orientation が figure と本文の関係を明確にしているか
- horizontal UI control が vertical reading flow を破壊していないか

### Annotation and secondary text

- ruby が本文を押し潰さず対応関係を保つか
- 注記、脚注、傍注、caption、folio の位置が本文 progression と衝突しないか
- heading が本文と同じ orientation を取るべきか、contrast として horizontal treatment が必要か
- secondary text が小さすぎる・過密になっていないか

## Decision rules

### 1. Vertical writing is a composition mode, not a rotation effect

container 全体を transform で回転して縦書きに見せない。

縦組みでは glyph orientation、punctuation、line progression、logical dimensions、selection/caret、annotation 等が変わる。renderer が principal writing mode を理解できる方法を使い、見た目だけ回転させない。

### 2. Separate inline, column, and page progression

次の3つを別々に確認する。

1. inline: 一行内で文字を読む方向
2. block/column: 次の行・段へ移る方向
3. page/surface: 次ページ/次画面へ移る方向

一つを決めたから他も同じ方向になると仮定しない。

### 3. Prefer default vertical orientation, then override intentionally

CJK glyph の default orientation と vertical alternates を尊重する。

個別 override は、acronym、short foreign run、title treatment 等で意味・可読性が改善する場合だけ行う。

Latin をすべて upright、またはすべて sideways にする global rule を作らない。

### 4. Tate-chu-yoko is for compact reading units

縦中横は短い run を縦組みのリズム内で素早く認識させるために使う。

適用候補:

- 2–3桁程度の数字
- 短い月日/時刻表現
- 短い acronym / symbol run

避ける:

- 長い数値
- punctuation で分割される値へ blanket application
- 長い英単語
- squeezing しないと一文字幅に入らない run

実装 capability が不十分なら、専用 markup で意図した run だけを対象にするか、通常の vertical orientation / horizontal sub-region を選ぶ。

### 5. Keep inherently horizontal artifacts horizontal when needed

chart、code、URL、wide table、Latin-heavy technical block などは、縦組み本文の中でも horizontal region の方が意味を保てる場合がある。

「ページが縦書きだから全要素を縦にする」を rule にしない。

切替点では reading order と復帰位置を明確にする。

### 6. Compose page relationships, not isolated paragraphs

縦組み本文だけを成立させて完了しない。

heading、figure、caption、folio、running element、notes、columns の関係まで含めて page/screen を確認する。

縦組みでは右側が reading start 側になりやすいため、横組みで成立していた visual hierarchy の左右配置を機械的に維持しない。

### 7. Treat renderer support as evidence, not theory

仕様に存在する機能でも current renderer で十分に動かない場合がある。

実装前に対象 browser / EPUB reader / document renderer で最低限確認する。

- basic vertical flow
- mixed Latin/CJK orientation
- tate-chu-yoko
- ruby / annotations
- forms / selects（interactive artifact の場合）
- tables / figures
- font fallback

required behavior が壊れる場合は、horizontal fallback、simpler control、別 region を選ぶ。仕様上可能であることだけを completion evidence にしない。

## Responsibility boundaries

### `typesetting`

一般的な hierarchy、text role、measure、line-height、paragraph rhythm、Japanese line breaking、numeric/table text composition を担当する。

`vertical-writing` は principal writing mode が vertical になったことで生じる progression / orientation / mixed-region / annotation / page relationship を担当する。

### `font-mixing`

Japanese / Latin / numeral family の apparent size、weight、baseline、glyph coverage を担当する。

この Skill は、それらの文字列を縦組み内で upright / sideways / combined / horizontal region のどれとして配置するかを担当する。

### `internationalization-design`

language / locale / region / direction variation へ product structure が耐えられるかを担当する。

この Skill は、vertical composition が artifact requirement として選択された後の具体的な縦組みを担当する。

### `document-design`

general document hierarchy、page break、figure/table structure、export semantics を担当する。

この Skill は縦組み固有の page/column progression と mixed-orientation composition を担当する。

## References

実装前に [`references/vertical-writing.md`](./references/vertical-writing.md) から対象媒体に relevant な primary source を開く。

reference の exact page dimensions、font、publisher-specific treatment をコピーしない。

## Avoid

- horizontal layout を90度回転して縦組みにする
- 「和風」に見せるためだけに長文 UI を縦書き化する
- CJK / Latin / number / symbol を全部同じ orientation に固定する
- すべての数字へ blanket に縦中横を適用する
- long URL / code / table を読めない vertical treatment にする
- image / chart 自体を本文と一緒に回転する
- CSS/property support を実 renderer で確認せず production-ready とする
- unsupported control を visual trick で縦に見せて keyboard/input behavior を壊す
- 横組みと縦組みの切替後に reading order を確認しない
- 一枚の静止 screenshot だけで multi-page / scroll progression を検証する

## Verify

source code や authoring view ではなく、最終 representation を確認する。

### Mixed-content sample

最低限、実 content または realistic sample に次を含める。

- 日本語本文と約物
- 1–4桁程度の数字
- punctuation を含む長い数値
- Latin acronym
- Latin word / sentence
- ruby / annotation（artifact が使う場合）
- figure + caption
- horizontal sub-region（必要な場合）

### Render matrix

対象媒体に応じて複数条件で render する。

- representative page / screen size
- narrow / wide または small / large page variant
- primary font + realistic fallback
- Web の場合は主要 target browser/engine
- paged media の場合は連続した複数ページ/スプレッド

### Visual / reading pass

- first reading point が分かる
- column progression が自然に追える
- punctuation / brackets / prolonged marks が不自然に横向きになっていない
- Latin / numbers の orientation が content type に合う
- 縦中横が潰れていない
- mixed horizontal region へ入り、本文へ戻れる
- heading / caption / notes / folio の関係が読める
- figure/table が reading path を分断しない
- clipping / overlap / unintended rotation がない

### Interaction pass

interactive vertical artifact ではさらに確認する。

- text selection / caret / copy が自然に機能する
- focus order と visual reading order が大きく矛盾しない
- form/control text が renderer capability の範囲で読める
- keyboard / pointer で task を完了できる
- unsupported feature には usable fallback がある

### Completion gate

次を満たさなければ完了扱いにしない。

- vertical writing を aesthetic rotation ではなく reading/composition system として扱った
- inline / column / page progression を確認した
- mixed-script orientation と縦中横を real content で確認した
- mixed vertical/horizontal region の reading order を確認した
- target renderer で実物を確認した
- fallback / unsupported behavior を明示した
- real artifact trial 未実施なら experimental のまま保持する

Last reviewed: 2026-09-13
