---
name: apple-hig
description: >
  Apple platforms 向けの2D application interfaceを設計・適応するときに使用する。
  current Human Interface Guidelines、Apple Design Resources、platform examplesを観察し、
  productの意味とanatomyを保ちながらnavigation、controls、presentation、density、input、materialを
  target Apple platformへ翻訳し、実際のrendered artifactで検証する。
---

# Apple HIG

Appleの見た目を模倣するためのSkillではない。

**Inspect product semantics → Inspect current Apple guidance → Separate shared anatomy from platform expression → Adapt → Verify on the rendered platform** の順で進める。

`apple-hig` は platform adaptation layer である。
underlying design problemは既存domain Skillをsource of truthとし、このSkillではApple platformでその判断をどう表現するかを決める。

## When to use

使用する:

- iPhone / iPad / Mac / Apple WatchなどApple platform向けapplication UIを新規設計するとき
- cross-platform productをApple platformへ適応するとき
- Apple platform間で同じproduct anatomyを保ちながらlayout / density / input / component expressionを変えるとき
- custom UIがsystem conventionから不必要に外れていないか判断するとき
- Appleのcurrent design system変更へ既存UIを適応するとき

使用しない:

- 単に「Appleっぽい」「Liquid Glassっぽい」visual treatmentを付けたいだけの場合
- genericなnavigation / form / color / typography / motion設計そのものを決める場合
- SwiftUI / UIKit / AppKitのAPI操作を知りたい場合
- 3D / spatial sceneそのものを設計する場合

## 1. Inspect current product first

外部referenceを見る前に、current productの意味を固定する。

確認する:

- primary user goal / critical tasks
- information architecture
- primary / secondary actions
- persistent navigation model
- contentとcontrolの境界
- selection / focus / editing model
- current brand expression
- target platforms
- supported window / screen sizes
- expected input: touch / pointer / keyboard / Digital Crown等
- accessibility / localization requirements
- existing platform-specific deviations

Apple referenceを見た後でproduct semanticsまで無意識にApple first-party appへ寄せない。

## 2. Inspect current Apple references

非自明な判断では `references/apple-platform.md` を開く。

最低限、次を比較する:

1. current Human Interface Guidelines
2. current Apple Design Resources / UI kits
3. current design guidance / WWDC session
4. target platformで実際にrenderされるsystem componentsまたはfirst-party examples

古いscreenshotや過去OSのcomponent geometryをcurrent ruleとして固定しない。
current UI kit / HIG / platform behaviorをversion anchorにする。

WWDC sessionはdesign intentとsystem evolutionを理解するevidenceとして使うが、特定年のpixel valueを普遍化しない。

## Observe

referenceを開いたら見た目の類似より次を観察する。

### Product anatomy

- content / navigation / controls / presentationの責務分離
- primary taskがどこに残るか
- platformが変わっても維持されるsemantic structure
- platformごとに変化するplacement / density / disclosure

### Hierarchy and structure

- groupingがspacing / placement / containmentのどれで作られているか
- primary actionとfrequent actionの位置関係
- contentとfunctional chromeの視覚的優先順位
- bar / toolbar / sidebar / tab / menuのsemantic role
- modal / nonmodal presentationのcontext preservation

### Platform expression

- iPhoneのtouch-first / compact context
- iPadのresizable window / touch + pointer + keyboard context
- Macのdense workflow / pointer + keyboard / menu context
- watchのglanceable / constrained interaction context
- 同じcomponent familyがplatformごとにどう密度・配置・interactionを変えるか

全platformを同一layoutへ縮尺変換しない。

### Controls and familiarity

- standard componentがtask semanticsに適合するか
- familiar metaphor / symbol / interaction conventionが使えるか
- custom controlが必要な理由
- custom controlでもstate / input / accessibility behaviorを予測可能に保てるか

### Material and appearance

- materialがcontentの上に置かれるfunctional layerとして何を表現しているか
- navigation / controls / presentationとmaterialの関係
- tint / transparency / contrastが意味を補助しているか、装飾になっているか
- content readabilityとbackground interaction
- Reduced Transparency / Increase Contrast / Reduce Motion等で意味が保たれるか

### Continuity

- platform間で名称 / symbol / task model / state meaningが一致しているか
- layoutを変えてもuserが同じ機能だと認識できるか
- window resize / orientation / input切替でtask contextが維持されるか
- pixel identityではなくbehavioral continuityになっているか

## 3. Translate platform guidance

### Preserve semantics; adapt expression

cross-platform productでは、まず共有するanatomyを決める。

共有候補:

- information hierarchy
- object identity
- command meaning
- selection semantics
- navigation destination
- terminology
- symbol meaning
- saved state / task progress

platformごとに変えてよい候補:

- control placement
- navigation presentation
- density
- toolbar composition
- disclosure
- window behavior
- pointer / touch target treatment
- keyboard acceleration
- presentation style

「continuity」をpixel-identical UIと解釈しない。

### Use standard components when semantics fit

system componentがtaskの意味とinteraction modelに適合するなら、原則としてそれを優先する。

理由は単なるvisual consistencyではない。
standard componentはplatform convention、input behavior、accessibility adaptation、current appearanceを継承しやすい。

custom componentを使う場合は少なくとも次を説明できるようにする:

- standard componentでは表現できないproduct-specific semanticsは何か
- custom interactionがuser expectationをどう維持するか
- touch / pointer / keyboard等で同じ意味をどう操作できるか
- focus / selection / disabled / loading等の状態をどう表現するか
- accessibility settingsでどう変化するか

brand差別化だけを理由にcommon controlのbehaviorまで再発明しない。

### Treat navigation components by role

見た目からcomponentを選ばない。

- tab bar → persistent top-level destinations
- sidebar → repeated switching / scalable hierarchy / wider contextに適したnavigation
- toolbar → current contextに対するcommands
- menu → commands / choicesのdisclosure
- sheet / popover等 → current taskとのcontext relationshipを保つpresentation

具体的な採用条件はcurrent HIGとtarget platformを確認する。

同じdestinationをtoolbar actionとtab destinationの両方に置くなど、semantic roleを混在させない。

navigationの一般構造は `navigation-design` をsource of truthにする。

### Keep content primary

system materialやchromeを増やすこと自体をApple adaptationにしない。

current Apple design systemを使う場合も:

- contentとcontrolsを明確に分ける
- redundantなcontainer / border / backgroundを足さない
- groupingはまずstructure / spacing / placementで成立するか見る
- materialはnavigation / control / presentationの機能的なlayerとして使う
- content surface全体へglass treatmentを無差別に敷かない

### Liquid Glass is not a style filter

Liquid Glassを使う判断では、glass appearanceそのものより次を確認する:

- layerの役割
- contentとのseparation
- legibility
- interaction state
- scrolling contentとの関係
- tintがsemantic / brand hierarchyを助けるか
- accessibility settingsで代替表現が成立するか

arbitraryなblur、transparency、corner radius、specular effectをApple styleとしてコピーしない。

### Let platform context change density and input

同じproductでもplatform contextが違えば最適なinteraction densityは変わる。

例:

- iPhoneでは短時間・touch-first taskを優先することがある
- Macではpointer / keyboardを使うdense workflowやpersistent controlsが成立しやすい
- iPadではwindow sizeとinput combinationが連続的に変化する

ただしこれらを固定personaにしない。
実際のproduct taskとtarget platform capabilityを確認する。

`responsive-design`、`keyboard-interface`、`touch-interface`が具体的adaptation policyのsource of truthになる。

### Preserve familiarity without freezing the product

common actionにはplatformで確立したmetaphor / symbol / behaviorを優先する。

一方で「Apple appsがそうしている」だけではproduct-specific architectureを変更しない。

評価順:

1. user task semantics
2. established platform expectation
3. current product convention
4. brand expression
5. decorative novelty

conflictがある場合は上位の意味を壊さない。

### Keep labels when symbols are not self-evident

system symbolを使うこと自体をclarityとみなさない。

- common meaningとして十分recognizableか
- product固有の意味へ転用していないか
- selected / destructive / disabled等で意味が変わらないか
- labelが必要なcontextか

を確認する。

icon family設計は `iconography-system`、content wordingは `content-design` を使う。

## 4. Responsibility boundaries

`apple-hig` が所有する:

- Apple platform conventionへのadaptation
- platform間でのshared anatomy vs specific expression
- Apple system component / presentation familyの選択
- Apple-specific density / input / continuity trade-off
- current Apple design systemとの整合確認

他Skillが所有する:

- `layout-system` — general spatial composition
- `responsive-design` — general reflow / viewport / container adaptation
- `navigation-design` — navigation semantics / information-space movement
- `interaction-states` — focus / selected / pressed等のstate semantics
- `keyboard-interface` — keyboard traversal / composite interaction
- `touch-interface` — touch targets / gesture / pointer behavior
- `color-system` — semantic color roles
- `dark-mode-design` — light/dark appearance transformation
- `high-contrast-design` — increased/forced contrast adaptation
- `typesetting` — typography composition
- `content-design` — wording / information priority
- `motion-system` — motion purpose / choreography
- `accessibility-audit` — broad conformance re-test

platform guidanceがdomain principleと衝突して見える場合、まずcurrent HIGの対象platform/contextを確認し、それでも衝突するならproduct semanticsを壊さない範囲でintentを翻訳する。

## Avoid

- Apple first-party appをpixel-for-pixelで再現する
- screenshotだけを見てcurrent HIGだと断定する
- iPhone UIをMac/iPadへそのまま拡大する
- Macのdense control placementをiPhoneへそのまま縮小する
- Liquid Glassをcontent cardや背景へ一括適用する
- blur / radius / tintなどreference固有値をuniversal tokenにする
- system controlと同じ意味なのにvisual noveltyだけでcustom controlを作る
- symbolだけ置いてproduct-specific meaningを推測させる
- pointer hoverをtouchで必須情報の唯一の入口にする
- platform-specific layout差をbrand inconsistencyとして消す
- domain Skillの判断を「Appleだから」で上書きする
- old HIG / deprecated component screenshotをcurrent conventionとして固定する

## Verify

source code / framework adoptionだけで完了しない。
実際に利用者が見るrendered artifactを確認する。

### Representative task

最低1つの代表taskを開始から完了まで操作する。

確認:

- primary content / actionが明確
- navigation destinationとtoolbar commandが混同されていない
- standard componentのbehaviorが期待どおり
- custom controlがplatform conventionから不必要に逸脱していない
- modal / sheet / popover後にcontextを失わない
- destructive action / undo / recoveryがproduct riskに合う

### Platform / size

対象がmulti-platformなら、少なくとも意味のある2つ以上のtarget contextで同じtaskを比較する。

例:

- compact iPhone + resizable iPad
- iPhone + Mac
- iPad touch + iPad pointer/keyboard

単にscreenshot幅を変えるだけでなく実際のnavigation / disclosure / input modelの差を確認する。

resizable platformではminimum / typical / expanded状態を確認する。

### Input

supported inputを実際に切り替える。

- touch
- pointer
- keyboard
- platform-specific input where relevant

input切替後もfocus / selection / current stateが矛盾しないことを確認する。

### Appearance and accessibility

material / translucency / motionを使う場合は、該当platformで可能な範囲で次を確認する:

- light / dark appearance
- Increase Contrast
- Reduce Transparency
- Reduce Motion
- larger text / content size where supported

visual effectを弱めたときにnavigation、control boundary、state、content hierarchyが失われるなら未完了。

### Current-reference comparison

current Apple Design Resources / HIGを開き直し、次を比較する:

- component anatomy
- grouping
- placement
- density
- symbol meaning
- presentation relationship
- platform-specific variation

exact pixel matchは合格条件にしない。
semantic roleとplatform expectationが一致しているかを見る。

### Report intentional deviations

system conventionから意図的に外れた箇所がある場合:

- product reason
- expected benefit
- interaction/accessibility cost
- verification performed

を短く残す。

## References

current sourceと観察軸は [`references/apple-platform.md`](./references/apple-platform.md) を読む。

Apple platformは更新されるため、version-sensitive判断ではreferenceの`Last reviewed`とcurrent Apple Design Resourcesを確認する。