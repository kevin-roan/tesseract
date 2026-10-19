# Spec: host pages (Shell, Emulator) and host devices

The **host** sidebar section holds the pages that act on a computer rather than on the sandbox: **Shell**
(terminals on the host) and **Emulator** (the Android emulator and the iOS Simulator on the host). Both talk to
the host daemon (`tesseract-controller host serve`) through the `hostShell` IPC service. The Processes page
also lists running host devices. This is a design spec: the GTK app had no such pages. It only opened host
terminals in a window and the emulator through scrcpy.

Contracts: [app-runs-and-emulator.md §2](../../architecture/app-runs-and-emulator.md#2-android-emulator-on-the-host),
[ios-simulator-macos.md](../../architecture/ios-simulator-macos.md), `packages/protocol/src/schemas/{android,ios}.ts`,
`HostShellClient` / `TesseractClient` in `packages/client`. Daemon control and the Host shell settings are in
[host-android.md](host-android.md).

## 1. Page registration

| id | title | icon | section / order | component |
|---|---|---|---|---|
| `shell` | `Shell` | `terminal` | `host`, 30 | `pages/shell/ShellPage.tsx` |
| `emulator` | `Emulator` | `smartphone` | `host`, 40 | `pages/emulator/EmulatorPage.tsx` |

When the host is `ready`, both pages put a **Lock host shell** header action (`pages/shell/HostLockAction.tsx`)
that calls `hostShell.lock()`.

## 2. Which host: routing follows the active machine

The renderer never chooses a host. Every `hostShell` method runs on `target()` in `main/ipc/hostShell.ts`. That
is `HostRouter.current()` (`core/master-host/router.ts`), and `followActiveMachine()` re-points it on every
connection change using `activeHostRoute()` (`main/ipc/masterHost.ts`):

| Active machine | Route | Host used |
|---|---|---|
| local machine (or none) | `local` | the app's own `HostShellService` (spawned daemon) |
| remote machine with a linked host | `remote` | `RemoteHostShell` for the saved master host (`url` + token in main) |
| remote machine without one | `unlinked` | `RemoteHostShell(null)`: `status: external`, `pairing: null` → gate `noHost` |

When the route changes, main locks the previous remote session and pushes `hostShell:state`.
`useMachineScopeRefresh()` invalidates every `["hostShell", …]` query, and the device queries carry the host URL in
their key (§6), so data from one host never shows for another.

The host token and the PIN session stay in main. The renderer's `TesseractClient`
(`features/host-shell/client.ts`) sends a placeholder bearer through `hostShell.request`. Main checks the origin
against the active pairing and the path against `HOST_PROXY.paths` (`/v1/terminals`, `/v1/auth/ticket`,
`/v1/android`, `/v1/ios`), puts in the session token, and answers 401 itself when no session is live. WebSockets
(`/v1/terminals/:id/stream`, `/v1/android/screen`, `/v1/ios/screen`) connect from the renderer to the daemon
directly, using a one-time ticket fetched through that proxy.

## 3. Host access and the gate

`useHostAccess()` (`features/host-shell/hooks/use-host-access.ts`) is the single access point. It turns
`hostShell:state` and a session clock into `HostAccess`, and returns a client only when access is `ready`.
`useHostGate()` adds the gate model and its actions. Each page shows the gate as a centred empty state in place of
its content:

| Access | When | Title | Primary | Secondary |
|---|---|---|---|---|
| `loading` | no state yet | Checking the host shell… (spinner) | — | — |
| `stopped` | `stopped` / `stopping` | The host shell is off | Start host shell | Host shell settings |
| `starting` | `starting` | Starting the host shell… (spinner) | — | — |
| `failed` | `failed` | The host shell failed (message = error) | Host shell settings | — |
| `noHost` | `pairing: null` | No host shell for this machine | Host shell settings | — |
| `noPin` | `pinSet: false` | Set a host shell PIN | Host shell settings | — |
| `locked` | session missing or expiring within 30 s | The host shell is locked | Unlock (PIN dialog) | Host shell settings |

"Host shell settings" opens Preferences → `host-shell`. The unlock dialog (`pages/shell/HostUnlock.tsx`) calls
`hostShell.unlock(pin)` and shows the daemon's message (for example, a wrong PIN with the attempts left).

## 4. Shell page

The Shell page reuses the Terminals page (`pages/terminals/TerminalsLayout.tsx`) inside a `TerminalsScope`
(`features/terminals/scope.ts`) with the host scope `HOST_TERMINALS` (`features/shell/scope.ts`). That scope has its
own session store and UI store, uses the host client, and is online only while the host is `ready`. Changes from
the Terminals page:

- Rows are titled `<kind> · <folder>` (`hostSessionTitle`), where the folder is the cwd basename or `Home`.
- There is one launcher, `Shell` ("Start a shell on this computer"), and no Claude launcher.
- Instead of the session list, the gate fills the page (`gateEmpty`).

## 5. Emulator page

A segmented **Device** switch (`Android` | `iOS`) sits above one `DevicePanel` per kind. The panel is remounted
when the kind changes. A kind is a `DeviceKind` (`features/emulator/devices.ts`):
`{ id, label, icon, screen: ScreenSpec, labels: DeviceLabels, useControls() }`. `useControls()` turns the host
status into a `DeviceSnapshot` (`androidSnapshot` / `iosSnapshot` in `features/emulator/model.ts`).

### Toolbar (`DeviceToolbar`)

- A target dropdown: AVDs on Android; simulators as `<name> · <runtime>` on iOS. It is disabled while the device
  runs. With no targets it shows `No virtual devices` / `No simulators` instead.
- A state badge: Unavailable, Stopped, Starting…, Running, Stopping… or Failed. iOS states map
  `shutdown→stopped`, `booting→starting`, `booted→running` and `shutting_down→stopping`.
- **Start** while stopped. While the device is active: **Stop** (SIGTERM) and **Force kill** (SIGKILL, destructive,
  with a per-kind tooltip).
- Sandbox link: a badge (Not linked / Connected / Not connected / Linked to another sandbox) and
  **Link to sandbox** / **Link again**, using the active connection's API URL and token. It is hidden when the kind
  is unavailable, and disabled with "Connect to a sandbox…" when there is no sandbox.
- Refresh.

### Screen (`ScreenStage`)

The canvas shows the live stream (`features/emulator/screen/session.ts`). A side rail holds the device keys:

| Kind | Socket | Device query | Codec | Keys | Pointers |
|---|---|---|---|---|---|
| Android | `/v1/android/screen` | `serial` | H.264 (WebCodecs) when it decodes, else JPEG | Back, Home, Recent apps, Rotate, Volume −/+, Power | up to `LIMITS.maxAndroidPointerId + 1` |
| iOS | `/v1/ios/screen` | `udid` | JPEG (MJPEG) only | Home, Lock | 1 |

Both kinds take touch, wheel scroll, keyboard keys (Enter, Backspace, Tab, Escape and the arrows) and pasted or
typed text, all using the same message shapes. An overlay covers the canvas until frames arrive. It uses per-kind
copy for off, booting, stopping, failed and unavailable, then the shared Connecting… / Screen disconnected /
The screen stream failed overlays, the last two with **Reconnect**.

### iOS unavailable reasons

`GET /v1/ios` reports `available: false` with a `reasonCode`. The overlay title is
"No iOS Simulator on this host", and its message is:

| `reasonCode` | Message |
|---|---|
| `disabled` | The iOS Simulator is turned off on this host (TESSERACT_IOS). |
| `not_macos` | The iOS Simulator needs a Mac. Link a macOS host to this machine to use it. |
| `no_xcode` | Xcode is not installed on this Mac. Install Xcode and its command line tools (xcrun simctl). |
| `no_idb` | idb is not installed on this Mac. Install idb and idb_companion to stream and drive the simulator. |

When there is no code, the daemon's `reason` is shown.

## 6. Hooks and IPC

| Hook (`features/host-shell/hooks`) | Purpose |
|---|---|
| `useHostAccess()` / `useHostClient()` | access state and the proxied host client |
| `useHostGate()` | gate model, start/unlock/settings actions, lock |
| `useHostDevice(api)` | shared query and mutations for one device kind: `status`, `start`, `stop`, `kill`, `stopWith(signal)` (promise), `link`, busy-aware polling (2 s while starting or stopping, otherwise 10 s) |
| `useHostEmulator()` | Android: `androidStatus`, `startEmulator(avd)`, `stopEmulator(signal)`, `linkSandbox` |
| `useHostSimulator()` | iOS: `iosStatus`, `bootSimulator(udid)`, `shutdownSimulator(signal)`, `linkIosSandbox` |
| `useHostDevices()` | both kinds for lists: `{ android, ios, refresh, stop(kind, signal) }` |

Query keys are `["hostShell", "emulator", "android" | "ios", <host url>]`, all under `HOST_EMULATOR_KEY`, so
the machine-scope refresh covers them.

`hostShell` IPC device methods (main validates every argument):

| Method | Daemon call |
|---|---|
| `androidStatus()` | `GET /v1/android` |
| `startEmulator(avd)` | `POST /v1/android/emulator`, then the status |
| `stopEmulator(signal?)` | `DELETE /v1/android/emulator[?signal=SIGKILL]`, then the status |
| `linkSandbox(url, token)` | `POST /v1/android/link` |
| `iosStatus()` | `GET /v1/ios` |
| `bootSimulator(udid)` | `POST /v1/ios/simulator`, then the status |
| `shutdownSimulator(signal?)` | `DELETE /v1/ios/simulator[?signal=SIGKILL]`, then the status |
| `linkIosSandbox(url, token)` | `POST /v1/ios/link` |

## 7. Host devices on the Processes page

The **Host devices** group (group id `emulator`, after the sandbox runtime groups) lists, from `useHostDevices()`
through `hostDeviceSnapshots()` (`features/processes/model.ts`):

- the Android emulator while it is starting, running or stopping: title = AVD, subtitle = serial, meta = uptime;
- the booted, booting or shutting-down iOS simulator: title = device name, subtitle `iOS Simulator · <runtime>`.

Row ids are `android` / `ios`. **Stop** sends SIGTERM. **Force kill** asks for confirmation, then sends SIGKILL
through the same hooks. Running host devices count toward the sidebar's Processes badge. When the host is not
`ready`, the group is empty: the page does not show the host gate.

## 8. Fixtures

`fixtures/host` provides the host proxy (tickets, terminals, `/v1/android`) and an iOS Simulator whose devices
start shut down (`bootHostSimulator`, `shutdownHostSimulator` and `linkHostSimulator` change it;
`resetHostFixtures` restores it). `fixtures/projects-emulator` provides the Android emulator.
