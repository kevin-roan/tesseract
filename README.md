# TheOne

A development machine in a Docker container that you control from your phone.

TheOne runs a sandbox container on any Docker host. It has a virtual display
with VNC, wine, Node/Bun/Python, the Android SDK, Electron tooling and Claude
Code. An Expo app on your phone reaches it over Tailscale. From the phone you
can add and clone projects, run terminals and Claude, start builds (including
Windows Electron installers built through wine), download artifacts, and watch
or click through the running app on the sandbox display. The host only runs
Docker: nothing is installed on it and nothing is exposed to the internet.

```text
 phone (apps/mobile, Expo)
   │  HTTPS + WSS over Tailscale (WireGuard, tailnet only)
   ▼
 host: Docker only ─ compose project "theone" (default)
   ├─ tailscale   sidecar, userspace; serve :443 → controller, tcp :5901 → VNC
   ├─ sandbox     Debian trixie, shares the sidecar's network namespace
   │    supervisord (as dev) ─ Xvnc :1 (VNC 5901) · openbox · theone-controller :7700 · wine-init
   │    Claude Code · git · node 24 · bun · python · JDK 17 · Android SDK · wine · chromium
   │    volumes: theone-workspace → /workspace   theone-home → /home/dev
   └─ docker      optional dind sidecar (opt-in)
```

The controller is the only network-facing service. Every phone action
(status, projects, processes, terminals, builds, artifacts, the display,
Claude runs) goes through its token-authenticated REST and WebSocket API.

## Repository layout

```text
apps/mobile/          @theone/mobile      Expo SDK 56 / React Native 0.85 / expo-router app
apps/controller/      @theone/controller  Bun + Hono daemon that runs inside the sandbox
apps/electron/        @monolith/electron  Monolith desktop app (Electron): setup wizard, pages, `tesseract` CLI
apps/desktop/         Monolith GTK4/libadwaita app (Python), the design reference for apps/electron
packages/protocol/    @theone/protocol    zod schemas and types: the wire contract
packages/client/      @theone/client      typed REST/WS client (React Native, browser, Bun)
infra/docker/sandbox/ sandbox image (Dockerfile + rootfs)
infra/compose/        compose files, Tailscale serve config, .env.example
infra/scripts/sandbox operator CLI (bun run sandbox …)
infra/tests/          bats suites for the infra scripts (bun run test:infra)
infra/e2e/            end-to-end suite against a real local stack (bun run e2e)
examples/             electron-hello build fixture (not a workspace)
docs/                 architecture, ADRs, runbooks
SPEC.md               operating spec for Claude inside the sandbox
```

## Quick start

**Prerequisites**

- A Linux host with Docker Engine 24+ and Docker Compose 2.24+ (BuildKit enabled).
- [bun](https://bun.sh) 1.3+ on the machine you run the CLI from.
- A Tailscale account with **MagicDNS** and **HTTPS certificates** enabled
  (admin console → DNS), and an **auth key** (Settings → Keys, preferably
  tagged `tag:theone`, pre-approved).
- The Tailscale app on your phone, logged into the same tailnet.

**Start the sandbox**

```bash
cp infra/compose/.env.example infra/compose/.env
$EDITOR infra/compose/.env            # set TS_AUTHKEY and TS_TAILNET_DOMAIN; review SANDBOX_* limits
bun install
bun run sandbox up --build            # builds theone/sandbox (first build takes a while) and starts the stack
bun run sandbox status                # containers + controller status (the URL is printed by up)
bun run sandbox pair                  # prints the theone://pair link and a QR code
```

**Run the app.** `react-native-webview` and `expo-camera` contain native
code, so use a development build rather than Expo Go:

```bash
cd apps/mobile
bunx expo run:android                 # or: bunx expo run:ios (macOS), or an EAS development build
bun run mobile                        # from the repo root: starts Metro for the dev build
```

In the app: **Agents** tab → **Pair a sandbox** → scan the QR code. Step-by-step
details are in [docs/runbooks/getting-started.md](docs/runbooks/getting-started.md).

## Desktop app (Monolith)

`apps/electron` is the desktop companion for Linux, macOS and Windows. On first run a setup wizard (like
Android Studio's) checks or installs Docker, builds and starts the sandbox with the components you pick
(Android SDK, Flutter, Mono, Whisper), downloads the Android emulator, a system image and an AVD for the host
emulator (KVM, WHPX or HVF), and shows the pairing QR code for the phone. Afterwards it shows the same pages as
the phone (Overview, Agents, Projects, Files, Terminals, Display). Installers: universal `dmg`, per-user NSIS
`exe`, `AppImage` and `deb`; each puts the `tesseract` command on your PATH (`tesseract status`, `doctor`,
`sandbox up|down|build|logs|pair`, `android images|install|avd`, `sync`, `config`, `server`). For a headless Mac sandbox see [docs/runbooks/mac-server.md](docs/runbooks/mac-server.md).

```bash
bun run electron                      # dev mode; the renderer dev server is http://127.0.0.1:4545
bun run electron:dist                 # installers for this OS in apps/electron/dist/
bun run electron:e2e                  # Playwright suites (headless on Linux)
```

Details: [docs/electron/README.md](docs/electron/README.md) and
[blueprint §12](docs/architecture/00-blueprint.md#12-desktop-app-appselectron-package-monolithelectron).

## Common commands

| Command | What it does |
|---|---|
| `bun run sandbox up [--build]` | start the stack, rebuilding the image with `--build`. Also applies `.env` changes |
| `bun run sandbox down` | stop and remove the containers (volumes are kept; `down -v` **deletes them**) |
| `bun run sandbox restart [service]` | restart containers without re-reading `.env` |
| `bun run sandbox logs [service] [-f]` | last 200 lines per service, `-f` to follow |
| `bun run sandbox shell` | login shell as `dev` inside the sandbox |
| `bun run sandbox pair [--json]` | pairing link + QR code for the phone |
| `bun run sandbox status` | containers plus `theone-controller status` |
| `bun run sandbox doctor` | `theone-doctor` inside the running sandbox |
| `bun run sandbox build [--target <stage>]` | build the image only |
| `bun run sandbox ps` / `config` | containers / resolved compose configuration |
| `bun run sandbox up --mode local` | pick a mode for one call (`tailscale`, `host-tailscale`, `local`; default `THEONE_MODE` in `.env`) |
| `bun run sandbox up --dind` | add the privileged Docker-in-Docker sidecar (or `THEONE_DIND=1`) |
| `bun run sandbox --env-file <path> <cmd>` | use another env file, e.g. for a second stack ([operations](docs/runbooks/operations.md#run-more-than-one-stack)) |
| `bun run typecheck` / `bun run test` / `bun run lint` | across all workspaces |
| `bun run test:infra` | bats tests for the operator CLI, rootfs scripts and compose files (in docker) |
| `bun run e2e` | end-to-end suite against an isolated `theone-e2e` stack on loopback ([e2e-testing](docs/runbooks/e2e-testing.md)) |
| `bun run mobile` | Expo dev server for the app |
| `bun run electron` / `electron:build` / `electron:dist` | desktop app: dev mode (renderer on 4545), production build, installers |
| `bun run electron:e2e` / `electron:smoke` | desktop app Playwright suites / checks of the built AppImage and deb |
| `bun run controller:dev` | run the controller locally with watch mode |

## Documentation

- [docs/README.md](docs/README.md): index of all notes
- [Architecture overview](docs/architecture/overview.md) · [Blueprint (contract)](docs/architecture/00-blueprint.md) · [Protocol](docs/architecture/protocol.md)
- [Security model](docs/architecture/security-model.md) · [Networking and Tailscale](docs/architecture/networking-tailscale.md)
- Runbooks: [getting started](docs/runbooks/getting-started.md), [pairing](docs/runbooks/pairing-mobile.md), [Electron builds](docs/runbooks/electron-builds.md), [Android builds](docs/runbooks/android-builds.md), [Claude in the sandbox](docs/runbooks/claude-in-sandbox.md), [operations](docs/runbooks/operations.md), [testing](docs/runbooks/e2e-testing.md), [troubleshooting](docs/runbooks/troubleshooting.md)
- Desktop app: [docs/electron/README.md](docs/electron/README.md) (specs, reference captures, conventions)
- [SPEC.md](SPEC.md): how Claude behaves inside the sandbox
- [Roadmap and open decisions](docs/roadmap.md)

## Development

```bash
bun install
bun run typecheck && bun run test
bun run test:infra                    # needs docker
bun run e2e                           # needs docker and network; builds theone/sandbox:e2e
bun run e2e --electron                # also runs the desktop app's Playwright suites against that stack
THEONE_HOST=127.0.0.1 THEONE_WORKSPACE=/tmp/theone-ws bun run controller:dev
#   controller on http://127.0.0.1:7700; display, wine and claude are reported as unavailable.
#   The defaults (0.0.0.0, /workspace) are meant for the sandbox.
```

Conventions: [CODING.md](CODING.md) (no unnecessary comments, no constants in
UI files, reusable components, hooks) and [AGENTS.md](AGENTS.md). Changes to
names, ports, environment variables or the API go into
[the blueprint](docs/architecture/00-blueprint.md) together with the code.
Workspace details are in [docs/architecture/monorepo.md](docs/architecture/monorepo.md).

## Security in one paragraph

Nothing listens on host interfaces in the default mode. The phone reaches the
controller only through your tailnet, and every request needs the bearer
token, or a one-time ticket for WebSockets and downloads. Inside the sandbox,
Claude runs with `bypassPermissions` on purpose: the container (no
privileges, all capabilities dropped except a minimal set, no host mounts, no
Docker socket) is the boundary, and [SPEC.md](SPEC.md) governs behavior. The
token is equivalent to a shell in the sandbox, so treat it like one; the
in-sandbox agent never handles it and calls the API through
`theone-controller api`. Details:
[docs/architecture/security-model.md](docs/architecture/security-model.md).
