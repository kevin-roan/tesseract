# ADR 0011: Server containers on Sysbox, Tailscale SSH, public URLs through Cloudflare Tunnel

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

The sandbox ([ADR 0003](0003-single-sandbox-container-with-tailscale-sidecar.md)) is a
development machine: one container, shared by all projects, reachable only over the tailnet.
Users also want **server containers**: Linux machines that behave like a production server
(systemd, their own Docker daemon, Postgres, whatever is installed), independent of the
sandbox and of the host. Users reach them over SSH on the tailnet. They must be able to put
selected services on a public domain without publishing the tailnet name or opening ports on
the host.

Until now nothing was ever public (`SPEC.md` network rule, security model "no public DNS").
This ADR is the explicit opt-in that rule asks for. It applies only to hostnames the user
routes, and only to server containers, never to the sandbox or the controller.

## Decision

1. **Runtime: Docker + Sysbox.** Each server container runs the `tesseract/server` image
   (Debian, systemd as PID 1, `docker.io`, `tailscale`) under the `sysbox-runc` runtime.
   This gives a VM-like container: systemd and an inner Docker daemon work without
   `--privileged`, without the host Docker socket and with user-namespace isolation. If
   Sysbox is missing, the app refuses to create the container. It never falls back to
   privileged mode.
2. **Host-side control.** The desktop app's main process and the `tesseract` CLI create and
   manage server containers through the host's Docker CLI (`src/core/containers`). The
   sandbox controller never gets Docker access.
3. **Isolation.** Each container gets its own bridge network `tesseract-ct-<name>`, its
   own volume for `/var/lib/docker`, no published ports and no bind mounts. It is not on
   the sandbox's network.
4. **Tailnet: one node per container.** On first boot the container runs
   `tailscale up --ssh --auth-key=file:… --advertise-tags=tag:tesseract-server` once. The
   host writes the key through `docker exec -i` (stdin, mode 0600), and the container
   shreds it after a successful login. `tailscaled` runs in userspace mode. SSH is
   Tailscale SSH (`ssh root@<name>.<tailnet>.ts.net`), so there are no keys to manage.
5. **Public URLs: one Cloudflare Tunnel per container.** The app creates a remotely managed
   tunnel through the Cloudflare API, and a `cloudflare/cloudflared` connector container on
   the server's private network only. The connector is read-only, has all capabilities
   dropped, runs with `no-new-privileges` and gets its token through the environment, not
   argv. The tunnel's ingress is generated entirely from the app's route list and always
   ends with `http_status:404`. Each rule targets only `http(s)://tesseract-ct-<name>:<port>`.
   DNS records are proxied CNAMEs to `<tunnel>.cfargotunnel.com`, tagged
   `managed-by:tesseract`.

## Consequences

- Only `hostname → container:port` pairs the user added are reachable from the internet.
  The host, the sandbox, the tailnet and its MagicDNS names stay private. Traffic arrives
  over the connector's outbound connection, so the host opens no ports.
- The app never overwrites a DNS record it did not create. It refuses the route instead.
- Adding a route is all-or-nothing: if any Cloudflare or Docker step fails, the DNS record
  and ingress rule are rolled back.
- Removing the last route of a container deletes its tunnel and connector. Removing a
  container removes its routes first.
- Services inside a server container must listen on `0.0.0.0` (or be Docker-published
  inside it) to be reachable through the tunnel. Tailnet access works for loopback-only
  services too, because netstack forwards to localhost.
- Linux hosts only for now (Sysbox). Docker Desktop on macOS and Windows has no Sysbox.
- A server container can reach the internet, and through the bridge gateway it can reach
  ports on the host. Host services that must stay private should not listen on `0.0.0.0`.
  The tailnet ACL should give `tag:tesseract-server` no outbound grants.
- Secrets: the Tailscale auth key and the Cloudflare token are saved in `config.json`
  (0600; sealed with the OS keychain on macOS and Windows). The CLI reads them from stdin
  or from `TESSERACT_SERVER_TS_AUTHKEY` and `TESSERACT_CLOUDFLARE_TOKEN`.

## Alternatives considered

- **Tailscale Funnel.** Only offers `*.ts.net` hostnames, which publishes the tailnet name.
  Rejected.
- **Incus/LXD system containers.** Closest to a VM, but adds a second container runtime.
- **Privileged Docker containers.** Run everywhere, but are effectively root on the host.
- **Per-container containers from the sandbox controller** (roadmap "per-project
  containers"). Would need Docker access from inside the sandbox, which the security model
  forbids.
- **One shared cloudflared connector.** Fewer containers, but it would need network access
  to every server, so one compromised server could reach the others' services.
