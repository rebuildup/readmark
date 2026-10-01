---
name: compositing
description: >
  2D素材、実写、文字、graphics、effects、pre-rendered 3D assetなどを最終frameへ統合するときに使用する。
  alpha / matte / mask / blend、edge、color、grain、blur、depth cue、readabilityを観察し、
  renderer固有のeffect presetではなく「別々の素材が同じ画面として成立する条件」を設計して検証する。
---

# Compositing

Last reviewed: 2026-09-12

compositing はeffect stackを増やす作業ではない。

**Inspect sources → Establish matte/alpha → Match space → Match color/light → Integrate edges/texture → Verify frames + playback**

別々に作られた素材が、一枚のframe / 一つのsequenceとして視覚的に成立するようにする。

## Scope

対象:

- live-action + graphics
- illustration / still + typography
- UI capture + promo graphics
- keyed footage
- particles / glow / light overlays
- pre-rendered 3D assetを最終2D frameへ統合
- 2D depth cue via scale / blur / parallax
- texture / grain / optical treatment

対象外:

- 3D modeling / rigging / scene lighting / rendering自体
- tool固有のeffect一覧
- 「cinematic」presetの一括適用

## Workflow

1. source assetをinventoryする。
2. technical stateを確認する: alpha、color space、bit depth、resolution、compression、frame rate。
3. compositingの目的を分類する。
4. alpha / matte / maskの構造を先に正す。
5. spatial / color / edge / texture mismatchを一つずつ統合する。
6. typography / focal subjectのreadabilityを保つ。
7. representative frameとfull playbackの両方で検証する。
8. target exportを再読込して最終appearanceを確認する。

## Compositing intent

まず何をする合成か決める。

### Integration

別sourceを同じsceneに見せる。

見る:

- scale
- perspective cue
- focus / blur
- light direction
- shadow / contact
- color temperature
- grain / noise
- edge softness

### Reveal / Matte

形状やluma / alphaで見せる領域を制御する。

見る:

- matte continuity
- edge contamination
- semitransparent detail
- holes / chatter
- motion consistency

### Depth / Atmosphere

2D処理で前後感を作る。

見る:

- scale relation
- blur hierarchy
- parallax
- haze / contrast falloff
- occlusion

### Stylization

grain、glow、chromatic / optical effect等で素材のvisual languageを統一する。

effect自体を目的にしない。
source間のmismatchを減らすか、明確なart directionを支える場合に使う。

## Observe

### Alpha / matte

- straight vs premultiplied alpha
- matte edge
- partial transparency
- holes
- fringe / halo
- spill
- motion edge stability

alpha interpretationが間違ったままblurやglowで隠さない。

### Blend / layer relationship

- source and backdrop order
- blend response in black / midtone / white
- isolation / group behavior
- opacity vs blend-mode responsibility

blend modeは「なんとなく馴染ませる」ために総当たりしない。

### Color / light

- working color space
- black / white point
- contrast
- saturation
- temperature
- light direction
- highlight rolloff
- shadow density

異なるsourceを同じLUTで潰すだけで統合しない。

### Edge

- hard / soft edge
- antialiasing
- defocus
- motion blur
- spill / contamination
- edge color
- local contrast

edge qualityは合成感を最も強く左右する要素の一つとして確認する。

### Texture / optical behavior

- sensor / source noise
- grain scale
- compression texture
- sharpness
- bloom / glow
- chromatic artifact
- flare / light leak
- scan / display texture when intentional

textureはscene全体のsignal characteristicを揃えるために使う。
decorative overlayを重ねるだけにしない。

### Temporal consistency

静止frameだけでなく:

- flicker
- matte chatter
- edge swimming
- tracking slip
- grain freeze
- inconsistent blur
- exposure jumps

をplaybackで確認する。

## Decision rules

### Fix structure before effects

順序の基本:

1. alpha / matte
2. transform / spatial relation
3. color / exposure
4. edge / blur
5. grain / texture
6. expressive optical effects

glow / blur / grainでstructural mismatchを隠さない。

### Matte and blend have different jobs

matte / mask:
- where the source exists

blend:
- how overlapping color interacts

役割を混同しない。

### Preserve readable graphics

文字 / UI / labelsが含まれる場合:

- glow
- chromatic offset
- blur
- grain
- flare

でreadabilityを壊さない。

必要ならforeground graphicだけtreatment量を分ける。

### Respect color management

input → working space → outputの関係を把握する。

tool間で同じRGB値でも同じappearanceになるとは限らない。
target deliveryのcolor behaviorを最後に確認する。

## References

### W3C — Compositing and Blending Level 1

https://www.w3.org/TR/compositing-1/

Observe:

- compositing vs blending
- source / backdrop relationship
- alpha model
- group isolation

Use as conceptual grounding across renderers.

### Adobe After Effects — Alpha channels and masks

https://helpx.adobe.com/after-effects/desktop/work-with-transparency-and-compositing/work-with-alpha-channels-and-masks/alpha-channels-masks-mattes.html

Observe:

- alpha channel
- matte
- mask
- partial transparency
- channel inspection

### Adobe After Effects — Alpha interpretation

https://helpx.adobe.com/after-effects/desktop/work-with-footage-items/import-and-interpret-footage-items/importing-interpreting-footage-items.html

Observe:

- straight vs premultiplied alpha
- edge halo failure
- import interpretation

### Adobe After Effects — Track mattes

https://helpx.adobe.com/after-effects/desktop/work-with-transparency-and-compositing/work-with-track-mattes-and-traveling-mattes/track-mattes-and-traveling-mattes.html

Observe:

- alpha / luma matte behavior
- high-contrast matte
- partial transparency
- reusable matte source

### Adobe After Effects — Keying

https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/keying/keying.html

Observe:

- garbage / holdout matte
- key cleanup
- spill
- compression impact
- frame-by-frame edge checking

### Adobe After Effects — Color management

https://helpx.adobe.com/after-effects/desktop/adjust-colors/color-management/color-management.html

Observe:

- input profile
- working color space
- output consistency
- SDR / HDR implications

### Apple Motion — Blend modes

https://support.apple.com/guide/motion/how-do-blend-modes-work-motnc047854a/mac

Observe:

- black / midtone / white response
- channel-based blending
- color-processing effect on result

### Apple Motion — Color keying

https://support.apple.com/guide/motion/intro-to-color-keying-motn14b99664/mac

Observe:

- key + matte refinement
- spill suppression
- multiple-tool compositing workflow

## Avoid

- effect presetを重ねて「馴染ませる」
- premultiplied / straight alpha mismatchを放置する
- matte edgeをfinal RGBだけで判断する
- black backgroundでしかedgeを確認しない
- sourceごとのgrain / sharpness差を無視する
- color-management差をLUTだけで吸収する
- glow / bloomでtext legibilityを失う
- single frameだけ確認してmotion edge failureを見逃す
- 3D scene designをこのSkillへ持ち込む

## Verify

最低限:

- alpha / matte viewを確認する
- dark background / light backgroundの両方でedgeを見る
- 100%表示でhalo / spill / aliasingを確認する
- representative framesを時系列で比較する
- full playbackでchatter / flicker / tracking slipを見る
- text / UIのreadabilityを実速度で見る
- export後のfileを再読込する
- target color space / compressionでappearanceを確認する

良いcompositeはeffect量ではなく、source間の不一致が意図的に処理され、最終frameの情報 hierarchyが保たれているかで評価する。
