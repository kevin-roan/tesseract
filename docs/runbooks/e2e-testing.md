# Testing: unit, infra and end to end

Three layers, from fastest to most complete. Run the first two on every change;
run the e2e suite before upgrading a real stack or after touching the image,
the compose files or the controller's process handling.

| Layer | Command | Needs | Time |
|---|---|---|---|
| Typecheck + unit tests | `bun run typecheck && bun run test` | bun | about 1 minute |
| Infra unit tests | `bun run test:infra` | docker | about 1 minute |
| End to end | `bun run e2e` | docker, network access, about 10 GB free disk (the image alone is about 5 GB) | 3–5 minutes on a warm build cache |

## Unit tests

`bun run test` fans out to every workspace: `@theone/protocol` and
`@theone/client` (bun test), `@theone/controller` (bun test: routes, services,
CLI, UI helpers on happy-dom, lifecycle through the real entrypoint, hardening,
and `@theone/client` against a live controller) and `@theone/mobile` (jest).
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

After a run, `docker ps -a`, `docker volume ls` and `docker network ls` should
show nothing named `theone-e2e*`. Images kept for faster reruns:
`theone/sandbox:e2e`, `theone/infra-test:bats`, `theone/infra-test:sandbox-bats`.
