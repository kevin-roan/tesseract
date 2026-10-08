# infra/e2e

End-to-end tests against a real sandbox container: the image, supervisord programs, the
controller, `@tesseract/client` and the operator CLI working together.

```bash
bun run e2e                    # build tesseract/sandbox:e2e, start the stack, test, remove it
bun run e2e --no-build         # reuse the existing image
bun run e2e --keep -t health   # keep the stack afterwards; other arguments go to bun test
bun run e2e --web              # also drive the mobile web build (see "Mobile web flow")
bun run e2e --electron         # also run the Electron app's Playwright suites (see "Electron app")
bun run e2e --electron-only    # only the Electron suites, skip bun test ./infra/e2e
```

A clean run takes about 3 minutes on a warm build cache: the two Electron builds need
network access for `npm install` and electron-builder's downloads.

## How it works

`run` writes a temporary env file and drives `infra/scripts/sandbox --env-file <file> --mode local`:
compose project `tesseract-e2e`, volumes `tesseract-e2e-*`, controller on `127.0.0.1:17700`, VNC on
`127.0.0.1:15901`, image `tesseract/sandbox:e2e`, a fixed token and VNC password,
`TESSERACT_LOG_LEVEL=debug`, and `TESSERACT_HOST_CLAUDE_DIR` set to an empty temporary directory
(or `TESSERACT_E2E_CLAUDE_DIR`), so the host's `~/.claude` is never mounted by default and Claude
is not logged in. It never reads `infra/compose/.env`, ignores exported `TESSERACT_*`
variables, and removes the stack with its volumes afterwards (also on failure, Ctrl-C and
SIGTERM) unless `--keep` is given.

Test files (`*.test.ts` in this directory) receive:

| Variable | Value |
|---|---|
| `TESSERACT_E2E_URL` | `http://127.0.0.1:17700` |
| `TESSERACT_E2E_TOKEN` | bearer token of the stack |
| `TESSERACT_E2E_PROJECT` | compose project and sandbox id |
| `TESSERACT_E2E_ENV_FILE` | for `infra/scripts/sandbox --env-file "$TESSERACT_E2E_ENV_FILE" …` |
| `TESSERACT_E2E_VNC_PORT`, `TESSERACT_E2E_VNC_PASSWORD` | RFB on `127.0.0.1` |

Optional: `TESSERACT_E2E_ANDROID=1` enables `android.test.ts`; `TESSERACT_E2E_SCREENSHOT_DIR=<dir>`
makes `electron.test.ts` save the display before, with the Electron window, and after the
restart.

Overrides: `TESSERACT_E2E_IMAGE`, `TESSERACT_E2E_PROJECT` (must start with `tesseract-e2e`),
`TESSERACT_E2E_CONTROLLER_PORT`, `TESSERACT_E2E_VNC_PORT`, `TESSERACT_E2E_HEALTH_TIMEOUT` (seconds),
`TESSERACT_E2E_CLAUDE_DIR` (host directory mounted at `/home/dev/.claude`).

## What is covered

| File | Checks |
|---|---|
| `system.test.ts` | public health; status (X display and VNC available, versions of node, bun, git, python3, wine, java, claude); `tesseract-controller pair --json` parses with `parsePairingLink` and its token works; 401 without or with a wrong token, tickets are not bearer tokens and are single use, WS without a valid ticket is refused; `/v1/display/vnc` with subprotocol `binary` and the raw VNC port answer `RFB 003.00x`; `/ui/terminal`, `/ui/vnc` and their assets return 200 without secrets; `tesseract-doctor` exits 0 |
| `terminals.test.ts` | shell PTY round trip (`echo tesseract-$((6*7))` → `tesseract-42`), resize reaches the PTY (`stty size`), reattach replays the scrollback, `exit` ends the session with code 0; a `claude` terminal starts and DELETE ends it |
| `events.test.ts` | `POST /v1/events`, `tesseract-controller emit` and `tesseract-controller api POST /v1/events -` all arrive on the events socket; `tesseract-controller api GET` returns JSON, redacts the VNC password, never prints the token, refuses paths outside `/v1` |
| `agent.test.ts` | a headless Claude run ends within 90 s (without credentials it fails with "Not logged in") |
| `electron.test.ts` | `POST /v1/projects` + copy of `examples/electron-hello` → framework `electron`, targets `electron-linux`/`electron-windows`; both builds succeed with live logs, stages and `build.updated`/`artifact.created` events; artifacts are named `electron-hello-<platform>-debug-1.0.0.<AppImage\|exe>` and download (ticket URL, single use) with the recorded size and sha256; git details skip `node_modules`/`dist`; the AppImage runs on the display (window found with xdotool, screenshot changes), shows up in `RUNTIME.md` and `/v1/context` without secrets, stops with no Electron process left; `sandbox restart` keeps token, VNC password, builds and artifacts, ends running processes as `stopped`; after a SIGKILL of the controller the left-over row is `orphaned` |
| `android.test.ts` | opt-in (`TESSERACT_E2E_ANDROID=1`): `create-expo-app` blank-typescript app → `android-apk` debug build → `android-hello-android-debug-1.0.0.apk` that `aapt` can read. Takes about 15 minutes and 5–6 GB (Gradle caches, NDK and CMake that Gradle installs into the dev-writable `/opt/android-sdk`) |

The files share the stack and run one after another. `electron.test.ts` restarts the
container at the end, and every test is written so it can also run on a stack kept from
an earlier run (the second build of an artifact name gets a `-2` suffix).

Select tests with bun's name filter (`bun run e2e --no-build -t "terminals"`). `--keep` leaves
the stack up and prints the `down -v` command that removes it.

Typecheck: `bunx tsc -p infra/e2e/tsconfig.json`.

## Mobile web flow

`web/run` exports `apps/mobile` for web, copies it with `serve.py` and `drive.mjs` into the
sandbox, installs `playwright-core` into a temp dir there, serves the app on
`127.0.0.1:8081` inside the container and drives the image's `/usr/bin/chromium` against
the controller at `http://127.0.0.1:7700` (both inside the container, so nothing new is
published). The driver opens `/pair?url=…&token=…&name=e2e`, taps "Pair sandbox", checks the
Agents hub (sandbox name, CPU/memory/disk stats, the `electron-hello` project), opens the
project (build targets, recent builds, artifacts) and a build, and saves screenshots to
`/tmp/tesseract-e2e-web-shots` (`--out DIR` to change). Everything it put in the container is
removed afterwards.

```bash
bun run e2e --web                                  # after the bun tests, same stack
infra/e2e/run --keep --no-build                    # or against a kept stack:
TESSERACT_E2E_PROJECT=tesseract-e2e TESSERACT_E2E_TOKEN=tesseract-e2e-token-not-a-secret infra/e2e/web/run
infra/e2e/web/run --export-dir /path/to/export     # use an existing expo export
```

It needs the `electron-hello` project and its builds, so run it after `electron.test.ts`
(which `--web` does). `serve.py` maps `/pair` to `pair.html` and `/sandbox/projects/x` to
`sandbox/projects/[id].html`, like a static host.

Known failure: with the current `apps/mobile/src/components/app-tabs.web.tsx` every tab route
is blank on web ("Couldn't find any screens for the navigator"), so the driver stops at
"pairing lands on the Agents hub". expo-router's `Tabs` only finds `TabTrigger`s that are
direct children of `TabList` or of its single `asChild` element; there they sit two levels
down (`View` > `ThemedView`). Moving the `View`/`ThemedView` wrapper into a component that
renders `{children}` (as the Expo template's `CustomTabList` does) fixes it: with that change
applied to a copy of the app, every step of the driver passes.

## Electron app

`--electron` runs `bun run --cwd apps/electron e2e` (Playwright: onboarding, app, preferences,
shell, cli and packaging suites) after the bun tests, against the same stack, with
`TESSERACT_E2E_URL`, `TESSERACT_E2E_TOKEN`, `TESSERACT_E2E_PROJECT`, `TESSERACT_E2E_ENV_FILE`,
`TESSERACT_E2E_IMAGE`, `TESSERACT_E2E_VNC_PORT` and `TESSERACT_E2E_VNC_PASSWORD` exported; without
them the stack-dependent tests skip. `--electron-only` skips `bun test ./infra/e2e`. The
Electron windows run with `--ozone-platform=headless` and an isolated `tesseract-test-*`
profile. Against a stack kept with `--keep`:

```bash
TESSERACT_E2E_URL=http://127.0.0.1:17700 TESSERACT_E2E_TOKEN=tesseract-e2e-token-not-a-secret \
  TESSERACT_E2E_PROJECT=tesseract-e2e TESSERACT_E2E_ENV_FILE=<env file printed by --keep> \
  bun run --cwd apps/electron e2e
```
