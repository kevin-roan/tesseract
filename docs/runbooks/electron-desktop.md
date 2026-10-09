# Electron desktop app: develop, test, package, release

`apps/electron` (package `@tesseract/electron`, product **Tesseract**, app id
`dev.tesseract.Desktop`) is the Electron rewrite of the GTK desktop companion in
`apps/desktop`. It has the same pages and looks the same, and adds a setup wizard
(Docker, sandbox image, Android emulator, Claude, pairing) and a standalone `tesseract`
CLI. Contract for agents working on it: [docs/electron/conventions.md](../electron/conventions.md);
what each screen must look like: [docs/electron/spec/](../electron/spec/); reference
captures of the GTK app: [docs/electron/reference/](../electron/reference/).
User-facing setup: [onboarding.md](onboarding.md). CLI reference: [tesseract-cli.md](tesseract-cli.md).

This runbook is about building the desktop app itself. Building Electron apps
*inside the sandbox* is [electron-builds.md](electron-builds.md).

## Requirements

| What | Version / note |
|---|---|
| bun | 1.3+, `bun install` done at the repository root (Electron 44.5.1 and all tooling are devDependencies) |
| Node | 24 on `PATH`: the scripts (`snapshot`, `diff`, `dist`, `smoke`, …) run as `node scripts/x.ts` with built-in type stripping |
| Docker | only for the Docker/sandbox e2e tests and for a real wizard run; unit tests and snapshots don't need it |
| ImageMagick 7 (`magick`) | only for `bun run icons` |
| wine | only for `bun run check:nsis` and Windows packaging on Linux |

## Commands

Run these from `apps/electron`, or use the root shortcuts in the last column.

| Command | What it does | Root shortcut |
|---|---|---|
| `bun run dev` | electron-vite dev: main + preload builds, renderer dev server on **`http://127.0.0.1:4545`** (`strictPort`), opens a window with hot reload | `bun run electron` |
| `bun run build` | electron-vite build into `out/` (`main/index.js` ESM, `preload/index.cjs`, `renderer/index.html`) | `bun run electron:build` |
| `bun run preview` | serves the built renderer, also on 127.0.0.1:4545 | — |
| `bun run typecheck` | `tsc -p tsconfig.node.json && tsc -p tsconfig.web.json` | part of `bun run typecheck` |
| `bun run test` | vitest, no display and no Docker needed | part of `bun run test` |
| `bun run e2e` | builds `out/` if stale, then Playwright `_electron` specs in `e2e/` | `bun run electron:e2e` |
| `bun run snapshot -- …` | one headless capture of a route as PNG (below) | — |
| `bun run diff -- a.png b.png …` | pixelmatch two PNGs (below) | — |
| `bun run cli:build` | compiles `tesseract` and `tesseract-controller` with `bun build --compile` | — |
| `bun run bundle:sandbox` | writes the sandbox build context to `build/sandbox-context/` | — |
| `bun run dist -- …` | build + CLI + sandbox bundle + electron-builder (below) | `bun run electron:dist` |
| `bun run smoke` | checks the built AppImage/deb (below) | `bun run electron:smoke` |
| `bun run icons` | regenerates `build/icon.png`, `icon-mac.png`, `icon.ico`, `icons/*.png` | — |
| `bun run check:nsis` | runs the NSIS PATH macros of `build/installer.nsh` under wine | — |

While other people edit the package, typecheck the whole program in one go with
`bunx tsc --noEmit -p apps/electron` from the repository root.

## Develop on port 4545

```bash
bun run electron            # from the repository root
```

- The renderer dev server always binds `127.0.0.1:4545` (`RENDERER_DEV_PORT` in
  `src/shared/runtime.ts`, used by `electron.vite.config.ts` for `server` and `preview`).
  `strictPort` is on: if 4545 is taken the dev server fails instead of moving to another
  port. Check with `ss -ltn | grep :4545`. It never uses the Vite (5173) or other default
  ports, and it does not touch the Expo server on 8081.
- Main accepts IPC only from `file://` and the dev server origin.
- **Fixture mode** shows the UI with canned data and no sandbox: set `TESSERACT_FIXTURES=1`,
  or open `http://127.0.0.1:4545/#/overview?fixtures` in a browser (a plain browser is
  always in fixture mode, because it has no preload bridge). `?scenario=<name>` picks a
  fixture state, `?scheme=light|dark` the colour scheme.
- Useful routes: `#/<page>` (`overview`, `agents`, `projects`, `files`, `terminals`,
  `display`), `#/<page>?preferences=<section>` (Settings: `connection`, `appearance`,
  `claude`, `host-shell`, `stt`, `sandbox`, `android`, `about`), `#/onboarding/<step>`
  (`welcome`, `docker`, `claude`, `sandbox`, `android`, `pair`, `finish`), `#/gallery[/<entry>]`
  (every component on its own).
- Launch flags of the app binary: `--hidden` (start in the tray), `--page <id>`, `--quit`
  (ask a running instance to quit), `--debug` (debug logging). Log level otherwise comes
  from `TESSERACT_DESKTOP_LOG` (`debug|info|warn|error`); logs go to stdout/stderr.
- A dev run uses your real profile. To keep it away from your config, point it elsewhere:
  `TESSERACT_DESKTOP_CONFIG=/tmp/m/config.json TESSERACT_USER_DATA=/tmp/m/data TESSERACT_STATE_DIR=/tmp/m/state bun run electron`.

### Where the app keeps its files

| What | Linux | macOS | Windows |
|---|---|---|---|
| `config.json` (shared with the GTK app on Linux) | `~/.config/tesseract-desktop/config.json` | `~/Library/Application Support/Tesseract/config.json` | `%APPDATA%\Tesseract\config.json` |
| App data (`userData`) | `~/.config/Tesseract` | `~/Library/Application Support/Tesseract` | `%APPDATA%\Tesseract` |
| Sandbox env file | `<userData>/sandbox/.env` (0600) | same | same |
| Downloads (Docker installer) | `<userData>/downloads/` | same | same |
| Android package list cache | `<userData>/android/cache/` | same | same |
| AppImage CLI copy, its `app.json` and sandbox context | `~/.local/share/tesseract/{bin/tesseract,app.json,sandbox/}` | — | — |
| Sync-back state | `~/.local/state/tesseract` | `~/.local/state/tesseract` | `%LOCALAPPDATA%\Tesseract\state` |
| Default Android SDK | `~/.local/share/tesseract/android-sdk` | `~/Library/Application Support/Tesseract/android-sdk` | `%LOCALAPPDATA%\Tesseract\android-sdk` |

Overrides: `TESSERACT_DESKTOP_CONFIG`, `TESSERACT_USER_DATA`, `TESSERACT_STATE_DIR`
(`XDG_CONFIG_HOME` / `XDG_STATE_HOME` are honoured too). The CLI resolves the same paths.
`TESSERACT_ANDROID_REPOSITORY_URL` / `TESSERACT_ANDROID_SYSIMG_URL` replace Google's Android
package lists (a full `.xml` URL or a base URL; `http(s)` only), and
`TESSERACT_DISABLE_DISCOVERY=1` stops the first-run lookup of a running sandbox through Docker.

The AppImage copy of the CLI (`~/.local/share/tesseract/bin/tesseract`) gets an `app.json`
(`{appPath, sandboxDir}`) and a copy of the bundled sandbox context in
`~/.local/share/tesseract/sandbox` on install and on every AppImage launch
(`src/main/services/cli-sidecar.ts`; the copy is redone only when `.bundle-hash` changes).

## Snapshot and diff workflow

The UI is matched pixel for pixel against captures of the GTK app in
`docs/electron/reference/*.png` (1024×768, zoom 1). Snapshots run headless and isolated,
so nothing appears on screen and your config and sandbox are never touched.

```bash
cd apps/electron
bun run snapshot -- --route /projects/tesseract --out .snapshots/projects-detail.png
bun run snapshot -- --route /projects/tesseract --out .snapshots/projects-detail-light.png --light
bun run diff -- .snapshots/projects-detail.png docs/electron/reference/page-projects-core-detail.png \
  --out .snapshots/projects-detail-diff.png
# mismatch: 1.84% (14467 of 786432 pixels)
```

| `snapshot` option | Default | Meaning |
|---|---|---|
| `--route <route>` | `/overview` | hash route, query flags allowed (`"/overview?preferences=stt"`, `"/overview?scenario=offline"`) |
| `--out <file.png>` | required | relative to `apps/electron` |
| `--light` | dark | light scheme (`graphiteLight`) |
| `--width`, `--height` | 1024×768 | content size; the wizard is `--width 880 --height 620` |
| `--rebuild` | off | force `bun run build` (otherwise it builds only when `out/` is older than the sources) |
| `--headed` | off | show the window (Linux snapshots normally use `--ozone-platform=headless`) |
| `--timeout <ms>` | 20000 | idle wait limit |

| `diff` option | Default | Meaning |
|---|---|---|
| `--out <file.png>` | none | write the red/yellow diff image |
| `--threshold <0..1>` | 0.1 | pixelmatch colour threshold per pixel |
| `--max <percent>` | none | exit 1 when the mismatch is above this; without it `diff` always exits 0 |

Input paths try `apps/electron` first and then the repository root. Different sizes are
compared on the common area and the rest counts as mismatch.

How it works: the script starts Electron with a temporary profile under
`$TMPDIR/tesseract-test-*` (`TESSERACT_USER_DATA`, `TESSERACT_DESKTOP_CONFIG`,
`TESSERACT_STATE_DIR`, `XDG_CACHE_HOME`), `TESSERACT_FIXTURES=1`, `TESSERACT_SNAPSHOT=1`,
device scale 1 and reduced motion. Main opens one hidden window of the exact size, waits
for `window.__tesseractIdle()` (fonts loaded, no queries or mutations running, no finite
animation for 300 ms), calls `capturePage()`, writes the PNG and exits. The profile is
deleted afterwards.

Tips:

- Look at the PNGs, not only the percentage: the reference captures have live data, GTK's
  rounded window corners and a wider sidebar. Use fixtures and scenarios that match the
  reference before you judge.
- Single components: `--route /gallery/<entry>`; Settings: `--route "/overview?preferences=<section>"`;
  wizard steps: `--route /onboarding/<step> --width 880 --height 620`.
- Keep working captures in `apps/electron/.snapshots/` (git-ignored).

## Tests

```bash
bun run typecheck && bun run test        # repository root: every workspace, Electron included
bun run --cwd apps/electron test          # only the Electron package
bunx vitest run --project node            # in apps/electron: Node tests only
bunx vitest run --project web src/renderer/onboarding   # renderer tests under a path
```

| vitest project | Environment | Files |
|---|---|---|
| `node` | node | `tests/**` (architecture + IPC contract rules), `src/{core,shared,main}/**/*.test.ts`, `cli/**/*.test.ts`, `scripts/**/*.test.ts` |
| `web` | happy-dom | `src/renderer/**/*.test.{ts,tsx}` (CSS module class names are not hashed in tests) |

Everything in `bun run test` passes without a display, without Docker and without network.
`tests/architecture.test.ts` fails when `src/core`, `src/shared` or `cli` import `electron`,
when the renderer imports `node:*`, `src/core` or `electron`, or when `src/shared` imports
`node:*`. Temporary files use the `tesseract-test-` prefix.

## End-to-end tests

```bash
bun run electron:e2e                                   # repository root
bun run --cwd apps/electron e2e -- --grep onboarding   # one area
infra/e2e/run --electron                               # infra suite, then the Electron suites against the same stack
infra/e2e/run --no-build --electron-only               # only the Electron suites, reusing tesseract/sandbox:e2e
```

`bun run e2e` builds `out/` when it is stale and runs Playwright (`_electron`, one worker,
60 s per test) on the specs in `e2e/`. Every launch uses `launchApp()` from `e2e/app.ts`: an
isolated `tesseract-test-*` profile, fixtures on unless the test passes
`TESSERACT_FIXTURES=0`, `TESSERACT_DISABLE_DISCOVERY=1` for the onboarding specs (so a
running `tesseract` stack doesn't skip the wizard), headless on Linux, a 1240×800 window, and the app is always closed
in `afterEach`.

| Spec | Covers | Needs |
|---|---|---|
| `shell.spec.ts` | main shell when onboarding is complete; Settings from the status row; a fresh profile opens the wizard | — |
| `preferences.spec.ts` | Settings sections and theme switch; speech-to-text profile; Claude accounts | — |
| `onboarding.spec.ts` | fresh profile lands on Welcome; Docker step detects the local engine and Compose; Sandbox step components and a simulated build (fixtures); Android step lists packages from a local fixture repository (an HTTP server passed in with `TESSERACT_ANDROID_REPOSITORY_URL` / `TESSERACT_ANDROID_SYSIMG_URL`), installs into a temporary SDK and writes an AVD; Finish opens the main window and is remembered; a configured connection skips the wizard | Docker step: a reachable Docker. Android: linux-x64. Live: `TESSERACT_E2E_URL` |
| `app.spec.ts` | visual baselines of every page, two Settings sections and the light scheme; live controller: connect from Settings, every page, overview stats, create a project, start/stop a process, terminal `echo hi`, shared files, VNC display, save preferences | live part: `TESSERACT_E2E_URL` + `TESSERACT_E2E_TOKEN` |
| `cli.spec.ts` | `tesseract` compiled for this host: version/help, exit codes, `config`, `doctor`, `android images` against the fixture repository, `sandbox status`, `pair`, `open` | Docker for some cases; e2e stack for the live cases |
| `packaging.spec.ts` | `electron-builder.yml` (CLI + sandbox context as extra resources, universal dmg, per-user NSIS with PATH, AppImage + deb with CLI links); NSIS PATH macros under wine; the AppImage contents, the bundled CLI version, `--quit`, and that the packaged app renders the wizard | linux-x64; wine for the NSIS case |

Environment:

| Variable | Effect |
|---|---|
| `TESSERACT_E2E_URL`, `TESSERACT_E2E_TOKEN`, `TESSERACT_E2E_PROJECT`, `TESSERACT_E2E_ENV_FILE`, `TESSERACT_E2E_IMAGE` | the live stack; `infra/e2e/run --electron` sets them. The suite refuses a project that doesn't start with `tesseract-e2e`, so it can't mutate your `tesseract` stack |
| `TESSERACT_E2E_DIST` | `stale` (default: run `dist` when the AppImage is older than its inputs, up to 30 min), `always`, or `never` (skip the AppImage cases when there is none) |
| `TESSERACT_E2E_CLI` | path of a prebuilt `tesseract` to test instead of compiling one |
| `TESSERACT_UPDATE_SNAPSHOTS=1` | rewrite the visual baselines in `e2e/__snapshots__/` (same as Playwright `-u`) |

Visual baselines: rendered with `TZ=UTC`, a fixed clock, reduced motion; a test fails when
more than **0.5 %** of the pixels differ (pixelmatch threshold 0.1). On failure
`<name>-actual.png` and `<name>-diff.png` are written to `test-results/`. A missing
baseline is created on the first run; review it before you commit it.

Docker resources created by tests are named `tesseract-test-*` or belong to the
`tesseract-e2e` project and are removed afterwards. The suites never stop or change the
`tesseract` stack or the host daemon on 7701 (host-shell cases use a free port, a temporary
`TESSERACT_HOST_SHELL_DIR` and `--bind 127.0.0.1`).

## Packaging

```bash
bun run electron:dist                                  # this OS
bun run --cwd apps/electron dist -- --platform win     # Windows installer from Linux (needs wine)
bun run --cwd apps/electron dist -- --dir              # unpacked app only, no installer
bun run --cwd apps/electron dist -- --smoke            # Linux: build, then run the smoke checks
```

`scripts/dist.ts` runs, in order:

1. `bun run build` (skip with `--skip-build`).
2. `scripts/cli-build.ts` for the platform's targets (skip with `--skip-cli`): `dist-cli/<os>-<arch>/tesseract` and
   `tesseract-controller` (`.exe` on Windows). Targets: `linux` → `linux-x64`; `mac` → `mac-x64,mac-arm64`; `win` → `win-x64`.
   Standalone: `bun run cli:build -- --target linux-x64,mac-arm64`, `--all` for every target
   (`linux-x64`, `linux-arm64`, `mac-x64`, `mac-arm64`, `win-x64`), `--no-controller` for `tesseract` only.
3. `scripts/bundle-sandbox.ts` (skip with `--skip-sandbox`): copies the **git-tracked** files the
   sandbox image needs (`.dockerignore`, `SPEC.md`, root `package.json`/`bun.lock`/`bunfig.toml`/`tsconfig.base.json`,
   `packages/**`, `apps/controller/**`, `apps/mobile/package.json`, `apps/electron/package.json`,
   `infra/docker/sandbox/**`, `infra/compose/compose*.yml`, `.env.example`, `tailscale/serve.json`) into
   `build/sandbox-context/` with their modes, and writes `manifest.json` (`gitCommit`, `dirty`,
   `imageVersion` from `ARG TESSERACT_IMAGE_VERSION`, sha256 of every file) and `build-weights.json`
   (progress weight per Dockerfile step). Untracked files are not bundled; uncommitted edits are,
   and set `dirty: true`. It fails on CRLF line endings in shell scripts.
4. Checks that the CLI binaries and `manifest.json` exist, then runs electron-builder with
   `electron-builder.yml`.
5. With `--smoke`: `scripts/smoke.ts`.

Other `dist` options: `--publish never|always|onTag|onTagOrDraft` (default `never`),
`--update-url <url>` / `TESSERACT_UPDATE_URL`, `--channel <name>` / `TESSERACT_UPDATE_CHANNEL`.

| OS | Artifacts in `apps/electron/dist/` | Install layout |
|---|---|---|
| macOS (build on a Mac) | `Tesseract-<v>-universal.dmg`, `Tesseract-<v>-universal.zip` (for updates) | `Tesseract.app`; hardened runtime with `build/entitlements.mac.plist` (JIT, unsigned executable memory, library validation off, microphone); minimum macOS 12 (Docker Desktop itself needs 14) |
| Windows | `Tesseract-<v>-x64.exe` (NSIS, one-click, per user, no elevation) | `%LOCALAPPDATA%\Programs\Tesseract\Tesseract.exe`; `build/installer.nsh` appends `$INSTDIR\resources\bin` to the **user** `Path` and removes it on uninstall (not on update) |
| Linux | `Tesseract-<v>-x86_64.AppImage`, `Tesseract-<v>-amd64.deb` | deb: `/opt/Tesseract/tesseract-desktop`, `/usr/bin/tesseract-desktop`, `/usr/bin/tesseract` → `resources/bin/tesseract` (only when that path is free or already ours; removed on uninstall), desktop entry `dev.tesseract.Desktop.desktop`, `tesseract://` handler. Depends on GTK 3, NSS, libsecret…; recommends `docker.io \| docker-ce` |

Every package carries, under `resources/`: `app.asar`, `bin/tesseract` + `bin/tesseract-controller`,
`sandbox/` (the build context above), `icons/`, `licenses/LICENSE-*` (fonts) and `app-update.yml`.
Electron fuses: `runAsNode`, `NODE_OPTIONS` and `--inspect` are off, `onlyLoadAppFromAsar` is on.

Putting `tesseract` on `PATH` per OS is described in [tesseract-cli.md](tesseract-cli.md#install).

### Smoke checks (Linux)

```bash
bun run electron:smoke                                   # dist/Tesseract-<v>-x86_64.AppImage and the .deb
node apps/electron/scripts/smoke.ts --appimage <file> --deb <file> --snapshot-out /tmp/smoke.png
node apps/electron/scripts/smoke.ts --no-launch          # contents only, don't start the app
```

It extracts the AppImage into a `tesseract-test-*` dir and checks the packaged files and
exec bits, that `resources/sandbox` matches `manifest.json`, that the update feed is a
generic http(s) URL, that `resources/bin/tesseract --version` prints the app version, and
then starts the packaged app headless on `/onboarding/welcome` (880×620) and checks the
PNG. For the deb it unpacks `control`/`data` and checks the files, the `postinst` CLI link
logic and the desktop entry.

## Releasing

1. Bump `version` in `apps/electron/package.json`. It is the app version, the CLI version
   (`tesseract --version`) and the update version.
2. Commit, so `manifest.json` records a clean commit (`dirty: false`).
3. Build each OS on its own OS (mac on macOS, the rest on Linux or the native OS), with the
   signing variables below, `--publish` as needed.
4. Linux: `bun run electron:smoke`. Windows from Linux: `bun run --cwd apps/electron check:nsis`.
5. Upload the artifacts **and** the `latest*.yml` / `beta*.yml` / `alpha*.yml` feeds
   (`generateUpdatesFilesForAllChannels`) to the update URL.

### Updates

electron-updater with a generic provider: `https://downloads.tesseract.dev/desktop` by
default (`publish.url` in `electron-builder.yml`), overridable at build time with
`--update-url`/`TESSERACT_UPDATE_URL`, channel with `--channel`/`TESSERACT_UPDATE_CHANNEL`.
The app checks 60 s after start and then every 6 hours, never downloads on its own
(Settings › About › **Download**, then **Restart to update**), and is off in unpackaged
builds, in tests, and when `TESSERACT_DISABLE_UPDATES=1`. On Linux only the AppImage and
the deb update in the app.

### macOS signing and notarization

Signing uses electron-builder's standard variables: `CSC_LINK` (path or base64 of the
`.p12` "Developer ID Application" certificate) and `CSC_KEY_PASSWORD`, or a matching
identity already in the login keychain (`CSC_NAME` to choose one; the keychain is not searched
when `CSC_IDENTITY_AUTO_DISCOVERY=false`). Without an identity `scripts/dist.ts` ad-hoc signs
the app (`mac.identity=-`): it runs on Apple Silicon, but Gatekeeper warns about the downloaded
app until it is Developer ID signed and notarized.

electron-builder's own notarization is off (`notarize: false`); `scripts/hooks/after-sign.ts`
notarizes with `@electron/notarize` after signing. It picks the first complete set:

| Method | Variables |
|---|---|
| App Store Connect API key | `APPLE_API_KEY` (path to the `.p8`), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` |
| Apple ID | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Keychain profile (`xcrun notarytool store-credentials`) | `APPLE_KEYCHAIN_PROFILE`, optional `APPLE_KEYCHAIN` |

- No credentials → notarization is skipped with a log line.
- A partly set group (e.g. `APPLE_ID` without `APPLE_TEAM_ID`) fails the build and names the missing variables.
- `TESSERACT_NOTARIZE=0` skips it; `TESSERACT_NOTARIZE=1` fails the build when no credentials are set.

The dmg itself is not signed (`dmg.sign: false`); the app inside is.

### Windows signing

Also electron-builder's standard variables: `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` (or
`CSC_LINK` + `CSC_KEY_PASSWORD`) for a `.pfx`. Building on Linux needs wine for signing and
for NSIS. Unsigned installers work, but SmartScreen warns on first run.

### Linux

Nothing is signed. Publish the AppImage and the deb; deb users update through the app or
by installing the new deb.

## Troubleshooting

- `bun run dev` fails with `Port 4545 is already in use`: another dev server (or a stuck
  one) holds it. Stop that process; the port is fixed on purpose.
- Snapshot exits non-zero after 20 s: the page never became idle (a looping finite
  animation, or a query that never settles in fixture mode). Run with `--headed` and
  `TESSERACT_DESKTOP_LOG=debug`.
- `dist: missing CLI binaries (run cli:build)`: you passed `--skip-cli` without a previous
  `cli:build` for that platform's targets.
- `CRLF line endings would break the Linux image`: a shell script in the bundle has CRLF
  (a Windows checkout with `autocrlf`). Fix the line endings in git.
- `check:nsis` exits 2: electron-builder hasn't downloaded NSIS yet; run one
  `dist -- --platform win` first.
- `Notarization needs APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID; missing …`:
  complete the group or unset it.
