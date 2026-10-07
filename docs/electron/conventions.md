# Electron app conventions (`apps/electron`, package `@monolith/electron`)

Read this before you touch `apps/electron`. It is the contract between the ~35 agents that build the app in
parallel. The specs in `docs/electron/spec/` say *what* to build; this file says *where* and *how*. When a spec
suggests a different path (for example `src/main/sandbox/stack.ts`), the layout in this file wins.

Also read: `CODING.md` (no unnecessary comments, no constants in UI files, reusable components, hooks for logic)
and `AGENTS.md` (never start/stop the Expo server on 8081, the user's sandbox, or the host daemon on 7701).

---

## 1. Stack

| What | Version / choice |
|---|---|
| Electron | **44.5.1** (pinned exactly; electron-builder needs it). Node 24 in main. |
| Build | electron-vite 5 + Vite 7. Main = ESM (`out/main/index.js`), preload = CJS (`out/preload/index.cjs`, sandboxed), renderer = `out/renderer/index.html` |
| Renderer dev server | `http://127.0.0.1:4545`, `strictPort` (dev **and** preview). Never use Electron/Vite default ports |
| UI | React 19.2.3 (pinned to the mobile app's version, do not bump), react-router 7 (hash router), @tanstack/react-query 5, zustand 5, motion 14 (`motion/react`), lucide-react **1.52.0** (pinned, matches the GTK glyphs) |
| Rich widgets | @xterm/xterm 6 + addon-fit / web-links / unicode11, @novnc/novnc 1.7, qrcode, react-markdown + remark-gfm |
| Node side | yaml, tar, semver, yauzl (zip with modes + symlinks), zod 4, `@theone/protocol`, `@theone/client` |
| Tests | vitest 5 (node + happy-dom projects), @testing-library/react, Playwright 1.63 (`_electron`) |
| Packaging | electron-builder 26 + electron-updater 6; `bun build --compile` for the CLI |

Everything is a **devDependency** and is bundled by Vite; `dependencies` stays empty so electron-builder ships no
`node_modules`. Only the foundation owner edits `package.json`/`bun.lock`. Need a package? Report it in
`deps_needed`; do not run `bun add`/`bun install`.

---

## 2. Commands (run from `apps/electron` unless noted)

| Command | What it does |
|---|---|
| `bun run typecheck` | `tsc -p tsconfig.node.json && tsc -p tsconfig.web.json` |
| `bunx tsc --noEmit -p apps/electron` (repo root) | One program over everything (DOM + node); use it while others are mid-edit and only fix errors in files you own |
| `bun run test` | `vitest run` (headless, no display; the root `bun run test` runs it) |
| `bun run e2e` | Builds if stale, then Playwright `_electron` specs in `e2e/` (headless on Linux) |
| `bun run snapshot -- --route <route> --out file.png [--light] [--width 1024 --height 768] [--rebuild] [--headed]` | Builds if stale, launches the app with fixtures in an isolated profile, waits for idle, writes a PNG at device scale 1 |
| `bun run diff -- a.png b.png [--out diff.png] [--threshold 0.1] [--max <percent>]` | pixelmatch; prints `mismatch: X.XX% (n of N pixels)`; exit 1 only when `--max` is exceeded |
| `bun run build` | electron-vite build into `out/` |
| `bun run dev` | electron-vite dev (renderer on 4545). Only when you need a live window; prefer snapshots |
| `bun run cli:build [-- --target linux-x64,mac-arm64 \| --all] [--no-controller]` | `dist-cli/<os>-<arch>/{tesseract,theone-controller}` (`os` = `linux`/`mac`/`win`) |
| `bun run bundle:sandbox` | `build/sandbox-context/` (git-tracked build context + `manifest.json` + `build-weights.json`) |
| `bun run dist [-- --platform linux\|mac\|win] [--dir]` | build + cli:build + bundle:sandbox + electron-builder (mac dmg universal, win nsis, linux AppImage + deb) |

Root shortcuts: `bun run electron`, `electron:build`, `electron:e2e`, `electron:dist`, `electron:smoke`.

Paths given to `snapshot`/`diff`: outputs resolve against `apps/electron`; inputs try `apps/electron` first, then
the repo root (so `docs/electron/reference/x.png` works from either place).

Never create a `tesseract` symlink on the development machine. `app.installCli()` refuses in unpackaged builds.

---

## 3. Directory map and ownership

```
apps/electron/
  package.json  electron.vite.config.ts  tsconfig*.json  vitest.config.ts  playwright.config.ts
  electron-builder.yml  build/ (icons, entitlements, installer.nsh, linux/after-*.sh)       FOUNDATION
  scripts/  (snapshot, diff, cli-build, bundle-sandbox, dist, ensure-build, lib/)            FOUNDATION
  tests/    (architecture + contract tests)                                                  FOUNDATION
  e2e/app.ts (launch helper)                                                                 FOUNDATION
  e2e/<area>.spec.ts                                                                         owner of <area>
  cli/index.ts types.ts io.ts labels.ts registry.ts version.ts                               FOUNDATION
  cli/commands/<command>.ts                                                                  owner of the service it calls
  src/shared/ipc.ts ipc-types.ts runtime.ts routes.ts defaults.ts                            FOUNDATION
  src/shared/contracts/common.ts                                                             FOUNDATION
  src/shared/contracts/<service>.ts                                                          SERVICE UNIT
  src/core/paths/ config/ log/ process/                                                      FOUNDATION
  src/core/<service>/                                                                        SERVICE UNIT
  src/main/index.ts context.ts app/ windows/ ipc/_framework/                                 FOUNDATION
  src/main/services/settings.ts commands.ts idle.ts resources.ts                             FOUNDATION
  src/main/ipc/<service>.ts                                                                  SERVICE UNIT
  src/main/services/tray.ts updater.ts cli-install.ts                                        DESKTOP-INTEGRATION unit
  src/preload/index.ts                                                                       FOUNDATION
  src/renderer/index.html main.tsx env.d.ts app/ lib/ test/ gallery/GalleryPage.tsx          FOUNDATION
  src/renderer/fixtures/{registry,types,fetch,socket,scenario,index}.ts fixtures/base/       FOUNDATION
  src/renderer/fixtures/<area>/{http,socket,ipc}.ts                                          owner of <area>
  src/renderer/theme/                                                                        THEME
  src/renderer/components/<Name>/                                                            one owner per component (see §7)
  src/renderer/shell/                                                                        SHELL
  src/renderer/pages/<page>/  +  src/renderer/features/<page>/                               PAGE owner
  src/renderer/pages/projects/tabs/<tab>/                                                    PROJECT-TABS owner
  src/renderer/pages/preferences/PreferencesDialog.tsx labels.ts constants.ts               PREFERENCES owner
  src/renderer/pages/preferences/sections/<section>/                                         SECTION owner
  src/renderer/features/<domain>/  (connection, workspace, attachments, syncback, hostShell, composer…) DOMAIN owner
  src/renderer/onboarding/OnboardingLayout.tsx labels.ts shared/                             ONBOARDING-SHELL owner
  src/renderer/onboarding/<step>/                                                            STEP owner
```

A **service unit** is one agent owning, for one service `<s>`: `src/shared/contracts/<s>.ts`,
`src/main/ipc/<s>.ts`, `src/core/<s>/**`, its fixtures `src/renderer/fixtures/<s>/ipc.ts`, and any CLI command that
only calls it. Services: `app`, `window`, `tray`, `updates` (desktop-integration), `http` (foundation),
`connection`, `docker`, `sandbox`, `android`, `onboarding`, `syncback`, `attachments`, `files`, `hostShell`, `claude`,
`stt`, `metrics`.

Rules:
- Edit only what you own. Need a change elsewhere (a prop on a shared component, a new contract method in another
  unit, a dependency, a new service)? Put it in `open_issues`/`deps_needed` with the exact signature you need.
- Nothing is registered in a shared index file. Pages, preferences sections, onboarding steps, IPC handlers,
  fixtures and gallery entries are discovered with `import.meta.glob` (§5, §6). Creating the file registers it.
- `features/<page>/` holds a page's non-UI code: `labels.ts`, `constants.ts`, `model.ts` (+ `model.test.ts`),
  `hooks/`, query keys. `pages/<page>/` holds `page.ts` and the page's own components.
- Architecture tests (`tests/architecture.test.ts`) fail the build when: `src/core`, `src/shared` or `cli`
  import `electron`; the renderer imports `node:*`, `src/core` or `electron`; `src/shared` imports `node:*`.

---

## 4. The IPC contract

### 4.1 Shape

`src/shared/ipc.ts` aggregates one contract per service from `src/shared/contracts/<service>.ts`:

```ts
export type DockerContract = DefineContract<{
  methods: {
    check(): DockerReport;                          // return the *resolved* value; it becomes a Promise on the renderer side
    install(request: DockerInstallRequest): DockerPhase;
  };
  events: {
    phase: DockerPhase;                             // payload type
    log: string;
  };
}>;
```

- Use a **type alias** (`type X = DefineContract<{…}>`), not an `interface` (index-signature compatibility).
- Arguments and results must be structured-clonable: plain objects, arrays, strings, numbers, booleans, `null`.
  No classes, functions, `Date` (use ISO strings or epoch ms), `Map`/`Set` (use records/arrays), `undefined`
  in arrays. Binary data travels as base64 strings.
- Channels: invoke `monolith:<service>:<method>`, event `monolith:<service>:event:<event>`. Never hand-write
  channel strings; use `invokeChannel`/`eventChannel`.
- Types shared with the controller come from `@theone/protocol` (`import type`). Do not redeclare them.
- Adding a method: add it to the contract, then implement it in `src/main/ipc/<service>.ts` (typecheck forces the
  handler map to be complete), then add a fixture if the renderer calls it in fixture mode.
- Adding a whole new service: report it; only the foundation edits `IpcContract`/`SERVICE_NAMES`.

### 4.2 Main-process handlers (`src/main/ipc/<service>.ts`)

```ts
import { probeDocker } from "../../core/docker";
import { defineService, notImplemented } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const events = serviceEmitter("docker");

export default defineService(
  "docker",
  {
    check: (context, ...args) => probeDocker({ onLog: (line) => events.emit("log", line) }),
    install: () => notImplemented("docker", "install"),
  },
  { start: (emitter) => () => { /* return a stop function; called on before-quit */ } },
);
```

- One file per service, `export default defineService(...)`. The registry (`ipc/_framework/registry.ts`) globs
  `src/main/ipc/*.ts`; `tests/contract.test.ts` checks there is exactly one file per service.
- `context` = `{ sender: WebContents, window: BrowserWindow | null }`.
- Handlers are thin: validate, call `src/core/<service>`, map results. Electron-only work (dialogs, `shell`,
  `nativeTheme`, `Notification`, `Tray`, `net.fetch`, clipboard) lives in the handler or `src/main/services/`.
- Errors: throw `IpcError(code, message, detail?)` (`not_implemented | invalid_argument | not_found | unavailable |
  cancelled | forbidden | timeout | internal`). Any other `Error` becomes `internal`. The renderer receives an
  `IpcError` with the same code and message. Messages are user-facing strings from your labels module.
- Events: `serviceEmitter("<service>").emit(event, payload)` broadcasts to every window. State-style events carry
  the full snapshot (e.g. `onboarding:state`, `hostShell:state`), not diffs.
- Untrusted senders (anything but `file://` and the dev server origin) get `forbidden`.
- Secrets (sandbox token is the exception the renderer needs; host token, PIN, PIN session, `TS_AUTHKEY`) never go
  to the renderer, logs or events. Use `redact()`/`LogRing` from `src/core/log`.

### 4.3 Renderer usage (`src/renderer/lib/ipc.ts`)

```ts
import { ipc } from "../../lib/ipc";
const report = await ipc.docker.check();                       // typed Promise<DockerReport>
const stop = ipc.docker.on("phase", (phase) => …);              // returns unsubscribe; call it in useEffect cleanup
```

Wrap calls in hooks (react-query `useQuery`/`useMutation`, or a zustand store fed by events). Components never call
`ipc` directly. `pathForFile(file)` (from `lib/ipc`) gives the path of a dropped `File` (`webUtils`).

### 4.4 Service catalogue (contract files are the source of truth)

| Service | Methods (summary) | Events |
|---|---|---|
| `app` | runtime, paths, settings, updateSettings, openExternal (http/https/mailto only), showItemInFolder, notify, cliStatus, installCli, rendererIdle, quit, relaunch | `command` (navigate/preferences/pair/… from tray, menu, deep links, notifications, second instance), `settings` |
| `window` | state, minimize, toggleMaximize, close, setFullscreen, zoom(-1\|0\|1), openOnboarding(step?), openMain | `state` (maximized, fullscreen, focused, visible, zoom, systemDark) |
| `tray` | state, setStatus(label) | `state` |
| `updates` | state, check, download, install | `state` |
| `http` | request(id, req) → base64 body, abort(id) — the renderer's `@theone/client` fetch goes through this (`net.fetch`, no CORS) | — |
| `connection` | load, save, forget (config.json read-modify-write), discover (docker discovery) | `changed` |
| `docker` | check, phase, install, start, cancel, log | `report`, `phase`, `log` |
| `sandbox` | defaults, validate, save (env file), stack, existing, build(mode), cancel, phase, up, down, status, logs, pairing | `phase`, `status`, `log` |
| `android` | support, sdkCandidates, catalog, acceptLicense, install(plan), cancel, accel, avds, createAvd, deleteAvd, emulator, startEmulator, stopEmulator, log | `progress`, `emulator`, `log` |
| `onboarding` | get, goto, skip, dockerCheck/Install/Start, claudeCheck/CreateDir, sandboxSave, buildStart/Cancel, sandboxAdopt (use the sandbox found on this computer), androidCatalog/AcceptLicense/Install/Cancel, androidUseExisting(sdkRoot, avd), pairLoad, finish, openExternal(urlKey) | `state` (`OnboardingState`, spec onboarding.md §3.1) |
| `syncback` | state, submit, links, snapshots, hostChanges, diff | `state` |
| `attachments` | pick(kind), read(path) (only paths from the last `pick`), clipboardHasImage, clipboardHasText, pasteImage | — |
| `files` | download(id, req) (native save dialog, streamed to a part file, SHA-256 checked, then renamed), saveBytes(name, base64), cancel(id), readClipboard, writeClipboard | `progress` ({ id, received, total }) |
| `hostShell` | state, start, stop, refresh, setPin, rotateToken, setAutostart, unlock, lock, androidStatus, startEmulator, stopEmulator, linkSandbox, openEmulatorViewer | `state` |
| `claude` | hostAccounts, ensureConfigDir | — |
| `stt` | microphone, requestMicrophone | — |
| `metrics` | load, save (`metrics.json`) | — |

The `onboarding` controller composes `src/core/{docker,sandbox,android,claude}`; the standalone `docker`,
`sandbox`, `android` services expose the same core for Settings, the project page and the CLI. Talking to the
**host daemon's** Android API (PIN session) is `hostShell`; running a local emulator without the daemon
(e.g. a test boot from the wizard) is `android`.

---

## 5. Core modules (`src/core/<service>/`)

- Pure Node TypeScript, no `electron` import, shared by main and the `tesseract` CLI (compiled with Bun).
- Async functions; long operations take `AbortSignal` and callbacks (`onLog`, `onProgress`, `onPhase`) instead of
  emitters. Child processes: `runCommand(file, args, { timeoutMs, env, signal })` from `src/core/process`
  (`execFile`, argument arrays, never a shell). Docker CLI timeout 15 s (`DOCKER_TIMEOUT_MS`).
- Paths: `src/core/paths` (`configFilePath`, `stateDir`, `cacheDir`, `sandboxDir`, `defaultAndroidSdkRoot`,
  `defaultUserDataDir`) so the app and the CLI resolve the same files. Config: `src/core/config`
  (`readConfig`, `updateConfig` = serialized read-modify-write that preserves unknown keys, atomic 0600 write;
  `settingsFromConfig`, `withConnection`, `initialConnection`). New `config.json` keys: add a typed accessor in your
  core module, never write the file directly.
- Logs: `createLogger(scope)`; operation logs use `LogRing` (200 lines, redacted).
- Stubs throw `NotImplementedError("<service>.<method>")`; replace them, keep the exported signatures (other units
  call them). Changing a signature that another unit uses = report it.
- Unit tests next to the code: `src/core/<service>/*.test.ts` (vitest, node env). Use temp dirs prefixed
  `monolith-test-`.

---

## 6. Renderer

### 6.1 Routes and navigation (hash router)

| Route | Shows |
|---|---|
| `#/<pageId>[/<sub…>]` | Shell + page. Page ids (GTK order): `overview`, `agents`, `projects`, `files`, `terminals`, `display` |
| `#/<pageId>?preferences=<section>` | Shell + Settings dialog. Sections (`PREFERENCES_SECTION_IDS`): `connection`, `appearance`, `claude`, `host-shell`, `stt`, `sandbox`, `android`, `about` |
| `#/onboarding/<step>` | Setup wizard window. Steps: `welcome`, `docker`, `claude`, `sandbox`, `build`, `android`, `pair`, `finish` |
| `#/gallery[/<entryId>]` | Component gallery (all entries, or one entry alone for snapshots) |

Query flags usable on any route: `?fixtures` (fixture mode in a plain browser), `?scheme=light|dark`,
`?scenario=<name>` (fixture scenario, §6.4).

- `useNavigateTo()(pageId, params?, sub?)` = GTK `navigate(pageId, params)`; params arrive via
  `usePageParams()` (`{ params, at }`; `at` changes on every navigation, so re-run `open(params)` on it).
  Sub-views use the splat (`#/projects/<projectId>`) and `useParams()`.
- `usePreferencesRoute()` → `{ open, section, openPreferences(id?), closePreferences() }`.
- App commands from main (`tray`, deep links `monolith://<page>?…`, notifications) are handled by
  `useAppCommands()` in the shell; extra handlers: `registerCommandHandler(fn)` (return `true` when handled).
- Page header: `usePageHeader({ parent, title, actions })` from `shell/` sets the breadcrumb and the header widgets.

### 6.2 Registration (no shared index)

| Thing | File | Export |
|---|---|---|
| Page | `src/renderer/pages/<id>/page.ts` | `export default definePage({ id, title, icon, section: "sandbox", order, component: lazy(() => import("./XPage")) })` |
| Settings section | `src/renderer/pages/preferences/sections/<id>/section.ts` | `definePreferencesSection({ id, title, icon, order, component })` |
| Onboarding step | `src/renderer/onboarding/<id>/step.ts` | `defineOnboardingStep({ id, title, railLabel, icon, optional, component })` |
| Gallery entry | `src/renderer/components/<Name>/<Name>.gallery.tsx` or `src/renderer/gallery/entries/<id>.gallery.tsx` | `defineGalleryEntry({ id, title, group, width?, render })` |
| IPC handler | `src/main/ipc/<service>.ts` | `defineService(...)` |
| Fixtures | `src/renderer/fixtures/<area>/{http,socket,ipc}.ts` | `defineHttpFixtures([...])`, `defineSocketFixtures([...])`, `defineIpcFixtures({...})` |

Ids must come from `src/shared/routes.ts`; the registry tests assert the order. Onboarding steps render their own
footer buttons with `<OnboardingFooter start={…} end={…} />` (portal into the panel footer) and their hero with
`<StepHero icon title description />` (`onboarding/shared/`).

### 6.3 Data layer

- `useConnectionSnapshot()` (config from `connection.load`, kept fresh by `connection:changed`),
  `useApiClient()` → a cached `TheOneClient` (fetch through IPC, or fixtures), `useApiQuery(key, (client, signal) =>
  client.listProjects({ signal }), options)` (key is namespaced by base URL).
- The connection state machine, workspace store, polling (`usePoller`), event stream and formatting helpers
  (services-data.md §4–§10) belong to `features/connection`, `features/workspace`, `lib`-style modules inside
  their feature folder. Build them on `useApiClient()`.
- Settings: `useSettings()` / `useUpdateSettings()` (`app/settings.ts`). Scheme: `useScheme()` → `"graphite" |
  "graphiteLight"` (re-render canvases on change). Window state: `useWindowState()` (`shell/use-window-state.ts`).
- Toasts: `showToast(message, { timeoutMs, action, scope })`; `<ToastHost scope="…" />` is mounted by the shell
  (`window`), the Settings dialog (`preferences`) and the wizard (`onboarding`).

### 6.4 Fixture mode

On when `MONOLITH_FIXTURES=1` (main passes it to the renderer), when the URL has `?fixtures`, in snapshots, in
vitest, and always in a plain browser (no preload bridge).

- HTTP: `@theone/client` uses `fixtureFetch`, which matches `{ method, path, respond }` routes. `path` is a
  `routePatterns.rest.*` string from `@theone/protocol` (`:id` segments become `params`), or a RegExp. Return a
  value (200 JSON), `undefined` (204), or `reply(status, body)`. Unmatched → 404 `{error:{code:"not_found"}}`.
- WebSockets: `FixtureSocket` opens immediately and sends the frames of the matching socket fixture
  (`/v1/events` sends `hello`).
- IPC: fixture methods replace the real bridge per method; methods without a fixture fall through to the bridge
  (so window controls still work in Electron), or reject with `unavailable` in a browser.
- Order: `fixtures/<area>/` beats `fixtures/base/`. `base/` holds the shared world (projects `streaxfit`
  (confidential), `monolith`, `hybrid-pos`, `sante-production`, sandbox `theone-sandbox`). Put page data in
  `fixtures/<page>/`, never edit `base/` (report additions instead).
- States: read `currentScenario()` / `isScenario("offline")` inside `respond` to switch data, then snapshot
  `--route "/overview?scenario=offline"`. Document your scenario names at the top of your `fixtures/<area>/http.ts`
  as an exported `SCENARIOS` constant.
- Tests can call `overrideIpcFixtures({...})` (returns a restore function) and `emitFixtureEvent(service, event,
  payload)`.

### 6.5 Idle

Snapshots wait for `window.__monolithIdle()`: fonts loaded, no react-query fetch/mutation, no finite running
animation for 300 ms, then two frames. Do not start finite animations in a loop; infinite ones (spinner, pulse,
shimmer) are ignored. Snapshot windows run with reduced motion, so entry animations are skipped.

---

## 7. Components

### 7.1 Folder shape

```
components/StatusBadge/
  StatusBadge.tsx            the component only (no constants, no strings)
  StatusBadge.module.css     styles
  constants.ts | labels.ts | <topic>.ts   numbers, strings, lookup tables
  index.ts                   re-exports the public API
  StatusBadge.gallery.tsx    gallery entry (+ gallery-samples.ts for its data)
  StatusBadge.test.tsx       optional
```

- PascalCase folder = component name. One owner per folder. Import through the folder (`../../components/Notice`).
- Props mirror the GTK widget signatures in the specs (`ActionButton(label, onActivate→onClick, variant, icon,
  tooltip)`, `Text(variant, color, lines, wrap, center, selectable)`, `StatusBadge(label, tone, icon, live)`,
  `EmptyState(...)`, `Notice(...)`, `ProgressBar(progress | null, tone)`…).
- Icons: `<Icon name="refresh" />` with app icon names from `theme/icons.ts` (theme.md §8.2), or `icon={LucideX}` for
  glyphs not in the table. Never import lucide in a page just to render a mapped icon.
- Strings live in `labels.ts` (verbatim from the spec), numbers in `constants.ts`, user-visible copy never inline.

### 7.2 Existing components (foundation first pass; their spec owner may refine)

`Icon`, `Text`, `ActionButton`, `IconButton`, `Spinner`, `BrandMark`, `ToneDot`, `StatusBadge`, `CountBadge`,
`EmptyState`, `Notice`, `ProgressBar`, `Surface`, `Toast` (`ToastHost`, `showToast`).

### 7.3 Components to create (name → spec)

| Spec | Components |
|---|---|
| theme.md §6 | `ConnectionDot`, `IconBadge`, `ProgressRing`, `Pressable`, `Chip`, `ChipGroup`, `SegmentedControl`, `TextField`, `Switch`, `Checkbox`, `Radio`, `Tooltip`, `Popover`, `Menu`, `Dialog` (DialogShell), `FormDialog`, `ConfirmDialog`, `Banner`, `Avatar`, `CopyField`, `FrameworkLogo` (SVGs in `theme/logos/`), `DotSphere`, `QrCode` |
| widgets-lists.md | `ListToolbar`, `PillTabs`, `ListGroup` (+`GroupHeader`), `GroupedList`, `RecordRow` (+`HoverRow`), `KeyedList`, `PropertyChip`, `Section` (+`SectionHeader`), `PageBody`, `KeyValueList` (+`KeyValueRow`), `PreferenceRows` (`SettingsGroup`, `Row`, `PropertyRow`, `EntryRow`, `SwitchRow`, `RadioRows`, `ExpanderRow`, `SettingsActions`), `ChoiceDropdown`, `StatCard` (+`StatGrid`), `Sparkline`, `TimeSeriesChart`, `SeriesLegend` |
| widgets-rich.md | `MarkdownView`, `CodeBlock`, `CopyButton`, `LogView`, `LogPanel`, `PaneBar`, `Placeholder`, `AgentAvatar`, `Timeline` (+ `UserBubble`, `AssistantMessage`, `ToolCallCard`, `SystemLine`, `OutcomeCard`, `ThinkingRow`), `Composer`, `SidebarComposer`, `ProjectCard` (+`ProjectGrid`), `ResizeHandle`; `useAccelGuard` lives in `features/shortcuts/` |
| onboarding.md §2.4 | `onboarding/shared/`: `CheckRow`, `ChoiceRow`, `ComponentRow`, `FieldRow`, `StepperRow`, `ProgressBlock`, `LogDisclosure`, `CommandBlock`, `LicenseViewer` (onboarding-shell owner) |

Reuse before you build: a page that needs a variant asks the component owner (open issue) instead of forking.

---

## 8. CSS and theme

- CSS Modules only (`X.module.css`, camelCase class names; Vite exposes `styles.someClass`). Global CSS exists only
  in `theme/` (`tokens.css`, `fonts.css`, `base.css`, `typography.module.css`).
- Use tokens: colors `var(--to-<token>)` (theme.md §2.1, e.g. `--to-surface`, `--to-text-secondary`,
  `--to-accent-strong`, `--to-border`), spacing `--to-space-*`, radii `--to-radius-*` (`sm` 6, `md` 8, `lg`/`card`
  10, `xl`/`sheet` 12, `pill`), shadows `--to-shadow-level1..4`, controls `--to-control-*`, typography classes from
  `theme/typography.module.css` (or the `Text` component). Literal hex values only where theme.md says "fixed
  color" (`#ffffff` on danger/accent, `#6C78E6` primary hover, `#000000` fullscreen stage, QR white).
- Schemes: `<html data-scheme="graphite|graphiteLight">` (set by `useApplyScheme`), `data-platform`
  (`linux|darwin|win32`), `data-window` (`main|onboarding|snapshot`), `data-reduced-motion="true"` in snapshots.
  Never branch on the scheme in CSS except through tokens; canvases read `useScheme()` + `theme/palettes.ts`
  (`CHART_PALETTE`, `PROJECT_TINTS`, `terminalTheme(scheme)`). Project tint washes: `rgba(var(--to-tint-<i>),
  var(--to-tint-rest|hover|selected))`.
- Base text is 13px Inter; `--to-font-sans|display|mono`. Fonts are bundled (`font-display: block`).
- Interactive states (theme.md §5): `transition: var(--to-state-transition)`; press `transform:
  scale(var(--to-press-scale))` (controls) / `var(--to-press-scale-card)` (cards). Focus: `:focus-visible` only
  (global 1px `--to-focus-ring`, offset 1).
- Drag regions: add the global classes `to-drag` / `to-no-drag` (titlebars, wizard rail/header).
- Pixel targets: compare against `docs/electron/reference/*.png` (1024×768, zoom 1). The GTK quirks listed at the
  end of each spec are **not** reproduced.

## 9. Motion (`theme/motion.ts`)

- Durations: `DURATION_MS` (fast 120, normal 180, slow 260…), easings `EASE.standard [0.2,0,0,1]`,
  `decelerate`, `accelerate`, `overshoot`. CSS mirrors: `--to-duration-*`, `--to-ease-*`.
- Presets (motion variants, use with `initial="initial" animate="animate" exit="exit"`): `fade` (crossfades 180),
  `pageEnter` (pushed sub-view: x 24→0), `stepForward`/`stepBackward` (wizard), `popover` (scale 0.98, 120),
  `dialog`, `toast` (y 8), `rise` (rows/checks, y 4), `reveal` (height auto, 180). `stagger(index, STAGGER_MS.rows)`
  for lists (cap 20). `pressable.control|card` for `whileTap`.
- Keyframes in `base.css`: `to-pulse` (live dots, 2880ms), `to-shimmer` (indeterminate bars, 1440ms), `to-spin`.
- Reduced motion: `MotionConfig reducedMotion="user"` (always in snapshots), CSS durations collapse to 0 and press
  scale to 1. Spinners keep turning (`data-motion-essential`). Do not add motion outside 120–260 ms without a spec
  reason.

---

## 10. Snapshot and diff workflow

1. Add fixtures for the state you want (`fixtures/<area>/`, optional `?scenario=`).
2. `bun run snapshot -- --route /projects/monolith --out .snapshots/projects-detail.png` (dark) and `--light`.
   Default size 1024×768 = the reference captures. Wizard: `--route /onboarding/docker --width 880 --height 620`.
   Single component: `--route /gallery/status-badge`. Settings: `--route "/overview?preferences=stt"`.
3. `bun run diff -- .snapshots/projects-detail.png docs/electron/reference/page-projects-core-detail.png --out
   .snapshots/projects-detail-diff.png`. Look at the PNGs, not only the percentage: reference captures have live
   data, GTK rounded window corners and a ~305px sidebar, so set up fixtures/sidebar width to match before judging.
4. Store your own working captures under `apps/electron/.snapshots/` (git-ignored). New reference images for the
   wizard go to `docs/electron/reference/onboarding-<step>[-state][-light].png` (onboarding owner only).

How it works: the script builds when `out/` is older than the sources, then starts Electron with
`--ozone-platform=headless --ozone-override-screen-size=…` on Linux (nothing appears on screen), a temporary
profile (`MONOLITH_USER_DATA`, `MONOLITH_DESKTOP_CONFIG`, `MONOLITH_STATE_DIR` under `$TMPDIR/monolith-test-*`),
`MONOLITH_FIXTURES=1`, and `--monolith-snapshot=<json>`; main opens one hidden window with the exact content size,
waits for idle, `capturePage()`s and exits. It never touches the user's config or sandbox.

## 11. Tests

- Unit (node): `tests/**/*.test.ts`, `src/{core,shared}/**/*.test.ts`, `cli/**/*.test.ts`.
- Unit (renderer, happy-dom): `src/renderer/**/*.test.{ts,tsx}`; use `renderWithProviders`/`renderRoutes` from
  `src/renderer/test/render.tsx`. CSS modules are non-scoped in tests (class names = source names).
- E2E: `e2e/<area>.spec.ts` with `launchApp({ config, env })` from `e2e/app.ts` (isolated profile, fixtures on,
  headless on Linux, always `close()` in `afterEach`). Pass `env: { MONOLITH_FIXTURES: "0" }` for real-service
  tests. Docker resources in tests: compose project/containers/volumes/images prefixed `monolith-test-` (or the
  e2e harness's `theone-e2e`), removed afterwards. Never stop or mutate the user's `theone` stack or the daemon on
  7701; e2e host-shell runs use `THEONE_HOST_SHELL_PORT=<free>`, `THEONE_HOST_SHELL_DIR=<tmp>`,
  `--bind 127.0.0.1`.
- Everything in `bun run test` must pass with no display and no Docker.

## 12. Main process notes

- Startup (`src/main/index.ts`): PATH fix (`applyPathFix`), single-instance lock (skipped when
  `MONOLITH_SNAPSHOT=1` or in snapshot mode), `monolith://` protocol, config migration, settings, IPC registry,
  then the first-run decision (`decideFirstRun` in `src/core/onboarding`: completed or configured → main window,
  else Docker discovery with a 2.5 s timeout (`adoptDiscoveredSandbox` in `src/main/services/commands.ts`: a healthy
  sandbox is saved as the connection and `completeOnboardingFromDiscovery` marks onboarding complete, onboarding.md
  §3.4; `MONOLITH_DISABLE_DISCOVERY=1` turns it off), else the wizard window at the saved step). Then sandbox autostart
  (`src/main/services/autostart.ts` over `src/core/sandbox/autostart.ts`; also with `--hidden`): `compose up -d` for a
  Monolith-created stack when `sandboxAutostart` is on and it is stopped; Docker unreachable → one notification. On a
  packaged Linux AppImage it also refreshes the CLI sidecar (`src/main/services/cli-sidecar.ts`, §13). Flags:
  `--hidden`, `--page <id>`, `--quit`, `--debug`.
- Windows (`src/main/windows/manager.ts`): main 1240×800 (min 360×480), wizard 880×620 (min 760×560), frameless;
  macOS `hiddenInset` traffic lights (14,14), Linux/Windows draw `WindowControls`; Linux frameless windows get
  native rounded corners (Electron ≥ 43). Zoom = `webContents.setZoomFactor` with the GTK steps, persisted as
  `zoom`.
- Electron 44 specifics: the `clipboard` module is main-only and Promise/MIME based (`ClipboardItem`) — the
  attachments unit implements `clipboardHasImage`/`pasteImage` against the 44 API; macOS notifications need a
  signed app; `net.fetch` is used for the HTTP proxy.
- Config file: `$MONOLITH_DESKTOP_CONFIG`, else `~/.config/monolith-desktop/config.json` on Linux (shared with the
  GTK app), else `<userData>/config.json`. Keys stay GTK-compatible; new Electron keys: `onboarding`,
  `sandboxStack`, `androidSdkRoot`, `androidAvd`, `sandboxAutostart`, `sandboxImageRef`.

## 13. Packaging

- `extraResources`: `dist-cli/${os}-${arch}` → `resources/bin` (`tesseract`, `theone-controller`),
  `build/sandbox-context` → `resources/sandbox` (repo-relative layout; `contextDir` for compose/buildx, see
  `src/main/services/resources.ts`), icons, font licenses.
- Linux deb: app at `/opt/Monolith`, launcher `monolith-desktop`, `/usr/bin/tesseract` symlink to
  `resources/bin/tesseract` (postinst, only when free or ours). AppImage: `app.installCli()` copies the CLI to
  `~/.local/share/monolith/bin/tesseract` and links `~/.local/bin/tesseract`; on install and every AppImage launch
  (while the copy exists) `refreshCliSidecar` writes `~/.local/share/monolith/app.json` `{appPath, sandboxDir}` and
  syncs `resources/sandbox` to `~/.local/share/monolith/sandbox` (skipped when `.bundle-hash`, the sha256 of the
  bundle's `manifest.json`, is unchanged), so the copied CLI finds the app and the sandbox context. Windows NSIS (per-user): adds `$INSTDIR\resources\bin` to the user PATH and removes it on
  uninstall. macOS: in-app "Install tesseract command" (`app.installCli()` → admin prompt, `/usr/local/bin/tesseract`).
- The bundle manifest records the git commit and `dirty` flag; untracked files are not bundled.

## 14. Deviations from the specs (decided here)

- Onboarding step ids follow onboarding.md (`… build … finish`), not "done". The rail label of `finish` is "Done".
- Spec paths like `src/main/sandbox/*.ts`, `src/main/sync/*`, `src/renderer/services/*` map to
  `src/core/<service>/` (Node logic), `src/main/ipc/<service>.ts` (IPC), `src/renderer/features/<domain>/`
  (renderer state).
- onboarding.md §2.4 puts building blocks in `components/onboarding/`; they live in `onboarding/shared/`.
- Settings is a route flag (`?preferences=<section>`) rendered over the shell, not a separate window.
