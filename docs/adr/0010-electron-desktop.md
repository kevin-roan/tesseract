# ADR 0010: Electron desktop app, Docker required, renderer dev port 4545

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The desktop companion (`apps/desktop`, "Tesseract", app id `dev.tesseract.Desktop`) is
a Python GTK4/libadwaita app. It works well on a Linux desktop, but:

- It does not ship on macOS or Windows. GTK4 + libadwaita + PyGObject have no
  practical one-file installer there; the app is a Python package
  (`tesseract-desktop`) installed from a checkout.
- Setting up a computer is manual. The user installs Docker, edits `.env`, runs
  `infra/scripts/sandbox`, installs the Android SDK and creates an AVD for the host
  emulator ([app-runs-and-emulator.md](../architecture/app-runs-and-emulator.md))
  by following runbooks. There is no guided first run.
- Its logic is a Python copy of what already exists in TypeScript: the controller
  protocol and client (`@tesseract/protocol`, `@tesseract/client`) are shared by the
  controller and the phone app, while the desktop reimplements them.
- The sync commands (`--sync`, `--pull`, `--revert`, `--sync-status`) are flags of
  the Python app itself, so they only exist where the app was installed from source.

The new app must ship one installer per OS (dmg, NSIS exe, AppImage + deb) that
includes the CLI, set up Docker, the sandbox image and the Android emulator from a
wizard (the way Android Studio's setup wizard does), and look the same as the GTK app,
which follows the Linear desktop app pixel for pixel.

## Decision

- **Electron** (pinned to 44.5.1) in a new workspace `apps/electron`
  (`@tesseract/electron`), built with electron-vite, with a React 19 renderer and a
  Node main process. The GTK app stays in the repository until the Electron app
  replaces it; both read the same `config.json` keys and sync-back state.
- **Shared Node core.** Docker, sandbox, Android SDK, onboarding, connection,
  sync-back and host-daemon logic live in `src/core/` as plain Node TypeScript with
  no `electron` import. The main process and the `tesseract` CLI (compiled with
  `bun build --compile` and shipped in `resources/bin`) both use it. The renderer
  uses `@tesseract/client` like the phone app.
- **Typed IPC.** One contract per service in `src/shared/contracts/`, derived
  channel names, results as `{ ok, value | error }`, a sandboxed preload that only
  forwards known channels, and handlers that accept only the app's own frames.
- **Docker is required.** The sandbox stays one container plus optional sidecars
  (ADR 0003), run by Docker Desktop on macOS and Windows and by Docker Engine (or
  Podman's Docker API) on Linux. The wizard detects, installs or starts it, checks
  Compose (≥ 2.24) and buildx, then builds the image from the build context bundled
  in the installer (or pulls a published image, or reuses an existing one).
  There is no fallback runtime.
- **Android SDK without Android Studio.** The app reads Google's SDK repository XML,
  downloads and verifies the emulator, platform-tools and a system image itself,
  records licence acceptance like `sdkmanager`, checks KVM/WHPX/HVF, and writes AVDs
  for the host emulator.
- **Renderer dev server on 127.0.0.1:4545, `strictPort`** (dev and preview). Packaged
  builds load `file://` and open no port.
- **The design is a port, not a redesign.** CSS tokens, fonts (Inter, Inter Display,
  Geist Mono), Lucide icons (pinned to the GTK app's glyph version) and layout come
  from the GTK theme specs. Screens are checked against GTK captures with a headless
  snapshot and pixelmatch diff tool. Micro-animations use the `motion` library within
  120–260 ms and turn off under `prefers-reduced-motion`.

The full design is in [electron-desktop.md](../architecture/electron-desktop.md).

## Consequences

- One codebase produces signed-ready installers for the three desktop OSes, with the
  CLI on `PATH` (deb symlink, NSIS user `PATH`, in-app install on macOS and for the
  AppImage) and self-updates through electron-updater.
- First run is a wizard instead of runbooks. The runbooks remain valid for
  headless servers and for anyone who prefers the shell; `tesseract sandbox …`,
  `tesseract android …` and `tesseract doctor` cover the same steps from a terminal.
- The desktop and the phone now share the client, the protocol types and their
  fixtures. A protocol change is typechecked against both.
- Installers are large: Electron itself (~100 MB per architecture, a universal macOS
  build carries both), the compiled CLI and controller (Bun runtime each), and the
  sandbox build context.
- Building the image locally takes a long time and needs 15 GB or more of disk.
  "Offline" means offline from the repository, not from the network: base images,
  apt packages and SDKs are still downloaded during the build.
- Without Docker the app can only connect to a sandbox somewhere else (a saved or
  pasted pairing link). Everything local (stack control, builds, the host emulator
  wiring) needs a working Docker.
- Two desktop apps exist until the GTK app is retired. The `config.json` format
  and the sync-back state are a compatibility surface between them and must only
  change additively.
- macOS notarization and Windows signing need credentials outside the repository;
  unsigned builds trigger Gatekeeper and SmartScreen warnings.
- Pixel parity is verified by snapshot diffs, not guaranteed. GTK quirks listed in the
  specs are intentionally not reproduced.

## Alternatives considered

- **Keep GTK and package it per OS** (Flatpak on Linux, gtk-osx / MSYS2 bundles
  elsewhere). Flatpak sandboxing gets in the way of Docker, `/dev/kvm` and the host
  daemon, and the macOS and Windows GTK4 + libadwaita stacks are fragile to bundle.
  It also keeps the Python copy of the protocol and client.
- **Tauri.** Smaller installers, but the UI would render in three different engines
  (WebKitGTK, WKWebView, WebView2), which defeats pixel matching and makes xterm,
  noVNC and font rendering differ per OS. The backend would be Rust, so the Docker,
  SDK and sync-back logic could not be shared with the Bun-compiled CLI and the
  existing TypeScript packages.
- **A web UI served by the controller or the host daemon.** Cannot install Docker,
  start the engine, download the SDK or create AVDs before a sandbox exists, and has no
  tray, notifications, deep links or OS installer.
- **Bundle a VM instead of requiring Docker** (Lima/Colima-style). A second
  virtualization layer to ship and update on every OS, conflicts with the host
  emulator's need for KVM/WHPX/HVF, and duplicates what Docker Desktop already does
  on macOS and Windows.
- **Default Vite/Electron dev ports** (5173 and friends). They collide with the dev
  servers of the projects being worked on (the sandbox's own run targets default to
  5173) and with Expo on 8081. A fixed, unusual, strict port fails loudly instead of
  silently moving to another one.
