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

Then continue with steps 2 to 5 above.

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
| Containers check says Sysbox is missing | `tesseract vm setup` (safe to re-run: it checks that `sysbox-mgr` and `sysbox-fs` are active and runs the Sysbox install again if not). Check the services: `colima ssh -p tesseract -- systemctl status sysbox-mgr sysbox-fs`; the install log: `colima ssh -p tesseract -- sudo tail -n 50 /var/log/cloud-init-output.log` |
| `colima list` shows the `tesseract` VM as `Broken` (after a crash) | `tesseract vm start` (force-stops it, then starts it) |
| `docker` talks to the wrong daemon (Docker Desktop, another Colima profile) | `docker context use colima-tesseract` |
| VM stopped after a reboot | `tesseract vm start` |
| macOS needs all its RAM back | `tesseract containers stop <name>` for each, `tesseract sandbox down`, then `colima stop tesseract` (or `tesseract vm stop`) |
| VM is broken beyond repair | `colima delete tesseract`, then `tesseract vm setup`. This destroys the VM disk: every image, container and volume in it, including the sandbox workspace and home volumes and all server containers and their data. Rebuild and re-pair as in "Move from Docker Desktop", then recreate the server containers and their routes, and delete their old tailnet nodes |
