# Controller protocol v1

This is a readable reference for the API that `theone-controller` serves and
that `@theone/client` consumes. It is normative only where it repeats
[the blueprint](00-blueprint.md) §5. The zod schemas in
[`packages/protocol/src`](../../packages/protocol/src) are the executable
contract. If this page disagrees with them, the schemas win: fix this page.

- [Basics](#basics)
- [Authentication](#authentication)
- [REST endpoints](#rest-endpoints)
- [WebSocket endpoints](#websocket-endpoints)
- [WebView bridge](#webview-bridge)
- [Pairing link](#pairing-link)
- [Calling the API from inside the sandbox](#calling-the-api-from-inside-the-sandbox)
- [Limits](#limits)
- [Evolving the protocol](#evolving-the-protocol)

## Basics

| Aspect | Rule |
|---|---|
| Base URL | Tailscale mode: `https://<THEONE_HOSTNAME>.<tailnet>.ts.net`. Local mode: `http://127.0.0.1:7700` |
| Version | `PROTOCOL_VERSION = 1`. REST paths start with `/v1`, browser pages with `/ui` |
| Encoding | JSON (`Content-Type: application/json`), UTF-8 |
| Timestamps | ISO-8601 UTC strings, e.g. `2026-09-23T14:10:03.512Z` |
| IDs | type prefix + 10 characters of lowercase Crockford base32: `prc_` process, `trm_` terminal, `bld_` build, `art_` artifact, `run_` agent run (e.g. `bld_7f3k2q9xa1`). Validators accept `<prefix>[A-Za-z0-9_-]{1,64}` |
| Project IDs | directory name under `/workspace/projects`, `^[a-z0-9][a-z0-9._-]{0,63}$`; input is lower-cased |
| Errors | HTTP status + `{ "error": { "code", "message" } }` |

| `error.code` | HTTP |
|---|---|
| `bad_request` | 400 (413 when the body exceeds 1 MiB) |
| `unauthorized` | 401 (with `WWW-Authenticate: Bearer realm="theone"`) |
| `forbidden` | 403 |
| `not_found` | 404 |
| `conflict` | 409 (project exists, port taken) |
| `internal` | 500 |
| `unavailable` | 503 (an optional dependency such as the display, claude, wine, java or PTY support is missing) |

```json
{ "error": { "code": "not_found", "message": "Build bld_7f3k2q9xa1 not found" } }
```

## Authentication

**REST: bearer token.** Every request except `GET /v1/health` needs
`Authorization: Bearer <token>`. The controller compares tokens in constant
time. The token is 32 random bytes in base64url, generated on first start into
`$THEONE_DATA_DIR/token` (mode 0600) unless `THEONE_TOKEN` is set. It reaches
the phone only through the pairing link.

**WebSockets and browser URLs: one-time tickets.** Browsers cannot set headers
on WebSocket upgrades or on downloads opened by the OS, so those use tickets:

```http
POST /v1/auth/ticket
Authorization: Bearer <token>

200 → { "ticket": "q9I0v...", "expiresAt": "2026-09-23T14:11:03.512Z" }
```

A ticket is 32 random bytes, valid for 60 s, and **consumed on first use**
(the response is `200`, not `201`). Request a new ticket for every WebSocket
connection, reconnect and download. Pass it as `?ticket=` on WS URLs and on
`/v1/artifacts/:id/download`. A ticket is never accepted as a bearer token, and it
is not bound to a target: any unused ticket opens any socket or download until
it expires.

**Browser pages (`/ui/*`)** are static and contain no secrets. The app opens
them with secrets in the URL **fragment**, which browsers never send to the
server and which does not appear in access logs:

```text
https://theone-sandbox.tail1234.ts.net/ui/terminal#ticket=<ticket>&session=trm_x1y2z3w4v5
https://theone-sandbox.tail1234.ts.net/ui/vnc#ticket=<ticket>&password=<vnc password>
```

The page reads the fragment and opens `wss://…/v1/terminals/<id>/stream?ticket=…`
or `wss://…/v1/display/vnc?ticket=…`. Auth never uses cookies, so
`THEONE_CORS_ORIGINS=*` is safe by construction.

## REST endpoints

All bodies and responses are JSON unless stated. Type names refer to
[blueprint §5.4](00-blueprint.md#54-core-types-authoritative-names-zod-schemas-live-in-theoneprotocol).

### System

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/v1/health` | public | `Health` |
| POST | `/v1/auth/ticket` | none | `Ticket` |
| GET | `/v1/status` | none | `SandboxStatus` |
| GET | `/v1/identity` | none | `Identity`: Tailscale viewer, owner, node, tailnet ([networking](networking-tailscale.md#tailscale-identity-localapi)); `available: false` with nulls when Tailscale cannot be asked |
| GET | `/v1/context` | none | `AgentContext` (regular files `/workspace/.agent/*.md` and `.agent/projects/<id>/*.md`, each capped at 64 KiB; symlinks, FIFOs and devices skipped) |

```jsonc
// GET /v1/health
{ "ok": true, "version": "0.1.0", "protocolVersion": 1, "sandboxId": "theone-sandbox" }

// GET /v1/status (abridged)
{
  "sandboxId": "theone-sandbox", "hostname": "sandbox", "version": "0.1.0",
  "startedAt": "2026-09-23T09:00:00.000Z", "uptimeSec": 18003,
  "resources": {
    "cpu": { "cores": 8, "load1": 1.2, "load5": 0.9, "load15": 0.7 },
    "memory": { "totalBytes": 17179869184, "usedBytes": 5368709120 },
    "disk": { "path": "/workspace", "totalBytes": 536870912000, "usedBytes": 64424509440 }
  },
  "display": { "display": ":1", "available": true, "width": 1600, "height": 900,
               "vnc": { "available": true, "port": 5901, "password": "<vnc password>" },
               "webPath": "/ui/vnc" },
  "tools": [ { "name": "node", "version": "24.8.0" }, { "name": "wine", "version": "wine-10.0" },
             { "name": "adb", "version": null } ],
  "counts": { "projects": 2, "runningProcesses": 1, "activeBuilds": 0, "terminals": 1, "agentRuns": 0 }
}

// GET /v1/identity (host-tailscale with --tailscale-api, called from a tailnet device)
{ "sandboxId": "theone-sandbox",
  "tailscale": { "available": true, "source": "localapi", "tailnet": "tail1234.ts.net",
    "viewer": { "id": "3460960228565063", "loginName": "you@github", "displayName": "You",
                "profilePicUrl": "https://avatars.githubusercontent.com/u/1?v=4" },
    "viewerNode": { "hostName": "pixel-9", "dnsName": "pixel-9.tail1234.ts.net", "os": "android",
                    "tailscaleIps": ["100.64.0.2", "fd7a:115c:a1e0::2"], "online": true },
    "owner": { "id": "3460960228565063", "loginName": "you@github", "displayName": "You",
               "profilePicUrl": "https://avatars.githubusercontent.com/u/1?v=4" },
    "node": { "hostName": "workstation", "dnsName": "workstation.tail1234.ts.net", "os": "linux",
              "tailscaleIps": ["100.64.0.1", "fd7a:115c:a1e0::1"], "online": true } } }

// GET /v1/context
{ "files": [ { "name": "CURRENT_TASK.md",            // relative to .agent, e.g. "projects/app/TEST_STATE.md"
               "path": "/workspace/.agent/CURRENT_TASK.md",
               "sizeBytes": 412, "modifiedAt": "2026-09-23T14:10:00.000Z",
               "truncated": false, "content": "# Current Task\n..." } ] }
```

A `null` tool version means the tool is not installed. The controller reports
missing optional pieces this way instead of failing. `resources` are
cgroup-aware (the container's CPU and memory limits, not the host's).
`display.vnc.available` is true only when an RFB server answered with its
banner.

### Projects

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/v1/projects` | none | `Project[]` |
| POST | `/v1/projects` | `CreateProject { name, gitUrl?, branch? }` | `201 { project, processId? }` |
| GET | `/v1/projects/:id` | none | `Project` |
| GET | `/v1/projects/:id/git` | none | `GitDetails` |
| GET | `/v1/projects/:id/sync/changes` | none | `SyncChanges` |
| POST | `/v1/projects/:id/sync/export` | `SyncExport { paths }` | `application/gzip` tar |
| POST | `/v1/projects/:id/sync/ack` | `SyncAck` | `SyncChanges` |
| GET | `/v1/projects/:id/sync/requests` | none | `SyncRequest[]` |
| POST | `/v1/projects/:id/sync/requests` | `CreateSyncRequest` | `201 SyncRequest` |
| GET | `/v1/sync/requests?status=` | none | `SyncRequest[]` |
| POST | `/v1/sync/requests/:id/claim` | `ClaimSyncRequest` | `SyncRequest` |
| POST | `/v1/sync/requests/:id/complete` | `CompleteSyncRequest` | `SyncRequest` |
| POST | `/v1/sync/requests/:id/cancel` | none | `SyncRequest` |
| POST | `/v1/sync/heartbeat` | `SyncHeartbeat` | `204` |

The `sync` routes copy sandbox changes back to the host checkout; the contract is
[sync-back.md](sync-back.md).

`name` (1–128 chars) is slugged into the project id with `projectIdFromName`
(`"My App"` → `my-app`); an existing directory gives `409`. `gitUrl` must be an
`https`, `ssh`, `git` or `file` URL or `user@host:path`; `branch` must be a plain
ref (no leading `-`, `/` or `.`, no `..`), so neither can smuggle options into
`git clone`. With `gitUrl`, the clone (`git clone --progress [--branch b] -- <url> .`)
runs as a tracked process whose id comes back as `processId`: follow it on
`/v1/processes/:id/logs/stream`. On failure the directory stays in place. The controller re-detects `framework`,
`packageManager`, `scripts` and `buildTargets` from the files on disk.

```jsonc
// POST /v1/projects
{ "name": "electron-hello", "gitUrl": "https://github.com/acme/electron-hello.git", "branch": "main" }
// 201
{ "project": { "id": "electron-hello", "name": "electron-hello",
               "path": "/workspace/projects/electron-hello", "framework": "unknown",
               "packageManager": null, "scripts": [], "buildTargets": [], "git": null },
  "processId": "prc_0h3kq8v2mx" }
```

### Processes

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/v1/processes` | `?projectId=` | `ProcessInfo[]` |
| POST | `/v1/processes` | `StartProcess { projectId, command, name?, env?, display?, port? }` | `201 ProcessInfo` |
| GET | `/v1/processes/:id` | none | `ProcessInfo` |
| DELETE | `/v1/processes/:id` | none | `ProcessInfo` (SIGTERM to the process group, SIGKILL after 5 s) |
| GET | `/v1/processes/:id/logs` | `?tail=500` (max 2000) | `LogLine[]` |

A string `command` runs as `bash -lc <command>` in the project directory. An
array is executed directly. `display: true` sets `DISPLAY=$THEONE_DISPLAY` so
the window appears in VNC. `port` declares the port the process will listen
on. The controller answers `409 conflict` if another tracked process claims it
or something already listens there (the message names the tracked process or
the pid), and shows it in the UI and `RUNTIME.md`.

```jsonc
// POST /v1/processes
{ "projectId": "electron-hello", "name": "electron", "command": "npm start", "display": true }
// 201
{ "id": "prc_4k2m9a1zq0", "projectId": "electron-hello", "name": "electron", "command": "npm start",
  "cwd": "/workspace/projects/electron-hello", "pid": 4312, "port": null, "display": true,
  "state": "running", "exitCode": null, "startedAt": "2026-09-23T14:12:00.000Z", "endedAt": null }
```

States: `starting → running → exited | failed | stopped`. A graceful
controller shutdown stops its processes (`stopped`). Processes still marked
alive after a crash are set to `orphaned` on the next start (they may still be
running, untracked). Nothing is ever re-run automatically. When a process's
leader exits, whatever it left in its process group or session is stopped
before the final state is recorded; only programs that call `setsid` survive.

### Terminals

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/v1/terminals` | none | `TerminalInfo[]` |
| POST | `/v1/terminals` | `CreateTerminal { kind: "shell" \| "claude", projectId?, cols, rows }` | `201 TerminalInfo` |
| DELETE | `/v1/terminals/:id` | none | `TerminalInfo` |

`shell` starts a login bash. `claude` starts interactive Claude Code. Both run
in the project directory, or `/workspace` without a project, inside a PTY that
keeps running when clients disconnect. Attach with the stream endpoint below.
The list contains only sessions of the current controller lifetime.

### Builds and artifacts

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/v1/builds` | `?projectId=` | `BuildJob[]` |
| POST | `/v1/builds` | `StartBuild { projectId, target, profile? }` | `201 BuildJob` (`profile` defaults to `debug`); `400` for a target the project lacks; `503` when `wine`/`java` is missing |
| GET | `/v1/builds/:id` | none | `BuildJob` |
| DELETE | `/v1/builds/:id` | none | `BuildJob` (cancel) |
| GET | `/v1/builds/:id/logs` | `?tail=500` | `LogLine[]` |
| GET | `/v1/artifacts` | `?projectId=` | `Artifact[]` |
| GET | `/v1/artifacts/:id/download` | bearer **or** `?ticket=` | file stream, `Content-Disposition: attachment`, `X-Content-SHA256`; `404` if the file was deleted |

Targets: `electron-linux`, `electron-windows`, `android-apk`, `web`, `script`.
States: `queued → running → succeeded | failed | cancelled`. `stage` is one of
`install`, `compile`, `package`, `collect` while running. `progress` is a
fraction in `[0, 1]` or `null`. Recipes are described in
[controller.md](controller.md#build-queue-and-recipes).

```jsonc
// POST /v1/builds
{ "projectId": "electron-hello", "target": "electron-windows", "profile": "release" }
// GET /v1/builds/bld_7f3k2q9xa1 after success
{ "id": "bld_7f3k2q9xa1", "projectId": "electron-hello", "target": "electron-windows",
  "profile": "release", "state": "succeeded", "stage": "collect", "progress": 1,
  "startedAt": "2026-09-23T14:20:00.000Z", "endedAt": "2026-09-23T14:23:41.000Z",
  "createdAt": "2026-09-23T14:19:59.000Z", "error": null,
  "artifacts": [ { "id": "art_2b8n4d6f0h", "projectId": "electron-hello", "buildId": "bld_7f3k2q9xa1",
                   "fileName": "electron-hello-windows-release-1.0.0.exe",
                   "path": "/workspace/artifacts/electron-hello-windows-release-1.0.0.exe",
                   "sizeBytes": 78123456, "sha256": "9f86d0…", "platform": "windows",
                   "createdAt": "2026-09-23T14:23:40.000Z" } ] }
```

### Display

| Method | Path | Response |
|---|---|---|
| GET | `/v1/display` | `DisplayStatus` (includes the VNC password, for noVNC) |
| GET | `/v1/display/screenshot` | `image/png` of display `:1`; `503 unavailable` without a display |
| GET | `/v1/display/browser` | `BrowserStatus { available, tabs: BrowserTab[] }`: Chromium tabs, current first, `phoneUrl` reachable over Tailscale or null; `available: false` when DevTools is unreachable |

### Agent runs (headless Claude)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/v1/agent/runs` | `?projectId=&archived=` | `AgentRun[]`: non-archived runs, or only archived ones with `archived=1` |
| POST | `/v1/agent/runs` | `StartAgentRun { projectId?, prompt, mode?, attachmentIds?, resumeSessionId? }` | `201 AgentRun` (with `mode` and `attachments: Upload[]`) |
| POST | `/v1/agent/runs/archive` | `{ ids, archived } \| { all: true, archived, projectId? }` | `{ count }`; running runs are skipped |
| POST | `/v1/agent/runs/delete` | `{ ids } \| { all: true, projectId?, archived? }` | `{ count }`; deletes runs and their events; running runs are skipped |
| GET | `/v1/agent/runs/:id` | none | `AgentRun & { events: AgentRunEvent[] }` |
| POST | `/v1/uploads` | `CreateUpload { name, mimeType, data /* base64 */ }` | `201 Upload` (28 MiB body, 20 MiB file) |
| GET | `/v1/uploads/:id/content` | bearer or `?ticket=` | file stream (single `Range` supported) |
| POST | `/v1/transcriptions` | `CreateTranscription { uploadId, language? }` | `Transcription { uploadId, text, language, durationMs, engine }`; 503 when the profile is `off` or without a speech-to-text engine; one runs at a time (FIFO) |
| GET | `/v1/stt` | none | `SttStatus { profile, profiles, engine, ready, reason, model, cpus, busy, queued }` |
| PUT | `/v1/stt` | `UpdateStt { profile: "off" \| "eco" \| "balanced" \| "performance" }` | `SttStatus`; stored across restarts, publishes `stt.updated` on change |
| DELETE | `/v1/agent/runs/:id` | none | `AgentRun` (cancel) |

The controller runs `claude -p` with streaming JSON output and
`--permission-mode $THEONE_CLAUDE_PERMISSION_MODE` in the project directory,
and condenses the stream into `AgentRunEvent`s (`text`, `tool_use`,
`tool_result`, `system`). `sessionId` is Claude's session id: pass it as
`resumeSessionId` to continue the conversation. `usage` (input, output,
cache read, cache write and total tokens) and `result` are filled in from
Claude's final result message; there is no dollar cost.

### Status events from the sandbox agent

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/v1/events` | `StatusEvent` without `ts` | `202` |

```bash
theone-controller emit --status building --project expensifo --platform android \
  --stage gradle --message "Compiling release build"
# equivalent to
theone-controller api POST /v1/events \
  '{"project":"expensifo","status":"building","platform":"android","stage":"gradle","message":"Compiling release build"}'
```

The controller stamps `ts` and broadcasts `{ "type": "status", "event": … }` on
the events socket. SPEC.md §8.1 defines the status vocabulary the agent uses.

## WebSocket endpoints

Every WS URL needs `?ticket=<fresh ticket>`. Frames are JSON text, except
the VNC bridge, which is binary.

| Upgrade outcome | Meaning |
|---|---|
| 101 | upgraded |
| 400 | a plain request (no `Upgrade: websocket`) on a WS path |
| 401 | missing, expired or already used ticket |
| 404 | the process, build, run or terminal does not exist |

| Close code | Meaning |
|---|---|
| 1000 | the stream's target ended (after `exit` / the final `run`) |
| 1011 | the stream could not be set up |
| 1006 (client-side) | dropped connection, including the server closing a socket whose send buffer passed 16 MiB; reconnect with a fresh ticket |

Client frames are limited to 1 MiB.

### `/v1/events`: server → client

```jsonc
{ "type": "hello", "protocolVersion": 1, "sandboxId": "theone-sandbox" }   // first frame
{ "type": "ping" }                                                          // every 25 s; client may answer { "type": "pong" }
{ "type": "status", "event": { "project": "expensifo", "status": "building", "platform": "android",
                               "stage": "gradle", "message": "Compiling release build",
                               "ts": "2026-09-23T14:20:05.000Z" } }
{ "type": "process.updated", "process": { /* ProcessInfo */ } }
{ "type": "terminal.updated", "terminal": { /* TerminalInfo */ } }
{ "type": "build.updated", "build": { /* BuildJob */ } }
{ "type": "artifact.created", "artifact": { /* Artifact */ } }
{ "type": "agent.updated", "run": { /* AgentRun */ } }                        // also on archive/unarchive
{ "type": "agent.deleted", "ids": ["run_…"] }
{ "type": "project.updated", "project": { /* Project */ } }
{ "type": "stt.updated", "stt": { /* SttStatus */ } }                          // the STT profile changed
{ "type": "sync.updated", "request": { /* SyncRequest */ } }                  // sync request created or changed state
{ "type": "sync.changed", "projectId": "electron-hello" }                     // sync-back baseline moved (push or ack)
```

Events carry full objects so that clients can patch caches without refetching.
The socket does not replay history. After a reconnect, refetch the lists
(the mobile app invalidates its queries, see [mobile-app.md](mobile-app.md)).
A `hello` with another `protocolVersion` is fatal: `@theone/client` reports a
`ProtocolVersionError` and ends the stream without retrying.

### `/v1/terminals/:id/stream`: bidirectional

```jsonc
// client → server
{ "type": "input", "data": "ls -la\r" }
{ "type": "resize", "cols": 120, "rows": 40 }
// server → client
{ "type": "output", "data": "\u001b[1mtotal 12\u001b[0m\r\n..." }   // first frame replays ≤ 256 KiB of scrollback
{ "type": "exit", "code": 0 }
```

Several clients may attach to one terminal; they all see the same output.

### Log streams

`/v1/processes/:id/logs/stream` and `/v1/builds/:id/logs/stream` replay the
last 200 lines, then follow. The build stream sends the current `BuildJob` first.
`exit.code` is `null` when the process was killed by a signal (or, for an ended
build, when it did not succeed). The server closes with 1000 after `exit`.

```jsonc
{ "type": "log", "line": { "seq": 1042, "ts": "2026-09-23T14:21:10.120Z", "stream": "stdout",
                           "text": "  • building        target=nsis file=dist/electron-hello-win-x64-1.0.0.exe" } }
{ "type": "build", "build": { /* BuildJob, on every state/stage change (builds only) */ } }
{ "type": "exit", "code": 0 }
```

### `/v1/agent/runs/:id/stream`

Replays prior events, then follows:

```jsonc
{ "type": "event", "event": { "kind": "tool_use", "seq": 7, "ts": "…", "tool": "Bash",
                              "summary": "npm test" } }
{ "type": "run", "run": { /* AgentRun, on state change */ } }
```

### `/v1/display/vnc`: binary RFB bridge

A raw TCP ↔ WebSocket bridge to `THEONE_VNC_HOST:THEONE_VNC_PORT`
(`127.0.0.1:5901`). When the client offers `Sec-WebSocket-Protocol: binary`,
the server echoes it, as noVNC expects. RFB authentication (VncAuth) happens
inside the stream, using the password from `DisplayStatus.vnc.password`.

## WebView bridge

The `/ui` pages talk to the app that embeds them (react-native-webview, or an
`<iframe>` on web). Names come from `@theone/protocol/bridge` (`PAGE_MESSAGES`,
`PAGE_STATES`), a zod-free module the pages import.

```jsonc
// page → app (ReactNativeWebView.postMessage(JSON) or parent.postMessage(obj, "*"))
{ "type": "terminal-state", "state": "connected" }          // connecting | connected | disconnected | exited | error
{ "type": "terminal-state", "state": "exited", "code": 0 }
{ "type": "terminal-need-ticket", "session": "trm_x1y2z3w4v5" }
{ "type": "vnc-state", "state": "disconnected" }
{ "type": "vnc-need-ticket" }
// app → page
window.theone.reconnect("<ticket>")                          // native: injected JavaScript
{ "type": "theone-reconnect", "ticket": "<ticket>" }          // web: postMessage to the frame
```

A page asks for a ticket after its socket dropped. The app answers only for
messages from the sandbox's origin, never after `exited` or `error`, and retries
a limited number of times ([mobile-app.md](mobile-app.md#webview-pages)).

## Pairing link

```text
theone://pair?url=<encodeURIComponent(base URL)>&token=<token>&name=<label>
```

`theone-controller pair` prints this link and an ANSI QR code of it.
`@theone/protocol` exports `buildPairingLink` / `parsePairingLink`. The parser
ignores whitespace (QR line breaks), strips `/v1…` or `/ui…` suffixes from the
URL, and rejects URLs with credentials. See
[runbooks/pairing-mobile.md](../runbooks/pairing-mobile.md).

## Calling the API from inside the sandbox

Inside the sandbox, use the controller CLI instead of `curl` with the token:

```bash
theone-controller api GET /v1/status                    # VNC password printed as ***
theone-controller api POST /v1/processes '{"projectId":"hello","command":"npm run dev","port":5173}'
echo '{"projectId":"hello","target":"web"}' | theone-controller api POST /v1/builds -
theone-controller api DELETE /v1/processes/prc_4k2m9a1zq0
```

It reads the token itself and never prints it, accepts `GET`, `POST` and
`DELETE` on paths under `/v1/`, exits 1 on non-2xx (error body on stderr) and 2
on bad arguments. See [controller.md](controller.md#cli).

## Limits

| Limit | Value |
|---|---|
| Ticket lifetime | 60 s, single use |
| Events ping interval | 25 s |
| Process stop grace | 5 s (SIGTERM → SIGKILL) |
| Log tail default / max | 500 / 2000 lines |
| Log stream replay | 200 lines |
| In-memory ring buffer per live process/build | 2000 lines |
| Log file rotation | 5 MiB, 1 rotated file kept |
| Terminal scrollback replay | 256 KiB |
| Terminal size | up to 1000 cols × 500 rows |
| `.agent` context file | 64 KiB per file (`truncated: true` beyond) |
| Agent prompt | 200 000 chars |
| Process command | 16 384 chars |
| Status message | 4 000 chars (SPEC asks the agent for ≤ 120) |
| Request body | 1 MiB (413 beyond) |
| WS client frame | 1 MiB |
| WS send buffer | 16 MiB, then the socket is closed |
| `package.json` read by detection | 1 MiB, regular files only |

Source: `LIMITS` in [`packages/protocol/src/constants.ts`](../../packages/protocol/src/constants.ts).

## Evolving the protocol

- Additive changes (new optional fields, new endpoints, new `ServerEvent`
  types) keep `protocolVersion: 1`. Clients MUST ignore unknown event types and
  fields (`@theone/client` reports unknown types to `onError` and drops them;
  zod strips unknown fields).
- A new value in an existing enum (a `BuildState`, `Framework`, `BuildTarget`…)
  is **not** additive: current clients fail to parse the whole payload. Treat
  it as breaking, or ship the client first.
- Clients check `protocolVersion` on `GET /v1/health` and on the events
  `hello`; the app shows "Version mismatch" instead of retrying.
- Breaking changes move to `/v2` and `protocolVersion: 2`. The controller
  should serve both versions for one release so that paired phones keep working.
- Change the blueprint, the zod schemas, the controller, `@theone/client` and
  this page in the same change.
