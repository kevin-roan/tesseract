# Tesseract — System Blueprint (v1 contract)

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
                                  │ compose project "tesseract" (default)           │
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
                                  │  │   ├─ tesseract-controller :7700           │  │
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
* Opt-in **host shell** (§4.3, §5.7): `tesseract-controller host serve`, run on the host
  itself (not in the sandbox), gives the phone a PTY on the host over the host's own
  Tailscale address. It needs the host token (paired once) and a PIN set with
  `tesseract-controller host pin`; the sandbox never holds either.

## 2. Monorepo layout

Package manager: **bun** workspaces (`bunfig.toml` → `linker = "hoisted"`, required by
React Native/Metro). TypeScript `~6.0`. No build step for internal packages:
they export TypeScript source (`exports: { ".": "./src/index.ts" }`).

```text
/
├── apps/
│   ├── mobile/          @tesseract/mobile      Expo SDK 56 / RN 0.85 / expo-router (existing app)
│   ├── controller/      @tesseract/controller  Bun + Hono daemon that runs INSIDE the sandbox
│   ├── desktop/         Tesseract GTK4/libadwaita app (Python, dev.tesseract.Desktop): the visual reference
│   └── electron/        @tesseract/electron  Tesseract desktop app (Electron 44, React 19): setup wizard,
│                                            sandbox stack control, host Android emulator, `tesseract` CLI (§12)
├── packages/
│   ├── protocol/        @tesseract/protocol    zod v4 schemas + types + route helpers (the wire contract);
│   │                                        subpath exports ./bridge (zod-free) and ./fixtures
│   └── client/          @tesseract/client      typed REST/WS client used by mobile (runs in RN, browser, Bun)
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
├── docs/                architecture/, adr/, runbooks/, archive/, electron/ (desktop app specs + conventions)
├── SPEC.md              operating spec for the agent that runs inside the sandbox
├── package.json         workspaces + root scripts
├── bunfig.toml
└── tsconfig.base.json   shared compiler options for non-Expo packages
```

Root scripts: `bun run typecheck`, `bun run test`, `bun run lint` (fan out with
`bun run --filter '*'`), `bun run mobile`, `bun run controller:dev`,
`bun run controller:build`, `bun run sandbox <cmd>`, `bun run test:infra` (§11),
`bun run e2e` (§11), `bun run host <cmd>` (§7), and the desktop app shortcuts
`bun run electron` (dev), `electron:build`, `electron:e2e`, `electron:dist`, `electron:smoke` (§12).

Every workspace package has `typecheck` and `test` scripts. Adding a dependency
from an automated agent MUST go through `flock /tmp/tesseract-bun-install.lock bun add …`
(run inside the package directory) so parallel installs never race.

## 3. Fixed names, ports, paths

| Thing | Value |
|---|---|
| Compose project | `tesseract` (`TESSERACT_COMPOSE_PROJECT`; containers `<project>-<service>-1`) |
| Named volumes | `<prefix>-workspace`, `<prefix>-home`, `<prefix>-tailscale`, `<prefix>-tailscale-run` (sidecar LocalAPI socket, `--tailscale-api` only), `<prefix>-dind-certs`, `<prefix>-dind-data`; prefix = `TESSERACT_VOLUME_PREFIX`, default the project name (so `tesseract-*`) |
| Image | `tesseract/sandbox:latest` (`TESSERACT_IMAGE`) |
| Sandbox service / container hostname | `sandbox` (tailscale mode: the sidecar's hostname `TESSERACT_HOSTNAME`, because it joins the sidecar's network namespace) |
| Tailscale node hostname (default) | `tesseract-sandbox` (`TESSERACT_HOSTNAME`, also `TESSERACT_SANDBOX_ID`) |
| Controller listen | `0.0.0.0:7700` inside the sandbox netns (`TESSERACT_PORT`) |
| Host ports (local, host-tailscale) | `7700`, `5901` on `TESSERACT_BIND_ADDR` only (`TESSERACT_CONTROLLER_HOST_PORT`, `TESSERACT_VNC_HOST_PORT`) |
| X display | `:1` (`TESSERACT_DISPLAY`), default geometry `1600x900` (`TESSERACT_DISPLAY_GEOMETRY`) |
| VNC (RFB) | TCP `5901`, VncAuth (`TESSERACT_VNC_PASSWORD`; hash `/home/dev/.vnc/passwd`, generated plaintext `/home/dev/.vnc/password` 0600) |
| Tailscale LocalAPI socket (opt-in) | `/run/tailscale/tailscaled.sock` in the sandbox (`TESSERACT_TAILSCALE_SOCKET`), read-only mount of the host's `/var/run/tailscale` or the sidecar's `<prefix>-tailscale-run` volume (§9) |
| Per-start secrets | `/run/tesseract/controller.env` (0600, dev): VNC password and, if set, `TESSERACT_TOKEN`; read only by `tesseract-controller-run` |
| supervisord | socket `/run/supervisor/supervisor.sock` (0700, dev), logs `/workspace/.agent/logs/supervisor/` |
| Sandbox user | `dev` (uid/gid `1000` by default, build args `DEV_UID`/`DEV_GID`) |
| Workspace | `/workspace` (volume `<prefix>-workspace`) |
| Projects | `/workspace/projects/<projectId>` |
| Artifacts | `/workspace/artifacts/<project>-<platform>-<profile>-<version>.<ext>` for builds, `/workspace/artifacts/<file name>` for shared files (`-2`, `-3`… before the extension on collision) |
| Uploads | `/workspace/.tesseract/uploads/<uploadId>/<sanitized name>` (dirs 0700, files 0600; `POST /v1/uploads`), rows and files older than 30 days removed at startup |
| Agent memory | `/workspace/.agent/` (§6.4, SPEC.md) |
| Controller data | `/workspace/.agent/controller/` (`TESSERACT_DATA_DIR`, 0700) → `state.db`, `token`, `logs/`, `sync/` (baselines, `blobs/`, `backups/`, `staging/`), `claude-import.json` |
| Claude credentials | the host's `~/.claude` bind-mounted at `/home/dev/.claude` (`CLAUDE_CONFIG_DIR`): login (`.credentials.json`), settings, CLAUDE.md; the host's Claude Max subscription login. On macOS the login lives in the keychain, not in `.credentials.json`, so a Mac host passes a long-lived `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token` on the Mac; `tesseract server install --claude-token`, §7.2) to the sandbox instead |
| Claude accounts | primary account `claude` = the dir above; each `TESSERACT_HOST_CLAUDE_ACCOUNTS` name `<n>` adds the host's `~/.claude-<n>` (what `CLAUDE_CONFIG_DIR=~/.claude-<n> claude` uses on the host) bind-mounted at `/home/dev/.claude-<n>`, account id `claude-<n>`, global config `<dir>/.claude.json`. Live bind mounts, never copies: token refreshes by either side stay valid for both. The controller never writes into these dirs; the default account and per-project picks live in `state.db` |
| Home | `/home/dev` (volume `<prefix>-home`: wine prefix, caches; `.claude` is the host bind mount above) |
| Wine prefix | `/home/dev/.wine` (`WINEPREFIX`), `WINEARCH=win64`, `WINEDEBUG=-all` |
| Android SDK | `/opt/android-sdk` (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, owned by `dev`); with `TESSERACT_HOST_ANDROID_SDK` the host's SDK, read-only, in its place |
| Gradle read-only cache | with `TESSERACT_HOST_GRADLE_CACHE`: the host's Gradle `caches/` at `/opt/gradle-ro-cache` (read-only, `GRADLE_RO_DEP_CACHE`); the writable Gradle home stays `/home/dev/.gradle` |
| Java | `/opt/java/openjdk` (Temurin 17, `JAVA_HOME`) |
| Controller binary | `/usr/local/bin/tesseract-controller` (built with `bun build --compile`) |
| Browser pages | `/ui/terminal`, `/ui/vnc` (controller), `/ui/android` (host shell daemon); their bundled assets are served at root paths (`/chunk-<hash>.js`, `.css`) |
| Mobile app id | iOS bundle id and Android package `com.kevinroan.tesseract` (development build `com.kevinroan.tesseract.dev`); iOS app group `group.com.kevinroan.tesseract` (shared with the widget/Live Activity and share extensions); URL scheme `tesseract`; EAS owner and project id set by `eas init` (`owner`, `extra.eas.projectId` in `app.json`) |
| Mobile deep link | `tesseract://pair?url=<encoded base url>&token=<token>&name=<label>`; host shell: `tesseract://host?url=…&token=<host token>&name=<host name>` |
| Host shell daemon | `tesseract-controller host serve` on the host, `<host Tailscale IPv4>:7701` (`HOST_SHELL_PORT`, `TESSERACT_HOST_SHELL_PORT`); only loopback or `100.64.0.0/10` binds |
| Headless server install | `~/.tesseract/{bin,sandbox}` (`./setup-server.sh` on the server, or `infra/scripts/deploy-mac` from the dev box); host shell service LaunchAgent `dev.tesseract.host-shell` (logs `~/Library/Logs/Tesseract/`) or systemd user unit `tesseract-host-shell.service` (§7.2) |
| ADB tunnel | `127.0.0.1:15555` in the sandbox (`DEFAULT_ADB_TUNNEL_PORT`, `TESSERACT_ADB_TUNNEL_PORT`), adb serial `127.0.0.1:15555`; open only while the host emulator is linked and `running` ([app-runs-and-emulator.md](app-runs-and-emulator.md) §2.3). Shared host emulators (`TESSERACT_ANDROID_SHARE_EMULATORS`): `emulator-<n>` → `127.0.0.1:<15555 + 1 + (n − 5554)/2>` (`sharedEmulatorTunnelPort`), e.g. `emulator-5556` → `127.0.0.1:15557` |
| Host Android emulator | console `5554`, adbd `5555` (`DEFAULT_EMULATOR_PORT`, `TESSERACT_EMULATOR_PORT`); adb serial `127.0.0.1:<bridge port>` in `netns` isolation (`TESSERACT_EMULATOR_ADB_PORT`), `emulator-<port>` for a plain (`none` or adopted non-isolated) emulator |
| Desktop renderer dev server | `http://127.0.0.1:4545` (`RENDERER_DEV_PORT`, `strictPort`, dev and preview); never the Electron/Vite defaults |
| Desktop app id / deep link | `dev.tesseract.Desktop`; `tesseract://<page>[?…]`, `tesseract://preferences/<section>`, `tesseract://onboarding/<step>`, `tesseract://pair`, … (§12.3) |
| Server containers | `tesseract-ct-<name>` (sysbox-runc, image `tesseract/server:1`, network `tesseract-ct-<name>`, volume `tesseract-ct-<name>-docker`), connector `tesseract-ct-<name>-tunnel`; route state `$TESSERACT_STATE_DIR/containers.json`; tailnet tag `tag:tesseract-server` ([server-containers.md](server-containers.md), ADR 0011) |
| Host shell state | `$XDG_CONFIG_HOME/tesseract/host-shell/state.json` (default `~/.config/…`, `TESSERACT_HOST_SHELL_DIR`; dir 0700, file 0600): host token, argon2id PIN hash, `pinSetAt`, failure/lockout counters, `androidLink` (sandbox URL + token), `androidStream` (the `AndroidStreamSettings` fields changed from the defaults; invalid fields fall back to them) |

`projectId` = directory name under `/workspace/projects`, must match
`^[a-z0-9][a-z0-9._-]{0,63}$` (case-insensitive input is lower-cased). Paths are
always resolved (`realpath`) and verified to stay under the workspace.

Installs from before the rename to Tesseract are migrated once, by `bun run sandbox` (env
file on every command; stack on `up`), the desktop app's sandbox start and `tesseract server install`:
legacy env keys become `TESSERACT_*` (original kept as `<env file>.legacy-backup`; old default
project/prefix/image values become the `tesseract` ones, the hostname is kept), the legacy project
is stopped (`down`, volumes kept) and its volumes (all but `tailscale-run`) are moved to missing
`tesseract-*` ones (copied, then the old one removed), once per prefix (marker `$XDG_STATE_HOME/tesseract/legacy-volumes.<prefix>.migrated`, default
`~/.local/state/…`); only for the default project and prefix, never with
`TESSERACT_SKIP_LEGACY_MIGRATION=1`. The old image is never reused: its controller only speaks
the old names, so the new image is built. The desktop app, the `tesseract` CLI, the host shell
daemon and the sandbox entrypoint each copy or move their own legacy dirs once. Details and the
manual steps: [rebrand-migration.md](../runbooks/rebrand-migration.md). The mobile app and the
controller are upgraded together (renamed deep-link scheme and in-page message names).

## 4. Environment variables

### 4.1 Controller

| Var | Default | Meaning |
|---|---|---|
| `TESSERACT_HOST` | `0.0.0.0` | bind address |
| `TESSERACT_PORT` | `7700` | HTTP/WS port (`0` = ephemeral, tests) |
| `TESSERACT_WORKSPACE` | `/workspace` | workspace root |
| `TESSERACT_DATA_DIR` | `$TESSERACT_WORKSPACE/.agent/controller` | sqlite, token, logs |
| `TESSERACT_TOKEN` | — | bearer token; if unset, read `TESSERACT_TOKEN_FILE`. When set, it is also written to `TESSERACT_TOKEN_FILE` so the in-sandbox CLI works without the variable |
| `TESSERACT_TOKEN_FILE` | `$TESSERACT_DATA_DIR/token` | generated on first start (32 random bytes, base64url, mode 0600) |
| `TESSERACT_PUBLIC_URL` | `http://127.0.0.1:$TESSERACT_PORT` | URL the phone should use (tailscale: `https://<host>.<tailnet>.ts.net`) — used for pairing links only |
| `TESSERACT_DISPLAY` | `:1` | X display for GUI processes/screenshots |
| `TESSERACT_VNC_HOST` / `TESSERACT_VNC_PORT` | `127.0.0.1` / `5901` | RFB target for the WS bridge |
| `TESSERACT_VNC_PASSWORD` | — | returned to authenticated clients so noVNC can log in |
| `TESSERACT_CHROMIUM_DEBUG_PORT` | `9222` | Chromium DevTools port on `127.0.0.1` read by `GET /v1/display/browser`; `/etc/chromium.d/tesseract` starts Chromium with `--remote-debugging-address=127.0.0.1 --remote-debugging-port=$TESSERACT_CHROMIUM_DEBUG_PORT --user-data-dir=$HOME/.config/chromium-tesseract` (Chromium 136+ refuses remote debugging on the default profile) |
| `TESSERACT_CLAUDE_BIN` | `claude` | Claude Code executable |
| `TESSERACT_CLAUDE_PERMISSION_MODE` | `bypassPermissions` | passed to headless Claude runs (the container is the boundary) |
| `TESSERACT_CLAUDE_ACCOUNTS` | — | extra Claude accounts, names separated by commas or spaces (`work,personal`, each `[a-z0-9][a-z0-9_-]{0,31}`): `<n>` → `$HOME/.claude-<n>`, id `claude-<n>`. Set by `infra/scripts/sandbox` from the mounted `TESSERACT_HOST_CLAUDE_ACCOUNTS` |
| `CLAUDE_CONFIG_DIR` | `$HOME/.claude` | Claude Code config dir of the primary account; `GET /v1/usage` and `GET /v1/sessions` read the `projects/<encoded-cwd>/<sessionId>.jsonl` transcripts and `sessions/<pid>.json` of every account's dir; a missing dir means no usage. `/v1/claude/*` read and write its `.credentials.json` and `settings.json`, and the global config `$CLAUDE_CONFIG_DIR/.claude.json` when the variable is set, else `$HOME/.claude.json` (Claude Code's rule) |
| `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` | — | not configured by the stack (Claude auth is the host's Max login only); if set manually anyway, `GET /v1/claude/auth` still reports them (`sources`, `oauthTokenFromEnv`) and children inherit them as usual |
| `TESSERACT_SANDBOX_ID` | container hostname | identity shown in the app |
| `TESSERACT_TAILSCALE_SOCKET` | `/run/tailscale/tailscaled.sock` | tailscaled LocalAPI socket for `GET /v1/identity`; missing socket = Tailscale identity unavailable |
| `TESSERACT_LOG_LEVEL` | `info` | `debug|info|warn|error` |
| `TESSERACT_CORS_ORIGINS` | `*` | comma list; auth is header/ticket based, never cookies |
| `SHELL` | `bash` | login shell for `shell` terminals (`$SHELL -l`) |
| `TESSERACT_STT_ENGINE` | `whisper.cpp` | speech-to-text for `POST /v1/transcriptions`: `whisper.cpp` (local only, never calls a paid API) \| `auto` \| `openai-compatible` \| `none`. `auto` = whisper.cpp when its binary, ffmpeg and a model file exist, else openai-compatible when `TESSERACT_STT_URL` and `TESSERACT_STT_API_KEY` are set, else 503 naming these variables. Checked per request |
| `TESSERACT_STT_PROFILE` | `eco` | initial resource profile (`off` \| `eco` \| `balanced` \| `performance`, see `GET /v1/stt`); a profile chosen with `PUT /v1/stt` is stored in the database and wins |
| `TESSERACT_WHISPER_BIN` | `whisper-cli` (image: `/opt/whisper/bin/whisper-cli`) | whisper.cpp CLI |
| `TESSERACT_WHISPER_MODELS_DIR` | `/opt/whisper/models` | absolute dir the profiles load `ggml-<model>.bin` from |
| `TESSERACT_WHISPER_MODEL` | — (image: `/opt/whisper/models/ggml-model.bin`) | absolute path of the fallback ggml model, used when the profile's model is missing from `TESSERACT_WHISPER_MODELS_DIR` |
| `TESSERACT_FFMPEG_BIN` | `ffmpeg` | converts audio to 16 kHz mono WAV for whisper.cpp |
| `TESSERACT_STT_URL` | — | OpenAI-compatible base URL (`http(s)`, no credentials/query), e.g. `https://api.openai.com/v1`, `https://api.groq.com/openai/v1`; the controller posts to `<url>/audio/transcriptions` |
| `TESSERACT_STT_API_KEY` | — | bearer key for `TESSERACT_STT_URL`; never logged, never passed to children (optional with `TESSERACT_STT_ENGINE=openai-compatible`, e.g. a local server) |
| `TESSERACT_STT_MODEL` | `whisper-1` | model field of the OpenAI-compatible request (e.g. `whisper-large-v3-turbo` on Groq) |
| `TESSERACT_GEMINI_STT_MODEL` | `gemini-2.5-flash` | Gemini model used for `provider: "gemini"`. The key is not an env var: it is saved from the mobile or desktop app or `tesseract --gemini-key=KEY` (`PUT /v1/stt { geminiApiKey }`); no key = those fall back to the native engine |
| `TESSERACT_PUSH_URL` | `https://exp.host/--/api/v2/push/send` | Expo push API used for inbox pushes (`http(s)`, no credentials/query); `off` disables pushes |
| `TESSERACT_EXPO_ACCESS_TOKEN` | — | optional Expo access token, sent as `Authorization: Bearer` when Expo's enhanced push security is on |
| `TESSERACT_APNS_KEY_FILE` | — | absolute path of the APNs auth key (`AuthKey_<KEYID>.p8`) used for Live Activity (Dynamic Island) pushes; with `TESSERACT_APNS_KEY_ID` and `TESSERACT_APNS_TEAM_ID` it enables them, setting only some of the three stops startup, none = tokens are stored but nothing is sent ([runbook](../runbooks/live-activities.md)) |
| `TESSERACT_APNS_KEY_ID` | — | id of that key (1-64 letters/digits) |
| `TESSERACT_APNS_TEAM_ID` | — | Apple developer team id (1-64 letters/digits) |
| `TESSERACT_APNS_BUNDLE_ID` | `com.kevinroan.tesseract` | bundle id of the app; the `apns-topic` is `<bundle id>.push-type.liveactivity`. The development build (`APP_VARIANT=development`, see [getting started](../runbooks/getting-started.md)) is `com.kevinroan.tesseract.dev` |
| `TESSERACT_ADB_TUNNEL_PORT` | `15555` | sandbox loopback port tunnelled to the host emulator's adbd over the Android link |
| `TESSERACT_ADB` | `adb` | adb client used for `adb connect`/`disconnect` of the tunnel |
| `TESSERACT_FLUTTER` | `flutter` | Flutter SDK entry point of the `flutter-*` and Flutter `test` run targets; they are unavailable when it is not found |
| `TESSERACT_APNS_ENV` | `production` | `production` (`api.push.apple.com`) or `sandbox` (`api.sandbox.push.apple.com`, development builds) |

Invalid values stop startup with a clear message. The controller must run on a
developer laptop too (for tests): every sandbox dependency (X display, VNC,
claude, wine, java) is optional and reported as unavailable instead of crashing.

Children (processes, build steps, terminals, agent runs, git/zip helpers) get the
controller's environment **without** `TESSERACT_TOKEN`, `TESSERACT_VNC_PASSWORD`, and `TESSERACT_STT_API_KEY`, plus
`TESSERACT_PROCESS_ID` / `TESSERACT_BUILD_ID` / `TESSERACT_TERMINAL_ID` / `TESSERACT_AGENT_RUN_ID`.
Agent runs also drop `CLAUDECODE`. The controller does not store or inject Claude
credentials: children use the host's Claude Max login in `/home/dev/.claude` (the host's
`~/.claude`, bind-mounted), the only supported authentication. Agent runs and `claude`
terminals on another account (§5.2 `/v1/claude/accounts`) get `CLAUDE_CONFIG_DIR=/home/dev/.claude-<n>`;
the account is the resumed session's (newest run with that session id), else the project's, else the default.

### 4.2 Stack and operator (`infra/compose/.env`, `infra/scripts/sandbox`)

Compose interpolates these; a container receives only the variables its compose file
lists. Exported shell variables win over the env file; empty counts as unset.

| Var | Default | Meaning |
|---|---|---|
| `TESSERACT_MODE` | `tailscale` | `tailscale` \| `host-tailscale` \| `local` (§9); `--mode` wins |
| `TESSERACT_DIND` | — | `1` adds `compose.dind.yml` (same as `--dind`) |
| `TESSERACT_TAILSCALE_LOCALAPI` | — | `1` shares the tailscaled LocalAPI socket with the sandbox (same as `--tailscale-api`, §9) |
| `TESSERACT_TAILSCALE_HOST_SOCKET_DIR` | `/var/run/tailscale` | host directory holding `tailscaled.sock` (host-tailscale/local with `--tailscale-api`); `up` refuses when the socket is missing |
| `TESSERACT_COMPOSE_PROJECT` | `tesseract` | compose project name (`[a-z0-9][a-z0-9_-]*`) |
| `TESSERACT_VOLUME_PREFIX` | `$TESSERACT_COMPOSE_PROJECT` | prefix of every named volume |
| `TESSERACT_IMAGE` | `tesseract/sandbox:latest` | image the stack runs and `sandbox build` tags |
| `TESSERACT_HOSTNAME` | `tesseract-sandbox` | tailnet node name, `TESSERACT_SANDBOX_ID` |
| `TESSERACT_SKIP_LEGACY_MIGRATION` | — | `1`: skip the Docker steps of the pre-rename migration (§3; also read by the desktop app and `tesseract server install`) |
| `TS_AUTHKEY` | — | first login of the sidecar only (`TS_AUTH_ONCE=true`) |
| `TS_TAILNET_DOMAIN` | — | e.g. `tail1234.ts.net`; required in tailscale mode, builds `TESSERACT_PUBLIC_URL` |
| `TS_EXTRA_ARGS` | — | extra `tailscale up` flags |
| `TESSERACT_BIND_ADDR` | host-tailscale: `tailscale ip -4`; local: `127.0.0.1` | IPv4 the ports are published on; wildcards and non-IPv4 values are refused |
| `TESSERACT_CONTROLLER_HOST_PORT` / `TESSERACT_VNC_HOST_PORT` | `7700` / `5901` | host side of the published ports; `TESSERACT_PUBLIC_URL` follows |
| `TESSERACT_TOKEN`, `TESSERACT_VNC_PASSWORD`, `TESSERACT_LOG_LEVEL`, `TESSERACT_CLAUDE_PERMISSION_MODE`, `TESSERACT_CORS_ORIGINS` | as §4.1 | passed to the sandbox |
| `TESSERACT_STT_ENGINE`, `TESSERACT_STT_PROFILE`, `TESSERACT_STT_URL`, `TESSERACT_STT_API_KEY`, `TESSERACT_STT_MODEL`, `TESSERACT_WHISPER_MODELS_DIR`, `TESSERACT_WHISPER_MODEL`, `TESSERACT_GEMINI_STT_MODEL` | as §4.1 | passed to the sandbox; the entrypoint moves `TESSERACT_STT_API_KEY` into `/run/tesseract/controller.env` like `TESSERACT_TOKEN` |
| `TESSERACT_DISPLAY_GEOMETRY` | `1600x900` | Xvnc geometry |
| `TESSERACT_HOST_CLAUDE_DIR` | `$HOME/.claude` | host dir bind-mounted at `/home/dev/.claude`: the host's Claude Max login is the sandbox's only Claude credential (`ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` are not passed through) |
| `TESSERACT_HOST_CLAUDE_ACCOUNTS` | — | extra host Claude accounts (`work personal`, or `name=/abs/path`): `infra/scripts/sandbox` writes a compose override (`${XDG_STATE_HOME:-~/.local/state}/tesseract/compose.<project>.claude-accounts.yml`, added to every compose call) binding each existing `~/.claude-<n>` at `/home/dev/.claude-<n>` and passing `TESSERACT_CLAUDE_ACCOUNTS`; missing dirs are skipped with a warning, never created |
| `TESSERACT_HOST_ANDROID_SDK` | — | absolute path of a Linux x86_64 host Android SDK: adds `compose.host-android-sdk.yml`, bind-mounting it read-only at `/opt/android-sdk` over the image's. `up` refuses on a non-Linux/x86_64 host or a dir without `platform-tools/` and `platforms/` |
| `TESSERACT_HOST_GRADLE_CACHE` | — | absolute path of the host Gradle user home's `caches/` (holds `modules-2/`): adds `compose.host-gradle-cache.yml`, bind-mounting it read-only at `/opt/gradle-ro-cache` with `GRADLE_RO_DEP_CACHE` set. `up` refuses without `modules-2/` |
| `SANDBOX_CPUS` / `SANDBOX_MEMORY` / `SANDBOX_PIDS` | `4` / `8g` / `4096` | sandbox limits |
| `DIND_CPUS` / `DIND_MEMORY` / `DIND_PIDS` | `4` / `8g` / `4096` | dind limits (cap everything it runs) |
| `TZ` | `UTC` | sandbox time zone |
| `DEV_UID`, `DEV_GID`, `WITH_ANDROID`, `WITH_MONO`, `CLAUDE_CODE_VERSION`, `WITH_WHISPER`, `WHISPER_MODELS` | §8 | build args passed by compose (compose defaults `WITH_WHISPER=true`, `WHISPER_MODELS="base small"`) |

Image-provided environment: `TESSERACT_IMAGE_VERSION`, `TESSERACT_WORKSPACE`,
`TESSERACT_HOST`, `TESSERACT_PORT`, `TESSERACT_DATA_DIR`, `TESSERACT_VNC_HOST`, `TESSERACT_DISPLAY`,
`TESSERACT_DISPLAY_GEOMETRY`, `TESSERACT_VNC_PORT`, `XDG_RUNTIME_DIR=/run/user/<uid>`,
`WINEPREFIX`/`WINEARCH`/`WINEDEBUG`, `APPIMAGE_EXTRACT_AND_RUN=1`, `DISABLE_AUTOUPDATER=1`,
`JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `TESSERACT_WHISPER_BIN`, `TESSERACT_WHISPER_MODELS_DIR`, `TESSERACT_WHISPER_MODEL`. `DISPLAY` is not set globally: only
interactive login shells get `DISPLAY=:1` (`/etc/profile.d/tesseract.sh`). Rootfs helper
knob: `TESSERACT_WAIT_X_TIMEOUT` (s, default 60).

### 4.3 Host shell daemon (`tesseract-controller host …`, runs on the host)

| Var | Default | Meaning |
|---|---|---|
| `TESSERACT_HOST_SHELL_BIND` | first line of `tailscale ip -4` (`tailscale` from `PATH`, else on macOS `/Applications/Tailscale.app/Contents/MacOS/Tailscale`) | IPv4 to listen on; `--bind` wins. Wildcards, empty values and anything but loopback or `100.64.0.0/10` stop startup |
| `TESSERACT_HOST_SHELL_PORT` | `7701` | port; `--port` wins |
| `TESSERACT_HOST_SHELL_DIR` | `$XDG_CONFIG_HOME/tesseract/host-shell` (`~/.config/tesseract/host-shell`) | state directory (`state.json`) |
| `TESSERACT_HOST_SHELL_PUBLIC_URL` | the `tailscale serve` HTTPS URL proxying to `http://<bind>:<port>` at `/` (`tailscale serve status --json`), else `http://<bind>:<port>` | URL put into the `host pair` link. iOS blocks plain http to the Tailscale IP, so serve it over HTTPS: `tailscale serve --bg --https=8443 http://<bind>:7701` |
| `SHELL` | `bash` | host terminals run `$SHELL -l` in `$HOME` |
| `TESSERACT_ANDROID_SDK_ROOT` | `$HOME/.local/share/tesseract/android-sdk` if it has `emulator/emulator`, else `$ANDROID_SDK_ROOT`, else `$ANDROID_HOME` | SDK with `emulator/` and `system-images/` |
| `TESSERACT_ADB` | `adb` | host adb client (the user's adb server on 5037) |
| `TESSERACT_SCRCPY_SERVER` | `/usr/share/scrcpy/scrcpy-server`, else `/usr/local/share/scrcpy/scrcpy-server`, else (Homebrew on Apple silicon) `/opt/homebrew/share/scrcpy/scrcpy-server` | scrcpy server jar |
| `TESSERACT_SCRCPY_VERSION` | parsed from `scrcpy --version` | must equal the jar's version |
| `TESSERACT_FFMPEG` | `ffmpeg` | H.264 → MJPEG for `/v1/android/screen` viewers that can't decode H.264 (or with `encoding: "mjpeg"`) |
| `TESSERACT_EMULATOR_PORT` | `5554` | emulator console port; adbd = +1; serial `emulator-<port>` when not isolated |
| `TESSERACT_EMULATOR_GPU` | macOS: `host`; Linux: `swiftshader_indirect` | emulator `-gpu` |
| `TESSERACT_EMULATOR_ISOLATION` | Linux: `netns`; macOS: `none` (no user/network namespaces) | `netns`: emulator in its own user + network namespace, guest egress only to public addresses through a filtering proxy, adb via a host bridge (serial `127.0.0.1:<port>`); needs `unshare`, `ip` and unprivileged user namespaces, else `GET /v1/android` is `available: false`. `none`: emulator on the host network (the guest, and the linked sandbox, can reach host loopback, LAN, tailnet) |
| `TESSERACT_EMULATOR_ALLOW_NETS` | — | comma-separated CIDRs the isolated guest may still reach (e.g. a LAN backend) |
| `TESSERACT_EMULATOR_ADB_PORT` | free port, kept across daemon restarts | host loopback port of the adb bridge to the isolated emulator |
| `TESSERACT_ANDROID_SHARE_EMULATORS` | `off` | `on`: also tunnel every other online `emulator-<port>` the host adb lists (Android Studio, `emulator -avd …`) to the linked sandbox. They run on the host network, so **the sandbox can reach host loopback (incl. the host adb server), LAN and tailnet through them** |

Host terminals get the daemon's environment without `TESSERACT_HOST_SHELL_*`, plus
`TERM=xterm-256color`, `COLORTERM=truecolor`, `LANG`.

The desktop app (Preferences → Host Shell, and the "This Computer" tab of Pair a Device) drives the same
CLI: it runs `host serve` as its child process (stopped on quit; `setpriv --pdeathsig` when available),
sets the PIN with `host pin --stdin`, rotates with `host token --rotate` and reads `host pair --json`.
It runs `bun apps/controller/src/index.ts` from its checkout, or `TESSERACT_CONTROLLER_COMMAND`;
"Start With Tesseract" is `host_shell_autostart` in the desktop `config.json`. The Electron app
(`apps/electron`, §12) resolves the command in this order: `TESSERACT_CONTROLLER_COMMAND`, the bundled
`resources/bin/tesseract-controller` in a packaged build, `bun apps/controller/src/index.ts` in a checkout,
then `apps/controller/dist/tesseract-controller`. It fills `TESSERACT_ANDROID_SDK_ROOT` (and `TESSERACT_ADB`) from the
SDK its setup wizard installed when they are not already set.

A project's detail page has **Host shell**, **Pull** and **Push** for the project's host copy (the
`hostPath` of its sync-back link; all three are disabled without one). Host shell needs the daemon
running with a PIN and an unlocked session (the same PIN prompt as the host emulator), then
`POST /v1/terminals` with `cwd: hostPath` and opens the daemon's `/ui/terminal` page in its own window.
Pull and Push run `git pull --ff-only` / `git push` in `hostPath` from the main process
(`GIT_TERMINAL_PROMPT=0`, 5 min timeout); they act on this computer's own repo like sync-back, so they
need no PIN.

### 4.4 Desktop app and `tesseract` CLI (`apps/electron`, runs on the host)

| Var | Default | Meaning |
|---|---|---|
| `TESSERACT_DESKTOP_CONFIG` | see §12.4 | path of `config.json` (app and CLI) |
| `TESSERACT_USER_DATA` | OS user-data dir (§12.4) | Electron `userData`: sandbox env file, downloads, Android catalog cache, window state |
| `TESSERACT_STATE_DIR` | `$XDG_STATE_HOME/tesseract`, else `~/.local/state/tesseract` (Windows `%LOCALAPPDATA%\Tesseract\state`) | sync-back links and snapshots (shared with the GTK app) |
| `TESSERACT_DESKTOP_URL` / `TESSERACT_TOKEN` / `TESSERACT_DESKTOP_NAME` / `TESSERACT_DESKTOP_PAIRING_URL` | — | connection used when `config.json` has none (url + token both required) |
| `TESSERACT_DESKTOP_LOG` | `info` | main-process log level `debug\|info\|warn\|error` (`--debug` = `debug`) |
| `TESSERACT_FIXTURES` | — | `1` = renderer runs on fixtures (no controller, no Docker); set by snapshots and e2e |
| `TESSERACT_SNAPSHOT` | — | `1` = isolated run: no single-instance lock (snapshots, e2e) |
| `TESSERACT_CONTROLLER_COMMAND` | — | command line for the host shell daemon (§4.3) |
| `TESSERACT_SANDBOX_IMAGE_REF` | — | registry ref the wizard may **pull** instead of building (`sandboxImageRef` in `config.json` wins) |
| `TESSERACT_DISABLE_UPDATES` | — | set = no background update checks |
| `TESSERACT_DISABLE_DISCOVERY` | — | `1` = no Docker discovery of a running sandbox on first run (§12.2); set by the tests |
| `TESSERACT_ANDROID_REPOSITORY_URL` / `TESSERACT_ANDROID_SYSIMG_URL` | Google's `…/repository/repository2-3.xml` / `…/sys-img/google_apis/sys-img2-3.xml` | Android catalog mirror (app and CLI): a full `.xml` URL, or a base URL the default file name is appended to; `http`/`https` only, else `invalid_argument` |
| `TESSERACT_APP_PATH` | installed app (AppImage copy: `appPath` in `~/.local/share/tesseract/app.json`, §12.5) | CLI: the app executable `tesseract open` launches |
| `TESSERACT_SANDBOX_CONTEXT` | bundled `resources/sandbox`, else (AppImage copy) `sandboxDir` in `~/.local/share/tesseract/app.json`, else the checkout | CLI: directory holding `infra/compose` and the Dockerfile |
| `TESSERACT_SERVER_TS_AUTHKEY` | saved key | Tailscale auth key new server containers join with (overrides `config.json`) |
| `TESSERACT_CLOUDFLARE_TOKEN` | saved token | Cloudflare API token for public URLs (overrides `config.json`) |
| `ELECTRON_RENDERER_URL` | — | set by `electron-vite dev` to `http://127.0.0.1:4545` |
| `TESSERACT_COMPOSE_PROJECT`, `TESSERACT_CONTROLLER_HOST_PORT`, `TESSERACT_BIND_ADDR` | §4.2 | read by sandbox discovery (find a running `tesseract` stack and its controller port) |
| `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME` | — | move config, state and cache dirs as usual (also on macOS/Windows when set) |
| `ANDROID_AVD_HOME`, `ANDROID_USER_HOME` | `~/.android/avd` | where AVDs are written and listed |

Build-time only (`scripts/dist.ts`): `TESSERACT_UPDATE_URL`, `TESSERACT_UPDATE_CHANNEL` (update feed),
`TESSERACT_NOTARIZE` + `APPLE_API_KEY`/`APPLE_API_KEY_ID`/`APPLE_API_ISSUER`, or `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`,
or `APPLE_KEYCHAIN_PROFILE` [`APPLE_KEYCHAIN`] (macOS notarization). E2E only: §11.

## 5. Controller protocol v1

`PROTOCOL_VERSION = 1`. JSON over HTTPS; all REST paths are under `/v1`.

### 5.1 Auth and errors

* REST: `Authorization: Bearer <token>`; constant-time compare. Only
  `GET /v1/health` is public. 401 responses carry `WWW-Authenticate: Bearer realm="tesseract"`.
* WebSocket and browser-opened URLs (WebView pages, artifact and build output downloads, upload content) use a
  **one-time ticket**: `POST /v1/auth/ticket` → `200 { ticket, expiresAt }`
  (random 32 bytes, valid 60 s, consumed on first use, not scoped to a target).
  WS URLs take `?ticket=`; a ticket is never accepted as a bearer token.
* Browser pages under `/ui/*` are static and secret-free; they read
  `ticket`/`password`/`session`/`viewOnly`/`input` from the **URL fragment** (`#…`, never sent
  to the server), clear it, and then open the WS with `?ticket=`.
* Errors: HTTP status + `{ "error": { "code": string, "message": string } }`.
  Codes → status: `bad_request` 400, `unauthorized` 401, `forbidden` 403,
  `not_found` 404, `conflict` 409, `internal` 500, `unavailable` 503. Exceptions:
  bodies over 1 MiB (8 MiB for `POST /v1/claude/import`, 28 MiB for `POST /v1/uploads`, 1 GiB for `POST /v1/projects/:id/sync` and `POST /v1/sync/requests/:id/apply`, 64 MiB for `POST /v1/sync/requests/:id/plan`) get **413** with code `bad_request`; a plain GET (no upgrade) on a
  WS-only path gets 400.

### 5.2 REST endpoints

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/v1/health` | — | `Health { ok, version, protocolVersion, sandboxId }` |
| POST | `/v1/auth/ticket` | — | `200 Ticket { ticket, expiresAt }` |
| GET | `/v1/status` | — | `SandboxStatus` |
| GET | `/v1/identity` | — | `Identity`: Tailscale viewer, owner, node and tailnet (§5.4); never fails because Tailscale is unreachable, it reports `available: false` and nulls |
| GET | `/v1/claude/accounts` | — | `ClaudeAccountList { defaultAccountId, accounts: ClaudeAccountProfile[] }`: primary first, then `TESSERACT_CLAUDE_ACCOUNTS` order; login, account, plan and expiry per dir; never contains a secret |
| PUT | `/v1/claude/accounts/default` | `SetDefaultClaudeAccount { accountId }` | `200 ClaudeAccountList`; 404 unknown, 400 not mounted. Used by runs and terminals whose project has no account of its own |
| GET | `/v1/claude/auth` | — | `ClaudeAuthStatus` (§5.4): which credential the sandbox's Claude Code uses (`method` = first of `oauth_token`, `credentials`, `api_key`, else `none`), account from the global config's `oauthAccount`, subscription and expiry from `.credentials.json`; never contains a secret |
| POST | `/v1/claude/import` | `ClaudeImport { credentials?, account?, files? }` (body limit 8 MiB) | `200 ClaudeImportResult { status, written, skipped }`: `credentials` replaces `claudeAiOauth` in `.credentials.json` (other keys kept); `account` merges only `CLAUDE_IMPORT_ACCOUNT_KEYS` into the global config (`projects` etc. kept); `files` must be normalized relative paths matching `CLAUDE_IMPORT_PATHS` that stay in `$CLAUDE_CONFIG_DIR` without symlinks leading out; `settings.json` must be a JSON object and loses `CLAUDE_IMPORT_DROPPED_SETTINGS` (`settings.json#<key>` in `skipped`). Files are written atomically; `settings.json`, `.credentials.json` and the global config are first copied to `<file>.tesseract-bak`. `written`/`skipped` paths are relative to `$CLAUDE_CONFIG_DIR`; the global config is `.claude.json` (inside it) or `~/.claude.json`. Refused parts go to `skipped`; only schema errors are 400 |
| GET | `/v1/context` | — | `AgentContext { files: AgentContextFile[] }`: regular files `.agent/*.md` and `.agent/projects/<id>/*.md` (no symlinks, FIFOs or devices), content capped at 64 KiB each |
| GET | `/v1/projects` | — | `Project[]` |
| POST | `/v1/projects` | `CreateProject { name, gitUrl?, branch?, confidential? }` | `201 { project, processId? }` (clone runs as a tracked process); 409 if the directory exists; `confidential: true` marks the project confidential (§6.1, the client sends a pseudonym as `name`) |
| GET | `/v1/projects/:id` | — | `Project` |
| PUT | `/v1/projects/:id/name` | `RenameProject { name: string \| null }` | `200 Project` and `project.updated`; sets the display name only (id and directory stay); null restores the package.json name or id; 404 unknown project |
| PUT | `/v1/projects/:id/claude-account` | `SetProjectClaudeAccount { accountId: string \| null }` | `200 Project` and `project.updated`; null follows the default account; 404 unknown project or account, 400 for an account whose dir is not mounted |
| DELETE | `/v1/projects/:id` | `?force=1` (or `true`) | `200 DeletedProject { id, trashPath }`: moves `/workspace/projects/<id>` to `<os tmpdir>/tesseract-deleted-projects/<id>-<ts>` (the host copy is never touched), drops the sync-back baseline and blobs (the confidential mark stays), publishes `sync.changed`, `project.deleted`; without `force`, 409 when the project has changes not synced back to the host or no baseline (never pushed from a host); 409 (even with `force`) while a process, build, terminal or agent run of the project is running or a `pending`/`claimed` sync request exists; 404 unknown project |
| POST | `/v1/projects/:id/sync` | `?confidential=1`; tar archive body, `Content-Type` `application/x-tar` or `application/gzip` (body limit 1 GiB) | `201 Project` when the directory was created, else `200 Project`: `confidential=1` (exactly `1`) first marks the project confidential (one-way; other values or none leave the mark as is); extracts with `tar --no-same-owner` over `/workspace/projects/<id>`; files missing from the archive are kept; a bad archive is 400 (a directory created for it is removed), another content type 400; publishes `project.updated`. Sent by `tesseract --sync` (desktop), which archives the cwd (in a git checkout: tracked and unignored files, plus `.git` at the top level) |
| GET | `/v1/projects/:id/git` | — | `GitDetails { branch, ahead, behind, files: GitFileStatus[], log: GitCommit[] }`; in a confidential project every `author` is `REDACTED` |
| GET | `/v1/projects/:id/files` | `?path=` (project-relative, default the root) | `ProjectDirectory { projectId, path, entries: ProjectFile[], truncated }`: folders first, then by name; `ProjectFile { name, path, kind: "dir" \| "file" \| "symlink" \| "other", sizeBytes (files only), modifiedAt }`; at most 2000 entries (`truncated`); 404 unless the realpath stays inside the project, 400 for a non-directory |
| GET | `/v1/projects/:id/files/download` | `?path=`; bearer **or** `?ticket=` | file stream (`Content-Disposition: attachment`, single `Range` → 206); 404 unless the realpath stays inside the project, 400 for a non-regular file |
| POST | `/v1/projects/:id/files/taildrop` | `SendProjectFile { path, targetId }` | `ProjectFile` once LocalAPI `file-put` accepted the file; errors as `POST /v1/artifacts/:id/taildrop` |
| GET | `/v1/projects/:id/storage` | — | `ProjectStorage { projectId, totalBytes, sourceBytes, entries: { category: "dependencies" \| "builds" \| "caches", sizeBytes, paths }[], measuredAt }`: `du -sk` of the project folder (`.git` included) and of regenerable folders found by name (`node_modules`, `.venv`, `Pods`…; `build`, `dist`, `out`, `release`, `target`…; `.gradle`, `.expo`, `.next`, `__pycache__`…; not descending into them or `.git`, depth 8). In a git work tree a folder counts only when `git check-ignore` matches it; outside git only `dependencies` and `caches` count. Cached 30 s per project |
| POST | `/v1/projects/:id/storage/clear` | `ClearProjectStorage { categories?: StorageCategory[] }` (omitted: all) | `200 ProjectStorage` re-measured after deleting the folders a fresh scan finds for those categories (source is never touched); 409 while a process, build, terminal or agent run of the project is running |
| GET | `/v1/projects/:id/sync/changes` | — | `SyncChanges`: current tree vs the baseline recorded by the last push ([sync-back.md](sync-back.md)); 404 unknown project |
| POST | `/v1/projects/:id/sync/export` | `SyncExport { paths: SyncPath[] (1–5000) }`, each a current `added`/`modified` change | `200 application/gzip` tar of those files (regular files and symlinks only); 400 for a path that is not a current change |
| POST | `/v1/projects/:id/sync/ack` | `SyncAck { changes: { path, sha256 \| null, executable? }[] }` | `200 SyncChanges`; moves the baseline entries to the acked hashes and executable bits (null removes; `executable` omitted: the sandbox file's, when its hash matches); stores the blob of each acked hash the sandbox file has; publishes `sync.changed` |
| POST | `/v1/projects/:id/sync/discard` | `SyncDiscard { paths?: SyncPath[] (1–5000) }` (omitted: every change) | `200 SyncDiscardResult { discarded, unavailable, backupPath, changes }`: puts the sandbox files back to the baseline (`added` removed, others restored from blobs with the baseline executable bit; no blob → `unavailable`, untouched), sandbox versions copied to `sync/backups/<id>/discard-<ts>/` first, all or nothing; 400 without a baseline or for a path that is not a current change or is behind a sandbox symlink; 409 while a `pending`/`claimed` request exists; 500 when it failed and was rolled back; publishes `sync.changed`, `project.updated` |
| GET | `/v1/projects/:id/sync/requests` | — | `SyncRequest[]` newest first (last 50) |
| POST | `/v1/projects/:id/sync/requests` | `CreateSyncRequest { kind: "pull" \| "revert" \| "get", paths?, force?, source? }` | `201 SyncRequest`; 409 while a `pending`/`claimed` request exists; 400 for `pull`/`get` without a baseline; publishes `sync.updated` |
| GET | `/v1/sync/requests?status=` | — | `SyncRequest[]` across projects (desktop polls `status=pending`) |
| POST | `/v1/sync/requests/:id/claim` | `ClaimSyncRequest { host }` | `200 SyncRequest` (`claimed`); 409 unless `pending`; publishes `sync.updated` |
| POST | `/v1/sync/requests/:id/complete` | `CompleteSyncRequest { status: "applied" \| "failed", result?, error? }` | `200 SyncRequest`; 409 unless `claimed`; publishes `sync.updated` |
| POST | `/v1/sync/requests/:id/cancel` | — | `200 SyncRequest` (`cancelled`); 409 unless `pending`; publishes `sync.updated` |
| POST | `/v1/sync/heartbeat` | `SyncHeartbeat { host, projects: ProjectId[], changes?: Record<ProjectId, number> }` | `204`; remembers the host per linked project for `SyncChanges.host` (online = seen in the last 60 s) and its host-side change count; publishes `sync.changed` when a count moves |
| POST | `/v1/sync/requests/:id/plan` | `SyncGetPlan { hostPath, changes: { path, kind, sha256 \| null, executable }[] (≤ 5000), git: { changed, deleted } \| null }` | `200 SyncGetPlanResponse { request, upload, gitUpload }`; 409 unless a `claimed` `get`; 400 for a duplicate path, a hash on a delete (or none on an add/modify) or a path behind a sandbox symlink; conflicts without `force` complete the request `failed` (sync-back.md §6) |
| POST | `/v1/sync/requests/:id/apply` | gzip or plain tar of exactly `upload` + `.git/<gitUpload>` (body limit 1 GiB) | `200 SyncRequest` (`applied` with the `get` stats, or `failed` on conflicts); 409 unless `claimed` with a plan; 400 for a bad archive or an unplanned hash (the request stays `claimed`); 500 when applying failed and was rolled back; publishes `sync.updated`, `sync.changed`, `project.updated` |
| GET | `/v1/processes` | `?projectId=` | `ProcessInfo[]` |
| POST | `/v1/processes` | `StartProcess { projectId, command, name?, env?, display?, port? }` | `201 ProcessInfo`; 409 when `port` is taken (message names the tracked process or pid) |
| GET | `/v1/processes/:id` | — | `ProcessInfo` |
| DELETE | `/v1/processes/:id` | — | `ProcessInfo` (§6.2) |
| GET | `/v1/processes/:id/logs` | `?tail=500` (1–2000) | `LogLine[]` |
| GET | `/v1/terminals` | — | `TerminalInfo[]` of the current controller lifetime (newest first) |
| POST | `/v1/terminals` | `CreateTerminal { kind: "shell"\|"claude", projectId?, cols, rows }` | `201 TerminalInfo`; 503 if `claude` or PTY support is missing. A `claude` terminal in a confidential project runs `claude --append-system-prompt <confidential prompt>` (§6.1) |
| DELETE | `/v1/terminals/:id` | — | `TerminalInfo` |
| GET | `/v1/builds` | `?projectId=` | `BuildJob[]` |
| POST | `/v1/builds` | `StartBuild { projectId, target, profile? }` (`profile` default `debug`) | `201 BuildJob`; 400 if the project lacks the target; 503 if the recipe needs `wine`/`java` and it is missing |
| GET | `/v1/builds/:id` | — | `BuildJob` |
| DELETE | `/v1/builds/:id` | — | `BuildJob` (cancel) |
| GET | `/v1/builds/:id/logs` | `?tail=500` | `LogLine[]` |
| GET | `/v1/artifacts` | `?projectId=` | `Artifact[]` |
| POST | `/v1/artifacts` | `ShareArtifact { path (absolute), projectId?, name?, note? (≤ 500), agentRunId?, sessionId? }` | `201 Artifact` (`source: "agent"`): copies a regular file inside `/workspace` (realpath; not under `artifacts/` or `TESSERACT_DATA_DIR` → 403) into the artifacts dir under its own name or `name`; `projectId` defaults to the project containing the path (none → 400; unknown explicit id → 404); `platform` from the extension (`.apk`/`.aab` android, `.exe`/`.msi`/`.msix`/`.appx` windows, `.deb`/`.rpm`/`.AppImage`/`.snap` linux, `.ipa` ios, `.dmg` macos, else `file`); an unknown `agentRunId` is dropped; publishes `artifact.created` and adds a `file` inbox item (never bumped) with `artifactId`; 403 `Project <id> is confidential; sharing artifacts is disabled` when the resolved project is confidential (build artifacts are unaffected). Sent by `tesseract-controller share` |
| DELETE | `/v1/artifacts/:id` | — | `Artifact` (deleted): removes the file and row, clears `artifactId` on inbox items (their text stays), publishes `artifact.deleted` |
| GET | `/v1/artifacts/:id/download` | bearer **or** `?ticket=` | file stream (`Content-Disposition: attachment`, `X-Content-SHA256`); 404 if the file is gone |
| GET | `/v1/outputs` | `?projectId=` | `BuildOutput[] { projectId, path (project-relative), fileName, sizeBytes, platform, modifiedAt }`, newest first, at most 500: deliverables (`.apk`/`.aab`/`.ipa`/`.exe`/`.msi`/`.msix`/`.appx`/`.AppImage`/`.deb`/`.rpm`/`.snap`/`.dmg`/`.pkg`/`.zip`/`.7z`/`.tar.*`) that plain builds left under a `build`/`builds`/`dist`/`release`/`releases`/`out`/`outputs`/`make`/`artifacts` folder of a project (e.g. `android/app/build/outputs/apk/…`, `release/build/…`, `out/make/…`). Found by scanning, not indexed; skips dot-folders, `node_modules`, Gradle `intermediates`/`generated`/`tmp`, `*-unpacked`, `*.app`, symlinks and electron-builder helpers (`__uninstaller*`, `elevate.exe`); depth ≤ 10, ≤ 20 000 entries per project. Unknown `projectId` → 404 |
| GET | `/v1/projects/:id/outputs/download` | `?path=` (project-relative); bearer **or** `?ticket=` | file stream (`Content-Disposition: attachment`, single `Range` → 206); 404 unless the realpath stays inside the project and still matches the `/v1/outputs` rules |
| GET | `/v1/taildrop/targets` | — | `TaildropTargets { available, targets: TaildropTarget[] }` from LocalAPI `file-targets`, sorted by host name; `available: false` with no targets when the LocalAPI socket is missing or fails (never an error) |
| POST | `/v1/artifacts/:id/taildrop` | `SendArtifact { targetId }` | `Artifact` once LocalAPI `file-put` accepted the file; 503 without the LocalAPI or when the push fails, 404 for an unknown target, 403 when tailscaled refuses |
| GET | `/v1/ports` | — | `ListeningPorts { tailscaleIp, ports: ListeningPort[] }`: TCP ports that visible sandbox processes listen on (not the controller or VNC port), each `{ port, pid, command, processId, projectId, url, dnsUrl }`; `url` is `http://<sandbox Tailscale IPv4>:<port>`, which reaches the port over the tailnet because the userspace sidecar forwards to `127.0.0.1`; both URLs are null without Tailscale |
| GET | `/v1/usage?days=` | — | `UsageReport { generatedAt, from, to, days, totals, daily, models, projects }` from Claude Code transcripts: `days` 1–90 (default 30) UTC days ending today, `daily` has every day oldest first (zero-filled), `models`/`projects` most tokens first; assistant messages are deduped by message id + request id (also across resumed-session files), `<synthetic>` messages are skipped, only files modified in the range are read; token counts only, no dollar cost; never fails because the directory is missing |
| GET | `/v1/sessions?limit=&projectId=` | — | `ClaudeSession[]` (default 20, max 200), newest `lastActiveAt` first, across every Claude account (`claudeAccountId`): title (first real prompt, ≤120 chars), preview (last assistant text, ≤160), model, usage (including subagent transcripts), `source` `agent-run`/`terminal`/`cli`, `agentRunId` (newest run with the session id), `terminalId` (running Claude terminal: `$CLAUDE_CONFIG_DIR/sessions/<pid>.json`, else the newest transcript with the terminal's cwd written since it started), `active` (run running or terminal attached); a session a later run resumed (`resumedSessionId`) under a new id is left out, so a chat lists once |
| GET | `/v1/inbox?limit=&unread=` | — | `Inbox { items: InboxItem[], unreadCount, attentionCount }`, newest `updatedAt` first (default 100, max 500; `unread=1`/`true` → unread only); `attentionCount` = unread `needs_input` + `permission` |
| POST | `/v1/inbox/read` | `MarkInboxRead { ids: InboxId[] } \| { all: true }` | `200 InboxCounts { unreadCount, attentionCount }`; unknown ids are ignored |
| POST | `/v1/hooks/claude` | `ClaudeHookPayload` (the Claude Code hook JSON, extra fields kept) | `202`; maps `Notification`/`Stop`/`StopFailure`/`UserPromptSubmit` to inbox items (controller.md "Inbox and Claude hooks"); other events are ignored. Sent by `tesseract-controller hook` |
| GET | `/v1/push/devices` | — | `PushDevice[]`, newest `updatedAt` first |
| POST | `/v1/push/devices` | `RegisterPushDevice { token (Expo push token), platform: "ios" \| "android", name? (≤ 128), deviceId? (≤ 128, id of the phone shared by its Tesseract builds) }` | `200 PushDevice`; upserts by token (a re-registered token keeps `createdAt`) and deletes the other tokens with the same `deviceId`. Unread `completed`/`failed`/`needs_input`/`permission`/`file` inbox items are then pushed to every device through `TESSERACT_PUSH_URL` (controller.md "Inbox and Claude hooks") |
| DELETE | `/v1/push/devices/:token` | — | `PushDevice` (removed); invalid token → 400, unknown → 404 |
| GET | `/v1/push/live-activities` | — | `LiveActivityToken[]`, newest `updatedAt` first |
| POST | `/v1/push/live-activities` | `RegisterLiveActivity { kind: "activity" \| "push-to-start", token (hex, 32-512 chars), activityId? (≤ 128, null for push-to-start) }` | `200 LiveActivityToken`; upserts by token (stored lower-case, `createdAt` kept). The controller then mirrors `IslandState` into the phone's Live Activity through ActivityKit pushes when `TESSERACT_APNS_*` is set (controller.md "Live Activities") |
| DELETE | `/v1/push/live-activities/:token` | — | `LiveActivityToken` (removed); invalid token → 400, unknown → 404 |
| GET | `/v1/display` | — | `DisplayStatus` |
| GET | `/v1/display/screenshot` | — | `image/png` of the virtual display; 503 without a display |
| GET | `/v1/display/browser` | — | `BrowserStatus { available, tabs: BrowserTab[] }`: Chromium `page` targets from the DevTools endpoint `http://127.0.0.1:$TESSERACT_CHROMIUM_DEBUG_PORT/json/list` (1.5 s timeout, `devtools://` pages dropped), in Chromium's order so `tabs[0]` is the current tab; `phoneUrl` rewrites an http(s) URL whose host is `localhost`, `*.localhost`, `127.0.0.0/8`, `0.0.0.0` or `[::1]` to the sandbox Tailscale IPv4 (else its MagicDNS name, as `/v1/ports`) keeping port/path/query/hash, passes other http(s) URLs through, and is null for other schemes or local URLs without Tailscale; an unreachable endpoint is `{ available: false, tabs: [] }`, never an error |
| GET | `/v1/display/windows` | — | `DisplayWindowList { windows: DisplayWindow[] }`, `DisplayWindow { id (hex like `0x03a00004`), title, app (WM_CLASS class or null), pid (or null), active, minimized }`: `wmctrl -lp` order (oldest first) minus docks, desktops, menus, splashes, tooltips, notifications and `_NET_WM_STATE_SKIP_TASKBAR` windows; `active` from the root's `_NET_ACTIVE_WINDOW`, `minimized` = `_NET_WM_STATE_HIDDEN`; 503 without a display |
| POST | `/v1/display/windows/:id/activate` | — | `204`; raises and focuses the window, restoring it when minimized (`wmctrl -ia`). Id not matching `^0x[0-9a-f]+$` → 400, not in the list above → 404, no display → 503 |
| POST | `/v1/display/windows/:id/close` | `CloseDisplayWindow { force? }` (body optional) | `204`; asks the window to close (`wmctrl -ic`, the app may still prompt or refuse); `force: true` disconnects its X client instead (`xdotool windowkill`). Errors as for `activate` |
| GET | `/v1/agent/runs` | `?projectId=&archived=` | `AgentRun[]` newest first (max 200): without `archived` (or `0`/`false`) only runs that are not archived, with `archived=1`/`true` only archived ones; running runs are never archived |
| POST | `/v1/agent/runs` | `StartAgentRun { projectId?, prompt, mode?, attachmentIds?, resumeSessionId? }` | `201 AgentRun`; 503 without `claude`; 404 for an unknown attachment. `mode` → `--permission-mode` (else `TESSERACT_CLAUDE_PERMISSION_MODE`; stored as `null`). Attachments are stored on the run as full `Upload`s; for non-audio ones the run gets `--add-dir <uploads dir>` and the stdin prompt gains `\n\nAttached files (read them with the Read tool):\n- <path> (<mimeType>)` lines. Audio attachments are not listed (the transcript is the prompt); they stay on the run for replay. In a confidential project (also when resuming) the run gets `--append-system-prompt <confidential prompt>` (§6.1) |
| POST | `/v1/uploads` | `CreateUpload { name, mimeType, data /* base64 */ }` (body limit 28 MiB) | `201 Upload`; 400 for invalid base64, an empty file or more than 20 MiB decoded. `name` → last path segment without control characters or leading dots, ≤ 200 UTF-8 bytes (extension kept), fallback `upload`; `mimeType` → lower-cased essence (`application/octet-stream` when malformed); `kind` = `image` (`image/*`), `pdf` (`application/pdf`), `audio` (`audio/*`), else `file` |
| GET | `/v1/uploads/:id/content` | bearer **or** `?ticket=` | file stream with the stored `Content-Type`, `Content-Disposition` `inline` (image/pdf/audio) or `attachment` (file), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`; single `Range: bytes=` requests get 206 (players that issue several range requests need bearer auth, a ticket is single-use); 404 if the file is gone |
| POST | `/v1/transcriptions` | `CreateTranscription { uploadId, language?, provider? }` | `200 Transcription { uploadId, text, language, durationMs, engine, fallbackReason }`; 404 unknown upload, 400 not audio, invalid `language` (ISO-639-1, region suffix dropped, `auto` = detect) or `No speech detected` (empty after dropping `[BLANK_AUDIO]`-style markers), 503 when the STT profile is `off` (`Speech-to-text is off (select a profile in the desktop app)`), when no engine is configured or it fails (message says which env vars to set). One transcription runs at a time; others wait in FIFO order (`busy`/`queued` in `GET /v1/stt`). whisper.cpp: `[ionice -c3] [nice -n <nice>]` prefix per profile (skipped when the binary is missing), ffmpeg → 16 kHz mono WAV in a temp dir, `whisper-cli -m <model> -t <threads> -l <lang\|auto> -oj`, 5 min timeout each, `durationMs` from the WAV. openai-compatible: multipart `file`, `model`, `response_format=verbose_json`, `language?` with `Authorization: Bearer`, 5 min timeout; a non-JSON reply is used as plain text. `provider: "gemini"` (default `native`): JSON `POST https://generativelanguage.googleapis.com/v1beta/models/<TESSERACT_GEMINI_STT_MODEL>:generateContent` with `x-goog-api-key`, the audio as `inline_data` (`audio/mp4`/`audio/x-m4a` sent as `audio/m4a`) and a verbatim-transcript instruction (language hint included), `temperature: 0`, 5 min timeout, outside the FIFO queue and regardless of the profile; empty text → 400 `No speech detected`. When no Gemini key is set (saved from an app or `tesseract --gemini-key`) or Gemini fails (network, HTTP error — 429 reported as quota/rate limit, 401/403/400 `API_KEY_INVALID` as a rejected key), the native engine (profile check included) answers and `fallbackReason` says why; if it cannot either, 503 with both reasons. `fallbackReason` is null otherwise |
| GET | `/v1/stt` | — | `SttStatus`: selected profile, every profile's tuning and whether its model file exists, the engine and model a transcription would use now (`ready`/`reason`), `cpus` (`os.availableParallelism()` capped by the cgroup v2 `cpu.max` quota), `busy`, `queued`, `gemini { configured /* a key is set */, model, source: "settings" \| "env" \| null }` (the key itself is never returned) |
| PUT | `/v1/stt` | `UpdateStt { profile?: SttProfile, geminiApiKey?: string \| null }` (at least one) | `200 SttStatus`; stores the profile (key `stt.profile`) and the Gemini key (key `stt.geminiApiKey`, trimmed, 1–256 printable ASCII without spaces; `null` deletes it) in the `settings` table and publishes `stt.updated` when something changed; 400 for an unknown profile, an invalid key or an empty body |
| POST | `/v1/agent/runs/archive` | `ArchiveAgentRuns { ids: AgentRunId[] (1–500), archived: boolean } \| { all: true, archived: boolean, projectId? }` | `200 { count }` = runs whose archived state changed; `archived: true` sets `archivedAt` to now, `false` clears it; `all` covers every finished run (of `projectId`); running runs and unknown ids are skipped; publishes `agent.updated` per changed run |
| POST | `/v1/agent/runs/delete` | `DeleteAgentRuns { ids: AgentRunId[] (1–500) } \| { all: true, projectId?, archived?: boolean }` | `200 { count }` = runs deleted for good with their events (one transaction; inbox items keep their row with `agentRunId: null`); `all` covers every finished run, only archived ones with `archived: true`, only non-archived ones with `false`; running runs and unknown ids are skipped; publishes `agent.deleted` when `count > 0` |
| GET | `/v1/agent/runs/:id` | — | `AgentRun & { events: AgentRunEvent[] }` |
| DELETE | `/v1/agent/runs/:id` | — | `AgentRun` (cancel) |
| GET | `/v1/projects/:id/run-targets` | — | `RunTargetInfo[]`: run targets offered for the project, unavailable ones with `reason` ([app-runs-and-emulator.md](app-runs-and-emulator.md) §1.1); 404 unknown project |
| GET | `/v1/app-runs` | `?projectId=` | `AppRun[]` of the current controller lifetime, newest first |
| POST | `/v1/projects/:id/app-runs` | `StartAppRun { target, port? }` | `201 AppRun`; 400 target not offered; 503 target unavailable (message = `reason`); 409 port taken or a `starting`/`ready` run of that target exists |
| GET | `/v1/app-runs/:id` | — | `AppRun` |
| DELETE | `/v1/app-runs/:id` | — | `AppRun` once its processes stopped |
| POST | `/v1/app-runs/:id/actions` | `AppRunActionRequest { action: "reload" \| "restart" \| "focus" }` | `200 AppRun`; 409 not `ready` or action unsupported; 502 the action failed |
| GET | `/v1/android` | — | `SandboxAndroidStatus { linked, hostId, emulator, adbSerial, adbConnected, shared }` (the tunnels to the host emulator and shared emulators) |
| POST | `/v1/events` | `StatusEvent` (without `ts`) | `202` — lets the in-sandbox agent publish SPEC §8.1 status events |

`command` in `StartProcess` is `string` (run via `bash -lc` in the project dir)
or `string[]` (exec directly). `display: true` sets `DISPLAY=$TESSERACT_DISPLAY` and `ELECTRON_DISABLE_SANDBOX=1` (the sandbox cannot run Chromium's setuid sandbox; `spec.env` may override it).
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
| `/v1/android/link` | host daemon → controller (host dials out): JSON `AndroidLinkHostMessage` `hello` · `emulator` · `devices` (shared emulators) · `refuse` · `pong`; controller → host `AndroidLinkSandboxMessage` `open {streamId, device?}` · `ping` (every 20 s). A newer link closes the older with 4000 |
| `/v1/android/link/streams/:id` | **binary** raw adb bytes between the sandbox tunnel connection `:id` (`adb_…`) and the host emulator's (or a shared emulator's) adbd; opened by the host after `open`, within 10 s |
| `/v1/display/vnc` | **binary** RFB bridge to `TESSERACT_VNC_HOST:TESSERACT_VNC_PORT` (echo `Sec-WebSocket-Protocol: binary` when offered; used by noVNC) |

Upgrades fail with 401 (missing/used/expired ticket), 404 (unknown target) or
400 (not an upgrade). Log, run and terminal streams close with **1000** once their
target has ended; 1011 means the stream could not be set up. A socket whose
send buffer exceeds 16 MiB is closed by the server (abnormal close): clients
reconnect with a fresh ticket and rely on the replay. Client frames are capped at 1 MiB.

### 5.4 Core types (authoritative names; zod schemas live in `@tesseract/protocol`)

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

type Framework = "expo" | "react-native" | "electron" | "vite" | "next" | "node" | "android" | "python" | "flutter" | "unknown";  // flutter: pubspec.yaml with `sdk: flutter`, no package.json
type PackageManager = "bun" | "pnpm" | "yarn" | "npm";
type BuildTarget = "electron-linux" | "electron-windows" | "android-apk" | "web" | "script";
type BuildProfile = "debug" | "release";
type GitSummary = { branch: string | null; dirty: boolean; ahead: number; behind: number;
                    lastCommit: { sha: string; subject: string; date: string } | null };
type Project = { id: string; name: string; path: string; framework: Framework;
                 packageManager: PackageManager | null; scripts: string[];
                 dependenciesInstalled: boolean | null;  // false: deps declared, node_modules missing
                 buildTargets: BuildTarget[]; git: GitSummary | null;
                 confidential: boolean;  // confidential: name is always the id, never package.json's
                 claudeAccountId: string | null };  // null: the default Claude account
type ClaudeAccountProfile = { id: string /* "claude" | "claude-<n>" */; primary: boolean; present: boolean /* dir mounted */;
                              loggedIn: boolean; account: ClaudeAccount | null; subscriptionType: string | null;
                              credentialsExpiresAt: string | null; settingsPresent: boolean; configDir: string };
type GitFileStatus = { path: string; index: string; worktree: string };
type GitCommit = { sha: string; subject: string; author: string; date: string };
type CreateProject = { name: string;      // 1–128 chars; directory = projectIdFromName(name) ("My App" → "my-app")
                       gitUrl?: string;   // https|ssh|git|file URL or user@host:path, no leading "-", ≤ 2048
                       branch?: string;   // git ref pattern: no leading "-", "/" or ".", no ".."
                       confidential?: boolean }; // marks the project confidential; name is then a pseudonym

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
                  source: "build" | "agent" /* agent: shared with `tesseract-controller share` */;
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
type SttProvider = "native" | "gemini";
type CreateTranscription = { uploadId: string; language?: string /* ISO-639-1 hint */; provider?: SttProvider /* default native */ };
type Transcription = { uploadId: string; text: string; language: string | null; durationMs: number | null;
                       engine: string /* "whisper.cpp" | "openai-compatible" | "gemini" */;
                       fallbackReason: string | null /* why Gemini was skipped for the native engine */ };
type SttProfile = "off" | "eco" | "balanced" | "performance";
// whisper.cpp tuning (cpus = SttStatus.cpus):
//   off: no transcriptions (503) · eco: base, 2 threads, nice 19 + ionice -c3
//   balanced: base, max(2, cpus/4) threads, nice 10 · performance: small, min(cpus, max(4, cpus/2)) threads, nice 0
type SttProfileInfo = { id: SttProfile; model: string | null /* ggml name, null for off */; threads: number; nice: number;
                        available: boolean /* ggml-<model>.bin in TESSERACT_WHISPER_MODELS_DIR; true for off */ };
type SttStatus = { profile: SttProfile; profiles: SttProfileInfo[] /* STT_PROFILES order */;
                   engine: "whisper.cpp" | "openai-compatible" | null; ready: boolean; reason: string | null;
                   model: string | null /* after the TESSERACT_WHISPER_MODEL fallback; TESSERACT_STT_MODEL for openai-compatible */;
                   cpus: number; busy: boolean; queued: number;
                   gemini: { configured: boolean; model: string;
                             source: "settings" /* saved from an app or tesseract --gemini-key */ | null } };
type UpdateStt = { profile?: SttProfile; geminiApiKey?: string | null /* null forgets the saved key */ };
type AgentRunUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number;
                       totalTokens: number /* sum of the four */ };
type AgentRun = { id: string; projectId: string | null; prompt: string;
                  mode: AgentRunMode | null /* null = TESSERACT_CLAUDE_PERMISSION_MODE */; attachments: Upload[];
                  sessionId: string | null; claudeAccountId: string | null /* null: before accounts (primary) */;
                  resumedSessionId?: string | null /* the `resumeSessionId` it started with; links a follow-up to its chat */;
                  state: AgentRunState;
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
type SyncFileChange = { path: string; kind: "added" | "modified" | "deleted"; sha256: string | null; size: number | null;
                        discardable?: boolean /* baseline restorable: always for added; else its blob is stored */ };
type SyncDiscard = { paths?: string[] /* omitted = every change */ };
type SyncDiscardResult = { discarded: string[]; unavailable: string[] /* no blob */; backupPath: string | null; changes: SyncChanges };
type SyncHost = { name: string; lastSeenAt: string; online: boolean; linked: boolean;
                  changes?: number /* host files changed since the last push/get, from the heartbeat */ };
type SyncChanges = { projectId: string; baselineAt: string | null /* never pushed */; changes: SyncFileChange[];
                     totalBytes: number; host: SyncHost | null; lastGetAt?: string | null /* last get since the push */ };
type SyncFileStat = { path: string; kind: "added" | "modified" | "deleted"; insertions: number; deletions: number; binary: boolean;
                      oldMode: "100644" | "100755" | "120000" | null; newMode: "100644" | "100755" | "120000" | null;
                      oldSize: number | null; newSize: number | null };
type SyncResult = { added: number; modified: number; deleted: number; conflicts: string[];
                    snapshotId: string | null; hostPath: string | null;
                    /* get only: */ files?: SyncFileStat[]; insertions?: number; deletions?: number; gitFiles?: number;
                    syncedAt?: string; previousSyncAt?: string | null; backupPath?: string | null };
type SyncRequest = { id: string /* sync_ */; projectId: string; kind: "pull" | "revert" | "get" /* get: host → sandbox */;
                     status: "pending" | "claimed" | "applied" | "failed" | "cancelled";
                     paths: string[] | null /* null = all */; force: boolean; source: "mobile" | "desktop" | "cli";
                     claimedBy: string | null; result: SyncResult | null; error: string | null;
                     createdAt: string; updatedAt: string };

type PushDevice = { token: string /* ExponentPushToken[…] */; platform: "ios" | "android"; name: string | null;
                    deviceId: string | null; createdAt: string; updatedAt: string };
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
  | { type: "project.deleted"; id: string }  // ProjectId moved out by DELETE /v1/projects/:id
  | { type: "stt.updated"; stt: SttStatus }  // PUT /v1/stt changed the profile or the Gemini key
  | { type: "sync.updated"; request: SyncRequest }  // a sync request was created, claimed, completed, cancelled or timed out
  | { type: "sync.changed"; projectId: string }  // the sync-back baseline moved (push, ack or get)
  | { type: "app.updated"; run: AppRun };  // an app run changed state

// App runs and the host Android emulator: full rules in app-runs-and-emulator.md
type RunTarget = "web-dev" | "expo-device" | "expo-web" | "expo-android" | "rn-android"
               | "flutter-web" | "flutter-linux" | "flutter-android" | "electron-dev" | "test";
type AppRunState = "starting" | "ready" | "failed" | "stopped" | "exited";
type AppRunAction = "reload" | "restart" | "focus";
type AppViewer =
  | { kind: "url"; url: string | null; localUrl: string }
  | { kind: "deeplink"; devClientUrl: string | null; expoGoUrl: string; manifestUrl: string }
  | { kind: "display" } | { kind: "android"; serial: string } | { kind: "none" };
type RunTargetInfo = { target: RunTarget; label: string; dir: string | null /* workspace package of a monorepo */; available: boolean; reason: string | null;
                       viewer: AppViewer["kind"]; actions: AppRunAction[] };
type AppRun = { id: string /* app_ */; projectId: string; target: RunTarget; dir: string | null; state: AppRunState; port: number | null;
                processIds: string[]; viewer: AppViewer | null /* set once ready */; actions: AppRunAction[];
                error: string | null; startedAt: string; readyAt: string | null; endedAt: string | null };
type EmulatorState = "unavailable" | "stopped" | "starting" | "running" | "stopping" | "failed";
type EmulatorInfo = { state: EmulatorState; avd: string | null; serial: string | null; managed: boolean;
                      isolated: boolean /* in its own netns; sandbox android targets need it */;
                      width: number | null; height: number | null; startedAt: string | null; error: string | null };
type AndroidLinkInfo = { configured: boolean; sandboxUrl: string | null; connected: boolean; lastError: string | null };
type EmulatorIsolationMode = "netns" | "none"; // EMULATOR_ISOLATION_MODES, TESSERACT_EMULATOR_ISOLATION
type HostAndroidStatus = { available: boolean; reason: string | null; sdkRoot: string | null;
                           isolation: EmulatorIsolationMode; avds: string[];
                           scrcpy: boolean; ffmpeg: boolean; emulator: EmulatorInfo; link: AndroidLinkInfo;
                           stream: AndroidStreamSettings; devices: AndroidDevice[] };
// Defaults (DEFAULT_ANDROID_STREAM): h264, 8 Mbit/s, 60 fps, maxSize null, key frame every 2 s, JPEG q 5, device null
type AndroidStreamSettings = { encoding: "h264" | "mjpeg"; bitRate: number /* 250 000..50 000 000 bps */;
                               maxFps: number /* 1..120 */; maxSize: number | null /* 160..4096, null: the viewer's */;
                               keyFrameInterval: number /* 1..10 s */; jpegQuality: number /* ffmpeg -q:v 2..31 */;
                               device: string | null /* adb serial, null: the host emulator */ };
type AndroidDevice = { serial: string; state: string /* "device" | "unauthorized" | "offline" … */;
                       kind: "emulator" | "genymotion" | "network" | "usb"; model: string | null; hostEmulator: boolean };
type SharedEmulator = { serial: string /* host emulator-<port> */; model: string | null };
type SandboxAndroidStatus = { linked: boolean; hostId: string | null; emulator: EmulatorInfo | null;
                              adbSerial: string | null; adbConnected: boolean;
                              shared: (SharedEmulator & { adbSerial: string; adbConnected: boolean })[] };
// WS frames: AndroidLinkHostMessage / AndroidLinkSandboxMessage (§5.3), AndroidScreenClientMessage /
// AndroidScreenServerMessage (§5.7)
```

Identity resolution (controller): `viewer` comes from the Tailscale Serve headers
`Tailscale-User-Login` / `-Name` / `-Profile-Pic` (RFC 2047 values decoded) only when the
request arrives from loopback (serve proxies from `127.0.0.1`), matched against the LocalAPI
user list for `id` (else `id` = login name) → `source: "serve"`. Otherwise the controller asks
the LocalAPI on `TESSERACT_TAILSCALE_SOCKET` (`GET /localapi/v0/whois?addr=<ip:port>` of the
TCP peer) → `source: "localapi"`. `owner`, `node` and `tailnet` come from
`GET /localapi/v0/status` (`Self`, `User[Self.UserID]`, `MagicDNSSuffix`), cached 30 s.
Every LocalAPI call has a 1.5 s timeout. The identity is informational: the bearer token
stays the only authentication.

IDs: type prefix (`prc_`, `trm_`, `bld_`, `art_`, `run_`, `inb_`, `upl_`, `sync_`, `app_` app runs, `adb_` adb tunnel streams) + 10 random characters of
lowercase Crockford base32 (`0-9a-z` without `i l o u`), e.g. `bld_7f3k2q9xa1`.
Validators accept any `<prefix>[A-Za-z0-9_-]{1,64}`. Timestamps: ISO-8601 UTC strings.

`@tesseract/protocol` also exports: `LIMITS` (§6), the constants above as arrays
(`BUILD_TARGETS`, `PROCESS_STATES`, …), list and query schemas, the stream message
schemas (`ProcessLogStreamMessage`, `LogStreamMessage`, `AgentStreamMessage`,
`EventsClientMessage`), `CreateProjectResponse`, `restPaths`/`wsPaths`/`uiPaths`
builders and server-side `routePatterns`, pairing helpers (`buildPairingLink`,
`parsePairingLink`, `parseBaseUrl`), and `projectIdFromName`.

**Compatibility.** A client MUST check `protocolVersion` on `GET /v1/health` and on
the events `hello`; `@tesseract/client` raises `ProtocolVersionError` and ends the
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
| `android-apk` | `expo` dep + `app.json`/`app.config.*`, or `android/gradlew` | install → `<exec> expo prebuild --platform android --no-install` (only without `android/`) → `cd android && sh ./gradlew assembleDebug\|assembleRelease --no-daemon --console=plain`; env `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `JAVA_HOME`; requires `java`. After the build (any outcome) deletes the intermediate build dirs: `android/build`, `android/app/build`, `android/app/.cxx` and every `android/build`/`android/.cxx` of a package in `node_modules` (flat, scoped and `.pnpm/*/node_modules/`), never through a symlink | `android/app/build/outputs/apk/**/<profile>/**/*.apk` |
| `web` | `build` script and framework ≠ electron | install → `<pm> run build` | first existing dir of `dist`, `build`, `out`, `web-build`, zipped |
| `script` | `build` script | install → `<pm> run build` | none (logs only) |

Profile `debug` adds `-c.compression=store` to electron-builder. Stages are reported
(`install`, `compile`, `package`, `collect`); `progress` is a fraction. Collection only
takes files modified after the build started (minus 2 s), so outputs of earlier
builds are ignored; no match fails the build. Each file is copied to
`/workspace/artifacts` with the predictable name (`platform` = `linux|windows|android|web`,
`version` from `package.json`, else `0.0.0`) and its sha256. Builds run one at a time (FIFO).

### 5.6 WebView bridge (`/ui` pages ↔ embedding app)

Names live in `@tesseract/protocol/bridge` (`PAGE_MESSAGES`, `PAGE_STATES`, `INPUT_MODES`,
`VNC_ACTIONS`, `PageInsets`; zod-free so
the pages can import it). Pages post to `window.ReactNativeWebView.postMessage`
(JSON string) and, when framed, `parent.postMessage(message, "*")`:

| Message | From → to | Payload |
|---|---|---|
| `terminal-state`, `vnc-state`, `android-state` | page → app | `{ type, state, code?, reason? }`, `state` ∈ `connecting\|connected\|disconnected\|exited\|error`; `code` = exit code on `exited`; `vnc-state` adds `inputMode`; `reason` on `disconnected` (e.g. the host's `error` message such as `The emulator is not running`) |
| `terminal-need-ticket`, `vnc-need-ticket`, `android-need-ticket` | page → app | `{ type }` (terminal adds `session`) after the page's socket dropped |
| `vnc-action` | page → app | `{ type, action }`, `action` ∈ `browser\|paste` (the user tapped the key row's **URL** or **Paste** key) |
| `tesseract-reconnect` | app → page | native: injected `window.tesseract.reconnect(ticket)`; web: `postMessage({ type: "tesseract-reconnect", ticket })` to the frame |
| `tesseract-input-mode` | app → page | `window.tesseract.setInputMode(mode)` / `{ type, mode }`, `mode` ∈ `trackpad\|touch`; switches without reconnecting (VNC page only) |
| `tesseract-insets` | app → page | `window.tesseract.setInsets({ top, bottom })` / `{ type, top, bottom }`, CSS px ≥ 0 covered by the app's floating chrome (VNC and Android pages) |
| `tesseract-paste` | app → page | `window.tesseract.paste(text)` / `{ type, text }`, the phone clipboard's non-empty text; the VNC page sets it as the remote clipboard and types it into the focused field (VNC page only) |

The app verifies the sender origin (the sandbox base URL), answers `*-need-ticket`
with a fresh ticket (automatically, up to 4 times with backoff, and again when the app
returns to the foreground), and never reconnects after `exited` or `error`.
`viewOnly=1` in the VNC fragment disables input. Pages validate every app → page call and
ignore malformed ones; `window.tesseract` always has all four methods (no-ops where a page
does not support them).

VNC page input: `input=trackpad|touch` in the fragment (default `trackpad`), then
`tesseract-input-mode` at runtime. **trackpad**: a layer over the screen captures touches and
drives a drawn pointer kept on the remote screen: one-finger drag moves it relatively
(≈60 % of the screen width per swipe across the page, accelerated when fast), tap = left
click, two-finger tap = right click, two-finger drag = wheel, tap then press-and-drag =
left-button drag; noVNC gets synthetic mouse/wheel events on its canvas. **touch**:
noVNC's own touch gestures act under the finger and no pointer is drawn. Embedded (any
host), the page hides its own top bar (the app shows status) and starts the key row with
**⌨** (toggle the phone keyboard), **URL** and **Paste** (post `vnc-action`; view-only keeps only **URL**); `tesseract-insets` pads
the screen below the app's header (`top`) and the key row above its bottom chrome (`bottom`).

Android page (`/ui/android` on the host daemon, fragment `ticket`, optional `maxSize` and `serial`): it
asks for `codec=h264` when WebCodecs `VideoDecoder` supports `avc1`, decodes H.264 with the SPS/PPS put
in front of each key frame and skips to the next key frame when the decoder queue holds more than
6 frames; a decoder error closes the socket and the next connect asks for JPEG. Pointer
events are touches (multi-touch, pointer ids 0..9) in the last `meta`/`size` space, the wheel
scrolls, the bottom bar is ◁ ○ ▢ ⌨ ⟳ (back, home, recents, keyboard, rotate). Embedded, it hides
its top bar; `tesseract-insets` pads the screen (`top`) and the bottom bar (`bottom`). A host `error`
message ends the socket and is reported as `disconnected` with `reason`.

### 5.7 Host shell API (`tesseract-controller host serve`)

Same JSON error format, `/v1` prefix and terminal protocol as the controller, so
`/ui/terminal` and `TesseractClient` work against it unchanged. Two credentials:
the **host token** (`Authorization: Bearer`, from `host pair`, compared in constant
time) and a **session** (`HostSession`, issued for the PIN, in memory only, valid
`LIMITS.hostSessionTtlMs` = 15 min, dropped when the token is rotated or the PIN
changes). Neither is accepted where the other is expected.

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/v1/health` | — | — | `HostHealth { ok, service: "host-shell", version, protocolVersion, hostId }` |
| GET | `/v1/host/lock` | host token | — | `HostLockStatus { pinSet, attemptsLeft, lockedUntil }` |
| POST | `/v1/host/unlock` | host token | `HostUnlock { pin }` (6–12 digits, else 400 without counting) | `200 HostSession { session, expiresAt }`; 503 `No PIN is set; run tesseract-controller host pin on the host`; 403 `Wrong PIN (<n> attempts left)`; after `hostPinMaxAttempts` (5) wrong PINs 403 `Too many wrong PINs; try again after <time>` for `hostLockoutBaseMs` (5 min) × 2^lockouts, capped at `hostLockoutMaxMs` (24 h). Attempts are serialized; counters persist in `state.json`; a correct PIN resets them |
| POST | `/v1/host/lock` | host token | `HostLock { session }` | `204`; ends that session |
| POST | `/v1/auth/ticket` | session | — | `Ticket` (one-time, 60 s) |
| GET | `/v1/terminals` | session | — | `TerminalInfo[]` (newest first) |
| POST | `/v1/terminals` | session | `CreateHostTerminal` = `CreateTerminal` with `kind: "shell"`, no `projectId` (else 400), optional `cwd` (absolute host folder; 400 if relative, 404 if not a directory) | `201 TerminalInfo` (`projectId: null`, `title` `Host · <hostname>` or `Host · <hostname> · <folder name>`, `cwd` the given folder or `$HOME`) |
| DELETE | `/v1/terminals/:id` | session | — | `TerminalInfo` (SIGHUP to the group) |
| WS | `/v1/terminals/:id/stream?ticket=` | ticket | §5.3 terminal frames | scrollback replay, survives disconnects; an attached stream stays open after its session expires |
| GET | `/ui/terminal` | — | — | the controller's xterm page |
| GET | `/v1/android` | session | — | `HostAndroidStatus`; a missing tool gives `available: false` + `reason`, never an error; `isolation` is the daemon's mode, `emulator.isolated` whether the current emulator runs in its own netns (a non-isolated one is not linked: streams get `refuse`) |
| POST | `/v1/android/emulator` | session | `StartEmulator { avd, coldBoot?, wipeData? }` | `202 EmulatorInfo` (`starting`); 409 unless `stopped`/`failed`; 404 unknown AVD; 503 not `available` |
| DELETE | `/v1/android/emulator` | session | — | `EmulatorInfo` (`stopping`, then `stopped`; the isolated emulator's namespace is swept and its runtime dir removed) |
| POST | `/v1/android/link` | session | `LinkSandbox { sandboxUrl (http/https, no userinfo or fragment), token }` | `200 AndroidLinkInfo`; stored in `state.json` as `androidLink`, the daemon (re)connects to the sandbox's `/v1/android/link` |
| DELETE | `/v1/android/link` | session | — | `AndroidLinkInfo` (cleared, link closed) |
| GET | `/v1/android/devices` | session | — | `AndroidDevice[]` from `adb devices -l` (`[]` without adb) |
| GET | `/v1/android/stream` | session | — | `AndroidStreamSettings` |
| PUT | `/v1/android/stream` | session | `UpdateAndroidStream` (any `AndroidStreamSettings` fields) | `AndroidStreamSettings`; stored in `state.json` as `androidStream`. Also `tesseract-controller host stream [--json] [--stdin]` (the desktop app uses it, no PIN). On a change (this route, or `state.json` rewritten, watched with a 150 ms debounce) every open screen whose session would differ moves to a new session: it gets a new `meta` (maybe another `codec`) and keeps its socket |
| WS | `/v1/android/screen?ticket=&maxSize=&serial=&codec=` | ticket | client → daemon `AndroidScreenClientMessage` `touch` · `scroll` · `key` · `text` · `rotate`; daemon → client `AndroidScreenServerMessage` `meta` (with `codec`) · `size` · `error` + binary video | an adb device's screen via scrcpy: `serial` (default: the settings' `device`, else the host emulator; only the host emulator needs `running`), `codec=h264` when the viewer decodes H.264. With settings `encoding: "h264"` and `codec=h264`, scrcpy's H.264 is forwarded as is: each binary message is a flags byte (`ANDROID_H264_FLAGS`: 1 config, 2 key frame) + an Annex B access unit; else ffmpeg turns it into one JPEG per message. scrcpy gets `video_bit_rate`, `max_fps`, `max_size` and `i-frame-interval` from the settings. Viewers of the same device, codec and settings share one session, sized by the first viewer's `maxSize` (default 1280, at least 160, at most the settings' `maxSize`); a late H.264 viewer gets the config and the frames since the last key frame (≤ 8 MiB); a viewer with > 512 KiB buffered skips frames until the next key frame; query checked before the ticket is used; per-viewer pointer ids, lifted when a viewer leaves |
| GET | `/ui/android` | — | — | the Android screen page (fragment `#ticket=…&maxSize=…&serial=…`, same bridge as `/ui/vnc`) |

Android emulator details (scrcpy session, link protocol, adb tunnel): [app-runs-and-emulator.md](app-runs-and-emulator.md) §2.

## 6. Supervision & persistence

### 6.1 State

* `bun:sqlite` database at `$TESSERACT_DATA_DIR/state.db` (WAL) — processes, terminals
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
  Migration 11 adds `confidential_projects` (`project_id`, `marked_at`).
* Confidential projects: a project whose id is a pseudonym (e.g. `morning-cat`, chosen by
  the desktop client) whose real name never reaches the sandbox. It is marked by
  `CreateProject.confidential` or `POST /v1/projects/:id/sync?confidential=1`; nothing in the
  API unmarks it. For such a project `Project.name` is the id, `GitCommit.author` is
  `REDACTED` (`REDACTED` in `@tesseract/protocol`), `POST /v1/artifacts` is refused with 403,
  and agent runs and `claude` terminals get `--append-system-prompt` with
  `confidentialPrompt(id)` (`apps/controller/src/services/confidential.ts`): the project is
  known only by its pseudonym; never reveal real, client, company, product or people's
  names, authors, emails, API/base URLs, hostnames, endpoints or keys in replies, commits,
  comments, docs, logs, summaries or PR text, writing `REDACTED` instead; do not share files
  as artifacts.
* Sync back: the baseline manifest of each pushed project in
  `$TESSERACT_DATA_DIR/sync/<projectId>.json` (`{ pushedAt, files: { path: sha256 }, executable: path[], gotAt?, gitHead? }`),
  the baseline content in `$TESSERACT_DATA_DIR/sync/blobs/<projectId>/<sha256>` (`<sha256>.link`: a symlink target;
  0600, written on push, get and ack, unreferenced ones removed on push), sandbox copies of edits a `get --force`
  or a discard overwrote in `$TESSERACT_DATA_DIR/sync/backups/<projectId>/<requestId | discard-<ts>>/`
  (newest 20 per project), `get` staging in `$TESSERACT_DATA_DIR/sync/staging/` (removed after each apply); sync
  requests in the database (newest 500 kept; a request `claimed` for over 10 minutes is failed).
  See [sync-back.md](sync-back.md).
* Logs: `$TESSERACT_DATA_DIR/logs/<id>.log` (`<ts> <stream> <seq> <text>` lines), rotated at
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

Seeded by the image entrypoint from `/etc/tesseract/agent-templates/` when missing;
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
tesseract-controller [serve]                       # default when no args
tesseract-controller pair [--json]                 # pairing deep link + ANSI QR code; --json → { link, url, name }
tesseract-controller status [--json]               # SandboxStatus from the local API (VNC password shown as ***)
tesseract-controller emit --status <s> --message <m> [--project p] [--stage s] [--platform p]
tesseract-controller token [--rotate]              # print the token, or write a new one (restart required)
tesseract-controller api <METHOD> <PATH> [JSON|-]  # call the local API; the agent's only way to use it
tesseract-controller share <file> [--project p] [--name n] [--note t] [--json]  # POST /v1/artifacts; prints "shared <name> (<size>, <project>) as <id>"
tesseract-controller hook                          # Claude Code hook: stdin JSON → POST /v1/hooks/claude; silent, always exit 0
tesseract-controller tesseract --get [--force] [--json]  # IN THE SANDBOX, also as `tesseract --get` (/usr/local/bin/tesseract, not the host CLI §7.1); in /workspace/projects/<id>/…: queue a `get` and print a git pull style summary (sync-back.md §6); exit 0 / 1 / 2 conflicts / 130 interrupted
tesseract-controller host serve [--bind <ipv4>] [--port <n>]  # ON THE HOST: host shell daemon (§5.7)
tesseract-controller host pin [--stdin]            # set the 6-12 digit PIN (prompted twice without echo); ends sessions, resets lockouts
tesseract-controller host pair [--json]            # tesseract://host link + QR with the host token; warns while no PIN is set; --json: { link, url, name, pinSet }
tesseract-controller host token [--rotate]         # print, or replace, the host token (phones pair again)
tesseract-controller --version | --help
```

`host …` never reads the sandbox configuration; the repo's `bun run host <cmd>` runs it
from a checkout on the host. Exit code 2 for bad arguments, a bad PIN or a refused bind.

The CLI reads the token from `TESSERACT_TOKEN`/`TESSERACT_TOKEN_FILE` and talks to
`http://127.0.0.1:$TESSERACT_PORT` (the bind address unless it is a wildcard).
`api`: `METHOD` ∈ `GET|POST|DELETE`, `PATH` must start with and stay under `/v1/`,
body as argument or `-` for stdin; 2xx JSON is pretty-printed to stdout (non-JSON
bytes only when stdout is not a terminal); the token and `display.vnc.password` are
printed as `***`. Exit codes (`api`, `emit`): 0 ok, 1 request failed / non-2xx
(error body on stderr), 2 bad arguments (nothing sent).
`share` resolves the file against the current directory and sends `agentRunId`/`sessionId` from
`TESSERACT_AGENT_RUN_ID`/`CLAUDE_CODE_SESSION_ID` when set; exit codes as for `api`.
`hook` adds `tesseract_terminal_id`/`tesseract_agent_run_id` from `TESSERACT_TERMINAL_ID`/`TESSERACT_AGENT_RUN_ID`
(set by the controller for terminals and agent runs), gives up after 1.5 s and never prints
or fails, so a controller outage never blocks Claude.

### 7.1 Host `tesseract` CLI

`apps/electron/cli`, compiled with `bun build --compile` (`bun run --cwd apps/electron cli:build`) to
`dist-cli/<linux|mac|win>-<x64|arm64>/tesseract[.exe]` and shipped in the installers as `resources/bin/tesseract`
next to `tesseract-controller` (§12.5). It shares `src/core` with the app, so both read the same `config.json`,
sandbox env file and Android SDK. Every command takes `--json`, `--verbose`, `--help`.

```
tesseract status [--json]                                # config, setup progress, connection, Docker, stack, Android
tesseract open [overview|agents|projects|files|terminals|display|containers|domains]   # start or focus the app (else tesseract://<page>)
tesseract doctor [docker|image|kvm|sdk]... [--json]      # Docker, sandbox image, hardware acceleration, Android SDK
tesseract sandbox status|up|down [--volumes]|restart [service]|logs [--tail N] [--follow]
tesseract sandbox build [--with android,flutter,mono,whisper|all|none] [--pull | --existing] [--verbose]
tesseract sandbox pair [--no-qr]
tesseract android images [--refresh] [--all]
tesseract android install <api|package>... [--accept-licenses] [--sdk PATH]
tesseract android [avd] [list]                           # bare `android` / `android avd` list the AVDs
tesseract android avd create [name] [--image API|package] [--device pixel_5|pixel_8|medium_phone|pixel_tablet]
                    [--storage GB] [--ram MB] [--cores N] [--default]   # storage 2–64 GB, default 6
tesseract android avd start [name] [--detach] [--headless] [--gpu MODE] | delete <name>
tesseract containers [ls] | create <name> [--cpus N] [--memory MB] | start|stop|restart|logs|ssh <name> | rm <name> --yes
tesseract containers build [--verbose] | doctor | tailscale-key [--tags …] [--clear] < key   # server containers (ADR 0011)
tesseract domains [ls] | add <hostname> <container> <port> [--https] | rm <hostname|id> | zones | sync | login < token | logout
tesseract pair [--no-qr]                                 # pairing link + QR for the phone
tesseract sync [push] [--confidential] | pull [--dry-run] [--force] | revert [--force] | status
tesseract config path | get [key] [--reveal] | set <key> <value> [--force] | unset <key>
tesseract version | help [command]
tesseract --sync [--confidential] | --pull [--dry-run] [--force] | --revert [--force] | --sync-status   # GTK-compatible flags
tesseract --gemini-key=KEY                               # save the Gemini key for voice notes on the sandbox (PUT /v1/stt)
```

`--get` on the host only prints that it runs inside the sandbox, where `tesseract` is the controller wrapper (`tesseract-controller tesseract --get`, §7).
`config get` prints the token as `…` unless `--reveal`. The packaged app forwards the sync flags to the
bundled CLI (`Tesseract --sync` = `tesseract --sync`). Exit codes: 0 ok, 1 failure, 2 sync conflict,
64 bad arguments, 130 interrupted.

### 7.2 Headless server (`tesseract server`, macOS and Linux)

Runs the sandbox stack and the host shell daemon on a machine without the desktop app (the
production sandbox host, e.g. a Mac on the tailnet). Runbook: `docs/runbooks/mac-server.md`.

```
tesseract server install [--mode tailscale|host-tailscale|local] [--hostname <name>] [--tailnet-domain <x.ts.net>]
                         [--authkey <key>] [--with <components>] [--image <ref>] [--build] [--claude-token <tok>]
                         [--no-host-shell] [--host-https-port 8443] [--dry-run]
tesseract server uninstall [--volumes]
tesseract server status
tesseract server pair                                    # sandbox and host shell pairing links + QR codes
```

`install` writes the sandbox env file (§12.4: macOS `~/Library/Application Support/Tesseract/sandbox/.env`,
Linux `~/.config/Tesseract/sandbox/.env`), pulls `--image` or builds (`--build`, `--with`), runs `compose up`,
installs the host shell service and runs `tailscale serve --bg --https=<host-https-port> http://<tailscale ip>:7701`,
then prints the pairing. `--authkey`, `--tailnet-domain` and `--claude-token` fall back to `TS_AUTHKEY`,
`TS_TAILNET_DOMAIN` and `CLAUDE_CODE_OAUTH_TOKEN` (passed to the sandbox, because Claude Code on macOS keeps its
login in the keychain, which the sandbox can't read). The stack restarts with Docker (`restart: unless-stopped`).

| Host shell service | macOS | Linux |
|---|---|---|
| Unit | LaunchAgent `~/Library/LaunchAgents/dev.tesseract.host-shell.plist` (`RunAtLoad`, `KeepAlive`) | systemd user unit `tesseract-host-shell.service` (`loginctl enable-linger` to run without a login) |
| Command | `tesseract-controller host serve --bind <tailscale ip>` | same |
| Logs | `~/Library/Logs/Tesseract/` | `journalctl --user -u tesseract-host-shell` |

Installing on the server itself: `./setup-server.sh [--hostname NAME] [--with LIST] [--rebuild] [--yes]` from a repo checkout (builds the binaries for that machine, installs them into `~/.tesseract`, prompts for missing secrets and the host PIN, prints root-only steps such as `pmset` for the user to run, then runs `tesseract server install --mode tailscale`; see docs/runbooks/mac-server.md).

Deploying from the Linux dev box: `infra/scripts/deploy-mac <ssh-host> [--arch auto|arm64|x64] [--skip-build]
[-- <install args>]` (`bun run deploy:mac`) builds `tesseract` + `tesseract-controller` for `mac-arm64`/`mac-x64`
(`uname -m` on the Mac) and the sandbox context (`bundle:sandbox`), copies them to `~/.tesseract/bin/` and
`~/.tesseract/sandbox/` and runs `TESSERACT_SANDBOX_CONTEXT=~/.tesseract/sandbox ~/.tesseract/bin/tesseract server install`.
`TS_AUTHKEY`, `TS_TAILNET_DOMAIN` and `CLAUDE_CODE_OAUTH_TOKEN` from its environment reach the Mac over ssh stdin
(a 0600 `~/.tesseract/secrets.env` removed before the install runs), never on a command line.

## 8. Sandbox image

Multi-stage `infra/docker/sandbox/Dockerfile`, build context = repo root.

| Stage | Adds |
|---|---|
| `bun`, `jdk` | helper aliases for `oven/bun:${BUN_VERSION}` and `${JDK_IMAGE}` |
| `controller-build` | `bun install --frozen-lockfile --filter @tesseract/controller` → `bun build --compile` (host arch) |
| `base` | `${DEBIAN_IMAGE}`, tini, supervisor, sudo, coreutils + util-linux (`nice`, `ionice` for the STT profiles), git, git-lfs, curl, jq, ripgrep, fd, build-essential, python3/pip/venv/pipx, Docker CLI + compose/buildx (no daemon), Node `${NODE_MAJOR}` from nodejs.org (SHASUMS256-checked) + corepack, bun, locales, fonts, `dev` user |
| `desktop` | TigerVNC (`Xvnc`, `vncpasswd`), openbox, xterm, x11-apps (`xwd`), x11-utils, x11-xserver-utils, xdotool, imagemagick, ffmpeg, dbus-x11, chromium, Electron runtime libs, Flutter Linux desktop deps (`clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev libstdc++-14-dev`), wmctrl |
| `electron` | wine (`wine`, `wine64`, `wine32:i386`, `/usr/local/bin/wine64` symlink), osslsigncode, fakeroot, dpkg-dev, rpm, mono-complete if `WITH_MONO=true` |
| `android-sdk` | side stage: JDK copy, Android cmdline-tools (sha256-pinned), platform-tools, `platforms;${ANDROID_PLATFORM}`, `build-tools;${ANDROID_BUILD_TOOLS}`; empty dirs if `WITH_ANDROID=false` |
| `android` | JDK → `/opt/java/openjdk`, SDK → `/opt/android-sdk` (owned by `dev`), `/etc/profile.d/tesseract.sh` |
| `flutter` | with `WITH_FLUTTER=true`, the Flutter SDK cloned at tag `${FLUTTER_VERSION}` into `/opt/flutter` (owned by `dev`, on `PATH`), `flutter config --no-analytics --android-sdk /opt/android-sdk`, `flutter precache --web --linux` |
| `whisper` | side stage: with `WITH_WHISPER=true`, whisper.cpp `v${WHISPER_CPP_VERSION}` built statically (`${WHISPER_CMAKE_ARGS}`, default `-DGGML_NATIVE=ON`) → `/opt/whisper/bin/whisper-cli`, and `ggml-<m>.bin` for each `m` in `${WHISPER_MODELS}` from huggingface.co/ggerganov/whisper.cpp with the symlink `/opt/whisper/models/ggml-model.bin` to the first; empty `/opt/whisper` otherwise |
| `sandbox` (final, default) | Claude Code (`npm i -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`), `/opt/whisper`, rootfs, `SPEC.md` → `/etc/tesseract/SPEC.md`, controller binary |

Build args: `DEBIAN_IMAGE` (`debian:trixie-slim`), `BUN_VERSION` (`1.4.2`), `JDK_IMAGE`
(`eclipse-temurin:17-jdk`), `DEV_UID`/`DEV_GID` (`1000`), `ENABLE_SUDO` (`true`),
`NODE_MAJOR` (`24`), `NODE_VERSION` (empty = newest `24.x`), `WITH_MONO` (`true`),
`WITH_ANDROID` (`true`), `ANDROID_CMDLINE_TOOLS_BUILD`/`_SHA256`, `ANDROID_PLATFORM`
(`android-36`), `ANDROID_BUILD_TOOLS` (`36.0.0`), `CLAUDE_CODE_VERSION` (`latest`),
`WITH_FLUTTER` (`true`), `FLUTTER_VERSION` (`3.47.5`),
`WITH_WHISPER` (`true`), `WHISPER_CPP_VERSION` (`1.7.6`), `WHISPER_MODELS` (`base small`),
`WHISPER_CMAKE_ARGS` (`-DGGML_NATIVE=ON`), `TESSERACT_IMAGE_VERSION` (`0.1.0`).

Claude Code hooks: `/etc/claude-code/managed-settings.json` (the Linux managed-settings path,
applied to every session, interactive or `claude -p`) runs `/usr/local/bin/tesseract-controller hook`
(timeout 5 s) on `Notification`, `Stop`, `StopFailure` and `UserPromptSubmit`.
`/etc/claude-code/CLAUDE.md` (managed memory) tells Claude to run `tesseract-controller share <file> --note …`
for finished deliverables (APK/AAB, installers, zips, reports, exported media), not intermediate files.
`/etc/claude-code/.claude/skills/send-file/` is a managed skill, `/send-file [latest|apk|aab|android|windows|linux|build|md|<path or name>] [-- note]`
(interactive or `claude -p`, so also from a phone chat): it picks the file (the chat's last deliverable, the newest
of a kind via its `find-files` helper, or a named file), refuses secrets, and runs `tesseract-controller share`.

Rootfs helpers (`/usr/local/bin`): `tesseract-entrypoint`, `tesseract-xvnc`, `tesseract-wait-x`,
`tesseract-controller-run`, `tesseract-wine-init`, `tesseract-screenshot`, `tesseract-doctor`.

Entrypoint (`/usr/local/bin/tesseract-entrypoint`, run by tini as root): drops empty
`TESSERACT_*`/`ANTHROPIC_*`/`CLAUDE_*`/`DOCKER_*` vars, fixes volume ownership, creates
workspace dirs (never following symlinks planted in the volumes), seeds
`/workspace/.agent/` templates if missing (never touching the bind-mounted
`/home/dev/.claude`; SPEC.md is baked into `/etc/claude-code/CLAUDE.md` at build time), writes the VNC password files and
`/run/tesseract/controller.env`, clears stale X locks, regenerates `ENVIRONMENT.md` (tool
probes run as `dev`), unsets `TESSERACT_TOKEN`/`TESSERACT_VNC_PASSWORD`, then execs
supervisord (any arguments replace it). supervisord drops to `dev` itself
(`user=dev`); programs: `xvnc` (`tesseract-xvnc`), `openbox` (`tesseract-wait-x dbus-run-session
-- openbox-session`), `controller` (`tesseract-controller-run` loads `controller.env`, then
`tesseract-controller serve`), `wine-init` (oneshot `wineboot -u` when the prefix is missing).
`HEALTHCHECK` = `curl -fsS http://127.0.0.1:7700/v1/health`.

## 9. Compose modes

`infra/scripts/sandbox` selects **overlay files** (not compose profiles) and passes the
resolved settings to compose. It reads `infra/compose/.env`, or only the file given by
`--env-file <path>`.

| Mode | Files | Reachability |
|---|---|---|
| `tailscale` (default) | `compose.yml` + `compose.tailscale.yml` | sandbox joins the tailscale sidecar's netns; `tailscale serve` → `https://<TESSERACT_HOSTNAME>.<TS_TAILNET_DOMAIN>` (443 → 7700) and TCP 5901; no host ports. Refuses to start without `TS_TAILNET_DOMAIN`, or without `TS_AUTHKEY` on first start |
| `host-tailscale` | `compose.yml` + `compose.local.yml`, `TESSERACT_BIND_ADDR` = host tailnet IPv4 | ports bound only on that address |
| `local` | `compose.yml` + `compose.local.yml`, `TESSERACT_BIND_ADDR=127.0.0.1` | loopback only, for development/e2e tests |
| `+tailscale-api` | tailscale: add `compose.tailscale-api-sidecar.yml`; host-tailscale/local: add `compose.tailscale-api.yml` | opt-in (`--tailscale-api`, `TESSERACT_TAILSCALE_LOCALAPI=1`) for `GET /v1/identity`. Sidecar: `TS_SOCKET=/var/run/tailscale/tailscaled.sock` on volume `<prefix>-tailscale-run`, mounted read-only at `/run/tailscale` in the sandbox. Host: `TESSERACT_TAILSCALE_HOST_SOCKET_DIR` bind-mounted read-only at `/run/tailscale`. Root in the sandbox can then reconfigure that tailscaled ([security model](security-model.md#tailscale-localapi-opt-in)) |
| `+host-android` | add `compose.host-android-sdk.yml` (`TESSERACT_HOST_ANDROID_SDK`) and/or `compose.host-gradle-cache.yml` (`TESSERACT_HOST_GRADLE_CACHE`) | opt-in, any mode: the host's Android SDK and Gradle dependency cache, read-only, so builds do not download NDK, CMake, platforms and dependencies again ([security model](security-model.md#host-android-sdk-and-gradle-cache-opt-in)) |
| `+dind` | add `compose.dind.yml` | privileged `docker:dind` sidecar sharing `<prefix>-workspace`; sandbox gets `DOCKER_HOST=tcp://docker:2376` + TLS certs (opt-in, [ADR 0006](../adr/0006-optional-docker-in-docker.md)) |

Stacks run side by side when each has its own `TESSERACT_COMPOSE_PROJECT` (and thereby
volumes) plus its own host ports or `TESSERACT_HOSTNAME`.

Hardening defaults: sandbox without `privileged`, no host bind mounts except the
read-only serve config (and, with `--tailscale-api` outside tailscale mode, the read-only host
tailscale socket directory, and with `TESSERACT_HOST_ANDROID_SDK`/`TESSERACT_HOST_GRADLE_CACHE` the read-only
host Android SDK and Gradle cache), `cap_drop: [ALL]` + minimal `cap_add` (CHOWN, DAC_OVERRIDE,
FOWNER, SETUID, SETGID, KILL, AUDIT_WRITE), `shm_size: 2g`, `pids_limit`, CPU/memory
limits from `.env`, explicit `environment` lists (no `env_file`), json-file logs
10 MB × 3. Tailscale sidecar: userspace mode (no `/dev/net/tun`, no `NET_ADMIN`),
`no-new-privileges`, `TS_AUTH_ONCE=true`.

## 10. Mobile app integration

* Feature module `apps/mobile/src/features/sandbox/` (`api/`, `components/`, `hooks/`,
  `store/`, `types/`, `utils/`) consumes `@tesseract/client`.
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
  `pair` (QR scan via expo-camera pairs at once; `tesseract://pair` deep links pre-fill and
  need a tap; manual entry), `sandbox/projects/new` (create or clone, follows the clone's log),
  `sandbox/projects/[id]`, `sandbox/builds/[id]`, `sandbox/agent/[id]` (Claude run stream),
  `sandbox/terminal/[id]` (xterm page in WebView), `sandbox/display` (noVNC in WebView,
  loaded only while `display.available && display.vnc.available`).
* WebViews load `<baseUrl>/ui/terminal#ticket=…&session=<id>` and
  `<baseUrl>/ui/vnc#ticket=…&password=…` (web platform: `<iframe>`), bridge per §5.6.
* A 401/403 or a protocol mismatch shows a notice with **Pair again**.
* **Host shell** (§5.7): routes `host` (pair by scanning `tesseract-controller host pair` or the
  `tesseract://host` deep link, then a PIN pad; lists host terminals) and `host/terminal/[id]`
  (the same xterm WebView). The host token is kept in `expo-secure-store` like sandbox
  tokens; the session lives in memory only and is dropped on **Lock**, and on expiry
  (the next request gets 401 → PIN pad again).
* **App runs** ([app-runs-and-emulator.md](app-runs-and-emulator.md) §3): the project screen's
  **Run** lists `RunTargetInfo`s and active `AppRun`s (live via `app.updated`) with Logs, Stop,
  actions and **Open** per viewer (`url` in-app WebView, `deeplink` → `Linking.openURL`,
  `display` → the display screen, `android` → the host emulator screen). The host screen adds
  **Android emulator**: AVD picker, Start/Stop, a **Screen sharing** card (device picker over
  `devices`, **Open screen** → `host/android?serial=…` = `<host>/ui/android#ticket=…&serial=…` on a
  full-bleed stage with a floating bar: rotate, full screen, reconnect; full screen hides the bar
  and status bar behind a small exit button, Android back leaves it) and **Link sandbox** (`POST /v1/android/link` with the active sandbox's URL and token).
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
| `bun run test:infra [--quick\|--coverage]` | bats suites in `infra/tests` (containers `tesseract-test-*`, images `tesseract/infra-test:*`) |
| `bun run e2e [--no-build\|--keep\|--web\|--electron\|--electron-only]` | `infra/e2e`: builds `tesseract/sandbox:e2e`, starts project `tesseract-e2e` (volumes `tesseract-e2e-*`) in local mode on `127.0.0.1:17700/15901`, runs `bun test ./infra/e2e`, removes the stack |
| `bun run --cwd apps/electron test` (part of `bun run test`) | `@tesseract/electron` vitest: node project (`tests/`, `src/{core,shared,main}`, `cli/`, `scripts/`; temp dirs `tesseract-test-*`) and happy-dom project (`src/renderer`); no display, no Docker |
| `bun run electron:e2e` | `apps/electron/e2e`: Playwright `_electron` specs (shell, preferences, onboarding, CLI, packaging, visual snapshots, live controller); headless on Linux, isolated profiles under `$TMPDIR/tesseract-test-*`; Docker resources `tesseract-test-*`; live tests only with `TESSERACT_E2E_URL`/`TESSERACT_E2E_TOKEN`, which `bun run e2e --electron[-only]` sets for its `tesseract-e2e` stack |
| `bun run electron:smoke` | the built Linux AppImage/deb: packaged files, sandbox context vs its `manifest.json`, update feed, `tesseract --version`, deb postinst and desktop entry, one headless render of the wizard |

The e2e suite is not a workspace: typecheck it with `bunx tsc -p infra/e2e/tsconfig.json`.
Runbook: [e2e-testing.md](../runbooks/e2e-testing.md).

## 12. Desktop app (`apps/electron`, package `@tesseract/electron`)

The Tesseract desktop app for Linux, macOS and Windows. It is the Electron rebuild of the GTK app in
`apps/desktop` (same app id `dev.tesseract.Desktop`, same `config.json`, same pages, matched pixel for pixel
against `docs/electron/reference/`). It talks to the sandbox controller with `@tesseract/client` like the phone,
and it also sets the machine up: Docker, the sandbox stack and image, the host Android emulator.
Specs and the code conventions: [docs/electron/](../electron/README.md).

### 12.1 Processes and windows

| Part | What |
|---|---|
| Main (`src/main`, ESM) | windows, tray, menu, deep links, updater, IPC handlers (`tesseract:<service>:<method>`, events `tesseract:<service>:event:<event>`); spawns `docker`, `tesseract-controller host serve`, the Android emulator; proxies the renderer's HTTP through `net.fetch` |
| Core (`src/core`, Node only) | docker, sandbox, android, connection, host, syncback, claude, config, paths; shared with the `tesseract` CLI (§7.1), never imports `electron` |
| Preload (`src/preload`, CJS, sandboxed) | the typed IPC bridge |
| Renderer (`src/renderer`, React 19, hash router) | the shell, pages, Settings, setup wizard; dev server `http://127.0.0.1:4545` |

Main window 1240×800 (min 360×480), setup wizard 880×620 (min 760×560); both frameless (macOS traffic
lights, drawn window controls on Linux/Windows). Single instance; a second launch forwards its arguments.

### 12.2 Setup wizard

Opens instead of the main window until `onboarding.completedAt` is set, unless a connection is already
configured (file or env). Before opening it, the app runs Docker discovery ([onboarding spec](../electron/spec/onboarding.md) §3.4, 2.5 s
timeout; off with `TESSERACT_DISABLE_DISCOVERY=1`): a sandbox whose controller answers `/v1/health` is saved as the
connection and onboarding is marked complete (`docker`/`sandbox`/`build` done, the rest skipped), so the main
window opens instead. Steps: `welcome` → `docker` → `claude` → `sandbox` (with its build phase; the id
`build` is an alias) → `android` (optional) → `pair` (optional) → `finish`.

| Step | Does |
|---|---|
| `docker` | checks the CLI, daemon, Compose, buildx and resources; Podman is reported as unsupported. Install options: macOS Docker Desktop; Windows Docker Desktop (machine or user) or WSL; Linux Docker Engine (convenience script through `pkexec`), Docker Desktop for Linux, `docker`/`kvm` group membership; always a manual path. Starts a stopped engine |
| `claude` | reads the host's `~/.claude` and `~/.claude-<n>` login state (never secrets); can create the dir |
| `sandbox` | stack choices (mode `local`/`tailscale`/`host-tailscale`, Tailscale key and tailnet, components `android`/`flutter`/`mono`/`whisper` = the Dockerfile's `WITH_*` args, Whisper models, CPUs, memory, ports, project, image, dind), writes `<userData>/sandbox/.env` (0600), then builds the image from the bundled context with `docker buildx build --progress=rawjson` (or pulls `sandboxImageRef`, or reuses an existing image), runs compose `up`, waits for `/v1/health`, pairs with `tesseract-controller pair --json` |
| `android` | its own SDK manager: Google's `repository2-3.xml` and `sys-img2-3.xml`, downloads `emulator`, `platform-tools` and one `system-images;android-<api>;google_apis;<abi>` with sha1 checks and license acceptance, unzips into the SDK root, writes the AVD (`<name>.ini` + `config.ini` with the device profile `pixel_5`/`pixel_8`/`medium_phone`/`pixel_tablet` → `hw.device.*`, `hw.lcd.*`, `skin.name`, and internal storage 2–64 GB, default 6 → `disk.dataPartition.size`); checks KVM (Linux x64, `x86_64` images), WHPX (Windows x64) or HVF (macOS, `arm64-v8a` on Apple silicon) with `emulator -accel-check`; Linux and Windows on arm64 are unsupported, and only Linux can link the emulator to the sandbox. The host shell daemon uses this SDK for the host emulator ([app-runs-and-emulator.md](app-runs-and-emulator.md) §2) |
| `pair` | QR code and link for the phone |
| `finish` | summary; "start the sandbox with Tesseract" (`sandboxAutostart`, default on): at every launch, also `--hidden`, `compose up -d` for a Tesseract-created stack only (its own env file, matching project, `builtAt` set); skipped when off or already running; Docker unreachable → one notification |

Contract details: [docs/electron/spec/onboarding.md](../electron/spec/onboarding.md).

### 12.3 Routes, deep links, launch flags

| What | Values |
|---|---|
| Pages (`#/<page>`) | `overview`, `agents`, `projects`, `files`, `terminals`, `display`, `containers` (`#/containers/<name>`), `domains` |
| Settings (`?preferences=<section>`) | `connection`, `appearance`, `claude`, `host-shell`, `stt`, `sandbox`, `containers`, `android`, `about` |
| Wizard (`#/onboarding/<step>`) | as §12.2 |
| Deep links | `tesseract://<page>[?params]`, `tesseract://preferences|settings[/<section>]`, `tesseract://onboarding|setup[/<step>]`, `tesseract://new-conversation`, `pair`, `pair-host`, `refresh`, `rediscover`, `about`; registered only in packaged builds |
| Launch flags | `--hidden`, `--page <id>`, `--quit` (ask the running instance to quit), `--debug`; `--sync`, `--pull`, `--revert`, `--sync-status`, `--get` run the CLI (§7.1) and exit |

### 12.4 Files

| What | Linux | macOS | Windows |
|---|---|---|---|
| `config.json` (`TESSERACT_DESKTOP_CONFIG`; shared with the GTK app and the CLI) | `$XDG_CONFIG_HOME/tesseract-desktop/config.json` (`~/.config/…`) | `<userData>/config.json` | `<userData>/config.json` |
| `userData` (`TESSERACT_USER_DATA`) | `~/.config/Tesseract` | `~/Library/Application Support/Tesseract` | `%APPDATA%\Tesseract` |
| Sandbox env file | `<userData>/sandbox/.env` (0600) | same | same |
| Docker installer downloads | `<userData>/downloads/` | same | same |
| Android catalog cache | `<userData>/android/cache/` | same | same |
| Window state | `<userData>/window-state.json` | same | same |
| Android SDK (default, `androidSdkRoot` overrides) | `~/.local/share/tesseract/android-sdk` | `~/Library/Application Support/Tesseract/android-sdk` | `%LOCALAPPDATA%\Tesseract\android-sdk` |
| AVDs | `$ANDROID_AVD_HOME`, else `$ANDROID_USER_HOME/avd`, else `~/.android/avd` | same | same |
| State (`TESSERACT_STATE_DIR`): sync-back links, snapshots, locks | `~/.local/state/tesseract` | `~/.local/state/tesseract` | `%LOCALAPPDATA%\Tesseract\state` |
| Cache (`metrics.json`) | `~/.cache/tesseract-desktop` | `~/Library/Caches/Tesseract` | `%LOCALAPPDATA%\Tesseract\cache` |

`config.json` keys: the GTK ones (`url` (legacy `apiUrl`), `token`, `name`, `pairingUrl`, `appearance`, `zoom`,
`sidebarWidth`, `host_shell_autostart`) plus `onboarding` (`{ version, step, statuses, completedAt }`),
`sandboxStack`, `sandboxImageRef`, `sandboxAutostart`, `androidSdkRoot`, `androidAvd`. Writes are serialized
read-modify-write, keep unknown keys and are atomic with mode 0600. On macOS and Windows, at the default config
path, the token is stored encrypted with Electron `safeStorage` as `tokenSealed`; on Linux it stays plain so the
GTK app and the CLI can read it.

### 12.5 Packaging and CLI install

`bun run electron:dist [-- --platform linux|mac|win] [--dir] [--publish never|always|onTag] [--update-url <url>]
[--channel <name>] [--smoke]` runs `electron-vite build`, `cli:build` (`tesseract` + `tesseract-controller` per target),
`bundle:sandbox` (git-tracked sandbox build context + `manifest.json` + `build-weights.json` into
`build/sandbox-context/`) and electron-builder. Artifacts go to `apps/electron/dist/`
(`Tesseract-<version>-<arch>.<ext>`).

| OS | Installer | `tesseract` on PATH |
|---|---|---|
| macOS | universal `dmg` + `zip` (hardened runtime; notarized when the `APPLE_*` variables are set) | Settings › About "Install tesseract command": admin prompt, symlink `/usr/local/bin/tesseract` (only from `/Applications`) |
| Windows | per-user one-click NSIS `exe` (x64) | the installer adds `$INSTDIR\resources\bin` to the user `Path` and removes it on uninstall |
| Linux | `AppImage` and `deb` (x64) | deb: app in `/opt/Tesseract`, postinst links `/usr/bin/tesseract` (only when free or already ours); AppImage: Settings › About copies it to `~/.local/share/tesseract/bin/tesseract` and links `~/.local/bin/tesseract`; on install and every AppImage launch the app writes `~/.local/share/tesseract/app.json` `{appPath, sandboxDir}` and syncs the bundled context to `~/.local/share/tesseract/sandbox` (marker `.bundle-hash`) |
| Headless server (macOS/Linux, no app, §7.2) | `./setup-server.sh` on the server (repo checkout), or `infra/scripts/deploy-mac` from the dev box | `~/.tesseract/bin/{tesseract,tesseract-controller}` (add `~/.tesseract/bin` to `PATH`); sandbox context in `~/.tesseract/sandbox` (found next to `bin/`; `TESSERACT_SANDBOX_CONTEXT` overrides) |

`extraResources`: `resources/bin/{tesseract,tesseract-controller}`, `resources/sandbox/` (the build context the
wizard and `tesseract sandbox build` use), icons and font licenses. Updates: electron-updater against the generic
feed in `electron-builder.yml` (first check 60 s after start, then every 6 h; `TESSERACT_DISABLE_UPDATES` turns it off).
