# Testing: unit, infra and end to end

Three layers, from fastest to most complete. Run the first two on every change;
run the e2e suite before upgrading a real stack or after touching the image,
the compose files or the controller's process handling.

| Layer | Command | Needs | Time |
|---|---|---|---|
| Typecheck + unit tests | `bun run typecheck && bun run test` | bun | about 1 minute |
| Infra unit tests | `bun run test:infra` | docker | about 1 minute |
| End to end | `bun run e2e` | docker, network access, about 10 GB free disk (the image alone is about 5 GB) | 3–5 minutes on a warm build cache |
| Desktop app end to end | `bun run electron:e2e` (alone) or `bun run e2e --electron` (with a live stack) | bun; Docker and a live stack only for the tests that need them | a few minutes without a stack; the packaging spec builds the Linux AppImage/deb when it is stale (up to 30 minutes) |

## Unit tests

`bun run test` fans out to every workspace: `@theone/protocol` and
`@theone/client` (bun test), `@theone/controller` (bun test: routes, services,
CLI, UI helpers on happy-dom, lifecycle through the real entrypoint, hardening,
and `@theone/client` against a live controller) and `@theone/mobile` (jest),
`@monolith/electron` (vitest: a node project for `src/core`, `src/main`, `src/shared`,
the `monolith` CLI, the build scripts and the architecture/IPC contract tests, and a happy-dom
project for the renderer; no display and no Docker needed).
Coverage: `bun test --coverage` in a bun package, `bunx jest --coverage` in
`apps/mobile`.

The controller tests start real controllers on `127.0.0.1` with temporary
workspaces and a fake `claude` (`apps/controller/tests/fixtures/fake-claude.sh`).
They spawn and kill real process groups, so they are sensitive to a very busy
machine: the VNC bridge's large-payload test has a 30 s timeout for that reason.

## Infra unit tests

`bun run test:infra` runs bats suites for `infra/scripts/sandbox`, the rootfs
scripts and the rendered compose files inside throwaway containers
(`theone-test-*`, `--network none`, `infra/` mounted read-only). It renders
`sandbox config` on the host for every mode (project `theone-test-config`,
nothing is created). Options: `--quick` skips the second pass of the entrypoint
tests on the real sandbox image, `--coverage` writes a kcov report to
`infra/tests/coverage/`. Details: [infra/tests/README.md](../../infra/tests/README.md).

## End to end

```bash
bun run e2e                       # build theone/sandbox:e2e, start the stack, test, remove it
bun run e2e --no-build            # reuse the image from the last run
bun run e2e --keep -t terminals   # keep the stack afterwards; other arguments go to bun test
bun run e2e --web                 # also drive the mobile web build (see below)
bun run e2e --electron            # also run the desktop app's Playwright suites against the stack
bun run e2e --electron-only       # only the desktop app's suites (skips bun test ./infra/e2e)
bunx tsc -p infra/e2e/tsconfig.json   # typecheck the suite (it is not a workspace)
```

### What the harness does

`infra/e2e/run`:

1. Builds `theone/sandbox:e2e` through `infra/scripts/sandbox build` (unless
   `--no-build`). Build arguments exported in your shell (`WITH_ANDROID`, …) apply.
2. Writes a temporary env file: compose project and volume prefix `theone-e2e`,
   local mode, controller on `127.0.0.1:17700`, VNC on `127.0.0.1:15901`, a
   fixed token and VNC password, `THEONE_LOG_LEVEL=debug`. It never reads
   `infra/compose/.env` and clears exported `THEONE_*`/`COMPOSE_*` variables, so
   it cannot touch the default `theone` stack. `THEONE_HOST_CLAUDE_DIR` points
   at an empty temporary directory (or `THEONE_E2E_CLAUDE_DIR`), so the host's
   `~/.claude` is never mounted and Claude is not logged in (point
   `THEONE_E2E_CLAUDE_DIR` at a logged-in dir to run Claude).
3. Removes any leftover `theone-e2e` stack, starts the new one, waits for
   `/v1/health`, and runs `bun test ./infra/e2e` (the `./` matters: without it
   bun treats the argument as a name filter over the whole repository).
4. Always removes the stack with its volumes (success, failure, Ctrl-C,
   SIGTERM) unless `--keep`, which prints the `down -v` command instead.

It refuses a project name that does not start with `theone-e2e`, because it
deletes that project's volumes. Overrides: `THEONE_E2E_IMAGE`,
`THEONE_E2E_PROJECT`, `THEONE_E2E_CONTROLLER_PORT`, `THEONE_E2E_VNC_PORT`,
`THEONE_E2E_HEALTH_TIMEOUT` (seconds).

### What it covers

| File | Checks |
|---|---|
| `system.test.ts` | public health; status with display and VNC available and tool versions; `pair --json`; 401 without or with a wrong token; tickets are single use and are not bearer tokens; WS without a ticket refused; VNC bridge and raw port answer `RFB 003.00x`; `/ui` pages and their root-path assets without secrets; `theone-doctor` exits 0 |
| `terminals.test.ts` | PTY round trip, resize, scrollback replay on reattach, `exit` code 0; a `claude` terminal starts and DELETE ends it |
| `events.test.ts` | `POST /v1/events`, `emit` and `api POST … -` arrive on the events socket; `api GET` redacts the VNC password, never prints the token, refuses `/v1/../` |
| `agent.test.ts` | a headless run ends within 90 s (without credentials: "Not logged in") |
| `electron.test.ts` | `examples/electron-hello` → both Electron builds with live logs, stages and events; artifact names, sizes, sha256 and single-use ticket downloads; the AppImage renders on `:1` (xdotool finds the window, the screenshot changes) and appears in `RUNTIME.md`/`/v1/context` without secrets; `sandbox restart` keeps token, password, builds and artifacts and ends running processes as `stopped`; after a SIGKILL of the controller the leftover row is `orphaned` |
| `android.test.ts` | opt-in (`THEONE_E2E_ANDROID=1`): blank `create-expo-app` app → `android-apk` debug build → an APK `aapt` can read. About 15 minutes and 5–6 GB |

The last full runs: 30 passed, 1 skipped (Android), 0 failed, in 147–268 s.
Per-file details and the helper library are in
[infra/e2e/README.md](../../infra/e2e/README.md). `THEONE_E2E_SCREENSHOT_DIR=<dir>`
keeps the display screenshots for inspection.

### Mobile web flow

`--web` (or `infra/e2e/web/run` against a kept stack) exports `apps/mobile` for
web, serves it inside the sandbox and drives the image's Chromium with
`playwright-core`: pair from a link, check the Agents hub (sandbox name, stats,
`electron-hello`), open the project and a build. Nothing new is published on
the host. It needs the `electron-hello` builds, so it runs after the bun tests.

Current state: it **fails** at "pairing lands on the Agents hub", because every
tab route is blank on web ([mobile-app → web build](../architecture/mobile-app.md#web-build)).
With the known `app-tabs.web.tsx` fix applied to a copy of the app, all 8
steps pass.

## Desktop app (`apps/electron`)

```bash
bun run --cwd apps/electron test        # vitest only (also part of the root bun run test)
bun run electron:e2e                    # build out/ if stale, then every Playwright spec in apps/electron/e2e
bun run --cwd apps/electron e2e -- -g "android step"   # Playwright options go after --
bun run e2e --electron-only             # same suites with THEONE_E2E_* pointing at a fresh theone-e2e stack
```

Playwright drives the real app through `_electron`, one worker, 60 s per test. Every launch gets an isolated
profile under `$TMPDIR/monolith-test-*` (`MONOLITH_USER_DATA`, `MONOLITH_DESKTOP_CONFIG`, `MONOLITH_STATE_DIR`,
`XDG_CACHE_HOME`), so the user's `~/.config/monolith-desktop/config.json`, sandbox and SDK are never read or
written. On Linux the window is headless (`--ozone-platform=headless`), so nothing appears on screen. Fixture
mode is on unless a spec opts into real services; the onboarding specs set `MONOLITH_DISABLE_DISCOVERY=1` so a
running stack doesn't skip the wizard. Docker resources created by the suites are named
`monolith-test-*` (or belong to the harness's `theone-e2e` stack) and are removed afterwards; the user's
`theone` stack and the host daemon on 7701 are never touched (host-shell runs use a free port and a temporary
`THEONE_HOST_SHELL_DIR`).

### What it covers

| Spec | Checks | Needs |
|---|---|---|
| `shell.spec.ts` | a finished setup opens the main shell; Settings from the status row; a fresh profile opens the wizard | — |
| `preferences.spec.ts` | switching Settings pages and the theme; the speech-to-text profile; the Claude accounts of this computer | — |
| `onboarding.spec.ts` | fresh profile → Welcome; the Docker step detects the engine and Compose; the Sandbox step shows the components and runs a simulated build (fixtures); the Android step lists packages from a local fixture repository (served over HTTP and passed in with `MONOLITH_ANDROID_REPOSITORY_URL` / `MONOLITH_ANDROID_SYSIMG_URL`), accepts the license, installs into a temporary SDK and writes the AVD; **Open Monolith** on the last step lands on the shell and is remembered; a configured connection skips the wizard and reaches the sandbox | Docker step: Docker. Android step: Linux x64. Live test: a stack |
| `cli.spec.ts` | the compiled `monolith` (built to a temp dir, or `MONOLITH_E2E_CLI`): version and help, exit codes, `config` in a temporary HOME (token redaction), `doctor`, `android images` against the fixture repository, `sandbox status` for an empty `monolith-test-*` project and for the e2e stack, `pair`, `open` (launch recorder, `monolith://` fallback) | Docker / a stack for some tests |
| `packaging.spec.ts` | `electron-builder.yml` (CLI and sandbox context as extra resources, universal dmg, per-user NSIS with the PATH macros, AppImage + deb); the NSIS PATH macros under makensis + wine; the built AppImage contains the app, the CLI binaries and the sandbox context, its CLI reports the app version, it starts and exits with `--quit` and renders the wizard | Linux x64; wine for the NSIS test |
| `app.spec.ts` | visual snapshots of every page, two Settings sections and the light scheme on fixtures, compared with `e2e/__snapshots__/<name>.png` (pixelmatch threshold 0.1, at most 0.5 % of pixels); live: connect from Settings, every page, overview stats, create a project, start and stop a process, a terminal running `echo hi`, shared files, the display over VNC, saving preferences | live part: a stack |

Tests that need something missing are skipped with the reason, not failed. Live tests refuse a
`THEONE_E2E_PROJECT` that does not start with `theone-e2e`.

### Environment

| Variable | Effect |
|---|---|
| `THEONE_E2E_URL`, `THEONE_E2E_TOKEN`, `THEONE_E2E_PROJECT`, `THEONE_E2E_ENV_FILE`, `THEONE_E2E_IMAGE` | the live stack; `bun run e2e --electron[-only]` sets them. With a kept stack (`--keep`), export them yourself: URL `http://127.0.0.1:17700`, the harness token, the printed env file |
| `MONOLITH_UPDATE_SNAPSHOTS=1` | rewrite the baselines in `e2e/__snapshots__/` (also Playwright's `--update-snapshots`); a missing baseline is written on the first run |
| `MONOLITH_E2E_DIST` | `stale` (default): rebuild the AppImage/deb only when sources are newer; `always`; `never` (skip the packaged-app tests when nothing is built) |
| `MONOLITH_E2E_CLI` | path of a prebuilt `monolith` binary instead of compiling one |

Related checks outside Playwright: `bun run electron:smoke` checks the built AppImage/deb (files, sandbox context
against its manifest, update feed, `monolith --version`, deb postinst and desktop entry, a headless render of the
wizard); `bun run --cwd apps/electron check:nsis` runs the NSIS PATH macros under wine;
`bun run --cwd apps/electron snapshot` / `diff` compare pages with `docs/electron/reference/`
([conventions §10](../electron/conventions.md#10-snapshot-and-diff-workflow)).

## When it fails

| Symptom | Cause | Fix |
|---|---|---|
| `theone-doctor` step fails with `supervisor FAIL controller=STARTING` | an image older than the doctor fix; the controller was still starting | rebuild (no `--no-build`); current images report it as WARN |
| Electron builds fail with network errors | the sandbox needs npm, Electron and electron-builder downloads | check the host's outbound network; retry |
| Artifact names end in `-2` | the stack was kept from an earlier run (`--keep`) and built again | expected; clean runs produce the plain names |
| "did not match any test files" | extra arguments turned into a path/name filter | pass bun test options (`-t name`) or `./infra/e2e/<file>.test.ts` |
| Health wait times out | the image build failed earlier, or the host is slow | read the harness output; raise `THEONE_E2E_HEALTH_TIMEOUT` |
| Ports 17700/15901 in use | another e2e stack is running (`--keep`) | remove it with the printed `down -v` command, or set `THEONE_E2E_CONTROLLER_PORT`/`THEONE_E2E_VNC_PORT` and another `THEONE_E2E_PROJECT` |
| `android.test.ts` gives an Expo SDK other than 56 | `create-expo-app` installs the latest template (SDK 57 at the time of writing) | expected; the test only checks the build pipeline |
| Controller unit test "VNC bridge > moves large payloads intact" times out | heavy parallel load (`bun run test` across all workspaces) | already 30 s; rerun, or run the controller tests alone |
| Electron: `Port 4545 is already in use` from `bun run electron` | another `electron-vite dev` is running (the port is strict on purpose) | stop that dev server; never change the port |
| Electron: snapshot test fails by a few percent | a font, theme or component changed | compare `<name>-actual.png` and `<name>-diff.png` in `apps/electron/test-results/` with the baseline; if the change is intended, rerun with `MONOLITH_UPDATE_SNAPSHOTS=1` |
| Electron: live tests skipped | `THEONE_E2E_URL`/`THEONE_E2E_TOKEN` not set | run `bun run e2e --electron-only`, or export them for a kept stack |
| Electron: `Linux AppImage` tests take very long | the AppImage was stale and is being rebuilt | expected once; `MONOLITH_E2E_DIST=never` skips them |

After a run, `docker ps -a`, `docker volume ls` and `docker network ls` should
show nothing named `theone-e2e*` or `monolith-test-*`. Images kept for faster reruns:
`theone/sandbox:e2e`, `theone/infra-test:bats`, `theone/infra-test:sandbox-bats`.
