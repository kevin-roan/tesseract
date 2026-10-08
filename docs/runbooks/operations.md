# Operations

Day-2 tasks for the operator of a Tesseract host. Commands run from the
repository root on the host, unless marked "in the sandbox" (open a shell
there with `bun run sandbox shell`).

The compose project is `tesseract` (unless `TESSERACT_COMPOSE_PROJECT` says
otherwise), and containers are named `tesseract-<service>-1` (`tesseract-sandbox-1`,
`tesseract-tailscale-1`, `tesseract-docker-1`). Only touch resources whose names start
with `tesseract`.

## Run more than one stack

Each stack needs its own compose project (which also prefixes its volumes) and
its own host ports or tailnet name. Keep one env file per stack:

```bash
cp infra/compose/.env.example infra/compose/.env.second.local   # gitignored (.env*.local)
# in .env.second.local: TESSERACT_COMPOSE_PROJECT=tesseract-second
#                TESSERACT_CONTROLLER_HOST_PORT=27700 TESSERACT_VNC_HOST_PORT=25901   (local/host-tailscale)
#                or TESSERACT_HOSTNAME=tesseract-second                                  (tailscale)
bun run sandbox --env-file infra/compose/.env.second.local up
bun run sandbox --env-file infra/compose/.env.second.local pair
```

With `--env-file`, only that file is read (and handed to compose), so every
command for that stack needs it. Volumes are `tesseract-second-*`; set
`TESSERACT_VOLUME_PREFIX` to choose another prefix. `TESSERACT_IMAGE` selects the image
(and the tag `sandbox build` produces).

## Upgrade the image

```bash
git pull
bun install
bun run sandbox up --build        # rebuilds tesseract/sandbox:latest and recreates changed containers
bun run sandbox status
```

Upgrading an install from before the rename to Tesseract: see
[rebrand-migration.md](rebrand-migration.md) first.

What survives: everything in the volumes (`tesseract-workspace`, `tesseract-home`,
`tesseract-tailscale`, and the dind volumes if used): projects, artifacts,
`.agent/` memory, controller history and token, Claude login, wine prefix, caches.

What resets: anything installed into the container layer (`sudo apt-get`,
SDK packages Gradle added to `/opt/android-sdk`), `/tmp`, running processes
(stopped on shutdown, or marked `orphaned` if the controller was killed), and
terminal sessions.

After an upgrade:

- If `SPEC.md` changed, rebuild the image (it is baked into
  `/etc/claude-code/CLAUDE.md`). See
  [claude-in-sandbox](claude-in-sandbox.md#2-specmd-as-the-managed-claudemd).
- `ENVIRONMENT.md` is regenerated automatically.
- For reproducible images, pin `NODE_VERSION`, `CLAUDE_CODE_VERSION` and the
  base image digest (build args in [sandbox-image.md](../architecture/sandbox-image.md#build-arguments)).
  Whether to pin them by default is an [open decision](../roadmap.md#open-decisions).
- Agent templates are only seeded when a file is missing, so an existing
  workspace keeps its older `GLOBAL_CONTEXT.md`/`COMMANDS.md`. Compare with
  `/etc/tesseract/agent-templates/` and merge by hand if the rules changed (for
  example the switch to `tesseract-controller api`).
- Before upgrading a real stack, `bun run e2e` checks the new image on
  loopback ([e2e-testing](e2e-testing.md)).
- Upgrade the Tailscale sidecar with `docker pull tailscale/tailscale:stable`,
  then `bun run sandbox up`.

## Back up volumes

Stop writes first for a consistent `state.db` (SQLite in WAL mode):

```bash
bun run sandbox down                            # volumes are kept (never add -v here: it deletes them)
mkdir -p backups
for v in tesseract-workspace tesseract-home tesseract-tailscale; do
  docker run --rm -v "$v":/data:ro -v "$PWD/backups":/backup debian:trixie-slim \
    tar -C /data -czf "/backup/$v-$(date -u +%Y%m%d).tgz" .
done
bun run sandbox up
```

- `tesseract-home` contains the Claude login, `~/.secrets` and the VNC
  password, so encrypt the archive (`age`, `gpg`) or keep it on encrypted storage.
- `tesseract-tailscale` contains the node key. Restoring it on another host
  clones the node identity, so do not run two copies at once.
- To back up projects only, `git push` from the sandbox is often enough.
  Artifacts can be rebuilt.

## Restore volumes

```bash
bun run sandbox down
for v in tesseract-workspace tesseract-home; do
  docker volume create "$v"
  docker run --rm -v "$v":/data -v "$PWD/backups":/backup debian:trixie-slim \
    sh -c "cd /data && tar -xzf /backup/$v-20260923.tgz"
done
bun run sandbox up
```

The entrypoint fixes ownership if the uid differs.

## Rotate the token

Rotate after a suspected leak, a lost phone, or someone leaving a shared tailnet.

```bash
docker exec -u dev tesseract-sandbox-1 tesseract-controller token --rotate          # writes a new token file (0600)
docker exec -u dev tesseract-sandbox-1 supervisorctl restart controller          # the daemon loads the token only at start
bun run sandbox pair                                                          # re-pair each phone
```

Restarting only the controller keeps the display, VNC and the wine prefix
running. The controller stops its own processes, terminals, builds and agent
runs on shutdown, so restart them afterwards if needed. If `TESSERACT_TOKEN` is set in `.env`, it overrides the
file (the CLI warns about this, and the controller copies it into the file on
every start): change it there and run `bun run sandbox up` instead. Phones that
still hold the old token show "Pairing no longer valid" with **Pair again**. Afterwards, check what happened while the old
token was valid: agent runs, processes and builds in the app,
`/workspace/.agent/SESSION_LOG.md`, and `git status` of the projects.

## Reset the wine prefix

Use this when wine errors persist ([electron-windows-wine.md](../architecture/electron-windows-wine.md#troubleshooting)).
It removes anything installed into the prefix, so it counts as a destructive
operation and must be confirmed first when Claude is asked to do it.

```bash
# in the sandbox
wineserver -k || true
mv ~/.wine ~/.wine.broken-$(date +%s)       # keep it until the new prefix works
supervisorctl start wine-init               # oneshot: recreates the prefix (wineboot -u)
tail -f /workspace/.agent/logs/supervisor/wine-init.log
rm -rf ~/.wine.broken-*                     # once builds work again
```

## Resource limits

Set in `infra/compose/.env` and applied with `bun run sandbox up`:

| Variable | Default | Guidance |
|---|---|---|
| `SANDBOX_CPUS` | `4` | Gradle and electron-builder scale with cores |
| `SANDBOX_MEMORY` | `8g` | 8 GB is the minimum for React Native/Android builds. Electron + wine builds need about 3 GB |
| `SANDBOX_PIDS` | `4096` | protects the host from fork bombs. Raise it if large test suites hit it |
| `shm_size` | `2g` (compose) | Chromium and Electron need a large `/dev/shm` |

Check usage: the app's sandbox card, `tesseract-controller status` in the
sandbox, or `docker stats tesseract-sandbox-1` on the host.

Disk usage is not capped per volume:

```bash
docker system df -v | grep tesseract                # volume sizes (host, read-only)
docker exec -u dev tesseract-sandbox-1 du -sh /workspace/artifacts /workspace/projects /home/dev/.cache
```

Clean up old artifacts with `rm /workspace/artifacts/<old files>` in the
sandbox. The controller's artifact list keeps the metadata rows, and
downloads of deleted files return 404.

## Logs

| Log | Location | Rotation |
|---|---|---|
| Container stdout (entrypoint) | `bun run sandbox logs [service] [-f]` / `docker logs tesseract-sandbox-1` | json-file, 10 MB × 3 |
| supervisord and its programs | `/workspace/.agent/logs/supervisor/{supervisord,<program>}.log` | 5 MB × 2 (wine-init 1 MB × 1) |
| Process and build output | `/workspace/.agent/controller/logs/<id>.log`, and the app | 5 MiB, 1 rotation |
| Controller events | `controller.log` above (level from `TESSERACT_LOG_LEVEL`) | as above |
| Claude's scratch logs | `/workspace/.agent/logs/*.log` | per SPEC §11: 5 MiB, 2 kept, 14 days |
| Tailscale | `bun run sandbox logs tailscale` | json-file, 10 MB × 3 |

Increase verbosity temporarily with `TESSERACT_LOG_LEVEL=debug` in `.env` and
`bun run sandbox up`. `restart` does not re-read `.env`, but `up` recreates
containers whose configuration changed.

## Enable or disable Docker-in-Docker

Read [ADR 0006](../adr/0006-optional-docker-in-docker.md) first. dind is a
privileged container on the host.

```bash
bun run sandbox --dind up          # adds compose.dind.yml: docker:dind + DOCKER_HOST in the sandbox
                                   # (or set TESSERACT_DIND=1 in .env to make it the default)
bun run sandbox up --remove-orphans   # without dind: the sandbox is recreated without DOCKER_HOST, the dind container removed
```

`--dind` and `--mode` may go before or after the command
(`sandbox --dind up` = `sandbox up --dind`).

Images and containers built through dind live in the `tesseract-dind-data`
volume (the dind daemon also mounts `tesseract-workspace` at `/workspace`, so bind
mounts of project paths work). Remove it with `docker volume rm tesseract-dind-data`
when you no longer need them.

## Remove everything

```bash
bun run sandbox --dind down -v     # removes containers AND the tesseract-* volumes of the stack: destroys all data
docker image rm tesseract/sandbox:latest
```

Also delete the machine in the Tailscale admin console.
