# ADR 0012: One Tesseract-managed Colima VM with Sysbox on macOS

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Server containers ([ADR 0011](0011-server-containers-and-cloudflare-tunnel.md)) need the
`sysbox-runc` runtime. Sysbox is Linux-only, and Docker Desktop on macOS runs its own VM
without Sysbox and with no way to add a runtime. So on a Mac, server containers could not
be created at all.

The target machine is an M1 Mac mini (2021, 8 GB RAM, 512 GB disk) dedicated to Tesseract.
It runs nothing else. It has to run the sandbox and server containers, and the host
Android emulator and Android builds, within 8 GB.

## Decision

1. **One VM, managed by Tesseract.** On macOS the app and the CLI set up and run one Colima
   VM, profile `tesseract` (Docker context `colima-tesseract`). Host tools come from
   Homebrew (`colima`, `docker`, `docker-compose`, `docker-buildx`).
2. **VM settings.** `vmType: vz`, `mountType: virtiofs`, arch `aarch64` (Intel: `x86_64`),
   Rosetta and binfmt on arm64 for amd64 images. Default size 6 CPUs, 5 GiB memory,
   120 GiB disk. `~` is mounted writable (as Docker Desktop shares `/Users`, so compose
   bind mounts such as `~/.claude` keep working), plus the bundled sandbox context
   read-only when it is outside `~`.
3. **Sysbox inside the VM.** A `provision` script in `colima.yaml` (mode `system`)
   downloads a pinned `sysbox-ce` `.deb` for the VM arch, verifies its sha256 and installs
   it. It does nothing when `sysbox-runc` is installed and `sysbox-mgr`/`sysbox-fs` are
   active. It waits for guest DNS first and retries `apt-get update` and the download,
   because Lima runs it during cloud-init, often before name resolution works. Colima's
   image has no `systemd-resolved`, and on a Mac running Tailscale the VM came up with no
   `/etc/resolv.conf` at all, so on every boot the script writes `1.1.1.1`/`8.8.8.8` when
   the file has no nameserver, and switches to them if names still don't resolve after
   30 s. Nothing in Tesseract uses `host.docker.internal`, which only Lima's resolver
   answers. It leaves
   restarting Docker to the `sysbox-ce` package. Lima ignores provision failures and
   `colima start` still exits 0, so setup does not trust the `sysbox-runc` entry in
   `docker info` (it comes from `colima.yaml` even when Sysbox is missing): it also
   requires `systemctl is-active sysbox-mgr sysbox-fs` (via `colima ssh -p tesseract`)
   and, when they are not active, runs the provision script again over `colima ssh`
   (`sudo sh -s`) before giving up.
   Colima rewrites `colima.yaml` on first start and drops all comments, so Tesseract
   recognises its own file only by the `tesseract-managed` marker inside the provision
   script, and only rewrites it when the CPU, memory, disk, runtimes, provision script,
   mounts or `sshConfig` differ. `sshConfig: false` keeps Colima out of `~/.ssh/config`
   (`colima ssh` does not need it). A VM that `colima list` reports as `Broken` is
   force-stopped (`colima stop -f tesseract`) before it is started.
4. **Runtime declared in `colima.yaml`.** `docker.runtimes.sysbox-runc.path:
   /usr/bin/sysbox-runc`. Colima rewrites `/etc/docker/daemon.json` from `colima.yaml` on
   every start, so the runtime must live there.
5. **Everything shares the VM.** The sandbox (compose stack, `runc`) and server containers
   (`sysbox-runc`) run on the same daemon. Docker Desktop may stay installed but must not
   be running.

## Consequences

- Server containers work on macOS with the same rules as on Linux: Sysbox required, no
  privileged fallback, no bind mounts.
- The VM's memory is fixed at its size and is not given back to macOS while the VM runs.
  On 8 GB, 5 GiB for the VM leaves about 3 GB for macOS, the app and the host emulator.
- Run one heavy workload at a time. Stop server containers before Android builds. New
  server containers on macOS default to `--memory 1024`.
- Moving from Docker Desktop loses the Docker Desktop volumes (they live in its VM). The
  sandbox must be rebuilt and paired again, and the old tailnet node deleted.
- `colima stop tesseract` frees all of the VM's RAM. `colima delete tesseract` destroys
  every container, image and volume in it.
- Linux and Windows are unchanged. Everything new is gated on macOS.

## Alternatives considered

- **Privileged Docker-in-Docker for server containers.** Works on Docker Desktop, but a
  privileged container is root in a VM that shares `/Users`. ADR 0011 forbids privileged
  server containers. Rejected.
- **A second VM next to Docker Desktop.** Keeps Docker Desktop for the sandbox, but two
  VMs do not fit in 8 GB. Rejected.
- **Apple `container`.** Native and light, but not Docker (no compose, no context), and
  unproven with systemd as PID 1 plus a nested `dockerd`. Rejected for now.
