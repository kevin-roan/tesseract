# ADR 0006: Optional Docker-in-Docker

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

Many projects expect Docker: `docker compose up` for Postgres or Redis,
integration tests with Testcontainers, or building their own images. SPEC v1
wants supporting services to run "inside the sandbox" and forbids
`docker run --privileged`. Mounting the host's `/var/run/docker.sock` into the
sandbox would give untrusted project code root on the host, and this host
runs unrelated containers.

## Decision

- Docker is **off by default**. The sandbox image contains the Docker CLI and
  compose plugin but no daemon.
- The compose overlay `infra/compose/compose.dind.yml` (enabled with
  `bun run sandbox up --dind` or `THEONE_DIND=1` in `.env`) adds a `docker` service from the official
  `docker:dind` image. It is **privileged**, because dind cannot run
  otherwise. Its API is reachable only on the compose network, at
  `tcp://docker:2376` with mutual TLS. The client certificates live in the
  `theone-dind-certs` volume, mounted read-only into the sandbox at
  `/certs/client`. The sandbox gets `DOCKER_HOST`, `DOCKER_TLS_VERIFY=1` and
  `DOCKER_CERT_PATH`. Images and containers live in `theone-dind-data`.
- The `theone-workspace` volume is mounted at `/workspace` in the dind
  container too, so `docker run -v /workspace/projects/app:/app` and compose
  bind mounts from a project resolve to the same files.
- The host Docker socket is never mounted.
- SPEC.md §10 tells the agent: use Docker only when `$DOCKER_HOST` is set, and
  never run `--privileged`, `--pid=host` or `--network=host` containers or
  bind-mount anything but project paths inside the daemon.

## Consequences

- Without the overlay, the sandbox keeps its full hardening (no privileged container anywhere).
- With the overlay, a privileged container runs on the host. Code with access
  to `DOCKER_HOST` (everything in the sandbox, including Claude and project
  scripts) can start a privileged container on that daemon, and from there
  reach the host kernel. **Enabling dind means trusting the sandbox's code
  roughly as much as host root.** The operator opts in knowingly, per host.
- Containers started through dind are not reachable from the phone. Ports
  they publish are bound inside the dind container's network namespace, and
  the sandbox reaches them at `docker:<port>`, not `localhost:<port>`.
- The dind daemon can read and write the entire workspace volume.
- Image layers and volumes accumulate in the dind volume. Clean them with
  `docker system prune` inside the sandbox; that affects only the dind daemon.

## Alternatives considered

- **Host Docker socket.** Equivalent to host root with no boundary at all, and
  it exposes unrelated host containers. Rejected.
- **Rootless dind (`docker:dind-rootless`).** Still needs a privileged
  container or special seccomp/AppArmor settings on most hosts, and has
  storage-driver limits. It remains a candidate for a hardened variant.
- **Sysbox runtime.** Runs dind without `--privileged`, but requires
  installing a runtime on the host, which violates host-minimal. It is the
  recommended path if the host operator is willing.
- **Podman inside the sandbox.** Rootless podman in a `cap_drop: ALL`
  container needs user namespaces and `/dev/fuse` and has networking
  limitations. It might be revisited.
- **Services as local processes only.** Always available as the fallback (SPEC
  §10), but many projects ship compose files.

## Implementation notes (2026-09-23)

- dind is an overlay file selected by the operator CLI, not a compose profile.
- Its volumes follow the stack's volume prefix (`<prefix>-dind-certs`,
  `<prefix>-dind-data`, default `theone-*`), and `DIND_CPUS`/`DIND_MEMORY`/
  `DIND_PIDS` cap everything it runs.
