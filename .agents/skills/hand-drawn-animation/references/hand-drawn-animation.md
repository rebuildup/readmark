# Hand-Drawn Animation References

Last reviewed: 2026-09-13

この reference set は hand-drawn animation の visual preset をコピーするためではなく、**pose construction / timing / spacing / exposure / redraw material / cleanup** の判断を複数 source から比較するために使う。

## Core animation structure

- [Toon Boom Learn — Animation Principles](https://learn.toonboom.com/modules/animation-principles)
  - Observe: timing、spacing、arcs、anticipation、follow-through、overlap、slow-in / slow-out が個別 effect ではなく motion relationship としてどう説明されているか。
  - Useful for: rough animation の基礎観点を揃える。
  - Avoid copying: lesson 用の isolated exercise や exact drawing count を universal rule にしない。

- [Toon Boom Learn — Straight Ahead and Pose-to-Pose Principle](https://learn.toonboom.com/modules/animation-principles/topic/straight-ahead-and-pose-to-pose-principle)
  - Observe: pose-to-pose の key / breakdown / in-between 構造、timing control と volume consistency、straight-ahead の improvisation / fluid motion と drift risk。
  - Useful for: construction mode を action type から選ぶ。
  - Avoid copying: どちらか一方を常に superior と扱わない。

- [Toon Boom Learn — Slow-in and Slow-out Principle](https://learn.toonboom.com/modules/animation-principles/topic/slow-in-and-slow-out-principle)
  - Observe: drawing spacing が速度変化を作る関係。duration と spacing を分離して見る。
  - Useful for: acceleration / deceleration / weight の review。
  - Avoid copying: every action を ease-in/ease-out にする generic recipe。

- [Adobe — 12 Principles of Animation](https://www.adobe.com/creativecloud/animation/discover/principles-of-animation.html)
  - Observe: timing、spacing、follow-through、arcs、straight-ahead / pose-to-pose の established vocabulary が別 source とどう一致・差別化されるか。
  - Useful for: Toon Boom source の cross-check。
  - Avoid copying: software-specific workflow を design rule にしない。

## Rough, breakdown, and in-between workflow

- [Toon Boom Learn — Paperless Animation](https://learn.toonboom.com/modules/paperless-animation)
  - Observe: rough key poses → breakdown / in-between → tie-down / cleanup の責務分離。
  - Useful for: early detail を避け、main action を先に解く workflow。

- [Toon Boom Learn — Timing Charts and Animating Key Poses](https://learn.toonboom.com/modules/paperless-animation/topic/activity-1-timing-charts-and-animating-key-poses)
  - Observe: key pose / breakdown planning、timing chart、rough stage で movement / energy を優先する順序。
  - Useful for: pose-to-pose の planning と spacing intent の externalization。
  - Avoid copying: timing chart notation 自体を必須 output にしない。

- [Toon Boom Learn — In-betweening Paperless Animation](https://learn.toonboom.com/modules/paperless-animation/topic/activity-2-in-betweening-paperless-animation)
  - Observe: breakdown と in-between の違い、smear drawing の placement と fast action readability。
  - Useful for: midpoint interpolation では表現できない path / speed / force を考える。
  - Avoid copying: smear を hand-drawn look の signature として毎回追加しない。

## Exposure, holds, and timing evidence

- [Toon Boom Harmony 27 — Holding an Exposure](https://docs.toonboom.com/help/harmony-27/essentials/timing/hold-exposure.html)
  - Observe: drawing exposure / hold と timing の関係、twos / threes が production convention としてどう扱われるか、fast action で cadence を変える理由。
  - Useful for: ones / twos / threes を quality ranking ではなく contextual cadence として扱う。
  - Avoid copying: Western/Japanese production tendencies を cultural absolute や fixed fps rule にしない。

- [Toon Boom Harmony 25 — About Exposure](https://docs.toonboom.com/help/harmony-25/advanced/timing/about-exposure.html)
  - Observe: scene timing と drawing allocation を drawing production 前に計画する relationship。
  - Useful for: exposure planning / holds。

- [Toon Boom Harmony 24 — Xsheet View](https://docs.toonboom.com/help/harmony-24/advanced/reference/view/xsheet-view.html)
  - Observe: traditional exposure-sheet model が frame / drawing exposure をどう可視化するか。
  - Useful for: timing information の implementation evidence。
  - Avoid copying: Xsheet UI を Skill の design source of truth にしない。

## Rough-to-cleanup responsibility

- [Toon Boom Harmony 25 — Paperless Traditional Animation](https://docs.toonboom.com/ja/help/harmony-25/premium/getting-started/animation.html)
  - Observe: rough stage で main action を作り、detail を早く入れすぎない production reasoning、drawing flip による continuity check。
  - Useful for: rough → refine sequence。

- [Toon Boom Harmony 24 — Traditional Animation / Cleanup](https://docs.toonboom.com/help/harmony-24/essentials/getting-started/animation.html)
  - Observe: rough drawing から clean solid line / paintable shape へ移る responsibility。
  - Useful for: cleanup が motion redesign ではなく clarification であることを確認する。
  - Avoid copying: exact layer / tool workflow。

## Implementation evidence, not design source of truth

- [Blender Manual — Grease Pencil Onion Skinning](https://docs.blender.org/manual/en/latest/grease_pencil/properties/onion_skinning.html)
  - Observe: previous / next keyframe comparison を支援する onion-skin model。
  - Useful for: frame relationship inspection の tool evidence。
  - Avoid copying: Blender control values や UI procedure。

- [Walt Disney Animation Studios — Meander in Moana](https://disneyanimation.com/technology/meander/)
  - Observe: artist-authored vector stroke intent を保ちながら in-between assistance を行う production technology。
  - Useful for: automation / interpolation は artistic motion decision を置き換えず補助する、という boundary。
  - Avoid copying: proprietary Disney rendering / line technology。

## Production artifacts and material language

- [NFB — Rains](https://www.nfb.ca/film/rains/)
  - Observe: pencil drawing、slowed / nearly stopped human action、holds と subtle motion の contrast、drawing texture が cadence にどう作用するか。
  - Useful for: fast fluid animation だけを hand-drawn norm にしない production comparison。
  - Avoid copying: specific visual motifs / story imagery。

- [NFB — Immersion](https://www.nfb.ca/film/immersion/)
  - Observe: watercolor pencil on frosted acetate、material texture、redraw variation、digital finishing と drawn motion の relationship。
  - Useful for: line/material behavior が clean vector line 以外でも成立することを比較する。
  - Avoid copying: exact palette / imagery / artist-specific marks。

- [NFB Collection — Immersion production entry](https://collection.nfb.ca/film/immersion)
  - Observe: production technique / medium information。
  - Useful for: finished artifact と production method の cross-check。

- [NFB — The Midway](https://www.nfb.ca/film/midway/)
  - Observe: hand-drawn visual continuity、pose / frame composition / drawn material in a distinct production context。
  - Useful for: single studio / single software からの一般化を避ける比較 source。

- [Toon Boom — Jam Filled Entertainment on the expressive 2D animation in Wylde Pak](https://www.toonboom.com/jam-filled-entertainment-on-the-expressive-2d-animation-in-wylde-pak)
  - Observe: purposeful line boil / imperfect handcrafted line、slow moments を alive にする redraw variation、anchor / connection stability。
  - Useful for: line boil を optional material language として判断する。
  - Avoid copying: series-specific line style / character design。

- [Toon Boom — Rob Zilio on The Little Girl & The Alien](https://www.toonboom.com/rob-zilio-on-the-little-girl-the-alien-and-the-art-of-world-domination/)
  - Observe: line boil が production-specific effect として選択される例。
  - Useful for: 「hand-drawn = boil 必須」という一般化を否定する comparison。

## Comparison checklist

複数 reference を開いたら、最低限以下を比較する。

- key pose が action beat をどこまで説明するか
- breakdown が path / attitude / weight をどう変えるか
- timing と spacing が同じか異なるか
- drawing exposure / hold / cadence がどの場面で変わるか
- main action と secondary action の phase relationship
- fast movement で smear / deformation が必要か
- form / anchor をどこまで stable に保つか
- rough line / clean line / boil の material choice
- cleanup によって motion energy が変化していないか
- final playback と isolated frame inspection で評価がどう異なるか

## Freshness policy

principles 自体は historical continuity を持つが、software documentation / implementation evidence は更新される。

- current Toon Boom / Blender documentation URL が移動・deprecated していないか再確認する
- implementation feature の version-specific behavior を timeless rule にしない
- production artifact / historical source は historical evidence として明示し、current tool recommendation と混同しない
