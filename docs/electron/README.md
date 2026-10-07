# Monolith desktop app (Electron)

`apps/electron` (package `@monolith/electron`, app id `dev.monolith.Desktop`) is the Monolith desktop app for
Linux, macOS and Windows. It rebuilds the GTK4/libadwaita app in `apps/desktop` in Electron and adds what the GTK
app never had: a first-run setup wizard that installs and configures Docker, builds and starts the sandbox, and
downloads the Android emulator, system images and an AVD for the host emulator, like Android Studio's setup wizard.
It ships one installer per OS and a standalone `tesseract` command.

The UI follows the GTK app pixel for pixel, which itself follows the Linear desktop app: Inter / Inter Display /
Geist Mono, Lucide icons, graphite palette (`#09090A` window, `#121213` inset, `#1A1A1B` dialogs, `#232325`
selection, `#5E6AD2` accent), 13px base text, 6–12px radii, and 120–260 ms micro-animations (motion) that turn off
under `prefers-reduced-motion`.

The contract (names, ports, env vars, files, CLI, packaging) is in the
[blueprint §4.4, §7.1 and §12](../architecture/00-blueprint.md#12-desktop-app-appselectron-package-monolithelectron).

## This folder

| Path | What it is |
|---|---|
| [conventions.md](conventions.md) | **Read first.** Stack and versions, commands, directory map, the IPC contract and service catalogue, core modules, renderer routes, fixture mode, components, CSS tokens, motion, snapshot workflow, tests, main process notes, packaging, deviations from the specs |
| [spec/](spec/) | What to build, surveyed from the GTK source (numbers, strings, states, GTK quirks not to copy) plus the new design specs for the wizard |
| [reference/](reference/) | 1024×768 captures of the GTK app (dark and light) that snapshots are diffed against |

### Specs

| Spec | Covers |
|---|---|
| [theme.md](spec/theme.md) | design tokens (graphite / graphiteLight), fonts, base components, motion tokens, the icon table |
| [shell.md](spec/shell.md) | window, titlebar and window controls, sidebar, navigation, dialogs, tray, startup |
| [widgets-lists.md](spec/widgets-lists.md) | lists, rows, sections, preference rows, segmented controls, dropdowns, progress, stat cards, charts |
| [widgets-rich.md](spec/widgets-rich.md) | markdown, code blocks, logs, the conversation timeline, composers, project cards, resize handle |
| [page-files-overview.md](spec/page-files-overview.md) | the Overview and Files pages |
| [page-agents.md](spec/page-agents.md) | the Agents page: conversation list, conversation view, new conversation |
| [page-projects-core.md](spec/page-projects-core.md) | Projects list and detail shell, create / rename / delete / run dialogs |
| [page-projects-tabs.md](spec/page-projects-tabs.md) | detail tabs (Processes, Builds, Artifacts, Git, Sync back, Chats), sync review, emulator launch |
| [page-terminals.md](spec/page-terminals.md) | the Terminals page and the xterm.js widget |
| [page-display.md](spec/page-display.md) | the Display page (noVNC over the controller bridge) |
| [preferences.md](spec/preferences.md) | the Settings dialog and `config.json` |
| [host-android.md](spec/host-android.md) | host shell daemon control, host Android emulator, Claude accounts, speech-to-text settings |
| [services-data.md](spec/services-data.md) | sandbox discovery, connection, polling, event stream, caches |
| [services-sync.md](spec/services-sync.md) | sync-back, the `tesseract` sync CLI, composer attachments |
| [onboarding.md](spec/onboarding.md) | the setup wizard: Docker, Claude, sandbox image and stack, Android SDK / images / AVD, pairing (a design spec: the GTK app has no wizard) |

### Reference captures

File names are `<spec>-<state>[-light].png`; each spec has a table of what its captures show.

| Prefix | Spec |
|---|---|
| `shell-*` | shell.md (default, collapsed sidebar, pair dialogs) |
| `widgets-lists-*` | widgets-lists.md |
| `page-files-overview-*` | page-files-overview.md |
| `page-agents-*` | page-agents.md |
| `page-projects-core-*`, `page-projects-tabs-*` | the two Projects specs |
| `page-terminals-*` | page-terminals.md |
| `page-display-*` | page-display.md |
| `preferences-*` | preferences.md (and host-android.md for Claude, Host shell, Speech-to-text) |

## The app in one page

```text
apps/electron/
  src/main/        Electron main: windows, tray, menu, deep links, updater, IPC handlers (src/main/ipc/<service>.ts)
  src/preload/     typed IPC bridge (sandboxed, CJS)
  src/core/        Node-only logic shared with the CLI: docker, sandbox, android, connection, host, syncback, claude, config, paths
  src/shared/      IPC contracts (src/shared/contracts/<service>.ts), routes, runtime constants (port 4545, env names)
  src/renderer/    React 19: shell/, pages/<page>/, features/<page>/, onboarding/<step>/, components/<Name>/, theme/, fixtures/
  cli/             the `tesseract` command (bun build --compile)
  scripts/         snapshot, diff, cli-build, bundle-sandbox, dist, smoke, icons, check-nsis-path
  e2e/             Playwright _electron specs
  tests/           architecture and IPC contract tests
  build/           icons, entitlements, installer.nsh, linux/after-*.sh, sandbox-context/ (generated)
```

- **Pages:** Overview, Agents, Projects, Files, Terminals, Display, all on the sandbox controller through
  `@theone/client` (HTTP goes through main's `net.fetch`).
- **Settings:** Connection, Appearance, Claude, Host shell, Speech-to-text, Sandbox, Android, About
  (`#/<page>?preferences=<section>`).
- **Setup wizard:** Welcome, Docker, Claude, Sandbox (with the image build), Android (optional), Pair
  (optional), Done. It opens on first run (until it is finished, a connection is configured, or Docker discovery finds a
  healthy local sandbox, which is then saved and setup marked complete), and later from
  Settings › Sandbox (**Set up…**), the command palette, a project's emulator tab (**Set up emulator**) and
  `monolith://onboarding[/<step>]`. The Docker step installs Docker Desktop (macOS, Windows), WSL 2 (Windows) or Docker
  Engine / Docker Desktop for Linux, fixes `docker`/`kvm` group membership and starts the engine; Podman is reported
  as unsupported. The Sandbox step writes the stack's env file, builds `theone/sandbox` from the bundled context
  with the chosen components (`WITH_ANDROID`, `WITH_FLUTTER`, `WITH_MONO`, `WITH_WHISPER`; Chromium is always
  in the image) and starts it. The Android step is its own SDK manager (no Java, no `sdkmanager`): it checks
  KVM / WHPX / HVF, downloads the emulator, platform-tools and a system image, and writes the AVD the host
  emulator uses.
- **Host shell:** the app runs `theone-controller host serve` (bundled in `resources/bin`) as a child process,
  as the GTK app did ([host-shell runbook](../runbooks/host-shell.md)).
- **CLI:** `tesseract status | open | doctor | sandbox | android | pair | sync | config | version`, plus the GTK app's
  `--sync`/`--pull`/`--revert`/`--sync-status` flags ([blueprint §7.1](../architecture/00-blueprint.md#71-host-tesseract-cli)).

## Working on it

Run from `apps/electron` (root shortcuts in brackets). Never start, stop or restart the Expo server on 8081, the
`theone` sandbox stack or the host daemon on 7701 for this work.

| Command | What it does |
|---|---|
| `bun run dev` (`bun run electron`) | electron-vite dev; renderer on `http://127.0.0.1:4545` (strict port) |
| `bun run typecheck` | `tsc` over the node and web projects |
| `bun run test` | vitest (node + happy-dom); no display, no Docker; part of the root `bun run test` |
| `bun run snapshot -- --route <route> --out <png> [--light] [--width W --height H]` | headless capture with fixtures in an isolated profile |
| `bun run diff -- <a.png> <b.png> [--out diff.png] [--max <percent>]` | pixelmatch against a reference capture |
| `bun run build` (`electron:build`) | `out/` |
| `bun run e2e` (`electron:e2e`) | builds if stale, then the Playwright specs ([e2e-testing](../runbooks/e2e-testing.md#desktop-app-appselectron)) |
| `bun run cli:build [-- --target linux-x64,mac-arm64 \| --all]` | `dist-cli/<os>-<arch>/{tesseract,theone-controller}` |
| `bun run dist [-- --platform linux\|mac\|win] [--dir] [--smoke]` (`electron:dist`) | installers in `dist/` |
| `bun run smoke` (`electron:smoke`) | checks the built AppImage/deb |

Snapshot workflow and pixel targets: [conventions.md §10](conventions.md#10-snapshot-and-diff-workflow).
