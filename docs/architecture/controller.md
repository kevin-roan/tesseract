# Controller

`theone-controller` is the only network-facing service in the sandbox. It is a
Bun + Hono daemon ([ADR 0002](../adr/0002-controller-bun-hono.md)) that runs
as `dev` under supervisord, listens on `0.0.0.0:7700`, and is compiled into one
binary with `bun build --compile`. The same binary is its own CLI. API
reference: [protocol.md](protocol.md).

## Source layout

```text
apps/controller/src/
├── index.ts            entry: CLI dispatch, `serve` is the default
├── server.ts           Bun.serve: /ui HTML routes, WS upgrades, Hono app, events fan-out and 25 s ping
├── cli/                pair · status · emit · token (commands.ts), api (api.ts), local-api, output
├── config.ts           THEONE_* env → validated Config; data dirs; local API URL for the CLI
├── version.ts
├── auth/
│   ├── token.ts        resolve (env → file → generate 0600), rotate, constant-time compare
│   └── tickets.ts      in-memory one-time tickets (60 s, consumed on first use)
├── core/               errors · events (EventHub) · exec (child env) · files (safe reads) · logger · log-store
│                       · ring-buffer · line-splitter · paths (workspace confinement) · process-group · proc
│                       · net (TCP/RFB probes) · ports · concurrency · time
├── db/
│   ├── database.ts     bun:sqlite, WAL, migrations via PRAGMA user_version
│   └── repositories.ts typed row access, restart recovery
├── http/
│   ├── app.ts          Hono: request log, CORS, 1 MiB body limit, auth, routes, error mapping
│   ├── middleware/     auth (bearer, or ticket for artifact downloads), request-log (redacts tickets)
│   ├── routes/         system · projects · processes · terminals · builds · artifacts · agent
│   └── validation.ts   zod schemas from @theone/protocol → 400 bad_request
├── ws/                 WebSocket route matching, ticket check, upgrade, per-socket handlers
├── services/           one class per domain (below)
└── ui/                 terminal.html (xterm.js) and vnc.html (noVNC), served as Bun HTML routes
```

| Service | Responsibility |
|---|---|
| `projects`, `project-detect`, `git` | list `/workspace/projects/*`, detect framework, package manager (lockfile), scripts and build targets; clone as a tracked process; git summary and details with the repository's own hooks neutralised ([below](#untrusted-project-content)) |
| `processes` | spawn `bash -lc <command>` (or argv) in its own session, capture stdout/stderr into logs, stop with SIGTERM then SIGKILL after 5 s, reap leftovers of the group/session |
| `terminals` | PTYs via `Bun.spawn({ terminal })`: login shell or `claude`, 256 KiB scrollback, several clients per session, resize |
| `builds`, `build-recipes`, `artifacts` | FIFO build queue, recipes per target, artifact collection, naming and sha256 |
| `display`, `vnc-bridge` | `xdpyinfo` probe, RFB banner probe of 5901, screenshots, WS↔TCP bridge |
| `agent-runs`, `agent-stream` | headless `claude -p` runs, stream-json parsing into `AgentRunEvent`s |
| `status`, `tools` | `SandboxStatus`: cgroup/OS resources, tool versions (`node`, `bun`, `git`, `python3`, `java`, `wine`, `claude`, `adb`) |
| `context` | `.agent/*.md` and `.agent/projects/<id>/*.md` for `GET /v1/context` (no symlinks, 64 KiB cap) |
| `runtime-mirror` | debounced, atomic rewrite of `/workspace/.agent/RUNTIME.md` |

## Lifecycle

1. **Config.** `loadConfig` reads and validates the environment
   ([blueprint §4](00-blueprint.md#41-controller)). An
   invalid value is a startup error, not a silent default.
2. **Directories.** It creates `projects/`, `artifacts/`, `.agent/`, and
   `$THEONE_DATA_DIR` (0700) with `logs/` inside.
3. **Token.** `THEONE_TOKEN` wins, and is mirrored into `$THEONE_TOKEN_FILE`
   (0600) so the in-sandbox CLI works without the variable. Otherwise it reads
   `$THEONE_TOKEN_FILE`, or creates it (32 random bytes, base64url, 0600,
   exclusive create). The token is loaded once, so a rotation takes effect on
   the next start. An existing but empty token file is a startup error: delete it.
4. **Database.** It opens `state.db` (WAL, `busy_timeout` 5 s), migrates, and
   runs **restart recovery**: processes still `starting`/`running` become
   `orphaned`, `queued`/`running` builds and running agent runs become `failed`
   ("The controller restarted before this finished"), and terminals become
   `exited`. Nothing is re-run automatically, and nothing is killed: after a
   crash (SIGKILL, OOM) the old processes may still run untracked.
5. **Services and server.** It wires the services, starts the runtime
   mirror, and starts `Bun.serve` on `THEONE_HOST:THEONE_PORT`. The `/ui`
   pages are Bun HTML imports, bundled (with xterm.js and noVNC, without zod) at
   compile time, so the binary needs no asset directory. The bundled chunks are
   served at root paths (`/chunk-<hash>.js`, `/chunk-<hash>.css`). WebSocket paths are upgraded
   before Hono sees them. Every `ServerEvent` from the internal `EventHub` is
   published to all events sockets, plus a `ping` every 25 s.
6. **Shutdown** (SIGTERM from supervisord, which waits 15 s). It stops
   accepting connections, shuts down builds, processes, terminals and agent
   runs in parallel (process groups get SIGTERM, then SIGKILL after 5 s for processes,
   2 s for builds and agent runs, 1 s for terminals), writes the last
   `RUNTIME.md`, flushes logs and closes the database. supervisord also uses
   `stopasgroup`/`killasgroup` as a backstop.

Optional dependencies (X display, VNC, `claude`, `wine`, `java`) are probed on
demand. When one is missing, the relevant endpoint answers
`503 unavailable` and `SandboxStatus` shows it. The controller itself keeps
running, which is how it runs on a laptop for development and tests.

## Persistence

| Data | Where | Notes |
|---|---|---|
| Processes, terminals (metadata), builds, artifacts, agent runs and their events | `$THEONE_DATA_DIR/state.db` | SQLite, WAL. Back up with the controller stopped ([operations](../runbooks/operations.md#back-up-volumes)) |
| Token | `$THEONE_DATA_DIR/token` | 0600, unless `THEONE_TOKEN` is set |
| Process and build logs | `$THEONE_DATA_DIR/logs/<id>.log` | rotated to `<id>.log.1` at 5 MiB (one rotation kept) |
| Live log tail | memory | ring buffer of 2 000 lines per live process or build; WS streams replay 200 lines |
| Tickets | memory | lost on restart, which is harmless: they live 60 s |
| Terminal scrollback | memory | 256 KiB per session, lost on restart along with the PTY |

`$THEONE_DATA_DIR` defaults to `/workspace/.agent/controller`. Claude's SPEC
forbids reading, listing or editing it: the agent uses the API only through
`theone-controller api`, which reads the token itself and never prints it.

## HTTP pipeline

`request-log` → CORS (`THEONE_CORS_ORIGINS`, default `*`; methods GET, POST,
DELETE; exposes `Content-Disposition`, `X-Content-SHA256`) → body limit (1 MiB,
413 with code `bad_request` beyond) →
`requireAuth` → route → zod validation → service → JSON. Errors map to
`{ error: { code, message } }` with the status from the protocol's
`ERROR_STATUS`. Unknown errors are logged and returned as `500 internal`
without details. Request logs redact `ticket` query parameters.

`requireAuth` lets `GET /v1/health` through, accepts a bearer token compared
in constant time (SHA-256 of both sides, then `timingSafeEqual`), and for
`GET /v1/artifacts/:id/download` also accepts a one-time `?ticket=`.
WebSocket upgrades are handled before Hono: the WS router matches the path,
consumes the ticket (401 if missing, expired or reused), checks that the
target exists (404), and upgrades. A non-upgrade request on a WS-only path gets
400. Sockets close with 1000 when their process, build, run or terminal has
ended. `closeOnBackpressureLimit` drops a socket whose send buffer passes
16 MiB; clients reconnect with a fresh ticket.

Paths are confined: project ids are validated against
`^[a-z0-9][a-z0-9._-]{0,63}$`, and resolved paths (after `realpath`) must stay
under the workspace. A project directory that is a symlink out of
`/workspace/projects` is rejected.

## Processes

- A `string` command runs as `["bash", "-lc", command]` in the project
  directory, so `/etc/profile.d/theone.sh` sets `PATH` (Java, Android tools,
  `~/.local/bin`, `~/.bun/bin`). A `string[]` is exec'd directly.
- Each process is the leader of its own session and process group. Stopping
  sends SIGTERM to the group (and to other groups of the session), then SIGKILL
  after 5 s, so `npm start` and its children stop together.
- When the leader exits on its own, leftovers in its group or session
  (`cmd &`, `nohup cmd &`, a dev server npm left behind, Gradle daemons) are
  found by scanning `/proc/*/stat`, stopped the same way and named in the log;
  only then does the row reach its final state. The same applies to build
  steps, agent runs and terminals. Programs that call `setsid` survive.
- `display: true` adds `DISPLAY=$THEONE_DISPLAY`. `env` entries are merged
  over the controller's environment, which never contains `THEONE_TOKEN` or
  `THEONE_VNC_PASSWORD`; `THEONE_PROCESS_ID` is added. A declared `port` must be
  free (tracked processes and a TCP probe on `127.0.0.1`/`::1`), otherwise the
  request gets `409` naming the tracked process (declared, or found through
  `/proc`) or the pid that holds it.
- The state machine is `starting → running → exited | failed | stopped`,
  plus `orphaned` after a restart. Every change is published as
  `process.updated` and mirrored into `RUNTIME.md`.

## Terminals (PTY)

- `Bun.spawn(argv, { terminal: { cols, rows, data } })` provides a real PTY.
  `shell` runs `$SHELL -l` (bash) and `claude` runs `claude` with no extra
  flags, so interactive Claude uses its normal permission prompts.
- Output is appended to a scrollback buffer trimmed to 256 KiB and broadcast
  to every attached socket. A new socket first gets the whole scrollback as
  one `output` frame.
- The session outlives its sockets. It ends when the process exits
  (`{type:"exit"}`, `terminal.updated`) or on `DELETE /v1/terminals/:id`.
  `DELETE` sends SIGHUP to the session, then SIGKILL after 5 s; background jobs
  left behind after `exit` are stopped too.
- `GET /v1/terminals` lists the sessions of the current controller lifetime
  only. Rows from earlier lifetimes stay in `state.db` as `exited`.

## Build queue and recipes

Builds run **one at a time** in FIFO order. A queued build can be cancelled
before it starts, and a running one is cancelled by killing its process group.
Each step runs as `bash -lc` in the project directory, with its output in the
build log and `stage` updated as it goes (`install` → `compile` → `package` →
`collect`).

Targets are offered per project by `project-detect` (`Project.buildTargets`).
A request for a target the project does not have returns `400`. `<pm>` is
the package manager from the lockfile (`bun.lock(b)`, `pnpm-lock.yaml`,
`yarn.lock`, `package-lock.json`; npm by default). `<exec>` is its local-bin
runner: `npx --yes=false` (a bare `npx --no` would swallow the binary name),
`pnpm exec`, `yarn run` or `bunx --no-install`. Only project-local tools are
used, and `<pm> install` runs only when `package.json` has dependencies.

| Target | Offered when | Steps | Collected |
|---|---|---|---|
| `electron-linux` | `electron-builder` or `@electron-forge/cli` in deps | `<pm> install` → `<pm> run build` (if a `build` script exists and does not itself call the packager) → `<exec> electron-builder --linux AppImage --x64 --publish never` | `<output dir>/*.AppImage`, `*.deb` (`build.directories.output`, default `dist`) |
| `electron-windows` | same | same, with `--win nsis --x64`, in the wine env (`WINEPREFIX`, `WINEARCH=win64`, `WINEDEBUG=-all`, `WINEDLLOVERRIDES=mscoree,mshtml=`, `DISPLAY`) | `<output dir>/*.exe` except `*__uninstaller*` |
| Forge (either platform) | `@electron-forge/cli` without `electron-builder` | `<exec> electron-forge make --platform linux\|win32 --arch x64` | `out/make/**`: `*.AppImage`, `*.deb`, `*.rpm`, linux zips / `*.exe`, `*.msi`, `*.appx`, win32 zips |
| `android-apk` | Expo app (`expo` dep plus `app.json`/`app.config.*`) or `android/gradlew` | `<pm> install` → `<exec> expo prebuild --platform android --no-install` (only without `android/`) → `cd android && sh ./gradlew assembleDebug\|assembleRelease --no-daemon --console=plain` (with `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `JAVA_HOME`) | `android/app/build/outputs/apk/**/<profile>/**/*.apk` |
| `web` | a `build` script, framework not Electron | `<pm> install` → `<pm> run build` | the first of `dist`, `build`, `out`, `web-build`, zipped (`zip`, falling back to `python3 -m zipfile`) |
| `script` | a `build` script | `<pm> install` → `<pm> run build` | nothing (logs only) |

The `debug` profile (the default) passes `-c.compression=store` to
electron-builder, which makes builds faster and artifacts larger. A recipe
declares what it requires (`wine` for Windows, `java` for Android). If that
tool is missing, `POST /v1/builds` is rejected with `503 unavailable`
before anything is queued. Gradle runs with `--no-daemon`: sandbox memory is
limited, and a daemon would outlive the build and its cancel.

**Collection.** Only files modified after the build started (minus 2 s) count,
because output directories keep installers of earlier builds and versions; if
nothing matches, the build fails. Each matched file is copied to `/workspace/artifacts/` as
`<project>-<platform>-<profile>-<version>.<ext>` (`platform` is `linux`,
`windows`, `android` or `web`; `version` comes from `package.json`, or
`0.0.0`). Existing files are never overwritten: a collision gets `-2`, `-3`, …
before the extension. The sha256 and size are recorded, and an
`artifact.created` event fires for each file. Downloads resolve the real path
and refuse anything outside `/workspace/artifacts`. If the file has been
deleted, they return `404`.

## Headless Claude runs

```text
claude -p <prompt> --output-format stream-json --verbose --permission-mode $THEONE_CLAUDE_PERMISSION_MODE [--resume <sessionId>]
```

- Runs in the project directory (or `/workspace`) as `dev`. The prompt always
  goes through stdin, never argv, so it cannot inject options. `CLAUDECODE` is
  removed from the environment (a run started from inside Claude would
  otherwise refuse to start) and `THEONE_AGENT_RUN_ID` is added.
- `agent-stream` parses the NDJSON stream. Assistant text becomes `text`
  events, tool calls become `tool_use` (tool name plus a one-line summary),
  tool results become `tool_result` (with `isError`), and init and
  diagnostics become `system`. The final `result` message fills `result`,
  `costUsd` and `sessionId`.
- Events are persisted (`agent_run_events`), streamed on
  `/v1/agent/runs/:id/stream`, and summarized as `agent.updated`.
- Cancel kills the process group. The run ends as `cancelled`. Anything the
  run left in its group or session (a dev server started with `&`) is stopped
  when it ends and reported as a `system` event.
- Without credentials, Claude exits within about a second ("Not logged in ·
  Please run /login") and the run ends as `failed`.

## Display and VNC bridge

- `GET /v1/display` probes `xdpyinfo -display $THEONE_DISPLAY` for
  availability and geometry, and `THEONE_VNC_HOST:THEONE_VNC_PORT` for VNC:
  `vnc.available` is true only when the 12-byte `RFB 003.00x\n` banner arrives
  within 1 s (an open port that says anything else is unavailable). Results are
  cached for 2 s. It returns the VNC password (from the entrypoint's
  `/run/theone/controller.env`) so noVNC can authenticate.
- `GET /v1/display/screenshot` runs `import -window root -display :1 png:-`
  (falling back to `xwd -root | convert`, `xwd` from x11-apps) and returns `image/png`.
- `WS /v1/display/vnc` opens a TCP socket to Xvnc per WebSocket and copies
  bytes both ways (binary frames). It echoes `Sec-WebSocket-Protocol: binary`
  when offered. Either side closing closes the other.

## Runtime mirror

`/workspace/.agent/RUNTIME.md` is rewritten (debounced, temp file + rename)
on every `process.updated`, `terminal.updated`, `build.updated`,
`agent.updated` and `artifact.created`. It lists the display and VNC state,
running processes (id, project, name, pid, port, display, command), recently
ended processes, terminals, active and recent builds, and recent agent runs.
Claude reads it at session start ([SPEC §3](../../SPEC.md#3-persistent-memory))
to learn what is already running.

## CLI

```text
theone-controller [serve]                # run the daemon (default)
theone-controller pair [--json]          # ANSI QR code + deep link from THEONE_PUBLIC_URL; --json → { link, url, name }
theone-controller status [--json]        # SandboxStatus from the local API, formatted or raw
theone-controller emit --status <s> --message <m> [--project <p>] [--stage <s>] [--platform <p>]
theone-controller token [--rotate]       # print the token, or write a new one (restart required)
theone-controller api <METHOD> <PATH> [JSON|-]   # call the local API (in-sandbox agent)
theone-controller --version | --help
```

The CLI reads the token from `THEONE_TOKEN` or `THEONE_TOKEN_FILE` and calls
`http://127.0.0.1:$THEONE_PORT` (the bind address, unless it is a wildcard).
`status --json` and `api` print `display.vnc.password` as `***`. `emit`
validates its input against `StatusEventInputSchema` and exits with code 2 on
bad arguments.

`api` is the only way the in-sandbox agent should use the REST API: `METHOD`
is `GET`, `POST` or `DELETE`; `PATH` must start with and stay under `/v1/`; the
body is the third argument or `-` for stdin. 2xx JSON is pretty-printed to
stdout; other 2xx content (screenshots, downloads) is written raw, only when
stdout is not a terminal. Non-2xx prints the error body on stderr and exits 1;
bad arguments or invalid JSON exit 2 before any request. Every occurrence of the
token in a response is printed as `***`. The whole request has a 120 s timeout.
All CLI output is flushed before exit, so piping large responses is safe.

```bash
theone-controller api GET "/v1/processes?projectId=hello"
echo '{"projectId":"hello","target":"android-apk"}' | theone-controller api POST /v1/builds -
theone-controller api GET /v1/display/screenshot > /tmp/screen.png
``` It is how Claude reports status
([SPEC §8.1](../../SPEC.md#81-status-events)). After `token --rotate`, restart
the controller (`supervisorctl restart controller`) so the daemon picks up the
new token ([operations](../runbooks/operations.md#rotate-the-token)). The CLI
warns if `THEONE_TOKEN` overrides the file.

## Untrusted project content

Repositories are treated as hostile input:

- `package.json` is read only if it is a regular file of at most 1 MiB (opened
  with `O_NONBLOCK`, checked with `fstat` on the open descriptor); a symlink to
  `/dev/zero`, a FIFO or a huge file is treated as `{}` instead of freezing the
  event loop. `.agent` context files are read the same way with `O_NOFOLLOW`.
- `git status` and `git log` run with `-c core.fsmonitor=false -c
  log.showSignature=false`, and every `filter.<driver>` found in the
  repository's config gets empty `clean`/`smudge`/`process` and
  `required=false`, so listing a project never runs commands from its
  `.git/config` or attributes.
- Children never see `THEONE_TOKEN` or `THEONE_VNC_PASSWORD`. This prevents
  accidental leaks only: code running as `dev` can still read the token file
  and the controller's `/proc/<pid>/environ` ([security-model](security-model.md#same-user-limit)).

## Development

```bash
THEONE_HOST=127.0.0.1 THEONE_WORKSPACE=/tmp/theone-ws bun run controller:dev   # watch mode; loopback only, test data outside /workspace
bun run --cwd apps/controller test              # unit, route, UI-lib and lifecycle tests (bun test)
bun run controller:build                        # dist/theone-controller for the current platform
```

On a laptop without X, VNC, wine or Claude, the controller still starts, and
those features report `available: false` / `version: null` / 503.
