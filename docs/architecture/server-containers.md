# Server containers and public URLs

Server containers are standalone Linux machines on the host. Each runs systemd, its own
Docker daemon and whatever you install in it, and behaves like a small production server.
They are separate from the sandbox. Decision record:
[ADR 0011](../adr/0011-server-containers-and-cloudflare-tunnel.md). Setup steps:
[server-containers runbook](../runbooks/server-containers.md).

```
            tailnet (Tailscale SSH)                    internet
                   │                                       │
       ┌───────────▼───────────┐               Cloudflare edge (TLS)
host   │ tesseract-ct-api      │                           │ outbound tunnel
Docker │  systemd, dockerd,    │◄── http://tesseract-ct-api:3000 ── tesseract-ct-api-tunnel
       │  tailscaled (userspc) │        (private bridge tesseract-ct-api)  (cloudflared)
       └───────────────────────┘
```

## Names

| Thing | Value |
|---|---|
| Server container / hostname | `tesseract-ct-<name>` / `<name>`; `<name>` matches `^[a-z][a-z0-9-]{0,30}[a-z0-9]$` and is not `sandbox`, `tailscale`, `docker`, `host` or `localhost` |
| Network | `tesseract-ct-<name>` (bridge, one per server) |
| Inner Docker data | volume `tesseract-ct-<name>-docker` → `/var/lib/docker` |
| Tunnel connector | `tesseract-ct-<name>-tunnel` (`cloudflare/cloudflared:2026.10.0`) |
| Labels | `dev.tesseract.container=<name>`, `dev.tesseract.role=server\|tunnel` |
| Image | `tesseract/server:1`, built from `infra/docker/server` |
| Runtime | `sysbox-runc` (required) |
| Tailnet tag | `tag:tesseract-server` (changeable) |
| Route state | `$TESSERACT_STATE_DIR/containers.json` (0600): tunnels per container, routes with zone and DNS record ids |
| Secrets | `config.json` keys `containersTailscaleKey[Sealed]`, `containersTailscaleTags`, `containersCloudflareToken[Sealed]` |

## Lifecycle

- **Create:** the app checks Sysbox and the image, then creates the network and volume
  and runs `docker create --runtime sysbox-runc --restart unless-stopped …`. No `-p`, no
  bind mounts. It starts the container and waits for `systemctl is-system-running --wait`.
  If a Tailscale key is saved, it writes the key and the tags into `/etc/tesseract`
  through `docker exec -i` and starts `tesseract-tailnet.service`.
- **Start, stop, restart:** the server and its tunnel connector start and stop together.
- **Remove:** removes the container's routes (DNS, ingress, tunnel), then the containers,
  the network and the volume.

## Routes

`addRoute(container, hostname, port, scheme)`:

1. Validates the hostname: a concrete FQDN, no wildcards, no IPs. It must fall inside an
   active zone the token can see; the most specific zone wins.
2. Refuses the route if the hostname is already routed, or if Cloudflare has a record for
   it without the `managed-by:tesseract` comment.
3. Reuses the container's tunnel, or creates `tesseract-<name>-<rand>` with
   `config_src: cloudflare`.
4. PUTs the full ingress list for the container, followed by `http_status:404`.
5. Creates a proxied CNAME to `<tunnel>.cfargotunnel.com`, then starts the connector.
6. On any failure, deletes the record, re-PUTs the ingress without the route and drops it.

`syncRoutes` re-applies ingress and DNS for every tunnel and makes sure each connector
is running. A route that can't be repaired is marked `error` with its message.

## Cloudflare token

Create a custom token with **Zone → Zone → Read**, **Zone → DNS → Edit** and **Account →
Cloudflare Tunnel → Edit**. Limit it to the zones you want to use.

## Surfaces

- Desktop: a **Containers** sidebar section and page (list, detail with SSH target, public
  URLs and logs), a **Domains** page (Cloudflare connection, all routes, add URL) and
  **Preferences → Containers** (checks, Tailscale key, Cloudflare token). IPC service:
  `containers` (`src/shared/contracts/containers.ts`).
- CLI: `tesseract containers …` and `tesseract domains …` (blueprint §7.1).
