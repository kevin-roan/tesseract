# Server containers: setup

Design: [server-containers.md](../architecture/server-containers.md).

## 1. Install Sysbox (Linux host)

On macOS, skip this step and set up the VM instead ([macOS](#macos)).

Follow https://github.com/nestybox/sysbox/blob/master/docs/user-guide/install-package.md.
On Arch, use the AUR package `sysbox-ce-bin`. Then check:

```sh
docker info --format '{{json .Runtimes}}' | grep sysbox-runc
tesseract containers doctor
```

## 2. Build the server image

```sh
tesseract containers build        # or Preferences → Containers → Build image
```

## 3. Tailscale

In the tailnet policy file, add the tag and allow only members to reach it:

```jsonc
"tagOwners": { "tag:tesseract-server": ["autogroup:admin"] },
"grants": [{ "src": ["autogroup:member"], "dst": ["tag:tesseract-server"], "ip": ["*"] }],
"ssh": [{ "action": "check", "src": ["autogroup:member"], "dst": ["tag:tesseract-server"], "users": ["root", "autogroup:nonroot"] }]
```

Don't add any grant with `tag:tesseract-server` as the source. Create a **reusable,
pre-approved** auth key tagged `tag:tesseract-server`, then save it:

```sh
tesseract containers tailscale-key < key.txt
```

## 4. Create a container and SSH in

```sh
tesseract containers create api --cpus 2 --memory 4096
tesseract containers ssh api      # prints: ssh root@api.<tailnet>.ts.net
```

Docker, Postgres and so on are installed inside the container as on any Debian server.

## 5. Publish a URL

Create the Cloudflare token (architecture note, "Cloudflare token") and connect it:

```sh
tesseract domains login < cf-token.txt
tesseract domains add app.example.com api 3000
```

The service must listen on `0.0.0.0:3000` inside the container. Remove a URL with
`tesseract domains rm app.example.com`. If Cloudflare or Docker state drifted, run
`tesseract domains sync`.

## 6. Deploy from a sandbox

Agents in the sandbox can deploy a directory with a compose file or a `Dockerfile` into an
existing server container, or ask the desktop app to create a new one for it. The desktop app on the host does the work, so it must be running
and connected to the sandbox. Design: [Sandbox deploys](../architecture/server-containers.md#sandbox-deploys),
[ADR 0013](../adr/0013-sandbox-deploys-to-server-containers.md).

### Choose the policy

Each container has **Allow sandbox deploys** (detail page, or the CLI). It is off by default:
every deploy then waits for your approval. Creating a new container for a deploy always asks,
whatever this switch says.

```sh
tesseract containers auto-deploy api on     # deploys run without asking
tesseract containers auto-deploy api off    # each deploy needs Approve (default)
```

Turn it on only for throwaway containers. Agents run with `bypassPermissions`, so anything in
the sandbox can request a deploy, and a container with routes serves it on your domain.

### Deploy

In the sandbox (an agent does this itself, following the managed `deploy` skill):

```sh
tesseract-controller deploy targets                  # containers this host accepts deploys for
cd /workspace/projects/myapp
tesseract-controller deploy api --port 3000          # tailnet URL only
tesseract-controller deploy api --port 3000 --hostname app.example.com   # plus a Cloudflare route
tesseract-controller deploy myapp --create --port 3000                    # new container, after your approval
tesseract-controller deploy myapp --create --cpus 2 --memory 2048 --port 3000   # with limits (MB)
tesseract-controller deploy ls                       # recent deploys; status <id>, cancel <id>
```

- The directory (`--dir`, default the current one) needs `compose.yml`/`compose.yaml`/
  `docker-compose.yml`/`docker-compose.yaml` or a `Dockerfile`. `.git` and `node_modules` are
  not sent. The limit is 512 MiB.
- The app must listen on `0.0.0.0`. Compose: publish the port (`ports: ["3000:3000"]`).
  Dockerfile: pass `--port`, which becomes `-p <port>:<port>`.
- The app lands in `/srv/tesseract/apps/<app>` inside the container (`<app>` = `--app`,
  default the directory name). Deploying the same app again replaces it.
- The command waits and exits 0 only when the deploy is `deployed`, printing the URLs.
- `--create` lets the deploy name a container that does not exist yet. Without it, an unknown
  name is refused with a hint to pass `--create`. Reserved names (`sandbox`, `tailscale`,
  `docker`, `host`, `localhost`, `targets`, `ls`, `status`, `cancel`) are refused.

### Approve

With the policy off, the desktop app shows a notification. Open the container's detail page
and choose **Approve** or **Reject**. Check the source path, the app name, the port and the
hostname first. A deploy that creates a container also shows the new name and its CPU and
memory limits: approving creates `tesseract-ct-<name>` and then deploys into it. A deploy
nobody approves is rejected after 30 minutes.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `deploy targets` shows no host, or the targets are empty | No desktop app sent a heartbeat in the last 60 s. Start the desktop app on the host and check that it is connected to this sandbox. Only existing server containers are listed: deploy with `--create <name>`, or create one on the host (`tesseract containers create <name>`) |
| The deploy stays `pending` | Same as above. A host that claimed it and went away releases it after 15 minutes |
| Container not accepted | Use a name from `deploy targets`, or pass `--create` to have the host create it (you approve it on the host). Reserved names are always refused |
| Refused: bundle too large, or no compose file or `Dockerfile` | Deploy the directory that holds the compose file or `Dockerfile`, and move large data and build outputs out of it (only `.git` and `node_modules` are skipped) |
| Failed with a sha256 or size mismatch | The bundle changed or was cut off in transit. Deploy again. If it repeats, check the sandbox's free disk space (`df -h /workspace`) and the connection to the host |
| Compose or build errors in the log | Read the log with `tesseract-controller deploy status <id>` (with dind, reproduce the build in the sandbox). Fix the compose file or `Dockerfile` and deploy again. To look inside the container: `tesseract containers ssh <name>`, then `cd /srv/tesseract/apps/<app> && docker compose -p <app> logs` (or `docker logs <app>`) |
| Deployed, but the URL does not answer | The app listens on `127.0.0.1`, or the port is not published. Make it listen on `0.0.0.0` and publish the port that `--port` names |
| Failed with a route conflict | The hostname is already routed to another container or port, or Cloudflare has a record Tesseract did not create. Pick another hostname, or remove the old route (`tesseract domains rm <hostname>`) and deploy again |
| `rejected` without anyone rejecting it | Nobody approved it within 30 minutes. Approve faster or turn the policy on for that container |

## macOS

On macOS, server containers and the sandbox run in one Colima VM that Tesseract manages
(profile `tesseract`, [ADR 0012](../adr/0012-macos-container-vm.md)). Sysbox is installed
inside it. Docker Desktop is not used.

### One command

`scripts/setup-mac.sh` does everything below in order and is safe to re-run: Homebrew and
the tools, Docker CLI plugins, quitting Docker Desktop and turning off its login start, the
VM config, starting the VM, checking Sysbox (re-provisioning if needed), `tesseract sandbox
build` and pairing, the Tailscale key and Cloudflare token, `tesseract containers build` and
`doctor`. Options: `--yes`, `--skip-sandbox`, `--skip-containers`; `TAILSCALE_KEY_FILE` and
`CLOUDFLARE_TOKEN_FILE` supply the secrets without prompts. It logs to
`~/Library/Logs/tesseract-setup-mac.log`. Its embedded `colima.yaml` is checked against the
app's generator by `src/core/vm/setup-script.test.ts`.

### Prerequisites

[Homebrew](https://brew.sh). `tesseract vm setup` installs `colima`, `docker`,
`docker-compose` and `docker-buildx` with it. If brew is missing, setup stops and prints
the install command.

### Move from Docker Desktop

1. Quit Docker Desktop and turn off **Settings → General → Start Docker Desktop when you
   sign in**. It may stay installed, but two VMs do not fit in 8 GB.
2. Create and start the VM (or Preferences → Containers → **Set up VM**, or
   **Tesseract VM (recommended)** in the setup wizard's Docker step):

   ```sh
   tesseract vm setup
   ```

3. The sandbox volumes stayed in Docker Desktop's VM. Build the sandbox again and pair
   the phone again:

   ```sh
   tesseract sandbox build
   tesseract sandbox up
   tesseract sandbox pair
   ```

4. In the Tailscale admin console, delete the old sandbox node (now offline). The new
   one joins under the same hostname, with a `-1` suffix until the old one is gone.

Then continue with steps 2 to 6 above.

### Verify

```sh
tesseract vm status            # State: running, Docker uses it: yes, Sysbox: yes
tesseract containers doctor
```

### Daily use on 8 GB

- The VM has 5 GiB and keeps it while it runs. Run one heavy job at a time.
- Stop server containers before Android builds:
  `tesseract containers stop <name>`, then `start` afterwards.
- New server containers get 1024 MB unless you pass `--memory`. Size each one:
  `tesseract containers create api --memory 1536`.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `can't resolve downloads.nestybox.com` | The VM has no DNS (`colima ssh -p tesseract -- cat /etc/resolv.conf` fails). Current Tesseract repairs it on boot; by hand: `colima ssh -p tesseract -- sudo sh -c 'rm -f /etc/resolv.conf && printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > /etc/resolv.conf'`, then `tesseract vm setup` |
| Containers check says Sysbox is missing | `tesseract vm setup` (safe to re-run: it checks that `sysbox-mgr` and `sysbox-fs` are active and runs the Sysbox install again if not). Check the services: `colima ssh -p tesseract -- systemctl status sysbox-mgr sysbox-fs`; the install log: `colima ssh -p tesseract -- sudo tail -n 50 /var/log/cloud-init-output.log` |
| `colima list` shows the `tesseract` VM as `Broken` (after a crash) | `tesseract vm start` (force-stops it, then starts it) |
| `docker` talks to the wrong daemon (Docker Desktop, another Colima profile) | `docker context use colima-tesseract` |
| VM stopped after a reboot | `tesseract vm start` |
| macOS needs all its RAM back | `tesseract containers stop <name>` for each, `tesseract sandbox down`, then `colima stop tesseract` (or `tesseract vm stop`) |
| VM is broken beyond repair | `colima delete tesseract`, then `tesseract vm setup`. This destroys the VM disk: every image, container and volume in it, including the sandbox workspace and home volumes and all server containers and their data. Rebuild and re-pair as in "Move from Docker Desktop", then recreate the server containers and their routes, and delete their old tailnet nodes |
