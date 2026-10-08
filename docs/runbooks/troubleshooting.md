# Troubleshooting

Format: **symptom** → cause → fix. Start with `bun run sandbox status` and
`bun run sandbox doctor` (it runs `tesseract-doctor` inside the sandbox, the same
command Claude can run). They cover most of the causes below.

Useful places:

| What | Where |
|---|---|
| Container logs | `bun run sandbox logs [sandbox\|tailscale\|docker] [-f]` |
| supervisord program logs | `/workspace/.agent/logs/supervisor/{xvnc,openbox,controller,wine-init,supervisord}.log` |
| Controller log level | `TESSERACT_LOG_LEVEL=debug` in `.env`, then `bun run sandbox up` |
| Process and build logs | the app, or `/workspace/.agent/controller/logs/<id>.log` |
| Program state | `supervisorctl status` in a sandbox shell |
| Live state summary | `/workspace/.agent/RUNTIME.md` |
| Tool versions | `/workspace/.agent/ENVIRONMENT.md` |

## Stack and image

**After upgrading to Tesseract, the sandbox is empty, uses the old name, or the tailnet node is `tesseract-sandbox-1`**
→ The install predates the rename: an old value in `.env`, a stale node in the Tailscale
admin console, or a custom project/volume prefix (the volume copy is skipped then).
→ Follow [rebrand-migration.md](rebrand-migration.md).

**`bun run sandbox up --build` fails in `controller-build` with a lockfile error**
→ `bun.lock` does not match the manifests (a dependency was added without
`bun install`). → Run `bun install` at the repository root, then rebuild.

**Build fails downloading Node, the Android cmdline-tools or wine packages**
→ Network issue or a changed upstream checksum. → Retry. For the Android
tools, update `ANDROID_CMDLINE_TOOLS_BUILD` and `ANDROID_CMDLINE_TOOLS_SHA256`
together. Build without Android (`WITH_ANDROID=false` in `.env`) to unblock.

**The image is huge or the build is slow**
→ The Android SDK and mono are the largest parts. → Set `WITH_ANDROID=false`
and/or `WITH_MONO=false` in `.env` if you do not need them.

**The sandbox container restarts in a loop**
→ The entrypoint failed (for example volume ownership), or supervisord could
not start. → `bun run sandbox logs sandbox`. To inspect the volumes without
supervisord, start a throwaway shell (any arguments replace supervisord):
`docker run --rm -it -v tesseract-workspace:/workspace -v tesseract-home:/home/dev tesseract/sandbox:latest bash`.

**`sandbox doctor` warns `supervisor … still starting` right after `up`**
→ supervisord has not yet moved the controller from `STARTING` to `RUNNING`
(it needs 3 s of uptime). → Run it again a few seconds later. Only `FAIL`
lines make it exit 1.

**`sandbox` refuses the bind address or a port**
→ `host-tailscale` accepts only an IPv4 address of the host (no `0.0.0.0`,
`::`, `[::0]`, host names); ports must be 1–65535 without leading zeros;
the project name must be lowercase letters, digits, `-` and `_`. → Fix the
value in the env file.

**`sandbox up` of a second stack clashes with the first (port in use, volumes shared)**
→ Both use the same `TESSERACT_COMPOSE_PROJECT` or host ports. → Give each stack
its own env file ([operations](operations.md#run-more-than-one-stack)).

**An existing workspace still tells Claude to use `curl` with the token**
→ Agent templates are seeded only when missing, so `GLOBAL_CONTEXT.md` and
`COMMANDS.md` from an older image remain. → Compare with
`/etc/tesseract/agent-templates/` and update them; also check `~/.claude/CLAUDE.md`
against `/etc/tesseract/SPEC.md`.

**The controller does not start: "Could not read the token file"**
→ `/workspace/.agent/controller/token` exists but is empty (for example after
a full disk). → Delete it; a new token is generated at the next start, so
re-pair the phones.

**Health check `unhealthy`**
→ The controller is not answering on 7700. → Check
`/workspace/.agent/logs/supervisor/controller.log`. `supervisorctl status controller`
shows whether it is `FATAL` (it crashed 10 times in a row). Fix the cause,
then `supervisorctl start controller`.

## Connectivity

**The phone cannot reach `https://tesseract-sandbox.<tailnet>.ts.net`**
→ One of: Tailscale on the phone is off or on another tailnet; the node never
logged in; ACLs block it; MagicDNS is off.
→ Check `bun run sandbox logs tailscale` for the auth URL or "invalid key". Run
`docker exec tesseract-tailscale-1 tailscale status` and check that the
node is online. In the admin console, check that the machine exists and is
not expired, and that the ACL grants your user `tcp:443`. On the phone, open
the Tailscale app and confirm the node is listed.

**The node shows as `tesseract-sandbox-1` instead of `tesseract-sandbox`**
→ An old node with the same name still exists in the tailnet. → Delete the old
machine in the admin console. The name frees up, and after a restart the node
takes it. Update `TESSERACT_HOSTNAME` if you want a different one.

**The auth key was accepted once, then "needs login" after recreating**
→ The `tesseract-tailscale` state volume was removed, or the key was single-use
and has been consumed. → Create a new key, put it in `.env`, and run
`bun run sandbox up`.

**TLS errors or a long first request**
→ HTTPS certificates are not enabled, or serve is still obtaining the first
certificate. → Enable HTTPS in the admin console (DNS page). The first
request after start can take several seconds. Check
`docker exec tesseract-tailscale-1 tailscale serve status`.

**`/v1/health` works but everything else returns 401**
→ Wrong or rotated token. → Pair again (`bun run sandbox pair`).

**WebSockets fail (events, terminal, VNC) while REST works**
→ Expired or reused ticket (tickets live 60 s and work once), or a proxy
stripped the upgrade. → The app fetches a fresh ticket per connection and
reconnects on its own (terminal and display pages up to 4 times); reopen the
screen if it gave up. When calling from scripts, request a ticket immediately
before connecting. A plain `GET` on a WebSocket path answers 400 by design.

**A log or Claude run stream stops with "Can't reach the sandbox"**
→ The stream dropped 5 times in a row without ever opening, usually because
the process or run no longer exists (a WebSocket cannot tell a 404 from a
network error). → Go back and reopen it from the list.

**`host-tailscale` mode: the ports are not reachable**
→ `TESSERACT_BIND_ADDR` is not the host's current tailnet IP, or host ACLs
block it. → `tailscale ip -4` on the host, update `.env`, run `bun run sandbox up`.

## Pairing and the app

**A pairing link or QR code opens nothing, or opens the old app**
→ The app was renamed and has a new bundle id; links are `tesseract://pair…` now. →
Install the Tesseract app and pair again with a fresh link
([rebrand-migration.md §4](rebrand-migration.md#4-phone)).

**The QR code does not scan**
→ The terminal font or size distorts it. → Enlarge the terminal, use
`bun run sandbox pair` in a dark-on-light terminal, or use the printed link
instead: open it on the phone (`tesseract://pair?...`) or paste it into the
app's manual entry.

**The pairing link URL is `https://tesseract-sandbox` without the tailnet domain (TLS fails)**
→ `TS_TAILNET_DOMAIN` was empty when the container was created, so
`TESSERACT_PUBLIC_URL` became `https://<TESSERACT_HOSTNAME>.` (`sandbox up` refuses
to start in this state, so the stack was started some other way).
→ Set `TS_TAILNET_DOMAIN=<tailnet>.ts.net` in `.env` (shown under DNS in the
admin console) and run `bun run sandbox up`.

**The pairing link points to `http://127.0.0.1:7700`**
→ The stack runs in `local` mode, or the container was started without a mode
overlay. → Use the mode you intend (`--mode tailscale`, see
[networking](../architecture/networking-tailscale.md#modes)).

**"Pairing no longer valid" or "Version mismatch" on the Agents tab**
→ The token was rotated (401/403), or app and controller disagree on
`protocolVersion`. → **Pair again** with a fresh `bun run sandbox pair`, or
update the app/image ([pairing](pairing-mobile.md#re-pairing)).

**Every tab is blank in the web build (`expo start --web` / static export)**
→ Known issue in `apps/mobile/src/components/app-tabs.web.tsx`: the tab
triggers are nested too deep for expo-router's `TabList`. Native builds are
unaffected. → See [mobile-app.md](../architecture/mobile-app.md#web-build).

**`eas update` published, but the installed app does not get it ("This is the latest update")**
→ The runtime version is a native fingerprint. A native change since the build
(a native package, a config plugin option) gave the update a different runtime
version than the app shows under **Settings → About**. → Make a new EAS build
and install it; check with `eas fingerprint:compare` before publishing
([mobile-updates.md](mobile-updates.md)).

**Terminal or Display screens are blank in Expo Go**
→ `react-native-webview`/`expo-camera` versions in Expo Go differ from the app.
→ Use a development build ([mobile-app.md](../architecture/mobile-app.md#dev-build-requirement)).

## Display and VNC

**The Display screen says the display or VNC is down**
→ The app only loads noVNC while `display.available` and
`display.vnc.available` are both true; `vnc.available` needs a real RFB
banner on 5901. → Check as below, then tap **Check again**.

**`display.available: false` / black noVNC screen**
→ Xvnc is not running, or it is stuck on a stale lock. → `supervisorctl status xvnc`,
then `/workspace/.agent/logs/supervisor/xvnc.log`. `supervisorctl restart xvnc openbox`.
The launcher removes stale locks automatically.

**noVNC shows "Authentication failed"**
→ The password changed (`TESSERACT_VNC_PASSWORD` edited in `.env`), but the
container still runs with the old environment. → `bun run sandbox up`
recreates it, and the entrypoint rewrites both the passwd file and the
controller's copy. `restart` alone does not re-read `.env`.

**A native VNC client cannot connect to port 5901**
→ An ACL does not grant `tcp:5901`, or it is not in the serve config. →
Adjust the ACL. The serve config always includes 5901.

**Windows without title bars, or that cannot be moved**
→ openbox is not running. → `supervisorctl restart openbox`.

**The app window is black (Electron/Chromium)**
→ There is no GPU. → Start it with `--disable-gpu`. Electron also needs
`--no-sandbox` in this container.

**The screen is too small to read on the phone**
→ The phone scales 1600×900 down, and the app is locked to portrait. → Zoom in
noVNC, or set `TESSERACT_DISPLAY_GEOMETRY=1280x800` in `.env` and run
`bun run sandbox up`.

## Builds

**`POST /v1/builds` answers 503**
→ The recipe needs `wine` (Windows) or `java` (Android) and the image lacks it
(`WITH_ANDROID=false`). → Rebuild the image with it.

**`POST /v1/processes` answers 409 "Port … is already in use"**
→ Another tracked process or a leftover program holds the port; the message
names it. → Stop it (`DELETE /v1/processes/<id>`, or by pid) or pick another port.

**A dev server started with `&` disappeared**
→ The controller stops everything a process, build step, headless run or
terminal left in the background when that command ends. → Start servers as
their own tracked process (`POST /v1/processes`).

**The Windows Electron app shows no window under wine**
→ Known with Electron 44 on wine 10.0. → Smoke-test the Linux build;
verify the Windows installer by size and sha256
([details](../architecture/electron-windows-wine.md#smoke-testing)).

**`npm start` in an Electron project: "Electron failed to install correctly"**
→ npm 11 skipped `electron`'s install script. → `npm install-scripts approve
electron && npm rebuild electron` in the project.

**`electron-windows` hangs or fails in `wine`**
→ See the [Electron runbook](electron-builds.md#6-common-failures). The usual
fixes are resetting the prefix ([operations](operations.md#reset-the-wine-prefix))
and `wineserver -k`.

**Android build is killed (`exit 137`)**
→ Out of memory. → Lower Gradle heap, stop other processes, raise
`SANDBOX_MEMORY` ([Android runbook](android-builds.md#limits)).

**A build stays `queued`**
→ Another build is running (builds run one at a time). → Wait, or cancel the running one.

**The build fails with "No artifacts from this build matched …"**
→ Only files written after the build started are collected, and none matched.
Either the packager wrote nothing new, or it wrote files the patterns do not
cover. For example, the project's
electron-builder config produces only `zip`/`portable` output while the recipe
collects `*.AppImage`/`*.deb`/`*.exe`, or an Android flavor writes outside
`apk/<profile>/`. → Check the build log for the output paths and the patterns
in [controller.md](../architecture/controller.md#build-queue-and-recipes).
Adjust the project config, or copy the file to `/workspace/artifacts/` with
the naming convention.

**A process shows `stopped` or `orphaned` after a restart**
→ The controller stopped it on shutdown (`stopped`), or was killed while it
ran (`orphaned`). The controller never re-runs processes. An `orphaned`
process may still be running untracked. → Find it with `ss -ltnp` or
`ps -ef`, stop it by pid, then start it again if it is still needed.

## Claude

**`claude` asks to log in again**
→ The host's `~/.claude` is not logged in, or it is not mounted at
`/home/dev/.claude` (check `ls ~/.claude/.credentials.json` in `bun run sandbox shell`).
→ Log in on the host and recreate the sandbox if the mount is missing
([claude-in-sandbox](claude-in-sandbox.md#1-log-in-on-the-host)).

**A headless run ends immediately with an auth error**
→ The host is not logged in (the run fails within a second: "Not logged in ·
Please run /login"; `tesseract-doctor` warns `claude-auth`). → Log in with `claude`
(Claude Max) on the host (`~/.claude` is bind-mounted into the sandbox).

**Claude ignores the SPEC rules**
→ `/etc/claude-code/CLAUDE.md` is outdated. → rebuild the image with `bun run sandbox up --build`
([claude-in-sandbox](claude-in-sandbox.md#2-specmd-as-the-managed-claudemd)).

## Resources

**The disk is full (`ENOSPC`)**
→ Artifacts, caches or dind images. → `du -sh /workspace/* /home/dev/.cache/* 2>/dev/null | sort -h`.
Delete old artifacts, run `npm cache clean --force` and
`rm -rf ~/.gradle/caches/build-cache-*`. With dind, run `docker system prune`
inside the sandbox (it only touches the dind daemon). On the host:
`docker system df -v` to see the volume sizes.

**`bun run e2e` fails**
→ See [e2e-testing → when it fails](e2e-testing.md#when-it-fails).

**Everything is slow**
→ CPU or memory limits are reached. → `tesseract-controller status`, or `htop` in a
sandbox shell. Raise `SANDBOX_CPUS`/`SANDBOX_MEMORY` in `.env` and run
`bun run sandbox up`.
