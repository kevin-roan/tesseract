# Spec: host shell daemon, host Android emulator, Speech-to-text, Claude accounts

Scope: everything the GTK app (`apps/desktop`, "Monolith") does with **this computer** rather than
the sandbox: running and controlling the host shell daemon (`theone-controller host …`), preparing the
host Android emulator for a project's Android run target, and the three settings pages
**Claude**, **Host shell** and **Speech-to-text**. It is enough to rebuild them in
`apps/electron` (React renderer + Electron main) without opening the Python.

Python sources this was taken from (read-only reference):
`monolith_desktop/hostshell/{model,service,android}.py`, `stt/model.py`, `claude/{host,model}.py`,
`preferences/{host_shell,stt,claude}.py`, `widgets/{host_pin_dialog,host_unlock_dialog,pair_dialog,preference_rows,radio_rows}.py`,
`pages/projects/{emulator,emulator_launch,labels}.py`, `strings.py`, `theme/extras/dialogs.py`.
Daemon: `apps/controller/src/host/**`. Contracts: [app-runs-and-emulator.md §2](../../architecture/app-runs-and-emulator.md#2-android-emulator-on-the-host),
[host-shell runbook](../../runbooks/host-shell.md), blueprint §4.3/§5.7.

---

## 1. Architecture in Electron

```
renderer (React)  ──IPC──>  main: HostShellService  ──spawn──> theone-controller host serve   (child process)
                                                     ──spawn──> theone-controller host pin|pair|token (one-shot)
                                                     ──HTTP───> http(s)://<bind>:7701/v1/...      (Android API, health)
                   ──IPC──>  main: readHostClaudeStates()       (reads ~/.claude*, never returns secrets)
                   ──IPC──>  main: EmulatorViewer (scrcpy child)
renderer ──(sandbox controller REST, existing client)──> /v1/stt, /v1/claude/*, /v1/projects/:id/run-targets, /v1/app-runs
```

- All process spawning, filesystem reads of `~/.claude*`, the host token, the PIN session and host
  HTTP calls live in the **main process** (or a utility process). The renderer only gets state
  snapshots and calls typed IPC methods. The host token and PIN session never reach the renderer.
- State is a single observable `HostShellState` (§2.2) pushed to the renderer on every change
  (`host-shell:state` channel); the renderer keeps it in a store/hook (`useHostShell()`).

---

## 2. Host shell daemon control

### 2.1 Which binary runs

GTK resolves the command as (in order):

1. `MONOLITH_CONTROLLER_COMMAND` env var, split shell-style (`shlex.split`) – used verbatim.
2. `<repo>/apps/controller/src/index.ts` run with `bun` (`bun` from `PATH`, else `$BUN_INSTALL/bin/bun`,
   else `~/.bun/bin/bun`, must be executable).
   Errors (verbatim):
   - `The controller is not in this checkout ({entry}); set MONOLITH_CONTROLLER_COMMAND`
   - `Bun is not installed or not on PATH; install it from bun.sh`

**Electron** (installed app, no checkout, no Bun):

1. `MONOLITH_CONTROLLER_COMMAND` (keep the override, same semantics; useful for dev).
2. The bundled compiled binary: `process.resourcesPath/bin/theone-controller[.exe]` (electron-builder
   `extraResources`), built with the existing script `bun build src/index.ts --compile --minify --sourcemap --outfile dist/theone-controller`
   (`apps/controller/package.json` `build`), one per target (`--target=bun-linux-x64`, `bun-linux-arm64`,
   `bun-darwin-arm64`, `bun-darwin-x64`, `bun-windows-x64`).
3. Dev (`app.isPackaged === false`): `bun <repo>/apps/controller/src/index.ts`, as GTK.

Facts that make the compiled binary work unchanged:
- `host/android/netns.ts selfCommand()` re-invokes **itself** for the netns helper:
  `import.meta.dir.startsWith("/$bunfs") || !existsSync(ENTRY) ? [process.execPath] : [process.execPath, ENTRY]`,
  i.e. a compiled binary runs `<binary> host emulator-helper …`. No extra file needed.
- `/ui/android` and `/ui/terminal` pages are HTML imports (`import androidPage from "../ui/android.html"`)
  and are embedded by `bun build --compile` (Bun HTML-import bundling). Verify `GET /ui/android` returns 200
  from the compiled binary in an e2e test.
- The same binary is also the sandbox controller and the `monolith` CLI entry (`src/index.ts` dispatches
  `serve`, `host …`, etc.), so one bundled binary can serve both the `monolith` CLI and the host daemon if the
  packaging spec decides so (they may be the same file or two builds; the host daemon only needs `host …`).
- A prebuilt `apps/controller/dist/theone-controller` already exists in the repo checkout (Linux).

### 2.2 State model (`HostShellState`)

```ts
type HostShellStatus = "stopped" | "starting" | "running" | "stopping" | "external" | "failed";
type HostPairing = { link: string; url: string; name: string; pinSet: boolean };
type HostShellState = {
  status: HostShellStatus;          // default "stopped"
  pairing: HostPairing | null;
  error: string | null;
  log: string[];                    // last 200 lines (LOG_LIMIT) of the child's stdout+stderr
  autostart: boolean;
};
serving = status === "running" || status === "external"
owned   = status === "starting" || status === "running" || status === "stopping"
ready   = serving && pairing !== null && pairing.pinSet
```

`external` = a daemon this app did not start answers on the pairing URL (e.g. the user's systemd unit).

### 2.3 Operations (constants are exact)

| Constant | Value |
|---|---|
| `CLI_TIMEOUT_S` (one-shot `host pin/pair/token`) | 30 s → error `The controller did not answer in time` |
| `HEALTH_TIMEOUT_S` (`GET <url>/v1/health`) | 1.5 s |
| `STOP_GRACE_S` (SIGTERM → SIGKILL on Stop) | 5 s |
| `SHUTDOWN_WAIT_S` (app quit) | 3 s, then kill |
| `SESSION_MARGIN_S` (PIN session considered expired early) | 30 s |
| `HOST_TIMEOUT_S` (each host Android HTTP request) | 10 s |
| `LISTENING_MARKER` | `host shell listening` (substring of a log line) |
| `LOG_LIMIT` / shown log lines | 200 kept / last 40 shown (`LOG_LINES`) |
| PIN pattern | `^[0-9]{6,12}$` (full match) |
| Autostart setting | key `host_shell_autostart` (`true` only when exactly boolean true) in the app settings file |

GTK's settings file is `$XDG_CONFIG_HOME/monolith-desktop/config.json` (`MONOLITH_DESKTOP_CONFIG` overrides).
Electron stores `hostShellAutostart` in its own settings store; reading the GTK file once for migration is optional.

**start()** – no-op when `owned` or `external`. Spawns `[...command, "host", "serve"]` with
stdin ignored, stdout+stderr merged into one line stream, env = app env. On Linux GTK wraps it as
`setpriv --pdeathsig TERM -- <command>` (when `setpriv` is on PATH) so the daemon dies with the app.
Electron: keep the `setpriv` wrapper on Linux; on macOS/Windows rely on `before-quit` cleanup (§2.5).
Spawn failure → `status: "failed"`, `error: <message>`. Success → `status: "starting"`, `error: null`, `log: []`.

**Line pump** – every line is appended to `log` (keep 200). While `starting`, a line containing
`host shell listening` → `status: "running"` and `refresh()`. The daemon's log line format is
`<ISO time> INFO  [host-shell] host shell listening url=… host=… state=…` (on stdout; WARN/ERROR go to stderr).

**Exit** – ignore exits of a stale child. If Stop was requested or code 0 → `stopped`, `error: null`.
Otherwise `failed`, `error = cliError(log.join("\n"), code)`.

**stop()** – only for a child we own: `status: "stopping"`, SIGTERM, SIGKILL after 5 s if still alive.

**refresh()** (probe) – runs `host pair --json` (one-shot CLI), parses the **last** stdout line starting
with `{` as `{ link, url, name, pinSet }` (`link` and `url` strings required, else error
`The controller printed no pairing link`). If we do not own a daemon, `GET <url>/v1/health` with 1.5 s timeout;
it is the host daemon when the JSON is `{ ok: true, service: "host-shell", … }`. Then:

- owned → only `pairing` updated;
- else health ok → `pairing`, `status: "external"`, `error: null`;
- else if it was `external` → `pairing`, `status: "stopped"`;
- else → `pairing`, and `error` kept only when status is `failed`.

Probe error → `error = message`; `status = "failed"` unless owned (then status unchanged).

`host pair --json` needs to resolve the bind address (Tailscale) unless `THEONE_HOST_SHELL_PUBLIC_URL`
is set; it prefers the `https://<magicdns>` URL of `tailscale serve` when one proxies to the daemon. So
on a machine without Tailscale the probe fails with the daemon's message, e.g.
`tailscale is not installed; install it on the host or pass --bind <ipv4>` or
`Could not read the host's Tailscale IPv4 (is tailscale up?)`.

**cliError(output, code)** – non-empty trimmed lines; prefer lines matching `^error:\s*` (case-insensitive);
take the last one, strip the `error:` prefix; fallback `The controller exited with code {code}` or
`The controller failed`.

**setPin(pin)** – `host pin --stdin`, PIN written to stdin as `"<pin>\n"` (never argv, never disk in clear),
then `refresh()`. **rotateToken()** – `host token --rotate`, then `refresh()`.

**Host token** – taken from the pairing link: `theone://host?…&token=<t>` (query before `#`,
URI-decoded). Missing → `The host pairing link has no token`.

**App lifecycle** – on app ready: `autostart ? start() : refresh()`. On quit: SIGTERM our child, wait 3 s, kill.
A daemon stopped this way leaves the Android emulator running (the next daemon adopts it).

### 2.4 PIN session (in memory only)

`POST <pairing.url>/v1/host/unlock` with `Authorization: Bearer <host token>` and body `{ pin }`
→ `HostSession { session, expiresAt }` (ISO; TTL 15 min server side). Kept in main-process memory as
`(session, expiresAtEpoch)`. `androidClient()` returns a client only when `ready` **and** a session exists
and `expiresAt - 30 s > now`; otherwise it drops the session and returns null. Any 401/403
(`is_auth_error`) on a host call → forget the session and ask for the PIN again.
Server limits: 5 wrong PINs → locked 5 min, doubling per lockout, max 24 h; the server's message is shown as is.

Host HTTP error text: API errors → the server's `message`; network errors →
`The host shell is not answering at {url}`.

### 2.5 Electron-specific requirements (do not copy GTK limits blindly)

- **Ports.** The daemon default is `7701` (`HOST_SHELL_PORT`). The user's own daemon may already be on it;
  dev/e2e runs must pass `THEONE_HOST_SHELL_PORT=<free port>`, `THEONE_HOST_SHELL_DIR=<tmp dir>` and
  `--bind 127.0.0.1` / `THEONE_HOST_SHELL_BIND=127.0.0.1` so they never touch the user's state or daemon.
  A port conflict shows up as a `failed` status with the daemon's error; detect `external` first (health probe) so
  the app never spawns a second daemon on a busy port.
- **Bind.** Only loopback or `100.64.0.0/10` is accepted (`Refusing to bind …`). Phones need the Tailscale
  address; an Electron onboarding step should check `tailscale ip -4` and explain, but must not change the rule.
- **Windows/macOS.** `host serve` itself is portable (Bun), but `$SHELL -l` for terminals and the emulator's
  `netns` isolation are Linux-only (§3.3). `setpriv` is Linux-only.
- **Env passed to the daemon**: app env plus the Android variables the onboarding resolved (§3.1), so a
  freshly installed SDK is used without the user exporting anything.
- Never log or send the host token, PIN or session to the renderer, crash reporters or the log panel
  (the daemon itself never logs them).

---

## 3. Host Android emulator

### 3.1 How the daemon finds the tools (`apps/controller/src/host/android/config.ts`)

| What | Resolution (first match wins) | Missing → |
|---|---|---|
| SDK root | `THEONE_ANDROID_SDK_ROOT`; else `$HOME/.local/share/theone/android-sdk` **if** it contains `emulator/emulator`; else `ANDROID_SDK_ROOT`; else `ANDROID_HOME` | `No Android SDK found; set THEONE_ANDROID_SDK_ROOT` |
| emulator binary | `<sdkRoot>/emulator/emulator` (must exist) | `The Android emulator is not installed in {sdkRoot}` |
| adb | `THEONE_ADB` (path with `/` must exist, else looked up on PATH); else `adb` on PATH | `adb is not installed on the host; set THEONE_ADB` |
| scrcpy server jar | `THEONE_SCRCPY_SERVER`; else `/usr/share/scrcpy/scrcpy-server`, `/usr/local/share/scrcpy/scrcpy-server` | `scrcpy: false` in status (screen stream off) |
| scrcpy version | `THEONE_SCRCPY_VERSION`; else parsed from `scrcpy --version` first line `scrcpy <ver>` | `scrcpy: false` |
| ffmpeg | `THEONE_FFMPEG`; else `ffmpeg` on PATH | `ffmpeg: false` |
| console port | `THEONE_EMULATOR_PORT`, even, 5554–5682, default `5554` (adbd = +1) | startup error |
| GPU | `THEONE_EMULATOR_GPU`, default `host` if a `/dev/dri/renderD*` node is usable, else `swiftshader_indirect` | — |
| isolation | `THEONE_EMULATOR_ISOLATION` = `netns` (default) \| `none` | startup error on other values |
| unshare / ip | PATH; `ip` also in `/usr/sbin`, `/sbin` | `Emulator network isolation needs unshare (util-linux) and ip (iproute2) on the host; THEONE_EMULATOR_ISOLATION=none runs the emulator without isolation, but …` |
| allow-list | `THEONE_EMULATOR_ALLOW_NETS` comma CIDRs | startup error `THEONE_EMULATOR_ALLOW_NETS: "<x>" is not a CIDR` |
| adb bridge port | `THEONE_EMULATOR_ADB_PORT` (≠0), else free port persisted in the runtime dir | — |
| runtime dir | `$XDG_RUNTIME_DIR/theone/emulator-<port>/`, else `<tmpdir>/theone-<uid>/emulator-<port>/` (0700) | — |

The emulator tools run with `ANDROID_SDK_ROOT` and `ANDROID_HOME` both set to the SDK root
(env with every `THEONE_HOST_SHELL_*` variable removed). AVDs = `emulator -list-avds` (10 s timeout);
AVD files themselves live where the emulator looks (`ANDROID_AVD_HOME`, else `~/.android/avd`).
Launch: `emulator -avd <avd> -port <port> -no-window -no-audio -no-boot-anim -skip-adb-auth -gpu <gpu>`
(+ netns flags `-http-proxy http://127.0.0.1:3128 -dns-server 127.0.0.1`). Booted when
`adb -s <serial> shell getprop sys.boot_completed` prints `1` (2 s poll, 5 min timeout). Stop grace 20 s.
External emulators are re-checked every 5 s. Serial: `127.0.0.1:<bridge port>` (netns) or `emulator-<port>`.

`unavailableReason()` order: SDK → emulator → adb → (netns only) the isolation probe
`unshare --user --map-root-user --net -- ip link add theone0 type dummy`; failure →
`Emulator network isolation could not create a user and network namespace ({detail}); enable unprivileged user namespaces, or set THEONE_EMULATOR_ISOLATION=none to run without isolation, but without it, anything with adb access to the emulator (the linked sandbox) can reach the host's loopback services (including the adb server), LAN and tailnet`.

### 3.2 What the Electron onboarding must provide (Android-Studio-like)

The GTK app installs nothing; it says `This computer has no Android virtual device; create one in Android Studio`.
The Electron setup wizard replaces that with an installer whose **output must match the resolution above**:

1. SDK root: install into `~/.local/share/theone/android-sdk` on Linux (picked up automatically, no env),
   and into an app-data dir on macOS/Windows (`~/Library/Application Support/Monolith/android-sdk`,
   `%LOCALAPPDATA%\Monolith\android-sdk`) passed to the daemon as `THEONE_ANDROID_SDK_ROOT`. Reuse an existing
   `ANDROID_SDK_ROOT`/`ANDROID_HOME` when it already has `emulator/emulator` and the user picks it.
2. Packages through the SDK's `cmdline-tools/latest/bin/sdkmanager` (download the cmdline-tools zip per OS,
   sha256-pinned like the sandbox image does): `platform-tools` (provides `adb`, then pass
   `THEONE_ADB=<sdk>/platform-tools/adb` so no PATH change is needed), `emulator`, and one
   `system-images;android-<api>;google_apis;<abi>` (`x86_64` on x64 hosts, `arm64-v8a` on Apple silicon /
   arm64 Linux). Licences via `sdkmanager --licenses` with the user's explicit accept in the wizard.
3. AVD: `avdmanager create avd -n <name> -k <image> -d <device>`; it then appears in `emulator -list-avds`.
4. Acceleration check before downloading the image: Linux `/dev/kvm` readable+writable by the user
   (`emulator -accel-check` gives the detail); Windows WHPX (Windows Hypervisor Platform feature) via
   `emulator -accel-check`; macOS HVF (always on Apple silicon / supported Intel).
5. scrcpy-server + ffmpeg for the phone screen stream: Linux distro packages, or bundle a scrcpy-server jar
   with the app and set `THEONE_SCRCPY_SERVER` + `THEONE_SCRCPY_VERSION` (must equal the jar's version) and
   `THEONE_FFMPEG`. Without them `/v1/android` still works; only the phone screen stream is off.
6. Linux isolation: run the probe above as part of the wizard and show the runbook fix
   (`sysctl kernel.unprivileged_userns_clone=1`; Ubuntu 24.04+: `kernel.apparmor_restrict_unprivileged_userns=0`).

### 3.3 Platform caveat (open issue, do not paper over)

`netns` isolation exists only on Linux. On macOS/Windows the probe fails, so `GET /v1/android` returns
`available: false`, and the desktop flow refuses `isolation: "none"`
(`The host shell runs with THEONE_EMULATOR_ISOLATION=none, so the sandbox may not use its emulator`).
Running there with `none` exposes the host loopback/LAN/tailnet to the linked sandbox. Until the daemon gains
an isolation mode for macOS/Windows, the Electron app on those OSes may install the SDK/AVD and let the user run
the emulator locally, but must show the GTK notices and **not** link it to the sandbox automatically.

### 3.4 Host Android API used by the desktop (`HostAndroidClient`, bearer = PIN session)

| Call | HTTP |
|---|---|
| `unlock(pin)` (bearer = host token) | `POST /v1/host/unlock {pin}` → `HostSession` |
| `status()` | `GET /v1/android` → `HostAndroidStatus` |
| `startEmulator(avd)` | `POST /v1/android/emulator {avd}` (desktop never sends `coldBoot`/`wipeData`) |
| `stopEmulator()` | `DELETE /v1/android/emulator` |
| `linkSandbox(url, token)` | `POST /v1/android/link {sandboxUrl, token}` → `AndroidLinkInfo` |

Types (`HostAndroidStatus`, `EmulatorInfo`, `AndroidLinkInfo`) are in `@theone/protocol`; import them, don't redeclare.

### 3.5 Project detail: the Display / emulator button

Constants: `ANDROID_FRAMEWORKS = ["expo","react-native","android"]`; host-fixable reasons (exact match on `target.reason`):
`Link the host Android emulator first`, `Start the emulator on the host`,
`The host emulator is not isolated; start it from the app`.

`displayButton(targets, runs, framework, targetsError)`; `androidTarget` = first target with `viewer === "android"`:

| Case | mode | label | icon | tooltip |
|---|---|---|---|---|
| no android target, framework not Android | `display` | `Display` (DETAIL.display) | `display` | none |
| no android target, Android framework, targets still loading | `unsupported` (disabled) | `Open on emulator` | `smartphone` (Lucide `smartphone`) | none |
| … targets loaded, none | `unsupported` | `Open on emulator` | `smartphone` | `No Android app was detected in this project` |
| … run-targets 404 | `unsupported` | `Open on emulator` | `smartphone` | `This sandbox can't run apps on the emulator yet; update the sandbox` |
| … other error | `unsupported` | `Open on emulator` | `smartphone` | `Couldn't read the project's run targets: {error}` |
| android target, a live run of it (`starting`/`ready`) | `emulator` | `Show emulator` | `smartphone` | as below |
| android target, else | `emulator` | `Open on emulator` | `smartphone` | available: `Build the app and install it on the host Android emulator` (with dir: `Build the app in {dir} and install it on the host Android emulator`); host-fixable: `{reason}. Monolith starts and links the emulator on this computer first`; else `{reason}` |

Button disabled when `unsupported` or while the launcher is busy; while busy with a progress label the
button text is replaced by that label (`Checking the emulator…` etc.).

### 3.6 Launch flow (`EmulatorLauncher.launch(target)`)

1. **Target available** → busy; `runOnEmulator`: reuse a live run of the target (from `GET /v1/app-runs?projectId=`)
   or `POST /v1/projects/:id/app-runs {target}`; then `GET /v1/android` (sandbox) for `emulator.serial`.
2. **Not host-fixable** → report `Can't run on the emulator: {reason}`.
3. **Host-fixable** →
   - `hostBlocker(state)`: status `stopped|stopping|failed` → `The host shell isn't running, so Monolith can't start the emulator. Turn on Serve host shell in Preferences.`;
     `starting` or no pairing → `Monolith is still reading the host shell settings; try again in a moment.`;
     no PIN → `Set a host shell PIN in Preferences so Monolith can start the emulator.`
     Blocked → `refresh()` and report with action button `Preferences` (opens settings page `host-shell`).
   - No live session → Unlock dialog (§4.4), then retry.
   - busy `Checking the emulator…`; `status()`. Auth error → forget session, retry (asks PIN). Other error →
     `The host shell couldn't prepare the emulator: {error}`.
   - `planEmulator(status, sandboxBaseUrl)`:
     - `!available` or emulator `unavailable` → blocked: `reason` or `The host can't run the Android emulator`
     - `isolation === "none"` → blocked `The host shell runs with THEONE_EMULATOR_ISOLATION=none, so the sandbox may not use its emulator`
     - emulator `stopping` → blocked `The emulator is stopping; try again in a moment`
     - `linked` = `link.configured && link.sandboxUrl` equals the sandbox URL (trim, strip trailing `/`, lowercase);
       `relink = !(linked && link.connected)`; `replaces = link.sandboxUrl` when configured+connected and not ours.
     - emulator `starting|running` and `isolated` → plan `{link: relink, replaces}`.
     - else `avd` = current `emulator.avd` if still in `avds`, else first AVD; none → blocked
       `This computer has no Android virtual device; create one in Android Studio`
       (Electron: append an action that opens the emulator setup wizard step).
     - plan `{stop: state in starting|running, avd, link: relink, replaces}`.
     Blocked → report `Can't run on the emulator: {reason}`.
   - Confirms: `stop` → destructive confirm **Restart the emulator isolated?** /
     `The running emulator was started outside Monolith, so the sandbox may not use it. Monolith stops it and starts {avd} in an isolated network.`
     / `Restart` / `Cancel`; then, if `replaces`, non-destructive confirm **Link this sandbox instead?** /
     `The host emulator is linked to {url}. Linking it to this sandbox ends that link.` / `Link` / `Cancel`.
   - `prepareEmulator` (worker, poll every **2 s**): stop → wait for `stopped|failed` ≤ **60 s**
     (`The emulator did not stop in time`); start AVD; link (`client.baseUrl`, `client.token` of the active sandbox);
     wait ≤ **330 s** for `running && isolated && linked && connected` (`The emulator did not boot within 6 minutes` –
     note `round(330/60)` = 6 although the docs say 5½ min); a `failed` emulator aborts with `The emulator failed: {error}`
     (`unknown error` if none); then wait ≤ **60 s** for the sandbox to offer the target as available
     (`The sandbox did not pick up the emulator within 60 seconds`); then `runOnEmulator`.
     Progress labels (button text; also a toast for every stage except `booting`):
     `Stopping the emulator…`, `Starting the emulator…`, `Linking the emulator to the sandbox…`, `Waiting for the emulator…`.
   - Failures: host errors → `The host shell couldn't prepare the emulator: {error}` (auth → forget session);
     others → `Couldn't run on the emulator: {error}`.
4. **After a run** (`onEmulatorRun`): started → toast `Building for the emulator; the app opens there when the build finishes`.
   No `scrcpy` on PATH → toast `The app runs on the emulator; install scrcpy to see its screen here`.
   No serial → report `The emulator is not reachable from this machine`. Else open one viewer window:
   `scrcpy --serial <serial> --window-title "{project name} · Android emulator" --no-audio` (detached, own session,
   stdout ignored; keep last 20 stderr lines). A second open while it runs is a no-op. Non-zero exit → report
   `Couldn't show the emulator: {error}`, error = last `ERROR:` line (prefix stripped) or last line or
   `scrcpy exited with code {code}`.
   Electron improvement (optional, later): instead of scrcpy, open an Electron window on the daemon's own
   `/ui/android#ticket=…&maxSize=…` page (ticket from `POST /v1/auth/ticket` with the PIN session) – no scrcpy/ffmpeg
   dependency on the desktop side beyond what the daemon needs.

"Report" = the project page's inline error notice (danger tone, optional action button); "toast" = app toast.

---

## 4. UI: settings pages and dialogs

Settings pages order (GTK `order`): Connection 0, Appearance 5, **Claude 10**, **Host shell 15**, **Speech-to-text 20**.
Nav icons (Lucide): Claude `mouse-pointer-2` (key `agents`), Host shell `monitor` (key `host`), Speech-to-text `mic`.
Group header refresh buttons use Lucide `refresh-cw`, tooltip `Refresh`.

### 4.1 Shared settings visuals (Graphite dark scheme, from `theme/extras/dialogs.py`)

Tokens: spacing xxs 2, xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32; control heights
xs 24, sm 28, md 32, lg 36, xl 44; radius xs 4, sm 6, md 8, card 10, xl 12.
Colors: background `#09090A`, surface `#121213`, surfaceElevated `#1A1A1B`, backgroundElement `#1E1E20`,
backgroundSelected `#232325`, text `#E3E3E4`, textSecondary `#929294`, textTertiary `#6B6B6F`,
border `rgba(255,255,255,0.08)`, borderStrong `rgba(255,255,255,0.13)`, divider `rgba(255,255,255,0.06)`,
accent `#5E6AD2`, danger/dangerSolid `#EB5757`, warning `#F2C94C`, success `#4CB782`, textOnAccent `#fff`,
overlay `rgba(0,0,0,0.55)`. Light (Graphite light): background `#F5F5F6`, surface `#FFFFFF`, text `#1B1B1F`,
textSecondary `#5C5D66`, border `rgba(0,0,0,0.09)`, accent `#5E6AD2`.

- Page body: margin 20 24 32 24, groups separated by 24.
- Group: heading 13px weight 500 `text`; description 12px `textSecondary`; 8px between header and list.
  Header suffix (refresh icon button) sits right of the heading.
- Boxed list: background surface, 1px border, radius 8; rows separated by 1px divider; row min-height 44,
  horizontal padding 14, title 13px, subtitle 12px textSecondary, title/subtitle gap 2, vertical margin 8.
- "Property" rows (read-only key/value, `PreferenceRows`): **inverted**: title 12px textSecondary, subtitle 13px text;
  subtitle text selectable where noted.
- Expander rows: chevron textSecondary; nested rows transparent, min-height 36.
- Buttons inside rows: height 28. Check/radio: 14×14, 1px borderStrong, check radius 4.
- Switch: 28×16, radius full, off `backgroundSelected`, on accent, knob 12×12 white, margin 2, no shadow.
- Row entry (`entry_row`): 32px tall, radius 6, min-width 320, background surfaceElevated; password variant has a
  peek (eye) toggle.
- Right-aligned action buttons under a group (`SettingsActions`): gap 8.
- Toasts: success/info default timeout; failures use **6 s**.
- Notice: padding 8 × 10, radius 8, 1px border, transparent bg, 16px tone icon, gap 10, message 12px textSecondary,
  action button 24 high, padding 0 8, 12px, tone-colored.

Micro-animations for Electron (not in GTK): switch knob 120 ms ease-out; expander chevron rotate + height
180 ms; row enable/disable opacity 120 ms; log panel expand 180 ms; status subtitle cross-fade 120 ms;
all disabled under `prefers-reduced-motion`.

### 4.2 Host shell page (`id: "host-shell"`, title `Host shell`)

Group **Server** – description `Lets paired phones open a terminal on this computer over Tailscale. Monolith runs it in the background and stops it when you quit.`; header suffix refresh (→ `refresh()`).
- Switch row **Serve host shell**; subtitle = status label:
  `Stopped` · `Starting…` · `Running · {url}` (or `Running` without pairing) · `Stopping…` ·
  `Running outside Monolith · {url}` · `Failed: {error}`.
  Switch is on when `serving || starting`; disabled while `stopping` or `external`. Toggling on → `start()`,
  off → `stop()`. Programmatic syncing must not fire the handler.
- Switch row **Start with Monolith**, subtitle `Start serving whenever Monolith opens` → persists autostart.

Group **Security**
- Row **PIN**, subtitle `Set · phones unlock with it` / `Not set · phones can't unlock the shell`; suffix secondary
  button `Set PIN…` / `Change…` → PIN dialog (§4.3).
- Row **Host token**, subtitle `Paired phones use it to reach this computer`; button `Rotate…` → destructive confirm
  **Rotate the host token?** / `Every paired phone stops working until you pair it again.` / `Rotate` / `Cancel`.
  Success toast `Host token rotated; pair your phones again`; failure toast (6 s) `Couldn't rotate the token: {error}`.

Group **Pairing**
- Row **Pair a phone**, subtitle `Show the theone://host link and QR code`, button `Show QR…` → Pair dialog on the
  `This computer` tab.
- Expander row **Log**: monospace caption text (Geist Mono 12px), selectable, wrapped, margins 8 top/bottom 12 sides;
  last 40 lines, or `No output yet`. Electron: auto-scroll to bottom while expanded.

### 4.3 Host shell PIN dialog (form dialog, width 400)

Breadcrumb context `This computer` (icon `monitor`), title `Host shell PIN`, subtitle `6 to 12 digits`.
Group description `Saving a new PIN ends every open phone session.` Fields (password): `New PIN`, `Repeat PIN`.
Buttons `Cancel` / primary `Save PIN`. Validation: not `^\d{6,12}$` → error on PIN field
`The PIN must be 6 to 12 digits`; mismatch → error on repeat field `The PINs do not match`. Busy while saving.
Success: toast `Host shell PIN saved` (on the settings dialog if opened from there), close.
Failure: form error `Couldn't save the PIN: {error}`.

### 4.4 Unlock dialog (form dialog, width 400)

Context `This computer`, title `Unlock the host shell`, subtitle `Enter the host shell PIN to start the Android emulator`.
One password field `PIN`. Buttons `Cancel` / primary `Unlock`. Invalid → `The PIN must be 6 to 12 digits`.
Failure → form error with the server/network message (e.g. the server's wrong-PIN/lockout text). Success → close,
continue the launch.

### 4.5 Pair dialog, `This computer` tab (host parts only)

Dialog width 440, title `Pair a device`, segmented control `Sandbox` | `This computer`, QR 176 px
(QR padding 12, radius 8). Host panel: instructions `Scan with the TheOne app (Host shell), or open this link on the phone.`,
copy field with the link, caption `Host {name} · {url}`, warning notice
`The link contains the host token: share it only with your own devices. Phones also need the PIN.`
Notices above it (in order):
- failed → danger `The host shell couldn't start: {error}` action `Retry` (→ refresh)
- stopped → warning `The host shell isn't running. Start it so the phone can reach this computer.` action `Start`
- starting → `Starting the host shell…`; external → `The host shell is running outside Monolith.`
- then: no pairing (and not failed) → `Reading the host shell settings…`; pairing without PIN → warning
  `No PIN is set yet. Phones need it to unlock the shell.` action `Set PIN`.
Footer `Done` / primary `Copy link` (disabled without a link); toast `Pairing link copied`.
(Full dialog layout is in the pairing/dialogs spec.)

### 4.6 Claude page (`id: "claude"`, title `Claude`)

**This computer** group (description `Loading…` until the first read, then
`Claude Code accounts on this machine (~/.claude and ~/.claude-<name>)`). One **expander row per host account**
(first one expanded), title = account id, subtitle `{email} · {configDir}`; nested property rows:

| Title | Value |
|---|---|
| `Login` | `Signed in` / `Login not found` / `Login file is unreadable` / `Login not found (macOS keychain not supported)` |
| `Account` | `{email} · {organization}` or `—` |
| `Plan` | capitalized `subscriptionType` (`_`/`-` → space, first letter upper) or `—` |
| `Access token` | when signed in: `Expires in {d}` or `Expired {d} ago · Claude Code refreshes it on next use` (min 60 s), else `—` |
| `Settings` | ` · `-joined: `settings.json`, `CLAUDE.md`, `N skill file(s)`, `N agent file(s)`, `N command file(s)`, `N output style file(s)`; or `No settings found` |

Durations (`format_uptime`): `<60s` → `Ns`, `<1h` → `Nm`, `<1d` → `Hh Mm`/`Hh`, else `Dd Hh`/`Dd`.
Pluralize: count 1 → singular, else + `s`.

Host account discovery (main process, never returns or logs secrets):
- primary id `claude`: `CLAUDE_CONFIG_DIR` (with `~` expanded; global config `<dir>/.claude.json`), else `~/.claude`
  with `~/.claude.json`;
- then every `~/.claude-<name>` (regex `^\.claude-([a-z0-9][a-z0-9_-]{0,31})$`, sorted, a directory, not the
  primary dir, containing `.credentials.json`) → id `claude-<name>`, global config `<dir>/.claude.json`.
- Login: macOS → issue `keychain` (Electron could read the keychain via `security find-generic-password` – a
  deliberate improvement, out of scope unless asked); file missing → `missing`; not JSON / no
  `claudeAiOauth.accessToken` string → `invalid`. `subscriptionType`, `expiresAt` (ms) from `claudeAiOauth`.
  Email/name/org from `oauthAccount.{emailAddress,displayName,organizationName}` in the global config.
- Settings: `settings.json`, `CLAUDE.md` count only if regular files (not symlinks); extension counts = regular
  files under `skills`, `agents`, `commands`, `output-styles`, walked without following links, skipping
  `.git .hg .svn node_modules __pycache__`.

**Sandbox** group (description `Claude Code inside the sandbox uses this computer's ~/.claude folders (linked)`,
once loaded `… · {configDir}`), header refresh button (refreshes host + sandbox). `GET /v1/claude/auth` → property rows
(subtitle selectable): `Status` (method: `Claude Code is not installed in the sandbox` if !available;
`Signed in with a long-lived token` / `… from the environment` / `Signed in with this computer's login` /
`Using an API key` / `Not signed in`), `Account`, `Plan`, `Access token` (only for method `credentials`, else `—`),
`Settings` (`settings.json present` / `No settings.json`). Offline/loading/error → single row `Status`:
`Loading…`, `Not connected`, the connection label + ` — {error}`, 404 →
`This sandbox is too old for Claude sign-in. Rebuild and restart it: \`bun run sandbox build\` then \`bun run sandbox up\`.`

**Accounts** group (description `Accounts linked into the sandbox. The default is used by projects that don't pick one.`):
`GET /v1/claude/accounts` → radio rows (single choice = `defaultAccountId`); title `{id}` or `{id} · primary`;
subtitle up to three lines: `{email} · {org}` (or `—`), `{Plan} · {login}` where login is
`Not linked into the sandbox` / `Not signed in` / `Signed in[ · Expires in …]`, and `configDir`. Row disabled when
`present` is false or a change is pending. Empty → `Status: No accounts`; 404 →
`This sandbox is too old for multiple Claude accounts. Rebuild and restart it: \`bun run sandbox build\` then \`bun run sandbox up\`.`
Selecting → `PUT /v1/claude/accounts/default {accountId}`; toast `Default Claude account set to {id}`, reload sandbox,
refresh the workspace; failure toast (6 s) `Couldn't change the default Claude account: {error}`.
Sandbox data reloads when the connection goes from offline to online.

### 4.7 Speech-to-text page (`id: "stt"`, title `Speech-to-text`)

**Resource usage** group, description
`Voice notes are transcribed locally with whisper.cpp inside the sandbox. Pick how much of this computer it may use.`
Four radio rows in order `off`, `eco`, `balanced`, `performance`; titles `Off`, `Eco`, `Balanced`, `Performance`;
subtitle lines: description (`Voice notes are not transcribed` / `Lowest impact: base model, 2 threads, idle CPU and disk priority` /
`Faster: base model, a quarter of the CPU cores, low CPU priority` / `Most accurate: small model, half the CPU cores, normal priority`),
then details `{model} · N thread(s) · nice {n}` (omitted parts when 0/null; none for `off`), then
`Model not installed in the sandbox` when the status is loaded and the profile is unavailable. `off` is always
available. Rows disabled while no status, unavailable, or pending. Selecting a different profile →
`PUT /v1/stt {profile}`; toast `Speech-to-text set to {Title}`; failure toast (6 s) `Couldn't change speech-to-text: {error}`.

**Gemini** group, description `Cloud transcription for voice notes sent with the Gemini provider. The key is stored on the sandbox and shared with the mobile app.`
Entry row `API key` (password, 320 wide), subtitle = `Saved from an app` / `GEMINI_API_KEY on the sandbox` / `Not set`
plus ` · {gemini.model}`. Actions (right aligned): destructive `Remove saved key` (visible only when source is
`settings`), primary `Save` (Enter in the field also saves). Save trims; empty → nothing. `PUT /v1/stt {geminiApiKey}`
(null to remove). Toasts `Gemini API key saved` / `Gemini API key removed`; failure (6 s)
`Couldn't update the Gemini API key: {error}`. Field cleared after success.

**Status** group, header refresh. Property rows (selectable): `Engine` (or `—`), `Model`, `State`
(`Ready` / `Not ready · {reason}`), `Activity` (`Idle`/`Transcribing` + ` · {n} queued`), `CPU cores`.
Errors as Claude (404 → `This sandbox is too old for speech-to-text settings. Rebuild and restart it: \`bun run sandbox build\` then \`bun run sandbox up\`.`).

---

## 5. GTK quirks NOT to copy

- Python threads + `GLib.timeout_add_seconds` for the kill timer: use a plain `setTimeout` in main.
- `setpriv --pdeathsig` is the only guard against orphaned daemons on Linux; in Electron also kill the child on
  `before-quit`/`will-quit` and on renderer crash recovery; on Windows use `child.kill()` (no signals) and a job
  object if available.
- Probing by spawning `host pair --json` on every Refresh costs ~100–300 ms of process start each time; keep it,
  but debounce repeated refreshes (one in flight).
- The Claude/STT 404 messages tell the user to run `bun run sandbox build` – in the Electron app replace the
  instruction with the app's own rebuild action (the onboarding/sandbox image screen) while keeping the meaning.
- `Adw.SwitchRow` notify loops are prevented with a `_syncing` flag; in React use controlled components.
- The boot-timeout message rounds 330 s to `6 minutes`; keep the 330 s timeout, the string is what GTK shows.
- `This computer has no Android virtual device; create one in Android Studio` – Electron has its own AVD setup;
  point to it instead of Android Studio.
- `read_login` on macOS always says keychain unsupported; acceptable to keep for parity.
- Hard-coded `/usr/share/scrcpy` paths and `~/.local/share/theone/android-sdk` are Linux conventions: on other OSes
  pass explicit `THEONE_*` env vars from the app (§3.2).

## 6. Test checklist (Electron)

- Unit: `cliError`, `parsePairing` (last `{` line), `hostToken`, `pinError`, status label, `displayButton`,
  `planEmulator`, `emulatorReady`, `isLinkedTo` (case/trailing slash), `pickAvd`, STT/Claude row builders,
  host account discovery with a temp HOME (incl. symlinked files not counted, keychain on darwin).
- Integration (no user resources touched): spawn the compiled binary with `THEONE_HOST_SHELL_DIR=<tmp>`,
  `THEONE_HOST_SHELL_PORT=<free>`, `--bind 127.0.0.1`, `THEONE_HOST_SHELL_PUBLIC_URL=http://127.0.0.1:<port>`;
  `host pin --stdin`, `host pair --json`, `serve` → wait for `host shell listening`, unlock, `GET /v1/android`
  (expect `available:false` with a reason on CI), `GET /ui/android` 200, stop within 5 s.
- Never use port 7701 or `~/.config/theone/host-shell` in tests.
