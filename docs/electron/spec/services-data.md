# Spec: services and data layer (sandbox discovery, connection, polling, caches)

Status: survey of the GTK app (`apps/desktop/monolith_desktop`) for the Electron rebuild
(`apps/electron`). This describes behaviour and contracts only; no UI layout lives here
except the few strings and numbers the services produce. All numbers are taken from the
Python source. Strings in `"..."` are user-facing and must be copied verbatim.

Python sources: `config/{discovery,model,storage}.py`, `pairing.py`, `poller.py`,
`pseudonym.py`, `api/{client,errors,events,socket,tasks,paths,types}.py`,
`services/{connection,connection_view,metrics,workspace,syncback}.py`,
`util/{format,text,markdown}.py`, plus `store.py`, `strings.py`, `context.py`, `sync.py`
for wiring.

TypeScript to reuse: `@theone/client` (`packages/client/src`) and `@theone/protocol`
(`packages/protocol/src`). Use them directly; most of the Python here is a hand port of
them.

---

## 1. Architecture in Electron

| Python piece | Electron home | Notes |
|---|---|---|
| `config/discovery.py` (runs `docker`) | **main process** | needs `child_process`; expose over IPC (`sandbox:discover`) |
| `config/storage.py` (config.json) | **main process** | file IO; expose `config:read`, `config:save`, `config:clear`, `settings:get/set` |
| `services/metrics.py` cache file | **main process** for read/write of `metrics.json`; sampling logic can live in the renderer |
| `syncback/*` (links.json, file trees, tar) | **main process** (fs + tar) |
| `ControllerClient` HTTP | renderer **or** main. Renderer `fetch` to `http://127.0.0.1:7700` is cross-origin from `http://localhost:4545`; the controller must allow CORS or the calls go through main. Recommended: create `TheOneClient` in the renderer with a `fetch` that proxies through IPC to main (`net.fetch`), so no CORS dependency and the token never needs CSP exceptions. |
| `EventStream` (WebSocket) | renderer, `client.openEvents()` with the global `WebSocket` (WS is not subject to CORS; the ticket is in the query) |
| `AppStore` observables | a renderer store (zustand or React context + `useSyncExternalStore`) |
| `Poller` | a `usePoller` hook (section 5) |
| `api/tasks.run_async` thread pool (8 workers, `monolith-io`) | not needed; everything is `async` |

---

## 2. Finding the sandbox

### 2.1 Order at startup (`ConnectionService.start`)

1. `initial_config()` = **config file** first, else **environment variables**.
2. If neither yields a valid config: **Docker discovery** (`rediscover()`).
3. Discovery result is used in memory only. It is **not** written to the config file.
   Only "Save & connect" in Preferences writes the file.

### 2.2 Environment variables (all optional)

| Variable | Meaning | Default |
|---|---|---|
| `MONOLITH_DESKTOP_URL` | controller API URL | – |
| `THEONE_TOKEN` | bearer token (both URL and token must be set, else env config is ignored) | – |
| `MONOLITH_DESKTOP_NAME` | display name | – |
| `MONOLITH_DESKTOP_PAIRING_URL` | URL phones should use | – |
| `MONOLITH_DESKTOP_CONFIG` | absolute path overriding the config file | – |
| `XDG_CONFIG_HOME` | base for config dir | `~/.config` |
| `XDG_CACHE_HOME` | base for metrics cache | `~/.cache` |
| `XDG_STATE_HOME` | base for sync-back state | `~/.local/state` |
| `THEONE_COMPOSE_PROJECT` | compose project name | `theone` |
| `THEONE_CONTROLLER_HOST_PORT` | published controller port on the host | `7700` |
| `THEONE_BIND_ADDR` | host bind address of the published port | – |

Env config is built via the same `from_json` as the file (`source = "env"`).

### 2.3 Docker discovery (`discover_docker`)

Constants: project `theone`, service `sandbox`, controller port `7700`, exec user `dev`,
binary `theone-controller`, docker command timeout **15 s**, health probe timeout **2 s**,
protocol version **1**.

1. Container name: `` `${project}-sandbox-1` `` (e.g. `theone-sandbox-1`).
2. Locate `docker` on `PATH`. If missing: error `"docker is not installed on this machine"`.
   (Electron: also try `podman`, and on macOS/Windows the Docker Desktop CLI paths; GTK only
   looks for `docker`.)
3. Run `docker exec -u dev <container> theone-controller pair --json` (timeout 15 s).
   - Failure text: last non-empty line of stderr (or stdout), else
     `` `docker ${args[0]} failed (${code})` ``; timeout → `` `docker ${args[0]} timed out` ``.
   - Parse stdout **from the last line backwards**; the first line that is a JSON object
     with a string `link` wins. `link` is parsed with `parsePairingLink`; on failure error
     `` `controller printed an invalid pairing link: ${error}` ``. If none:
     `"theone-controller pair --json printed no pairing link"`.
   - Result: `url` = normalized `data.url` if valid else the link's url; `token` from the
     link; `name` = `data.name` if non-empty string else the link's name.
4. `docker inspect <container>` (errors here are swallowed → no network info):
   - `published` = every `NetworkSettings.Ports["7700/tcp"][]` with a `HostPort`, as
     `(HostIp, HostPort)`.
   - `addresses` = every `NetworkSettings.Networks[*].IPAddress` that is non-empty.
   - If `HostConfig.NetworkMode` is `container:<id>` (the sandbox shares the tailscale
     sidecar's netns), inspect `<id>` too and **append** its published ports and addresses.
5. Candidate URLs, in order, de-duplicated after `normalizeBaseUrl`:
   1. each published binding: `http://<host>:<HostPort>` where host is `127.0.0.1` when
      the bind is `""`, `0.0.0.0`, `::` or `[::]`; IPv6 binds get brackets.
   2. if `THEONE_BIND_ADDR` set: `http://<bind>:<THEONE_CONTROLLER_HOST_PORT|7700>`
   3. `http://127.0.0.1:<THEONE_CONTROLLER_HOST_PORT|7700>`
   4. each container IP: `http://<ip>:7700`
   5. the pairing URL (usually the tailnet `https://…ts.net`)
6. Probe each in order, sequentially: `GET <url>/v1/health`, `Accept: application/json`,
   no auth, timeout 2 s. Reachable iff JSON `ok === true` and `protocolVersion === 1`.
   Record `tried: [url, "ok" | "unreachable"][]`; stop at the first hit.
7. Result config: `{ apiUrl: reachable ?? pairingUrl, token, name, pairingUrl, source: "docker", container }`.
   Message:
   - reachable: `` `Found ${name || container} at ${apiUrl}` ``
   - not reachable: `` `Found ${name || container}, but none of its addresses answered from this machine` ``

Electron notes: run docker via `execFile` (no shell), 15 s timeout, in main. Docker
Desktop on macOS/Windows does not route container IPs (step 5.4) to the host; those probes
will just time out after 2 s each, so probe candidates **in parallel** with the same
preference order (take the first in list order that succeeds) to avoid multi-second
stalls. That is a deliberate improvement over GTK's sequential probing; the chosen URL is
the same.

The onboarding wizard (separate spec) creates the stack; after it finishes it should call
the same discovery and then **save** the result to the config file so later launches skip
discovery.

### 2.4 Pairing links (`pairing.py` = `@theone/protocol` `pairing.ts`/`url.ts`)

Identical semantics; use `buildPairingLink`, `parsePairingLink`, `normalizeBaseUrl`,
`toWebSocketUrl`, `isValidToken` from `@theone/protocol`.

- Format: `theone://pair?url=<enc>&token=<enc>&name=<enc>` (`name` omitted when empty).
  Host shell uses action `host` (`theone://host?…`).
- Token: `^[\x21-\x7e]{1,1024}$`. Name: trimmed, cut to 64 UTF-16 units, trimmed again.
- Parsing strips **all** whitespace first, scheme/action case-insensitive, optional third
  slash and trailing slash, fragment ignored, first occurrence of a query key wins.
- Base URL normalization: http/https only, no credentials, lowercase host, default port
  dropped, trailing dot on host dropped, any `/v<N>…` or `/ui…` path suffix and trailing
  slashes removed. Error messages (shown in toasts/notices):
  `"URL is empty"`, `"URL must start with http:// or https://"`,
  `"URL must not contain credentials"`, `"URL host is missing or invalid"`,
  `"URL port must be between 1 and 65535"`,
  `"URL path must not contain spaces, control characters or backslashes"`;
  link errors `"Pairing link is empty"`, `"Pairing link must start with theone://"`,
  `"Pairing link must be theone://pair?…"`, `"Pairing link has no url"`,
  `"Pairing link has no token"`, `"Pairing token is invalid"`; builder throws
  `` `Invalid pairing url: ${msg}` `` / `"Invalid pairing token"`.
- The phone pairing QR encodes `config.pairingLink()` = link built from
  `pairingUrl ?? apiUrl`, `token`, `name`. QR: error correction **M**, border **0**
  modules inside a white (`#ffffff`) tile with **12 px** padding and **8 px** radius
  (`.to-qr`), dark modules `#000000`, rendered at **176 px** in the pair dialog
  (`QR_SIZE` default elsewhere 200 px). Use the `qrcode` npm package with
  `errorCorrectionLevel: "M", margin: 0`.

### 2.5 Tokens

- One bearer token per sandbox (`Authorization: Bearer <token>`). Stored in plain JSON in
  the config file with mode `0600` (dir `0700`). Never logged: redacted form is first 4
  chars + `…`.
- WebSockets and browser-opened URLs never carry the bearer token: they use a short-lived
  ticket from `POST /v1/auth/ticket` (`?ticket=` for WS, `#ticket=` fragment for `/ui/*`
  pages, `?ticket=` for downloads).
- Electron improvement (optional, not required for compatibility): keep the token in
  `safeStorage` and keep writing the plain `token` key only if the file must remain
  readable by the GTK app / CLI. Compatibility wins: keep `token` in `config.json`.

---

## 3. Config and state files (must stay compatible)

The Electron app and the GTK app may run on the same machine; both read and write these
files. Keep key names, formats and merge behaviour exactly.

### 3.1 `config.json` (connection + app settings)

- Path: `$MONOLITH_DESKTOP_CONFIG` if set, else `${XDG_CONFIG_HOME:-~/.config}/monolith-desktop/config.json`.
  - On macOS/Windows the GTK app does not run; still use `~/.config/monolith-desktop/config.json`
    on Linux, and `app.getPath("userData")/config.json` elsewhere **unless**
    `XDG_CONFIG_HOME`/`MONOLITH_DESKTOP_CONFIG` is set. Document the chosen path in
    Preferences (`"Config file: {path}"`).
- Legacy migration at startup: if `<base>/monolith-desktop` does not exist and
  `<base>/theone-desktop` is a directory, rename it. Ignore errors.
- Format: pretty JSON, **2-space indent, trailing newline**, written atomically
  (`config.tmp` with mode `0600`, then rename). Dir created with mode `0700`.
- Read: any IO/JSON error or non-object → `{}`.
- Keys (single flat object, all optional):

| Key | Type | Writer | Notes |
|---|---|---|---|
| `url` | string | connection | API base URL (reader also accepts legacy `apiUrl`) |
| `token` | string | connection | trimmed on read |
| `name` | string | connection | omitted when empty |
| `pairingUrl` | string | connection | omitted when empty |
| `zoom` | number | app | one of `0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0` (clamped on load) |
| `appearance` | `"system" \| "light" \| "dark"` | app | default `"dark"` |
| `sidebarWidth` | number (px, unzoomed) | app | default `244`, clamped to `[200, 420]`; non-numbers/NaN/bools → default |
| `host_shell_autostart` | boolean | host shell service | `true` = start host daemon on launch |

- Save connection = read file, delete `url,token,name,pairingUrl`, merge new values,
  write (other keys preserved). Forget = same delete without merge.
- Other settings are saved with read-modify-write, skipped if the value is unchanged.
- Electron may add its own keys; prefix them (e.g. `electron.windowBounds`) and never
  remove unknown keys.

### 3.2 `metrics.json` (resource history cache)

- Path: `${XDG_CACHE_HOME:-~/.cache}/monolith-desktop/metrics.json` (Electron on
  macOS/Windows: `app.getPath("cache")`-style equivalent; Linux must use this path).
- Format (compact JSON, no spaces):
  `{"version":1,"sandboxes":{"<sandboxId>":[[t,cores,load1,load5,load15,memUsed,memTotal,diskUsed,diskTotal,gap],…]}}`
  - `t` = Unix seconds (float); values rounded to 4 decimals; `gap` is `0|1`.
  - Rows with length ≠ 10, non-finite numbers, booleans, or negative values in columns
    1–8 are dropped on read.
- Read: keep rows with `now − 3600 ≤ t ≤ now + 60`, sort by `t`, keep the last 1500.
- Write: per sandbox keep rows with `t ≥ now − 3600`, last 1500; keep only the **4**
  sandboxes with the most recent last sample. Written atomically (`metrics.tmp` →
  rename), errors ignored. Saved at most every **30 s** during recording and on exit
  (`before-quit` in Electron).

### 3.3 Sync-back state (`links.json`)

- Dir: `${XDG_STATE_HOME:-~/.local/state}/monolith/` containing `links.json`,
  `snapshots/`, `locks/` (flock files `.links` and `<projectId>`), keeps 20 snapshots.
- `links.json`: `{ "<projectId>": { "hostPath", "pushedAt", "manifest": {path: sha256},
  "executable"?: string[], "gitManifest"?: {…}, "gotAt"?: string, "confidential"?: true } }`,
  2-space indent + newline, mode `0600`, atomic write.
- Shared with the `monolith` CLI. Full detail belongs to the sync-back spec; the Electron
  main process must use the same files and the same lock names so CLI and app don't race.

---

## 4. Connection state machine (`ConnectionService`)

State (`ConnectionState`): `status`, `config`, `health`, `error`, `errorMessage`,
`checkedAt`. `sandboxName` = `health.sandboxId` if health known else `config.name`.

Statuses and how they are reached:

| Status | Entered when |
|---|---|
| `unconfigured` | initial; discovery failed with no previous config; `NotConfigured` |
| `discovering` | `rediscover()` started (keeps previous config/health) |
| `connecting` | `connect(config)` created a client (status poll not yet answered) |
| `online` | `GET /v1/health` and `GET /v1/status` both succeeded |
| `offline` | network/timeout/API error other than auth; invalid URL/token at `connect()` |
| `unauthorized` | `ApiError` with status 401 or code `unauthorized` |
| `incompatible` | health/hello `protocolVersion !== 1` |

Flow:

- `connect(config)`: stop status poller and event stream, build client (invalid URL →
  `` `Invalid controller URL: ${url}` ``, empty token → `"A controller token is required"`,
  both put state `offline` with that message), set `connecting`, clear `status`, start
  status poller immediately.
- Status poll = `client.health()` then `client.status()` (sequential, default timeout
  15 s). Success → `online`, store `health`, store `status`, clear error, set interval by
  visibility; on transition **into** online: start event stream and fetch inbox counts.
- Failure → status as in the table; if it was online, stop the event stream; for
  `unauthorized`/`incompatible` slow the poll to 30 s.
- `refresh()` = immediate poll (also bound to `Ctrl+R` / `F5`, and to the "Retry" banner
  button).
- `save(config)` = write file, then `connect({...config, source: "file"})`.
- `forget()` = clear file keys, then `rediscover()`.
- `rediscover(onDone?)`: cancel an in-flight discovery, set `discovering`; on success
  `connect(result.config)`; on failure reconnect the previous config if any, else
  `unconfigured` with `errorMessage` = discovery error text.

Inbox badge counts: `GET /v1/inbox?limit=1` on online transition and on every `hello`;
`inbox.updated` events overwrite `{unreadCount, attentionCount}` directly (missing → 0).

### 4.1 Error → message (`describe_error`)

| Error | Message |
|---|---|
| auth (401/`unauthorized`) | `"The sandbox rejected this token. Update it in Preferences or rediscover the sandbox."` |
| other `ApiError` | server `error.message`, else body text (first 300 chars), else gateway text, else `` `HTTP ${status}` `` |
| timeout | `"The sandbox took too long to answer."` |
| network | `"Can't reach the sandbox. Check that the stack is running and the URL is reachable from this machine."` |
| protocol version | `` `The sandbox speaks protocol v${server} and this app speaks v${client}. Update the app or the sandbox so they match.` `` |
| other protocol (bad JSON / schema) | `"The controller answered in an unexpected format. Update the app or the sandbox so their versions match."` |
| not configured | `"No sandbox is configured yet. Open Preferences to discover it or enter its URL and token."` |
| anything else | `error.message` or `"Something went wrong."` |

Gateway fallbacks (when body empty): 502 `"HTTP 502 from the proxy in front of the controller: the controller is not answering behind it."`,
503 `"HTTP 503: the controller is unavailable."`, 504 `"HTTP 504 from the proxy in front of the controller: the controller timed out."`.
`@theone/client`'s `toApiError` falls back to `statusText` instead; to match GTK, map
empty-body 502/503/504 to these strings in the Electron `describeError`.

Mapping to `@theone/client` error classes: `ApiError` → `ApiError`; `RequestTimeout` →
`TimeoutError`; `NetworkError` → `NetworkError`; `ProtocolVersionError` →
`ProtocolVersionError`; `ProtocolError` → `ProtocolError`; `NotConfigured` → app-level
error. **Difference:** `@theone/client` `isAuthError` also treats `forbidden` (403) as
auth; GTK only 401/`unauthorized`. Use a local check (`status === 401 || code === "unauthorized"`)
for the `unauthorized` state to match GTK.

Retryable (`is_retryable`, used by callers): not protocol/not-configured; `ApiError` only
if status ≥ 500, 408 or 429; everything else yes.

### 4.2 Strings produced from connection state (`connection_view.py`, `strings.py`)

Connection labels: `unconfigured "Not configured"`, `discovering "Discovering…"`,
`connecting "Connecting…"`, `online "Online"`, `offline "Offline"`,
`unauthorized "Token rejected"`, `incompatible "Incompatible"`.
With a name: `` `${sandboxName} · ${label}` ``. Title fallback `"Sandbox"`; footer
tooltip `"Connection settings"`, separator `" · "`.

Tones: unconfigured neutral, discovering info, connecting info, online success, offline
danger, unauthorized warning, incompatible warning.

Banner (hidden for `connecting` and `online`):

| status | title | button | action |
|---|---|---|---|
| unconfigured | `"No sandbox is configured on this machine yet."` | `"Set Up"` | open preferences (Electron: open onboarding) |
| discovering | `"Looking for the sandbox on this machine…"` | – | – |
| offline | `` `Can't reach the sandbox: ${errorMessage}` `` | `"Retry"` | refresh |
| unauthorized | `"The sandbox rejected the saved token."` | `"Fix Connection"` | open preferences |
| incompatible | `` `${errorMessage}` `` | `"Details"` | open preferences |

Event stream labels: idle `"Live updates off"`, connecting `"Live updates connecting…"`,
open `"Live"`, closed `"Live updates closed"`, unavailable `"Live updates unavailable"`,
incompatible `"Live updates incompatible"`. Tones: open success, connecting info,
incompatible warning, others neutral.

Preferences → Connection (behaviour only; layout belongs to the preferences spec):
fields `"API URL"`, `"Token"` (password), `"Display name"`, `"Pairing URL"`; groups
`"Sandbox controller"` (description `"The desktop app talks to the controller REST API from this machine. Discovery asks Docker for the running sandbox and picks the first address that answers."`),
`"Phone pairing"` (`"The URL phones use. Leave empty to reuse the API URL."`),
`"Connection status"` with rows `"Status"` (badge + subtitle = error message or sandbox
name) and `"Source"` (title `` `Source: ${label}` ``, subtitle `"Config file: {path}"`);
source labels `file "Saved config file"`, `env "Environment variables"`,
`docker "Docker discovery"`, `manual "Entered manually"`. Buttons `"Rediscover"`
(disabled while discovering), `"Save & connect"` (primary; Enter in any field also saves),
`"Forget saved connection"` / `"Removes the saved URL and token from this computer"` /
`"Forget"` (destructive). Toasts: invalid `"Enter a valid http(s) URL and a token"`,
saved `"Connection saved"`, discovered `"{message}"` (6 s), failed
`"Discovery failed: {error}"` (6 s). Save validation: URL must normalize, token non-empty
after trim; pairing URL normalized if non-empty (an invalid pairing URL is silently
dropped — keep).

---

## 5. Polling

### 5.1 Poller semantics (`poller.py`) — implement as `usePoller(fetch, intervalMs, opts)`

- `start(immediate = true)`: if immediate, fetch now; else schedule.
- The next tick is scheduled **after the previous fetch settles** (`setTimeout`, not
  `setInterval`), so a slow request never overlaps the next one.
- `refresh()`: cancel the pending timer; if a fetch is in flight, do nothing; else fetch
  now.
- `setInterval(s)`: only reschedules if a timer is currently pending.
- `stop()`: clear timer, cancel the in-flight fetch (its result is dropped), report
  `loading = false`.
- `bind(widget)`: runs only while the widget is mapped (visible in the tree). In React:
  run while the component is mounted **and** its page is the active one.
- Errors go to `onError` and polling continues.

### 5.2 Cadence table (exact numbers)

| What | Visible | Hidden window | Notes |
|---|---|---|---|
| connection: `health` + `status` | 5 s | 30 s | 30 s also while `unauthorized`/`incompatible` |
| workspace: `listProjects` + `listAgentRuns` + `listTerminals` | 10 s | 60 s | only while online |
| sync-back heartbeat + pending requests | 20 s | 20 s | only while online; also on `hello` |
| agents page feed: `getAgentRun(id)` | 2.5 s | – | fallback while the run stream is not open |
| agents page details (inbox + sessions) | 30 s | – | relative times re-render every 30 s |
| projects page activity: `listProcesses` + `listBuilds` | 15 s | – | |
| project detail snapshot | 15 s | – | |
| process/build log snapshot | 2 s | – | fallback when WS stream not open |
| project processes tab: `ports()` | 10 s | – | |
| files page: `listArtifacts` | 30 s | – | |
| display page: `displayStatus` | 5 s | – | |
| display page: `screenshot` | 3 s | – | |
| display windows: `displayWindows` | 2 s | – | |

"Hidden" = the main window is not visible (closed to tray / minimized by hide). On becoming
visible, connection and workspace pollers refresh immediately. Electron: drive
`windowVisible` from `BrowserWindow` `show`/`hide` (and `document.visibilityState`);
page pollers stop when their page is not mounted.

HTTP timeouts: default 15 s; Taildrop send 120 s; uploads (create + content) 120 s;
sync upload/export/discard/plan/apply 600 s. `User-Agent: monolith-desktop/0.1` (Electron:
`monolith-electron/<version>`; nothing on the server depends on it).

### 5.3 Event stream (`api/events.py`, `api/socket.py` = `client.openEvents`)

- Path `/v1/events`, ticket from `POST /v1/auth/ticket`, URL
  `ws(s)://…/v1/events?ticket=<enc>`.
- Reconnect always (including after a normal 1000 close); backoff
  `base = min(30 s, 1 s · 2^attempt)`, jitter uniformly in `[base/2, base]`, clamped to
  `[1 s, 30 s]`; attempt resets after a successful open (TS: after `hello`).
- Idle watchdog **60 s** without frames → close and reconnect (TS default =
  `25 000 · 2 + 10 000` = 60 000 ms, identical).
- `ping` → reply `{"type":"pong"}` (TS does this automatically).
- `hello` with `protocolVersion !== 1` → stream state `incompatible`, stop for good, and
  the connection goes `incompatible`.
- Ticket request failing with auth error → stream `closed`, no retry.
- Events are started only on the online transition and stopped when leaving online.
- Subscribers used by services: `hello`, `inbox.updated`, `project.updated`,
  `project.deleted`, `agent.updated`, `agent.deleted`, `terminal.updated`,
  `sync.updated`, `sync.changed`. Pages subscribe to others (`process.updated`,
  `build.updated`, `artifact.*`, `stt.updated`, `app.updated`, `status`).
- The `@theone/client` stream validates frames with zod; invalid frames are reported and
  skipped (GTK silently passes them on). Fine.

---

## 6. Workspace service (shared lists)

Store slots (newest-first, `null` = not loaded): `projects`, `agentRuns` (non-archived
only), `terminals`.

- Poll every 10 s / 60 s hidden while online (section 5.2), results replace all three.
- Events in between:
  - `project.updated` / `terminal.updated`: **upsert** by `id` (replace in place, else
    prepend). Ignored while the list is `null`.
  - `agent.updated`: if `Boolean(run.archivedAt)` → remove from `agentRuns`, else upsert.
  - `agent.deleted`: remove `ids`.
  - `project.deleted`: remove `id`.
- `refreshProjects(onDone)`: one-off `listProjects`.
- When connection leaves online: stop polling; if new status is `unconfigured`,
  `discovering` or `connecting`, reset all three to `null` (so the sidebar shows
  `"Loading projects…"` rather than stale data). `offline`/`unauthorized` keep stale data.
- Fetch failures are logged only (no UI).

React: a `useWorkspace()` hook over the store; mutations in pages call the upsert helpers
optimistically with the server response.

---

## 7. Metrics history (Overview charts)

Input: every `SandboxStatus` that lands in the store (i.e. each 5 s / 30 s status poll).

Sample from `status.resources`: `cpu.cores`, `cpu.load1/5/15`, `memory.usedBytes/totalBytes`,
`disk.usedBytes/totalBytes`; skip the sample if any is missing, non-finite or negative.

Series values:
- `load1|load5|load15` = load / `max(1, cores)` (fraction of cores)
- `memory` = used/total (null if total ≤ 0)
- `disk` = used/total (null if total ≤ 0)

Constants: window **3600 s**, max **1500** samples in memory, gap threshold **95 s**,
save interval **30 s**, keep **4** sandboxes in the cache, future tolerance **60 s**.

Recording:
- Keyed by `status.sandboxId`; switching sandbox stashes the current deque and loads that
  sandbox's cached samples (within the window) and marks a break.
- If the newest stored sample's `t ≥ now` (clock went backwards), drop those and mark a
  break.
- New sample gets `gapBefore = broken && hasSamples`. A break is set when the connection
  leaves online, when `status` becomes `null`, on sandbox switch, and at start.
- Prune samples older than `now − 3600 − 95`.
- `revision` counter increments on every recorded sample (UI re-renders on it).

Queries:
- `slice(range)` = samples in `[now − range, now]` plus the one sample just before the
  window if it is within 95 s of the first inside sample and that first sample has no gap
  (so lines start at the left edge).
- `seriesPoints(samples, key)`: `[t, value]`; insert `[t, null]` before a sample with
  `gapBefore` or more than 95 s after the previous one (line break).
- `seriesStats(samples, key, start)`: over samples with `t ≥ start` and non-null value:
  `current` (last), `average` (mean), `peak` (max); all null when empty.
- Ranges used by Overview: `5m` = 300 s (`"5 min"`), `15m` = 900 s (`"15 min"`),
  `1h` = 3600 s (`"1 h"`).

Electron: keep the history in the renderer store, persist through IPC to main
(`metrics:load` at startup, `metrics:save` every 30 s and on quit).

---

## 8. Sync-back service (behaviour summary)

- While online: every **20 s** and on each `hello`: `POST /v1/sync/heartbeat`
  `{host: os.hostname(), projects: [linked ids], changes: {projectId: hostChangeCount}}`,
  then if any project is linked `GET /v1/sync/requests?status=pending`.
- `sync.updated` events enqueue `event.request`; `sync.changed` only bumps `revision`.
- Queue: skip already-seen ids and requests not claimable for linked projects; process
  **one at a time**: claim → apply → complete (details in sync-back spec). `busy` = set of
  project ids being processed; `revision` bumps after each request.
- Errors: 409 = taken/cancelled, silent; non-API errors un-mark "seen" so a later poll
  retries; otherwise notify.
- Desktop notifications (id `` `sync-${projectId}` ``, click navigates to Projects):
  `"Synced {project} to this computer"`, `"Couldn't sync {project} to this computer"`,
  `"Reverted the last sync of {project}"`, `"Couldn't revert the last sync of {project}"`,
  `"Sent {project} changes to the sandbox"`, `"Couldn't send {project} changes to the sandbox"`.
  Kind outside `pull|revert|get` uses the `pull` strings. Body = result message or
  `describeError`.
- `submit(projectId, kind, force, paths)`: `createSyncRequest(..., source: "desktop")`,
  then enqueue the returned request.

---

## 9. Endpoint map: Python `ControllerClient` → `@theone/client` `TheOneClient`

All paths are under `/v1`. "Used by" = GTK caller. ✅ = exists with same semantics,
⚠ = exists with a different signature, ❌ = missing in `@theone/client`.

| Python method | HTTP | TS method | |
|---|---|---|---|
| `health()` (no auth, checks protocolVersion) | GET /health | `health()` | ✅ (TS validates schema; mismatch → `ProtocolVersionError`) |
| `create_ticket()` | POST /auth/ticket | `createTicket()` | ✅ |
| `status()` | GET /status | `status()` | ✅ |
| `identity()` | GET /identity | `identity()` | ✅ (unused by GTK UI) |
| `context()` | GET /context | `context()` | ✅ (unused) |
| `claude_auth()` | GET /claude/auth | `claudeAuth()` | ✅ |
| `claude_accounts()` | GET /claude/accounts | `claudeAccounts()` | ✅ |
| `set_default_claude_account(id)` | PUT /claude/accounts/default `{accountId}` | `setDefaultClaudeAccount({accountId})` | ⚠ body object |
| `set_project_claude_account(id, acc)` | PUT /projects/:id/claude-account `{accountId}` | `setProjectClaudeAccount(id, {accountId})` | ⚠ |
| `stt_status()` | GET /stt | `stt()` | ✅ |
| `set_stt_profile(p)` | PUT /stt `{profile}` | `updateStt({profile})` | ⚠ (Python rejects unknown profile client-side: `` `Unknown speech-to-text profile: ${p}` ``) |
| `set_gemini_api_key(k)` | PUT /stt `{geminiApiKey: k \| null}` | `updateStt({geminiApiKey})` | ⚠ (Python trims; empty → `"The Gemini API key must not be empty"`) |
| `ports()` | GET /ports | `ports()` | ✅ |
| `usage(days)` | GET /usage?days | `usage({days})` | ✅ |
| `sessions(limit, project_id)` | GET /sessions?limit&projectId | `sessions({limit, projectId})` | ✅ |
| `inbox(limit, unread)` | GET /inbox?limit&unread=1 | `inbox({limit, unread})` | ✅ TS sends `unread=true`, Python `unread=1`; controller accepts both |
| `mark_inbox_read(ids?)` | POST /inbox/read `{ids}` or `{all:true}` | `markInboxRead(body)` | ✅ |
| `list_projects()` | GET /projects | `listProjects()` | ✅ |
| `create_project(name, gitUrl, branch, confidential)` | POST /projects | `createProject(body)` | ✅ (omit empty fields; `confidential` only when true) |
| `get_project(id)` | GET /projects/:id | `getProject(id)` | ✅ |
| `delete_project(id, force)` | DELETE /projects/:id?force=1 | `deleteProject(id, {force})` | ✅ `force=true` vs `1`, controller accepts both |
| `rename_project(id, name)` | PUT /projects/:id/name `{name}` | `renameProject(id, {name})` | ✅ |
| `get_project_git(id)` | GET /projects/:id/git | `getProjectGit(id)` | ✅ |
| `sync_project(id, archive, size, confidential)` | POST /projects/:id/sync[?confidential=1], `Content-Type: application/gzip`, raw body, 600 s; returns `(project, status===201)` | – | ❌ missing (route builder `restPaths.projectSync` exists but no `confidential` query and no binary upload method) |
| `sync_changes(id)` | GET /projects/:id/sync/changes | `syncChanges(id)` | ✅ |
| `sync_export(id, paths)` | POST /projects/:id/sync/export → gzip bytes | `syncExport(id, paths)` | ✅ (needs 600 s timeout option) |
| `sync_ack(id, changes)` | POST …/sync/ack `{changes}` | `syncAck(id, {changes})` | ✅ |
| `sync_discard(id, paths?)` | POST …/sync/discard `{paths}` or `{}` | `syncDiscard(id, body)` | ✅ |
| `list_sync_requests(id)` | GET …/sync/requests | `syncRequests(id)` | ✅ |
| `create_sync_request(id, kind, paths, force, source)` | POST …/sync/requests | `createSyncRequest(id, body)` | ✅ |
| `pending_sync_requests()` | GET /sync/requests?status=pending | `pendingSyncRequests()` | ✅ |
| `claim_sync_request(id, host)` | POST /sync/requests/:id/claim | `claimSyncRequest(id, {host})` | ✅ |
| `complete_sync_request(id, status, result, error)` | POST …/complete | `completeSyncRequest(id, body)` | ✅ |
| `cancel_sync_request(id)` | POST …/cancel | `cancelSyncRequest(id)` | ✅ |
| `sync_get_plan(id, plan)` | POST /sync/requests/:id/plan (600 s) | – | ❌ missing (route exists) |
| `sync_get_apply(id, archive, size)` | POST /sync/requests/:id/apply, gzip body (600 s) | – | ❌ missing (route exists) |
| `sync_heartbeat(host, projects, changes)` | POST /sync/heartbeat | `syncHeartbeat(body)` | ✅ |
| `list_processes(projectId?)` | GET /processes | `listProcesses({projectId})` | ✅ |
| `start_process(body)` | POST /processes | `startProcess(body)` | ✅ |
| `get_process(id)` | GET /processes/:id | `getProcess(id)` | ✅ |
| `stop_process(id)` | DELETE /processes/:id | `stopProcess(id)` | ✅ |
| `process_logs(id, tail)` | GET /processes/:id/logs?tail | `processLogs(id, {tail})` | ✅ |
| `list_terminals()` | GET /terminals | `listTerminals()` | ✅ |
| `create_terminal(kind, cols, rows, projectId)` | POST /terminals | `createTerminal(body)` | ✅ |
| `close_terminal(id)` | DELETE /terminals/:id | `closeTerminal(id)` | ✅ |
| `list_builds(projectId?)` | GET /builds | `listBuilds({projectId})` | ✅ |
| `start_build(projectId, target, profile)` | POST /builds | `startBuild(body)` | ✅ |
| `get_build(id)` / `cancel_build(id)` / `build_logs(id, tail)` | GET/DELETE /builds/:id, GET …/logs | `getBuild` / `cancelBuild` / `buildLogs` | ✅ |
| `list_artifacts(projectId?)` | GET /artifacts | `listArtifacts({projectId})` | ✅ |
| `list_build_outputs(projectId?)` | GET /outputs | `listBuildOutputs({projectId})` | ✅ |
| `delete_artifact(id)` | DELETE /artifacts/:id | `deleteArtifact(id)` | ✅ |
| `taildrop_targets()` | GET /taildrop/targets | `taildropTargets()` | ✅ |
| `send_artifact_taildrop(id, targetId)` | POST /artifacts/:id/taildrop (120 s) | `sendArtifactToTaildrop(id, {targetId})` | ✅ pass `timeoutMs: 120000` |
| `list_run_targets(projectId)` | GET /projects/:id/run-targets | `listRunTargets(projectId)` | ✅ |
| `list_app_runs(projectId?)` | GET /app-runs | `listAppRuns({projectId})` | ✅ |
| `start_app_run(projectId, target)` | POST /projects/:id/app-runs `{target}` | `startAppRun(projectId, {target})` | ✅ |
| `stop_app_run(id)` | DELETE /app-runs/:id | `stopAppRun(id)` | ✅ |
| `android_status()` | GET /android | `getAndroidStatus()` | ✅ |
| `display_status()` | GET /display | `displayStatus()` | ✅ |
| `screenshot()` | GET /display/screenshot (PNG bytes) | `screenshot()` | ✅ |
| `display_windows()` | GET /display/windows | `displayWindows()` | ✅ |
| `activate_display_window(id)` | POST …/activate | `activateDisplayWindow(id)` | ✅ |
| `close_display_window(id, force)` | POST …/close `{force:true}` or `{}` | `closeDisplayWindow(id, {force})` | ✅ |
| `list_agent_runs(projectId?, archived)` | GET /agent/runs?archived=1 | `listAgentRuns({projectId, archived})` | ✅ `archived=true` vs `1`, controller accepts both |
| `archive_agent_runs(ids, archived, all, projectId)` | POST /agent/runs/archive | `archiveAgentRuns(body)` | ✅ (body `{ids}` or `{all:true, projectId?}` + `archived`) |
| `delete_agent_runs(ids, all, projectId, archived)` | POST /agent/runs/delete | `deleteAgentRuns(body)` | ✅ (`archived` only with `all`) |
| `start_agent_run(prompt, projectId, resumeSessionId, attachmentIds)` | POST /agent/runs | `startAgentRun(body)` | ✅ |
| `get_agent_run(id)` / `cancel_agent_run(id)` | GET/DELETE /agent/runs/:id | `getAgentRun` / `cancelAgentRun` | ✅ |
| `create_upload(name, mime, bytes)` | POST /uploads `{name, mimeType, data: base64}` (120 s) | `createUpload(body)` | ✅ pass `timeoutMs: 120000` |
| `upload_content(id)` | GET /uploads/:id/content with bearer → bytes | `uploadContentUrl(id)` (ticket URL) | ⚠ use the ticket URL as `<img src>` or fetch it |
| `publish_status(event)` | POST /events | `publishStatus(body)` | ✅ (unused by UI) |
| `terminal_page_url(sessionId)` | ticket + `/ui/terminal#ticket&session` | `terminalPageUrl(sessionId)` | ✅ |
| `vnc_page_url()` | display status + ticket → `/ui/vnc#ticket&password` | `vncPageUrl()` | ✅ |
| `artifact_download_url(id)` | `/artifacts/:id/download?ticket` | `artifactDownloadUrl(id)` | ✅ |
| `build_output_download_url(projectId, path)` | `/projects/:id/outputs/download?path&ticket` | `buildOutputDownloadUrl({projectId, path})` | ✅ |
| WS `/events` | | `openEvents` | ✅ |
| WS `/terminals/:id/stream` | | `openTerminal` | ✅ |
| WS `/processes/:id/logs/stream` | | `openProcessLogs` | ✅ |
| WS `/builds/:id/logs/stream` | | `openBuildLogs` | ✅ |
| WS `/agent/runs/:id/stream` | | `openAgentRun` | ✅ |
| WS `/display/vnc` | | via `/ui/vnc` page | ✅ |

Defined in Python paths but no client method (GTK uses the host shell client elsewhere):
`/android/emulator`, `/android/link`, `/host/unlock` → TS has `startEmulator`,
`stopEmulator`, `linkSandbox`, `unlinkSandbox`, `HostShellClient.unlock`.

Missing in `@theone/client` that Electron needs (request in deps_needed):
1. `syncProject(id, body: Uint8Array | Blob, {confidential?}) → {project, created}` (gzip
   upload, 201 = created).
2. `syncGetPlan(requestId, plan)`.
3. `syncGetApply(requestId, body: gzip)`.
4. A binary-body option in `request` (`Content-Type: application/gzip`).
In Electron these run in the main process (tar + fs), so they can alternatively be
implemented in `apps/electron` main with plain `fetch` using the same paths.

---

## 10. Formatting helpers (`util/format.py`) — port to `src/renderer/lib/format.ts`

All rounding is JS-style half-up (`Math.floor(x·10^d + 0.5)/10^d`), so `toFixed`-like
output matches the mobile app.

- `splitBytes(n)`: ≤0/null/non-finite → `["0","B"]`; divide by **1024** through
  `B, KB, MB, GB, TB, PB`; bytes → `round()`, else ≥100 → 0 decimals, else 1 decimal
  with a trailing `.0` dropped. `formatBytes` = `` `${v} ${unit}` `` (e.g. `"1.5 GB"`,
  `"512 B"`, `"120 MB"`).
- `formatUptime(s)`: `<60 "Ns"`, `<3600 "Nm"`, `<86400 "Hh Mm"` (or `"Hh"`),
  else `"Dd Hh"` (or `"Dd"`).
- `formatDuration(s)` (rounded): `<60 "Ns"`, `<3600 "Mm Ss"` (or `"Mm"`), else uptime.
- `formatRelativeTime(iso)`: `<45 s "just now"`, `<1 h` `` `${max(1, round(s/60))}m ago` ``,
  `<1 d "Nh ago"`, `<7 d "Nd ago"`, else UTC `YYYY-MM-DD`. Empty string for bad input.
  ISO without timezone is treated as UTC.
- `formatPercent(f, digits=0)`: clamp to [0,1], `` `${fixed(f·100)}%` ``.
- `ratio(used, total)`: null if total ≤ 0, else clamped fraction.
- `compactNumber(n)`: `<1000` → `round`; then `k`, `M`, `B` with the bytes decimal rule
  (`"1.2k"`, `"340k"`, `"1.5M"`). `formatTokens(n)`: `` `${compact} token(s)` `` (singular
  only for 1).
- `formatLoad(x)` = `x.toFixed(2)`; `formatCount` = thousands separators (`1,234`; use
  `en-US`, not the user locale, to match GTK).
- `capitalize`: `_`/`-` runs → space, trim, first char upper.
- `shortSha` = first 7 chars; `pluralize(n, s, p?)` = `` `${n} ${n===1 ? s : p ?? s+"s"}` ``;
  `joinMeta(...parts)` joins truthy parts with `" · "`.

`util/text.py`:
- `cleanLogText`: strip ANSI CSI/OSC/ESC sequences, trailing CR/LF, then keep only the
  text after the last `\r` (progress-bar overwrite).
- `logLineKind(stream, text)`: `"error"` when stream is `stderr` and the text matches
  `^\s*(error|fatal|panic|uncaught|unhandled|traceback)\b` or `\b\w*(error|exception)(\[\w+\])?:`
  or `\berror TS\d+` (case-insensitive); else the stream.
- `initialsOf(name)`: first letter (uppercase) of the first two words.

`util/markdown.py` is a tiny Markdown-to-Pango converter for agent messages. **Do not
port it**; use `react-markdown` + `remark-gfm` with the same restrictions: links only for
`http://`, `https://`, `mailto:`; bare URLs autolinked; headings, paragraphs, lists
(task items, max depth 4, ordered markers normalized `1)` → `1.`), fenced code with
language, block quotes, rules, GFM tables, `**bold**`/`__bold__`, `*italic*`/`_italic_`,
`~~strike~~`, inline code in monospace. Raw HTML must not render.

`pseudonym.ts` (used for "roll a name" in Create Project and by the CLI for confidential
projects): 66 adjectives × 66 nouns, copy both arrays verbatim from `pseudonym.py`;
shuffle all `adjective-noun` pairs with a crypto RNG, return the first not in `taken`;
if all are taken, `` `${first}-${n}` `` with the smallest free `n ≥ 2`.

---

## 11. GTK quirks NOT to copy

1. **Thread pool + `GLib.idle_add` marshalling** (`api/tasks.py`): replace with
   promises/`AbortController`. "Cancel" in GTK only drops the callback; the HTTP request
   still runs to completion. In Electron, abort the request.
2. **Sequential 2 s health probes** during discovery can stall ~10 s when container IPs
   are unroutable (Docker Desktop). Probe in parallel, keep list-order preference.
3. **libsoup missing → events "unavailable"**: not a concern in Chromium; the
   `"unavailable"` state can only arise if WebSocket construction throws.
4. **`docker` only**: also support `podman` (and `DOCKER_HOST`/contexts are honoured
   automatically by the CLI). Report a clear onboarding error instead of a banner.
5. **Status poll calls `health` and `status` sequentially** in one tick; do them with
   `Promise.all` (status failure still determines the state the same way).
6. **Pango markup escapes and private-use placeholder characters (U+E000/U+E001)** in the
   markdown converter exist only because GTK labels take markup strings. Irrelevant in
   React.
7. **`Observable.set` equality via Python `==`** (deep for dicts): in React use
   structural sharing or a cheap deep-equal before `setState` to avoid re-render storms
   on every 5 s poll that returns identical data.
8. **Connection discovery result is not persisted**: keep this (so a stack recreated with
   a new token is rediscovered), but the onboarding wizard should save explicitly.
9. **Preferences silently drop an invalid Pairing URL**: acceptable to keep, but better to
   show the URL error inline. Do not block saving.
10. **QR built via a raw RGBA texture at scale 8**: use an SVG QR instead (crisp at any
    zoom level).
11. **Zoom implemented by rewriting CSS px values**: in Electron use `webContents.setZoomFactor`
    with the same steps and persist under the same `zoom` key.
12. **`metrics.json` written with `atexit`**: Electron must save on `before-quit`; `atexit`
    equivalents do not run on renderer reloads (also save on `beforeunload`).

---

## 12. Electron module layout (suggested)

```text
apps/electron/src/main/sandbox/discovery.ts        # section 2.3 (docker/podman, parallel probes)
apps/electron/src/main/sandbox/constants.ts        # ports, names, timeouts from section 2.3
apps/electron/src/main/config/paths.ts             # config/cache/state paths (section 3)
apps/electron/src/main/config/store.ts             # config.json read/merge/atomic write
apps/electron/src/main/metrics/cache.ts            # metrics.json parse/serialize
apps/electron/src/main/ipc/sandbox.ts              # IPC handlers
apps/electron/src/renderer/services/connection.ts  # state machine (section 4)
apps/electron/src/renderer/services/workspace.ts   # section 6
apps/electron/src/renderer/services/metrics.ts     # section 7
apps/electron/src/renderer/services/describe-error.ts
apps/electron/src/renderer/hooks/use-poller.ts     # section 5.1
apps/electron/src/renderer/hooks/use-connection.ts
apps/electron/src/renderer/lib/format.ts           # section 10
apps/electron/src/renderer/lib/pseudonym.ts
apps/electron/src/renderer/labels/connection.ts    # strings from section 4.2
```

Test parity: port the Python tests' fixtures for `parse_pair_json`, `parse_inspect`,
`candidate_api_urls`, `parse_cache`/`serialize_cache`, `series_points`, and the format
helpers (`apps/desktop/tests/`) to `bun test` in `apps/electron`.
