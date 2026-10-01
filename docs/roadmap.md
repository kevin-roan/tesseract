# Roadmap

The MVP covers pairing, status, projects (create and clone from the phone),
processes, terminals (shell and Claude), builds with artifacts, the display
through VNC, and headless Claude runs, with unit, infra and end-to-end test
suites. Several stacks can already run side by side on one host
(`THEONE_COMPOSE_PROJECT`, `--env-file`). The items below build on it, roughly
in priority order within each group. Each item names what has to change.
Decisions that need the owner's call come first.

## Open decisions

| Decision | Options and trade-off | Current state |
|---|---|---|
| Cleartext HTTP in release builds | `local` and `host-tailscale` modes serve plain HTTP (WireGuard-encrypted in the latter). Allow it in release builds (`usesCleartextTraffic` / an ATS exception, ideally limited to tailnet IPs and `*.ts.net`) or require HTTPS (tailscale mode, or `tailscale serve` on the host) | `app.json` configures neither; verified with development builds only |
| Portrait lock vs landscape VNC | Keep `orientation: portrait` (current layout) or unlock rotation for the display screen only (per-screen orientation lock) so the 1600×900 desktop can be viewed in landscape | locked to portrait; docs recommend zoom or a smaller geometry |
| Per-build signing secrets | `POST /v1/builds` takes no environment, so signed releases (Windows `CSC_*`, Android keystore passwords) are built by hand. Options: a `secretsRef` naming a file under `/home/dev/.secrets/<project>/` that the controller loads into the build env, or a per-project build env file | not supported by the build API |
| Tailscale sidecar capabilities | Add `cap_drop: [ALL]` (plus what userspace tailscaled actually needs) to the sidecar | sidecar has `no-new-privileges` only; `cap_drop` untested |
| Pinning `NODE_VERSION` and `CLAUDE_CODE_VERSION` (and base image digests) | Pin by default for reproducible images and a smaller supply-chain window, with a documented bump procedure; or keep "newest 24.x" / `latest` for freshness | unpinned by default; Node verified only against `SHASUMS256.txt` from the same origin |
| Controller under its own uid | Separate the controller (token, database) from the `dev` workload so executed project code cannot read the token; conflicts with the `api` CLI (would need a socket with peer credentials) and with file ownership | same user; env scrubbing only prevents accidental leaks ([security model](architecture/security-model.md#same-user-limit)) |
| Orphans after a controller crash | Kill the process groups of rows found `running` at startup (pids/pgids are recorded) instead of only marking them `orphaned` | marked only; they keep running untracked |
| Scoped tickets | `POST /v1/auth/ticket { scope }` binding a ticket to one socket or download (protocol change) | tickets open any socket or download for 60 s |
| Web build tab bar | Fix `apps/mobile/src/components/app-tabs.web.tsx` (user-owned) as described in [mobile-app](architecture/mobile-app.md#web-build) | every tab route blank on web; native unaffected |


## Near term

### Push notifications on build and run completion
- **Why:** builds and Claude runs take minutes, and the user should not have to keep the app open.
- **How:** the app registers an Expo push token (`expo-notifications`, already
  a dependency) with the controller (`POST /v1/devices`). The controller
  sends a push through Expo's push service on `build.updated` to a final
  state, on `agent.updated` to a final state, and on status `blocked`/`failed`.
- **Constraints:** the sandbox needs outbound HTTPS to `exp.host`. Payloads
  carry ids and short text only, never logs or secrets.

### Installing artifacts on the device
- **Android:** download the APK with a ticket URL, then hand it to the package
  installer (`expo-intent-launcher` / `ACTION_VIEW` with a content URI). The
  user must allow "install unknown apps" for TheOne.
- **iOS:** not possible for arbitrary IPAs. It needs ad hoc or TestFlight
  distribution, which depends on the remote Mac item below.
- **Protocol:** none. The download endpoint already exists.

### Reaching dev servers from the phone
- Proxy selected sandbox ports through the controller
  (`/v1/processes/:id/proxy/*`, with auth by ticket or cookie scoped to that
  path), or add them to the serve config dynamically. Allows opening a Vite
  or Expo dev server in the phone browser or Expo Go without VNC.

### Audit log
- Append-only `audit` table in `state.db`: timestamp, client (token id or
  ticket), method, path, target ids, result. Shown in the app, exported by
  `theone-controller audit`. Prerequisite for multiple tokens.

### Multiple tokens and scopes
- Per-device tokens created at pairing, which can be listed and revoked
  individually, with optional read-only scope (status, logs, display
  view-only). Replaces "rotate = re-pair everything".

### CI
- The suites exist (`bun run test`, `bun run test:infra`, `bun run e2e`; see
  [e2e-testing](runbooks/e2e-testing.md)); no CI workflow runs them yet. A
  workflow would run the first two on every change and `bun run e2e` (with
  `WITH_ANDROID=false` exported for speed) on image or controller changes,
  uploading the harness logs. The Tailscale path is covered only by config
  rendering (`compose.bats`), not by a live tailnet.
- The opt-in Android e2e test (`THEONE_E2E_ANDROID=1`) has not been run by the
  harness yet (a manual run built the APK in about 15 minutes).

## Medium term

### Multiple sandboxes per host
- **Why:** separate machines per client or project, and different images (with or without Android).
- **Done:** `THEONE_COMPOSE_PROJECT`, `THEONE_VOLUME_PREFIX`, `THEONE_IMAGE`, host
  ports and `--env-file` let stacks run side by side
  ([operations](runbooks/operations.md#run-more-than-one-stack)); the app
  supports several paired sandboxes with one active.
- **Next:** a `--name` shortcut in the operator CLI that derives project,
  hostname and ports, and a listing of the stacks on a host.
- **Open question:** a shared read-only cache volume (npm, Gradle, Electron
  downloads) across sandboxes, to save disk.

### Per-project containers
- **Why:** isolation between projects (separate filesystem, resources and
  secrets) and per-project images.
- **How:** the sandbox becomes a "hub" whose controller starts one
  container per project through a rootless or Sysbox-backed runtime. The
  display stays shared, or each project gets its own Xvnc. Needs a container
  runtime that does not require a privileged dind (see
  [ADR 0006](adr/0006-optional-docker-in-docker.md) alternatives).

### Egress policy
- An optional egress proxy or allow-list (registries, GitHub, Anthropic,
  Expo), to limit exfiltration from prompt-injected runs, plus host
  `DOCKER-USER` rules so the sandbox cannot reach host services, the LAN or
  cloud metadata endpoints.

### Hardening follow-ups
- Content-Security-Policy, `X-Content-Type-Options` and `frame-ancestors` on the
  `/ui` pages; stop delegating `clipboard-read` to the frame in the web build.
- A confirmation step for QR pairing and for `theone://sandbox/terminal/new` links.
- Token rotation without a controller restart.

### Claude run UX
- Tool-use approvals from the phone: a permission mode that pauses and pushes
  a question instead of bypassing, answered from the app.
- Attach files or screenshots to prompts. A diff view of changes made by a run.

## Longer term

### iOS builds via a remote Mac
- A Mac on the same tailnet runs a small "builder agent" (the same
  controller binary built for `bun-darwin-arm64`, restricted to build
  recipes). The sandbox pushes a source bundle or git ref, and the Mac runs
  `xcodebuild`/`eas build --local`, signs with keys that stay on the Mac, and
  returns the IPA/DMG as an artifact.
- The same path gives macOS Electron builds with signing and notarization.

### Emulator and device access
- An Android emulator needs KVM (`/dev/kvm`) in the container: a host change
  and a hardening trade-off. The alternative is `adb` over the tailnet to the
  user's own device (`adb connect <phone>:5555` with wireless debugging) and
  scrcpy on the display. That needs an outbound tailnet path from the
  sandbox, which userspace Tailscale does not provide today (for example the
  sidecar's SOCKS5 proxy), plus an ACL grant from `tag:theone` to the device.

### Observability
- Metrics endpoint (build durations, queue depth, resource use), and
  structured controller logs shipped to a file the app can browse.

## Explicitly not planned

- Public (non-tailnet) exposure of the controller.
- Mounting the host Docker socket.
- Running development workloads on the host.
