# TheOne — System Blueprint (v1 contract)

This file is the **single source of truth** for names, paths, ports, environment
variables and the controller protocol. Every component (mobile app, client SDK,
controller, sandbox image, compose stack, docs) is built against it. If an
implementation must deviate, update this file in the same change.

## 1. What we are building

A phone-controlled, sandboxed development machine.

```text
 ┌──────────────────────┐      Tailscale (WireGuard, tailnet only)
 │  Mobile app (Expo)   │ ─────────────────────────────────────────────┐
 │  apps/mobile         │                                              │
 └──────────────────────┘                                              ▼
                                  HOST (infrastructure only: Docker + disk)
                                  ┌──────────────────────────────────────────────┐
                                  │ compose project "theone" (default)           │
                                  │                                              │
                                  │  ┌───────────────┐  shared network namespace │
                                  │  │ tailscale     │◄───────────────┐          │
                                  │  │ (sidecar,     │  serve :443 ──►│          │
                                  │  │  userspace)   │  tcp  :5901 ──►│          │
                                  │  └───────────────┘                │          │
                                  │  ┌────────────────────────────────┴───────┐  │
                                  │  │ sandbox (Debian trixie)                │  │
                                  │  │  supervisord (runs as dev)             │  │
                                  │  │   ├─ Xvnc :1  (TigerVNC, rfb 5901)     │  │
                                  │  │   ├─ openbox (window manager)          │  │
                                  │  │   ├─ theone-controller :7700           │  │
                                  │  │   │    REST + WS + /ui (xterm, noVNC)  │  │
                                  │  │   └─ wine prefix init (oneshot)        │  │
                                  │  │  Claude Code, git, node, bun, python,  │  │
                                  │  │  JDK 17, Android SDK, wine, electron   │  │
                                  │  │  /workspace (volume)  /home/dev (vol)  │  │
                                  │  └────────────────────────────────────────┘  │
                                  │  ┌───────────────┐ (optional overlay file)   │
                                  │  │ docker (dind) │ DOCKER_HOST for sandbox   │
                                  │  └───────────────┘                           │
                                  └──────────────────────────────────────────────┘
```

* The **sandbox is the development machine**; the host only runs Docker.
* The **controller** is the only network-facing service. Everything the phone
  does (status, terminal, Claude, builds, VNC) goes through it.
* **Tailscale** is the only transport. Nothing is published on host interfaces
  in the default mode.

## 2. Monorepo layout

Package manager: **bun** workspaces (`bunfig.toml` → `linker = "hoisted"`, required by
React Native/Metro). TypeScript `~6.0`. No build step for internal packages:
they export TypeScript source (`exports: { ".": "./src/index.ts" }`).

```text
/
├── apps/
│   ├── mobile/          @theone/mobile      Expo SDK 56 / RN 0.85 / expo-router (existing app)
│   └── controller/      @theone/controller  Bun + Hono daemon that runs INSIDE the sandbox
├── packages/
│   ├── protocol/        @theone/protocol    zod v4 schemas + types + route helpers (the wire contract);
│   │                                        subpath exports ./bridge (zod-free) and ./fixtures
│   └── client/          @theone/client      typed REST/WS client used by mobile (runs in RN, browser, Bun)
├── infra/
│   ├── docker/sandbox/  Dockerfile + rootfs/ (supervisord confs, entrypoint, helpers, templates, openbox)
│   ├── compose/         compose.yml, compose.tailscale.yml, compose.local.yml, compose.dind.yml,
│   │                    compose.tailscale-api.yml, compose.tailscale-api-sidecar.yml,
│   │                    tailscale/serve.json, .env.example
│   ├── scripts/sandbox  operator CLI (bash): up|down|restart|logs|shell|pair|status|doctor|build|ps|config|help
│   ├── tests/           bats suites for the operator CLI, rootfs scripts and compose files (run in docker)
│   └── e2e/             end-to-end suite (bun test + harness `run`) against an isolated local stack
├── examples/
│   └── electron-hello/  tiny Electron + electron-builder app used for e2e build tests
│                        (NOT a workspace member — never installed on the host)
├── docs/                architecture/, adr/, runbooks/, archive/
├── SPEC.md              operating spec for the agent that runs inside the sandbox
├── package.json         workspaces + root scripts
├── bunfig.toml
└── tsconfig.base.json   shared compiler options for non-Expo packages
```

Root scripts: `bun run typecheck`, `bun run test`, `bun run lint` (fan out with
`bun run --filter '*'`), `bun run mobile`, `bun run controller:dev`,
`bun run controller:build`, `bun run sandbox <cmd>`, `bun run test:infra` (§11),
`bun run e2e` (§11).

Every workspace package has `typecheck` and `test` scripts. Adding a dependency
from an automated agent MUST go through `flock /tmp/theone-bun-install.lock bun add …`
(run inside the package directory) so parallel installs never race.

## 3. Fixed names, ports, paths

| Thing | Value |
|---|---|
| Compose project | `theone` (`THEONE_COMPOSE_PROJECT`; containers `<project>-<service>-1`) |
| Named volumes | `<prefix>-workspace`, `<prefix>-home`, `<prefix>-tailscale`, `<prefix>-tailscale-run` (sidecar LocalAPI socket, `--tailscale-api` only), `<prefix>-dind-certs`, `<prefix>-dind-data`; prefix = `THEONE_VOLUME_PREFIX`, default the project name (so `theone-*`) |
| Image | `theone/sandbox:latest` (`THEONE_IMAGE`) |
| Sandbox service / container hostname | `sandbox` (tailscale mode: the sidecar's hostname `THEONE_HOSTNAME`, because it joins the sidecar's network namespace) |
| Tailscale node hostname (default) | `theone-sandbox` (`THEONE_HOSTNAME`, also `THEONE_SANDBOX_ID`) |
| Controller listen | `0.0.0.0:7700` inside the sandbox netns (`THEONE_PORT`) |
| Host ports (local, host-tailscale) | `7700`, `5901` on `THEONE_BIND_ADDR` only (`THEONE_CONTROLLER_HOST_PORT`, `THEONE_VNC_HOST_PORT`) |
| X display | `:1` (`THEONE_DISPLAY`), default geometry `1600x900` (`THEONE_DISPLAY_GEOMETRY`) |
| VNC (RFB) | TCP `5901`, VncAuth (`THEONE_VNC_PASSWORD`; hash `/home/dev/.vnc/passwd`, generated plaintext `/home/dev/.vnc/password` 0600) |
| Tailscale LocalAPI socket (opt-in) | `/run/tailscale/tailscaled.sock` in the sandbox (`THEONE_TAILSCALE_SOCKET`), read-only mount of the host's `/var/run/tailscale` or the sidecar's `<prefix>-tailscale-run` volume (§9) |
| Per-start secrets | `/run/theone/controller.env` (0600, dev): VNC password and, if set, `THEONE_TOKEN`; read only by `theone-controller-run` |
| supervisord | socket `/run/supervisor/supervisor.sock` (0700, dev), logs `/workspace/.agent/logs/supervisor/` |
| Sandbox user | `dev` (uid/gid `1000` by default, build args `DEV_UID`/`DEV_GID`) |
| Workspace | `/workspace` (volume `<prefix>-workspace`) |
| Projects | `/workspace/projects/<projectId>` |
| Artifacts | `/workspace/artifacts/<project>-<platform>-<profile>-<version>.<ext>` for builds, `/workspace/artifacts/<file name>` for shared files (`-2`, `-3`… before the extension on collision) |
| Uploads | `/workspace/.theone/uploads/<uploadId>/<sanitized name>` (dirs 0700, files 0600; `POST /v1/uploads`), rows and files older than 30 days removed at startup |
| Agent memory | `/workspace/.agent/` (§6.4, SPEC.md) |
| Controller data | `/workspace/.agent/controller/` (`THEONE_DATA_DIR`, 0700) → `state.db`, `token`, `logs/`, `sync/`, `claude-import.json` |
| Claude credentials | the host's `~/.claude` bind-mounted at `/home/dev/.claude` (`CLAUDE_CONFIG_DIR`): login (`.credentials.json`), settings, CLAUDE.md; the only supported credential source (the host's Claude Max subscription login) |
| Home | `/home/dev` (volume `<prefix>-home`: wine prefix, caches; `.claude` is the host bind mount above) |
| Wine prefix | `/home/dev/.wine` (`WINEPREFIX`), `WINEARCH=win64`, `WINEDEBUG=-all` |
| Android SDK | `/opt/android-sdk` (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, owned by `dev`) |
| Java | `/opt/java/openjdk` (Temurin 17, `JAVA_HOME`) |
| Controller binary | `/usr/local/bin/theone-controller` (built with `bun build --compile`) |
| Browser pages | `/ui/terminal`, `/ui/vnc`; their bundled assets are served at root paths (`/chunk-<hash>.js`, `.css`) |
| Mobile deep link | `theone://pair?url=<encoded base url>&token=<token>&name=<label>` |

`projectId` = directory name under `/workspace/projects`, must match
`^[a-z0-9][a-z0-9._-]{0,63}$` (case-insensitive input is lower-cased). Paths are
always resolved (`realpath`) and verified to stay under the workspace.

## 4. Environment variables

### 4.1 Controller

| Var | Default | Meaning |
|---|---|---|
| `THEONE_HOST` | `0.0.0.0` | bind address |
| `THEONE_PORT` | `7700` | HTTP/WS port (`0` = ephemeral, tests) |
| `THEONE_WORKSPACE` | `/workspace` | workspace root |
| `THEONE_DATA_DIR` | `$THEONE_WORKSPACE/.agent/controller` | sqlite, token, logs |
| `THEONE_TOKEN` | — | bearer token; if unset, read `THEONE_TOKEN_FILE`. When set, it is also written to `THEONE_TOKEN_FILE` so the in-sandbox CLI works without the variable |
| `THEONE_TOKEN_FILE` | `$THEONE_DATA_DIR/token` | generated on first start (32 random bytes, base64url, mode 0600) |
| `THEONE_PUBLIC_URL` | `http://127.0.0.1:$THEONE_PORT` | URL the phone should use (tailscale: `https://<host>.<tailnet>.ts.net`) — used for pairing links only |
| `THEONE_DISPLAY` | `:1` | X display for GUI processes/screenshots |
| `THEONE_VNC_HOST` / `THEONE_VNC_PORT` | `127.0.0.1` / `5901` | RFB target for the WS bridge |
| `THEONE_VNC_PASSWORD` | — | returned to authenticated clients so noVNC can log in |
| `THEONE_CHROMIUM_DEBUG_PORT` | `9222` | Chromium DevTools port on `127.0.0.1` read by `GET /v1/display/browser`; `/etc/chromium.d/theone` starts Chromium with `--remote-debugging-address=127.0.0.1 --remote-debugging-port=$THEONE_CHROMIUM_DEBUG_PORT --user-data-dir=$HOME/.config/chromium-theone` (Chromium 136+ refuses remote debugging on the default profile) |
| `THEONE_CLAUDE_BIN` | `claude` | Claude Code executable |
| `THEONE_CLAUDE_PERMISSION_MODE` | `bypassPermissions` | passed to headless Claude runs (the container is the boundary) |
| `CLAUDE_CONFIG_DIR` | `$HOME/.claude` | Claude Code config dir; `GET /v1/usage` and `GET /v1/sessions` read its `projects/<encoded-cwd>/<sessionId>.jsonl` transcripts and `sessions/<pid>.json`; a missing dir means no usage. `/v1/claude/*` read and write its `.credentials.json` and `settings.json`, and the global config `$CLAUDE_CONFIG_DIR/.claude.json` when the variable is set, else `$HOME/.claude.json` (Claude Code's rule) |
| `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` | — | not configured by the stack (Claude auth is the host's Max login only); if set manually anyway, `GET /v1/claude/auth` still reports them (`sources`, `oauthTokenFromEnv`) and children inherit them as usual |
| `THEONE_SANDBOX_ID` | container hostname | identity shown in the app |
| `THEONE_TAILSCALE_SOCKET` | `/run/tailscale/tailscaled.sock` | tailscaled LocalAPI socket for `GET /v1/identity`; missing socket = Tailscale identity unavailable |
| `THEONE_LOG_LEVEL` | `info` | `debug|info|warn|error` |
| `THEONE_CORS_ORIGINS` | `*` | comma list; auth is header/ticket based, never cookies |
| `SHELL` | `bash` | login shell for `shell` terminals (`$SHELL -l`) |
| `THEONE_STT_ENGINE` | `whisper.cpp` | speech-to-text for `POST /v1/transcriptions`: `whisper.cpp` (local only, never calls a paid API) \| `auto` \| `openai-compatible` \| `none`. `auto` = whisper.cpp when its binary, ffmpeg and a model file exist, else openai-compatible when `THEONE_STT_URL` and `THEONE_STT_API_KEY` are set, else 503 naming these variables. Checked per request |
| `THEONE_STT_PROFILE` | `eco` | initial resource profile (`off` \| `eco` \| `balanced` \| `performance`, see `GET /v1/stt`); a profile chosen with `PUT /v1/stt` is stored in the database and wins |
| `THEONE_WHISPER_BIN` | `whisper-cli` (image: `/opt/whisper/bin/whisper-cli`) | whisper.cpp CLI |
| `THEONE_WHISPER_MODELS_DIR` | `/opt/whisper/models` | absolute dir the profiles load `ggml-<model>.bin` from |
| `THEONE_WHISPER_MODEL` | — (image: `/opt/whisper/models/ggml-model.bin`) | absolute path of the fallback ggml model, used when the profile's model is missing from `THEONE_WHISPER_MODELS_DIR` |
| `THEONE_FFMPEG_BIN` | `ffmpeg` | converts audio to 16 kHz mono WAV for whisper.cpp |
| `THEONE_STT_URL` | — | OpenAI-compatible base URL (`http(s)`, no credentials/query), e.g. `https://api.openai.com/v1`, `https://api.groq.com/openai/v1`; the controller posts to `<url>/audio/transcriptions` |
| `THEONE_STT_API_KEY` | — | bearer key for `THEONE_STT_URL`; never logged, never passed to children (optional with `THEONE_STT_ENGINE=openai-compatible`, e.g. a local server) |
| `THEONE_STT_MODEL` | `whisper-1` | model field of the OpenAI-compatible request (e.g. `whisper-large-v3-turbo` on Groq) |
| `THEONE_PUSH_URL` | `https://exp.host/--/api/v2/push/send` | Expo push API used for inbox pushes (`http(s)`, no credentials/query); `off` disables pushes |
| `THEONE_EXPO_ACCESS_TOKEN` | — | optional Expo access token, sent as `Authorization: Bearer` when Expo's enhanced push security is on |
| `THEONE_APNS_KEY_FILE` | — | absolute path of the APNs auth key (`AuthKey_<KEYID>.p8`) used for Live Activity (Dynamic Island) pushes; with `THEONE_APNS_KEY_ID` and `THEONE_APNS_TEAM_ID` it enables them, setting only some of the three stops startup, none = tokens are stored but nothing is sent ([runbook](../runbooks/live-activities.md)) |
| `THEONE_APNS_KEY_ID` | — | id of that key (1-64 letters/digits) |
| `THEONE_APNS_TEAM_ID` | — | Apple developer team id (1-64 letters/digits) |
| `THEONE_APNS_BUNDLE_ID` | `com.kevinbpract.theone` | bundle id of the app; the `apns-topic` is `<bundle id>.push-type.liveactivity`. The development build (`APP_VARIANT=development`, see [getting started](../runbooks/getting-started.md)) is `com.kevinbpract.theone.dev` |
| `THEONE_APNS_ENV` | `production` | `production` (`api.push.apple.com`) or `sandbox` (`api.sandbox.push.apple.com`, development builds) |

Invalid values stop startup with a clear message. The controller must run on a
developer laptop too (for tests): every sandbox dependency (X display, VNC,
claude, wine, java) is optional and reported as unavailable instead of crashing.

Children (processes, build steps, terminals, agent runs, git/zip helpers) get the
controller's environment **without** `THEONE_TOKEN`, `THEONE_VNC_PASSWORD` and `THEONE_STT_API_KEY`, plus
`THEONE_PROCESS_ID` / `THEONE_BUILD_ID` / `THEONE_TERMINAL_ID` / `THEONE_AGENT_RUN_ID`.
Agent runs also drop `CLAUDECODE`. The controller does not store or inject Claude
credentials: children use the host's Claude Max login in `/home/dev/.claude` (the host's
`~/.claude`, bind-mounted), the only supported authentication.

### 4.2 Stack and operator (`infra/compose/.env`, `infra/scripts/sandbox`)

Compose interpolates these; a container receives only the variables its compose file
lists. Exported shell variables win over the env file; empty counts as unset.

| Var | Default | Meaning |
|---|---|---|
| `THEONE_MODE` | `tailscale` | `tailscale` \| `host-tailscale` \| `local` (§9); `--mode` wins |
| `THEONE_DIND` | — | `1` adds `compose.dind.yml` (same as `--dind`) |
| `THEONE_TAILSCALE_LOCALAPI` | — | `1` shares the tailscaled LocalAPI socket with the sandbox (same as `--tailscale-api`, §9) |
| `THEONE_TAILSCALE_HOST_SOCKET_DIR` | `/var/run/tailscale` | host directory holding `tailscaled.sock` (host-tailscale/local with `--tailscale-api`); `up` refuses when the socket is missing |
| `THEONE_COMPOSE_PROJECT` | `theone` | compose project name (`[a-z0-9][a-z0-9_-]*`) |
| `THEONE_VOLUME_PREFIX` | `$THEONE_COMPOSE_PROJECT` | prefix of every named volume |
| `THEONE_IMAGE` | `theone/sandbox:latest` | image the stack runs and `sandbox build` tags |
| `THEONE_HOSTNAME` | `theone-sandbox` | tailnet node name, `THEONE_SANDBOX_ID` |
| `TS_AUTHKEY` | — | first login of the sidecar only (`TS_AUTH_ONCE=true`) |
| `TS_TAILNET_DOMAIN` | — | e.g. `tail1234.ts.net`; required in tailscale mode, builds `THEONE_PUBLIC_URL` |
| `TS_EXTRA_ARGS` | — | extra `tailscale up` flags |
| `THEONE_BIND_ADDR` | host-tailscale: `tailscale ip -4`; local: `127.0.0.1` | IPv4 the ports are published on; wildcards and non-IPv4 values are refused |
| `THEONE_CONTROLLER_HOST_PORT` / `THEONE_VNC_HOST_PORT` | `7700` / `5901` | host side of the published ports; `THEONE_PUBLIC_URL` follows |
| `THEONE_TOKEN`, `THEONE_VNC_PASSWORD`, `THEONE_LOG_LEVEL`, `THEONE_CLAUDE_PERMISSION_MODE`, `THEONE_CORS_ORIGINS` | as §4.1 | passed to the sandbox |
| `THEONE_STT_ENGINE`, `THEONE_STT_PROFILE`, `THEONE_STT_URL`, `THEONE_STT_API_KEY`, `THEONE_STT_MODEL`, `THEONE_WHISPER_MODELS_DIR`, `THEONE_WHISPER_MODEL` | as §4.1 | passed to the sandbox; the entrypoint moves `THEONE_STT_API_KEY` into `/run/theone/controller.env` like `THEONE_TOKEN` |
| `THEONE_DISPLAY_GEOMETRY` | `1600x900` | Xvnc geometry |
| `THEONE_HOST_CLAUDE_DIR` | `$HOME/.claude` | host dir bind-mounted at `/home/dev/.claude`: the host's Claude Max login is the sandbox's only Claude credential (`ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` are not passed through) |
| `SANDBOX_CPUS` / `SANDBOX_MEMORY` / `SANDBOX_PIDS` | `4` / `8g` / `4096` | sandbox limits |
| `DIND_CPUS` / `DIND_MEMORY` / `DIND_PIDS` | `4` / `8g` / `4096` | dind limits (cap everything it runs) |
| `TZ` | `UTC` | sandbox time zone |
| `DEV_UID`, `DEV_GID`, `WITH_ANDROID`, `WITH_MONO`, `CLAUDE_CODE_VERSION`, `WITH_WHISPER`, `WHISPER_MODELS` | §8 | build args passed by compose (compose defaults `WITH_WHISPER=true`, `WHISPER_MODELS="base small"`) |

Image-provided environment: `THEONE_IMAGE_VERSION`, `THEONE_WORKSPACE`,
`THEONE_HOST`, `THEONE_PORT`, `THEONE_DATA_DIR`, `THEONE_VNC_HOST`, `THEONE_DISPLAY`,
`THEONE_DISPLAY_GEOMETRY`, `THEONE_VNC_PORT`, `XDG_RUNTIME_DIR=/run/user/<uid>`,
`WINEPREFIX`/`WINEARCH`/`WINEDEBUG`, `APPIMAGE_EXTRACT_AND_RUN=1`, `DISABLE_AUTOUPDATER=1`,
`JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `THEONE_WHISPER_BIN`, `THEONE_WHISPER_MODELS_DIR`, `THEONE_WHISPER_MODEL`. `DISPLAY` is not set globally: only
interactive login shells get `DISPLAY=:1` (`/etc/profile.d/theone.sh`). Rootfs helper
knob: `THEONE_WAIT_X_TIMEOUT` (s, default 60).

## 5. Controller protocol v1

`PROTOCOL_VERSION = 1`. JSON over HTTPS; all REST paths are under `/v1`.

### 5.1 Auth and errors

* REST: `Authorization: Bearer <token>`; constant-time compare. Only
  `GET /v1/health` is public. 401 responses carry `WWW-Authenticate: Bearer realm="theone"`.
* WebSocket and browser-opened URLs (WebView pages, artifact downloads, upload content) use a
  **one-time ticket**: `POST /v1/auth/ticket` → `200 { ticket, expiresAt }`
  (random 32 bytes, valid 60 s, consumed on first use, not scoped to a target).
  WS URLs take `?ticket=`; a ticket is never accepted as a bearer token.
* Browser pages under `/ui/*` are static and secret-free; they read
  `ticket`/`password`/`session`/`viewOnly`/`input` from the **URL fragment** (`#…`, never sent
  to the server), clear it, and then open the WS with `?ticket=`.
* Errors: HTTP status + `{ "error": { "code": string, "message": string } }`.
  Codes → status: `bad_request` 400, `unauthorized` 401, `forbidden` 403,
  `not_found` 404, `conflict` 409, `internal` 500, `unavailable` 503. Exceptions:
  bodies over 1 MiB (8 MiB for `POST /v1/claude/import`, 28 MiB for `POST /v1/uploads`, 1 GiB for `POST /v1/projects/:id/sync`) get **413** with code `bad_request`; a plain GET (no upgrade) on a
  WS-only path gets 400.

### 5.2 REST endpoints

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/v1/health` | — | `Health { ok, version, protocolVersion, sandboxId }` |
| POST | `/v1/auth/ticket` | — | `200 Ticket { ticket, expiresAt }` |
| GET | `/v1/status` | — | `SandboxStatus` |
| GET | `/v1/identity` | — | `Identity`: Tailscale viewer, owner, node and tailnet (§5.4); never fails because Tailscale is unreachable, it reports `available: false` and nulls |
| GET | `/v1/claude/auth` | — | `ClaudeAuthStatus` (§5.4): which credential the sandbox's Claude Code uses (`method` = first of `oauth_token`, `credentials`, `api_key`, else `none`), account from the global config's `oauthAccount`, subscription and expiry from `.credentials.json`; never contains a secret |
| POST | `/v1/claude/import` | `ClaudeImport { credentials?, account?, files? }` (body limit 8 MiB) | `200 ClaudeImportResult { status, written, skipped }`: `credentials` replaces `claudeAiOauth` in `.credentials.json` (other keys kept); `account` merges only `CLAUDE_IMPORT_ACCOUNT_KEYS` into the global config (`projects` etc. kept); `files` must be normalized relative paths matching `CLAUDE_IMPORT_PATHS` that stay in `$CLAUDE_CONFIG_DIR` without symlinks leading out; `settings.json` must be a JSON object and loses `CLAUDE_IMPORT_DROPPED_SETTINGS` (`settings.json#<key>` in `skipped`). Files are written atomically; `settings.json`, `.credentials.json` and the global config are first copied to `<file>.theone-bak`. `written`/`skipped` paths are relative to `$CLAUDE_CONFIG_DIR`; the global config is `.claude.json` (inside it) or `~/.claude.json`. Refused parts go to `skipped`; only schema errors are 400 |
| GET | `/v1/context` | — | `AgentContext { files: AgentContextFile[] }`: regular files `.agent/*.md` and `.agent/projects/<id>/*.md` (no symlinks, FIFOs or devices), content capped at 64 KiB each |
| GET | `/v1/projects` | — | `Project[]` |
| POST | `/v1/projects` | `CreateProject { name, gitUrl?, branch? }` | `201 { project, processId? }` (clone runs as a tracked process); 409 if the directory exists |
| GET | `/v1/projects/:id` | — | `Project` |
| POST | `/v1/projects/:id/sync` | tar archive body, `Content-Type` `application/x-tar` or `application/gzip` (body limit 1 GiB) | `201 Project` when the directory was created, else `200 Project`: extracts with `tar --no-same-owner` over `/workspace/projects/<id>`; files missing from the archive are kept; a bad archive is 400 (a directory created for it is removed), another content type 400; publishes `project.updated`. Sent by `monolith --sync` (desktop), which archives the cwd (in a git checkout: tracked and unignored files, plus `.git` at the top level) |
| GET | `/v1/projects/:id/git` | — | `GitDetails { branch, ahead, behind, files: GitFileStatus[], log: GitCommit[] }` |
| GET | `/v1/projects/:id/sync/changes` | — | `SyncChanges`: current tree vs the baseline recorded by the last push ([sync-back.md](sync-back.md)); 404 unknown project |
| POST | `/v1/projects/:id/sync/export` | `SyncExport { paths: SyncPath[] (1–5000) }`, each a current `added`/`modified` change | `200 application/gzip` tar of those files (regular files and symlinks only); 400 for a path that is not a current change |
| POST | `/v1/projects/:id/sync/ack` | `SyncAck { changes: { path, sha256 \| null, executable? }[] }` | `200 SyncChanges`; moves the baseline entries to the acked hashes and executable bits (null removes; `executable` omitted: the sandbox file's, when its hash matches); publishes `sync.changed` |
| GET | `/v1/projects/:id/sync/requests` | — | `SyncRequest[]` newest first (last 50) |
| POST | `/v1/projects/:id/sync/requests` | `CreateSyncRequest { kind: "pull" \| "revert", paths?, force?, source? }` | `201 SyncRequest`; 409 while a `pending`/`claimed` request exists; 400 for `pull` without a baseline; publishes `sync.updated` |
| GET | `/v1/sync/requests?status=` | — | `SyncRequest[]` across projects (desktop polls `status=pending`) |
| POST | `/v1/sync/requests/:id/claim` | `ClaimSyncRequest { host }` | `200 SyncRequest` (`claimed`); 409 unless `pending`; publishes `sync.updated` |
| POST | `/v1/sync/requests/:id/complete` | `CompleteSyncRequest { status: "applied" \| "failed", result?, error? }` | `200 SyncRequest`; 409 unless `claimed`; publishes `sync.updated` |
| POST | `/v1/sync/requests/:id/cancel` | — | `200 SyncRequest` (`cancelled`); 409 unless `pending`; publishes `sync.updated` |
| POST | `/v1/sync/heartbeat` | `SyncHeartbeat { host, projects: ProjectId[] }` | `204`; remembers the host per linked project for `SyncChanges.host` (online = seen in the last 60 s) |
| GET | `/v1/processes` | `?projectId=` | `ProcessInfo[]` |
| POST | `/v1/processes` | `StartProcess { projectId, command, name?, env?, display?, port? }` | `201 ProcessInfo`; 409 when `port` is taken (message names the tracked process or pid) |
| GET | `/v1/processes/:id` | — | `ProcessInfo` |
| DELETE | `/v1/processes/:id` | — | `ProcessInfo` (§6.2) |
| GET | `/v1/processes/:id/logs` | `?tail=500` (1–2000) | `LogLine[]` |
| GET | `/v1/terminals` | — | `TerminalInfo[]` of the current controller lifetime (newest first) |
| POST | `/v1/terminals` | `CreateTerminal { kind: "shell"\|"claude", projectId?, cols, rows }` | `201 TerminalInfo`; 503 if `claude` or PTY support is missing |
| DELETE | `/v1/terminals/:id` | — | `TerminalInfo` |
| GET | `/v1/builds` | `?projectId=` | `BuildJob[]` |
| POST | `/v1/builds` | `StartBuild { projectId, target, profile? }` (`profile` default `debug`) | `201 BuildJob`; 400 if the project lacks the target; 503 if the recipe needs `wine`/`java` and it is missing |
| GET | `/v1/builds/:id` | — | `BuildJob` |
| DELETE | `/v1/builds/:id` | — | `BuildJob` (cancel) |
| GET | `/v1/builds/:id/logs` | `?tail=500` | `LogLine[]` |
| GET | `/v1/artifacts` | `?projectId=` | `Artifact[]` |
| POST | `/v1/artifacts` | `ShareArtifact { path (absolute), projectId?, name?, note? (≤ 500), agentRunId?, sessionId? }` | `201 Artifact` (`source: "agent"`): copies a regular file inside `/workspace` (realpath; not under `artifacts/` or `THEONE_DATA_DIR` → 403) into the artifacts dir under its own name or `name`; `projectId` defaults to the project containing the path (none → 400; unknown explicit id → 404); `platform` from the extension (`.apk`/`.aab` android, `.exe`/`.msi` windows, `.deb`/`.rpm`/`.AppImage` linux, else `file`); an unknown `agentRunId` is dropped; publishes `artifact.created` and adds a `file` inbox item (never bumped) with `artifactId`. Sent by `theone-controller share` |
| DELETE | `/v1/artifacts/:id` | — | `Artifact` (deleted): removes the file and row, clears `artifactId` on inbox items (their text stays), publishes `artifact.deleted` |
| GET | `/v1/artifacts/:id/download` | bearer **or** `?ticket=` | file stream (`Content-Disposition: attachment`, `X-Content-SHA256`); 404 if the file is gone |
| GET | `/v1/taildrop/targets` | — | `TaildropTargets { available, targets: TaildropTarget[] }` from LocalAPI `file-targets`, sorted by host name; `available: false` with no targets when the LocalAPI socket is missing or fails (never an error) |
| POST | `/v1/artifacts/:id/taildrop` | `SendArtifact { targetId }` | `Artifact` once LocalAPI `file-put` accepted the file; 503 without the LocalAPI or when the push fails, 404 for an unknown target, 403 when tailscaled refuses |
| GET | `/v1/ports` | — | `ListeningPorts { tailscaleIp, ports: ListeningPort[] }`: TCP ports that visible sandbox processes listen on (not the controller or VNC port), each `{ port, pid, command, processId, projectId, url, dnsUrl }`; `url` is `http://<sandbox Tailscale IPv4>:<port>`, which reaches the port over the tailnet because the userspace sidecar forwards to `127.0.0.1`; both URLs are null without Tailscale |
| GET | `/v1/usage?days=` | — | `UsageReport { generatedAt, from, to, days, totals, daily, models, projects }` from Claude Code transcripts: `days` 1–90 (default 30) UTC days ending today, `daily` has every day oldest first (zero-filled), `models`/`projects` most tokens first; assistant messages are deduped by message id + request id (also across resumed-session files), `<synthetic>` messages are skipped, only files modified in the range are read; token counts only, no dollar cost; never fails because the directory is missing |
| GET | `/v1/sessions?limit=&projectId=` | — | `ClaudeSession[]` (default 20, max 200), newest `lastActiveAt` first: title (first real prompt, ≤120 chars), preview (last assistant text, ≤160), model, usage (including subagent transcripts), `source` `agent-run`/`terminal`/`cli`, `agentRunId` (newest run with the session id), `terminalId` (running Claude terminal: `$CLAUDE_CONFIG_DIR/sessions/<pid>.json`, else the newest transcript with the terminal's cwd written since it started), `active` (run running or terminal attached) |
| GET | `/v1/inbox?limit=&unread=` | — | `Inbox { items: InboxItem[], unreadCount, attentionCount }`, newest `updatedAt` first (default 100, max 500; `unread=1`/`true` → unread only); `attentionCount` = unread `needs_input` + `permission` |
| POST | `/v1/inbox/read` | `MarkInboxRead { ids: InboxId[] } \| { all: true }` | `200 InboxCounts { unreadCount, attentionCount }`; unknown ids are ignored |
| POST | `/v1/hooks/claude` | `ClaudeHookPayload` (the Claude Code hook JSON, extra fields kept) | `202`; maps `Notification`/`Stop`/`StopFailure`/`UserPromptSubmit` to inbox items (controller.md "Inbox and Claude hooks"); other events are ignored. Sent by `theone-controller hook` |
| GET | `/v1/push/devices` | — | `PushDevice[]`, newest `updatedAt` first |
| POST | `/v1/push/devices` | `RegisterPushDevice { token (Expo push token), platform: "ios" \| "android", name? (≤ 128) }` | `200 PushDevice`; upserts by token (a re-registered token keeps `createdAt`). Unread `completed`/`failed`/`needs_input`/`permission`/`file` inbox items are then pushed to every device through `THEONE_PUSH_URL` (controller.md "Inbox and Claude hooks") |
| DELETE | `/v1/push/devices/:token` | — | `PushDevice` (removed); invalid token → 400, unknown → 404 |
| GET | `/v1/push/live-activities` | — | `LiveActivityToken[]`, newest `updatedAt` first |
| POST | `/v1/push/live-activities` | `RegisterLiveActivity { kind: "activity" \| "push-to-start", token (hex, 32-512 chars), activityId? (≤ 128, null for push-to-start) }` | `200 LiveActivityToken`; upserts by token (stored lower-case, `createdAt` kept). The controller then mirrors `IslandState` into the phone's Live Activity through ActivityKit pushes when `THEONE_APNS_*` is set (controller.md "Live Activities") |
| DELETE | `/v1/push/live-activities/:token` | — | `LiveActivityToken` (removed); invalid token → 400, unknown → 404 |
| GET | `/v1/display` | — | `DisplayStatus` |
| GET | `/v1/display/screenshot` | — | `image/png` of the virtual display; 503 without a display |
| GET | `/v1/display/browser` | — | `BrowserStatus { available, tabs: BrowserTab[] }`: Chromium `page` targets from the DevTools endpoint `http://127.0.0.1:$THEONE_CHROMIUM_DEBUG_PORT/json/list` (1.5 s timeout, `devtools://` pages dropped), in Chromium's order so `tabs[0]` is the current tab; `phoneUrl` rewrites an http(s) URL whose host is `localhost`, `*.localhost`, `127.0.0.0/8`, `0.0.0.0` or `[::1]` to the sandbox Tailscale IPv4 (else its MagicDNS name, as `/v1/ports`) keeping port/path/query/hash, passes other http(s) URLs through, and is null for other schemes or local URLs without Tailscale; an unreachable endpoint is `{ available: false, tabs: [] }`, never an error |
| GET | `/v1/agent/runs` | `?projectId=&archived=` | `AgentRun[]` newest first (max 200): without `archived` (or `0`/`false`) only runs that are not archived, with `archived=1`/`true` only archived ones; running runs are never archived |
| POST | `/v1/agent/runs` | `StartAgentRun { projectId?, prompt, mode?, attachmentIds?, resumeSessionId? }` | `201 AgentRun`; 503 without `claude`; 404 for an unknown attachment. `mode` → `--permission-mode` (else `THEONE_CLAUDE_PERMISSION_MODE`; stored as `null`). Attachments are stored on the run as full `Upload`s; for non-audio ones the run gets `--add-dir <uploads dir>` and the stdin prompt gains `\n\nAttached files (read them with the Read tool):\n- <path> (<mimeType>)` lines. Audio attachments are not listed (the transcript is the prompt); they stay on the run for replay |
| POST | `/v1/uploads` | `CreateUpload { name, mimeType, data /* base64 */ }` (body limit 28 MiB) | `201 Upload`; 400 for invalid base64, an empty file or more than 20 MiB decoded. `name` → last path segment without control characters or leading dots, ≤ 200 UTF-8 bytes (extension kept), fallback `upload`; `mimeType` → lower-cased essence (`application/octet-stream` when malformed); `kind` = `image` (`image/*`), `pdf` (`application/pdf`), `audio` (`audio/*`), else `file` |
| GET | `/v1/uploads/:id/content` | bearer **or** `?ticket=` | file stream with the stored `Content-Type`, `Content-Disposition` `inline` (image/pdf/audio) or `attachment` (file), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`; single `Range: bytes=` requests get 206 (players that issue several range requests need bearer auth, a ticket is single-use); 404 if the file is gone |
| POST | `/v1/transcriptions` | `CreateTranscription { uploadId, language? }` | `200 Transcription { uploadId, text, language, durationMs, engine }`; 404 unknown upload, 400 not audio, invalid `language` (ISO-639-1, region suffix dropped, `auto` = detect) or `No speech detected` (empty after dropping `[BLANK_AUDIO]`-style markers), 503 when the STT profile is `off` (`Speech-to-text is off (select a profile in the desktop app)`), when no engine is configured or it fails (message says which env vars to set). One transcription runs at a time; others wait in FIFO order (`busy`/`queued` in `GET /v1/stt`). whisper.cpp: `[ionice -c3] [nice -n <nice>]` prefix per profile (skipped when the binary is missing), ffmpeg → 16 kHz mono WAV in a temp dir, `whisper-cli -m <model> -t <threads> -l <lang\|auto> -oj`, 5 min timeout each, `durationMs` from the WAV. openai-compatible: multipart `file`, `model`, `response_format=verbose_json`, `language?` with `Authorization: Bearer`, 5 min timeout; a non-JSON reply is used as plain text |
| GET | `/v1/stt` | — | `SttStatus`: selected profile, every profile's tuning and whether its model file exists, the engine and model a transcription would use now (`ready`/`reason`), `cpus` (`os.availableParallelism()` capped by the cgroup v2 `cpu.max` quota), `busy`, `queued` |
| PUT | `/v1/stt` | `UpdateStt { profile: SttProfile }` | `200 SttStatus`; stores the profile in the `settings` table (key `stt.profile`) and publishes `stt.updated` when it changed; 400 for an unknown profile |
| POST | `/v1/agent/runs/archive` | `ArchiveAgentRuns { ids: AgentRunId[] (1–500), archived: boolean } \| { all: true, archived: boolean, projectId? }` | `200 { count }` = runs whose archived state changed; `archived: true` sets `archivedAt` to now, `false` clears it; `all` covers every finished run (of `projectId`); running runs and unknown ids are skipped; publishes `agent.updated` per changed run |
| POST | `/v1/agent/runs/delete` | `DeleteAgentRuns { ids: AgentRunId[] (1–500) } \| { all: true, projectId?, archived?: boolean }` | `200 { count }` = runs deleted for good with their events (one transaction; inbox items keep their row with `agentRunId: null`); `all` covers every finished run, only archived ones with `archived: true`, only non-archived ones with `false`; running runs and unknown ids are skipped; publishes `agent.deleted` when `count > 0` |
| GET | `/v1/agent/runs/:id` | — | `AgentRun & { events: AgentRunEvent[] }` |
| DELETE | `/v1/agent/runs/:id` | — | `AgentRun` (cancel) |
| POST | `/v1/events` | `StatusEvent` (without `ts`) | `202` — lets the in-sandbox agent publish SPEC §8.1 status events |

`command` in `StartProcess` is `string` (run via `bash -lc` in the project dir)
or `string[]` (exec directly). `display: true` sets `DISPLAY=$THEONE_DISPLAY`.
CORS allows `GET, POST, DELETE` with `Authorization, Content-Type` and exposes
`Content-Disposition, X-Content-SHA256`.

### 5.3 WebSocket endpoints (all `?ticket=`)

| Path | Direction / frames |
|---|---|
| `/v1/events` | server → client JSON `ServerEvent` (see 5.4), first frame `hello`; server sends `{type:"ping"}` every 25 s, client may send `{type:"pong"}` (`EventsClientMessage`) |
| `/v1/terminals/:id/stream` | client → server JSON `TerminalClientMessage`: `{type:"input",data}` · `{type:"resize",cols,rows}`; server → client JSON `TerminalServerMessage`: `{type:"output",data}` · `{type:"exit",code}`. On attach the server first replays the scrollback (≤ 256 KiB) as one `output` message. Sessions survive client disconnects. |
| `/v1/processes/:id/logs/stream` | server → client `ProcessLogStreamMessage`: `{type:"log", line: LogLine}` · `{type:"exit", code}` (replays last 200 lines first) |
| `/v1/builds/:id/logs/stream` | `LogStreamMessage`: first `{type:"build", build}`, then the replay, `log` lines, `build` on every state/stage change, `exit` |
| `/v1/agent/runs/:id/stream` | server → client `{type:"event", event: AgentRunEvent}` · `{type:"run", run: AgentRun}` (replays prior events first) |
| `/v1/display/vnc` | **binary** RFB bridge to `THEONE_VNC_HOST:THEONE_VNC_PORT` (echo `Sec-WebSocket-Protocol: binary` when offered; used by noVNC) |

Upgrades fail with 401 (missing/used/expired ticket), 404 (unknown target) or
400 (not an upgrade). Log, run and terminal streams close with **1000** once their
target has ended; 1011 means the stream could not be set up. A socket whose
send buffer exceeds 16 MiB is closed by the server (abnormal close): clients
reconnect with a fresh ticket and rely on the replay. Client frames are capped at 1 MiB.

### 5.4 Core types (authoritative names; zod schemas live in `@theone/protocol`)

```ts
type Health = { ok: true; version: string; protocolVersion: 1; sandboxId: string };
type Ticket = { ticket: string; expiresAt: string /* ISO */ };

type ToolVersion = { name: string; version: string | null };   // node, bun, git, python3, java, wine, claude, adb …
type DisplayStatus = {
  display: string; available: boolean; width: number | null; height: number | null;
  vnc: { available: boolean; port: number; password: string | null };   // available = an RFB banner was read
  webPath: "/ui/vnc";
};
type BrowserTab = { id: string; title: string; url: string; phoneUrl: string | null };  // phoneUrl: opens over the tailnet
type BrowserStatus = { available: boolean; tabs: BrowserTab[] };                        // tabs[0] = current tab
type SandboxStatus = {
  sandboxId: string; hostname: string; version: string; startedAt: string; uptimeSec: number;
  resources: {
    cpu: { cores: number; load1: number; load5: number; load15: number };     // cgroup-aware
    memory: { totalBytes: number; usedBytes: number };                        // cgroup-aware
    disk: { path: string; totalBytes: number; usedBytes: number };
  };
  display: DisplayStatus;
  tools: ToolVersion[];
  counts: { projects: number; runningProcesses: number; activeBuilds: number; terminals: number; agentRuns: number };
};
type TailscaleUser = { id: string; loginName: string; displayName: string; profilePicUrl: string | null };
type TailnetNode = { hostName: string; dnsName: string | null /* no trailing dot */; os: string | null;
                     tailscaleIps: string[]; online: boolean };
type Identity = {
  sandboxId: string;
  tailscale: {
    available: boolean;                      // LocalAPI reachable OR serve identity headers present
    source: "serve" | "localapi" | "none";   // how `viewer` was resolved ("none" when viewer is null)
    tailnet: string | null;                  // MagicDNS suffix, e.g. "tail1234.ts.net"
    viewer: TailscaleUser | null;            // the caller
    viewerNode: TailnetNode | null;          // the caller's device (LocalAPI whois only)
    owner: TailscaleUser | null;             // user owning the node the sandbox is reachable through
    node: TailnetNode | null;                // that node (LocalAPI status Self)
  };
};
type AgentContextFile = { name: string /* relative to .agent, e.g. "projects/app/CURRENT_TASK.md" */;
                          path: string /* absolute */; sizeBytes: number; modifiedAt: string;
                          truncated: boolean; content: string };
type AgentContext = { files: AgentContextFile[] };

type Framework = "expo" | "react-native" | "electron" | "vite" | "next" | "node" | "android" | "python" | "unknown";
type PackageManager = "bun" | "pnpm" | "yarn" | "npm";
type BuildTarget = "electron-linux" | "electron-windows" | "android-apk" | "web" | "script";
type BuildProfile = "debug" | "release";
type GitSummary = { branch: string | null; dirty: boolean; ahead: number; behind: number;
                    lastCommit: { sha: string; subject: string; date: string } | null };
type Project = { id: string; name: string; path: string; framework: Framework;
                 packageManager: PackageManager | null; scripts: string[];
                 buildTargets: BuildTarget[]; git: GitSummary | null };
type GitFileStatus = { path: string; index: string; worktree: string };
type GitCommit = { sha: string; subject: string; author: string; date: string };
type CreateProject = { name: string;      // 1–128 chars; directory = projectIdFromName(name) ("My App" → "my-app")
                       gitUrl?: string;   // https|ssh|git|file URL or user@host:path, no leading "-", ≤ 2048
                       branch?: string }; // git ref pattern: no leading "-", "/" or ".", no ".."

type LogLine = { seq: number; ts: string; stream: "stdout" | "stderr" | "system"; text: string };

type ProcessState = "starting" | "running" | "exited" | "failed" | "stopped" | "orphaned";
type ProcessInfo = { id: string; projectId: string | null; name: string; command: string | string[];
                     cwd: string; pid: number | null; port: number | null; display: boolean;
                     state: ProcessState; exitCode: number | null; startedAt: string; endedAt: string | null };

type TerminalKind = "shell" | "claude";
type TerminalInfo = { id: string; kind: TerminalKind; projectId: string | null; title: string; cwd: string;
                      pid: number | null; cols: number; rows: number; state: "running" | "exited";
                      exitCode: number | null; createdAt: string };

type BuildState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type Artifact = { id: string; projectId: string; buildId: string | null; fileName: string; path: string;
                  sizeBytes: number; sha256: string; platform: string;
                  source: "build" | "agent" /* agent: shared with `theone-controller share` */;
                  agentRunId: string | null; note: string | null; createdAt: string };
type ShareArtifact = { path: string; projectId?: string; name?: string; note?: string; agentRunId?: string; sessionId?: string };
type TaildropTarget = { id: string /* node StableID */; hostName: string; dnsName: string | null; os: string | null; online: boolean };
type TaildropTargets = { available: boolean; targets: TaildropTarget[] };
type SendArtifact = { targetId: string };
type BuildJob = { id: string; projectId: string; target: BuildTarget; profile: BuildProfile; state: BuildState;
                  stage: string | null /* usually install|compile|package|collect */;
                  progress: number | null /* fraction 0..1 */; startedAt: string | null; endedAt: string | null;
                  createdAt: string; artifacts: Artifact[]; error: string | null };

type AgentRunState = "running" | "succeeded" | "failed" | "cancelled";
type AgentRunMode = "plan" | "acceptEdits" | "bypassPermissions";
type UploadKind = "image" | "pdf" | "audio" | "file";
type Upload = { id: string /* upl_… */; name: string; mimeType: string; kind: UploadKind; sizeBytes: number;
                path: string /* absolute, inside the sandbox */; createdAt: string };
type CreateUpload = { name: string /* ≤ 255 */; mimeType: string; data: string /* base64, ≤ 20 MiB decoded */ };
type CreateTranscription = { uploadId: string; language?: string /* ISO-639-1 hint */ };
type Transcription = { uploadId: string; text: string; language: string | null; durationMs: number | null;
                       engine: string /* "whisper.cpp" | "openai-compatible" */ };
type SttProfile = "off" | "eco" | "balanced" | "performance";
// whisper.cpp tuning (cpus = SttStatus.cpus):
//   off: no transcriptions (503) · eco: base, 2 threads, nice 19 + ionice -c3
//   balanced: base, max(2, cpus/4) threads, nice 10 · performance: small, min(cpus, max(4, cpus/2)) threads, nice 0
type SttProfileInfo = { id: SttProfile; model: string | null /* ggml name, null for off */; threads: number; nice: number;
                        available: boolean /* ggml-<model>.bin in THEONE_WHISPER_MODELS_DIR; true for off */ };
type SttStatus = { profile: SttProfile; profiles: SttProfileInfo[] /* STT_PROFILES order */;
                   engine: "whisper.cpp" | "openai-compatible" | null; ready: boolean; reason: string | null;
                   model: string | null /* after the THEONE_WHISPER_MODEL fallback; THEONE_STT_MODEL for openai-compatible */;
                   cpus: number; busy: boolean; queued: number };
type UpdateStt = { profile: SttProfile };
type AgentRunUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number;
                       totalTokens: number /* sum of the four */ };
type AgentRun = { id: string; projectId: string | null; prompt: string;
                  mode: AgentRunMode | null /* null = THEONE_CLAUDE_PERMISSION_MODE */; attachments: Upload[];
                  sessionId: string | null; state: AgentRunState;
                  startedAt: string; endedAt: string | null;
                  usage: AgentRunUsage | null /* from Claude's `result` message; null until it ends */;
                  result: string | null; error: string | null;
                  archivedAt: string | null /* set while archived; never on a running run */ };
type StartAgentRun = { projectId?: string; prompt: string /* ≤ 200 000 */; mode?: AgentRunMode;
                       attachmentIds?: string[] /* ≤ 10 upload ids */;
                       resumeSessionId?: string /* AGENT_SESSION_ID_PATTERN */ };
type AgentRunEvent =
  | { kind: "text"; seq: number; ts: string; text: string }
  | { kind: "tool_use"; seq: number; ts: string; tool: string; summary: string }
  | { kind: "tool_result"; seq: number; ts: string; tool: string | null; isError: boolean; summary: string }
  | { kind: "system"; seq: number; ts: string; text: string };

type InboxKind = "needs_input" | "permission" | "completed" | "failed" | "status" | "file";   // first two: Claude is blocked on a human; file: a shared artifact
type InboxItem = { id: string /* inb_ */; kind: InboxKind; title: string; body: string; projectId: string | null;
                   sessionId: string | null; agentRunId: string | null; terminalId: string | null;
                   artifactId: string | null /* file items; null once the artifact is deleted */;
                   createdAt: string; updatedAt: string; readAt: string | null };

// Sync back (sandbox → host), see sync-back.md. SyncPath: relative POSIX, no `..`/`.`/empty segments, no `\`, never `.git`.
type SyncFileChange = { path: string; kind: "added" | "modified" | "deleted"; sha256: string | null; size: number | null };
type SyncHost = { name: string; lastSeenAt: string; online: boolean; linked: boolean };
type SyncChanges = { projectId: string; baselineAt: string | null /* never pushed */; changes: SyncFileChange[];
                     totalBytes: number; host: SyncHost | null };
type SyncResult = { added: number; modified: number; deleted: number; conflicts: string[];
                    snapshotId: string | null; hostPath: string | null };
type SyncRequest = { id: string /* sync_ */; projectId: string; kind: "pull" | "revert";
                     status: "pending" | "claimed" | "applied" | "failed" | "cancelled";
                     paths: string[] | null /* null = all */; force: boolean; source: "mobile" | "desktop" | "cli";
                     claimedBy: string | null; result: SyncResult | null; error: string | null;
                     createdAt: string; updatedAt: string };

type PushDevice = { token: string /* ExponentPushToken[…] */; platform: "ios" | "android"; name: string | null;
                    createdAt: string; updatedAt: string };
type PushData = { url: "/inbox"; sandboxId: string; itemId: string; kind: InboxKind; artifactId: string | null };  // `data` of each push

type LiveActivityTokenKind = "activity" | "push-to-start";
type LiveActivityToken = { kind: LiveActivityTokenKind; token: string /* hex */; activityId: string | null;
                           createdAt: string; updatedAt: string };
// Rendered by the iOS Live Activity / Android ongoing notification; the `content-state` of every ActivityKit push
type IslandRunState = "running" | "completed" | "failed" | "cancelled";
type IslandRun = { id: string; title: string /* first prompt line, ≤ 60 */; project: string | null /* project name */;
                   state: IslandRunState; startedAt: string; tokens: number | null };
type IslandCommand = { id: string /* process or build id */; label: string; project: string | null; state: string };
type IslandUsage = { todayTokens: number; weekTokens: number; runsToday: number; messagesToday: number };  // 0 when unknown
type IslandState = { sandboxId: string; sandboxName: string; runs: IslandRun[]; commands: IslandCommand[];
                     usage: IslandUsage; updatedAt: string };

type StatusEvent = { project: string | null; status: string; platform?: string; stage?: string;
                     message: string; ts: string };      // SPEC "structured status"

type ExitMessage = { type: "exit"; code: number | null };  // null: killed by a signal / unknown

type ServerEvent =
  | { type: "hello"; protocolVersion: 1; sandboxId: string }
  | { type: "ping" }
  | { type: "status"; event: StatusEvent }
  | { type: "process.updated"; process: ProcessInfo }
  | { type: "terminal.updated"; terminal: TerminalInfo }
  | { type: "build.updated"; build: BuildJob }
  | { type: "artifact.created"; artifact: Artifact }
  | { type: "artifact.deleted"; id: string }
  | { type: "agent.updated"; run: AgentRun }  // also on archive/unarchive
  | { type: "agent.deleted"; ids: string[] }  // AgentRunIds removed by POST /v1/agent/runs/delete
  | { type: "inbox.updated"; item?: InboxItem; unreadCount: number; attentionCount: number }  // item: added or bumped; absent after mark-read
  | { type: "project.updated"; project: Project }
  | { type: "stt.updated"; stt: SttStatus }  // PUT /v1/stt changed the profile
  | { type: "sync.updated"; request: SyncRequest }  // a sync request was created, claimed, completed, cancelled or timed out
  | { type: "sync.changed"; projectId: string };  // the sync-back baseline moved (push or ack)
```

Identity resolution (controller): `viewer` comes from the Tailscale Serve headers
`Tailscale-User-Login` / `-Name` / `-Profile-Pic` (RFC 2047 values decoded) only when the
request arrives from loopback (serve proxies from `127.0.0.1`), matched against the LocalAPI
user list for `id` (else `id` = login name) → `source: "serve"`. Otherwise the controller asks
the LocalAPI on `THEONE_TAILSCALE_SOCKET` (`GET /localapi/v0/whois?addr=<ip:port>` of the
TCP peer) → `source: "localapi"`. `owner`, `node` and `tailnet` come from
`GET /localapi/v0/status` (`Self`, `User[Self.UserID]`, `MagicDNSSuffix`), cached 30 s.
Every LocalAPI call has a 1.5 s timeout. The identity is informational: the bearer token
stays the only authentication.

IDs: type prefix (`prc_`, `trm_`, `bld_`, `art_`, `run_`, `inb_`, `upl_`, `sync_`) + 10 random characters of
lowercase Crockford base32 (`0-9a-z` without `i l o u`), e.g. `bld_7f3k2q9xa1`.
Validators accept any `<prefix>[A-Za-z0-9_-]{1,64}`. Timestamps: ISO-8601 UTC strings.

`@theone/protocol` also exports: `LIMITS` (§6), the constants above as arrays
(`BUILD_TARGETS`, `PROCESS_STATES`, …), list and query schemas, the stream message
schemas (`ProcessLogStreamMessage`, `LogStreamMessage`, `AgentStreamMessage`,
`EventsClientMessage`), `CreateProjectResponse`, `restPaths`/`wsPaths`/`uiPaths`
builders and server-side `routePatterns`, pairing helpers (`buildPairingLink`,
`parsePairingLink`, `parseBaseUrl`), and `projectIdFromName`.

**Compatibility.** A client MUST check `protocolVersion` on `GET /v1/health` and on
the events `hello`; `@theone/client` raises `ProtocolVersionError` and ends the
events stream on a mismatch. Unknown event types and fields are ignored, but a new
value in an existing enum fails the whole payload parse, so adding enum values is
a breaking change.

### 5.5 Build recipes (controller-side)

`<pm>` = package manager from the lockfile (`bun.lock(b)`, `pnpm-lock.yaml`,
`yarn.lock`, `package-lock.json`; npm by default). `<exec>` = its project-local
runner: `npx --yes=false`, `pnpm exec`, `yarn run`, `bunx --no-install`. Every step
runs as `bash -lc` in the project dir. `install` = `<pm> install`, only when
`package.json` has dependencies. `compile` (Electron) = `<pm> run build`, only if a
`build` script exists that does not itself call electron-builder/forge.

| Target | Offered when | Steps | Artifacts collected from |
|---|---|---|---|
| `electron-linux` | `electron-builder` or `@electron-forge/cli` in deps | install → compile → `<exec> electron-builder --linux AppImage --x64 --publish never` | `<out>/*.AppImage`, `<out>/*.deb` (`<out>` = `build.directories.output`, default `dist`) |
| `electron-windows` | same | same with `--win nsis --x64`, env `WINEPREFIX`, `WINEARCH=win64`, `WINEDEBUG=-all`, `WINEDLLOVERRIDES=mscoree,mshtml=`, `DISPLAY`; requires `wine` | `<out>/*.exe` except `*__uninstaller*` |
| (Forge, no electron-builder) | `@electron-forge/cli` | install → compile → `<exec> electron-forge make --platform linux\|win32 --arch x64` | `out/make/**`: `*.AppImage`, `*.deb`, `*.rpm`, `linux/**/*.zip` / `*.exe`, `*.msi`, `*.appx`, `win32/**/*.zip` |
| `android-apk` | `expo` dep + `app.json`/`app.config.*`, or `android/gradlew` | install → `<exec> expo prebuild --platform android --no-install` (only without `android/`) → `cd android && sh ./gradlew assembleDebug\|assembleRelease --no-daemon --console=plain`; env `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `JAVA_HOME`; requires `java` | `android/app/build/outputs/apk/**/<profile>/**/*.apk` |
| `web` | `build` script and framework ≠ electron | install → `<pm> run build` | first existing dir of `dist`, `build`, `out`, `web-build`, zipped |
| `script` | `build` script | install → `<pm> run build` | none (logs only) |

Profile `debug` adds `-c.compression=store` to electron-builder. Stages are reported
(`install`, `compile`, `package`, `collect`); `progress` is a fraction. Collection only
takes files modified after the build started (minus 2 s), so outputs of earlier
builds are ignored; no match fails the build. Each file is copied to
`/workspace/artifacts` with the predictable name (`platform` = `linux|windows|android|web`,
`version` from `package.json`, else `0.0.0`) and its sha256. Builds run one at a time (FIFO).

### 5.6 WebView bridge (`/ui` pages ↔ embedding app)

Names live in `@theone/protocol/bridge` (`PAGE_MESSAGES`, `PAGE_STATES`, `INPUT_MODES`,
`VNC_ACTIONS`, `PageInsets`; zod-free so
the pages can import it). Pages post to `window.ReactNativeWebView.postMessage`
(JSON string) and, when framed, `parent.postMessage(message, "*")`:

| Message | From → to | Payload |
|---|---|---|
| `terminal-state`, `vnc-state` | page → app | `{ type, state, code? }`, `state` ∈ `connecting\|connected\|disconnected\|exited\|error`; `code` = exit code on `exited`; `vnc-state` adds `inputMode` |
| `terminal-need-ticket`, `vnc-need-ticket` | page → app | `{ type }` (terminal adds `session`) after the page's socket dropped |
| `vnc-action` | page → app | `{ type, action }`, `action` ∈ `browser` (the user tapped the key row's **URL** key) |
| `theone-reconnect` | app → page | native: injected `window.theone.reconnect(ticket)`; web: `postMessage({ type: "theone-reconnect", ticket })` to the frame |
| `theone-input-mode` | app → page | `window.theone.setInputMode(mode)` / `{ type, mode }`, `mode` ∈ `trackpad\|touch`; switches without reconnecting (VNC page only) |
| `theone-insets` | app → page | `window.theone.setInsets({ top, bottom })` / `{ type, top, bottom }`, CSS px ≥ 0 covered by the app's floating chrome (VNC page only) |

The app verifies the sender origin (the sandbox base URL), answers `*-need-ticket`
with a fresh ticket (automatically, up to 4 times with backoff, and again when the app
returns to the foreground), and never reconnects after `exited` or `error`.
`viewOnly=1` in the VNC fragment disables input. Pages validate every app → page call and
ignore malformed ones; `window.theone` always has all three methods (no-ops where a page
does not support them).

VNC page input: `input=trackpad|touch` in the fragment (default `trackpad`), then
`theone-input-mode` at runtime. **trackpad**: a layer over the screen captures touches and
drives a drawn pointer kept on the remote screen: one-finger drag moves it relatively
(≈60 % of the screen width per swipe across the page, accelerated when fast), tap = left
click, two-finger tap = right click, two-finger drag = wheel, tap then press-and-drag =
left-button drag; noVNC gets synthetic mouse/wheel events on its canvas. **touch**:
noVNC's own touch gestures act under the finger and no pointer is drawn. Embedded (any
host), the page hides its own top bar (the app shows status) and starts the key row with
**⌨** (toggle the phone keyboard) and **URL** (posts `vnc-action`); `theone-insets` pads
the screen below the app's header (`top`) and the key row above its bottom chrome (`bottom`).

## 6. Supervision & persistence

### 6.1 State

* `bun:sqlite` database at `$THEONE_DATA_DIR/state.db` (WAL) — processes, terminals
  (metadata), builds, artifacts, agent runs and their events, and the inbox (newest 1 000
  items by `updatedAt` kept). Agent runs are kept until deleted through
  `POST /v1/agent/runs/delete`; archiving only sets `archived_at` (migration 3) and hides
  them from the default list. Migration 4 adds the `uploads` table and the run columns
  `mode` and `attachments` (JSON `Upload[]`); older rows read as `null` and `[]`.
  Migration 6 adds `push_devices` (Expo push tokens registered by the phones).
  Migration 7 adds the run columns `input_tokens`, `output_tokens`, `cache_read_tokens` and
  `cache_write_tokens` (`usage` is null when `input_tokens` is null) and drops `cost_usd`.
  Migration 8 adds `settings` (`key`, `value`, `updated_at`), holding `stt.profile`.
  Migration 10 adds `live_activity_tokens` (ActivityKit tokens: `token`, `kind`, `activity_id`, timestamps).
* Sync back: the baseline manifest of each pushed project in
  `$THEONE_DATA_DIR/sync/<projectId>.json` (`{ pushedAt, files: { path: sha256 }, executable: path[] }`); sync
  requests in the database (newest 500 kept; a request `claimed` for over 10 minutes is failed).
  See [sync-back.md](sync-back.md).
* Logs: `$THEONE_DATA_DIR/logs/<id>.log` (`<ts> <stream> <seq> <text>` lines), rotated at
  5 MiB (keep 1 rotation), plus an in-memory ring buffer (2 000 lines) per live process/build.
* On startup, rows left live are marked: processes `orphaned`, builds and agent runs
  `failed`, terminals `exited` — the controller never re-runs anything automatically
  (and does not kill what an earlier crashed controller left running). A clean
  shutdown (SIGTERM) stops everything and records `stopped`/`cancelled`.
* The controller mirrors live state for the in-sandbox agent into
  `/workspace/.agent/RUNTIME.md` (human-readable: running processes, ports, display, builds).

`LIMITS`: ticket 60 s · ping 25 s · stop grace 5 s · log tail 500 (max 2 000) · replay
200 lines · ring 2 000 lines · rotation 5 MiB · scrollback 256 KiB · context file
64 KiB · terminal ≤ 1000×500 · prompt 200 000 chars · command 16 384 chars · status
message 4 000 chars · names 128 chars · request body 1 MiB · upload 20 MiB (body 28 MiB) ·
upload name 255 chars · 10 attachments per run · language hint 16 chars · sync paths 1–5 000 per request (4 096 chars each) · sync host online 60 s · sync claim timeout 10 min.

### 6.2 Process groups

Every child (process, build step, agent run, PTY) is spawned detached, i.e. as the
leader of its own session and process group. Stop/cancel sends SIGTERM (SIGHUP for
terminals) to the group and to every other group of that session, then SIGKILL after
5 s (during controller shutdown: 5 s for processes, 2 s for builds and agent runs,
1 s for terminals, all in parallel within supervisord's 15 s stop window). When a
leader exits on its own, the controller scans `/proc/*/stat` for live
members of its group or session (`cmd &`, `nohup cmd &`, daemons, a shell's
background jobs), stops them the same way, names them in the log (agent runs: a
`system` event), and only then records the final state. Only programs that start
their own session (`setsid`) outlive their leader; long-running work belongs in its
own tracked process.

### 6.3 Untrusted project content

Project files are read defensively: `package.json` must be a regular file ≤ 1 MiB
(opened `O_NONBLOCK`, checked with `fstat`; otherwise treated as `{}`), `.agent` files
likewise with `O_NOFOLLOW`. `git status`/`log` run with `core.fsmonitor=false`,
`log.showSignature=false` and every configured `filter.<driver>` neutralised, so a
repository's own git config never executes code when the controller lists it.

### 6.4 Agent memory layout (`/workspace/.agent/`)

Seeded by the image entrypoint from `/etc/theone/agent-templates/` when missing;
never overwritten afterwards. Described normatively in `SPEC.md`.

```text
/workspace/.agent/
├── GLOBAL_CONTEXT.md        environment, tooling, rules, user preferences (agent-maintained)
├── ENVIRONMENT.md           detected tool versions — regenerated by the entrypoint on every start
├── CURRENT_TASK.md          the active focus: which project, goal, status, next step
├── DECISIONS.md             dated architectural decisions
├── COMMANDS.md              verified build/run/test commands worth remembering
├── SESSION_LOG.md           short dated log of sessions and notable failures
├── RUNTIME.md               written by the controller — read-only for the agent
├── projects/
│   ├── _template/           PROJECT_STATE.md, CURRENT_TASK.md, TEST_STATE.md to copy
│   └── <projectId>/
│       ├── PROJECT_STATE.md purpose, stack, commands, known issues, next actions
│       ├── CURRENT_TASK.md  project-level task state
│       └── TEST_STATE.md    last test/build results
├── logs/                    agent scratch logs (rotated)
│   └── supervisor/          supervisord and program logs (supervisord-owned)
└── controller/              controller-owned (0700): state.db, token, logs/ — never read, edit or print
```

## 7. Controller CLI (same binary)

```
theone-controller [serve]                       # default when no args
theone-controller pair [--json]                 # pairing deep link + ANSI QR code; --json → { link, url, name }
theone-controller status [--json]               # SandboxStatus from the local API (VNC password shown as ***)
theone-controller emit --status <s> --message <m> [--project p] [--stage s] [--platform p]
theone-controller token [--rotate]              # print the token, or write a new one (restart required)
theone-controller api <METHOD> <PATH> [JSON|-]  # call the local API; the agent's only way to use it
theone-controller share <file> [--project p] [--name n] [--note t] [--json]  # POST /v1/artifacts; prints "shared <name> (<size>, <project>) as <id>"
theone-controller hook                          # Claude Code hook: stdin JSON → POST /v1/hooks/claude; silent, always exit 0
theone-controller --version | --help
```

The CLI reads the token from `THEONE_TOKEN`/`THEONE_TOKEN_FILE` and talks to
`http://127.0.0.1:$THEONE_PORT` (the bind address unless it is a wildcard).
`api`: `METHOD` ∈ `GET|POST|DELETE`, `PATH` must start with and stay under `/v1/`,
body as argument or `-` for stdin; 2xx JSON is pretty-printed to stdout (non-JSON
bytes only when stdout is not a terminal); the token and `display.vnc.password` are
printed as `***`. Exit codes (`api`, `emit`): 0 ok, 1 request failed / non-2xx
(error body on stderr), 2 bad arguments (nothing sent).
`share` resolves the file against the current directory and sends `agentRunId`/`sessionId` from
`THEONE_AGENT_RUN_ID`/`CLAUDE_CODE_SESSION_ID` when set; exit codes as for `api`.
`hook` adds `theone_terminal_id`/`theone_agent_run_id` from `THEONE_TERMINAL_ID`/`THEONE_AGENT_RUN_ID`
(set by the controller for terminals and agent runs), gives up after 1.5 s and never prints
or fails, so a controller outage never blocks Claude.

## 8. Sandbox image

Multi-stage `infra/docker/sandbox/Dockerfile`, build context = repo root.

| Stage | Adds |
|---|---|
| `bun`, `jdk` | helper aliases for `oven/bun:${BUN_VERSION}` and `${JDK_IMAGE}` |
| `controller-build` | `bun install --frozen-lockfile --filter @theone/controller` → `bun build --compile` (host arch) |
| `base` | `${DEBIAN_IMAGE}`, tini, supervisor, sudo, coreutils + util-linux (`nice`, `ionice` for the STT profiles), git, git-lfs, curl, jq, ripgrep, fd, build-essential, python3/pip/venv/pipx, Docker CLI + compose/buildx (no daemon), Node `${NODE_MAJOR}` from nodejs.org (SHASUMS256-checked) + corepack, bun, locales, fonts, `dev` user |
| `desktop` | TigerVNC (`Xvnc`, `vncpasswd`), openbox, xterm, x11-apps (`xwd`), x11-utils, x11-xserver-utils, xdotool, imagemagick, ffmpeg, dbus-x11, chromium, Electron runtime libs |
| `electron` | wine (`wine`, `wine64`, `wine32:i386`, `/usr/local/bin/wine64` symlink), osslsigncode, fakeroot, dpkg-dev, rpm, mono-complete if `WITH_MONO=true` |
| `android-sdk` | side stage: JDK copy, Android cmdline-tools (sha256-pinned), platform-tools, `platforms;${ANDROID_PLATFORM}`, `build-tools;${ANDROID_BUILD_TOOLS}`; empty dirs if `WITH_ANDROID=false` |
| `android` | JDK → `/opt/java/openjdk`, SDK → `/opt/android-sdk` (owned by `dev`), `/etc/profile.d/theone.sh` |
| `whisper` | side stage: with `WITH_WHISPER=true`, whisper.cpp `v${WHISPER_CPP_VERSION}` built statically (`${WHISPER_CMAKE_ARGS}`, default `-DGGML_NATIVE=ON`) → `/opt/whisper/bin/whisper-cli`, and `ggml-<m>.bin` for each `m` in `${WHISPER_MODELS}` from huggingface.co/ggerganov/whisper.cpp with the symlink `/opt/whisper/models/ggml-model.bin` to the first; empty `/opt/whisper` otherwise |
| `sandbox` (final, default) | Claude Code (`npm i -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`), `/opt/whisper`, rootfs, `SPEC.md` → `/etc/theone/SPEC.md`, controller binary |

Build args: `DEBIAN_IMAGE` (`debian:trixie-slim`), `BUN_VERSION` (`1.4.2`), `JDK_IMAGE`
(`eclipse-temurin:17-jdk`), `DEV_UID`/`DEV_GID` (`1000`), `ENABLE_SUDO` (`true`),
`NODE_MAJOR` (`24`), `NODE_VERSION` (empty = newest `24.x`), `WITH_MONO` (`true`),
`WITH_ANDROID` (`true`), `ANDROID_CMDLINE_TOOLS_BUILD`/`_SHA256`, `ANDROID_PLATFORM`
(`android-36`), `ANDROID_BUILD_TOOLS` (`36.0.0`), `CLAUDE_CODE_VERSION` (`latest`),
`WITH_WHISPER` (`true`), `WHISPER_CPP_VERSION` (`1.7.6`), `WHISPER_MODELS` (`base small`),
`WHISPER_CMAKE_ARGS` (`-DGGML_NATIVE=ON`), `THEONE_IMAGE_VERSION` (`0.1.0`).

Claude Code hooks: `/etc/claude-code/managed-settings.json` (the Linux managed-settings path,
applied to every session, interactive or `claude -p`) runs `/usr/local/bin/theone-controller hook`
(timeout 5 s) on `Notification`, `Stop`, `StopFailure` and `UserPromptSubmit`.
`/etc/claude-code/CLAUDE.md` (managed memory) tells Claude to run `theone-controller share <file> --note …`
for finished deliverables (APK/AAB, installers, zips, reports, exported media), not intermediate files.

Rootfs helpers (`/usr/local/bin`): `theone-entrypoint`, `theone-xvnc`, `theone-wait-x`,
`theone-controller-run`, `theone-wine-init`, `theone-screenshot`, `theone-doctor`.

Entrypoint (`/usr/local/bin/theone-entrypoint`, run by tini as root): drops empty
`THEONE_*`/`ANTHROPIC_*`/`CLAUDE_*`/`DOCKER_*` vars, fixes volume ownership, creates
workspace dirs (never following symlinks planted in the volumes), seeds
`/workspace/.agent/` templates if missing (never touching the bind-mounted
`/home/dev/.claude`; SPEC.md is baked into `/etc/claude-code/CLAUDE.md` at build time), writes the VNC password files and
`/run/theone/controller.env`, clears stale X locks, regenerates `ENVIRONMENT.md` (tool
probes run as `dev`), unsets `THEONE_TOKEN`/`THEONE_VNC_PASSWORD`, then execs
supervisord (any arguments replace it). supervisord drops to `dev` itself
(`user=dev`); programs: `xvnc` (`theone-xvnc`), `openbox` (`theone-wait-x dbus-run-session
-- openbox-session`), `controller` (`theone-controller-run` loads `controller.env`, then
`theone-controller serve`), `wine-init` (oneshot `wineboot -u` when the prefix is missing).
`HEALTHCHECK` = `curl -fsS http://127.0.0.1:7700/v1/health`.

## 9. Compose modes

`infra/scripts/sandbox` selects **overlay files** (not compose profiles) and passes the
resolved settings to compose. It reads `infra/compose/.env`, or only the file given by
`--env-file <path>`.

| Mode | Files | Reachability |
|---|---|---|
| `tailscale` (default) | `compose.yml` + `compose.tailscale.yml` | sandbox joins the tailscale sidecar's netns; `tailscale serve` → `https://<THEONE_HOSTNAME>.<TS_TAILNET_DOMAIN>` (443 → 7700) and TCP 5901; no host ports. Refuses to start without `TS_TAILNET_DOMAIN`, or without `TS_AUTHKEY` on first start |
| `host-tailscale` | `compose.yml` + `compose.local.yml`, `THEONE_BIND_ADDR` = host tailnet IPv4 | ports bound only on that address |
| `local` | `compose.yml` + `compose.local.yml`, `THEONE_BIND_ADDR=127.0.0.1` | loopback only, for development/e2e tests |
| `+tailscale-api` | tailscale: add `compose.tailscale-api-sidecar.yml`; host-tailscale/local: add `compose.tailscale-api.yml` | opt-in (`--tailscale-api`, `THEONE_TAILSCALE_LOCALAPI=1`) for `GET /v1/identity`. Sidecar: `TS_SOCKET=/var/run/tailscale/tailscaled.sock` on volume `<prefix>-tailscale-run`, mounted read-only at `/run/tailscale` in the sandbox. Host: `THEONE_TAILSCALE_HOST_SOCKET_DIR` bind-mounted read-only at `/run/tailscale`. Root in the sandbox can then reconfigure that tailscaled ([security model](security-model.md#tailscale-localapi-opt-in)) |
| `+dind` | add `compose.dind.yml` | privileged `docker:dind` sidecar sharing `<prefix>-workspace`; sandbox gets `DOCKER_HOST=tcp://docker:2376` + TLS certs (opt-in, [ADR 0006](../adr/0006-optional-docker-in-docker.md)) |

Stacks run side by side when each has its own `THEONE_COMPOSE_PROJECT` (and thereby
volumes) plus its own host ports or `THEONE_HOSTNAME`.

Hardening defaults: sandbox without `privileged`, no host bind mounts except the
read-only serve config (and, with `--tailscale-api` outside tailscale mode, the read-only host
tailscale socket directory), `cap_drop: [ALL]` + minimal `cap_add` (CHOWN, DAC_OVERRIDE,
FOWNER, SETUID, SETGID, KILL, AUDIT_WRITE), `shm_size: 2g`, `pids_limit`, CPU/memory
limits from `.env`, explicit `environment` lists (no `env_file`), json-file logs
10 MB × 3. Tailscale sidecar: userspace mode (no `/dev/net/tun`, no `NET_ADMIN`),
`no-new-privileges`, `TS_AUTH_ONCE=true`.

## 10. Mobile app integration

* Feature module `apps/mobile/src/features/sandbox/` (`api/`, `components/`, `hooks/`,
  `store/`, `types/`, `utils/`) consumes `@theone/client`.
* Stores: paired sandboxes (id, name, base URL, active id) in zustand persisted to
  `expo-sqlite/kv-store` (web: `localStorage`); tokens in `expo-secure-store`
  (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`; web: `localStorage`, development only); live link
  state and issues (`unauthorized`, `incompatible`) in a connection store.
* Server state: `@tanstack/react-query` (`QueryClientProvider` in the root layout) +
  one events WebSocket per active sandbox that invalidates (on `hello`) and patches queries.
  Log and run streams reconnect with fresh tickets and give up after 5 drops that never opened.
* Onboarding: the root layout keeps the splash until fonts load and the sandbox store hydrates.
  `Stack.Protected` shows `(tabs)` and `sandbox/*` only while at least one sandbox is paired,
  otherwise `(onboarding)` (`/welcome` pager, then `/setup` with **Scan pairing code**). `pair`
  stays outside the guards. Pairing lands on the Agents tab; removing the last sandbox returns
  to onboarding.
* Screens (expo-router): the **Agents tab** is the sandbox hub; routes
  `pair` (QR scan via expo-camera pairs at once; `theone://pair` deep links pre-fill and
  need a tap; manual entry), `sandbox/projects/new` (create or clone, follows the clone's log),
  `sandbox/projects/[id]`, `sandbox/builds/[id]`, `sandbox/agent/[id]` (Claude run stream),
  `sandbox/terminal/[id]` (xterm page in WebView), `sandbox/display` (noVNC in WebView,
  loaded only while `display.available && display.vnc.available`).
* WebViews load `<baseUrl>/ui/terminal#ticket=…&session=<id>` and
  `<baseUrl>/ui/vnc#ticket=…&password=…` (web platform: `<iframe>`), bridge per §5.6.
* A 401/403 or a protocol mismatch shows a notice with **Pair again**.
* The **Profile tab** reads the paired sandbox: Tailscale identity from `GET /v1/identity`
  (viewer, else owner, else the sandbox name; tailnet pill; a notice when the controller does not
  expose it), counts from `/v1/status`, and an activity feed merged from builds, Claude runs and
  processes. The **Projects tab** lists `/v1/projects` with live status from processes, builds and
  runs, plus a **Running** section of active processes, builds and Claude runs.
  Home and Tasks keep their placeholder content.

## 11. Tests

| Command | Scope |
|---|---|
| `bun run typecheck`, `bun run test` | every workspace: protocol, client, controller (bun test), mobile (jest) |
| `bun run test:infra [--quick\|--coverage]` | bats suites in `infra/tests` (containers `theone-test-*`, images `theone/infra-test:*`) |
| `bun run e2e [--no-build\|--keep\|--web]` | `infra/e2e`: builds `theone/sandbox:e2e`, starts project `theone-e2e` (volumes `theone-e2e-*`) in local mode on `127.0.0.1:17700/15901`, runs `bun test ./infra/e2e`, removes the stack |

The e2e suite is not a workspace: typecheck it with `bunx tsc -p infra/e2e/tsconfig.json`.
Runbook: [e2e-testing.md](../runbooks/e2e-testing.md).
