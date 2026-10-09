# Mac server (headless sandbox host)

Runs the sandbox stack and the host shell on a Mac on your tailnet, without the desktop app.
The Mac only needs Docker and Tailscale. There are two ways to install it:

- **On the Mac (simplest):** clone the repo there and run `./setup-server.sh` (see below).
- **From the Linux dev machine:** `bun run deploy:mac <mac>` builds the `tesseract` and
  `tesseract-controller` binaries for the Mac, copies them over ssh and runs
  `tesseract server install` there ([Deploy from Linux](#deploy-from-linux)).

## Fresh Mac: `./setup-mac.sh`

On a Mac with nothing installed yet, `./setup-mac.sh` does everything, including the steps that
need root. It asks for the admin password once (it keeps `sudo` alive while it runs) and runs
everything else as you; `sudo ./setup-mac.sh` also works and drops back to your user. In order:

1. `sudo pmset -a sleep 0 disksleep 0 autorestart 1` (`--keep-sleep` skips it, e.g. on a laptop).
2. Homebrew (non-interactive; it installs the Xcode Command Line Tools), then
   `brew install git rsync node` (node runs the Electron packaging scripts) and bun into `~/.bun`.
3. OrbStack (`brew install --cask orbstack`) unless Docker is already there, starts it and waits
   for the engine; the Tailscale app (`tailscale-app` cask), then waits while you sign in.
4. `./setup-server.sh` with `--hostname`, `--with`, `--rebuild` and `--yes` passed through
   (`--skip-server` skips it).
5. `bun run electron:dist` (the universal `apps/electron/dist/Tesseract-<v>-universal.dmg`) and
   installs `Tesseract.app` into `/Applications`, owned by you. Without a Developer ID identity
   it builds unsigned and ad-hoc signs the installed app, which runs on this Mac only
   (`--skip-app` skips the step).

Automatic login (System Settings → Users & Groups) still has to be turned on by hand.

## Quick start: `./setup-server.sh` on the Mac

```bash
git clone <repo-url> tesseract-mobile && cd tesseract-mobile
./setup-server.sh                 # re-run after `git pull` to update
```

Before running it, install and open OrbStack (`brew install --cask orbstack`) or Docker Desktop,
and install the Tailscale app and sign in. The script checks for both and stops with
instructions if either is missing. It never runs `sudo`. When something needs root it prints
the command and waits for you to run it in another terminal. In order, it:

1. Checks git, curl, rsync, Docker (starts OrbStack/Docker Desktop if it is installed but not
   running), docker buildx and Tailscale. It installs bun into `~/.bun` if bun is missing.
2. Root settings: prints `sudo pmset -a sleep 0 disksleep 0` and `sudo pmset -a autorestart 1`
   if they aren't set yet. It also reminds you to turn on automatic login (System Settings →
   Users & Groups; needs FileVault off), because Docker and the host shell only start after a
   login. On Linux it prints `sudo loginctl enable-linger $USER` instead, and adds
   `usermod -aG docker` when you are not in the docker group.
3. Runs `bun install`, builds `tesseract` and `tesseract-controller` for this machine (mac-arm64 or
   mac-x64), copies them to `~/.tesseract/bin`, copies the sandbox build context to
   `~/.tesseract/sandbox`, and adds `~/.tesseract/bin` to `PATH` in `~/.zprofile`.
4. Secrets, each read from the environment or asked for with hidden input:
   - The tailnet domain, detected from `tailscale status`.
   - `TS_AUTHKEY`, asked for only on the first install. Create a key at
     https://login.tailscale.com/admin/settings/keys.
   - `CLAUDE_CODE_OAUTH_TOKEN`, made with `claude setup-token`; see step 5 below. Press Enter to
     skip it.
   Saved values are reused on later runs.
5. Asks for the host shell PIN if none is set yet.
6. Runs `tesseract server install --mode tailscale --hostname tesseract --with <components>`.
   It adds `--build` on the first run, and again whenever the sandbox files changed since the
   last build. Components default to `flutter,whisper` on Apple silicon and `all` on Intel.
   Install starts the sandbox, installs the `dev.tesseract.host-shell` LaunchAgent, runs
   `tailscale serve` on :8443 and prints both pairing QR codes.

Options: `--hostname NAME`, `--with LIST`, `--rebuild` (force an image rebuild), and `--yes`
(never stop to ask; fail if a secret is missing). Afterwards, from a new shell:
`tesseract server status`, `tesseract server pair`, `tesseract sandbox logs`.

Contract: [blueprint §7.2](../architecture/00-blueprint.md#72-headless-server-tesseract-server-macos-and-linux).
Related: [tesseract-cli.md](tesseract-cli.md#server), [host-shell.md](host-shell.md),
[networking-tailscale.md](../architecture/networking-tailscale.md),
[security-model.md](../architecture/security-model.md).

```
phone ──tailnet──▶ https://tesseract-sandbox.<tailnet>.ts.net        sandbox controller (tailscale sidecar)
      ──tailnet──▶ https://<mac>.<tailnet>.ts.net:8443            host shell (tailscale serve → <mac ip>:7701)
Linux dev box ──ssh──▶ mac: ~/.tesseract/bin/{tesseract,tesseract-controller}, ~/.tesseract/sandbox/
```

## Prepare the Mac (once)

1. **Docker.** Install [OrbStack](https://orbstack.dev) (recommended for a headless machine:
   it starts at login without a window, uses less memory and its CLI lives in
   `~/.orbstack/bin`) or Docker Desktop. Turn on "start at login". Check: `docker info`.
2. **Tailscale.** Install the Tailscale app, sign in, and enable MagicDNS and HTTPS
   certificates for the tailnet (admin console → DNS). Check: `tailscale ip -4`. The app's CLI
   is `/Applications/Tailscale.app/Contents/MacOS/Tailscale`; the deploy script and the host
   shell find it there when `tailscale` is not on `PATH`.
3. **Remote login.** System Settings → General → Sharing → Remote Login (the Tailscale *app*
   can't be an SSH server on macOS; plain ssh over the tailnet works). Put your Linux key in
   `~/.ssh/authorized_keys` on the Mac: `ssh <mac> true` must work without a password prompt.
4. **Stay up.** Docker Desktop and OrbStack run inside a user session, so the Mac needs a
   logged-in user after a reboot:
   - System Settings → Users & Groups → automatic login for the deploy user (needs FileVault off),
     or log in once after every reboot.
   - Never sleep: `sudo pmset -a sleep 0 disksleep 0 displaysleep 10 autorestart 1`
     (`autorestart` powers it back on after a power cut).
5. **Claude login.** Claude Code on macOS keeps its login in the keychain, which the sandbox
   cannot read, so the bind-mounted `~/.claude` has no credentials. Make a long-lived token
   on the Mac and keep it for the deploy:
   ```bash
   mkdir -p ~/.claude        # the compose bind mount refuses a missing directory
   claude setup-token        # prints a token; export it as CLAUDE_CODE_OAUTH_TOKEN on the Linux box
   ```
6. **Tailscale auth key** for the sandbox's own tailnet node: admin console → Settings → Keys →
   generate an auth key (reusable off, pre-approved, optionally tagged). It is used on the first
   start only.

## Deploy from Linux

```bash
export TS_AUTHKEY=tskey-auth-...            # first deploy only
export TS_TAILNET_DOMAIN=tail1234.ts.net
export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat...
bun run deploy:mac mac-mini                 # any ssh host: user@mac, an ~/.ssh/config alias, a tailnet name
```

The script:

1. checks ssh, `uname` (Darwin), Docker (engine running) and Tailscale (connected) on the Mac;
2. picks `mac-arm64` (Apple silicon) or `mac-x64` (Intel) from `uname -m` (`--arch arm64|x64` to force);
3. runs `cli:build --target mac-<arch>` and `bundle:sandbox` (`--skip-build` reuses the last build);
4. copies the binaries to `~/.tesseract/bin/` and the sandbox build context to `~/.tesseract/sandbox/`;
5. sends `TS_AUTHKEY`, `TS_TAILNET_DOMAIN` and `CLAUDE_CODE_OAUTH_TOKEN` over ssh stdin into a 0600
   `~/.tesseract/secrets.env`, which the remote side reads and deletes before the install runs
   (secrets never appear on a command line or in the output);
6. runs `tesseract server install` on the Mac, with `TESSERACT_SANDBOX_CONTEXT=~/.tesseract/sandbox`.

Arguments after `--` go to `tesseract server install`:

```bash
bun run deploy:mac mac-mini -- --mode tailscale --hostname tesseract-sandbox
bun run deploy:mac mac-mini -- --build --with whisper          # build the image on the Mac
bun run deploy:mac mac-mini -- --image ghcr.io/you/tesseract-sandbox:1.2.3   # pull instead of building
bun run deploy:mac mac-mini -- --dry-run                        # show what install would do
```

`tesseract server install` writes the sandbox env file
(`~/Library/Application Support/Tesseract/sandbox/.env`, 0600), pulls or builds the image, starts
the compose stack (it restarts with Docker: `restart: unless-stopped`), installs the host shell
LaunchAgent and the `tailscale serve` HTTPS front for it, and prints both pairing links.

Then, once:

```bash
ssh -t mac-mini ~/.tesseract/bin/tesseract-controller host pin     # 6-12 digit PIN for the host shell
ssh -t mac-mini ~/.tesseract/bin/tesseract server pair
```

Scan both QR codes with the phone app (sandbox, then **Host shell**). To use `tesseract` on the
Mac directly, add to `~/.zprofile` there:

```bash
export PATH="$HOME/.tesseract/bin:$PATH"   # the CLI finds ~/.tesseract/sandbox next to its bin/ directory
```

## Apple silicon limits

The sandbox image builds natively for arm64, but without:

- **Wine / Windows Electron builds.** `wine32:i386` does not exist for arm64 Debian, so the
  wine layer (`WITH_MONO`) is skipped.
- **The Android SDK.** Google ships the Linux build-tools and platform-tools for x86_64 only, so
  `WITH_ANDROID` (and Flutter Android) is skipped; Android builds stay on the Linux machine.

If you need either on an Apple silicon Mac, build the image for `linux/amd64` and run it under
emulation (Rosetta in OrbStack/Docker Desktop): it works, but builds are several times slower.
Intel Macs have none of these limits.

The host Android emulator (host shell → Android) runs on the Mac with HVF, but it cannot be
linked to the sandbox on macOS (no network namespaces; isolation is `none`), and it needs the
Android SDK, `adb` and `scrcpy` (`brew install scrcpy`) on the Mac.

## Update

Run the same deploy again: `bun run deploy:mac mac-mini` (no auth key needed after the first
start; the sidecar keeps its tailnet identity in the `tesseract-tailscale` volume). The stack is
recreated with the new image; volumes, the controller token and the host shell token and PIN
stay, so nothing has to be paired again.

Upgrading a server installed before the rename to Tesseract: deploy the same way.
`tesseract server install` renames the legacy env keys, stops the old `theone` stack and copies
its volumes first, so pairing and the host shell PIN stay; see
[rebrand-migration.md](rebrand-migration.md) for what to check afterwards.

## Uninstall

```bash
ssh -t mac-mini ~/.tesseract/bin/tesseract server uninstall
ssh -t mac-mini '... tesseract server uninstall --volumes'   # also deletes /workspace and /home/dev
ssh mac-mini 'rm -rf ~/.tesseract'
```

## Logs and status

```bash
tesseract server status                             # stack, controller health, host shell service
tesseract sandbox logs --tail 200 --follow          # container logs
tail -f ~/Library/Logs/Tesseract/*.log              # host shell daemon
launchctl print gui/$(id -u)/dev.tesseract.host-shell   # service state, last exit code
launchctl kickstart -k gui/$(id -u)/dev.tesseract.host-shell   # restart the host shell
tailscale serve status                              # the HTTPS front for the host shell
```

## Troubleshooting

**`launchctl bootstrap` fails with `Bootstrap failed: 5: Input/output error`**
→ launchd had not finished removing the previous host shell service (`bootout` right before).
`tesseract server install` retries the bootstrap 5 times, 1 s apart. → If it still fails, run
`launchctl bootout gui/$(id -u)/dev.tesseract.host-shell`, wait a few seconds and install again.

**`deploy-mac: docker is installed on <mac> but the engine is not running`**
→ OrbStack / Docker Desktop is not started (no logged-in user after a reboot). → Log in, or
turn on automatic login and "start at login".

**`deploy-mac: tailscale not found` / host shell won't start: no bind address**
→ The Tailscale CLI is not on `PATH` and not in `/Applications/Tailscale.app`. → Install the
Tailscale app there, or set `TESSERACT_HOST_SHELL_BIND=<tailscale ip>` for the service.

**Agents fail with "not logged in" in the sandbox**
→ No `CLAUDE_CODE_OAUTH_TOKEN` (the keychain login is invisible to the container). → Run
`claude setup-token` on the Mac and deploy again with the token exported.

**`compose up` fails on the `~/.claude` bind mount**
→ `~/.claude` does not exist on the Mac. → `mkdir -p ~/.claude` (the deploy script does this).

**The phone can't reach the host shell over http**
→ iOS refuses plain http to the Tailscale IP. → Check `tailscale serve status` shows
`https://<mac>.<tailnet>.ts.net:8443 → http://<ip>:7701`, and HTTPS certificates are enabled for
the tailnet.

**Image build fails on Apple silicon in the wine or Android stage**
→ An arm64 build with `--with mono` or `--with android`. → Build without them, or for
`linux/amd64` (see [Apple silicon limits](#apple-silicon-limits)).

## Security

- Everything is tailnet-only: the sandbox controller is only reachable through its tailscale
  sidecar, the host shell only binds the Mac's Tailscale IP. Nothing is published on the LAN.
- One bearer token per sandbox; there are no per-device tokens. A lost phone means rotating
  the token, a restart and re-pairing every device ([operations.md](operations.md)); for the
  host shell, `tesseract-controller host token --rotate`.
- The host shell is a real shell on the Mac as the deploy user: host token **and** PIN,
  15-minute sessions, exponential lockout after 5 wrong PINs. Use a long PIN.
- Claude inside the sandbox runs with `bypassPermissions` by default
  (`TESSERACT_CLAUDE_PERMISSION_MODE`): the container is the trust boundary. Don't mount more of the
  Mac into it than `~/.claude`, and keep `--dind` and `--tailscale-api` off unless you need them.
- `CLAUDE_CODE_OAUTH_TOKEN` and the auth key end up in the 0600 sandbox env file on the Mac;
  the auth key is blanked after the first `up`.
