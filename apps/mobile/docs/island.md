# Island (Live Activity, share extension)

## What lives where

| Path | Purpose |
| --- | --- |
| `modules/theone-island/index.ts`, `src/types.ts` | JS API and the `IslandState` / `IslandAction` / `SharedItem` types shared with the controller. |
| `modules/theone-island/ios/` | Expo module `TheoneIsland` (Swift): starts/updates/ends the Live Activity, emits push tokens, drains the action queue, app-window capture, crop, Vision OCR, reads the shared inbox. |
| `targets/island/` | Widget extension (`@bacons/apple-targets`, iOS 17): `IslandLiveActivity` (lock screen + Dynamic Island UI), `StopRunIntent` / `CaptureIntent`, `IslandWidgetBundle`. |
| `targets/share/` | Share extension (iOS 16.4): `ShareViewController` writes shared images/text/URLs/files into the app-group inbox and opens the app. |
| `plugins/with-island/` | Config plugin: `NSSupportsLiveActivities`, `NSSupportsLiveActivitiesFrequentUpdates`, app-group entitlement (iOS) and `android.js` (Android). |

`IslandAttributes.swift` is duplicated in `modules/theone-island/ios/` and `targets/island/` on purpose (a pod and an extension cannot share sources); keep both copies byte-identical, `ContentState` mirrors `IslandState` key for key.

## App-group contract

App group: `group.com.kevinbpract.theone`.

- Action queue: `UserDefaults(suiteName:)` key `island.actions` holds a JSON string with an array of `{ action: "stop" | "capture" | "open" | "share", runId?: string }`. Intents in the widget append to it and post the Darwin notification `com.kevinbpract.theone.island.action`. The module drains the queue and emits `onIslandAction` per item when JS is listening; otherwise items stay until `drainActions()`.
- Shared inbox: `<container>/shared-inbox/` with the copied files and `manifest.json` (array of `{ id, kind, file, text, name, mimeType, sizeBytes, createdAt }`). The share extension posts `com.kevinbpract.theone.island.shared`; the module emits `onSharedItems { count }`. `takeSharedItems()` copies files into `Caches/shared/` and deletes the inbox.
- Push tokens: `onPushToken { kind: "activity", token, activityId }` after `startActivity`, and `{ kind: "push-to-start", token, activityId: null }` on iOS 17.2+. The controller sends the same `IslandState` JSON as the APNs `content-state`.

## Deep links emitted by the extensions

- `theone://island/open` (tap on the activity, "Open" without a running run)
- `theone://island/run/<runId>` ("Open" with a running run)
- `theone://island/capture` ("Capture" button)
- `theone://island/share` (share extension after writing the inbox)

## Screen capture

`captureScreen("app")` snapshots the app's own key window only; `captureScreen("screen")` rejects on iOS. `cropImage` and `recognizeText` work in image pixels with a top-left origin.

## Builds

Targets and entitlements changed, so a new EAS development build is required:

```sh
eas build --profile development --platform ios
```

The development profile sets `APP_VARIANT=development`, which gives the app, the
share extension and the widget the bundle ids `com.kevinbpract.theone.dev`,
`.dev.share` and `.dev.island`, so the dev client installs next to the production
app. Both variants share the app group `group.com.kevinbpract.theone`. For Live
Activity pushes to the dev build set `THEONE_APNS_BUNDLE_ID=com.kevinbpract.theone.dev`
and `THEONE_APNS_ENV=sandbox` on the controller.

`ios/` is generated (`npx expo prebuild`), never edit it by hand.

## JS feature module

`src/features/island/` owns everything above the native module:

```text
src/features/island/
├── components/   island-host (mounted once in the root layout, paired only) · island-capsule · island-card
│                 · island-header · island-section · island-row · island-stats · capture-sheet
│                 · capture-source-step · crop-step · text-confirm-step · attach-target-sheet
│                 · draft-preview · destination-row
├── hooks/        use-island-host (composes the rest) · use-island-state · use-live-activity · use-island-actions
│                 · use-island-dispatch · use-island-route · use-capture-flow · use-crop-box · use-attach-target
│                 · use-draft-injection · use-now
├── services/     image-size.ts (`Image.getSize` for shared/library images before cropping)
├── store/        island-store.ts (zustand, in-memory)
├── types/        AttachDraft, CaptureSeed, CaptureStep, AttachDestination, crop geometry types
└── utils/        state.ts (queries → IslandState) · crop.ts (screen ↔ image pixels, clamping, corner resize)
                  · shared.ts (SharedItem → draft/seed) · actions.ts (deep-link → IslandAction) · destinations.ts
                  · capture.ts · format.ts · stats.ts · constants.ts
```

### Derived state

`useIslandState()` builds an `IslandState` from `useAgentRuns()`, `useProcesses()`, `useBuilds()`, `useProjects()`
and `useUsage(7)` plus the active sandbox. Runs are the non-final agent runs (title = first prompt line, ≤ 60 chars),
commands are non-final builds (`Build <target>`) followed by active processes, usage comes from the 7-day
`UsageReport` (today = last `daily` entry: `totalTokens`, `sessions`, `messages`; week = `totals.totalTokens`).

### Live Activity sync (`useLiveActivity`)

- Any run or command → `startActivity(state)` (Android 13+ asks for the notification permission first).
- Changes → `updateActivity(state)`, throttled to 1 s and skipped when the JSON (minus `updatedAt`) is unchanged.
- Nothing running → one last update, then `endActivity()` after a 5 s grace.
- `onPushToken` → `client.registerLiveActivity({ kind, token, activityId })` on the active sandbox.

### Actions and deep links

`useIslandActions` subscribes to `onIslandAction` / `onSharedItems` and drains `drainActions()` + `takeSharedItems()`
on mount and whenever the app returns to the foreground. `useIslandDispatch` maps actions: `stop` → cancel the run,
`open` → `nav.agentRun(id)` or the Agents hub, `capture` → capture sheet, `share` → shared items into the attach flow.
The routes `src/app/island/[action].tsx` and `src/app/island/run/[id].tsx` dispatch the same actions and immediately
`router.back()` / `router.replace("/")`, so `theone://island/*` never leaves a blank screen.

### Store contract (`useIslandStore`)

| Field | Meaning |
| --- | --- |
| `expanded` | in-app island card open |
| `pendingDraft: AttachDraft \| null` | `{ text, files: PickedFile[], source: "capture" \| "share" }` waiting for the next focused composer |
| `sharedItems: SharedItem[]` | items taken from the native inbox but not yet attached (the capsule shows the count) |
| `captureOpen`, `captureSeed` | capture sheet visibility and optional seed (shared images to crop, text and files to carry along) |
| `attachOpen`, `stagedDraft` | attach-target sheet visibility and the draft it previews |

Actions: `toggleExpanded`, `setExpanded`, `openCapture(seed?)`, `closeCapture`, `openAttach(draft)`, `closeAttach`,
`queueSharedItems`, `takeSharedItems`, `setPendingDraft`, `takePendingDraft`, `reset`.

### Draft injection

`useChatComposer` calls `useDraftInjection({ setText, add })`: when the screen is focused and `pendingDraft` is set,
it takes the draft once, appends its text to the input and adds its files via `attachments.add(files, source)`.
`AttachSource` gained `"capture" | "share"` (`PickerSource` is the menu subset; `ATTACH_OPTIONS` is unchanged).

### Capture flow

Source step: **This screen** (`captureScreen("app")` after hiding the sheet for a frame), **Whole screen** (only when
`canCaptureScreen("screen")`), **Latest screenshot** (photo library, single image), **Clipboard** (image via the
attachments clipboard service, else `getStringAsync` text). Crop step: pan to move, four corner pans to resize
(`utils/crop.ts`, worklets), **Use image** → `cropImage` (skipped when the box covers the whole image), **Grab text** →
crop + `recognizeText` → editable confirm step, **Skip crop**. Then the attach-target sheet: **New chat** (Home
composer), a project (`nav.newAgentRun(projectId)`) or a recent chat (`/chats/[id]`).

### Tests

`tests/unit/island/`: `state.test.ts`, `crop.test.ts`, `island-store.test.ts`, `island-host.test.tsx`. The native
module is mapped to `tests/mocks/theone-island.ts` (`__emitAction`, `__emitSharedItems`, `__queueActions`, `__reset`).
