# The `tesseract` command

`tesseract` controls Tesseract from a terminal on **this computer**: Docker checks, the
sandbox stack, the host Android emulator, pairing, sync with the sandbox, and the app's
settings. It is a single executable (`bun build --compile` of `apps/electron/cli`), shipped
inside every Tesseract installer, and it uses the same code, files and settings as the
desktop app, so the app and the CLI always agree.

The sandbox has its own, much smaller `tesseract` command
(`infra/docker/sandbox/rootfs/usr/local/bin/tesseract`, a wrapper around
`tesseract-controller tesseract`). It only implements `--get`
([sync-back.md §6](../architecture/sync-back.md)); everything on this page is the host command.

Related: [onboarding.md](onboarding.md) (the same setup in the app),
[electron-desktop.md](electron-desktop.md) (building the CLI).

## Install

| How Tesseract is installed | How `tesseract` gets on `PATH` |
|---|---|
| macOS (`Tesseract.app` in `/Applications`) | Settings › About › Command line › **Install tesseract command**. One admin prompt; creates `/usr/local/bin/tesseract` → `Tesseract.app/Contents/Resources/bin/tesseract`. The app must be in Applications first |
| Windows (NSIS installer) | automatic: the installer appends `%LOCALAPPDATA%\Programs\Tesseract\resources\bin` to your user `Path` (open a new terminal). Uninstalling removes it |
| Debian / Ubuntu (`.deb`) | automatic: `/usr/bin/tesseract` → `/opt/Tesseract/resources/bin/tesseract`, unless another `/usr/bin/tesseract` already exists |
| AppImage | Settings › About › **Install tesseract command**: copies the binary to `~/.local/share/tesseract/bin/tesseract` and links `~/.local/bin/tesseract` to it. `~/.local/bin` must be on `PATH`. On install and on every AppImage launch (while that copy exists) the app also writes `~/.local/share/tesseract/app.json` (`appPath` = the AppImage, `sandboxDir`) and copies its bundled sandbox context to `~/.local/share/tesseract/sandbox` (only when it changed; `.bundle-hash` marks the copied version), so the copy finds both. After updating the AppImage, About shows the copy as outdated; install again |
| Repository checkout | `bun apps/electron/cli/index.ts <command>`, or build one with `bun run --cwd apps/electron cli:build` (→ `apps/electron/dist-cli/<os>-<arch>/tesseract`) |

Settings › About shows whether the command is installed, where, and conflicts with another
`tesseract` on the same path.

## Usage

```
tesseract <command> [options]          add --json for machine-readable output
tesseract help [command]               or: tesseract <command> --help / -h
```

| Global option | Meaning |
|---|---|
| `--json` | print one JSON document on stdout (results and errors) instead of text |
| `--verbose` | print every log line of long operations (build log, download log) on stderr |
| `--help`, `-h` | help for the command |

Text results go to stdout; progress and log lines go to stderr. On a terminal, progress is
one line that redraws; otherwise a line every 5 s. Unknown options are errors.

| Exit code | Meaning |
|---|---|
| `0` | success (`doctor`: no check failed) |
| `1` | error (`doctor`: at least one check failed) |
| `2` | sync conflict: files changed on both sides |
| `64` | usage error (unknown command, option or value) |
| `130` | interrupted (Ctrl+C) or cancelled |

With `--json`, errors are `{"ok": false, "error": {"code": "...", "message": "...", "detail": "..."}}`
on stdout, where `code` is one of `invalid_argument`, `not_found`, `unavailable`,
`forbidden`, `cancelled`, `timeout`, `internal`.

## Commands

| Command | Does |
|---|---|
| [`status`](#status) | the connection, Docker, sandbox and Android emulator at a glance |
| [`open`](#open) | open the app (or bring it to the front) on a page |
| [`doctor`](#doctor) | check Docker, the sandbox image, hardware acceleration and the Android SDK |
| [`sandbox`](#sandbox) | the local sandbox stack: status, up, down, restart, logs, build, pair |
| [`android`](#android) | the host Android emulator: images, install, avd create/list/start/delete |
| [`pair`](#pair) | the pairing link and a QR code for the phone app |
| [`sync`](#sync) | sync the current directory with the sandbox: push, pull, revert, status |
| [`server`](#server) | run this machine as a headless sandbox host: install, uninstall, status, pair |
| [`config`](#config) | read or change Tesseract settings |
| [`version`](#version) | print the version |
| [`help`](#usage) | help for a command |

### status

```bash
tesseract status
tesseract status --json
```

Never changes anything. Each part is checked independently; a part that can't be read
shows `unavailable: <reason>` and the others still print. Example:

```
Tesseract 0.1.0
Sandbox:   tesseract-sandbox · http://127.0.0.1:7700 (reachable)
Docker:    Docker Engine 29.8.1
Stack:     tesseract · tesseract/sandbox:latest · local
Services:  sandbox    running  healthy
Android:   Tesseract_API_36 · /home/you/.local/share/tesseract/android-sdk
Setup:     complete
Config:    /home/you/.config/tesseract-desktop/config.json
```

`Sandbox` is the saved connection (with a live `/v1/health` probe), or
`not paired (run tesseract sandbox build or tesseract pair)`. `Stack` is the stack the app
manages (`project · image · mode`), or `not configured`. `Setup` is `complete` or
`not finished (at <step>)`.

### open

```bash
tesseract open               # overview
tesseract open terminals     # overview | agents | projects | files | terminals | display
```

Starts the installed app with `--page <page>` (a running app comes to the front on that
page). It looks for the app at `TESSERACT_APP_PATH`, then next to the CLI (inside the
installed app), then at `/opt/Tesseract/tesseract-desktop` (Linux),
`/Applications/Tesseract.app` (macOS) or `%LOCALAPPDATA%\Programs\Tesseract\Tesseract.exe`
(Windows). Without an app it asks the system to open `tesseract://<page>` (`xdg-open`,
`open`, `rundll32`), and fails with
`Tesseract is not installed here; install the desktop app or set TESSERACT_APP_PATH`.

### doctor

```bash
tesseract doctor                 # every section
tesseract doctor docker kvm      # only these: docker | image | kvm | sdk
tesseract doctor sdk --sdk ~/Android/Sdk
tesseract doctor --json
```

| Section | Checks |
|---|---|
| `docker` | the same checks as the wizard's Docker step: CLI, engine, Compose ≥ 2.24, buildx, resources, engine version, docker group, rootless, WSL, virtualization, Podman ([onboarding.md](onboarding.md#docker)) |
| `image` | the configured stack exists; its image is present (size, version, creation date); the sandbox container exists and is running |
| `kvm` | hardware acceleration: KVM access and network isolation (Linux), WHPX (Windows), Hypervisor.framework (macOS), and `emulator -accel-check` once the emulator is installed; on hosts without an emulator, a warning |
| `sdk` | the Android SDK: emulator revision, number of system images and AVDs |

```
Docker
  ok   Docker: Docker Engine 29.8.1
  ok   Engine: Running · linux/amd64 · default
  ok   Docker Compose: 2.40.0
  ok   BuildKit: buildx 0.29.1
  ok   Engine version: 29.8.1
  ok   Resources: 16 CPUs · 31 GB for containers
  ok   docker group: you is in the docker group
Sandbox image
  ok   tesseract/sandbox:latest: 7.3 GB · version 0.1.0 · created 2026-10-01
  ok   Sandbox container: tesseract-sandbox-1 is running
Hardware acceleration
  ok   KVM: /dev/kvm is available
  ok   Access to /dev/kvm: You can use /dev/kvm
  warn Network isolation: Network isolation for the emulator isn't available
       sudo sysctl -w kernel.unprivileged_userns_clone=1
       sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
Android SDK
  warn /home/you/.local/share/tesseract/android-sdk: emulator 37.2.12 · 1 system image · 0 AVDs
Everything looks good.
```

Marks are `ok`, `warn`, `FAIL`. Exits `1` when any check is `FAIL`
(`{n} problems found.`); warnings don't fail.

### sandbox

The sandbox stack the app set up: the env file `<app data>/sandbox/.env` and the compose
files of the bundled build context, run as `docker compose --project-name <project>
--env-file <env file> …`. `TESSERACT_*` and `COMPOSE_*` variables from your shell are
ignored, so they can't redirect it to another stack.

```bash
tesseract sandbox                         # = status
tesseract sandbox status
tesseract sandbox up
tesseract sandbox down
tesseract sandbox down --volumes          # also deletes the volumes: the workspace, home and Tailscale state
tesseract sandbox restart                 # every service
tesseract sandbox restart sandbox         # one service
tesseract sandbox logs                    # last 200 lines
tesseract sandbox logs --tail 50 --follow # or -f; Ctrl+C stops following
tesseract sandbox build
tesseract sandbox build --with android,whisper --verbose
tesseract sandbox build --with none       # base image only
tesseract sandbox build --existing        # skip the build, start the image you have
tesseract sandbox build --pull            # download a prebuilt image (needs sandboxImageRef)
tesseract sandbox pair [--no-qr]          # same as tesseract pair
```

`status`, `up`, `down` and `restart` print the services:

```
SERVICE  CONTAINER         STATE    HEALTH
sandbox  tesseract-sandbox-1  running  healthy
```

`status` and `logs` also work without a saved stack (they look at the default project
`tesseract`); `up`, `down` and `restart` need one (`No sandbox is configured on this computer
yet`): run `tesseract sandbox build` or the setup wizard first.

**`build`** runs the same steps as the wizard's Build: preflight (Docker ready, disk space,
the Claude folder exists), `docker buildx build`, `compose up --detach`, wait for
`/v1/health` (up to 3 min), read the pairing link and save the connection. The progress
line is `Building 42% [desktop 3/9] RUN apt-get install …`; it ends with
`Sandbox ready at http://127.0.0.1:7700`.

- Without a saved stack, it first writes the env file with the defaults (local mode,
  every tool, CPUs and memory from Docker, this computer's time zone) and prints
  `Saved the sandbox settings to <file>`.
- `--with <list>` sets the tools: any of `android`, `flutter`, `mono`, `whisper`, or `all`,
  or `none`, comma-separated, and saves them. `chrome`/`chromium` are accepted with a note
  (they are always in the base image).
- Other settings (Tailscale mode, ports, project) are changed in the app or in the env file.
- Ctrl+C cancels the build (exit `130`); finished steps stay in the BuildKit cache.

### android

The host Android SDK and emulator, without Android Studio, `sdkmanager` or `avdmanager`.
The SDK is the one saved by the app (`androidSdkRoot`), else Tesseract's default
(`~/.local/share/tesseract/android-sdk`, `~/Library/Application Support/Tesseract/android-sdk`,
`%LOCALAPPDATA%\Tesseract\android-sdk`). `--sdk <path>` uses another one for that command;
`install` and `avd create` also save it as the SDK for the app and later commands.

```bash
tesseract android images                          # tools and system images for this computer, API 30+
tesseract android images --all --refresh          # every API level; reload Google's list
tesseract android install 36                      # system image for API 36 + emulator + platform-tools
tesseract android install 35 36 --accept-licenses
tesseract android install emulator platform-tools
tesseract android install "system-images;android-36;google_apis;x86_64" --sdk ~/Android/Sdk
tesseract android avd list                        # also: tesseract android, tesseract android avd, tesseract android list
tesseract android avd create                      # Tesseract_API_36 from the API 36 image
tesseract android avd create Pixel_35 --image 35 --ram 4096 --cores 4 --default
tesseract android avd create Tablet_36 --device pixel_tablet --storage 16
tesseract android avd start                       # the default AVD, in the foreground
tesseract android avd start Pixel_35 --detach --headless --gpu swiftshader_indirect
tesseract android avd delete Pixel_35
```

**`images`** prints the SDK path, then the tools and system images with their size and the
installed revision (`-` when not installed):

```
SDK: /home/you/.local/share/tesseract/android-sdk

PACKAGE         REVISION  SIZE     INSTALLED
emulator        37.2.12   333 MB   37.2.12
platform-tools  37.0.1    8.6 MB   -

API  VERSION  ABI     SIZE    INSTALLED  PACKAGE
36   16       x86_64  1.8 GB  7          system-images;android-36;google_apis;x86_64
35   15       x86_64  1.6 GB  -          system-images;android-35;google_apis;x86_64
```

Google's package list is cached in `<app data>/android/cache/` for 6 hours.
`TESSERACT_ANDROID_REPOSITORY_URL` and `TESSERACT_ANDROID_SYSIMG_URL` point it at a mirror
([Files and environment](#files-and-environment)).

**`install`** takes API levels or package paths. A system image always brings the
emulator and platform-tools. Packages that need a license you haven't accepted print the
license text and stop with `These packages need license acceptance: <ids>` (exit `1`);
read it and run again with `--accept-licenses`. Downloads resume after a cancel, are
checked (size and sha1) and unpacked like `sdkmanager` does. Progress:
`[3/3] system-images;android-36;google_apis;x86_64 downloading 412 MB/1.8 GB 23% 18 MB/s`.

**`avd create [name]`**: `--image <api|package>` (default 36; the image must be installed),
`--device <profile>` (`pixel_5`, the default, 1080 × 2340 · 440 dpi; `pixel_8` and
`medium_phone`, 1080 × 2400 · 420 dpi; `pixel_tablet`, 2560 × 1600 · 320 dpi),
`--storage <GB>` (internal storage, 2 to 64, default 6), `--ram <MB>` (1024 to 8192) and
`--cores <n>` (defaults: 2048 MB, or 4096 MB on hosts with 12 GB+; half the cores, 2 to
4), `--default` makes it the default AVD (the first AVD becomes the default
anyway). Name: letters, digits, `.`, `-`, `_`; default `Tesseract_API_<api>`. Written to
`~/.android/avd` (`ANDROID_AVD_HOME` / `ANDROID_USER_HOME` are honoured).

`tesseract android` and `tesseract android avd` with no action list the AVDs, like `avd list`.

**`avd start [name]`** (default: the default AVD, else the first): runs
`emulator -avd <name> -port <free 5554…5682> -no-audio -no-boot-anim`. In the foreground it
prints `<avd> is running as emulator-5554; press Ctrl+C to stop it` and stops the emulator
on Ctrl+C. `--detach` starts it in the background and prints the serial. `--headless` adds
`-no-window`, `--gpu <mode>` adds `-gpu <mode>`. An emulator started this way runs on the
host network, so the host daemon can show it but won't link it to the sandbox; to use it
from sandbox builds, start it from the app (see [host-shell.md](host-shell.md#android-emulator)).

**`avd delete <name>`** removes the device (its data too); the system image stays.

Not available on Linux arm64 and Windows arm64 (Google publishes no emulator there).

### pair

```bash
tesseract pair            # link + QR code in the terminal
tesseract pair --no-qr
tesseract pair --json     # {"link": "tesseract://pair?...", "url": ..., "name": ..., "local": ...}
```

Reads the link from the running sandbox (`docker exec <project>-sandbox-1
tesseract-controller pair --json`), else from the saved connection. Scan the QR code with the
phone app, or open the link on the phone. A `127.0.0.1` sandbox adds
`This address only works on this computer. Use Tailscale mode to pair a phone.` The link
contains the sandbox token: treat it like a password.

### sync

Copies a checkout on this computer to the sandbox and the sandbox's changes back. Same
behaviour as the former GTK companion's sync command ([sync-back.md](../architecture/sync-back.md)).
Run it **in the project directory**.

```bash
tesseract sync                    # = sync push: send this directory to the sandbox
tesseract sync push --confidential
tesseract sync status             # sandbox changes and sync-back snapshots
tesseract sync pull --dry-run     # what would change here
tesseract sync pull               # write the sandbox's changes here (snapshot first)
tesseract sync pull --force       # also overwrite files you edited here since the push
tesseract sync revert             # undo the last pull
tesseract sync revert --force
```

Flag forms, the same as the former GTK companion and the desktop app binary:
`tesseract --sync [--confidential]`, `--pull [--dry-run] [--force]`, `--revert [--force]`,
`--sync-status`. `--get` only runs inside the sandbox.

Gemini key for voice notes: `tesseract --gemini-key=KEY` saves it on the connected sandbox, the same
as Preferences → Speech-to-text in the desktop app or Settings in the phone app. There is no
`GEMINI_API_KEY` env var or `.env` entry for it.

- The first push links the directory to a project id derived from its name (`--confidential`:
  a pseudonym, and the real name stays on this computer). Later commands find the project
  by the directory.
- `pull` and `revert` refuse to overwrite files that changed on this computer since the
  push and exit `2`, listing them; `--force` overwrites. Every pull takes a snapshot first
  (`… · snapshot <id> — undo with tesseract --revert`).
- Which sandbox: the saved connection; else `TESSERACT_DESKTOP_URL` + `TESSERACT_TOKEN`; else
  the local sandbox found through Docker. When the app keeps the token in the system
  keychain, the CLI can't read it and uses Docker discovery; for a remote sandbox set
  `TESSERACT_DESKTOP_URL` and `TESSERACT_TOKEN`.
- Sync state lives in `~/.local/state/tesseract` (Windows `%LOCALAPPDATA%\Tesseract\state`).

### config

The app's `config.json` (shared with the GTK app on Linux). Writes are atomic, keep
unknown keys and the file stays readable only by you.

```bash
tesseract config path
tesseract config get                         # everything; the token is shown as …
tesseract config get appearance
tesseract config get token --reveal
tesseract config set appearance dark
tesseract config set zoom 1.25
tesseract config set androidSdkRoot /home/you/Android/Sdk
tesseract config set link 'tesseract://pair?url=...&token=...&name=...'
tesseract config unset sandboxImageRef
tesseract config set myKey '{"a":1}' --force # unknown key: value parsed as JSON when it is JSON
```

| Key | Value |
|---|---|
| `appearance` | `system`, `light` or `dark` |
| `zoom` | 0.67 to 2 |
| `sidebarWidth` | pixels, clamped to 200 to 420 |
| `host_shell_autostart` (alias `hostShellAutostart`) | `true`/`false` (also `1/0`, `yes/no`, `on/off`) |
| `sandboxAutostart` | `true`/`false`: when the app starts (also `--hidden`), start the stack Tesseract built if it is stopped ([onboarding.md](onboarding.md#done)) |
| `androidSdkRoot` | absolute path |
| `androidAvd` | default AVD name |
| `sandboxImageRef` | registry reference for `sandbox build --pull` and the wizard's **Download a prebuilt image** (env `TESSERACT_SANDBOX_IMAGE_REF` is the fallback) |
| `url` (alias `apiUrl`) | sandbox URL, `http(s)://…` |
| `name` | sandbox display name |
| `pairingUrl` | `http(s)://…` |
| `link` | a `tesseract://pair?…` link: sets `url`, `token`, `name` and `pairingUrl` at once; `unset link` forgets the connection |
| `token`, `tokenSealed` | read-only here (use `link`, `tesseract pair` or the app); `get` hides them unless `--reveal` |

Other keys need `--force`.

### server

Runs the sandbox stack and the host shell daemon on a machine without the desktop app, for
example a Mac that is the production sandbox host. Full walkthrough, including deploying
from a Linux machine with `bun run deploy:mac`: [mac-server.md](mac-server.md). Contract:
[blueprint §7.2](../architecture/00-blueprint.md#72-headless-server-tesseract-server-macos-and-linux).

```bash
tesseract server install --mode tailscale --hostname tesseract-sandbox \
  --tailnet-domain tail1234.ts.net          # TS_AUTHKEY and CLAUDE_CODE_OAUTH_TOKEN from the environment
tesseract server install --dry-run          # print what it would write and run
tesseract server status                     # stack, controller health, host shell service, tailscale serve
tesseract server pair                       # sandbox + host shell links and QR codes
tesseract server uninstall                  # stop the stack and remove the host shell service
tesseract server uninstall --volumes        # also delete the workspace and home volumes
```

| Option (`install`) | Meaning |
|---|---|
| `--mode` | `tailscale` (sidecar joins the tailnet, HTTPS via `tailscale serve`), `host-tailscale` or `local` |
| `--hostname`, `--tailnet-domain`, `--authkey` | sandbox tailnet name, `<tailnet>.ts.net`, auth key (first start only); env `TS_TAILNET_DOMAIN`, `TS_AUTHKEY` |
| `--image <ref>` / `--build [--with ...]` | pull a prebuilt image, or build one here with the given components |
| `--claude-token <tok>` | long-lived Claude token for the sandbox (`claude setup-token`); env `CLAUDE_CODE_OAUTH_TOKEN` |
| `--no-host-shell` | skip the host shell service |
| `--host-https-port` | HTTPS port `tailscale serve` uses for the host shell (default `8443`) |

The host shell service is a LaunchAgent (`~/Library/LaunchAgents/dev.tesseract.host-shell.plist`,
logs in `~/Library/Logs/Tesseract/`) on macOS and the systemd user unit
`tesseract-host-shell.service` on Linux. Set its PIN once with `tesseract-controller host pin`.

### version

```bash
tesseract version         # tesseract 0.1.0
tesseract --version
tesseract version --json  # {"name": "tesseract", "version": "0.1.0", "platform": "linux", "arch": "x64"}
```

The version is the desktop app's version.

## Files and environment

The CLI finds the sandbox build context (the `infra/compose` files and the Dockerfile) in
this order: `TESSERACT_SANDBOX_CONTEXT`; `resources/sandbox` of the installed app the binary
belongs to (symlinks are followed); for the AppImage copy, the `sandboxDir` in
`~/.local/share/tesseract/app.json` (`~/.local/share/tesseract/sandbox`, kept up to date by
the app); the repository the CLI source runs from; the current
directory and its parents (a repository checkout). Without one, `sandbox` commands fail
with `Could not find the sandbox build files (infra/compose)…`.

| Variable | Effect |
|---|---|
| `TESSERACT_DESKTOP_CONFIG` | path of `config.json` |
| `TESSERACT_USER_DATA` | app data directory (env file, downloads, Android cache) |
| `TESSERACT_STATE_DIR` | sync state directory |
| `TESSERACT_SANDBOX_CONTEXT` | sandbox build context directory |
| `TESSERACT_APP_PATH` | the app executable for `tesseract open` (the AppImage copy also uses `appPath` from `~/.local/share/tesseract/app.json`) |
| `TESSERACT_SANDBOX_IMAGE_REF` | image to pull when `sandboxImageRef` isn't set |
| `TESSERACT_DESKTOP_URL`, `TESSERACT_TOKEN`, `TESSERACT_DESKTOP_NAME`, `TESSERACT_DESKTOP_PAIRING_URL` | a sandbox connection that overrides `config.json` |
| `TESSERACT_ANDROID_SDK_ROOT`, `ANDROID_SDK_ROOT`, `ANDROID_HOME` | existing SDKs the app offers in the Android step |
| `ANDROID_AVD_HOME`, `ANDROID_USER_HOME` | where AVDs are written and listed |
| `TESSERACT_ANDROID_REPOSITORY_URL`, `TESSERACT_ANDROID_SYSIMG_URL` | mirrors for Google's `repository2-3.xml` and `sys-img2-3.xml`: the full `.xml` URL, or a base URL the file name is appended to; `http`/`https` only |
| `NO_COLOR` | plain QR code without ANSI colours |

## Troubleshooting

**`tesseract: command not found`**
→ Not installed on `PATH`. → See [Install](#install); on Windows open a new terminal; with
the AppImage add `~/.local/bin` to `PATH`.

**`Could not find the sandbox build files (infra/compose)…`**
→ The binary isn't inside an installed app and you aren't in a repository checkout; for
the AppImage copy in `~/.local/share/tesseract/bin`, the app hasn't written
`~/.local/share/tesseract/app.json` and `~/.local/share/tesseract/sandbox` yet. → With the
AppImage, open the app once (or install the command again from Settings › About). Otherwise
set `TESSERACT_SANDBOX_CONTEXT` to the app's `resources/sandbox`, or run it from a checkout.

**`No sandbox is configured on this computer yet`**
→ No env file yet. → `tesseract sandbox build`, or the setup wizard.

**`These packages need license acceptance: android-sdk-license`**
→ Expected the first time. → Read the license printed above it and add `--accept-licenses`.

**`unknown package or API level: 37`**
→ No stable Google APIs image for that API level and this CPU. → `tesseract android images
--all` lists what exists.

**`The emulator is not installed in <sdk>; run tesseract android install emulator`**
→ The AVD exists but the SDK has no emulator (another SDK). → Install it, or pass `--sdk`.

**`tesseract: the app keeps the sandbox token in the system keychain, which this command cannot read…`**
→ `sync` against a remote sandbox. → Set `TESSERACT_DESKTOP_URL` and `TESSERACT_TOKEN`.

**`tesseract --get runs inside the sandbox …`**
→ `--get` is the in-sandbox direction: run `tesseract --get` in a terminal inside the sandbox. → On this computer use `tesseract --sync`.
