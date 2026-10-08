# ADR 0009: supervisord for in-container process supervision

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The sandbox runs several long-lived programs that depend on each other: Xvnc
(the display), openbox (the window manager, needs the display), the
controller, and a one-shot wine prefix initialization. They must restart
independently when they crash, log somewhere inspectable, and run as the
unprivileged `dev` user, while the entrypoint needs root once to fix volume
ownership. PID 1 must reap zombies, since builds spawn many children.

## Decision

- **tini** is PID 1 (`ENTRYPOINT ["tini", "--", "tesseract-entrypoint"]`). The
  entrypoint runs as root: it creates workspace directories, seeds
  `/workspace/.agent` templates, writes the VNC password, installs SPEC.md as
  `/home/dev/.claude/CLAUDE.md` if absent, fixes volume ownership, and then
  `exec`s **supervisord**.
- supervisord programs, each with `user=dev`:
  - `xvnc`: `Xvnc :1 -geometry $TESSERACT_DISPLAY_GEOMETRY -rfbport 5901 -rfbauth /home/dev/.vnc/passwd …`, autorestart
  - `openbox`: `DISPLAY=:1`, started after xvnc, autorestart
  - `controller`: `tesseract-controller serve`, autorestart
  - `wine-init`: oneshot `wineboot -u` (`autorestart=false`, `startsecs=0`), idempotent
- Program output goes to supervisord-managed log files with size-based rotation.
- The image `HEALTHCHECK` is `curl -fsS http://127.0.0.1:7700/v1/health`.

## Consequences

- Each program restarts on its own. A crashed controller does not take the display down, or the reverse.
- The controller supervises *user* workloads (processes, PTYs, builds) itself.
  supervisord only supervises the fixed infrastructure programs. Keeping the
  two layers separate means supervisord config never changes at runtime.
- Python (supervisord) is needed in the image, but python3 is there anyway for development.
- Startup ordering is by priority, not true dependencies. openbox and the
  controller must tolerate the display not being ready yet: they retry, or
  the controller reports `display.available: false`.
- The container is not "one process per container". This is a deliberate
  choice for a development workstation, where the display, window manager and
  apps must share one X server and filesystem.

## Alternatives considered

- **s6-overlay.** Lighter and has real dependency ordering, but it is less
  familiar and needs more files per service.
- **systemd in the container.** Needs extra privileges and cgroup mounts,
  which conflicts with `cap_drop: [ALL]`.
- **The controller supervising everything.** Couples the display's lifetime
  to the controller's. A controller crash or upgrade would kill the user's GUI session.
- **Separate containers per program.** See ADR 0003: X, wine and apps would
  have to share sockets and volumes across containers.

## Implementation notes (2026-09-23)

- supervisord itself runs as `dev` (`user=dev` in `[supervisord]`), because its
  socket and logs live in dev-writable places; its socket is
  `/run/supervisor/supervisor.sock` (0700). Only the entrypoint runs as root,
  and its tool probes run as `dev`.
- The entrypoint writes the VNC password (and `TESSERACT_TOKEN`, if set) to
  `/run/tesseract/controller.env` and unsets both before starting supervisord;
  `tesseract-controller-run` loads that file for the controller only.
- `openbox` runs under `dbus-run-session` (no leaked session bus per restart);
  `xvnc` runs through `tesseract-xvnc`, which clears locks of dead servers.
- Right after a start the controller is `STARTING` for 3 s; `tesseract-doctor`
  reports that as a warning.
