# Cross-device continuity references

Last reviewed: 2026-09-13

この reference は cross-device experience を platform API catalog として覚えるためではなく、複数 platform に共通する **activity continuity の判断軸**を比較するために使う。

current platform feature / availability / preview status は変化する。実装時に direct URL を再度開き、現行 status を確認する。

## Apple — Handoff / user activities

### Apple Developer — Convenience

- URL: https://developer.apple.com/documentation/technologyoverviews/convenience
- Type: primary / current platform guidance
- Observe:
  - Handoff が「ある device で始めた activity を別 device へ移す」機能として位置付けられていること
  - どの task が transfer に値するかを先に決める考え方
  - product URL、reading position、media + playback location 等、app launch より細かい activity granularity
  - user が knowingly start し、別 device で reasonably continue したい activity を選ぶこと
- Translate:
  - generic app identity ではなく user task / content object を continuity unit にする
  - platform feature が存在するから全 activity を handoffable にするのではなく、継続価値で選ぶ
- Avoid copying:
  - Apple-specific UI appearance、API payload、system affordance の exact presentation

### Apple Developer — Continuing User Activities with Handoff

- URL: https://developer.apple.com/documentation/Foundation/continuing-user-activities-with-handoff
- Type: primary / first-party sample guidance
- Observe:
  - map region / store editing 等、destination が current activity state を復元する構造
  - Handoff continuation state と、iCloud 等による durable application data persistence の違い
  - continuation 後に originating device の UI を cleanup できる lifecycle
- Translate:
  - handoff state と durable sync を別 responsibility として設計する
  - transfer 成功後の source-side ownership / cleanup を user mental model に合わせて決める
- Avoid copying:
  - Foundation API sequence を design rule にしない

## Android — Continue On

### Android Developers — About the Continue On feature

- URL: https://developer.android.com/develop/better-together/continue-on
- Type: primary / current platform guidance
- Current status reviewed: Android 17 / API 37 guidance, page last updated 2026-05-14
- Observe:
  - one Android device で始めた user journey を別 device で続けることが core problem であること
  - bidirectional continuation
  - receiving device で app experience を recreate しつつ、form factor に合わせて customize できること
  - app-to-app continuation と web fallback の両方が成立すること
  - same document/tab/thread のように exact task context を保つ例
- Translate:
  - destination は source screen の mirror でなくてよい
  - task identity/state を維持しつつ destination capability に適応する
  - native-only を前提にせず fallback surface を continuity model に含める
- Avoid copying:
  - Android 17 availability を cross-platform universal availability とみなさない

### Android Developers — Setup and test Continue On

- URL: https://developer.android.com/develop/better-together/continue-on/setup
- Type: primary / current verification guidance
- Current status reviewed: page last updated 2026-07-24
- Observe:
  - two actual compatible devices、same account、network / system service 等を含む end-to-end test condition
  - source で activity を開始し、destination suggestion から requested handoff activity を開く test flow
- Translate:
  - source screenshot と destination screenshot の個別 QA ではなく、実際の transfer sequence を verification unit にする
  - account / capability / availability を environment condition として記録する

## Android — Cross-device Sessions

### Android Developers — Cross-device SDK Sessions API

- URL: https://developer.android.com/guide/topics/connectivity/cross-device-sdk/sessions
- Type: primary / current implementation evidence
- Observe:
  - session を transferable / shareable cross-device UX として扱うこと
  - personal-device transfer と communal / simultaneous sharing を区別できること
- Translate:
  - transfer と shared session を別 interaction model として分類する
  - ownership、source behavior、feedback を model ごとに設計する
- Avoid copying:
  - SDK object model を design vocabulary に固定しない

### Android Developers — Get started with the Cross-device SDK

- URL: https://developer.android.com/guide/topics/connectivity/cross-device-sdk/get-started
- Type: primary / current status evidence
- Current status reviewed: Developer Preview
- Observe:
  - current availability / preview constraints
  - device discovery / capability / ecosystem constraints
- Translate:
  - platform implementation status を runtime evidence として確認する
  - preview mechanism を production-independent universal rule にしない

## Microsoft — Windows Resume

### Microsoft Learn — Windows Resume: continue tasks across devices

- URL: https://learn.microsoft.com/en-us/windows/apps/develop/windows-integration/cross-device-resume-overview
- Type: primary / current platform guidance
- Current status reviewed: page last updated 2026-05-30
- Observe:
  - activity context を publish し、別 device / Windows surface から same task を resume する model
  - taskbar 等の system surface が continuation affordance になること
  - cross-device continuation を app relaunch ではなく task resume として扱うこと
- Translate:
  - system suggestion に表示する activity identity / title / context を user が理解できる単位にする
  - system UI は transfer discoverability の一 surface として扱い、product state と分離する
- Avoid copying:
  - Windows taskbar affordance を他 platform の universal interaction にしない

### Microsoft Learn — Cross Device Resume

- URL: https://learn.microsoft.com/en-us/windows/apps/develop/windows-integration/cross-device-resume
- Type: primary / current implementation-status evidence
- Observe:
  - Android ↔ Windows continuation context、fallback / link / lifetime 等の implementation constraints
  - current Limited Access Feature status
- Translate:
  - activity lifetime / stale state / web or URI fallback を design axes として扱う
  - limited-access implementation details を timeless product rule にしない

## Cross-reference comparison

複数 platform で反復する observable axes:

| Axis | Apple | Android | Windows | Design translation |
| --- | --- | --- | --- | --- |
| Activity unit | user activity / content context | user journey / exact target | task/activity context | app home ではなく具体的 task を resume する |
| State fidelity | activity state | requested handoff activity | resumable context | minimum meaningful state を運ぶ |
| Destination adaptation | same activity on another Apple device | recreate or customize for receiver | resume on Windows surface | pixel identity より task identity を保つ |
| Sync separation | Handoff vs iCloud persistence evidence | continuation context vs app data | activity context vs app data | durable data と transfer context を分ける |
| Fallback | ecosystem/application availability | app-to-app or web | link/web/context fallback | native path failure時も taskをstrandedにしない |
| Lifecycle | source can react after continuation | bidirectional continuation | activity lifetime | ownership / stale state を設計する |
| Current-status sensitivity | current Apple ecosystem support | Android 17 + preview SDKs | Limited Access Feature constraints | version/status を実装時に再確認する |

## Failure modes to inspect

- destination が generic home / dashboard にしか着地しない
- current document / thread / step / playback position が失われる
- unsaved work が handoff mechanism だけに依存している
- source が transfer 成功前に work を破棄する
- source / destination の両方で destructive operation が同時に active になる
- destination layout を source の縮小/拡大 clone にする
- transfer と simultaneous companion/share を混同する
- unsupported device / old OS / app missing で silent failure になる
- stale activity が期限なく resume suggestion に残る
- web fallback が generic landing page にしか繋がらない
- system suggestion に sensitive title / preview を露出する
- current preview / limited-access API を production-universal な design rule として記述する

## Verification profile

最低限、representative task について次を実物で確認する。

1. source device/surface で task を途中まで進める。
2. exact object / position / working state を記録する。
3. destination へ transfer する。
4. destination が intended task を直接 resume するか確認する。
5. source と destination の presentation が異なる場合も task semantics が保持されるか確認する。
6. transfer failure / target unavailable / account mismatch 等の failure path を一つ以上実行する。
7. source-side work が失われないか確認する。
8. activity を stale にし、expire / reconcile behavior を確認する。
9. fallback surface がある場合、同じ user goal へ到達できるか確認する。
10. confidential metadata の exposure と active-device ownership を確認する。

platform feature の正式 promotion に使う場合は、可能なら実 device 2台または materially different な2 surface で行う。preview / limited-access feature はその status を test record に残す。
