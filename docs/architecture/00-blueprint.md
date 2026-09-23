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
| Named volumes | `<prefix>-workspace`, `<prefix>-home`, `<prefix>-tailscale`, `<prefix>-dind-certs`, `<prefix>-dind-data`; prefix = `THEONE_VOLUME_PREFIX`, default the project name (so `theone-*`) |
| Image | `theone/sandbox:latest` (`THEONE_IMAGE`) |
| Sandbox service / container hostname | `sandbox` (tailscale mode: the sidecar's hostname `THEONE_HOSTNAME`, because it joins the sidecar's network namespace) |
| Tailscale node hostname (default) | `theone-sandbox` (`THEONE_HOSTNAME`, also `THEONE_SANDBOX_ID`) |
| Controller listen | `0.0.0.0:7700` inside the sandbox netns (`THEONE_PORT`) |
| Host ports (local, host-tailscale) | `7700`, `5901` on `THEONE_BIND_ADDR` only (`THEONE_CONTROLLER_HOST_PORT`, `THEONE_VNC_HOST_PORT`) |
| X display | `:1` (`THEONE_DISPLAY`), default geometry `1600x900` (`THEONE_DISPLAY_GEOMETRY`) |
| VNC (RFB) | TCP `5901`, VncAuth (`THEONE_VNC_PASSWORD`; hash `/home/dev/.vnc/passwd`, generated plaintext `/home/dev/.vnc/password` 0600) |
| Per-start secrets | `/run/theone/controller.env` (0600, dev): VNC password and, if set, `THEONE_TOKEN`; read only by `theone-controller-run` |
| supervisord | socket `/run/supervisor/supervisor.sock` (0700, dev), logs `/workspace/.agent/logs/supervisor/` |
| Sandbox user | `dev` (uid/gid `1000` by default, build args `DEV_UID`/`DEV_GID`) |
| Workspace | `/workspace` (volume `<prefix>-workspace`) |
| Projects | `/workspace/projects/<projectId>` |
| Artifacts | `/workspace/artifacts/<project>-<platform>-<profile>-<version>.<ext>` (`-2`, `-3`… on collision) |
| Agent memory | `/workspace/.agent/` (§6.4, SPEC.md) |
| Controller data | `/workspace/.agent/controller/` (`THEONE_DATA_DIR`, 0700) → `state.db`, `token`, `logs/` |
| Home | `/home/dev` (volume `<prefix>-home`: Claude credentials, wine prefix, caches) |
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
| `THEONE_CLAUDE_BIN` | `claude` | Claude Code executable |
| `THEONE_CLAUDE_PERMISSION_MODE` | `bypassPermissions` | passed to headless Claude runs (the container is the boundary) |
| `THEONE_SANDBOX_ID` | container hostname | identity shown in the app |
| `THEONE_LOG_LEVEL` | `info` | `debug|info|warn|error` |
| `THEONE_CORS_ORIGINS` | `*` | comma list; auth is header/ticket based, never cookies |
| `SHELL` | `bash` | login shell for `shell` terminals (`$SHELL -l`) |

Invalid values stop startup with a clear message. The controller must run on a
developer laptop too (for tests): every sandbox dependency (X display, VNC,
claude, wine, java) is optional and reported as unavailable instead of crashing.

Children (processes, build steps, terminals, agent runs, git/zip helpers) get the
controller's environment **without** `THEONE_TOKEN` and `THEONE_VNC_PASSWORD`, plus
`THEONE_PROCESS_ID` / `THEONE_BUILD_ID` / `THEONE_TERMINAL_ID` / `THEONE_AGENT_RUN_ID`.
Agent runs also drop `CLAUDECODE`.

### 4.2 Stack and operator (`infra/compose/.env`, `infra/scripts/sandbox`)

Compose interpolates these; a container receives only the variables its compose file
lists. Exported shell variables win over the env file; empty counts as unset.

| Var | Default | Meaning |
|---|---|---|
| `THEONE_MODE` | `tailscale` | `tailscale` \| `host-tailscale` \| `local` (§9); `--mode` wins |
| `THEONE_DIND` | — | `1` adds `compose.dind.yml` (same as `--dind`) |
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
| `THEONE_DISPLAY_GEOMETRY` | `1600x900` | Xvnc geometry |
| `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` | — | optional Claude credentials (visible to every sandbox process) |
| `SANDBOX_CPUS` / `SANDBOX_MEMORY` / `SANDBOX_PIDS` | `4` / `8g` / `4096` | sandbox limits |
| `DIND_CPUS` / `DIND_MEMORY` / `DIND_PIDS` | `4` / `8g` / `4096` | dind limits (cap everything it runs) |
| `TZ` | `UTC` | sandbox time zone |
| `DEV_UID`, `DEV_GID`, `WITH_ANDROID`, `WITH_MONO`, `CLAUDE_CODE_VERSION` | §8 | build args passed by compose |

Image-provided environment: `THEONE_IMAGE_VERSION`, `THEONE_WORKSPACE`,
`THEONE_HOST`, `THEONE_PORT`, `THEONE_DATA_DIR`, `THEONE_VNC_HOST`, `THEONE_DISPLAY`,
`THEONE_DISPLAY_GEOMETRY`, `THEONE_VNC_PORT`, `XDG_RUNTIME_DIR=/run/user/<uid>`,
`WINEPREFIX`/`WINEARCH`/`WINEDEBUG`, `APPIMAGE_EXTRACT_AND_RUN=1`, `DISABLE_AUTOUPDATER=1`,
`JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`. `DISPLAY` is not set globally: only
interactive login shells get `DISPLAY=:1` (`/etc/profile.d/theone.sh`). Rootfs helper
knob: `THEONE_WAIT_X_TIMEOUT` (s, default 60).

## 5. Controller protocol v1

`PROTOCOL_VERSION = 1`. JSON over HTTPS; all REST paths are under `/v1`.

### 5.1 Auth and errors

* REST: `Authorization: Bearer <token>`; constant-time compare. Only
  `GET /v1/health` is public. 401 responses carry `WWW-Authenticate: Bearer realm="theone"`.
* WebSocket and browser-opened URLs (WebView pages, artifact downloads) use a
  **one-time ticket**: `POST /v1/auth/ticket` → `200 { ticket, expiresAt }`
  (random 32 bytes, valid 60 s, consumed on first use, not scoped to a target).
  WS URLs take `?ticket=`; a ticket is never accepted as a bearer token.
* Browser pages under `/ui/*` are static and secret-free; they read
  `ticket`/`password`/`session`/`viewOnly` from the **URL fragment** (`#…`, never sent
  to the server), clear it, and then open the WS with `?ticket=`.
* Errors: HTTP status + `{ "error": { "code": string, "message": string } }`.
  Codes → status: `bad_request` 400, `unauthorized` 401, `forbidden` 403,
  `not_found` 404, `conflict` 409, `internal` 500, `unavailable` 503. Exceptions:
  bodies over 1 MiB get **413** with code `bad_request`; a plain GET (no upgrade) on a
  WS-only path gets 400.

### 5.2 REST endpoints

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/v1/health` | — | `Health { ok, version, protocolVersion, sandboxId }` |
| POST | `/v1/auth/ticket` | — | `200 Ticket { ticket, expiresAt }` |
| GET | `/v1/status` | — | `SandboxStatus` |
| GET | `/v1/context` | — | `AgentContext { files: AgentContextFile[] }`: regular files `.agent/*.md` and `.agent/projects/<id>/*.md` (no symlinks, FIFOs or devices), content capped at 64 KiB each |
| GET | `/v1/projects` | — | `Project[]` |
| POST | `/v1/projects` | `CreateProject { name, gitUrl?, branch? }` | `201 { project, processId? }` (clone runs as a tracked process); 409 if the directory exists |
| GET | `/v1/projects/:id` | — | `Project` |
| GET | `/v1/projects/:id/git` | — | `GitDetails { branch, ahead, behind, files: GitFileStatus[], log: GitCommit[] }` |
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
| GET | `/v1/artifacts/:id/download` | bearer **or** `?ticket=` | file stream (`Content-Disposition: attachment`, `X-Content-SHA256`); 404 if the file is gone |
| GET | `/v1/display` | — | `DisplayStatus` |
| GET | `/v1/display/screenshot` | — | `image/png` of the virtual display; 503 without a display |
| GET | `/v1/agent/runs` | `?projectId=` | `AgentRun[]` |
| POST | `/v1/agent/runs` | `StartAgentRun { projectId?, prompt, resumeSessionId? }` | `201 AgentRun`; 503 without `claude` |
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
                  sizeBytes: number; sha256: string; platform: string; createdAt: string };
type BuildJob = { id: string; projectId: string; target: BuildTarget; profile: BuildProfile; state: BuildState;
                  stage: string | null /* usually install|compile|package|collect */;
                  progress: number | null /* fraction 0..1 */; startedAt: string | null; endedAt: string | null;
                  createdAt: string; artifacts: Artifact[]; error: string | null };

type AgentRunState = "running" | "succeeded" | "failed" | "cancelled";
type AgentRun = { id: string; projectId: string | null; prompt: string; sessionId: string | null; state: AgentRunState;
                  startedAt: string; endedAt: string | null; costUsd: number | null; result: string | null; error: string | null };
type StartAgentRun = { projectId?: string; prompt: string /* ≤ 200 000 */;
                       resumeSessionId?: string /* AGENT_SESSION_ID_PATTERN */ };
type AgentRunEvent =
  | { kind: "text"; seq: number; ts: string; text: string }
  | { kind: "tool_use"; seq: number; ts: string; tool: string; summary: string }
  | { kind: "tool_result"; seq: number; ts: string; tool: string | null; isError: boolean; summary: string }
  | { kind: "system"; seq: number; ts: string; text: string };

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
  | { type: "agent.updated"; run: AgentRun }
  | { type: "project.updated"; project: Project };
```

IDs: type prefix (`prc_`, `trm_`, `bld_`, `art_`, `run_`) + 10 random characters of
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

Names live in `@theone/protocol/bridge` (`PAGE_MESSAGES`, `PAGE_STATES`; zod-free so
the pages can import it). Pages post to `window.ReactNativeWebView.postMessage`
(JSON string) and, when framed, `parent.postMessage(message, "*")`:

| Message | From → to | Payload |
|---|---|---|
| `terminal-state`, `vnc-state` | page → app | `{ type, state, code? }`, `state` ∈ `connecting\|connected\|disconnected\|exited\|error`; `code` = exit code on `exited` |
| `terminal-need-ticket`, `vnc-need-ticket` | page → app | `{ type }` (terminal adds `session`) after the page's socket dropped |
| `theone-reconnect` | app → page | native: injected `window.theone.reconnect(ticket)`; web: `postMessage({ type: "theone-reconnect", ticket })` to the frame |

The app verifies the sender origin (the sandbox base URL), answers `*-need-ticket`
with a fresh ticket (automatically, up to 4 times with backoff, and again when the app
returns to the foreground), and never reconnects after `exited` or `error`.
`viewOnly=1` in the VNC fragment disables input.

## 6. Supervision & persistence

### 6.1 State

* `bun:sqlite` database at `$THEONE_DATA_DIR/state.db` (WAL) — processes, terminals
  (metadata), builds, artifacts, agent runs and their events.
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
message 4 000 chars · names 128 chars · request body 1 MiB.

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
theone-controller --version | --help
```

The CLI reads the token from `THEONE_TOKEN`/`THEONE_TOKEN_FILE` and talks to
`http://127.0.0.1:$THEONE_PORT` (the bind address unless it is a wildcard).
`api`: `METHOD` ∈ `GET|POST|DELETE`, `PATH` must start with and stay under `/v1/`,
body as argument or `-` for stdin; 2xx JSON is pretty-printed to stdout (non-JSON
bytes only when stdout is not a terminal); the token and `display.vnc.password` are
printed as `***`. Exit codes (`api`, `emit`): 0 ok, 1 request failed / non-2xx
(error body on stderr), 2 bad arguments (nothing sent).

## 8. Sandbox image

Multi-stage `infra/docker/sandbox/Dockerfile`, build context = repo root.

| Stage | Adds |
|---|---|
| `bun`, `jdk` | helper aliases for `oven/bun:${BUN_VERSION}` and `${JDK_IMAGE}` |
| `controller-build` | `bun install --frozen-lockfile --filter @theone/controller` → `bun build --compile` (host arch) |
| `base` | `${DEBIAN_IMAGE}`, tini, supervisor, sudo, git, git-lfs, curl, jq, ripgrep, fd, build-essential, python3/pip/venv/pipx, Docker CLI + compose/buildx (no daemon), Node `${NODE_MAJOR}` from nodejs.org (SHASUMS256-checked) + corepack, bun, locales, fonts, `dev` user |
| `desktop` | TigerVNC (`Xvnc`, `vncpasswd`), openbox, xterm, x11-apps (`xwd`), x11-utils, x11-xserver-utils, xdotool, imagemagick, dbus-x11, chromium, Electron runtime libs |
| `electron` | wine (`wine`, `wine64`, `wine32:i386`, `/usr/local/bin/wine64` symlink), osslsigncode, fakeroot, dpkg-dev, rpm, mono-complete if `WITH_MONO=true` |
| `android-sdk` | side stage: JDK copy, Android cmdline-tools (sha256-pinned), platform-tools, `platforms;${ANDROID_PLATFORM}`, `build-tools;${ANDROID_BUILD_TOOLS}`; empty dirs if `WITH_ANDROID=false` |
| `android` | JDK → `/opt/java/openjdk`, SDK → `/opt/android-sdk` (owned by `dev`), `/etc/profile.d/theone.sh` |
| `sandbox` (final, default) | Claude Code (`npm i -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`), rootfs, `SPEC.md` → `/etc/theone/SPEC.md`, controller binary |

Build args: `DEBIAN_IMAGE` (`debian:trixie-slim`), `BUN_VERSION` (`1.4.2`), `JDK_IMAGE`
(`eclipse-temurin:17-jdk`), `DEV_UID`/`DEV_GID` (`1000`), `ENABLE_SUDO` (`true`),
`NODE_MAJOR` (`24`), `NODE_VERSION` (empty = newest `24.x`), `WITH_MONO` (`true`),
`WITH_ANDROID` (`true`), `ANDROID_CMDLINE_TOOLS_BUILD`/`_SHA256`, `ANDROID_PLATFORM`
(`android-36`), `ANDROID_BUILD_TOOLS` (`36.0.0`), `CLAUDE_CODE_VERSION` (`latest`),
`THEONE_IMAGE_VERSION` (`0.1.0`).

Rootfs helpers (`/usr/local/bin`): `theone-entrypoint`, `theone-xvnc`, `theone-wait-x`,
`theone-controller-run`, `theone-wine-init`, `theone-screenshot`, `theone-doctor`.

Entrypoint (`/usr/local/bin/theone-entrypoint`, run by tini as root): drops empty
`THEONE_*`/`ANTHROPIC_*`/`CLAUDE_*`/`DOCKER_*` vars, fixes volume ownership, creates
workspace dirs (never following symlinks planted in the volumes), seeds
`/workspace/.agent/` templates if missing, installs SPEC.md as
`/home/dev/.claude/CLAUDE.md` if absent, writes the VNC password files and
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
| `+dind` | add `compose.dind.yml` | privileged `docker:dind` sidecar sharing `<prefix>-workspace`; sandbox gets `DOCKER_HOST=tcp://docker:2376` + TLS certs (opt-in, [ADR 0006](../adr/0006-optional-docker-in-docker.md)) |

Stacks run side by side when each has its own `THEONE_COMPOSE_PROJECT` (and thereby
volumes) plus its own host ports or `THEONE_HOSTNAME`.

Hardening defaults: sandbox without `privileged`, no host bind mounts except the
read-only serve config, `cap_drop: [ALL]` + minimal `cap_add` (CHOWN, DAC_OVERRIDE,
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
* Screens (expo-router): the **Agents tab** is the sandbox hub; routes
  `pair` (QR scan via expo-camera pairs at once; `theone://pair` deep links pre-fill and
  need a tap; manual entry), `sandbox/projects/new` (create or clone, follows the clone's log),
  `sandbox/projects/[id]`, `sandbox/builds/[id]`, `sandbox/agent/[id]` (Claude run stream),
  `sandbox/terminal/[id]` (xterm page in WebView), `sandbox/display` (noVNC in WebView,
  loaded only while `display.available && display.vnc.available`).
* WebViews load `<baseUrl>/ui/terminal#ticket=…&session=<id>` and
  `<baseUrl>/ui/vnc#ticket=…&password=…` (web platform: `<iframe>`), bridge per §5.6.
* A 401/403 or a protocol mismatch shows a notice with **Pair again**.
* Existing screens (Home, Projects, Tasks, Profile) and their in-progress edits are left intact.

## 11. Tests

| Command | Scope |
|---|---|
| `bun run typecheck`, `bun run test` | every workspace: protocol, client, controller (bun test), mobile (jest) |
| `bun run test:infra [--quick\|--coverage]` | bats suites in `infra/tests` (containers `theone-test-*`, images `theone/infra-test:*`) |
| `bun run e2e [--no-build\|--keep\|--web]` | `infra/e2e`: builds `theone/sandbox:e2e`, starts project `theone-e2e` (volumes `theone-e2e-*`) in local mode on `127.0.0.1:17700/15901`, runs `bun test ./infra/e2e`, removes the stack |

The e2e suite is not a workspace: typecheck it with `bunx tsc -p infra/e2e/tsconfig.json`.
Runbook: [e2e-testing.md](../runbooks/e2e-testing.md).
