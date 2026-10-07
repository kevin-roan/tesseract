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
├── cli/                pair · status · emit · token · share (commands.ts), api (api.ts), hook (hook.ts), local-api, output
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
│   ├── middleware/     auth (bearer, or ticket for artifact downloads and upload content), request-log (redacts tickets)
│   ├── routes/         system · projects · processes · terminals · builds · artifacts · agent · inbox · push (devices, live activities) · uploads
│   └── validation.ts   zod schemas from @theone/protocol → 400 bad_request
├── ws/                 WebSocket route matching, ticket check, upgrade, per-socket handlers
├── services/           one class per domain (below)
└── ui/                 terminal.html (xterm.js) and vnc.html (noVNC), served as Bun HTML routes
```

| Service | Responsibility |
|---|---|
| `projects`, `project-detect`, `git` | list `/workspace/projects/*`, detect framework, package manager (lockfile), scripts and build targets; clone as a tracked process; git summary and details with the repository's own hooks neutralised ([below](#untrusted-project-content)); confidential marks (pseudonym name, `REDACTED` commit authors) |
| `processes` | spawn `bash -lc <command>` (or argv) in its own session, capture stdout/stderr into logs, stop with SIGTERM then SIGKILL after 5 s, reap leftovers of the group/session |
| `terminals` | PTYs via `Bun.spawn({ terminal })`: login shell or `claude` (with `--append-system-prompt <confidentialPrompt(id)>` in a confidential project), 256 KiB scrollback, several clients per session, resize |
| `builds`, `build-recipes`, `artifacts` | FIFO build queue, recipes per target, artifact collection, naming and sha256; shared files and deletion ([below](#shared-files)) |
| `taildrop` | `GET /v1/taildrop/targets` and `POST /v1/artifacts/:id/taildrop` over LocalAPI `file-targets`/`file-put` ([below](#shared-files)) |
| `display`, `vnc-bridge` | `xdpyinfo` probe, RFB banner probe of 5901, screenshots, WS↔TCP bridge |
| `agent-runs`, `agent-stream` | headless `claude -p` runs (with `--append-system-prompt <confidentialPrompt(id)>` in a confidential project), stream-json parsing into `AgentRunEvent`s |
| `uploads`, `transcriptions` | phone attachments in `/workspace/.theone/uploads`, speech-to-text of voice notes ([below](#uploads-and-speech-to-text)) |
| `inbox`, `claude-hooks` | the notification inbox (dedupe, read state, pruning, `inbox.updated`) and the mapping of Claude Code hook calls onto it ([below](#inbox-and-claude-hooks)) |
| `push` | registered Expo push tokens and pushes of inbox items through `THEONE_PUSH_URL` ([below](#inbox-and-claude-hooks)) |
| `live-activity`, `apns` | `IslandState` of the sandbox and its mirror into the iOS Live Activity through ActivityKit pushes over HTTP/2 to APNs ([below](#live-activities)) |
| `status`, `tools` | `SandboxStatus`: cgroup/OS resources, tool versions (`node`, `bun`, `git`, `python3`, `java`, `wine`, `claude`, `adb`) |
| `identity` | `GET /v1/identity`: Tailscale serve headers (loopback peers only) or LocalAPI `whois`, plus LocalAPI `status` (30 s cache) over `THEONE_TAILSCALE_SOCKET`; 1.5 s timeout, unavailable → nulls |
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
| Processes, terminals (metadata), builds, artifacts, agent runs and their events, the inbox (newest 1 000 items), uploads, push devices, live activity tokens, settings (the STT profile) | `$THEONE_DATA_DIR/state.db` | SQLite, WAL. Back up with the controller stopped ([operations](../runbooks/operations.md#back-up-volumes)) |
| Token | `$THEONE_DATA_DIR/token` | 0600, unless `THEONE_TOKEN` is set |
| Process and build logs | `$THEONE_DATA_DIR/logs/<id>.log` | rotated to `<id>.log.1` at 5 MiB (one rotation kept) |
| Live log tail | memory | ring buffer of 2 000 lines per live process or build; WS streams replay 200 lines |
| Tickets | memory | lost on restart, which is harmless: they live 60 s |
| Terminal scrollback | memory | 256 KiB per session, lost on restart along with the PTY |
| Uploaded files | `$THEONE_WORKSPACE/.theone/uploads/<id>/<name>` | 0700 dirs, 0600 files; rows and files older than 30 days are pruned at startup |

`$THEONE_DATA_DIR` defaults to `/workspace/.agent/controller`. Claude's SPEC
forbids reading, listing or editing it: the agent uses the API only through
`theone-controller api`, which reads the token itself and never prints it.

## HTTP pipeline

`request-log` → CORS (`THEONE_CORS_ORIGINS`, default `*`; methods GET, POST,
DELETE; exposes `Content-Disposition`, `X-Content-SHA256`) → body limit (1 MiB, 8 MiB for
`POST /v1/claude/import`, 28 MiB for `POST /v1/uploads`; 413 with code `bad_request` beyond) →
`requireAuth` → route → zod validation → service → JSON. Errors map to
`{ error: { code, message } }` with the status from the protocol's
`ERROR_STATUS`. Unknown errors are logged and returned as `500 internal`
without details. Request logs redact `ticket` query parameters.

`requireAuth` lets `GET /v1/health` through, accepts a bearer token compared
in constant time (SHA-256 of both sides, then `timingSafeEqual`), and for
`GET /v1/artifacts/:id/download` and `GET /v1/uploads/:id/content` also accept a one-time `?ticket=`.
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

## Shared files

Claude (or anything in the sandbox) hands a finished file to the user with
`theone-controller share <file> [--project <id>] [--name <name>] [--note <text>]`, which
resolves the path against its cwd and calls `POST /v1/artifacts`. The image's managed
memory `/etc/claude-code/CLAUDE.md` asks Claude to do this for deliverables (APK/AAB,
installers, zips, reports, exported media) after a successful build, and not for
intermediate files.

- **Checks.** The realpath must be a regular file inside `/workspace` and not under
  `/workspace/artifacts` or `THEONE_DATA_DIR` (token, database, Claude token): `403`
  otherwise, `404` when it does not exist, `400` for directories. Symlinks are followed
  first, so a link that leaves the workspace is refused.
- **Project.** An explicit `projectId` must exist (`404`); without one, the path must be
  inside `/workspace/projects/<id>/` (`400` "pass --project or share a file inside a project").
  A confidential project refuses every share with `403` "Project <id> is confidential;
  sharing artifacts is disabled"; its build artifacts are still collected.
- **Storage.** The file is copied (never moved) to `/workspace/artifacts/<name>`, where
  `<name>` is the source basename or `name`; collisions get `-2`, `-3`, … before the
  extension. `platform` comes from the extension (`.apk`/`.aab` android, `.exe`/`.msi`
  windows, `.deb`/`.rpm`/`.AppImage` linux, else `file`). The row has `source: "agent"`,
  the `note`, and `agentRunId` when it names a known run (the CLI sends
  `THEONE_AGENT_RUN_ID`, and `CLAUDE_CODE_SESSION_ID` as `sessionId`). `artifact.created`
  fires as for builds.
- **Inbox.** Each share adds a `file` item "New file: <name>" (body: the note, else size
  and project) with `artifactId`, `sessionId` and `agentRunId`. `file` items are never
  bumped, so every share is its own row.
- **Delete.** `DELETE /v1/artifacts/:id` (any source) removes the file when it is inside
  the artifacts directory, deletes the row, sets `artifactId` to null on the inbox items
  that announced it (they keep their text) and publishes `artifact.deleted`.
- **Taildrop.** Needs the LocalAPI socket opt-in ([security model](security-model.md)).
  `GET /v1/taildrop/targets` maps `/localapi/v0/file-targets` to `{ id: StableID, hostName,
  dnsName, os, online }`; no socket or any failure gives `{ available: false, targets: [] }`.
  `POST /v1/artifacts/:id/taildrop { targetId }` checks the target is listed, then streams
  the file with `PUT /localapi/v0/file-put/<StableID>/<fileName>` (`Content-Length` set,
  15 min timeout). No LocalAPI or a failed push → `503`, unknown target → `404`, tailscaled
  refusing (`403`) → `403`.

## Headless Claude runs

```text
claude -p --output-format stream-json --verbose --permission-mode <mode | $THEONE_CLAUDE_PERMISSION_MODE> \
  [--add-dir /workspace/.theone/uploads] [--resume <sessionId>]   # prompt on stdin
```

- `mode` (`plan`, `acceptEdits`, `bypassPermissions`) overrides the configured permission
  mode for one run; the run stores `null` when it was not given.
- `attachmentIds` are resolved before Claude starts (404 for an unknown id) and stored on the
  run as full `Upload` objects. Non-audio attachments add `--add-dir` for the uploads directory
  and a block to the stdin prompt:
  `\n\nAttached files (read them with the Read tool):\n- /workspace/.theone/uploads/upl_…/shot.png (image/png)`.
  Audio attachments are not listed: the app sends their transcript as the prompt and keeps the
  recording on the run for replay.

- Runs in the project directory (or `/workspace`) as `dev`. The prompt always
  goes through stdin, never argv, so it cannot inject options. `CLAUDECODE` is
  removed from the environment (a run started from inside Claude would
  otherwise refuse to start) and `THEONE_AGENT_RUN_ID` is added.
- `agent-stream` parses the NDJSON stream. Assistant text becomes `text`
  events, tool calls become `tool_use` (tool name plus a one-line summary),
  tool results become `tool_result` (with `isError`), and init and
  diagnostics become `system`. The final `result` message fills `result`,
  `usage` (tokens from its `usage` object; `total_cost_usd` is ignored) and `sessionId`.
- Events are persisted (`agent_run_events`), streamed on
  `/v1/agent/runs/:id/stream`, and summarized as `agent.updated`.
- Finished runs can be archived (`archived_at`, hidden from the default list,
  `agent.updated` again) or deleted with their events (`agent.deleted`; inbox
  items keep their row, unlinked). Running runs are skipped by both.
- Cancel kills the process group. The run ends as `cancelled`. Anything the
  run left in its group or session (a dev server started with `&`) is stopped
  when it ends and reported as a `system` event.
- Without credentials, Claude exits within about a second ("Not logged in ·
  Please run /login") and the run ends as `failed`.

## Uploads and speech-to-text

`POST /v1/uploads` takes `{ name, mimeType, data }` with base64 data (whitespace and missing
padding tolerated, at most 20 MiB decoded, empty refused). The name is reduced to its last path
segment without control characters or leading dots (≤ 200 UTF-8 bytes, extension kept), the MIME
type to its lower-cased essence, and `kind` follows the MIME type (`image/*`, `application/pdf`,
`audio/*`, else `file`). `GET /v1/uploads/:id/content` serves the file inline (attachment for
`file`) with `nosniff` and `Content-Security-Policy: sandbox`, answers single `Range` requests
with 206, and refuses files that were removed or no longer resolve inside the uploads dir.

`POST /v1/transcriptions` transcribes an audio upload. The engine is chosen per request:

| `THEONE_STT_ENGINE` | Engine |
|---|---|
| `whisper.cpp` (default) | ffmpeg → 16 kHz mono s16le WAV in a private temp dir, then `whisper-cli -m <model> -t <threads> -f <wav> -l <lang\|auto> -oj -of <base> -np -nt`, both prefixed with the profile's `ionice -c3` / `nice -n <n>` (each skipped when the binary is missing); the JSON segments form the text (stdout as fallback), `durationMs` comes from the WAV size. Each step has a 5 min timeout and runs detached (the group is killed on timeout); the temp dir is always removed |
| `openai-compatible` | multipart `POST <THEONE_STT_URL>/audio/transcriptions` with `file` (an extension-less name gets one from the MIME type), `model` (`THEONE_STT_MODEL`), `response_format=verbose_json`, `language?`, `Authorization: Bearer <THEONE_STT_API_KEY>` (optional here), 5 min timeout. `text`, `language` and `duration` are read from JSON; a non-JSON reply is taken as the text |
| `auto` | whisper.cpp when `THEONE_WHISPER_BIN`, `THEONE_FFMPEG_BIN` and a model file exist; else openai-compatible when `THEONE_STT_URL` and `THEONE_STT_API_KEY` are set; else 503 naming these variables |
| `none` | 503 |

The whisper.cpp default keeps voice notes on the machine; a paid API is only called when
`THEONE_STT_ENGINE` is `openai-compatible` or `auto` with a URL and key.

A resource profile keeps transcription from slowing the host. `GET /v1/stt` reports it,
`PUT /v1/stt { profile }` switches it at runtime (stored in the `settings` table, key
`stt.profile`; `THEONE_STT_PROFILE`, default `eco`, applies until then) and publishes
`stt.updated`. The same request takes `geminiApiKey` (string to save, `null` to forget): the mobile
and desktop apps set the Gemini key this way, stored under `stt.geminiApiKey` and preferred over
`GEMINI_API_KEY`; `GET /v1/stt` only reports `gemini.configured` and `gemini.source`. `cpus` is `os.availableParallelism()` capped by the cgroup v2 `cpu.max` quota.

| Profile | Model | Threads (`-t`) | Priority |
|---|---|---|---|
| `off` | — | — | `POST /v1/transcriptions` is 503 `Speech-to-text is off (select a profile in the desktop app)` |
| `eco` | `base` | 2 | `nice -n 19` + `ionice -c3` (idle I/O) |
| `balanced` | `base` | max(2, cpus/4) | `nice -n 10` |
| `performance` | `small` | min(cpus, max(4, cpus/2)) | `nice 0` (no prefix) |

Models are `$THEONE_WHISPER_MODELS_DIR/ggml-<model>.bin` (default `/opt/whisper/models`); when
the profile's file is missing, `THEONE_WHISPER_MODEL` is used and `model` in the status names
it (the symlink target's name, e.g. `base` for `ggml-model.bin`). `available` per profile
reflects only its own file. Whatever the profile, one transcription runs at a time; the others
wait in FIFO order (`busy`, `queued`). Engine and model are resolved again when a job starts, so
a profile switch applies to queued jobs.

Failures of the engine are 503 with the tool's error (the key is redacted); `[BLANK_AUDIO]`-style
markers are dropped and an empty result is 400 `No speech detected`. The HTTP idle timeout is
lifted for this request. The API key is never logged and is not passed to children.

## Claude login

`services/claude-auth.ts` reports the Claude Code login the sandbox uses. The only supported
credential is the host's Claude Max login in `~/.claude`, bind-mounted at `/home/dev/.claude`
(`$CLAUDE_CONFIG_DIR`); the controller neither stores a token nor injects one into children,
and the stack passes no Claude credential through the environment.

### Claude accounts

`services/claude-accounts.ts` adds the host's other Claude Code config dirs. The primary
account `claude` is the dir above; each `THEONE_CLAUDE_ACCOUNTS` name `<n>` is the host's
`~/.claude-<n>` bind-mounted at `/home/dev/.claude-<n>` (id `claude-<n>`, global config
`<dir>/.claude.json`), the same live mount as the primary, so token refreshes on either side
reach both and the host login keeps working. The controller only reads these dirs.

- `GET /v1/claude/accounts` lists them with login, account, plan and expiry (no secrets);
  `PUT /v1/claude/accounts/default` stores the default in `settings` (`claude.defaultAccount`).
- `PUT /v1/projects/:id/claude-account` pins a project (`project_claude_accounts`); null
  follows the default.
- Agent runs and `claude` terminals resolve the account as: the resumed session's (newest
  run with that session id, `agent_runs.claude_account_id`), else the project's, else the
  default. A non-primary account adds `CLAUDE_CONFIG_DIR=<dir>` to the child; the primary
  adds nothing, so Claude Code keeps using `$HOME/.claude.json`. An account that is no
  longer configured or mounted makes the start fail with 503 instead of falling back.
- Usage and sessions read transcripts from every account's dir.

- `GET /v1/claude/auth` reads, never returns, the secrets:
  `claudeAiOauth.accessToken` in `$CLAUDE_CONFIG_DIR/.credentials.json`, plus
  `CLAUDE_CODE_OAUTH_TOKEN` (`oauthTokenFromEnv` equals `sources.oauthToken`) and
  `ANTHROPIC_API_KEY` in the environment, which are reported only if someone sets them
  manually. The account comes from `oauthAccount` in the global config
  (`$CLAUDE_CONFIG_DIR/.claude.json` if the variable is set, else `$HOME/.claude.json`).
- `POST /v1/claude/import` (sent by the desktop app) writes credentials, the account keys
  and whitelisted config files (`CLAUDE_IMPORT_PATHS`). Paths are refused unless
  normalized and relative; parent directories are walked one by one and a symlink must
  resolve inside the config dir; the final write is temp file + rename, so a symlinked
  target is replaced, not followed. `settings.json` loses the keys that run host
  commands (`hooks`, `apiKeyHelper`, `statusLine`, …); the sandbox's own hooks live in
  `/etc/claude-code/managed-settings.json` and are unaffected. The previous
  `settings.json`, `.credentials.json` and global config are kept as `<file>.theone-bak`.
  `importedAt` is recorded in `$THEONE_DATA_DIR/claude-import.json`.

## Inbox and Claude hooks

The inbox tells the phone when Claude needs a human and when work ends. Items
come from three sources:

- **Claude Code hooks.** `/etc/claude-code/managed-settings.json` in the image
  registers `theone-controller hook` for `Notification`, `Stop`, `StopFailure`
  and `UserPromptSubmit` in every Claude session, interactive terminal or
  `claude -p`. The command reads the hook JSON from stdin, adds
  `theone_terminal_id`/`theone_agent_run_id` from `THEONE_TERMINAL_ID`/
  `THEONE_AGENT_RUN_ID` (the controller sets them for its terminals and runs),
  and POSTs it to `/v1/hooks/claude`. It gives up after 1.5 s, prints nothing and
  always exits 0, so a stopped controller never blocks or changes Claude.
- **Shared files.** `POST /v1/artifacts` adds a `file` item per share ([above](#shared-files)).
- **Agent runs.** `InboxService` follows `agent.updated`: a run it saw running that ends
  `succeeded` adds `completed` (body: the result, 280 chars max), `failed` adds
  `failed` (the error). `cancelled` adds nothing. Later updates of finished runs
  (archiving) add nothing.

| Hook | Inbox |
|---|---|
| `Notification`, `notification_type` `permission_prompt` (or no type and a message mentioning "permission") | `permission` "Claude needs permission", body = message |
| `Notification`, `idle_prompt`, `agent_needs_input`, `elicitation_dialog`, `elicitation_url_dialog`, unknown types | `needs_input` "Claude is waiting for input" |
| `Notification`, `elicitation_complete`, `elicitation_response` | clears the session's attention items |
| `Notification`, `quota_*` | `status` "Claude usage quota" |
| `Notification`, `auth_success`, `agent_completed` | ignored |
| `Stop` | clears attention, then `completed` "Claude finished"; body = `last_assistant_message`, else the last assistant text in the last 64 KiB of `transcript_path`, else the project id or cwd |
| `StopFailure` | clears attention, then `failed` "Claude stopped with an error" (`error_type`) |
| `UserPromptSubmit` | clears the session's attention items (the human answered) |
| anything else (`SubagentStop`, …) | ignored |

`projectId` is the directory under `$THEONE_WORKSPACE/projects` that contains
`cwd`. `agentRunId` is the running agent run with the hook's `session_id` (or the
`theone_agent_run_id` run while it has no session yet); `terminalId` is the
forwarded terminal id when that terminal is known.

Rules: a new item (except `file`) for the same kind and the same `sessionId` or `agentRunId` as
an **unread** item bumps that item (`title`, `body`, `updatedAt`, missing links)
instead of adding a row; `completed` and `failed` count as one kind, so a run's
outcome and the `Stop` hook of its session make one item, and a run whose Stop
item was already read is not posted again. "Clears attention" marks the unread
`needs_input`/`permission` items of that session or run read. Every change
publishes `inbox.updated` with the new counts (and the item when one was added
or bumped). After each insert only the newest 1 000 items by `updatedAt` are kept.

**Push.** Phones register an Expo push token with `POST /v1/push/devices` (table
`push_devices`). A registration with a `deviceId` drops the other tokens of that id, so a phone
with both the production app and the dev client gets each push once, on the build opened last
(the app re-registers on every foreground). `PushService` follows `inbox.updated`: an unread
`completed`, `failed`, `needs_input`, `permission` or `file` item is POSTed to `THEONE_PUSH_URL`
(Expo's push API, which delivers through FCM on Android and APNs on iOS) as one message per
device, 100 per request, with channel `inbox` and `data` = `PushData { url: "/inbox", sandboxId,
itemId, kind, artifactId }`. Every push is titled `Monolith`; the item title (prefixed with the
project id) is the `subtitle` on iOS and leads the body (`<heading>: <body>`) on Android. The
same item id is pushed at most once per 15 s, and the `completed`/`failed` outcome of an agent
run once per run (6 h), so the Stop hook(s) and the run's end that bump one item send one push. Tokens whose ticket says `DeviceNotRegistered` are
deleted; other errors and network failures are logged and never reach the inbox.
`THEONE_EXPO_ACCESS_TOKEN` is sent as a bearer token when set; `THEONE_PUSH_URL=off` turns
pushes off.

## Live Activities

The iOS app shows the sandbox in a Live Activity (Dynamic Island / lock screen). It registers
ActivityKit tokens with `POST /v1/push/live-activities` (table `live_activity_tokens`): the
app's `push-to-start` token and, once an activity runs, its `activity` update token.
`LiveActivityService` (`services/live-activity.ts`) follows `agent.updated`, `agent.deleted`,
`process.updated` and `build.updated`, recomputes the `IslandState` after a 1 s debounce
(running runs → `runs`, title = first prompt line ≤ 60 chars, project = project name; running
processes and queued/running builds → `commands`; `GET /v1/usage`-style totals for today and
the last 7 days plus the runs started today → `usage`, zeros when transcripts are unavailable;
`sandboxName` = the Tailscale host name, else the container hostname) and, when the content
changed, sends ActivityKit pushes straight to APNs (`services/apns.ts`, `node:http2`, one
session per host reused and reopened on close, 10 s per request):

- every `activity` token gets `event: "update"`, or `event: "end"` with a `dismissal-date`
  5 min ahead when no run or command is left (those tokens are then deleted; the next activity
  registers a new one);
- with no `activity` token, a run that just started is sent as `event: "start"` to every
  `push-to-start` token with `attributes-type: "IslandAttributes"`, `attributes: { sandboxId,
  sandboxName }` and an `alert` (`title: "Monolith"`, `subtitle: "<project> · Claude started"`,
  `body`: the run title).

Headers: `authorization: bearer <JWT>` (ES256 over the `.p8` key, `iss` = team id, cached
50 min), `apns-topic: <bundle id>.push-type.liveactivity`, `apns-push-type: liveactivity`,
`apns-priority: 10`, `apns-expiration: 0`; body `{ aps: { timestamp, event, "content-state":
IslandState, "stale-date" | "dismissal-date", … } }`. A `410`, or a `400` with reason
`BadDeviceToken`, `Unregistered` or `ExpiredToken`, deletes the token; other errors are logged.
Without `THEONE_APNS_KEY_FILE`, `THEONE_APNS_KEY_ID` and `THEONE_APNS_TEAM_ID` the routes still
store tokens and the service only logs at `debug` ([runbook](../runbooks/live-activities.md)).

## Display and VNC bridge

- `GET /v1/display` probes `xdpyinfo -display $THEONE_DISPLAY` for
  availability and geometry, and `THEONE_VNC_HOST:THEONE_VNC_PORT` for VNC:
  `vnc.available` is true only when the 12-byte `RFB 003.00x\n` banner arrives
  within 1 s (an open port that says anything else is unavailable). Results are
  cached for 2 s. It returns the VNC password (from the entrypoint's
  `/run/theone/controller.env`) so noVNC can authenticate.
- `GET /v1/display/screenshot` runs `import -window root -display :1 png:-`
  (falling back to `xwd -root | convert`, `xwd` from x11-apps) and returns `image/png`.
- `GET /v1/display/browser` reads Chromium's DevTools `/json/list` on
  `127.0.0.1:$THEONE_CHROMIUM_DEBUG_PORT` (1.5 s timeout) and returns the `page` tabs
  with a `phoneUrl` whose loopback host is replaced by the sandbox Tailscale address
  (blueprint §5.2). No endpoint means `{ available: false, tabs: [] }`.
- `GET /v1/display/windows` runs `wmctrl -lp` and `xprop -root _NET_ACTIVE_WINDOW`,
  then `xprop -id <id> WM_CLASS _NET_WM_WINDOW_TYPE _NET_WM_STATE` per window (all with
  `DISPLAY=$THEONE_DISPLAY`, 3 s timeout each), and keeps what a taskbar would show.
  `POST …/:id/activate` (`wmctrl -ia`) and `POST …/:id/close` (`wmctrl -ic`, or
  `xdotool windowkill` with `force`) only act on a window in that list, so the id
  can't name the dock or the root window.
- `WS /v1/display/vnc` opens a TCP socket to Xvnc per WebSocket and copies
  bytes both ways (binary frames). It echoes `Sec-WebSocket-Protocol: binary`
  when offered. Either side closing closes the other.

## Runtime mirror

`/workspace/.agent/RUNTIME.md` is rewritten (debounced, temp file + rename)
on every `process.updated`, `terminal.updated`, `build.updated`,
`agent.updated`, `artifact.created` and `artifact.deleted`. It lists the display and VNC state,
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
theone-controller share <file> [--project <id>] [--name <n>] [--note <t>] [--json]   # POST /v1/artifacts
theone-controller hook                   # Claude Code hook → POST /v1/hooks/claude; silent, always exits 0
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
- Children never see `THEONE_TOKEN`, `THEONE_VNC_PASSWORD`, `THEONE_STT_API_KEY` or `GEMINI_API_KEY`. This prevents
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
