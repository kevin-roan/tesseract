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

On macOS, "host Docker" is the Tesseract-managed Colima VM (profile `tesseract`, context
`colima-tesseract`, [ADR 0012](../adr/0012-macos-container-vm.md)). Sysbox is installed in
the VM, and the sandbox stack runs on the same daemon. The VM is the host boundary there:
it mounts the user's home for the sandbox's compose bind mounts, but server containers
still get no bind mounts and run under `sysbox-runc`, so they cannot see it. When Sysbox is
missing, the containers check offers `setup-vm` instead of `install-sysbox`. New server
containers default to 1024 MB of memory, since the VM has 5 GiB in total.

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
| Route state | `$TESSERACT_STATE_DIR/containers.json` (0600): tunnels per container, routes with zone and DNS record ids, deploy policy `autoDeploy` per container |
| Deployed apps | `/srv/tesseract/apps/<app>` inside the container; compose project `<app>`, or image `tesseract-app/<app>:latest` and container `<app>` ([Sandbox deploys](#sandbox-deploys)) |
| Secrets | `config.json` keys `containersTailscaleKey[Sealed]`, `containersTailscaleTags`, `containersCloudflareToken[Sealed]` |

## Lifecycle

- **Create:** the app checks Sysbox and the image, then creates the network and volume
  and runs `docker create --runtime sysbox-runc --restart unless-stopped …`. No `-p`, no
  bind mounts. It starts the container and waits for `systemctl is-system-running --wait`,
  retrying every 2 s (up to 2 minutes) while systemd's bus is not up yet.
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

## Sandbox deploys

Agents in a sandbox can publish what they build to an existing server container, or ask for a
new one (always approved by the host user). The sandbox
gets no Docker access and no new network path: it queues a request on its own controller, and
the desktop app on the host runs it. This is the same pattern as sync-back requests and iOS
installs. Decision record: [ADR 0013](../adr/0013-sandbox-deploys-to-server-containers.md).
API and types: blueprint §5.2 and §5.4 (`/v1/deploys`, `Deploy`, `deploy.updated`).

```
sandbox                         controller                     desktop host (DeployService)          tesseract-ct-<name>
tesseract-controller deploy ─▶ POST /v1/deploys                ◀─ PUT /v1/deploys/targets (heartbeat)
                               tar.gz of the dir, sha256        ─▶ claim, progress, complete
                               $TESSERACT_DATA_DIR/deploys/     ◀─ GET …/bundle (verify sha256, size)
                                                                   docker exec -i … tar -xzf - ──────▶ /srv/tesseract/apps/<app>
                                                                   docker exec … compose up / build+run ▶ inner dockerd
```

### Request

`tesseract-controller deploy <container> [--dir <path>] [--app <name>] [--port <n>]
[--hostname <host>] [--create [--cpus <n>] [--memory <MB>]]` (blueprint §7). The controller
archives the directory itself:

- The realpath must be inside `/workspace`.
- The directory needs `compose.yml`, `compose.yaml`, `docker-compose.yml` or
  `docker-compose.yaml` (kind `compose`), or a `Dockerfile` (kind `dockerfile`).
- `.git` and `node_modules` are left out. The bundle is at most `LIMITS.maxDeployBundleBytes`
  (512 MiB).
- `app` defaults to the directory name, slugged. It names the directory, the compose project
  and the image.
- `--hostname` needs `--port`.
- The container must be one of the targets the host reported in the last 60 s, unless the
  request has `create` (`--create`): then a new name is allowed, and `cpus`/`memoryMb`
  (`--cpus`, `--memory`) set the new container's limits. Without `create`, the 400 for an
  unknown name suggests `--create`.
- Reserved names are refused unless the host reports them: `sandbox`, `tailscale`, `docker`,
  `host`, `localhost` (the host's own rule) and the CLI words `targets`, `ls`, `status`,
  `cancel`.

The CLI waits by default and exits 0 only on `deployed`, printing the URLs.

### Host

The desktop app's `DeployService` (Electron main process, `src/core`):

1. Every heartbeat it sends `PUT /v1/deploys/targets` with the existing server containers:
   `name`, `running`, `autoApprove` (= `autoDeploy`) and the URLs already routed to each one.
   It subscribes to `deploy.updated` and picks up pending deploys (`GET /v1/deploys?status=pending`).
2. It claims a pending deploy (`POST /v1/deploys/:id/claim`). It runs one deploy per container
   at a time. A container that does not exist fails the deploy, unless the deploy has `create`.
   **Create.** A deploy with `create` for a missing container always waits in
   `awaiting_approval` for the user to approve creating `tesseract-ct-<name>`, whatever the
   `autoDeploy` policy (the CLI prints "waiting for approval to create container <name>").
   On approval the host creates it through the normal create flow, with the requested
   `cpus`/`memoryMb` or its defaults, then deploys into it. For an existing container, `create`
   changes nothing.
3. **Policy.** With `autoDeploy` off (the default), it reports `awaiting_approval`, shows a
   desktop notification, and waits for **Approve** or **Reject** on the container's detail page.
   Rejecting completes the deploy as `rejected`. After 30 minutes the controller rejects it.
   Only the host reads the policy, and changes it with the detail page's **Allow sandbox
   deploys** switch or `tesseract containers auto-deploy <name> on|off`.
4. **Bundle.** It downloads `GET /v1/deploys/:id/bundle` and checks the byte count and the
   sha256 against the deploy and the `x-tesseract-sha256` header. It never extracts the bundle
   on the host. It streams it into the container:
   `docker exec -i tesseract-ct-<name> tar -xzf - --no-same-owner` in
   `/srv/tesseract/apps/<app>`.
5. **Run**, on the container's inner Docker daemon (`docker exec tesseract-ct-<name> …`):
   - compose: `docker compose -p <app> up -d --build --remove-orphans` in the app directory.
   - dockerfile: `docker build -t tesseract-app/<app>:latest .`, then an existing `<app>`
     container is replaced with `docker run -d --name <app> --restart unless-stopped
     [-p <port>:<port>]`.
6. **URLs.** With a hostname, it adds `hostname → container:port` through the route flow above.
   A route that already points at the same container and port is reused. Any other conflict
   (the hostname is routed elsewhere, or there is a foreign DNS record) fails the deploy. The
   deploy also reports `http://<container tailnet DNS name>:<port>` when the container is on the
   tailnet.
7. It reports output with `progress` (`deploying` + log lines) and finishes with `complete`
   (`deployed` + `urls`, or `failed` + `error`).

### Statuses

`pending → claimed → [awaiting_approval →] deploying → deployed | failed | rejected`.
The sandbox can cancel any active deploy (`cancelled`). A claim with no progress for 15 minutes
goes back to `pending`.

### Limits

- Deploys go into existing containers, or into a container created for a `create` deploy
  after the user approved it. Otherwise the host never creates containers, networks, volumes
  or routes other than the requested hostname.
- Apps must listen on `0.0.0.0` and publish their port inside the container (compose
  `ports:`, or `--port` for a Dockerfile). Otherwise the tunnel and the tailnet URL can't
  reach them.
- Builds run inside the server container. Base images and dependencies come from its network,
  and its disk holds them.
- Threats and mitigations: [security model](security-model.md#sandbox-deploys-to-server-containers).

## Surfaces

- Desktop: a **Containers** sidebar section and page (list, detail with SSH target, public
  URLs, an in-app shell and logs), a **Domains** page (Cloudflare connection, all routes, add URL) and
  **Preferences → Containers** (checks, Tailscale key, Cloudflare token). The detail page also has
  the **Allow sandbox deploys** switch and the container's deploys (approve or reject, log, URLs). IPC service:
  `containers` (`src/shared/contracts/containers.ts`).
- In-app shell: the detail page runs `bash -l` as root in `tesseract-ct-<name>` through the
  Docker Engine API (`POST /containers/{id}/exec` with a TTY, then a hijacked
  `/exec/{id}/start`), so it works without the tailnet. The endpoint comes from `DOCKER_HOST`
  or the current `docker context` (unix socket, named pipe or plain `tcp://`). Output streams to
  the requesting window only (`shellData`/`shellExit` events); sessions close with the window.
- CLI: `tesseract containers …` and `tesseract domains …` (blueprint §7.1).
