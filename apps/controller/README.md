# @tesseract/controller

The daemon that runs inside the sandbox container and is the only network-facing
service: REST + WebSocket API (`/v1`), the browser pages used by the phone's
WebViews (`/ui/terminal`, `/ui/vnc`), and the `tesseract-controller` CLI.
The contract is [`docs/architecture/00-blueprint.md`](../../docs/architecture/00-blueprint.md)
and the wire types come from [`@tesseract/protocol`](../../packages/protocol).

Stack: Bun (`Bun.serve` for HTML routes and WebSockets, Hono for REST,
`bun:sqlite`, `Bun.spawn` with `detached` process groups and PTYs), xterm.js and noVNC for the pages.

## Commands

```bash
bun run dev          # watch mode: bun --watch src/index.ts serve
bun run start        # serve from source
bun run build        # dist/tesseract-controller (single executable, /ui assets embedded)
bun run typecheck    # server + tests, the browser code (src/ui/tsconfig.json), then tests/ui
bun test             # unit + integration tests on 127.0.0.1 with temp workspaces
bun test --coverage  # per-file line/function coverage
```

Run it on a laptop without the sandbox; missing pieces (X display, VNC, wine, claude)
are reported as unavailable:

```bash
TESSERACT_WORKSPACE=/tmp/tesseract-ws TESSERACT_HOST=127.0.0.1 bun run dev
TESSERACT_WORKSPACE=/tmp/tesseract-ws bun src/index.ts pair      # deep link + QR
TESSERACT_WORKSPACE=/tmp/tesseract-ws bun src/index.ts status
```

CLI: `serve` (default) · `pair [--json]` · `status [--json]` ·
`emit --status <s> --message <m> [--project p] [--stage s] [--platform p]` · `token [--rotate]` ·
`api <METHOD> <PATH> [JSON | -]` · `share <file> [--project p] [--name n] [--note t] [--json]` · `hook` ·
`tesseract --get [--force] [--json]` · `host serve|pin|pair|token` (host shell, below).
Configuration is environment only (blueprint §4); invalid values stop startup with a clear message.

### `api`: the REST API for the in-sandbox agent

```bash
tesseract-controller api GET "/v1/processes?projectId=hello"
tesseract-controller api POST /v1/processes '{"projectId":"hello","command":"npm run dev","port":5173}'
echo '{"projectId":"hello","target":"android-apk"}' | tesseract-controller api POST /v1/builds -
tesseract-controller api DELETE /v1/processes/prc_7f3k2q9xa1
tesseract-controller api GET /v1/display/screenshot > /tmp/screen.png
```

- Calls `http://127.0.0.1:$TESSERACT_PORT<PATH>` with the token from `TESSERACT_TOKEN` or the token
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

### `share`: send a file to the user's devices

```bash
cd /workspace/projects/hello/android && ./gradlew assembleRelease
tesseract-controller share app/build/outputs/apk/release/app-release.apk --note "Release build with the new login screen"
# shared app-release.apk (6.2 MiB, hello) as art_7f3k2q9xa1
```

Resolves the path against the current directory and calls `POST /v1/artifacts`: the file is
copied (never moved) into `$TESSERACT_WORKSPACE/artifacts` under its own name (`--name` renames;
`-2`, `-3`… on collisions), indexed with `source: "agent"` and announced by a `file` inbox item,
so paired devices can download it (`GET /v1/artifacts/:id/download`) or push it to a tailnet
device with Taildrop. The project comes from the path (`projects/<id>/…`) unless `--project` is
given. `TESSERACT_AGENT_RUN_ID` and `CLAUDE_CODE_SESSION_ID` (set by Claude Code for its Bash tool)
tag the artifact and the inbox item. Only regular files inside the workspace are accepted
(symlinks are resolved first); the artifacts and controller data directories are refused.
`--json` prints the artifact. Errors exit 1 (2 for bad arguments). Claude Code in the sandbox is
told to use it by `/etc/claude-code/CLAUDE.md`.

### `hook`: Claude Code hooks → inbox

```bash
echo '{"hook_event_name":"Notification","session_id":"abc","cwd":"/workspace/projects/hello","notification_type":"permission_prompt","message":"Claude needs your permission to use Bash"}' \
  | tesseract-controller hook
```

Registered for every Claude session in the sandbox by `/etc/claude-code/managed-settings.json`
(`Notification`, `Stop`, `StopFailure`, `UserPromptSubmit`). Forwards the stdin JSON to
`POST /v1/hooks/claude`, adding `tesseract_terminal_id`/`tesseract_agent_run_id` from
`TESSERACT_TERMINAL_ID`/`TESSERACT_AGENT_RUN_ID`. It never prints anything and always exits 0 within
1.5 s, also when the controller is down, the token is missing or stdin is not JSON.

### `tesseract --get`: host changes → sandbox

```bash
cd /workspace/projects/hello/src && tesseract --get
# From laptop:/home/me/hello
#  src/app.ts | 3 ++-
#  1 file changed, 2 insertions(+), 1 deletion(-)
# Synced at 2026-10-01 14:03:12 · previous sync 2026-10-01 11:40:02 (2 hours ago)
```

`/usr/local/bin/tesseract` runs `tesseract-controller tesseract`. It queues a `get` sync request for
the project containing the cwd. The desktop companion takes it only for projects it linked with
`tesseract --sync`, and sends what changed in that checkout since the last push or get. The
controller applies it (`POST /v1/sync/requests/:id/plan` and `…/apply`) all or nothing. Sandbox
edits to the same files, or sandbox commits when `.git` changes, are conflicts: nothing is
written and the exit code is 2. `--force` overwrites them and keeps copies under
`$TESSERACT_DATA_DIR/sync/backups/`. Exits 1 when the host is offline or the project is not linked
there, and 130 on Ctrl-C (a pending request is cancelled). Details: `docs/architecture/sync-back.md` §6.

### `host`: a PIN-protected shell on the host (runs on the host)

`src/host/` is a separate, small daemon for the **host** machine, not the sandbox: it
never reads the sandbox config. It listens on the host's Tailscale IPv4 (`:7701`),
serves `/ui/terminal` and the controller's terminal API, and opens `$SHELL -l` PTYs
in `$HOME` for a phone that has both the host token and the PIN
([blueprint §5.7](../../docs/architecture/00-blueprint.md), [runbook](../../docs/runbooks/host-shell.md)).

```bash
bun run host pin      # from the repo root on the host: set the 6-12 digit PIN
bun run host serve    # bind `tailscale ip -4`:7701 (or --bind/--port)
bun run host pair     # QR for the app's Host shell screen
```

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
                        display, browser (Chromium tabs via DevTools), vnc-bridge, agent runs + stream-json parser, status,
                        identity (Tailscale LocalAPI / serve headers), taildrop (LocalAPI
                        file-targets / file-put), claude-auth (login
                        status, stored OAuth token, host config import), ports, usage +
                        transcripts (Claude Code usage/sessions), context,
                        inbox + claude-hooks (notifications from Claude Code hooks and agent runs),
                        push (Expo push tokens, inbox pushes),
                        uploads (phone attachments) + transcriptions (speech-to-text engines),
                        runtime-mirror (.agent/RUNTIME.md)
  core/                 log store (ring buffer + rotated files), process groups (+ /proc scan),
                        exec, net probes (TCP, RFB banner), events
  db/                   bun:sqlite schema (WAL) and repositories
  ui/                   terminal.html / vnc.html pages, shared lib/, own tsconfig (DOM)
  host/                 host shell daemon (runs on the host): config (bind checks), state.json store,
                        auth (host token, argon2id PIN, lockout, sessions), PTYs, server, `host` CLI
tests/                  bun test suites; fixtures/fake-claude.sh stands in for Claude Code,
                        fake-ffmpeg.sh / fake-whisper.sh / fake-priority.sh (nice, ionice) for the whisper.cpp pipeline
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
  `TESSERACT_TOKEN`, `TESSERACT_VNC_PASSWORD` or `TESSERACT_STT_API_KEY` (`childEnv()` in `core/exec.ts`); they get
  `TESSERACT_PROCESS_ID`/`TESSERACT_BUILD_ID`/`TESSERACT_TERMINAL_ID`/`TESSERACT_AGENT_RUN_ID`. A
  `TESSERACT_TOKEN` from the environment is mirrored into the 0600 token file so the
  in-sandbox CLI keeps working without it.
- `/v1/claude/auth` and `/v1/claude/import` (`services/claude-auth.ts`) report and
  update the Claude Code login. Credentials come from the host's `~/.claude`, bind-mounted
  at `/home/dev/.claude`; the controller stores no token and injects none into children
  (the host's Claude Max login is the only supported auth; `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN`
  are not configured by the stack, only reported and inherited if set manually). The import writes into `$CLAUDE_CONFIG_DIR` only
  whitelisted paths, merges only account keys into the global config, drops
  `settings.json` keys that run host commands, and backs up replaced files as
  `<file>.tesseract-bak`. Its body limit is 8 MiB (other routes 1 MiB).
- `/v1/claude/accounts` and `/v1/projects/:id/claude-account` (`services/claude-accounts.ts`)
  switch Claude accounts: extra host dirs `~/.claude-<n>` (`TESSERACT_CLAUDE_ACCOUNTS`) are
  mounted at `/home/dev/.claude-<n>`; runs and Claude terminals get `CLAUDE_CONFIG_DIR` for
  the session's, project's or default account. Nothing is copied or written into those dirs.
- Project content is untrusted: `package.json` is read only if it is a regular file of at
  most 1 MiB (`core/files.ts`: `O_NONBLOCK` + `fstat` on the open descriptor), `.agent`
  files likewise with `O_NOFOLLOW`, and `git status`/`log` run with `core.fsmonitor`,
  `log.showSignature` and every filter driver neutralised (`services/git.ts`).
  `tests/hardening.test.ts` covers these.
- `GET /v1/identity` (`services/identity.ts`) reads Tailscale identity for the Profile tab.
  The viewer comes from the Tailscale Serve headers (`Tailscale-User-Login`, `-Name`,
  `-Profile-Pic`, RFC 2047 decoded) when the request arrives from loopback, otherwise from
  LocalAPI `whois?addr=<ip:port>` of the peer. Owner, node and tailnet come from LocalAPI
  `status` (cached 30 s, failures are not cached). The LocalAPI is reached over
  `TESSERACT_TAILSCALE_SOCKET` (default `/run/tailscale/tailscaled.sock`) with a 1.5 s
  timeout; no socket or any error yields nulls and `available: false`, never an error
  response. Tests serve a fake LocalAPI on a unix socket (`tests/identity.test.ts`).
- `GET /v1/ports` (`services/ports.ts`) lists TCP ports that visible processes listen on
  (`/proc/net/tcp{,6}` LISTEN sockets matched to `/proc/*/fd` inodes, one entry per port),
  without the controller's own port and `TESSERACT_VNC_PORT`. A port whose owner's process
  group or session is a live tracked process gets its `processId`/`projectId`; otherwise
  `projectId` comes from the owner's cwd under `projects/` (dev servers started from
  terminals or agent runs). `url`/`dnsUrl` use the sandbox's own Tailscale IPv4 and
  MagicDNS name from LocalAPI `status`: the sidecar shares the network namespace, so they
  reach servers bound to 127.0.0.1 too. Without Tailscale they are null, never an error.
- `GET /v1/usage` and `GET /v1/sessions` (`services/usage.ts`, parser in
  `services/transcripts.ts`) read Claude Code transcripts under
  `$CLAUDE_CONFIG_DIR/projects/<encoded-cwd>/<sessionId>.jsonl` (default `$HOME/.claude`),
  plus subagent transcripts in `<sessionId>/subagents/*.jsonl`. Files are cached by path and
  re-read only from the last consumed byte when they grow (a size drop or rewrite re-parses).
  Usage is deduped by `message.id` + `requestId` (Claude Code writes one line per content
  block), across files too (the oldest file keeps messages a resumed session copied), and
  `<synthetic>` messages are skipped. `/usage` only reads files modified in the range.
  Sessions link to the newest agent run with the same session id; a running Claude
  terminal maps to a session through `$CLAUDE_CONFIG_DIR/sessions/<pid>.json`, else to
  the newest unclaimed transcript with the terminal's cwd written since it started.
  A missing directory yields zeros and an empty list.
- `GET /v1/inbox`, `POST /v1/inbox/read` and `POST /v1/hooks/claude` (`services/inbox.ts`,
  `services/claude-hooks.ts`, table `inbox`): hook calls and agent-run outcomes become
  `permission`/`needs_input`/`completed`/`failed`/`status` items. An unread repeat of the same
  kind for the same session or agent run is bumped instead of added (`completed`/`failed` are
  one kind, so a run and its Stop hook make one item); `Stop`, `StopFailure`,
  `UserPromptSubmit` and a run's end mark the session's unread attention items read. Every
  change publishes `inbox.updated`; the newest 1 000 items are kept. Mapping table in
  `docs/architecture/controller.md`.
- `GET`/`POST /v1/push/devices` and `DELETE /v1/push/devices/:token` (`services/push.ts`,
  table `push_devices`) manage the phones' Expo push tokens. Unread `completed`, `failed`,
  `needs_input`, `permission` and `file` inbox items are posted to `TESSERACT_PUSH_URL` (default
  Expo's `https://exp.host/--/api/v2/push/send`, `off` disables) with
  `TESSERACT_EXPO_ACCESS_TOKEN` as optional bearer; one push per item per 15 s, and tokens Expo
  reports as `DeviceNotRegistered` are removed.
- Headless Claude gets the prompt on stdin (never argv) and no `CLAUDECODE`. `mode` picks
  `--permission-mode` (default `TESSERACT_CLAUDE_PERMISSION_MODE`). Non-audio attachments add
  `--add-dir $TESSERACT_WORKSPACE/.tesseract/uploads` and an "Attached files" list of absolute paths
  to the stdin prompt; audio attachments are only kept on the run (the transcript is the prompt).
- Uploads (`POST /v1/uploads`, base64 JSON, 20 MiB decoded, 28 MiB body) are stored as
  `$TESSERACT_WORKSPACE/.tesseract/uploads/<id>/<sanitized name>` (0700 dirs, 0600 files) with a
  row in `uploads`; uploads older than 30 days are pruned at startup.
  `GET /v1/uploads/:id/content` takes bearer auth or a ticket and answers single byte ranges.
- Speech-to-text (`POST /v1/transcriptions`, `services/transcriptions.ts`) picks the engine per
  request from `TESSERACT_STT_ENGINE` (`whisper.cpp` default, `auto`, `openai-compatible`, `none`):
  - whisper.cpp (local only): `TESSERACT_WHISPER_BIN` (default `whisper-cli`),
    `TESSERACT_WHISPER_MODELS_DIR` (default `/opt/whisper/models`, holds `ggml-<model>.bin`),
    `TESSERACT_WHISPER_MODEL` (fallback model path) and `TESSERACT_FFMPEG_BIN` (default `ffmpeg`).
    ffmpeg converts the voice note (AAC `.m4a`, wav, webm, mp3, ogg …) to 16 kHz mono WAV in a
    temp dir, then `whisper-cli -t <threads> -oj` runs; 5 min timeout per step. The image builds
    whisper.cpp with the `base` and `small` models by default (see sandbox-image.md).
  - Resource profiles (`GET`/`PUT /v1/stt`, stored in the `settings` table, initial
    `TESSERACT_STT_PROFILE=eco`): `off` (503), `eco` (base, 2 threads, `nice -n 19` + `ionice -c3`),
    `balanced` (base, max(2, cpus/4) threads, `nice -n 10`), `performance` (small,
    min(cpus, max(4, cpus/2)) threads). `cpus` respects the cgroup `cpu.max` quota. A missing
    profile model falls back to `TESSERACT_WHISPER_MODEL`. One transcription runs at a time (FIFO
    queue, `busy`/`queued` in the status); a profile change publishes `stt.updated`.
  - openai-compatible: `TESSERACT_STT_URL` (e.g. `https://api.openai.com/v1`,
    `https://api.groq.com/openai/v1`), `TESSERACT_STT_API_KEY`, `TESSERACT_STT_MODEL` (default
    `whisper-1`); multipart `POST <url>/audio/transcriptions` with `response_format=verbose_json`.
    The key is never logged and is redacted from provider errors.
  - `auto` uses whisper.cpp when binary, ffmpeg and model exist, else openai-compatible when URL
    and key are set, else 503 naming the variables. An empty transcript is 400 `No speech detected`.
  - `provider: "gemini"` sends the audio inline to Gemini (the key saved from the mobile or desktop app or
    `tesseract --gemini-key=KEY` with `PUT /v1/stt { geminiApiKey }`;
    `TESSERACT_GEMINI_STT_MODEL`, default `gemini-2.5-flash`) outside the queue and regardless of
    the profile. Without a key or when Gemini fails (quota, rejected key, network), the native
    engine answers and `fallbackReason` explains why. `bun run dev` loads the repo-root `.env`
    (`--env-file=../../.env`, ignored when missing).
- `POST /v1/agent/runs/archive` and `POST /v1/agent/runs/delete` act on finished runs only
  (running ones are skipped). Archived runs (`archivedAt`) are hidden from `GET /v1/agent/runs`
  unless `?archived=1`; deleting removes the run and its events and unlinks inbox items.
- Logs: `$TESSERACT_DATA_DIR/logs/<id>.log` as `<ts> <stream> <seq> <text>` lines, rotated
  at 5 MiB (one `.1` kept), plus a 2 000-line in-memory ring per live process/build.
- Restarting the controller never re-runs anything: live rows become `orphaned`
  (processes), `failed` (builds, agent runs) or `exited` (terminals). Orphaned
  processes may still be running; stop them by pid/port if needed.
- Port conflicts: `POST /v1/processes` with `port` probes 127.0.0.1 and ::1 and answers
  409 naming the tracked process that owns the port (declared, or found through /proc).
- Builds run one at a time (FIFO). Artifacts land in `$TESSERACT_WORKSPACE/artifacts` as
  `<project>-<platform>-<profile>-<version>.<ext>`; `-2`, `-3`… are appended instead of
  overwriting an earlier build. Shared files (`POST /v1/artifacts`, `tesseract-controller share`)
  keep their own name with the same suffixes; the platform comes from the extension
  (`.apk`/`.aab` android, `.exe`/`.msi` windows, `.deb`/`.rpm`/`.AppImage` linux, else `file`).
  Every share adds its own `file` inbox item (never bumped). `DELETE /v1/artifacts/:id` removes
  the file and row, publishes `artifact.deleted` and clears `artifactId` on the inbox items that
  announced it (their text stays).
- Taildrop (`services/taildrop.ts`): `GET /v1/taildrop/targets` maps LocalAPI `file-targets`
  (id = node `StableID`); no socket or any error gives `available: false`, never an error.
  `POST /v1/artifacts/:id/taildrop` streams the file with `PUT /localapi/v0/file-put/<id>/<name>`:
  no LocalAPI → 503, unknown target → 404, LocalAPI 403 → 403, other failures → 503. Tests serve
  a fake LocalAPI on a unix socket (`tests/share.test.ts`).
- The `/ui` pages are bundled without zod; their chunks are served at root paths
  (`/chunk-<hash>.js`, `.css`). They read `ticket`, `session`, `password` (and `viewOnly=1`
  for VNC) from the URL fragment, clear it, and talk to the embedding app through
  `window.ReactNativeWebView.postMessage` (or `parent.postMessage` in an iframe):
  `terminal-state`, `terminal-need-ticket`, `vnc-state`, `vnc-need-ticket`. The app answers
  a `*-need-ticket` message by calling `window.tesseract.reconnect(ticket)` (injected JS) or by
  posting `{ type: "tesseract-reconnect", ticket }` to the frame. These names and the page
  states (`connecting|connected|disconnected|exited|error`) live in `@tesseract/protocol/bridge`
  (`PAGE_MESSAGES`, `PAGE_STATES`), a zod-free module shared with the app.
