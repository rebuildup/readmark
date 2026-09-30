# Limited Animation References

Last reviewed: 2026-09-17

Limited animation を low-frame-rate preset として扱わず、**motion allocation / hold / reuse / substitution / partial movement / cycle / selective redraw** の組み合わせとして観察するための runtime reference。

一つの studio / era / production model から universal rule を作らない。historical stylization、weekly television production、cut-out production、current authoring implementation を比較し、現在の artifact へ必要な principle だけを翻訳する。

## Historical / production evidence

### UPA / `Gerald McBoing-Boing`

- [Library of Congress — National Film Registry descriptions and essays](https://www.loc.gov/programs/national-film-preservation-board/film-registry/descriptions-and-essays/)
  - Observe: `Gerald McBoing-Boing` に見られる、live-action realism の再現から離れた graphic abstraction、simplified shapes、composition と motion の分業。
  - Useful for: drawing detail / movement density を増やすことと expressive animation quality を切り離して考える。
  - Avoid copying: UPA 固有の character、palette、background treatment、mid-century visual vocabulary。

### `Astro Boy` / Mushi Production

- [Tezuka Osamu Official — Astro Boy (Animation)](https://tezukaosamu.net/en/anime/30.html)
- [Tezuka Osamu Official — Mighty Atom](https://tezukaosamu.net/en/manga/291.html)
- [Tezuka Osamu Official — 1960s history](https://tezukaosamu.net/en/about/1960.html)
  - Observe: 1963 年開始の30分 television series、weekly broadcast、長期 episode production という production context。
  - Useful for: theatrical full-animation assumptionsを weekly television production へそのまま適用しないこと、shot 単位で motion effort を配分する必要性を考える。
  - Avoid copying: historical production constraint を現代の「正しい frame 数」や一律の drawing cadence として固定すること。

## Cut-out / reusable-asset evidence

### Norman McLaren — `Le merle`

- [National Film Board of Canada — Le merle](https://collection.nfb.ca/film/le_merle)
  - Observe: simple cardboard cut-outs、geometric parts、music と visual change の関係、full redraw 以外で成立する motion construction。
  - Useful for: reusable graphic parts と temporal composition の関係。
  - Avoid copying: exact cut-out silhouette、folk-art treatment、music-specific timing。

### Evelyn Lambart — `Fine Feathers`

- [National Film Board of Canada — Fine Feathers](https://collection.nfb.ca/film/fine_feathers)
  - Observe: cut-out asset の pose / position / replacement、言葉に依存しない visual action の明瞭さ。
  - Useful for: sparse / replacement-based animation でも action meaning を visual に保持する判断。
  - Avoid copying: specific character shapes、palette、paper/cut-out aesthetic。

### Evelyn Lambart — `The Story of Christmas`

- [National Film Board of Canada — The Story of Christmas](https://collection.nfb.ca/film/story_of_christmas)
  - Observe: zinc cut-outs、layered movement、held regions と moving regions、composition / narration / timing の関係。
  - Useful for: material reuse と scene readability を別々に検証する。
  - Avoid copying: religious imagery、specific production material、scene composition。

## Current production implementation evidence

Tool documentation は「可能な操作」の evidence であり、design source of truth ではない。exact control / version-specific UI を Skill の universal rule にしない。

### Drawing substitution and exposure

- [Toon Boom Harmony 25 — About Swapping Drawings](https://docs.toonboom.com/help/harmony-25/advanced/cut-out-animation/about-swap-drawing.html)
  - Observe: one layer が multiple hand / mouth / pose drawings を持ち、exposure 区間ごとに drawing を substitute できること。
  - Useful for: substitution と hold / exposure を別の decision として扱う。
- [Toon Boom Harmony 25 — Swapping Drawings in the Library View](https://docs.toonboom.com/help/harmony-25/essentials/cut-out-animation/swap-draw-library-view.html)
  - Observe: exposed drawing identity が frame/span 単位で変わる implementation model。
  - Useful for: pose library / replacement workflow の evidence。
- [Toon Boom Harmony 25 — About Key Exposures](https://docs.toonboom.com/help/harmony-25/premium/cut-out-animation/about-key-exposure.html)
  - Observe: drawing identity を変えず exposure block を分けられること、substitution boundary と exposure boundary が同一概念ではないこと。
  - Useful for: held image、replacement point、timing boundary を分離して考える。

### Drawing motion vs transform motion

- [Toon Boom Harmony 25 — Disabling Layer Animation](https://docs.toonboom.com/help/harmony-25/premium/motion-path/disable-layer-animation.html)
  - Observe: drawing exposure と transform/keyframe animation を分離して管理できること。
  - Useful for: redraw/substitution と transform motion を同じ change type に潰さない。

## Compare across references

reference を開いたら、少なくとも次を比較する。

| Axis | Questions |
| --- | --- |
| motion ownership | どの object / body part / camera change が scene meaning を運ぶか |
| hold | 何が静止し、静止が timing / emphasis として機能しているか |
| change type | redraw / substitution / transform / cycle / camera / cut のどれを使うか |
| density contrast | dense motion と sparse interval がどこで切り替わるか |
| reuse | pose / part / cycle / background reuse がいつ意図として見え、いつ repetition error になるか |
| attachment | held region と moving region の seam / pivot / silhouette / volume が保たれるか |
| audio/edit | sound / dialogue / cut が sparse motion を補完するか、必要な visual information を隠していないか |
| entry/exit | cycle / reused pose / hold への入りと抜けで discontinuity がないか |

## Translation guardrails

- exact frame count、exposure length、rig structure、historical production quota を universal value にしない。
- limited animation を「drawing を減らす」目標にしない。meaningful motion へ effort を配分する。
- cut-out / replacement workflow が使えるから採用するのではなく、current shot の pose / silhouette / continuity が成立する場合だけ使う。
- historical style を aesthetic preset にしない。current project の visual language / brand / story に翻訳する。
- current tool implementation が変わっても、hold / substitution / transform / redraw / cycle の意味上の差を維持する。
