# Music Visualization Video — Runtime References

Last reviewed: 2026-09-14

この reference は、music visualization を単一の waveform / FFT / beat-reactive preset として定義せず、**music と visual form の correspondence を複数の成立モデルから比較する**ために使う。

実作業では一作品を style source としてコピーせず、canonical/historical reference と複数の current production work を比較する。

## Canonical / historical visual music

### Center for Visual Music — Visual Music films / Oskar Fischinger, Study No. 7

https://www.centerforvisualmusic.org/VMFilms.htm

Observe:

- `Study No. 7` で sharp / fast rhythmic material と hard-edged form、violin passage と softer solid form がどう対照化されているか
- musical character と visual material / edge / spatial behavior の関係
- individual shape より、time 上の recurring / developing construct がどう全体を作るか
- 同ページに sound / silent visual-music works の両方があること

Useful for:

- visual music を signal-driven visualization より広い歴史的 practice として理解する
- rhythm と timbre / articulation を別々の observation axis にする

Avoid copying:

- Fischinger 固有の幾何形態、exact timing、charcoal/cel treatment
- historical work の form vocabulary を current project の style preset にすること

### Canadian Film Encyclopedia / TIFF — Norman McLaren & Evelyn Lambart, Begone Dull Care

https://cfe.tiff.net/canadianfilmencyclopedia/content/films/begone-dull-care

Observe:

- Oscar Peterson Trio の music を visual expression / interpretation として扱っていること
- musical phrase の length を shot のような visual unit として使っていること
- mood / style / texture の shift が rhythm とどう関係するか
- music と image が後付けではなく相互作用する composition として説明されていること

Useful for:

- phrase-level duration
- macro-form before micro-sync
- music と visual scene/gesture unit の対応

Avoid copying:

- direct-on-film texture を universal grammar にすること
- jazz だから specific mark-making を使う、といった genre stereotype

Supporting primary artifact:

https://collection.nfb.ca/film/caprice-en-couleurs

National Film Board of Canada collection page。利用可能な環境では完成作品と production description を確認する。

## Current production / independent works

### Ordinary Folk — Nightdrive

https://www.ordinaryfolk.co/project/nightdrive

Year: 2024

Observe:

- abstraction / simple shapes / light / color が music と「night drive」の perceptual mood をどう共有するか
- exact note/event encoding ではなく associative environment として成立していること
- visual palette と motif が短い effect collection ではなく一つの experiential state を保つこと

Useful for:

- associative music-image relationship
- stable atmosphere / visual vocabulary
- music visualization と literal data visualization の境界

Avoid copying:

- wet-road / streetlight imagery
- specific color treatment、blur language、shape design

### MULTRA / Eizo100 — spherephony

https://eizo100.jp/en/video/89859

Supporting production page:

https://multra.jp/work/0065/

Year: 2024

Observe:

- project が sonic texture と visual texture の harmonization を明示的な目的にしていること
- sphere の journey が異なる sound encounter を通じて visual progression を作ること
- one recurring owner が異なる musical / sonic state を通過することで identity と variation を両立する構造
- abstract audiovisual relation と loose spatial/narrative progression の境界

Useful for:

- timbre / texture relationship
- recurring visual owner
- section development without simple every-beat reaction

Avoid copying:

- sphere protagonist
- landscape progression、exact material、3D rendering language

この repository の scope は2D graphic design。reference の3D surface/styleではなく、music-image structural relationship のみを抽出する。

### Antiantiart — O_O Album Visualizer

https://www.antiantiart.com/project/o_o-album-visualizer

Year: 2025

Observe:

- hand-drawn visual language が music と並走しながら独自の visual rhythm を持つこと
- conventional storyline ではなく emotional states / visual ideas を移動する構造
- album の inner world の visual extension として一貫性を持つこと
- illustration / scribble / handwritten word が同じ family に属しつつ変化すること

Useful for:

- associative full-song / album visualization
- visual vocabulary continuity
- emotional / sectional progression

Avoid copying:

- hand-drawn sketchbook look 自体
- artist-specific lettering、illustration、character、asset

歌詞の文字が data-bearing / readable lyric として主要責務になる場合は `lyric-video` を併用する。

### Chris May — Transmissions

https://heychrismay.com/projects/transmissions

Year: 2025; screenings/exhibitions continue in 2026

Observe:

- visuals と audio が同じ source から生まれる sound-generated animation という boundary case
- structure / chaos、abstract form / fleeting face の tension
- generative relation が visual-music composition の一部になっていること

Useful for:

- `audio-reactive-video` と `music-visualization-video` の境界確認
- signal-generated technique が broader audiovisual composition に組み込まれる場合

Avoid copying:

- exact generative process
- face motif / black-background treatment
- signal-generated = musical-form interpretation と自動的にみなすこと

signal analysis / response envelope / normalization / latency の設計自体は `audio-reactive-video` を canonical source とする。

## Comparison axes

複数 reference を次の軸で比較する:

| Axis | Questions |
| --- | --- |
| Musical scale | gesture / phrase / section / full piece のどこを visual unit にしているか |
| Correspondence level | signal / event / structural / material / associative のどれか |
| Phrase duration | musical phrase と visual gesture / scene duration に関係があるか |
| Recurrence | repeated material の visual identity は何が残り、何が変わるか |
| Layer ownership | melody / rhythm / texture / overall form のどれが primary visual owner か |
| Timbre / articulation | edge / material / continuity / density / deformation へどう翻訳されるか |
| Density / silence | sparse / sustained / silent state がどう扱われるか |
| Development | buildup / contrast / climax / release が long-range visual change にどう反映されるか |
| Micro-sync | exact hit / pulse sync はどこで必要で、どこでは不要か |
| Vocabulary | piece 全体を結ぶ stable form / palette / material / spatial logic は何か |
| Ending | musical closure / tail と visual closure がどう対応するか |

## Translation prompts

reference を見た後、current artifact について記録する:

```text
musical observation:
perceptual / structural interpretation:
visual owner:
visual property:
time scale:
retained property on recurrence:
changed property on recurrence:
sync requirement:
failure risk:
```

複数 section についてこれを比較し、reference固有表現ではなく repeated decision logic のみを current project へ翻訳する。

## Failure references / contrast cases

以下は必ずしも bad work ではないが、別責務として比較する:

- waveform / spectrum / beat-reactive system → `audio-reactive-video`
- piano-roll / falling notes / MIDI event view → `midi-video`
- karaoke / lyric-led animation → `lyric-video`
- album / single teaser campaign → `music-promo-video`

これらが同じ artifact に共存していても、どの layer が何を担っているかを分けて検証する。
