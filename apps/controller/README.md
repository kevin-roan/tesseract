# @theone/controller

The daemon that runs inside the sandbox container and is the only network-facing
service: REST + WebSocket API (`/v1`), the browser pages used by the phone's
WebViews (`/ui/terminal`, `/ui/vnc`), and the `theone-controller` CLI.
The contract is [`docs/architecture/00-blueprint.md`](../../docs/architecture/00-blueprint.md)
and the wire types come from [`@theone/protocol`](../../packages/protocol).

Stack: Bun (`Bun.serve` for HTML routes and WebSockets, Hono for REST,
`bun:sqlite`, `Bun.spawn` with `detached` process groups and PTYs), xterm.js and noVNC for the pages.

## Commands

```bash
bun run dev          # watch mode: bun --watch src/index.ts serve
bun run start        # serve from source
bun run build        # dist/theone-controller (single executable, /ui assets embedded)
bun run typecheck    # server + tests, the browser code (src/ui/tsconfig.json), then tests/ui
bun test             # unit + integration tests on 127.0.0.1 with temp workspaces
bun test --coverage  # per-file line/function coverage
```

Run it on a laptop without the sandbox; missing pieces (X display, VNC, wine, claude)
are reported as unavailable:

```bash
THEONE_WORKSPACE=/tmp/theone-ws THEONE_HOST=127.0.0.1 bun run dev
THEONE_WORKSPACE=/tmp/theone-ws bun src/index.ts pair      # deep link + QR
THEONE_WORKSPACE=/tmp/theone-ws bun src/index.ts status
```

CLI: `serve` (default) · `pair [--json]` · `status [--json]` ·
`emit --status <s> --message <m> [--project p] [--stage s] [--platform p]` · `token [--rotate]` ·
`api <METHOD> <PATH> [JSON | -]`.
Configuration is environment only (blueprint §4); invalid values stop startup with a clear message.

### `api`: the REST API for the in-sandbox agent

```bash
theone-controller api GET "/v1/processes?projectId=hello"
theone-controller api POST /v1/processes '{"projectId":"hello","command":"npm run dev","port":5173}'
echo '{"projectId":"hello","target":"android-apk"}' | theone-controller api POST /v1/builds -
theone-controller api DELETE /v1/processes/prc_7f3k2q9xa1
theone-controller api GET /v1/display/screenshot > /tmp/screen.png
```

- Calls `http://127.0.0.1:$THEONE_PORT<PATH>` with the token from `THEONE_TOKEN` or the token
  file; the token is never printed (any occurrence in a response becomes `***`).
- `METHOD` is `GET`, `POST` or `DELETE`; `PATH` must start with and stay under `/v1/`. The JSON
  body is the third argument, or `-` to read it from stdin (`GET` takes none).
- 2xx: the JSON response is pretty-printed to stdout (nothing for empty bodies such as the
  `202` of `POST /v1/events`). Other content (screenshots, artifact downloads) is written to
  stdout unchanged, and only when stdout is not a terminal.
- Non-2xx: the error body goes to stderr and the exit code is 1. Unreachable controller or
  missing token: message on stderr, exit 1. Bad arguments or an invalid JSON body: exit 2
  before any request is made.
- `display.vnc.password` (in `/v1/display` and `/v1/status`) is printed as `***`, as in
  `status --json`: the phone gets it over REST, the agent never needs it.

## Layout

```text
src/
  index.ts              CLI entry (cli/commands.ts; cli/api.ts for `api`)
  server.ts             Bun.serve: /ui HTML routes, WebSocket upgrades, Hono app for REST
  config.ts             env parsing and validation
  auth/                 token file (0600, constant-time compare), one-time tickets
  http/                 Hono app, auth/log middleware, routes per resource
  ws/                   upgrade router (ticket + target checks) and per-stream handlers
  services/             projects, git, processes, terminals, builds + recipes, artifacts,
                        display, vnc-bridge, agent runs + stream-json parser, status,
                        context, runtime-mirror (.agent/RUNTIME.md)
  core/                 log store (ring buffer + rotated files), process groups (+ /proc scan),
                        exec, net probes (TCP, RFB banner), events
  db/                   bun:sqlite schema (WAL) and repositories
  ui/                   terminal.html / vnc.html pages, shared lib/, own tsconfig (DOM)
tests/                  bun test suites; fixtures/fake-claude.sh stands in for Claude Code
  unit/                 focused module tests (fakes, local TCP servers, temp dirs)
  ui/                   src/ui/lib tests on a per-test happy-dom Window (own tsconfig, DOM lib)
```

## Behaviour worth knowing

- Every child (process, build step, agent run, PTY) gets its own session, so stop/cancel
  signals the whole group: SIGTERM (SIGHUP for terminals), SIGKILL after 5 s.
- When the leader exits on its own, whatever it left running in its process group or
  session (`cmd &`, a dev server npm left behind, Gradle/Kotlin daemons, a shell's
  background jobs) gets SIGTERM, then SIGKILL after 5 s. Members are found by scanning
  `/proc/*/stat` for the leader's pgrp/session id, which cannot be recycled while a member
  exists. The row reaches its final state only afterwards, and the log (agent runs: a
  `system` event) names what was stopped. Anything that must outlive its command has to
  detach itself (`setsid`) or run as its own tracked process.
- `vnc.available` means an RFB server answered: the probe reads the 12-byte
  `RFB 003.00x\n` banner within 1 s; an open port that says anything else (or nothing) is
  reported as unavailable.
- Android builds run Gradle with `--no-daemon`: sandbox RAM is limited and a daemon would
  outlive the build (and a cancel). Recipes use the package manager's local runner
  (`npx --yes=false`, `pnpm exec`, `yarn run`, `bunx --no-install`); `wine`/`java` missing
  → `POST /v1/builds` answers 503 before queueing. Collection only takes files modified
  after the build started (minus 2 s).
- Children (processes, build steps, terminals, agent runs, git/zip helpers) never get
  `THEONE_TOKEN` or `THEONE_VNC_PASSWORD` (`childEnv()` in `core/exec.ts`); they get
  `THEONE_PROCESS_ID`/`THEONE_BUILD_ID`/`THEONE_TERMINAL_ID`/`THEONE_AGENT_RUN_ID`. A
  `THEONE_TOKEN` from the environment is mirrored into the 0600 token file so the
  in-sandbox CLI keeps working without it.
- Project content is untrusted: `package.json` is read only if it is a regular file of at
  most 1 MiB (`core/files.ts`: `O_NONBLOCK` + `fstat` on the open descriptor), `.agent`
  files likewise with `O_NOFOLLOW`, and `git status`/`log` run with `core.fsmonitor`,
  `log.showSignature` and every filter driver neutralised (`services/git.ts`).
  `tests/hardening.test.ts` covers these.
- Headless Claude gets the prompt on stdin (never argv) and no `CLAUDECODE`.
- Logs: `$THEONE_DATA_DIR/logs/<id>.log` as `<ts> <stream> <seq> <text>` lines, rotated
  at 5 MiB (one `.1` kept), plus a 2 000-line in-memory ring per live process/build.
- Restarting the controller never re-runs anything: live rows become `orphaned`
  (processes), `failed` (builds, agent runs) or `exited` (terminals). Orphaned
  processes may still be running; stop them by pid/port if needed.
- Port conflicts: `POST /v1/processes` with `port` probes 127.0.0.1 and ::1 and answers
  409 naming the tracked process that owns the port (declared, or found through /proc).
- Builds run one at a time (FIFO). Artifacts land in `$THEONE_WORKSPACE/artifacts` as
  `<project>-<platform>-<profile>-<version>.<ext>`; `-2`, `-3`… are appended instead of
  overwriting an earlier build.
- The `/ui` pages are bundled without zod; their chunks are served at root paths
  (`/chunk-<hash>.js`, `.css`). They read `ticket`, `session`, `password` (and `viewOnly=1`
  for VNC) from the URL fragment, clear it, and talk to the embedding app through
  `window.ReactNativeWebView.postMessage` (or `parent.postMessage` in an iframe):
  `terminal-state`, `terminal-need-ticket`, `vnc-state`, `vnc-need-ticket`. The app answers
  a `*-need-ticket` message by calling `window.theone.reconnect(ticket)` (injected JS) or by
  posting `{ type: "theone-reconnect", ticket }` to the frame. These names and the page
  states (`connecting|connected|disconnected|exited|error`) live in `@theone/protocol/bridge`
  (`PAGE_MESSAGES`, `PAGE_STATES`), a zod-free module shared with the app.
