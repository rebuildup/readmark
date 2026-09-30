# 2D Parallax References

Last reviewed: 2026-09-17

この reference family は authored 2D / 2.5D multiplane animation の **plane segmentation、relative depth、camera / layer motion、occlusion / reveal、coverage、flat-plane limit** を調べるために使う。

実装 UI や renderer の数値を rule としてコピーしない。physical multiplane、current digital tooling、photo separation、mixed-media production を比較し、反復する spatial relationship を抽出する。

## Canonical historical evidence

### Walt Disney Family Museum — A Machine for the Imagination: Walt Disney’s Pinocchio and the Multiplane Camera

https://www.waltdisney.org/blog/machine-imagination-walt-disneys-pinocchio-and-multiplane-camera

Observe:

- foreground / middleground / background を複数 plane に分ける物理構造
- plane 間の距離と camera travel による depth / spatiality
- camera push / truck 中に architecture / mist / foreground がどう重なるか
- depth だけでなく texture と spatial progression を作る使い方
- camera move が scene / storytelling の目的へ接続していること

Useful for:

- multiplane の原理を software-specific z-value から切り離す
- plane count ではなく relative placement と camera relationship を見る
- large camera move が artwork / stage preparation を要求することを理解する

Avoid copying:

- Disney の作品固有 art direction
- historical production cost / layer count を current universal target にすること

### Walt Disney Family Museum — Multiplane Classroom Kit

https://www.waltdisney.org/multiplane-classroom-kit

Observe:

- several levels of cels / backgrounds を同時撮影して 2D image に depth を与える基本構造
- physical separation そのものが parallax の source であること
- simple stop-motion asset でも plane relationship を設計できること

Useful for:

- digital camera / 3D-layer implementation以前の最小モデルを確認する

Avoid copying:

- specific physical rig dimensions
- historical device を現在の production requirement とすること

## Current implementation evidence

### Adobe After Effects — Animate photos with a parallax effect

https://helpx.adobe.com/after-effects/how-to/animate-picture.html

Observe:

- foreground / background を source image から分離する前処理
- foreground を除去した後に hidden background を補完する必要性
- source の original spatial relationship に応じて relative z placement を決める考え方
- camera motion 前に layer separation と scale / framing を準備する流れ
- camera path によって final parallax を確認すること

Useful for:

- still photo / illustration を layered shot に変換する task
- hidden-region coverage と relative depth の関係

Avoid copying:

- tutorial 固有の z-value、focal-length preset、easing
- Photoshop / After Effects の操作手順を design rule にすること

### Adobe Animate — Layer depth and Camera Z-depth

https://helpx.adobe.com/animate/desktop/using/layer-depth.html

Observe:

- 2D layers を異なる plane に配置する model
- camera pan に対して near object と far object の apparent movement が変わること
- layer depth と size relationship
- depth ordering を authored scene 内で保持する考え方

Useful for:

- relative movement を「任意の speed percentage」ではなく depth relationship として考える

Avoid copying:

- application の depth numeric range
- near/far の数値符号を cross-tool universal convention とすること

### Adobe Animate — Camera in Animate

https://helpx.adobe.com/animate/desktop/multimedia-and-video/working-with-camera-in-animate.html

Observe:

- camera と depth layer の組み合わせ
- near / far object の motion difference
- camera-locked layer と world-space layer の違い
- camera zoom / pan と scene elements の関係

Useful for:

- title / HUD / frame 等を camera movement から分離する判断
- camera-owned motion と object-owned motion の区別

Avoid copying:

- runtime API / application-specific camera workflow

### Adobe After Effects — 3D layers

https://helpx.adobe.com/after-effects/desktop/work-with-layers/3d-layers/3d-layers.html

Observe:

- z-position を持っても source layer 自体は flat plane であること
- perspective / occlusion / relative-size cue と virtual camera の関係
- flat source を斜めから大きく見る時に surface volume が存在しないという制約

Useful for:

- 2.5D と full 3D scene の責務境界
- camera move amplitude の限界を考える

Avoid copying:

- After Effects の coordinate convention / camera controls を design source of truth にすること

## Materially different production evidence

### Motionographer — Project Breakdown with Ollie Magee

https://motionographer.com/2021/08/01/project-breakdown-with-ollie-magee/

Observe:

- card cut-outs、painted cel effects、printed-photo backgrounds を一つの physical multiplane に共存させる方法
- ten-layer physical setup が tactile depth を作ること
- photographic realism ではなく material flatness を保持したまま depth を成立させる例
- production technique と artistic intent の関係

Useful for:

- digital photo parallax だけを domain の基準にしない
- flat cut-out appearance が必ず failure ではないことを確認する
- different source materials を plane language として統合する

Avoid copying:

- creator 固有の mixed-media aesthetics
- ten layers を推奨 layer count と解釈すること

## Cross-reference: integration boundary

### Repository `compositing` Skill

[`compositing` Skill](../../compositing/SKILL.md)

Observe:

- alpha / matte / edge / blur / grain / color integration の責務
- depth cue と final source integration の責務

Use this after plane geometry / relative motion が定まった後、cutout edge、focus、texture、color を final frame として統合する。

`2d-parallax` 側では blur / haze / grain を primary depth model の代わりにしない。

## Comparison matrix

| Reference | Plane model | Motion source | Key lesson |
| --- | --- | --- | --- |
| WDFM `Pinocchio` | physical foreground / middle / background planes | physical camera / stage movement | depth is a spatial staging and camera problem, not a speed preset |
| WDFM Classroom Kit | several physical cel/background levels | stop-motion capture | simple separated planes already create a coherent multiplane model |
| Adobe photo parallax | separated raster foreground/background/middle | virtual camera | source segmentation and hidden-region reconstruction precede camera animation |
| Adobe Animate layer depth | digital flat planes | camera + layer depth | apparent motion should follow relative depth |
| Adobe AE 3D layers | flat digital planes in z-space | virtual camera | z-position does not give a flat source real volume; camera-angle limits remain |
| Ollie Magee | physical card/cel/photo planes | physical multiplane / stop frame | stylized flat materiality can be intentional while spatial depth remains legible |

## Extracted invariants

複数sourceで反復したもの:

1. **Parallax requires relative depth.** layer speed variationだけではなく、plane間の前後関係が先にある。
2. **Camera/viewpoint change reveals preparation debt.** 大きな move ほど hidden background、overscan、edge、perspective の不足が見える。
3. **Near/far motion is relative, not a universal ratio.** apparent displacement は scene depth と camera path に依存する。
4. **Occlusion is evidence of space.** 前景・中景・背景の overlap / reveal が coherent なら depth が読みやすい。
5. **Flat planes remain flat.** digital z-space に置いても source に volume は生まれない。
6. **Material realism is optional.** realistic photo parallax と visible cut-out multiplane は異なる art direction だが、どちらも spatial relationship は一貫している必要がある。
7. **Effects are secondary.** blur / haze / texture は depth を補助できるが、誤った plane geometry を修正しない。

## Failure modes to inspect

- foreground / background に arbitrary fixed speed ratio を当てる
- camera path が source perspective の許容範囲を越える
- foreground removal 後の background hole が camera move で露出する
- crop / overscan 不足で canvas edge が見える
- hair / foliage / translucent detail の matte が camera move 中に破綻する
- camera motion と independent layer motion が合算され accidental drift になる
- subject が foreground movement に隠されすぎる
- world-space text / overlay が意図せず parallax する
- blur / haze だけで奥行きを作り、relative motion / occlusion が矛盾する
- z-space を使ったこと自体を 3D scene と誤認して camera を大きく回す
- physical cutout / paper look を意図していないのに plane separation が cardboard artifact として露出する

## Research refresh

次の場合は source を再確認する。

- Adobe の current camera / layer-depth model が大きく変わった
- target renderer が flat-plane 以外の geometry / depth behavior を持つ
- interactive scroll-linked parallax を扱う必要が出た
- real artifact trial で既存 axes では説明できない failure が発生した

current tool documentation は version-sensitive implementation evidence として扱い、timeless principle と混同しない。
