# ADR 0013: Sandbox deploys to server containers

- **Status:** Accepted
- **Date:** 2026-10-24

## Context

Agents in the sandbox build web apps and services, but they had no way to publish them.
The user's server containers ([ADR 0011](0011-server-containers-and-cloudflare-tunnel.md))
are the natural place: each `tesseract-ct-<name>` has its own Docker daemon, a tailnet node
and optional public URLs through Cloudflare Tunnel. The sandbox cannot reach them, by
design. They run under Sysbox on their own bridge network with no published ports, and only
the desktop app manages them through the host's Docker CLI. The sandbox has no Docker access
to the host ([security model](../architecture/security-model.md)).

Agents run with `bypassPermissions`, so any code in the sandbox (including a prompt-injected
run or a malicious dependency) can do whatever the agent can. A deploy channel must not
widen the sandbox's reach to the host, and a deploy must not happen behind the user's back.

The repo already has two host-mediated queues with the same shape: sync-back requests
([sync-back.md](../architecture/sync-back.md)) and iOS installs. The sandbox asks, and the
host, which holds the privileges, decides and acts.

## Decision

1. **A deploy queue on the sandbox controller.** `tesseract-controller deploy <container>
   [--dir] [--app] [--port] [--hostname]` calls `POST /v1/deploys`. The controller archives
   the directory itself: the realpath must be inside `/workspace`, the directory must hold a
   compose file (`compose.yml`, `compose.yaml`, `docker-compose.yml`, `docker-compose.yaml`)
   or a `Dockerfile`, `.git` and `node_modules` are left out, and the bundle can be at most
   `LIMITS.maxDeployBundleBytes` (512 MiB). It stores the bundle as
   `$TESSERACT_DATA_DIR/deploys/<id>.tar.gz` with its sha256, and publishes `deploy.updated`.
2. **The desktop host does the work.** The Electron `DeployService` sends a heartbeat with
   its targets (`PUT /v1/deploys/targets`, TTL 60 s): the existing server containers, with
   `running`, `autoApprove` and current URLs. It claims pending deploys, downloads the bundle,
   checks the size and sha256 (`x-tesseract-sha256`), and streams it into the container with
   `docker exec -i tesseract-ct-<name> tar -xzf - --no-same-owner -C /srv/tesseract/apps/<app>`.
   Then it runs `docker compose -p <app> up -d --build --remove-orphans` (compose) or
   `docker build -t tesseract-app/<app>:latest .` and `docker run -d --name <app> --restart
   unless-stopped [-p <port>:<port>]` (Dockerfile). Both run on the container's inner Docker
   daemon. The host never extracts the bundle.
3. **The host owns the policy.** Each container has `autoDeploy` ("Allow sandbox deploys")
   in the host's `containers.json`, off by default. When it is off, the deploy waits in
   `awaiting_approval`, the app shows a desktop notification, and the user approves or
   rejects it on the container's detail page. After 30 minutes it is `rejected`. Only the host
   reads the policy. The sandbox sees it as `autoApprove` for information only. Host CLI:
   `tesseract containers auto-deploy <name> on|off`.
4. **Existing containers by default.** A deploy targets a container the host reported. Only
   a deploy with `create` may name a new container, and the host creates it only after its
   user approves (see the amendment). It runs one deploy per container at a time.
5. **URLs.** With `--hostname` (which needs `--port`), the host adds a Cloudflare route
   through the existing route flow. It reuses a route that already points at the same
   container and port, and fails the deploy on any other conflict. It also reports
   `http://<container tailnet name>:<port>`.
6. **Lifecycle.** Statuses are `pending → claimed → [awaiting_approval →] deploying →
   deployed | failed | rejected`, plus `cancelled` from the sandbox. A claim with no progress
   for 15 minutes goes back to `pending`, so another host (or the same one after a restart)
   can pick it up.

## Consequences

- The sandbox gets no Docker socket, no dind and no new network path. Its isolation is
  unchanged. The new surface is a bounded JSON API and a tarball that only the container
  unpacks.
- Deployed code runs inside the Sysbox container, under its user namespace, so it cannot
  reach the host any more than code the user installs there by hand.
- A container with routes is internet-facing. With auto-approve on, a malicious or confused
  agent can publish arbitrary content on the user's domain, or replace an app already
  served there. Auto-approve is for throwaway containers. The default is off.
- Deploys need the desktop app running on the host. With no heartbeat in 60 s, the
  targets are empty and deploys stay `pending`. The CLI says so.
- The bundle carries the source, not images: builds run inside the server container, which
  needs disk and network for base images and dependencies.
- Apps must listen on `0.0.0.0` and publish (compose `ports:`, or `--port` for a Dockerfile)
  the port that routes and tailnet URLs point at.
- Secrets in the deployed directory (`.env` files and the like) are copied into the
  container. `.git` and `node_modules` are the only exclusions.

## Alternatives considered

- **Mount the host Docker socket into the sandbox.** Gives the sandbox root on the host.
  Rejected outright, as in ADR 0006 and ADR 0011.
- **Use the dind sidecar ([ADR 0006](0006-optional-docker-in-docker.md)).** It is opt-in,
  privileged and lives next to the sandbox, not on the server containers. Making it a
  requirement for deploys would make the escape path the default.
- **Put the sandbox on the server containers' networks**, or give them published ports so
  the sandbox could push over SSH or a registry. This breaks per-container isolation, lets
  any sandbox code talk to every container's services, and still needs credentials inside
  the sandbox. Rejected.
- **Let the sandbox create containers directly** (roadmap "per-project containers"). Needs
  a container runtime reachable from the sandbox, and moves the policy into code the agent
  controls. Rejected. The sandbox may only *request* a new container through a deploy
  (amendment below); the host creates it, after its user approves.
- **Extract the bundle on the host and `docker cp` it in.** The tarball is
  attacker-controlled (symlinks, `..` paths, huge files). Unpacking it only inside the
  container keeps those tricks inside the Sysbox boundary.

## Amendment (2026-10-24): creating containers through a deploy

The sandbox can ask for a new server container: `tesseract-controller deploy <name> --create
[--cpus <n>] [--memory <MB>]` sends `create: true` (and optional limits, which need `create`).
The controller accepts a name the host has not reported only with `create`; without it, the 400
suggests `--create`. Names the host reserves (`sandbox`, `tailscale`, `docker`, `host`,
`localhost`) and the CLI subcommand words (`targets`, `ls`, `status`, `cancel`) are rejected.

Creating a container always needs explicit approval on the host, regardless of the container's
`autoDeploy` policy (there is none yet for a new name). The host creates `tesseract-ct-<name>`
through its normal create flow, with the requested limits or its defaults, and then deploys into
it. A sandbox can therefore queue requests for new containers, but none appears without the user
saying yes; a rejected or unanswered request (30 minutes) ends as `rejected` like any deploy.
