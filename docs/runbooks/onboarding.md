# Set up Monolith on your computer

Monolith runs Claude Code and your builds in a Docker sandbox on this computer, and lets
you follow them from your phone. The first time you open it, a setup wizard (like
Android Studio's) takes the computer from nothing to a running sandbox, an optional
Android emulator and a paired phone. Plan for about an hour; most of it is the first
image build, which runs on its own.

Developers building the app itself: [electron-desktop.md](electron-desktop.md). The same
steps from a terminal: [monolith-cli.md](monolith-cli.md).

## What you need

| | Minimum | Comfortable |
|---|---|---|
| Disk | about 40 GB free (image, build cache, Android system image) | more if you keep many projects |
| Memory | 8 GB (the sandbox needs at least 4 GB of it) | 16 GB or more |
| CPU | 2 cores with virtualization (VT-x / AMD-V / Apple silicon) | 4+ cores |
| Network | the build downloads Debian packages, Node, Wine, the Android SDK and more | — |
| OS | macOS 14+ (for Docker Desktop), Windows 10 22H2 (build 19045) / Windows 11 23H2 (build 22631), any Linux with systemd | — |

The Android emulator runs on Linux x64, macOS (Apple silicon and Intel) and Windows x64.
Google doesn't publish it for Linux on ARM or Windows on ARM; there the Android step is
skipped and everything else works.

## 1. Install Monolith

| OS | File | How |
|---|---|---|
| macOS | `Monolith-<version>-universal.dmg` | open it, drag **Monolith** to **Applications**, start it from there |
| Windows | `Monolith-<version>-x64.exe` | run it; it installs for your user only (no admin prompt) and starts Monolith |
| Debian / Ubuntu | `Monolith-<version>-amd64.deb` | `sudo apt install ./Monolith-<version>-amd64.deb` |
| Other Linux | `Monolith-<version>-x86_64.AppImage` | `chmod +x Monolith-*.AppImage` and run it (AppImages need FUSE 2, e.g. `libfuse2`) |

Every installer also ships the `monolith` command; see
[monolith-cli.md](monolith-cli.md#install) for how it lands on your `PATH`.

## 2. The setup wizard

The wizard opens instead of the main window on first run. It does **not** open when setup
was finished before, or when a sandbox connection is already saved (on Linux the settings
file is shared with the GTK desktop app, so its connection counts) or set through
`MONOLITH_DESKTOP_URL` + `THEONE_TOKEN`. If a sandbox already runs on this computer
(e.g. from the repository's `bun run sandbox up`) but no connection is saved, the app
looks for it through Docker first (for up to 2.5 seconds): when its controller answers,
the app saves it as the connection, marks setup as done and opens the main window
without the wizard. If that lookup finds nothing in time, the wizard opens, and its
Sandbox step can still find the sandbox and offer **Use it**. `MONOLITH_DISABLE_DISCOVERY=1`
turns the lookup off (the tests set it). The step rail on the left shows where you are;
each step can be revisited. Setup remembers the current step, so after a log-out or a
restart it continues where you left off.

To run it again later: **Settings › Connection › Set up Monolith…**, **Settings › Sandbox ›
Set up…** (or **Open setup** when Docker needs attention), the command palette
(`Ctrl+K` / `⌘K`, "Run the setup wizard"), or the link `monolith://setup` (also
`monolith://onboarding/<step>`).

### Welcome

Lists what will happen and checks the computer: free disk space in your home folder
(warning under 40 GB), memory (warning under 12 GB) and processor (warning when the
Android emulator isn't available for it). Warnings don't block. Click **Get started**.

### Docker

The sandbox is a Docker container, so Monolith needs a running Docker engine with
Compose 2.24+ and BuildKit (buildx). The checks run one after another; the refresh button
(**Check again**) runs them again.

| Check | Must pass | What it looks at |
|---|---|---|
| Docker | yes | the `docker` command: Docker Engine, Docker Desktop, rootless Docker, Colima or OrbStack |
| Engine | yes | the engine answers `docker version` (running, stopped, no permission, not answering) |
| Docker Compose | yes | 2.24.0 or newer |
| BuildKit | yes | `docker buildx` is installed |
| Resources | yes | at least 2 CPUs and 4 GB for containers; warning under 8 GB |
| Engine version | warning | 24.0 or newer |
| docker group (Linux) | warning | your user is in the `docker` group |
| Rootless mode (Linux) | warning | rootless Docker can't share `~/.claude` with the sandbox |
| WSL 2 (Windows) | yes | WSL 2.1.5 or newer |
| Virtualization (Windows) | yes | virtualization is on in the BIOS/UEFI |
| Podman | refused | Podman isn't supported: the sandbox needs Compose 2.24+ features and BuildKit cache mounts |

Before probing, Monolith adds the usual Docker locations to its own `PATH`
(`/usr/local/bin`, `/opt/homebrew/bin`, `~/.docker/bin`, Docker.app's `bin`, `~/.orbstack/bin`
on macOS; Docker Desktop's `resources\bin` on Windows; `/usr/bin`, `/usr/local/bin`,
`~/bin` on Linux), because apps started from Finder, the Start menu or a launcher get a
minimal `PATH`.

When something fails the row has an action:

- **Install…** opens the install panel (below).
- **Start** starts the engine and waits up to 120 s (180 s on Windows), showing
  `Starting the engine… {n}s`.
- **Fix…** (Linux, no access to the engine) offers **Add me to the docker group**.
- **How to update** / **How to install** open Docker's instructions for Compose and buildx.
- **Install WSL…** / **Update WSL** (Windows).

Being in the `docker` group (Linux) or `docker-users` (Windows) gives root-level /
administrator-level control of the computer. That is how Docker works, not something
Monolith adds.

#### macOS

Options: **Docker Desktop (recommended)** or **I'll install it myself** (opens Docker's
instructions).

1. Tick **I accept the Docker Subscription Service Agreement** (**Read the agreement** opens it).
2. **Install** downloads `Docker.dmg` for your Mac (Apple silicon or Intel; an Intel build
   of Monolith running under Rosetta still gets the Apple-silicon DMG), with resume and a
   sha256 check against Docker's published checksums.
3. macOS asks once for an administrator password. Monolith mounts the DMG, runs Docker's
   installer for your user with `--accept-license`, and unmounts it.
4. It starts Docker Desktop (`open -a Docker`) and waits for the engine.

Docker Desktop needs macOS 14 or newer; older versions get `Docker Desktop needs macOS
{version} or newer`. Colima and OrbStack are detected and started with `colima start` /
`orb start`.

#### Windows

Options: **Docker Desktop (recommended)** (all users, asks for admin), **Docker Desktop
for my user only** (no admin), **I'll install it myself**.

1. Tick the Docker Subscription Service Agreement.
2. **Install**: if WSL is missing, Monolith installs it first (`wsl --install
   --no-distribution`, UAC prompt).
3. It downloads `Docker Desktop Installer.exe` (x64 or ARM), checks it against Docker's
   checksums when they are published, and runs `install --quiet --accept-license
   --backend=wsl-2` (all users: also `--always-run-service`, through a UAC prompt; per
   user: `--user`).
4. Monolith starts Docker Desktop and waits for the engine. When WSL was just installed or
   the installer asks for a restart (exit code 3010), you get **Restart to finish** instead:
   restart Windows and open Monolith again; setup continues at the Docker step.

If you installed for all users with another administrator account, add your own user to
`docker-users` in an admin terminal: `net localgroup docker-users <you> /add`, then sign
out and in.

Windows 10 before 22H2 (build 19045) and Windows 11 before 23H2 (build 22631) are blocked
with a message. Hardware virtualization must be on in the BIOS/UEFI; Monolith can't
change that (**Learn more** opens Docker's page).

#### Linux

Options: **Docker Engine (recommended)** (`Installs Docker's packages for <your distro>
with your password`), **Docker Desktop for Linux** (opens Docker's instructions),
**I'll install it myself**.

**Docker Engine** asks for your password once through polkit (`pkexec`) and runs:

| Distro (`ID` / `ID_LIKE`) | Install |
|---|---|
| Ubuntu, Debian, Raspbian, Fedora, CentOS, RHEL | Docker's convenience script from `https://get.docker.com` (downloaded first; its sha256 is in the log) |
| Arch | `pacman -S --needed --noconfirm docker docker-compose docker-buildx` |
| openSUSE / SLES | `zypper --non-interactive install docker docker-compose docker-buildx` |

followed by `systemctl enable --now docker.service` and `usermod -aG docker <you>`.
Other distros, or no `pkexec`, or no polkit agent: the panel shows the same commands to
run in a terminal instead.

After you are added to the `docker` group your current session doesn't have it yet:
**Log out to finish** asks you to log out and back in (or restart) and open Monolith
again. **Quit Monolith** closes it for you.

Starting the engine: `pkexec systemctl start docker.service` (Docker Engine),
`systemctl --user start docker.service` (rootless), `systemctl --user start docker-desktop`
(Docker Desktop for Linux).

### Claude Code

The sandbox uses this computer's Claude Code login: your `~/.claude` folder is shared
with the container (mounted, never copied). The step shows the login, account, plan,
access-token expiry and settings of the first account (and how many more there are).

- **Signed in**: nothing to do.
- **Claude Code isn't set up on this computer**: Monolith creates an empty `~/.claude`
  (mode 0700) so the sandbox can start. Install Claude Code (**Open install guide**), run
  `claude` once and sign in, then **Check again**. You can also sign in later from a
  sandbox terminal.
- **Signed in through the macOS keychain**: the sandbox can't read the keychain. After the
  build, open a sandbox terminal and run `claude` once; the login is then saved in
  `~/.claude` for both.

### Sandbox (and build)

Pick how phones reach the sandbox, which tools go into the image and how much of the
computer it may use. **You can rebuild with other choices later** (Settings › Sandbox).

If a sandbox already exists on this computer, a notice offers **Use it** (running) or
**Start and use it** (stopped), which skips the build. A stopped sandbox is started with
its own compose files (the `com.docker.compose.project.config_files` label), so the action
is hidden when those files are gone. Monolith then waits up to 3 minutes for
`theone-controller pair --json` inside the container to answer, saves the connection and
marks the Sandbox and Build steps done. An image without a container shows
up as **Use the existing image**.

**Image**

- **Build a new image** (default): builds from the files bundled with Monolith. The first
  build takes 20 to 60 minutes; later builds reuse the cache.
- **Download a prebuilt image**: only when an image reference is configured (see
  [monolith-cli.md](monolith-cli.md#config) `sandboxImageRef`); otherwise it reads
  `No prebuilt image is published yet.` A prebuilt image always includes every tool.
- **Use the existing image**: when the image is already there.

**Reachability**

| Choice | Effect | You enter |
|---|---|---|
| **This computer only** (default) | the controller listens on `127.0.0.1:7700`; phones can't reach it. Good for trying Monolith | — |
| **Tailscale (sidecar)** | a Tailscale container joins your tailnet as `theone-sandbox`; phones connect over HTTPS | **Auth key** (`tskey-auth-…`, used once for the first login and then removed from the env file), **Tailnet domain** (e.g. `tail1234.ts.net`), **Hostname**. **How to create an auth key** opens Tailscale's admin page. See [tailscale-https-setup.md](tailscale-https-setup.md) |
| **This computer's Tailscale** | the ports are published on this computer's Tailscale IPv4 | **Bind address** (filled from `tailscale ip -4`). Disabled when Tailscale isn't running. Best on Linux |

**Tools in the image** (Dockerfile build arguments)

| Tool | Build arg | Size |
|---|---|---|
| Base desktop: Debian, Node 24, Bun, Chromium, Xvnc, ffmpeg, Wine, Claude Code | always included | ≈ 4.7 GB |
| Android SDK: JDK 17, platform-tools, android-36, build-tools 36.0.0 | `WITH_ANDROID` | +0.7 GB |
| Flutter 3.47.5 with web and Linux artifacts | `WITH_FLUTTER` (+ `FLUTTER_VERSION`) | +1.4 GB |
| Mono (Squirrel.Windows installers for Electron apps) | `WITH_MONO` | +0.4 GB |
| Whisper (local speech-to-text for voice notes), models `base`, `small`, `medium`, `large-v3-turbo` | `WITH_WHISPER` (+ `WHISPER_MODELS`) | +0.6 GB |

Everything is on by default, with Whisper models `base` and `small`. At least one model
must stay selected; the first one is the default model. Chromium and Wine are part of the
base image and can't be turned off.

**Resources**: **CPUs** (default 4, at most what Docker has), **Memory** (default 8 GB or
75 % of Docker's memory, whichever is smaller; at least 2 GB), **Time zone** (this
computer's). The **Disk space** row shows what the build needs (15 GB plus twice the
image size, rounded up to 5 GB, about 40 GB with every tool) against what is free. With
Docker Desktop the images live in Docker's own disk, so check its size in Docker Desktop ›
Settings › Resources.

**Advanced**: compose project (`theone`), image (`theone/sandbox:latest`), controller port
(`7700`), VNC port (`5901`), Claude Code version (`latest`), Flutter version, shared Claude
folder (default `~/.claude`), and **Docker-in-Docker** (adds a privileged `docker:dind`
container; read [security-model.md](../architecture/security-model.md) first). The
defaults are the same as the repository's `infra/compose/.env.example`, so a stack you
started with `bun run sandbox up` and the one Monolith manages are the same project.

**Build** writes the settings to `<app data>/sandbox/.env` (readable only by you) and runs:

1. **Build image**: `docker buildx build` of the bundled Dockerfile with your choices. The
   bar follows the Dockerfile steps (`{done} of {total} steps · {n} cached`), the line under
   it shows the current step. **Show details** opens the log.
2. **Start containers**: `docker compose up --detach`.
3. **Controller healthy**: waits up to 3 minutes for `/v1/health`.
4. **Pairing link**: reads it from the controller and saves the connection.

**Cancel** stops the build; finished steps stay cached, so **Build** again continues
quickly. On failure the log opens and **Retry** runs it again.

### Android emulator (optional)

Downloads the Android emulator, platform tools and a system image, and creates a virtual
device (AVD), like Android Studio's SDK and device managers. No Android Studio, Java,
`sdkmanager` or `avdmanager` is needed. About 2.5 GB. **Skip** if you don't build
Android apps.

**Hardware acceleration** is checked first:

| OS | Accelerator | Checks and fixes |
|---|---|---|
| Linux x64 | KVM | `/dev/kvm` exists (else turn on VT-x / AMD-V in the BIOS/UEFI and `sudo modprobe kvm_intel` or `kvm_amd`); you can open it (else `sudo usermod -aG kvm $USER`, then log out and in); **Network isolation**: unprivileged user namespaces work (else `sudo sysctl -w kernel.unprivileged_userns_clone=1`, and on Ubuntu 24.04+ `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`) |
| macOS | Hypervisor.framework | `sysctl kern.hv_support` is `1` |
| Windows x64 | Windows Hypervisor Platform (WHPX) | the feature is installed; else run in an admin terminal `dism.exe /online /enable-feature /featurename:HypervisorPlatform /all /norestart` and restart |

After the emulator is installed, Monolith also runs `emulator -accel-check` and shows its
message with a hint. **Learn more** opens Google's acceleration guide.

**SDK location**: reuse an SDK that already has the emulator (from
`THEONE_ANDROID_SDK_ROOT`, `ANDROID_SDK_ROOT`, `ANDROID_HOME` or Android Studio's default
folder), or **Install a new SDK for Monolith**:

| OS | Monolith's SDK |
|---|---|
| Linux | `~/.local/share/theone/android-sdk` (the host daemon finds it without configuration) |
| macOS | `~/Library/Application Support/Monolith/android-sdk` |
| Windows | `%LOCALAPPDATA%\Monolith\android-sdk` |

**SDK packages**: Google's package list (stable channel) for your CPU. The emulator and
platform tools are always included; pick one or more Google APIs system images (newest
first; Android 16 / API 36, the sandbox's platform, is preselected; **Show all** for older
ones). Arm Macs get `arm64-v8a` images, everything else `x86_64`.

**Virtual device**: name (default `Monolith_API_36`; letters, digits, `.`, `-`, `_`),
**Device profile** (Pixel 5 · 1080 × 2340 · 440 dpi by default; also Pixel 8 and Medium
Phone, both 1080 × 2400 · 420 dpi, and Pixel Tablet · 2560 × 1600 · 320 dpi), memory
(2048 MB, or 4096 MB on computers with 12 GB or more; 1024 to 8192), CPU cores (half the
cores, 2 to 4) and **Internal storage** (6 GB; 2 to 64 GB, the data partition). The
device is written with that screen, size and storage, and no SD card, camera or audio.

**Download** shows the total download and the disk it will take; it needs three times the
download size free in the SDK folder.

**Install** first asks you to read and accept each Android SDK license, then downloads,
checks (size and sha1), and unpacks every package, runs the acceleration check and writes
the AVD. **Cancel** keeps partial downloads; **Install** resumes them. While an install
runs, a second **Install** is refused ("An installation is already running"), so it can't
mark the first one failed. When the SDK already has everything, the button reads
**Use {avd}**: nothing is downloaded, Monolith saves the SDK folder and the AVD
(`androidSdkRoot`, `androidAvd` in `config.json`), restarts the host daemon only if Monolith
started it and its Android env changed, and runs the acceleration check.

When it is done: `{avd} is ready · Android {version} · {abi}`. On macOS and Windows the
emulator runs without network isolation, so Monolith won't connect it to the sandbox
automatically; you can still run it on this computer. On Linux the host shell daemon runs
it isolated and can link it to the sandbox ([host-shell.md](host-shell.md#android-emulator)).

Devices are managed later in **Settings › Android** (start, stop, delete, create).

### Phone (optional)

Install the TheOne app and Tailscale on your phone, then scan the QR code in the app
(**Agents › Pair a sandbox**), or copy the link. With **This computer only** the phone can't
reach the sandbox: **Change reachability** takes you back to the Sandbox step. More:
[pairing-mobile.md](pairing-mobile.md).

### Done

A summary of every step. **Open Monolith** closes the wizard and opens the main window;
setup isn't shown again. Everything can be changed later in Settings. The sandbox
containers use Docker's `unless-stopped` restart policy, so they come back with Docker
after a reboot unless you stopped them (Settings › Sandbox › **Stop** / **Start**).

**Start the sandbox when Monolith opens** (on by default, `sandboxAutostart`): each time
the app starts, also with `--hidden` in the tray, it runs `docker compose up -d` for the
sandbox that Monolith built (its own env file, the same compose project, and a finished
build). It does nothing when the switch is off, when the sandbox already runs, or for a
stack Monolith didn't create (e.g. `bun run sandbox up` from the repository). If Docker
isn't reachable, you get one notification ("Docker isn't running") that opens
Settings › Sandbox.

## Where things are

| What | Where |
|---|---|
| Settings file | Linux `~/.config/monolith-desktop/config.json`, macOS `~/Library/Application Support/Monolith/config.json`, Windows `%APPDATA%\Monolith\config.json` |
| Sandbox settings | `<app data>/sandbox/.env`; app data is `~/.config/Monolith`, `~/Library/Application Support/Monolith` or `%APPDATA%\Monolith` |
| Docker installer downloads | `<app data>/downloads/` |
| Android SDK and AVDs | the SDK folder above; AVDs in `~/.android/avd` (or `ANDROID_AVD_HOME`) |
| Logs of a step | **Show details** in the step (last 200 lines, secrets removed); **Copy log** |

Settings › About shows the settings file and app data folder (**Show in folder**).

## Troubleshooting

Format: **symptom** → cause → fix. `monolith doctor` runs the same Docker, image,
acceleration and SDK checks from a terminal.

**Docker: `Docker isn't installed`, but it is**
→ Monolith doesn't find `docker` on its `PATH` (installed somewhere unusual). → Make sure
`docker` is in one of the folders listed in the Docker step, or start Monolith from a
terminal where `docker version` works.

**Docker: `You don't have access to the Docker engine` (Linux)**
→ Your user isn't in the `docker` group, or was added in this session. → **Fix… › Add me to
the docker group**, or `sudo usermod -aG docker $USER`; then log out and back in.

**Docker: `The engine didn't start within 120 seconds`**
→ Docker Desktop is still starting (first start after install can be slow), or it failed.
→ Wait and **Check again**; open Docker Desktop to see its error; **Show details** has the
output of the start command.

**Docker: `Installation cancelled`**
→ You dismissed the password / UAC prompt. → **Install** again.

**Docker: `pkexec isn't available` / `No password prompt is available`**
→ No polkit agent in this session (e.g. a minimal window manager or SSH). → Run the commands
shown in the panel in a terminal, then **Check again**.

**Docker: `Docker Compose 2.x is too old`**
→ Distribution packages are often behind. → Install Docker's own packages
(**How to update**), or Docker Desktop.

**Docker: `Podman isn't supported yet`**
→ The `docker` command is the podman-docker shim. → Install Docker Engine or Docker
Desktop.

**Docker: `The engine has 2 CPUs and 2 GB of memory`**
→ Docker Desktop's VM is too small. → Docker Desktop › Settings › Resources: give it at
least 4 GB (8 GB is better).

**Docker (Windows): `WSL 2 isn't installed` / `Hardware virtualization is off`**
→ WSL is missing, or virtualization is off in the firmware. → **Install WSL…** and restart;
turn on Intel VT-x / AMD SVM in the BIOS/UEFI.

**Docker (rootless): `Claude Code inside the sandbox may not be signed in`**
→ With rootless Docker the shared `~/.claude` is owned by another user id inside the
container. → Use rootful Docker, or sign in again from a sandbox terminal.

**Build: `Only {n} GB free on {path}; the build needs about {m} GB.`**
→ Not enough disk. → Free space, or turn off tools you don't need (Android SDK and Flutter
are the largest), then **Retry**.

**Build: `The Claude folder … doesn't exist yet`**
→ The Claude step was skipped. → Go back to Claude Code; entering the step creates the
folder.

**Build fails in a step (`<stage step>: <error>`)**
→ Usually a network error while downloading packages. → **Retry**; finished steps are
cached. **Show details** shows the failing step's last lines. See also
[troubleshooting.md](troubleshooting.md#stack-and-image).

**Build: `The controller didn't answer within 3 minutes` / `The sandbox container exited`**
→ The container started but the controller didn't come up. → **Show details** has the last
50 container log lines; `monolith sandbox logs` shows more.

**Sandbox: `TS_AUTHKEY is required for the first start in tailscale mode`**
→ Tailscale mode needs an auth key until the sidecar has logged in once. → Create a key
(**How to create an auth key**) and paste it.

**Sandbox: `THEONE_BIND_ADDR=… would publish the sandbox on every host interface`**
→ A wildcard bind address. → Use this computer's Tailscale IPv4 (`tailscale ip -4`).

**Sandbox: a port is already in use**
→ Another stack (or another program) uses 7700 or 5901. → Change **Controller port** /
**VNC port** under **Advanced**, or the compose project if it's another sandbox.

**Android: `KVM isn't available` / `You can't use /dev/kvm yet`**
→ Virtualization is off, the module isn't loaded, or you aren't in the `kvm` group. → Turn
on VT-x / AMD-V, `sudo modprobe kvm_intel` (or `kvm_amd`), `sudo usermod -aG kvm $USER`,
log out and in, **Check again**.

**Android: `Network isolation for the emulator isn't available`**
→ Unprivileged user namespaces are off. → Run the `sysctl` commands shown. Without them
the emulator still runs, but the sandbox won't use it ([host-shell.md](host-shell.md#troubleshooting)).

**Android: `Windows Hypervisor Platform is off`**
→ The WHPX feature isn't installed. → Run the `dism.exe` command in an admin terminal and
restart.

**Android: `Couldn't load Google's package list`**
→ No connection to `dl.google.com`, or a proxy blocks it. → Check the network and
**Retry**. To use a mirror, start the app with `MONOLITH_ANDROID_REPOSITORY_URL` and
`MONOLITH_ANDROID_SYSIMG_URL` set (the full `.xml` URL or its base URL; `http` or
`https` only).

**Android: `…: the download is corrupt (checksum mismatch)` / `the download stalled for 30 seconds`**
→ A broken or stalled download. → **Retry**; the broken part is deleted, a stalled one
resumes.

**Android: `This system image needs emulator {version} or newer`**
→ The chosen image needs a newer emulator than the stable channel offers. → Pick an older
system image.

**Android: `An AVD named … already exists`**
→ The name is taken in `~/.android/avd`. → Choose another name, or delete the old device in
Settings › Android.

**macOS: "Monolith can't be opened" / it asks to move to Applications**
→ The app isn't in `/Applications`, or the build isn't notarized. → Drag it to
Applications and open it from there (right-click › Open the first time for unsigned
builds).

**The wizard keeps opening at startup**
→ Setup was never finished (**Open Monolith** on the last step) and no sandbox connection
is saved. → Finish the wizard, or connect in Settings › Connection.
