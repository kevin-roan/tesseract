# ADR 0003: One sandbox container with a Tailscale sidecar

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The development machine must be reachable from a phone anywhere, but it must
never be reachable from the internet and it must not modify the host. The
host already runs unrelated services and may or may not run Tailscale itself.
Builds need a display, VNC, wine, Android tooling and Claude Code, and these
interact: an Electron app built by Claude runs on the display that VNC shows.

## Decision

- A single long-lived **`sandbox`** container (compose project `theone`)
  holds the whole development environment, supervised by supervisord.
  Projects share it. Per-project containers are a roadmap item.
- A **`tailscale`** sidecar (official `tailscale/tailscale` image) runs in
  **userspace networking** mode (`TS_USERSPACE=true`: no `/dev/net/tun`, no
  `NET_ADMIN`). The sandbox joins the sidecar's network namespace
  (`network_mode: service:tailscale`).
- `tailscale serve` (config file `infra/compose/tailscale/serve.json`, mounted
  read-only) terminates HTTPS on 443 with a Let's Encrypt certificate for the
  MagicDNS name and proxies to `127.0.0.1:7700`. It forwards TCP 5901 to Xvnc
  for native VNC clients. Funnel stays off.
- Default mode publishes **no host ports**. `host-tailscale` mode (ports
  bound on the host's existing tailnet IP) and `local` mode (127.0.0.1) are
  alternatives selected by compose overlays.
- State lives in named volumes (`theone-workspace`, `theone-home`, plus the
  sidecar's Tailscale state), so the image can be replaced at any time.

## Consequences

- No host changes: no host Tailscale install, no firewall rules, no published ports.
- The sandbox's `localhost` is the sidecar's `localhost`, so serve can proxy
  to `127.0.0.1:7700`. The controller binds `0.0.0.0`, so other containers on
  the compose network (only the optional dind sidecar and what runs in it) can
  also reach 7700 and 5901 through the sidecar's address. The token and
  VncAuth still apply there.
- Userspace networking is slower than kernel WireGuard. That is irrelevant for
  API, terminal and VNC traffic.
- Outbound traffic from the sandbox goes through the shared namespace's
  default route (Docker bridge NAT), not through the tailnet, unless exit-node
  options are added deliberately.
- All projects share one filesystem, one user and one set of resources.
  A runaway build affects everything else in the sandbox, which the resource
  limits cap. Isolation between projects is weaker than with one container per project.
- The node needs an auth key once. With `TS_STATE_DIR` persisted it keeps its identity across restarts.

## Alternatives considered

- **Tailscale on the host.** Simplest networking, but it modifies the host
  and exposes whatever the host exposes. Kept as the opt-in `host-tailscale` mode.
- **Kernel-mode Tailscale in the sandbox.** Needs `NET_ADMIN` and
  `/dev/net/tun` inside the container that runs untrusted code.
- **Separate containers for display, controller and build tools.** Cleaner in
  theory, but GUI apps, the display, wine and build output would have to share
  sockets, volumes and X authority across containers. That adds a lot of
  moving parts for no MVP benefit.
- **Public ingress with auth (Cloudflare Tunnel, reverse proxy).** Violates
  "tailnet only" and makes the bearer token the only barrier.

## Implementation notes (2026-09-23)

- The compose project and volume names are `theone` / `theone-*` by default and
  configurable (`THEONE_COMPOSE_PROJECT`, `THEONE_VOLUME_PREFIX`), so further
  stacks (the e2e suite, a second sandbox) can run next to the default one.
  The single-sandbox decision per stack is unchanged.
- Local-mode host ports are configurable (`THEONE_CONTROLLER_HOST_PORT`,
  `THEONE_VNC_HOST_PORT`); `host-tailscale` accepts only an IPv4 bind address.
