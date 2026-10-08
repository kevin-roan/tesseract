# Spec: Onboarding (setup wizard): Docker, sandbox image, Android emulator, Claude, pairing

Scope: the first-run setup wizard of `apps/electron` ("Tesseract", `dev.tesseract.Desktop`). It works like
Android Studio's setup wizard and looks like Linear. It takes a machine with nothing installed to a running sandbox,
an optional host Android emulator (SDK, system image and AVD) and a paired phone.

**The GTK app has no onboarding.** It assumes the operator already ran `bun run sandbox up --build` from a checkout
(`docs/runbooks/getting-started.md`). In GTK the only first-run affordances are the banner
`No sandbox is configured on this machine yet.` with **Set Up** (opens Preferences › Connection) and the Android
blocker `This computer has no Android virtual device; create one in Android Studio`. This spec is therefore a
**design** spec. Every visual value comes from existing GTK widgets: the wizard reuses the GTK Settings dialog
geometry (`preferences/window.py`, `theme/extras/dialogs.py`) and the Dialog/Notice/Progress widgets. Every
operational value comes from `infra/` and the architecture docs. Strings marked *(GTK)* are verbatim from
`tesseract_desktop/strings.py`. All other strings are new, are final, and go into a labels module as written.

Sources read: `infra/scripts/sandbox`, `infra/compose/*.yml`, `infra/compose/.env.example`,
`infra/docker/sandbox/Dockerfile`, `.dockerignore`, `docs/runbooks/getting-started.md`,
`docs/architecture/00-blueprint.md` §3/§4, `docs/architecture/app-runs-and-emulator.md` §2,
`apps/desktop/tesseract_desktop/{config/discovery.py,claude/host.py,widgets/*,theme/*,strings.py,preferences/window.py}`,
plus the live Google SDK repository XMLs, the Docker Desktop download endpoints and the Docker docs (fetched 2026-10-06).
Companion specs: [theme.md](theme.md) (tokens, components, motion; this spec does not repeat them),
[host-android.md](host-android.md) §3 (how the host daemon finds the SDK; the wizard's output must match it),
[preferences.md](preferences.md) §4 (`config.json`), [shell.md](shell.md) §5 (startup).

---

## 0. Summary of decisions

| Topic | Decision |
|---|---|
| Where | A separate frameless `BrowserWindow`, 880×620 (the GTK Settings dialog size `SETTINGS_SIZE`), min 760×560, centered. On first run it opens instead of the main window. Later it can be opened from the banner **Set Up** action, the main menu item `Set up Tesseract…` and Settings › Connection. |
| Layout | Same as the GTK Settings dialog: a 200px step rail on the window canvas and an inset content panel holding a breadcrumb header, a scrolling body and the dialog footer. |
| Steps | `welcome` → `docker` → `claude` → `sandbox` → `build` → `android` (optional) → `pair` (optional) → `finish` |
| Engine | Docker Engine 24+ with Compose ≥ 2.24.0 and buildx (BuildKit). Docker Desktop on macOS/Windows; Docker Engine (or Docker Desktop for Linux) on Linux. Podman is detected and refused with a reason (§5.6). |
| Stack control | The main process ports `infra/scripts/sandbox` to TypeScript (§6.3), because bash is not available on Windows. The installer bundles the build context (§6.6). |
| Image | Built locally from the bundled context with `docker buildx build --progress=rawjson`. "Pull" is only offered when a registry ref is configured; none exists today (§6.5, open issue O1). |
| Android | The wizard is its own SDK manager: it reads Google's repository XML, downloads `emulator`, `platform-tools` and one `system-images;android-<api>;google_apis;<abi>`, verifies sha1, unzips them in the sdkmanager layout, writes license files and writes the AVD (`<name>.ini` + `config.ini`) itself. No `sdkmanager`, `avdmanager` or Java is needed. |
| Persistence | Keys in the shared `config.json` ([preferences.md §4](preferences.md)); the stack env file is `<userData>/sandbox/.env` (0600). |

---

## 1. Architecture (Electron)

```
renderer (React, wizard route)  ──IPC──>  main: OnboardingController (single state object, pushed on change)
                                            ├─ DockerProbe        execFile docker … (15 s timeout each)
                                            ├─ DockerInstaller    download + sha256 + elevated install / pkexec
                                            ├─ ClaudeProbe        read-only ~/.claude* (host-android.md §4.6 rules)
                                            ├─ SandboxStack       env file + compose file list + docker compose …
                                            ├─ ImageBuilder       docker buildx build --progress=rawjson (child)
                                            ├─ SdkRepository      fetch + parse repository2-3.xml / sys-img2-3.xml
                                            ├─ SdkInstaller       ranged download, sha1, unzip (modes, symlinks)
                                            ├─ AccelCheck         emulator -accel-check, /dev/kvm, WHPX, HVF
                                            ├─ AvdWriter          <avdHome>/<name>.ini + <name>.avd/config.ini
                                            └─ Pairing            docker exec … tesseract-controller pair --json
```

- All processes, downloads, file writes and privilege elevation run in **main**. The renderer only receives
  `OnboardingState` snapshots on channel `onboarding:state` and calls the typed invoke channels below. Secrets
  (TS auth key, sandbox token) never go to the renderer except the pairing link, which the pair step must show.
- Invoke channels: `onboarding:get`, `onboarding:goto(step)`, `onboarding:docker:check`,
  `onboarding:docker:install(option)`, `onboarding:docker:start`, `onboarding:claude:check`,
  `onboarding:claude:createDir`, `onboarding:sandbox:save(choices)`, `onboarding:build:start(mode)`,
  `onboarding:build:cancel`, `onboarding:android:catalog`, `onboarding:android:acceptLicense(id)`,
  `onboarding:android:install(plan)`, `onboarding:android:cancel`, `onboarding:pair:load`,
  `onboarding:finish`, `onboarding:openExternal(urlKey)`. `openExternal` only takes keys of the URL table in §12,
  never free URLs.
- Child processes use `execFile`/`spawn` with argument arrays and never a shell (the only exception is `pkexec sh <file>`
  for the Docker convenience script, §5.5). Environment = `process.env` plus the PATH fix of §5.1.
- Long operations (install, build, SDK download) belong to main, not to the window. Closing the wizard window while one
  runs opens a confirmation (§10.4); confirming cancels the operation.
- Every operation writes a log ring buffer of the last **200** lines (`LOG_LIMIT`, the host shell value). The
  step's "Details" disclosure shows it. Lines are redacted: `TS_AUTHKEY`, `TESSERACT_TOKEN`, `token=` query values and
  `tskey-…` patterns become `…`.

---

## 2. Window and layout (pixel spec, graphite dark; light = graphiteLight tokens from theme.md §2.1)

### 2.1 Window

- `BrowserWindow({ width: 880, height: 620, minWidth: 760, minHeight: 560, frame: false, show: false,
  backgroundColor: '#09090A', titleBarStyle: 'hidden' (macOS), trafficLightPosition: {x: 14, y: 14} })`;
  show on `ready-to-show`. Title `Set up Tesseract`. When opened from the main window it is a modal child of it.
- Root (`.to-settings-root` equivalent): background `background` `#09090A`, the whole window. In GTK the radius is 12
  because it is a sheet; for the window the radius is the OS's.
- Two columns: **rail** (fixed 200px) | **content panel** (flex).

### 2.2 Step rail (`.to-settings-nav`)

- `min-width: 200px; padding: 12px 8px;` vertical box, gap 4. macOS: top padding 40 so the traffic lights clear the
  overline. The empty top area of the rail is a drag region (`-webkit-app-region: drag`).
- Overline label `Set up` (overline variant: 12/16, weight 500, `textSecondary`), padding `4px 8px`.
- Step list: rows `min-height: 28px; padding: 0 8px; margin-bottom: 1px; border-radius: 6px; color: textSecondary`.
  The row content is a 16px status glyph, a 10px gap, the step label (label variant 13/18, weight 500), then a flex
  spacer and an optional trailing caption (`Optional`, 12/16, `textTertiary`).
  - hover (clickable rows only): bg `backgroundElement` `#1E1E20`.
  - current: bg `backgroundSelected` `#232325`; text and glyph `text` `#E3E3E4`.
  - clickable = status `done`, `skipped`, `error`, or the current step. Steps after the first unfinished required step
    are not clickable: color `textTertiary`, `cursor: default`, no hover.
- Status glyphs (Lucide, 16px, stroke 1.5 per theme.md §8):

  | status | icon | color |
  |---|---|---|
  | `pending` | `circle` | `textTertiary` |
  | `active` | `circle-dot` | `text` |
  | `running` (an operation in progress in that step) | 16px spinner (theme.md progress ring, indeterminate) | `accentStrong` `#9EA6F0` |
  | `done` | `circle-check` | `success` `#4CB782` |
  | `skipped` | `circle-dashed` | `textTertiary` |
  | `error` | `circle-alert` | `danger` `#EB5757` |
  | `warning` (done with warnings) | `triangle-alert` | `warning` `#F2C94C` |

- Rail footer (pinned to the bottom, padding 8): caption `Tesseract {version}` (12/16, `textTertiary`).

### 2.3 Content panel (`.to-settings-content`)

- `margin: 8px 8px 8px 0; border-radius: 10px; border: 1px solid border (rgba(255,255,255,0.08)); background: surface #121213;`
  vertical: header, body (flex, scrolls), footer.
- **Header** (`.to-settings-content > .to-dialog-header`): `padding: 8px 8px 8px 16px; min-height: 24px;
  border-bottom: 1px solid divider (rgba(255,255,255,0.06))`. The header is a drag region; its buttons are `no-drag`.
  - Left: breadcrumb (theme.md / `widgets/dialog.py Breadcrumb`). The chip has no background or padding (settings
    variant): 16px icon `textSecondary` (Lucide `settings`) + `Set up` (bodyStrong 13/20 weight 500, `textSecondary`),
    gap 6, `chevron-right` 16px `textTertiary`, step title (bodyStrong, `text`). The title cross-fades on step change.
  - Right, gap 4: caption `Step {n} of {total}` (12/16 `textTertiary`, tabular numbers; counts only the visible
    steps, welcome and finish included). On Linux/Windows the window controls follow (theme.md §6.9: 24×24, radius 6,
    gap 6, close hover `dangerSolid` + white glyph), separated by the titlebar divider (1px wide, margin `6px 4px`,
    `divider`). On macOS the native traffic lights are in the rail instead.
- **Body**: a scroll area with overlay scrollbars (thumb 5px, `rgba(255,255,255,0.12)`, hover `.22`). The page box has
  `margin: 20px 24px 32px 24px`, vertical gap 24 between groups, and content max-width 640px (left aligned, like the
  settings pages).
  - **Step hero** (first child): a 36×36 icon badge (`.to-icon-badge.large`: radius 8, bg `backgroundElement`,
    1px `border`, 16px icon `textSecondary`), 12px gap, then a column: title **h2** (Inter Display 18/24, weight
    600, letter-spacing −0.2px, `text`) and a description in **body** (13/20, `textSecondary`), gap 4. Max 72ch.
  - **Group** (`preferencesgroup`): heading 13px/500 `text`; description 12px `textSecondary`; 8px gap to the
    boxed list; optional header suffix aligned right (28px flat icon button, e.g. `refresh-cw` with tooltip
    `Check again`).
  - **Boxed list**: bg `surface`, 1px `border`, radius 8; rows divided by 1px `divider`. Row: min-height 44,
    horizontal margin 14, title 13px `text`, subtitle 12px `textSecondary`, gap 2, vertical margin 8. Row suffix
    buttons are 28px tall. Check and radio controls are 14×14 with 1px `borderStrong`; a check has radius 4; checked =
    `accent` fill with a white glyph.
- **Footer** (`.to-dialog-footer`): `padding: 8px 12px 12px 16px`, no border. Start group (gap 8): flat `Back`.
  End group (gap 8): optional secondary (`Skip`, `Cancel`) and the primary. Buttons are 30px tall
  (`CONTROL_HEIGHT.sm + 2`). Primary (`.to-primary`): bg `accent` `#5E6AD2`, text white, radius 999,
  `padding: 0 14px`, 13/18 weight 500; hover `filter: brightness(1.1)`; active bg `accentPressed` `#4F5BC4`;
  disabled `opacity: .5`. Secondary (`.to-secondary`): bg `surfaceElevated` `#1A1A1B`, 1px `border`, radius 999,
  `padding: 0 14px`; hover bg `backgroundElement` with border `borderStrong`. Flat: transparent, hover
  `backgroundElement`. Enter activates the primary (the GTK `set_default_widget`). Esc = Back, except during an
  operation, where Esc does nothing.

### 2.4 Building blocks (all reusable components in `apps/electron/src/renderer/components/onboarding/`)

| Component | Spec |
|---|---|
| `CheckRow` | A boxed-list row. Prefix: a 16px status glyph (spinner while checking; `circle-check` success; `triangle-alert` warning; `circle-x` danger; `circle` textTertiary when not run). Title + subtitle. Suffix: either a `StatusBadge` (min-height 20, `padding: 0 8px 0 7px`, radius 999, 12px/500, transparent with a 1px `border`, 6×6 tone dot, tone text) or one row button (28px, secondary or primary). |
| `ChoiceRow` | Radio row (GTK `RadioRows`): a 14px radio prefix, title + subtitle (up to 2 lines); disabled rows `opacity .5` with the reason as subtitle. |
| `ComponentRow` | Check row: a 14px check prefix, title, subtitle, and a trailing caption with the size estimate (12/16 `textTertiary`, tabular). A locked row shows a disabled checked check and the caption `Always included`. |
| `FieldRow` | GTK `entry_row`: title/subtitle on the left; on the right a 32px input, radius 6, bg `surfaceElevated`, 1px `border`, min-width 320 (240 when the window is < 820px wide). Focus: border `accent` + 1px `focusRing` outline at offset 1. Error: border `danger`, and the message (12px `danger`) shows under the title instead of the subtitle. Password variant has an eye toggle (Lucide `eye`/`eye-off`, 28px flat). |
| `StepperRow` | A number input with − / + 24px flat buttons inside a 32px field; tabular numbers; unit caption after it (`cores`, `GB`). |
| `ProgressBlock` | Top line: label (bodyStrong) left, percentage right (caption 12/16 `textSecondary`, tabular, hidden when indeterminate). 8px gap, then the progress bar: height 4, track = tone color at 20% alpha, radius 2, fill = tone color (default tone `info` `#4EA7FC`; `success` when finished, `danger` on failure). Indeterminate = shimmer (theme.md §7.3: 40% gradient segment, 1440ms linear). 6px gap, then a sub line (caption, `textSecondary`, single line, ellipsized in the middle), e.g. `[android 2/2] COPY --from=android-sdk …` or `412 MB of 1.9 GB · 18.2 MB/s`. |
| `LogDisclosure` | A flat link button `Show details` / `Hide details` (`chevron-right` rotates 90° in 180ms) that reveals a log view: bg `codeBackground` `#09090A`, radius 8, 1px `border`, padding 12, Geist Mono 12/18, `textSecondary`, height 220, sticks to the bottom unless the user scrolls up, in which case a 28px round jump button appears (theme.md `.to-jump-button`). Header actions: `Copy log` (flat 24px, Lucide `copy`). |
| `Notice` | GTK `Notice` (theme.md §6.8): padding `8px 10px`, radius 8, 1px `border`, transparent; a 16px tone icon (`info`/`triangle-alert`/`circle-alert`/`circle-check`), gap 10; optional title bodyStrong; message 12/18 `textSecondary` wrapping; optional action = flat 24px button, `padding 0 8px`, 12px, tone color. |
| `CommandBlock` | A copyable command for manual fixes: `.to-copy-field` look (min-height 32, `padding: 0 4px 0 10px`, radius 6, 1px `border`, bg `surface`), Geist Mono 12/18 `textSecondary`, middle ellipsis, a 24px copy icon button (tooltip `Copy` *(GTK)*); toast `Copied` on click. |
| `LicenseViewer` | Title bodyStrong; a scroll box 240px tall, bg `codeBackground`, radius 8, 1px `border`, padding 12, Geist Mono 12/18 `textSecondary`, `white-space: pre-wrap`; under it a check row `I accept the terms of this license`. |

Toasts: GTK `Adw.Toast` look (theme.md §6.4: radius 8, bg `surfaceElevated`, 1px `border`, shadow level 3),
bottom-center of the content panel. Default timeout 3 s; failures 6 s.

---

## 3. State model and state machine

### 3.1 Types (`apps/electron/src/shared/onboarding.ts`)

```ts
type StepId = "welcome" | "docker" | "claude" | "sandbox" | "build" | "android" | "pair" | "finish";
type StepStatus = "pending" | "active" | "running" | "done" | "warning" | "skipped" | "error";
const STEP_ORDER: StepId[] = ["welcome","docker","claude","sandbox","build","android","pair","finish"];
const OPTIONAL_STEPS: StepId[] = ["android","pair"];

type HostInfo = { platform: "linux"|"darwin"|"win32"; arch: "x64"|"arm64"; osVersion: string; distro?: { id: string; idLike: string[]; versionId: string };
                  cpus: number; memBytes: number; translated: boolean /* Rosetta / x64 emulation on arm64 */ };

type DockerKind = "engine" | "desktop" | "rootless" | "podman" | "colima" | "orbstack" | "unknown";
type DockerDaemon = "unknown" | "reachable" | "stopped" | "permission" | "unresponsive";
type DockerReport = {
  cli: { path: string; version: string } | null;
  daemon: DockerDaemon; daemonError: string | null;
  kind: DockerKind; context: string | null;
  server: { version: string; os: string; arch: string; ncpu: number; memBytes: number; rootDir: string; rootless: boolean } | null;
  compose: string | null; buildx: string | null;               // versions, null = missing
  linux?: { inDockerGroup: boolean; socketGroup: string | null; systemd: boolean; serviceActive: boolean | null };
  windows?: { wsl: string | null; virtualization: boolean | null; desktopExe: string | null };
  mac?: { desktopApp: string | null; minOs: string | null };
  checks: Check[];                                              // rendered as CheckRows (§5.3)
};
type Check = { id: string; status: "ok" | "warning" | "error" | "pending"; title: string; detail: string; action?: ActionKey };

type DockerPhase =
  | { kind: "idle" } | { kind: "checking" }
  | { kind: "installing"; stage: "downloading" | "verifying" | "installing"; received: number; total: number | null }
  | { kind: "starting"; since: number }
  | { kind: "needs-relogin" } | { kind: "needs-reboot" }
  | { kind: "ready" } | { kind: "blocked"; reason: string };

type BuildPhase =
  | { kind: "idle" }
  | { kind: "preflight" }
  | { kind: "building"; fraction: number | null; step: string; cachedSteps: number; doneSteps: number; totalSteps: number | null; bytes?: { current: number; total: number } }
  | { kind: "pulling"; fraction: number | null; detail: string }
  | { kind: "starting" }                                   // compose up -d
  | { kind: "waiting"; since: number }                     // health
  | { kind: "pairing" }                                    // pair --json + candidate probe
  | { kind: "done"; apiUrl: string; imageId: string }
  | { kind: "failed"; phase: "preflight"|"build"|"pull"|"up"|"health"|"pair"; message: string }
  | { kind: "cancelled" };

type AndroidPhase =
  | { kind: "idle" } | { kind: "unsupported"; reason: string }
  | { kind: "loading-catalog" } | { kind: "choosing" }
  | { kind: "licenses"; pending: string[] }
  | { kind: "installing"; pkg: string; index: number; count: number; stage: "downloading"|"verifying"|"extracting"; received: number; total: number }
  | { kind: "accel"; result?: AccelResult }
  | { kind: "creating-avd" }
  | { kind: "done"; sdkRoot: string; avd: string; warnings: string[] }
  | { kind: "failed"; message: string } | { kind: "cancelled" };

type OnboardingState = {
  step: StepId; statuses: Record<StepId, StepStatus>;
  host: HostInfo; docker: DockerReport | null; dockerPhase: DockerPhase;
  claude: HostClaudeState[] | null;                      // host-android.md §4.6 type
  choices: SetupChoices; build: BuildPhase; android: AndroidPhase;
  pair: { link: string; url: string; name: string | null; local: boolean } | null;
  log: Record<"docker"|"build"|"android", string[]>;
};
```

### 3.2 Transitions

```
welcome ──Continue──> docker
docker:  idle ─auto─> checking ─┬─> ready ───────────────────────────────Continue──> claude
                                ├─> blocked(missing CLI)  ─Install─> installing ─┬─> checking
                                │                                               ├─> needs-relogin (Linux group) ─(app restart)─> checking
                                │                                               └─> needs-reboot (Windows WSL / Desktop) ─(app restart)─> checking
                                ├─> blocked(stopped) ─Start─> starting ─(poll 2 s)─> checking | blocked(start timeout)
                                ├─> blocked(permission) ─Fix─> needs-relogin
                                └─> blocked(outdated / podman / unsupported OS)   (Check again only)
claude:  checking ─> signed-in | missing | invalid | keychain   (Continue always enabled; not signed in = warning)
sandbox: editing ─(valid)─ Continue ─> build                  (existing sandbox found → "Use existing" jumps to pair with build=done)
build:   idle ─Start─> preflight ─> building|pulling ─> starting ─> waiting ─> pairing ─> done ──Continue──> android
                         └────────── failed(phase) ──Retry──> (resumes at that phase)   Cancel ─> cancelled ─Start again─> preflight
android: idle ─auto─> (unsupported | loading-catalog ─> choosing) ─Install─> licenses ─(all accepted)─> installing
                ─> accel ─> creating-avd ─> done ──Continue──> pair         Skip ─> pair (status skipped)
pair:    loading ─> ready | error                              Continue/Skip ─> finish
finish:  Open Tesseract ─> writes config, closes wizard, opens the main window
```

Rules:
- `Continue` is enabled only when the step's exit condition holds: docker `ready`; claude any result; sandbox form
  valid; build `done`; android `done` or `unsupported` (on unsupported, Continue = Skip); pair always.
- `Back` is disabled while the step status is `running`; the footer then shows `Cancel` (secondary) instead of Skip.
- Going back to `docker` or `sandbox` after the build is `done` does not invalidate it. If sandbox choices change
  after a build, `build` goes back to `pending` and the rail shows it as not done.
- Resume: `config.json.onboarding` (§3.3) is written after every step change, so a restart (re-login, reboot) reopens
  the wizard at the saved step, and an `auto` check runs on entry.

### 3.3 Persistence (`config.json`, read-modify-write, keys preserved; [preferences.md §4](preferences.md))

```jsonc
"onboarding": { "version": 1, "step": "build", "statuses": { "docker": "done", … }, "completedAt": null },
"sandboxStack": {                      // written by the sandbox step, used by SandboxStack/the CLI
  "envFile": "<userData>/sandbox/.env", "project": "tesseract", "mode": "local",
  "image": "tesseract/sandbox:latest", "builtAt": "2026-10-06T21:00:00Z", "components": ["android","flutter","mono","whisper"]
},
"androidSdkRoot": "/home/u/.local/share/tesseract/android-sdk",   // only if not the platform default (§7.1)
"androidAvd": "Tesseract_API_36"
```

The build step also writes `url`, `token`, `name` and `pairingUrl` (the same keys as Connection › Save) from the pairing
result, so the main window connects with source `file`.

### 3.4 When the wizard opens

At startup (shell.md §5.1, between steps 3 and 7):
1. If `onboarding.completedAt` is set, do not open it.
2. Else, if a connection config exists (file or env), do not open it.
3. Else run Docker discovery (§6.7: container `<project>-sandbox-1`, where project = the saved `sandboxStack`
   project, else `TESSERACT_COMPOSE_PROJECT`, else `tesseract`; `pair --json`, candidate probe) with a **2.5 s** overall
   timeout (`discoverHealthySandbox`, `apps/electron/src/core/connection/discovery.ts`). It counts only when a
   candidate answered `/v1/health`. Then save it as the connection and call `completeOnboardingFromDiscovery`
   (`apps/electron/src/main/services/onboarding.ts`): `onboarding.completedAt` = now, statuses
   `docker`/`sandbox`/`build` = `done`, the others `skipped`; open the main window. This covers existing users,
   such as the GTK user's live `tesseract` stack. `TESSERACT_DISABLE_DISCOVERY=1` skips this step (tests; it is also
   skipped with fixtures and in test mode).
4. Else, open the wizard and do not create the main window until it finishes.

The banner `No sandbox is configured on this machine yet.` / **Set Up** *(GTK)* opens the wizard at `docker`.

---

## 4. Step: Welcome (`welcome`)

- Rail label `Welcome`. Hero icon `sparkles`. Title `Welcome to Tesseract`. Description:
  `Tesseract runs Claude Code and your builds in a sandbox on this computer and lets you follow them from your phone. This setup installs what it needs and takes about an hour, mostly for the first image build.`
- Group `What happens` (no description), a boxed list of read-only rows with leading 16px icons in `textSecondary`:
  1. `container` — `Docker` / `Checks Docker, or helps you install and start it`
  2. `mouse-pointer-2` — `Claude Code` / `Uses the Claude Code login of this computer`
  3. `box` — `Sandbox` / `Builds the sandbox image with the tools you pick`
  4. `smartphone` — `Android emulator` / `Optional: downloads an emulator and a system image, like Android Studio`
  5. `qr-code` — `Phone` / `Optional: pairs the Tesseract app`
- Group `Requirements`: CheckRows filled from `HostInfo` (no Docker calls yet):
  - `Disk space` — `{free} free in {path}` (path = the user's home); warning below 40 GB:
    `About 40 GB is recommended (image, build cache, Android system image)`.
  - `Memory` — `{GB} GB`; warning below 12 GB: `The sandbox uses up to 8 GB; 16 GB or more is comfortable`.
  - `Processor` — `{cpus} cores · {arch}`; Linux arm64 / Windows arm64 warning:
    `The Android emulator isn't available for this processor`.
- Footer: primary `Get started`. No Back.

---

## 5. Step: Docker (`docker`)

Rail `Docker`, hero icon `container`, title `Docker`, description
`The sandbox is a Docker container. Tesseract needs the Docker engine running, with Compose and BuildKit.`

### 5.1 PATH fix (main, once at startup)

Apps launched from Finder, the Start menu or a .desktop file have a minimal PATH. Before any probe, prepend the dirs
below that exist and are not already present:
- macOS: `/usr/local/bin`, `/opt/homebrew/bin`, `~/.docker/bin`, `/Applications/Docker.app/Contents/Resources/bin`,
  `~/.orbstack/bin`.
- Windows: `%ProgramFiles%\Docker\Docker\resources\bin`, `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin`.
- Linux: `/usr/bin`, `/usr/local/bin`, `~/bin` (rootless installs `dockerd-rootless.sh` there).

### 5.2 Detection algorithm (`DockerProbe.check()`, every command 15 s timeout = GTK `DOCKER_TIMEOUT_S`)

1. **CLI**: resolve `docker` on PATH (`docker.exe` on Windows). Missing → `cli: null`.
   `docker --version` → `Docker version 29.8.1, build 4a63305` (version = 2nd token without comma). If it prints
   `podman version …` (podman-docker shim) → `kind: "podman"`.
2. **Daemon**: `docker version --format '{{json .}}'`. Exit 0 and `.Server` not null → `reachable`;
   `server.version = .Server.Version`, `os`, `arch`. If any `.Server.Components[].Name` is `Podman Engine` → podman.
   On failure, classify stderr (case-insensitive):
   - contains `permission denied` and `docker.sock` → `permission` (Linux: not in the `docker` group);
   - contains `Cannot connect to the Docker daemon`, `Is the docker daemon running`, `error during connect`,
     `dockerDesktopLinuxEngine`, `docker_engine: The system cannot find the file`, or `connect: no such file` → `stopped`;
   - timeout → `unresponsive`; anything else → `stopped` with `daemonError` = the last stderr line (GTK `run_docker`
     rule: last non-empty line of stderr, else stdout).
3. **Info** (only when reachable): `docker info --format '{{json .}}'`:
   `OperatingSystem` contains `Docker Desktop` → `desktop`; `SecurityOptions[]` contains `name=rootless` → `rootless`;
   `NCPU`, `MemTotal`, `DockerRootDir`; `ClientInfo.Plugins[]` gives `{Name:"compose"|"buildx", Version}` (the main
   source for both versions). Fallbacks: `docker compose version --short`, `docker buildx version` (2nd token).
4. **Context**: `docker context show` → `default`, `desktop-linux`, `rootless`, `colima`, `orbstack`, …;
   `colima`/`orbstack` set the kind. They are supported if compose and buildx pass.
5. **Linux extras**: `os.userInfo().username`; group membership from `id -nG` (the process's current groups) and from
   `getent group docker` (configured members; these differ right after `usermod`, which is why the step shows
   needs-relogin); socket group via `fs.stat('/var/run/docker.sock')` + `getent group <gid>`; `systemctl is-active
   docker.service` (system), `systemctl --user is-active docker.service` (rootless), `systemctl --user is-active
   docker-desktop` (Docker Desktop for Linux). `/etc/os-release` `ID`, `ID_LIKE`, `VERSION_ID`.
6. **Windows extras**: `wsl.exe --version` (**its output is UTF-16LE**: decode as `utf16le`, strip NULs; first line
   `WSL version: 2.6.1.0`); exit ≠ 0 or `wsl.exe` missing → WSL not installed. Virtualization:
   `powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled; (Get-CimInstance Win32_ComputerSystem).HypervisorPresent"`
   (either `True` = OK). Docker Desktop exe: `%ProgramFiles%\Docker\Docker\Docker Desktop.exe`, else
   `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`. Version: `cmd /c ver` build number (§5.4 minimums).
7. **macOS extras**: `/Applications/Docker.app` or `~/Applications/Docker.app`; `sw_vers -productVersion`; Rosetta
   translation `sysctl -in sysctl.proc_translated` = `1` (an x64 Electron on Apple silicon: still use the arm64 DMG).
   The minimum macOS comes from the appcast `<sparkle:minimumSystemVersion>` (currently `14.0.0`; the docs say
   "current and two previous major releases").

### 5.3 Checks shown (group `Docker on this computer`, header suffix refresh button, tooltip `Check again`)

| id | Title | ok subtitle | failure → status, subtitle, action |
|---|---|---|---|
| `cli` | `Docker` | `{kind label} {version}` (`Docker Engine`, `Docker Desktop`, `Docker (rootless)`, `Colima`, `OrbStack`) | error `Docker isn't installed` → action `Install…` (§5.5) |
| `daemon` | `Engine` | `Running · {server os}/{arch} · {context}` | `stopped`: error `The Docker engine isn't running` → `Start`; `permission`: error `You don't have access to the Docker engine` → `Fix…`; `unresponsive`: error `The Docker engine doesn't answer` → `Start` |
| `compose` | `Docker Compose` | `{version}` | missing: error `Docker Compose v2 is missing`; < 2.24.0: error `Docker Compose {v} is too old; 2.24 or newer is needed` (compose.tailscale.yml uses the `!reset` tag) → action `How to update` (opens `docker_compose_install`) |
| `buildx` | `BuildKit` | `buildx {version}` | missing: error `docker buildx is missing; the image needs BuildKit` → `How to install` (`docker_buildx_install`) |
| `engine_version` | `Engine version` | `{version}` | < 24.0: warning `Docker {v} is older than 24; update if the build fails` |
| `resources` | `Resources` | `{ncpu} CPUs · {mem} GB for containers` | `ncpu < 2` or `mem < 4 GiB`: error `The engine has {ncpu} CPUs and {mem} GB of memory; the sandbox needs at least 2 CPUs and 4 GB`; `mem < 8 GiB`: warning `The sandbox is limited to {limit} GB (it asks for 8 GB)` (Docker Desktop: + ` · raise it in Docker Desktop › Settings › Resources`) |
| `group` (Linux, engine, not rootless) | `docker group` | `{user} is in the docker group` | warning, see §5.5 Linux "Fix…" |
| `rootless` (when rootless) | `Rootless mode` | — | warning `With rootless Docker the sandbox can't share ~/.claude with this computer (file owners don't match). Claude Code inside the sandbox may not be signed in.` |
| `wsl` (Windows) | `WSL 2` | `WSL {version}` | missing: error `WSL 2 isn't installed` → `Install WSL…`; < 2.1.5: error `WSL {v} is too old; 2.1.5 or newer is needed` → `Update WSL` (`wsl --update`, elevated) |
| `virtualization` (Windows) | `Virtualization` | `Enabled` | error `Hardware virtualization is off; turn it on in the BIOS/UEFI settings` (no action; link `virtualization_help`) |
| `podman` (when podman) | `Podman` | — | error `Podman isn't supported yet: the sandbox needs Docker Compose 2.24+ features and BuildKit cache mounts. Install Docker Engine or Docker Desktop.` |

Rows appear one by one with a stagger as each probe finishes (§11). The step is `ready` when `cli`, `daemon`,
`compose`, `buildx` and `resources` are not `error` (and on Windows `wsl` too). Warnings are allowed; the rail then shows
`warning`.

### 5.4 Platform minimums (block with a reason)

- Windows 10 22H2 (build 19045) or Windows 11 23H2 (build 22631). Docker docs list Enterprise, Pro and Education; Home
  works with the WSL 2 backend. 8 GB RAM, SLAT, virtualization on.
  Message: `Docker Desktop needs Windows 10 22H2 (build 19045) or Windows 11 23H2 (build 22631) or newer`.
- macOS ≥ the appcast minimum (`14.0.0` today). Message: `Docker Desktop needs macOS {min} or newer`.
- Linux: any systemd distro for the guided path; others get the manual path.

### 5.5 Guided install and fixes (`Install…` opens an inline panel, not a dialog)

The install panel is a group titled `Install Docker` with one `ChoiceRow` per option, a `ProgressBlock` while it runs,
a `LogDisclosure` and footer actions. Before any `--accept-license` install, a check row is required:
`I accept the Docker Subscription Service Agreement` with a link `Read the agreement` (`docker_ssa`). The primary
`Install` stays disabled until it is ticked.

**macOS** (options: `Docker Desktop (recommended)`; `I'll install it myself` → opens `docker_mac_docs`):
1. URL: arm64 hosts (including translated ones) → `https://desktop.docker.com/mac/main/arm64/Docker.dmg`; Intel →
   `https://desktop.docker.com/mac/main/amd64/Docker.dmg`. Checksums: same dir + `checksums.txt`; line format
   `<sha256> *Docker.dmg` (verified). Download to `<userData>/downloads/Docker.dmg.part` with HTTP Range resume,
   then compare sha256 and rename. Progress: `{received} of {total} · {rate}`.
2. Install with one admin prompt:
   `osascript -e 'do shell script "<script>" with administrator privileges'` where the script is
   `hdiutil attach -nobrowse -quiet -mountpoint <tmp> <dmg> && <tmp>/Docker.app/Contents/MacOS/install --accept-license --user=<username>; s=$?; hdiutil detach -quiet <tmp>; exit $s`
   (every path single-quoted for the shell). User cancel (osascript error −128) → back to the choice with the toast
   `Installation cancelled`.
3. Start: `open -a Docker`, then poll (§5.7).

**Windows** (options: `Docker Desktop (recommended)` = all users, needs admin; `Docker Desktop for my user only` =
`--user`, no admin; `I'll install it myself` → `docker_windows_docs`):
1. If WSL is missing, the first sub-step is `Install WSL` (elevated):
   `Start-Process -Verb RunAs -Wait wsl.exe -ArgumentList '--install','--no-distribution'` → `needs-reboot`.
2. URL: `https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe` (`arm64` dir on ARM).
   Checksums: `…/win/main/amd64/checksums.txt` (assumed to use the macOS format; verify in e2e, open issue O6).
3. Run all users: `Start-Process -Verb RunAs -Wait -FilePath <exe> -ArgumentList 'install','--quiet','--accept-license','--backend=wsl-2','--always-run-service'`.
   Per user: run `<exe> install --user --quiet --accept-license --backend=wsl-2` directly. Exit code 0 → start
   (§5.7). The installer may ask for a sign-out or reboot (exit 3010 or text containing `restart`): `needs-reboot`.
4. If the user who installed is not the admin who elevated (all users): show a CommandBlock
   `net localgroup docker-users <user> /add` with the note
   `Membership in docker-users gives full control of this computer, like an administrator.`

**Linux** (options):
- `Docker Engine (recommended)`: subtitle `Installs Docker's packages for {PRETTY_NAME} with your password`.
  1. Distros covered by Docker's convenience script (`ID`/`ID_LIKE` ∈ ubuntu, debian, raspbian, fedora, centos,
     rhel): download `https://get.docker.com` to `<userData>/downloads/get-docker.sh` and show its sha256 in the log.
     `View script` opens it in the log view. Run `pkexec sh <file>`, then
     `pkexec systemctl enable --now docker.service`, then `pkexec usermod -aG docker <user>`.
     The three commands can run in one `pkexec sh -c '…'` so there is a single password prompt.
  2. Arch (`ID`/`ID_LIKE` arch): `pkexec pacman -S --needed --noconfirm docker docker-compose docker-buildx`, then
     enable and usermod as above.
  3. openSUSE: `pkexec zypper --non-interactive install docker docker-compose docker-buildx` (package names: verify,
     open issue O7), then enable and usermod.
  4. Other distros, no `pkexec` (`which pkexec` fails), or no polkit agent (pkexec exit 127, or stderr
     `No authentication agent`): fall back to the manual panel. It shows the same commands as CommandBlocks and the link
     `docker_engine_docs`.
  pkexec exit 126 = the user dismissed the prompt → toast `Installation cancelled`.
  After a successful usermod, the current session still lacks the group, so the phase is `needs-relogin`.
- `Docker Desktop for Linux`: opens `docker_desktop_linux_docs` in the browser (not automated). `Check again`
  afterwards.
- `I'll install it myself`: opens `docker_engine_docs`.

**Fix…** for `permission` (Linux): a panel with the Notice (warning)
`Your user isn't in the docker group, so Tesseract can't talk to the engine. Being in this group gives root-level control of this computer.`
and the actions `Add me to the docker group` (`pkexec usermod -aG docker <user>` → needs-relogin) and a CommandBlock
`sudo usermod -aG docker $USER`. **Needs-relogin** panel: Notice (info) title `Log out to finish`, message
`Log out and back in (or restart) so the docker group applies, then open Tesseract again. Setup continues where you left off.`
with action `Log out now` (`loginctl terminate-user <user>` after a confirm; hidden when there is no `loginctl`).
Footer primary `Quit Tesseract`. **Needs-reboot** panel: same layout, title `Restart to finish`, message
`Windows needs a restart to finish installing {what}. Setup continues where you left off.`, action `Restart now`
(`shutdown /r /t 0` after a confirm).

### 5.6 Notes per engine

- Rootless: allowed, with the `rootless` warning. Compose still works, but the `~/.claude` bind mount is owned by a
  subordinate uid inside the container (open issue O4).
- Docker Desktop on Linux: its context is `desktop-linux` (socket `~/.docker/desktop/docker.sock`); start it with
  `systemctl --user start docker-desktop`.
- Podman: refused (see the check). The compose files use the `!reset` tag, `create_host_path: false`,
  `cap_drop/cap_add` and BuildKit `RUN --mount=type=cache`; podman-compose does not handle all of them.

### 5.7 Start the engine (`Start`)

| Host | Command |
|---|---|
| macOS Docker Desktop | `open -a Docker` (or `open -b com.docker.docker`) |
| macOS Colima / OrbStack | `colima start` / `orb start` |
| Windows | spawn `Docker Desktop.exe` detached (`windowsHide`), or `docker desktop start` when `docker desktop version` works |
| Linux engine | `pkexec systemctl start docker.service` (a ticked `Start Docker when this computer starts` row adds `enable --now`) |
| Linux rootless | `systemctl --user start docker.service` |
| Linux Docker Desktop | `systemctl --user start docker-desktop` |

Then poll `docker version` every **2 s** (the emulator boot-poll interval of the host daemon), with a timeout of
**120 s** (macOS/Linux) or **180 s** (Windows). While polling, the `daemon` CheckRow shows a spinner and
`Starting the engine… {s}s`. On timeout: error `The engine didn't start within {n} seconds` with `Try again` and
the log (stdout/stderr of the start command).

---

## 6. Sandbox (`sandbox`) and Build (`build`)

### 6.1 Sandbox step UI

Rail `Sandbox`, hero icon `box`, title `Sandbox`, description
`Choose how your phone reaches the sandbox and which tools go into the image. You can rebuild with other choices later.`

**Existing sandbox** (shown first when found). On entry, run read-only:
`docker ps -a --filter label=com.docker.compose.project=<project> --filter label=com.docker.compose.service=sandbox --format '{{json .}}'`
and `docker image inspect <image> --format '{{json .}}'` (size, `Labels["org.opencontainers.image.version"]`, `Created`).
- Container found (running) → Notice (info) title `Found a sandbox`, message
  `{container} is running on this computer ({image}, {size}).`, action `Use it` → GTK discovery (§6.7) → statuses
  `sandbox`/`build` = `done` → go to `android`.
- Container found but stopped → the same Notice with message `{container} exists but is stopped.` and action
  `Start and use it` (compose up with *its* labels: `com.docker.compose.project.config_files` /
  `com.docker.compose.project.working_dir` from the container's labels; if those files don't exist, the action is
  hidden).
- Image only → under Components, a ChoiceRow pair: `Use the existing image` (`{image} · {size} · built {relative}`)
  / `Build a new image`.

**Group `Reachability`** (ChoiceRows; `TESSERACT_MODE`):

| id | Title | Subtitle | Extra fields when selected |
|---|---|---|---|
| `local` (default) | `This computer only` | `The controller listens on 127.0.0.1:{port}. Phones can't reach it; use this to try Tesseract or for development.` | none |
| `tailscale` | `Tailscale (sidecar)` | `A Tailscale container joins your tailnet as {hostname}; phones connect over HTTPS. Needs an auth key.` | FieldRows `Auth key` (password, placeholder `tskey-auth-…`, required unless the volume `<prefix>-tailscale` exists, subtitle `Used once for the first login`), `Tailnet domain` (placeholder `tail1234.ts.net`, required, regex `^[a-z0-9-]+(\.[a-z0-9-]+)+$`), `Hostname` (default `tesseract-sandbox`, regex `^[a-z0-9][a-z0-9-]{0,62}$`). Link `How to create an auth key` (`tailscale_keys`) |
| `host-tailscale` | `This computer's Tailscale` | `The ports are published on this computer's Tailscale address ({ip}).` | FieldRow `Bind address` prefilled from `tailscale ip -4` (first line). Disabled with subtitle `Tailscale isn't running on this computer` when that fails and the field is empty. Validation = `check_bind_addr` (§6.3). Recommended only on Linux: on Docker Desktop, publishing on a host Tailscale IP depends on the VM's port forwarding (open issue O5) |

**Group `Tools in the image`** (ComponentRows; build args). Size estimates come from the layer sizes of the current
`tesseract/sandbox:latest` (7.3 GB total):

| Row | Build arg | Subtitle | Size caption |
|---|---|---|---|
| `Base desktop` (locked) | — | `Debian, Node 24, Bun, Chromium, Xvnc, ffmpeg, Wine, Claude Code` | `Always included` (≈ 4.7 GB) |
| `Android SDK` | `WITH_ANDROID` | `JDK 17, platform-tools, android-36, build-tools 36.0.0 for Android builds` | `+0.7 GB` |
| `Flutter` | `WITH_FLUTTER` (+ `FLUTTER_VERSION`, default `3.47.5`) | `Flutter {version} with web and Linux artifacts` | `+1.4 GB` |
| `Mono` | `WITH_MONO` | `Squirrel.Windows installers for Electron apps` | `+0.4 GB` (estimate) |
| `Whisper` | `WITH_WHISPER` (+ `WHISPER_MODELS`) | `Local speech-to-text for voice notes` | `+0.6 GB` |

Under Whisper (when ticked) there is a chip group `Models` (GTK `ChipGroup`, multi-select variant: `base` (selected),
`small` (selected), `medium`, `large-v3-turbo`), and at least one must stay selected. `WHISPER_MODELS` = the selected ids
joined by a space, in the order shown. The first one becomes `ggml-model.bin`. Defaults = compose defaults: everything on,
`base small`. A Notice (info) under the group:
`Chromium and Wine are part of the base image and can't be turned off.`

**Group `Resources`** (StepperRows):
- `CPUs` — default `min(4, docker.ncpu)`, range 1…`ncpu` → `SANDBOX_CPUS`. Compose rejects `cpus` greater than the
  engine's count, so clamping is required.
- `Memory` — default `min(8, floor(memBytes·0.75 / GiB))` GB, range 2…`floor(memBytes/GiB)` → `SANDBOX_MEMORY=<n>g`.
- `Time zone` — read-only subtitle with the host zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) → `TZ`.

**Expander `Advanced`** (collapsed; chevron rotates 180ms): FieldRows `Compose project` (`tesseract`, regex
`^[a-z0-9][a-z0-9_-]*$`; message
`Use lowercase letters, digits, '-' and '_'` = the script's rule), `Image` (`tesseract/sandbox:latest`),
`Controller port` (`7700`) and `VNC port` (`5901`) (`require_port`: 1–65535), `Claude Code version` (`latest`),
`Shared Claude folder` (default `~/.claude`, read-only display + `Change…` folder picker → `TESSERACT_HOST_CLAUDE_DIR`),
`Docker-in-Docker` switch (`TESSERACT_DIND=1`, subtitle `Adds a privileged docker:dind container; read docs/architecture/security-model.md first`).

Validation runs live (debounce 150 ms). `Continue` writes the env file (§6.2) and goes to `build`.

### 6.2 Env file (`<userData>/sandbox/.env`, mode 0600, dir 0700, atomic write)

Written in `.env.example` order. Values are written unquoted when they match `^[A-Za-z0-9_./:@+-]*$`, otherwise in
double quotes, so the file round-trips through compose and `env_file_value()`:

```
TESSERACT_MODE=<mode>
TESSERACT_DIND=<1|empty>
TESSERACT_COMPOSE_PROJECT=<project>
TESSERACT_VOLUME_PREFIX=
TESSERACT_IMAGE=<image>
TS_AUTHKEY=<key|empty>            # tailscale only; cleared again after the first successful `up`
TS_TAILNET_DOMAIN=<domain>
TESSERACT_HOSTNAME=<hostname>
TESSERACT_BIND_ADDR=<ip|empty>
TESSERACT_CONTROLLER_HOST_PORT=<port>
TESSERACT_VNC_HOST_PORT=<port>
TESSERACT_HOST_CLAUDE_DIR=<absolute path>   # always explicit: compose's ${HOME} default is unset on Windows
SANDBOX_CPUS=<n>
SANDBOX_MEMORY=<n>g
TZ=<zone>
DEV_UID=<process.getuid() on Linux, else 1000>
DEV_GID=<process.getgid() on Linux, else 1000>
WITH_ANDROID=<true|false>
WITH_FLUTTER=<true|false>
FLUTTER_VERSION=3.47.5
WITH_MONO=<true|false>
WITH_WHISPER=<true|false>
WHISPER_MODELS="base small"
CLAUDE_CODE_VERSION=latest
```

On Linux `DEV_UID`/`DEV_GID` must match the owner of `~/.claude` (`.env.example`: "DEV_UID/DEV_GID must match its
owner"). Use `fs.stat(claudeDir).uid/gid` when the dir exists, else the process ids.

### 6.3 Compose rendering (TypeScript port of `infra/scripts/sandbox`, `apps/electron/src/main/sandbox/stack.ts`)

The port must be exact; `infra/scripts/sandbox` stays the reference implementation. Logic:

- `resolveStack()`: `project = TESSERACT_COMPOSE_PROJECT || "tesseract"` (regex above);
  `volumePrefix = TESSERACT_VOLUME_PREFIX || project` (regex `^[A-Za-z0-9][A-Za-z0-9_.-]*$`); ports default `7700`/`5901`,
  `^[1-9][0-9]{0,4}$` and ≤ 65535.
- `resolveMode()`: files = `[compose.yml]` plus
  - `tailscale` → `compose.tailscale.yml`; requires `TS_TAILNET_DOMAIN`, and `TS_AUTHKEY` unless
    `docker volume inspect <prefix>-tailscale` succeeds (script messages
    `TS_TAILNET_DOMAIN is required in tailscale mode (e.g. tail1234.ts.net, see infra/compose/.env.example)` and
    `TS_AUTHKEY is required for the first start in tailscale mode (see infra/compose/.env.example)`);
  - `host-tailscale` → `compose.local.yml`, `TESSERACT_BIND_ADDR` = configured or `tailscale ip -4`; refuse
    `0.0.0.0`, `::`, `[::]` and `*`, anything that is not dotted IPv4 (no leading zeros, each octet ≤ 255), and `0.*`
    (messages: `TESSERACT_BIND_ADDR=… would publish the sandbox on every host interface; use the host's tailscale IPv4` /
    `TESSERACT_BIND_ADDR=… is not an IPv4 address of this host; use the host's tailscale IPv4`);
  - `local` → `compose.local.yml`, `TESSERACT_BIND_ADDR=127.0.0.1`;
  - `TESSERACT_DIND=1` → `+ compose.dind.yml`; `TESSERACT_TAILSCALE_LOCALAPI=1` → `compose.tailscale-api-sidecar.yml`
    (tailscale mode) or `compose.tailscale-api.yml` (other modes; requires `<dir>/tailscaled.sock`). The wizard
    does not offer LocalAPI; Settings may later.
- Extra Claude accounts (`TESSERACT_HOST_CLAUDE_ACCOUNTS`): the wizard leaves this empty. If set by hand, write the
  override exactly like `resolve_claude_accounts()` to `<userData>/sandbox/compose.<project>.claude-accounts.yml`.
  The script writes `${XDG_STATE_HOME:-~/.local/state}/tesseract/…`; on Linux use the script's path so the CLI and the
  app share it.
- Command: `docker compose --project-name <project> --project-directory <ctx>/infra/compose --env-file <envFile> -f … <cmd>`.
  The process env must **not** carry `TESSERACT_*`, `COMPOSE_PROJECT_NAME`, `COMPOSE_FILE` or `COMPOSE_PROFILES` from
  the user's shell (the e2e harness unsets the same names). Exported variables win over the env file in compose, and
  the user's own `TESSERACT_COMPOSE_PROJECT` must not redirect the wizard. Export exactly the resolved
  `TESSERACT_COMPOSE_PROJECT`, `TESSERACT_VOLUME_PREFIX`, `TESSERACT_CONTROLLER_HOST_PORT`, `TESSERACT_VNC_HOST_PORT` and
  `TESSERACT_BIND_ADDR`, as the script does.
- `<ctx>` = the bundled context dir (§6.6). `compose.yml` builds with `context: ../..` relative to its own dir, and
  `compose.tailscale.yml` mounts `./tailscale`, so the bundle must keep the repo-relative layout.

### 6.4 Build step UI and flow

Rail `Build`, hero icon `hammer`, title `Build the sandbox`, description
`The first build downloads Debian packages, Node, Wine and the tools you picked. It takes 20 to 60 minutes; later builds reuse the cache.`

Body:
- Group `Summary` (property rows, inverted: title 12px `textSecondary`, value 13px `text`): `Image` `{image}`,
  `Tools` (`Android SDK · Flutter 3.47.5 · Mono · Whisper (base, small)` or `Base only`), `Reachability`
  (choice title), `Resources` `{cpus} CPUs · {mem} GB`, `Docker` `{kind} {version}`.
- `ProgressBlock` with the overall label by phase:
  `Checking disk space…`, `Building the image…`, `Downloading the image…`, `Starting the sandbox…`,
  `Waiting for the controller…`, `Reading the pairing link…`, `Sandbox ready`.
- Under it, a phase checklist (a boxed list of 4 compact CheckRows, min-height 36): `Build image`, `Start containers`,
  `Controller healthy`, `Pairing link`, each with a status glyph and a right caption with the duration
  (`2m 14s`, GTK `format_uptime` rules).
- `LogDisclosure` (collapsed by default; opens on failure).
- Footer: idle → primary `Build`; running → secondary `Cancel` (Back disabled); failed → secondary `Back` + primary
  `Retry`; done → primary `Continue`.

Flow (`ImageBuilder` + `SandboxStack`):
1. **Preflight**: re-run `DockerProbe` (it must still be `ready`). Free space: on Linux engines, `fs.statfs`
   (nearest existing ancestor of `DockerRootDir`; `/var/lib/docker` is root-only) must have ≥ the requirement. Docker
   Desktop and other VM engines have no reliable free-space API: show the warning Notice
   `Docker Desktop keeps images in its own disk. Make sure it has about {n} GB free (Docker Desktop › Settings › Resources).`
   and continue. Requirement = 15 GB + 2 × (sum of the chosen component sizes) + 2 × 4.7 GB base, rounded up to 5 GB
   (≈ 40 GB with everything, matching the runbook). Below it → failed(preflight)
   `Only {free} GB free on {path}; the build needs about {need} GB.` with `Check again`. Also make sure `~/.claude`
   exists (claude step, §8). Compose would fail with `bind source path does not exist`.
2. **Build** (skipped when "Use the existing image"):
   `docker buildx build --progress=rawjson --file <ctx>/infra/docker/sandbox/Dockerfile --target sandbox --load --tag <image> --build-arg DEV_UID=… --build-arg DEV_GID=… --build-arg WITH_ANDROID=… --build-arg WITH_FLUTTER=… --build-arg FLUTTER_VERSION=… --build-arg WITH_MONO=… --build-arg CLAUDE_CODE_VERSION=… --build-arg WITH_WHISPER=… --build-arg "WHISPER_MODELS=base small" <ctx>`
   These are exactly the args of `compose.yml services.sandbox.build`, so `sandbox build` / compose later produce the
   same cache keys. `--load` is needed when the active builder is not the `docker` driver. Labels: also pass
   `--label com.docker.compose.project=<project> --label com.docker.compose.service=sandbox` like compose does.
   If `--progress=rawjson` is rejected (buildx < 0.13: stderr `invalid progress mode`), retry with `--progress=plain`.
3. **Up**: `compose up --detach` (no `--build`). For tailscale mode, after success, rewrite the env file without
   `TS_AUTHKEY` (it is only needed for the first login; the node key lives in the `<prefix>-tailscale` volume).
4. **Health**: poll every 2 s, up to 180 s (healthcheck `start_period: 60s`, `interval: 30s`):
   `docker inspect --format '{{json .State}}' <project>-sandbox-1` (fail fast on `Status` `exited`/`dead`, showing the
   last 50 lines of `docker logs --tail 50`), and `GET <candidate>/v1/health` with a 2 s timeout, success =
   `ok === true && protocolVersion === 1` (GTK `probe_health`).
5. **Pairing**: GTK discovery (§6.7). Write `url/token/name/pairingUrl` to `config.json`.
Cancel: SIGINT to the build child, SIGKILL after 5 s (Windows: `taskkill /pid <pid> /t /f`). BuildKit keeps the cache
of finished steps. Phase → `cancelled`, toast `Build cancelled; finished steps are cached`.

### 6.5 Progress parsing

**rawjson** (one JSON `SolveStatus` per line; fields per `github.com/moby/buildkit/client.SolveStatus`):
```ts
{ vertexes?: { digest: string; inputs?: string[]; name: string; started?: string; completed?: string; cached?: boolean; error?: string }[];
  statuses?: { id: string; vertex: string; name?: string; total?: number; current: number; timestamp: string; started?: string; completed?: string }[];
  logs?: { vertex: string; stream: number; data: string /* base64 */; timestamp: string }[];
  warnings?: { vertex: string; level: number; short: string /* base64 */ }[] }
```
- Merge vertexes by `digest` (later messages update `started`, `completed`, `cached` and `error`).
- A **step** is a vertex whose name matches `^\[(?<stage>[a-z0-9-]+) (?<i>\d+)\/(?<n>\d+)\] (?<cmd>.*)$`
  (e.g. `[android 2/2] COPY --from=android-sdk …`). Ignore `[internal] …`, `resolve image config…` and
  `[auth] …` for counting (they are still logged).
- Fraction = Σ weight(done or cached steps) / Σ weight(all steps of the stages that will run). Ship the weights as
  `build-weights.json`, generated at packaging time from the Dockerfile. Default weight 1, heavy steps (apt installs,
  `sdkmanager`, `flutter precache`, whisper cmake, wine) weight 10. Stages excluded by the build args still execute
  (they just exit early), so the stage set is fixed: `controller-build, base, desktop, electron, android-sdk, android,
  flutter-sdk, flutter, whisper, sandbox`. Until the first step vertex arrives, the bar is indeterminate.
- Sub line: the most recently started incomplete step's `cmd` (the newest of several in parallel stages), and if a
  `status` with `total` exists for it: ` · {current} of {total}` in bytes.
- `cachedSteps` = vertexes with `cached: true`. If the build finished with every step cached, label
  `Image is up to date`.
- Logs: decode base64 and split lines; prefix `#{n} ` with the vertex's index of first appearance (BuildKit plain-style).
  Keep 200 lines.
- Failure: the first vertex with `error` → message `{stage step name}: {error}`. The process exits non-zero; show the
  vertex's last 20 log lines in the expanded log.

**plain** fallback: lines `#<n> [<stage> i/n] <cmd>` (step start), `#<n> CACHED`, `#<n> DONE <s>s`,
`#<n> ERROR: <msg>`, `#<n> <seconds> <output>`. Same model, keyed by `<n>`.

**Pull** (only when a registry ref is configured: `config.json sandboxImageRef` or env `TESSERACT_SANDBOX_IMAGE_REF`;
hidden otherwise): `docker pull <ref>`, then `docker tag <ref> <image>`. For progress, use the Engine API stream
`POST /images/create?fromImage=<ref>` over the engine socket (from `docker context inspect` `.Endpoints.docker.Host`):
JSON lines `{id, status: "Downloading"|"Extracting"|…, progressDetail: {current, total}}`, with fraction = Σcurrent/Σtotal
over layer ids. A prebuilt image fixes the WITH_* choices and `DEV_UID=1000`, and must be built with
`WHISPER_CMAKE_ARGS=-DGGML_NATIVE=OFF` (the default is `ON`, which tunes for the build CPU and can crash (SIGILL)
elsewhere). Open issue O1.

### 6.6 Files bundled in the installer (build "offline from a checkout", not offline from the network)

The build still needs the internet (Docker Hub base images and the `docker/dockerfile:1` frontend, Debian apt,
nodejs.org, dl.google.com, github.com, huggingface.co, npm). No repo checkout, Bun or bash is needed on the host.

`extraResources` → `<resources>/sandbox/` (read-only is fine; AppImage squashfs and signed app bundles work), keeping
repo-relative paths:

```
sandbox/
  .dockerignore                         (repo root; honored by BuildKit because <ctx> is the context root)
  SPEC.md
  package.json  bun.lock  bunfig.toml  tsconfig.base.json
  packages/**                            (minus node_modules, dist, coverage, *.tsbuildinfo)
  apps/controller/**                     (same exclusions)
  apps/mobile/package.json               (only the manifest; Dockerfile comment: "present solely so the frozen lockfile resolves")
  infra/docker/sandbox/Dockerfile
  infra/docker/sandbox/rootfs/**         (exec bits preserved: tesseract-* and tesseract are chmod'ed in the Dockerfile, others are not)
  infra/compose/compose*.yml  infra/compose/.env.example  infra/compose/tailscale/serve.json
  build-weights.json  manifest.json      ({ gitCommit, imageVersion: TESSERACT_IMAGE_VERSION, files: {path: sha256} })
```

- Generate it at packaging time with a script that applies `.dockerignore`. Fail packaging if `manifest.json` doesn't
  match `git ls-files` for those paths, so the bundle can't drift from the repo.
- Line endings: shell scripts in `rootfs` must stay LF. Set `.gitattributes` `* text=auto eol=lf` for these paths, or
  copy bytes from git blobs, never from a Windows checkout with autocrlf.
- Windows: Docker Desktop reads the context from the Windows path. Compose and `buildx` handle the `C:\…` paths.
- The image label `org.opencontainers.image.version` (`TESSERACT_IMAGE_VERSION`, default `0.1.0`) is compared with
  `manifest.imageVersion`. On mismatch, the main window later shows the GTK "outdated" notices with a `Rebuild`
  action that reopens this step.

### 6.7 Pairing discovery (port of GTK `config/discovery.py`, used by "Use it" and after the build)

1. `docker exec -u dev <container> tesseract-controller pair --json`, where container = `<project>-sandbox-1`. Parse the
   **last** stdout line that is a JSON object with a string `link` (`tesseract://pair?url=…&token=…&name=…`).
   Errors: `tesseract-controller pair --json printed no pairing link`,
   `controller printed an invalid pairing link: {error}`.
2. `docker inspect <container>`: `NetworkSettings.Ports["7700/tcp"][]` (`HostIp`/`HostPort`) and `Networks.*.IPAddress`;
   if `HostConfig.NetworkMode` = `container:<id>` (tailscale mode), also inspect that container and merge.
3. Candidates in order (deduplicated after URL normalization): published bindings (`0.0.0.0`/`::`/empty → `127.0.0.1`,
   IPv6 bracketed), `http://<TESSERACT_BIND_ADDR>:<host port>`, `http://127.0.0.1:<host port>`,
   `http://<container ip>:7700`, the pairing URL.
4. The first candidate whose `/v1/health` answers (2 s timeout, `ok` and `protocolVersion` 1) becomes `url`;
   `pairingUrl` = the pair URL. Messages *(GTK)*: `Found {name} at {url}` /
   `Found {name}, but none of its addresses answered from this machine` (warning, still `done`).

---

## 7. Step: Android emulator (`android`, optional)

Rail `Android emulator` + caption `Optional`. Hero icon `smartphone`, title `Android emulator`, description
`Run Android builds from the sandbox on an emulator on this computer, like Android Studio's device manager. Downloads about 2.5 GB.`

### 7.1 Host support and SDK root

| Host | Emulator archive (`host-os`/`host-arch`) | System image ABI | Acceleration | Can be linked to the sandbox |
|---|---|---|---|---|
| Linux x64 | `linux` / `x64` | `x86_64` | KVM | yes (netns isolation) |
| Linux arm64 | **none published** | — | — | step `unsupported`: `Google doesn't publish the Android emulator for Linux on ARM.` |
| macOS arm64 | `macosx` / `aarch64` | `arm64-v8a` | Hypervisor.framework | no (§7.8) |
| macOS x64 | `macosx` / `x64` | `x86_64` | Hypervisor.framework | no |
| Windows x64 | `windows` / `x64` | `x86_64` | WHPX (Windows Hypervisor Platform) | no |
| Windows arm64 | **none** | — | — | `unsupported`: `Google doesn't publish the Android emulator for Windows on ARM.` |

host-android.md §3.2 lists "arm64 Linux". **That is wrong**: the repository has emulator archives only for
`linux_x64`, `darwin_x64`, `darwin_aarch64` and `windows_x64` (checked 2026-10-06).

SDK root (must agree with the host daemon's resolution, host-android.md §3.1):
- Default: Linux `~/.local/share/tesseract/android-sdk` (picked up by the daemon with no env), macOS
  `~/Library/Application Support/Tesseract/android-sdk`, Windows `%LOCALAPPDATA%\Tesseract\android-sdk`.
- Existing SDKs offered as ChoiceRows when they contain `emulator/emulator[.exe]`: `TESSERACT_ANDROID_SDK_ROOT`,
  `ANDROID_SDK_ROOT`, `ANDROID_HOME`, `~/Android/Sdk` (Linux), `~/Library/Android/sdk` (macOS),
  `%LOCALAPPDATA%\Android\Sdk` (Windows). Subtitle `{path} · emulator {rev} · {n} system images`.
  The last row is `Install a new SDK for Tesseract` with subtitle `{default path}`.
- A non-default root is saved as `config.json androidSdkRoot` and passed to the host daemon as
  `TESSERACT_ANDROID_SDK_ROOT`. `TESSERACT_ADB=<sdk>/platform-tools/adb[.exe]` is always passed (host-android.md §2.5).

### 7.2 Catalog (`SdkRepository`)

- Fetch `https://dl.google.com/android/repository/repository2-3.xml` (~410 KB) and
  `https://dl.google.com/android/repository/sys-img/google_apis/sys-img2-3.xml` (~230 KB), 30 s timeout each, with a
  cache in `<userData>/android/cache/` (ETag / If-Modified-Since). Archive URLs are relative to the XML's directory
  (`…/repository/` and `…/repository/sys-img/google_apis/`).
- Mirrors: `TESSERACT_ANDROID_REPOSITORY_URL` and `TESSERACT_ANDROID_SYSIMG_URL` replace the two URLs
  (`apps/electron/src/core/android/catalog.ts`). Each takes the full `.xml` URL, or a base URL that gets the default
  file name (`repository2-3.xml`, `sys-img2-3.xml`) appended. Only `http:` and `https:` are accepted; anything else
  fails with `invalid_argument`. Archive URLs then resolve against the mirror.
- Parse `<remotePackage path>` elements (namespace-agnostic: match local names). For each path, collect:
  revision `major[.minor[.micro]]` (+ `preview`), `channelRef` (`channel-0` stable, `-1` beta, `-2` dev, `-3` canary;
  **use only `channel-0`**), `uses-license ref`, `dependencies/dependency[path, min-revision]`, and the archives
  `complete/{size, checksum[type=sha1], url}` with optional `host-os` (`linux|macosx|windows`) and `host-arch`
  (`x64|aarch64`; absent = any). The same path appears several times (e.g. `emulator` 37.3.3 on `channel-2` and
  37.2.12 on `channel-0`): take the highest revision among the stable ones.
- Licenses: `<license id type="text">` in each XML (`android-sdk-license`, `android-sdk-preview-license`,
  `android-sdk-arm-dbt-license`, …). arm64 system images use `android-sdk-arm-dbt-license`.
- Packages to install: `platform-tools`, `emulator` (archive for this host), and
  `system-images;android-<api>;google_apis;<abi>`. Image picker (`ChoiceRow`s, newest first, max 6 shown + `Show all`):
  paths matching `^system-images;android-(\d+)(\.\d+)?;google_apis;<abi>$` (this excludes `-ext*` and `-beta*` and the
  `google_apis_ps16k` 16 KB-page tag). Default **`android-36`**, which matches the sandbox's `ANDROID_PLATFORM`. Row title
  `Android {version name} (API {api})` (name table in labels: 30 → `11`, 31 → `12`, 32 → `12L`, 33 → `13`, 34 → `14`,
  35 → `15`, 36 → `16`, otherwise `API {api}`). Subtitle `Google APIs · {abi} · {size}`.
- Check the dependency: the image's `emulator` `min-revision` must be ≤ the chosen emulator revision, otherwise fail with
  `This system image needs emulator {min} or newer`.
- Example (live): `system-images;android-36;google_apis;x86_64` r7, `x86_64-36_r07.zip`, 1 895 447 397 bytes;
  `emulator` 37.2.12 `emulator-linux_x64-16428233.zip` 349 654 171 bytes; `platform-tools` 37.0.1
  `platform-tools_r37.0.1-linux.zip` 9 054 187 bytes (sha1 `477254aa5f903c15cf51001717bdf347fb6b53e0`, verified).

### 7.3 UI

Groups, top to bottom:
1. `Hardware acceleration` (CheckRows, run on entry before any download, §7.6).
2. `SDK location` (ChoiceRows from §7.1).
3. `System image` (picker; disabled until the catalog loads; a 3-row skeleton shimmer while loading; on failure a danger
   Notice `Couldn't load Google's package list: {error}` with action `Retry`).
4. `Virtual device` (FieldRows): `Name` (default `Tesseract_API_{api}`, regex `^[A-Za-z0-9._-]+$`, unique against
   existing `.ini` files: `An AVD named {name} already exists`), `Device profile` (dropdown, default `pixel_5`:
   `Pixel 5 · 1080 × 2340 · 440 dpi`, `Pixel 8 · 1080 × 2400 · 420 dpi`, `Medium Phone · 1080 × 2400 · 420 dpi`,
   `Pixel Tablet · 2560 × 1600 · 320 dpi`), `Memory` (StepperRow, default 2048 MB if host RAM < 12 GB else 4096,
   range 1024–8192 by 512), `CPU cores` (default `min(4, max(2, floor(cpus/2)))`), `Internal storage` (StepperRow,
   default 6 GB, range 2–64 GB by 1).
5. `Download` summary: property rows `Emulator {rev}` `{size}`, `Platform tools {rev}` `{size}`, `{image title}`
   `{size}`, `Total` `{sum} download · about {sum×2.4} on disk`. Free space at the SDK root (`fs.statfs`) must be ≥
   sum × 3, otherwise error row `Only {free} GB free in {dir}`.
6. While installing: one `ProgressBlock` per package (label = package display name, sub line
   `{received} of {total} · {rate}`, then `Verifying…`, `Extracting… {files}/{count}`) and a `LogDisclosure`.

Footer: secondary `Skip` and primary `Install` (or `Continue` when done, `Retry` when failed; `Cancel` while running).
If the chosen SDK already has every package and an AVD exists, the primary is `Use {avd}` and the step goes to
done without downloading.

### 7.4 Licenses

`Install` first shows the license gate inside the step (it replaces groups 2–5, crossfade 180ms): one `LicenseViewer`
per distinct license id that is not yet accepted, titled by id (`android-sdk-license` → `Android SDK License`,
`android-sdk-preview-license` → `Android SDK Preview License`, `android-sdk-arm-dbt-license` →
`Android SDK ARM DBT License`). `Accept and install` is enabled when every check is ticked.
On accept, append `\n<hash>` to `<sdk>/licenses/<id>` (create the dir; keep existing lines), where
`hash = sha1hex(licenseText.trim())` (the text content of the XML element, entities decoded). Existing SDKs created by
sdkmanager hold `24333f8a63b6825ea9c5514f83c2829b004d1fee` for `android-sdk-license`, but sha1 of the current XML text
trimmed is `9002c006…`. The exact normalization sdkmanager applies must be confirmed (open issue O8). These files only
matter to a later `sdkmanager`/Gradle; the wizard's own installer does not read them.

### 7.5 Download, verify, extract (`SdkInstaller`)

- Order: `platform-tools`, `emulator`, system image (the image is the largest; an early failure costs less).
- Download to `<sdk>/.temp/<archive>.part` with `Range: bytes=<size>-` resume (keep the part on cancel). Per-file
  timeout 30 s without bytes. Verify the size equals `complete/size`, and sha1 equals `checksum` (streamed hash), else
  delete the part and fail with `{package}: the download is corrupt (checksum mismatch)`.
- Extract to `<sdk>/.temp/x-<id>/` and then `rename` into place (replace an older install of the same path
  atomically: rename the old one to `.temp/old-<id>` first, delete after success):

  | Package | Zip root dir | Final dir |
  |---|---|---|
  | `platform-tools` | `platform-tools/` | `<sdk>/platform-tools/` |
  | `emulator` | `emulator/` | `<sdk>/emulator/` |
  | `system-images;android-36;google_apis;x86_64` | `x86_64/` (verified; `arm64-v8a/` for arm) | `<sdk>/system-images/android-36/google_apis/x86_64/` |

- **Preserve unix modes** (`externalFileAttributes >>> 16`) and **symlinks** (mode `0o120000`; the macOS emulator
  contains framework symlinks). Most JS unzip libraries drop both. Use `yauzl` and apply `fs.chmod`/`fs.symlink`
  yourself. Reject entries with `..`, absolute paths, or symlinks whose target leaves the package dir. On macOS, clear
  `com.apple.quarantine` on the extracted tree (`xattr -dr com.apple.quarantine <dir>`); downloads made by the app
  itself are normally not quarantined, so do it only if set.
- Write `package.xml` in each package dir (system image zips don't contain one; sdkmanager writes it), so
  sdkmanager/Android Studio recognize the install:
  ```xml
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <ns2:repository xmlns:ns2="http://schemas.android.com/repository/android/common/02" xmlns:ns5="http://schemas.android.com/repository/android/generic/02" xmlns:ns13="http://schemas.android.com/sdk/android/repo/sys-img2/03">
    <license id="{licenseId}" type="text">{escaped text}</license>
    <localPackage path="{path}" obsolete="false">
      <type-details xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ns5:genericDetailsType"/>   <!-- sys-img: xsi:type="ns13:sysImgDetailsType" with the remote <type-details> children copied -->
      <revision><major>…</major><minor>…</minor><micro>…</micro></revision>
      <display-name>{display-name}</display-name>
      <uses-license ref="{licenseId}"/>
      <!-- dependencies copied from the remote package when present -->
    </localPackage>
  </ns2:repository>
  ```
  The emulator and platform-tools zips already contain `source.properties`; keep it.
- Cancel: abort the request, keep `.part`, remove `.temp/x-*`. Phase `cancelled`; `Install` resumes.

### 7.6 Hardware acceleration (`AccelCheck`)

Before download (no emulator yet):
- Linux: `/dev/kvm` exists, else error `KVM isn't available: turn on virtualization (VT-x / AMD-V) in the BIOS/UEFI settings and load the kvm_intel or kvm_amd module`
  (CommandBlock `sudo modprobe kvm_intel` or `kvm_amd` from `/proc/cpuinfo` `vendor_id`).
  `fs.access('/dev/kvm', R_OK|W_OK)`, else warning `You can't use /dev/kvm yet` with action `Add me to the kvm group`
  (`pkexec usermod -aG kvm <user>` → needs-relogin note, the same panel as §5.5) and the CommandBlock
  `sudo usermod -aG kvm $USER`.
- Linux isolation probe (the daemon's): `unshare --user --map-root-user --net -- ip link add tesseract0 type dummy`.
  On failure: warning `Network isolation for the emulator isn't available` with the runbook fix as CommandBlocks
  `sudo sysctl -w kernel.unprivileged_userns_clone=1` and (Ubuntu 24.04+)
  `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`, plus a note that without it the sandbox won't use the
  emulator (host-android.md §3.1).
- Windows: `powershell -NoProfile -Command "(Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform).State"`
  (`Enabled`). Otherwise warning `Windows Hypervisor Platform is off` with action `Turn it on…`
  (`Start-Process -Verb RunAs -Wait dism.exe -ArgumentList '/online','/enable-feature','/featurename:HypervisorPlatform','/all','/norestart'`
  → needs-reboot). AEHD (the Android Emulator Hypervisor Driver) is deprecated; don't offer it.
- macOS: `sysctl -n kern.hv_support` = `1`, else error `This Mac doesn't support Hypervisor.framework`.

After the emulator is installed: `<sdk>/emulator/emulator -accel-check` (env `ANDROID_SDK_ROOT`/`ANDROID_HOME` = sdk,
20 s timeout). Output format (verified):
```
accel:
0
KVM (version 12) is installed and usable.
accel
```
Line 2 = status code, line 3 = message. `0` = ok; anything else = error with the emulator's message verbatim and a
mapped hint: `3`/`4`/`5` CPU lacks VT-x/SVM/NX; `6` not installed; `8` `/dev/kvm` missing (BIOS/module); `9`/`10` VT/NX
disabled in BIOS; `11` permission (kvm group); `12`/`13` open or ioctl failed. Other codes: show the message only.

### 7.7 AVD creation without avdmanager (`AvdWriter`)

- AVD home: `ANDROID_AVD_HOME`, else `$ANDROID_USER_HOME/avd`, else `~/.android/avd` (Windows
  `%USERPROFILE%\.android\avd`). This is the same place the emulator looks.
- `<avdHome>/<name>.ini`:
  ```
  avd.ini.encoding=UTF-8
  path=<avdHome>/<name>.avd
  path.rel=avd/<name>.avd
  target=android-<api>
  ```
- `AvdSpec` (`apps/electron/src/shared/contracts/android.ts`): `name`, `sdkRoot`, `systemImage`, `api`, `abi`, `ramMb`,
  `cores`, `deviceProfile` (`pixel_5 | pixel_8 | medium_phone | pixel_tablet`) and `storageMb` (2048–65536, default
  6144). `validateAvdSpec` rejects an unknown profile (`Unknown device profile {profile}; use one of …`) and storage
  outside the range (`Internal storage must be between 2 and 64 GB`).
- Device profiles (`DEVICE_PROFILE_CONFIG` in `apps/electron/src/core/android/constants.ts`):

  | Profile | `hw.device.manufacturer` | `hw.lcd.width` × `hw.lcd.height` | `hw.lcd.density` |
  |---|---|---|---|
  | `pixel_5` | Google | 1080 × 2340 | 440 |
  | `pixel_8` | Google | 1080 × 2400 | 420 |
  | `medium_phone` | Generic | 1080 × 2400 | 420 |
  | `pixel_tablet` | Google | 2560 × 1600 | 320 |

- `<avdHome>/<name>.avd/config.ini` (keys sorted like Android Studio writes them; values shown for the default
  `pixel_5` profile and 6 GB storage):
  ```
  AvdId=<name>
  PlayStore.enabled=false
  abi.type=<x86_64|arm64-v8a>
  avd.ini.displayname=<name with _ → space>
  avd.ini.encoding=UTF-8
  disk.dataPartition.size=6G
  fastboot.forceColdBoot=no
  fastboot.forceFastBoot=yes
  hw.accelerometer=yes
  hw.audioInput=no
  hw.battery=yes
  hw.camera.back=none
  hw.camera.front=none
  hw.cpu.arch=<x86_64|arm64>
  hw.cpu.ncore=<cores>
  hw.dPad=no
  hw.device.manufacturer=Google
  hw.device.name=pixel_5
  hw.gps=yes
  hw.gpu.enabled=yes
  hw.gpu.mode=swiftshader_indirect
  hw.keyboard=yes
  hw.lcd.density=440
  hw.lcd.height=2340
  hw.lcd.width=1080
  hw.mainKeys=no
  hw.ramSize=<MB>
  hw.sdCard=no
  hw.trackBall=no
  image.sysdir.1=system-images/android-<api>/google_apis/<abi>/
  runtime.network.latency=none
  runtime.network.speed=full
  showDeviceFrame=no
  skin.dynamic=yes
  skin.name=1080x2340
  skin.path=_no_skin
  tag.display=Google APIs
  tag.id=google_apis
  target=android-<api>
  vm.heapSize=256
  ```
  From the spec: `disk.dataPartition.size` = `storageMb` (`<n>G` when a whole number of GB, else `<n>M`),
  `hw.device.name` = the profile id, `hw.device.manufacturer` and `hw.lcd.*` from the profile table, and
  `skin.name` = `<width>x<height>`.
  `hw.gpu.mode` is only a default: the daemon always passes `-gpu` (`TESSERACT_EMULATOR_GPU`, `host` when a GPU render node is usable, else `swiftshader_indirect`).
  There is no sdcard (no `mksdcard` step) and no camera/audio (the daemon runs `-no-audio`). The emulator creates
  `userdata-qemu.img` from the image's `userdata.img` on first boot. `image.sysdir.1` is relative to the SDK root, so
  the AVD only works with this SDK root (another reason to pass `TESSERACT_ANDROID_SDK_ROOT`).
- Verify: `<sdk>/emulator/emulator -list-avds` (env as above, 10 s) must list `<name>`; otherwise fail with
  `The emulator doesn't see the new virtual device {name}` and remove the two files.
- Save `config.json androidAvd`. The wizard does **not** boot the emulator; the project page does
  (host-android.md §3.6). An optional `Test boot` button can be added later.

### 7.8 Done state and platform caveat

- Done: a success Notice `{avd} is ready · Android {version} · {abi}` and property rows `SDK` `{root}`,
  `Emulator` `{rev}`, `AVD` `{path}`.
- macOS/Windows: also show the warning Notice (host-android.md §3.3)
  `On {OS} the emulator runs without network isolation, so Tesseract won't connect it to the sandbox automatically. You can still run it on this computer.`

---

## 8. Step: Claude (`claude`)

Rail `Claude Code`, hero icon `mouse-pointer-2`, title `Claude Code`, description
`The sandbox uses this computer's Claude Code login: the folder ~/.claude is shared with it, never copied.`

- Read `HostClaudeState[]` with the host-android.md §4.6 rules (read-only, never returns secrets). Render one boxed
  list per account (first one only, plus a `{n} more accounts` caption) with property rows exactly as Settings › Claude
  *(GTK labels)*: `Login`, `Account`, `Plan`, `Access token`, `Settings`.
- States → Notice + actions:
  - signed in: success Notice `Signed in as {email}` (or `Signed in`).
  - folder missing (`~/.claude` absent): warning Notice title `Claude Code isn't set up on this computer`, message
    `Install Claude Code and sign in once with your Claude subscription, then check again. Tesseract creates an empty ~/.claude now so the sandbox can start.`
    Actions `Open install guide` (`claude_code_docs`) and `Check again`. Entering the step creates `~/.claude` (mode 0700)
    if missing: compose's bind uses `create_host_path: false`, so `up` fails without it. Never create
    `~/.claude-<name>` dirs.
  - `missing` (folder exists, no `.credentials.json`) or `invalid`: warning Notice title `Not signed in`, message
    `Run claude in a terminal and sign in, then check again. You can also sign in later from the sandbox.`
    CommandBlock `claude`. Action `Check again`.
  - `keychain` (macOS): info Notice title `Signed in through the macOS keychain`, message
    `The sandbox can't read the keychain. After the build, open a sandbox terminal and run claude once to sign in there; the login is saved in ~/.claude for both.`
- Continue is always enabled. Status `done` when signed in, else `warning`.
- Refresh: header suffix button and window focus (`browser-window-focus`) re-read the state.

---

## 9. Step: Pair (`pair`, optional)

Rail `Phone` + `Optional`. Hero icon `qr-code`, title `Pair your phone`, description
`Install the Tesseract app and Tailscale on your phone, then scan this code in the app (Agents › Pair a sandbox).`

- Body = the GTK `PairPanel` for the sandbox target (dialog spec in host-android.md §4.5 / pair dialog): QR 176×176
  in `.to-qr` (padding 12, radius 8, bg `#ffffff`), 4px under it; instructions
  `Scan with the Tesseract app, or open this link on the phone.` *(GTK)* (body, `textSecondary`, centered); a CopyField
  with the link (tooltip `Copy link` *(GTK)*); a caption `Sandbox {name} · {url}` *(GTK)*; notices; a warning Notice
  `The link contains the API token: share it only with your own devices.` *(GTK)*. The panel is centered,
  max-width 392 (= dialog 440 − 2×24).
- `local` mode: replace the QR with a warning Notice title `Your phone can't reach this sandbox`, message
  `It only listens on 127.0.0.1. Switch to Tailscale to use it from your phone.`, action `Change reachability`
  (goes back to `sandbox` with the Reachability group focused). The link still shows (it is useful on this computer).
- Optional segmented control `Sandbox | This computer` *(GTK labels)* above the panel only when the host shell is
  running. The host panel is out of scope here (host-android.md §4.5).
- Toast on copy: `Pairing link copied` *(GTK)*.
- Footer: secondary `Skip`, primary `Continue` (`Done` label is not used here).

---

## 10. Step: Finish (`finish`)

- Rail `Done`. Hero icon `circle-check` in `success` (badge bg `successMuted` `#14261C`, border none), title
  `Tesseract is ready`, description `Everything below can be changed later in Settings.`
- Summary boxed list (CheckRows, read-only, no actions): `Docker` (`{kind} {version}`), `Claude Code`
  (`Signed in as {email}` / `Not signed in`), `Sandbox` (`{name} · {url}`), `Android emulator` (`{avd}` / `Skipped`),
  `Phone` (`Paired` is not knowable; show `Pairing link ready` / `Skipped`). Skipped rows use the `circle-dashed`
  glyph.
- Switch row `Start the sandbox when Tesseract opens` (default on; writes `config.json sandboxAutostart`). At every app
  start, also with `--hidden` (`apps/electron/src/core/sandbox/autostart.ts`, `src/main/services/autostart.ts`), it
  runs `compose up -d` only for a stack Tesseract created: `sandboxStack` has `builtAt`, its env file is the app's own
  `<userData>/sandbox/.env`, and that file's project matches `sandboxStack.project`. Skipped when the switch is off,
  the stack is someone else's, or the `sandbox` service already runs. Docker unreachable → one notification
  `Docker isn't running` (opens Settings › Sandbox); a failed `up` → notification `The sandbox didn't start`. Not run
  with fixtures or in test mode.
- Footer: primary `Open Tesseract` → sets `onboarding.completedAt`, closes the wizard and opens the main window (it
  connects with the saved config). No Back.

### 10.4 Leaving the wizard

Closing the window (close button, Ctrl/Cmd+W, Alt+F4):
- No operation running and not finished → a confirm dialog (GTK `ConfirmDialog`: width 400, header padding-top 16):
  title `Leave setup?`, body `You can finish it later from the banner or Settings.`, buttons `Stay` (flat) /
  `Leave` (primary). Leave = quit the app on first run (no main window yet), else just close.
- Operation running → title `Stop {operation}?` (`the build`, `the download`, `the Docker installation`), body
  `Finished steps are kept, and setup continues from here next time.`, buttons `Keep going` / `Stop` (destructive:
  `dangerSolid` bg, white text).

---

## 11. Motion (motion library; theme.md §7 tokens; all disabled under `prefers-reduced-motion`)

| Element | Animation |
|---|---|
| Step change (body) | `AnimatePresence mode="wait"`: exit opacity 1→0 and x 0→−8 (or +8 when going back) 120ms `accelerate` `[0.3,0,1,1]`; enter opacity 0→1 and x 8→0 180ms `standard` `[0.2,0,0,1]` |
| Header title | crossfade 180ms |
| Rail glyph status change | crossfade + scale 0.6→1, 180ms; to `done` uses `overshoot` `[0.34,1.56,0.64,1]` |
| Current rail row background | shared `layoutId` highlight that slides between rows, 180ms standard |
| CheckRows appearing | opacity 0→1 and y 4→0, 120ms standard, stagger 30ms |
| Check result glyph (spinner → icon) | crossfade 120ms |
| Progress fill | width transition 260ms standard (no transition when the value goes backwards on retry) |
| Indeterminate bar | shimmer 1440ms linear (theme.md) |
| Expanders / log disclosure / install panel | height auto + opacity, 180ms standard; chevron rotate 180ms |
| Buttons | GTK press `scale(0.95)` 120ms; hover colors 120ms |
| Finish hero check | stroke-dashoffset draw 400ms `decelerate`, once |
| Toasts | opacity + y 8→0, 180ms |

Reduced motion: every duration 0; the shimmer becomes a static 40% segment at the left; spinners keep turning (they
convey state) but at 1 turn/1.2 s with no easing.

---

## 12. Labels and URLs (put in `onboarding/labels.ts` and `onboarding/urls.ts`; components import, never inline)

Step labels: `Welcome`, `Docker`, `Claude Code`, `Sandbox`, `Build`, `Android emulator`, `Phone`, `Done`;
`Optional`; `Set up`; `Step {n} of {total}`; buttons `Get started`, `Continue`, `Back`, `Skip`, `Cancel`, `Retry`,
`Install`, `Install…`, `Start`, `Fix…`, `Check again`, `Build`, `Use it`, `Accept and install`, `Open Tesseract`,
`Quit Tesseract`, `Show details`, `Hide details`, `Copy log`, `Copy`, `Copied`. All other strings are quoted in their
sections above.

| key | URL |
|---|---|
| `docker_mac_dmg_arm64` | `https://desktop.docker.com/mac/main/arm64/Docker.dmg` |
| `docker_mac_dmg_amd64` | `https://desktop.docker.com/mac/main/amd64/Docker.dmg` |
| `docker_mac_checksums_<arch>` | `https://desktop.docker.com/mac/main/<arch>/checksums.txt` |
| `docker_mac_appcast_<arch>` | `https://desktop.docker.com/mac/main/<arch>/appcast.xml` (`sparkle:minimumSystemVersion`, `sparkle:shortVersionString`) |
| `docker_win_exe_<arch>` | `https://desktop.docker.com/win/main/<amd64|arm64>/Docker%20Desktop%20Installer.exe` |
| `docker_win_checksums_<arch>` | `https://desktop.docker.com/win/main/<arch>/checksums.txt` |
| `docker_get_script` | `https://get.docker.com` |
| `docker_mac_docs` | `https://docs.docker.com/desktop/setup/install/mac-install/` |
| `docker_windows_docs` | `https://docs.docker.com/desktop/setup/install/windows-install/` |
| `docker_desktop_linux_docs` | `https://docs.docker.com/desktop/setup/install/linux/` |
| `docker_engine_docs` | `https://docs.docker.com/engine/install/` |
| `docker_compose_install` | `https://docs.docker.com/compose/install/linux/` |
| `docker_buildx_install` | `https://docs.docker.com/build/concepts/overview/#install-buildx` |
| `docker_ssa` | `https://www.docker.com/legal/docker-subscription-service-agreement/` |
| `virtualization_help` | `https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/topics/#virtualization` |
| `tailscale_keys` | `https://login.tailscale.com/admin/settings/keys` |
| `android_repo` | `https://dl.google.com/android/repository/repository2-3.xml` |
| `android_sysimg_google_apis` | `https://dl.google.com/android/repository/sys-img/google_apis/sys-img2-3.xml` |
| `android_accel_docs` | `https://developer.android.com/studio/run/emulator-acceleration` |
| `claude_code_docs` | `https://docs.claude.com/en/docs/claude-code/setup` |

Docs URLs (not download URLs) must be checked by the e2e link test (HEAD 200 or 3xx), since vendors move docs pages.

---

## 13. GTK quirks NOT to copy

- No first-run flow at all: GTK only shows a banner and Preferences. Electron replaces this with the wizard and keeps
  the banner as a way back into it.
- `This computer has no Android virtual device; create one in Android Studio` → point at the wizard's Android step.
- The outdated-sandbox notices tell users to run `` `bun run sandbox build` then `bun run sandbox up` ``. An installed
  app has no checkout: the action reopens the Build step (keep the meaning).
- GTK `discover_docker` uses the user's ambient `TESSERACT_*` env (`TESSERACT_COMPOSE_PROJECT`, `TESSERACT_BIND_ADDR`, …).
  The wizard uses the saved `sandboxStack` values and scrubs the ambient ones (§6.3).
- GTK silently drops an invalid pairing URL. The wizard always shows validation inline.
- GTK reads macOS logins as "keychain not supported" and stops there. The wizard explains the sandbox sign-in path
  instead (§8).
- `infra/scripts/sandbox` uses bash, `${HOME}` defaults and `mktemp`. None of these work on Windows, hence the TS port
  and the explicit `TESSERACT_HOST_CLAUDE_DIR`.
- GTK's Adwaita dialog sheet has radius 12 and a dim scrim. The wizard is a real window, so it uses the OS radius and has
  no scrim.

---

## 14. Open issues (for the owners named)

- **O1 (infra):** No registry image exists (`tesseract/sandbox:latest` is local-only, 7.3 GB). A published image would
  cut setup to a 3 GB download but needs a CI job, `-DGGML_NATIVE=OFF`, multi-arch, and fixed WITH_* choices (or
  several tags). Until then the wizard only builds.
- **O2 (infra / Dockerfile):** The `controller-build` stage copies only `apps/mobile/package.json` for the frozen
  lockfile. When `apps/electron` (a new workspace under `apps/*`) adds dependencies to `bun.lock`,
  `bun install --frozen-lockfile --filter @tesseract/controller` may fail in the image build because its manifest is
  missing. Today `apps/desktop` (in the lockfile, not copied) does not break it, so verify. If it fails, copy
  `apps/electron/package.json` too, and include it in the bundle (§6.6).
- **O3 (architecture):** "Chromium" is not an optional component: it is installed unconditionally in the `desktop`
  stage, and so is Wine (`electron` stage). Making them optional needs new build args (`WITH_CHROMIUM`, `WITH_WINE`) in
  the Dockerfile and in `compose.yml`.
- **O4 (security / infra):** Rootless Docker and Docker Desktop on macOS: the `~/.claude` bind mount and `DEV_UID`
  ownership semantics are untested there. Login files written by the sandbox may end up with an unexpected owner.
- **O5:** `host-tailscale` mode with Docker Desktop (macOS/Windows): publishing on the host's Tailscale IP through the
  VM's port forwarding is unverified. The wizard marks it "recommended on Linux only".
- **O6:** The format of Windows `checksums.txt` is assumed to equal macOS's (`<sha256> *<file>`). Verify, and fall back to
  "no checksum available → warn in the log" rather than blocking.
- **O7:** Arch/openSUSE package names for compose v2 and buildx should be verified per release. The convenience script
  covers Debian/Ubuntu/Fedora/RHEL/CentOS.
- **O8:** The SDK license hash normalization. Confirm with `sdkmanager --licenses` on a fresh SDK root what
  `licenses/android-sdk-license` must contain for the current text, and adopt that algorithm.
- **O9 (host-android.md):** §3.2 lists arm64 Linux as supported for the emulator. It isn't (§7.1). Also, §3.2
  prescribes `sdkmanager`/`avdmanager`; this spec replaces them with the direct installer (no JDK on the host).
- **O10 (blueprint):** The new `config.json` keys (`onboarding`, `sandboxStack`, `androidSdkRoot`, `androidAvd`,
  `sandboxAutostart`, `sandboxImageRef`) and the env file location should be added to the blueprint's Electron
  section together with the code.

---

## 15. Test checklist (Electron e2e; Docker resources must use the `tesseract-test-` prefix)

1. Fresh profile (`TESSERACT_DESKTOP_CONFIG=/tmp/tesseract-test-onb/config.json`, empty userData, `HOME` pointing at a
   temp dir with no `~/.claude`) opens the wizard at `welcome`. A profile with a saved connection does not.
2. Docker probe on the CI host: all checks green. Fake failures by putting stub `docker` scripts on PATH that print the
   stderr strings of §5.2 (permission, stopped, podman, compose 2.20) and assert the CheckRow titles and subtitles.
3. Sandbox step: validation messages for the project name, ports, bind address (`0.0.0.0`, `010.1.1.1`, `256.1.1.1`)
   and tailnet domain. The written env file round-trips through `infra/scripts/sandbox --env-file <file> config` (Linux)
   with identical output to the TS renderer's file list.
4. Build with project `tesseract-test-onb`, image `tesseract-test/sandbox:onb`, `WITH_ANDROID=false WITH_FLUTTER=false
   WITH_MONO=false WITH_WHISPER=false`, mode `local`, ports from a free-port finder. Assert: progress reaches 1, rawjson
   parser counts > 0 steps, health ok, `config.json` has url/token, pairing link parses. Tear down with
   `compose down -v` and `docker image rm`.
5. Cancel mid-build → `cancelled`; Retry finishes with cached steps > 0.
6. Android catalog parser against saved fixtures of both XMLs (checked in under `tests/fixtures/android/`). Host
   filter per platform/arch. Stable-channel selection (emulator 37.2.12, not 37.3.3 on channel-2 in the fixture).
   ps16k/ext/beta are excluded.
7. SdkInstaller against a local HTTP server serving a small zip with an exec bit and a symlink: modes preserved,
   traversal rejected, sha1 mismatch fails, Range resume works.
8. AvdWriter in a temp `ANDROID_AVD_HOME`: files byte-equal to golden files. With a real emulator (Linux CI with KVM
   only): `-list-avds` shows it.
9. Claude step: temp HOME with `.claude/.credentials.json` fixtures for signed-in/invalid/missing. `~/.claude` is
   created with mode 0700 when absent.
10. Visual snapshots (offscreen window, 880×620, graphite and graphiteLight) of every step and the main error states,
    saved as `docs/electron/reference/onboarding-<step>[-state][-light].png`.
11. `prefers-reduced-motion` emulation: no transforms on step change, static progress segment.
