# Getting started

From an empty host to a paired phone that is watching an Electron app built
in the sandbox. Allow about an hour, most of it spent on the first image build.

## 0. Prerequisites

| Where | Needs |
|---|---|
| Host | Linux x86_64, Docker Engine 24+ with Docker Compose 2.24+ and BuildKit, about 40 GB free disk (the image with Android and wine is large; volumes grow with projects), 8 GB+ RAM available to the sandbox |
| Operator machine (usually the host) | [bun](https://bun.sh) 1.3+ and git. Nothing else is installed on the host |
| Tailscale | an account; admin console → **DNS**: MagicDNS **on**, HTTPS Certificates **enabled**; an **auth key** |
| Phone | the Tailscale app, logged into the same tailnet; the Tesseract app as a development build (step 5) |

Tesseract never installs anything on the host and never touches host Tailscale,
firewall or Docker daemon configuration.

## 1. Tailscale: tag and auth key

1. In the ACL editor, add a tag owner and a grant (adjust `src` to your user):

   ```jsonc
   "tagOwners": { "tag:tesseract": ["autogroup:admin"] },
   "grants": [ { "src": ["autogroup:member"], "dst": ["tag:tesseract"], "ip": ["tcp:443", "tcp:5901"] } ]
   ```

2. **Settings → Keys → Generate auth key**: reusable off, ephemeral off,
   pre-approved on, tags `tag:tesseract`. Copy the `tskey-auth-…` value.
3. Note your tailnet DNS name (DNS page, e.g. `tail1234.ts.net`).

Background: [networking-tailscale.md](../architecture/networking-tailscale.md).

## 2. Configure

```bash
git clone <this repository> tesseract && cd tesseract
cp infra/compose/.env.example infra/compose/.env
chmod 600 infra/compose/.env
$EDITOR infra/compose/.env
```

Minimum settings for the default (`tailscale`) mode:

| Variable | Example | Notes |
|---|---|---|
| `TS_AUTHKEY` | `tskey-auth-…` | used on first login only; the node key then lives in the `tesseract-tailscale` volume |
| `TESSERACT_MODE` | `tailscale` | or `host-tailscale` / `local` |
| `TS_TAILNET_DOMAIN` | `tail1234.ts.net` | the controller's public URL becomes `https://$TESSERACT_HOSTNAME.$TS_TAILNET_DOMAIN` |
| `TESSERACT_HOSTNAME` | `tesseract-sandbox` | Tailscale node name and sandbox id |
| `SANDBOX_CPUS` / `SANDBOX_MEMORY` / `SANDBOX_PIDS` | `4` / `8g` / `4096` | resource limits |
| `TESSERACT_VNC_PASSWORD` | *(empty)* | empty = generate one on first start. VncAuth uses 8 characters |
| `WITH_ANDROID` / `WITH_MONO` | `true` / `true` | `false` for a smaller, faster image |
| `TESSERACT_HOST_CLAUDE_DIR` | *(empty)* = `$HOME/.claude` | the host's Claude Code dir, mounted at `/home/dev/.claude`; log in there with `claude` (Claude Max). This is the only Claude authentication |
| `TESSERACT_HOST_CLAUDE_ACCOUNTS` | *(empty)* | extra accounts, e.g. `"work personal"`: each existing `~/.claude-<name>` (or `name=/abs/path`) is mounted at `/home/dev/.claude-<name>` the same way; missing dirs are skipped with a warning |

`infra/compose/.env` is gitignored. It holds the auth key, so keep it `0600`.
Every variable is documented in `.env.example` and in
[blueprint §4.2](../architecture/00-blueprint.md#42-stack-and-operator-infracomposeenv-infrascriptssandbox).
To keep several configurations, pass `--env-file <path>` to `bun run sandbox`
(only that file is read then).

## 3. Build and start

```bash
bun install                      # workspace dependencies; keeps bun.lock in sync for the image build
bun run sandbox config > /dev/null && echo config ok   # validates .env interpolation and the chosen mode
bun run sandbox up --build       # builds tesseract/sandbox:latest, starts tailscale + sandbox
bun run sandbox status           # containers + controller status
bun run sandbox doctor           # tesseract-doctor inside the sandbox: display, VNC, controller, wine, Android, disk
```

The mode comes from `TESSERACT_MODE` in `.env` (default `tailscale`), or from
`bun run sandbox <command> --mode <mode>` for a single command. Right after `up`,
`doctor` may warn that the controller is still `STARTING`; run it again a few
seconds later.

Before a real deployment you can check the image and stack end to end on
loopback, without Tailscale: `bun run e2e` (about 3–5 minutes on a warm cache,
see [e2e-testing](e2e-testing.md)).

The first build downloads Debian packages, Node, wine (with i386), and the
Android SDK and JDK. Later builds are cached. When it is up:

```bash
bun run sandbox logs tailscale -f   # look for the node coming online and the serve config being applied
curl -fsS https://tesseract-sandbox.tail1234.ts.net/v1/health   # from any tailnet device
# {"ok":true,"version":"0.1.0","protocolVersion":1,"sandboxId":"tesseract-sandbox"}
```

Other modes: `local` (loopback only, for development) and `host-tailscale`
(reuse the host's Tailscale). See
[networking-tailscale.md → modes](../architecture/networking-tailscale.md#modes).

## 4. Pair

```bash
bun run sandbox pair
```

This prints `tesseract://pair?url=https%3A%2F%2Ftesseract-sandbox.tail1234.ts.net&token=…&name=tesseract-sandbox`
and a QR code. The token is a secret. Details:
[pairing-mobile.md](pairing-mobile.md).

## 5. Run the app (development build)

The app uses `react-native-webview` (terminal and VNC pages) and `expo-camera`
(QR scanning), both with native code, so build a development client once:

```bash
cd apps/mobile
bun run android          # expo run:android: builds and installs the dev client on a connected device or emulator
# or: bun run ios        (macOS + Xcode)
# or: an EAS development build (eas build --profile development --platform ios)
#     it installs as "Tesseract Dev" (com.kevinroan.tesseract.dev) next to the production app;
#     APP_VARIANT picks the variant (eas.json env, EAS environments, .env.development for expo start)
#     JS-only changes ship with: bun run update:development | update:preview | update:production --message "…"
#     (these pin APP_VARIANT; a bare `eas update` picks up .env.development, gets the dev
#     fingerprint and never reaches preview/production builds)
#     native changes need a new build first: see docs/runbooks/mobile-updates.md
cd ../.. && bun run mobile   # Metro for the dev client
```

On the phone: Tailscale connected → open Tesseract → **Agents** tab → **Pair a
sandbox** → scan the QR code. The Agents tab becomes the sandbox hub:
connection state, CPU, memory, disk and display, quick actions (Display,
Terminal, Claude, Build), projects, running processes, sessions, builds and
Claude runs.

## 6. First build and look

1. Copy the example project into the sandbox, as `dev` so the files are owned correctly:

   ```bash
   tar -C examples -c electron-hello | docker exec -i -u dev tesseract-sandbox-1 tar -C /workspace/projects -x
   ```

   For your own repositories use **Add** on the Projects section of the Agents
   tab (name, git URL, optional branch): the app follows the clone and opens
   the project when it finishes.

2. In the app: Agents tab → **Projects** → `electron-hello` → **Build** →
   **Windows installer** (`electron-windows`), profile **Debug**. Watch the stages on the build screen. The
   artifact `electron-hello-windows-debug-1.0.0.exe` appears under Artifacts.
3. Build **Linux AppImage** (`electron-linux`) the same way. On the same
   project screen, **Scripts** → `start` with **Show on display** → **Run**.
   Then open **Display** (a quick action on the Agents tab). You see and
   control the Electron window from the phone. npm 11 skips dependency install
   scripts it has not been told to trust; if the process log says "Electron
   failed to install correctly", run
   `npm install-scripts approve electron && npm rebuild electron` in a terminal
   in the project first ([details](../architecture/electron-windows-wine.md#npm-11-install-script-approval)).
   The Windows installer is verified as a file (size, sha256); running Windows
   Electron builds under wine is best-effort.
4. From the project screen's header, choose **Open an interactive Claude Code
   session**, log in once ([claude-in-sandbox.md](claude-in-sandbox.md)), and
   ask it to change the window title and rebuild.

## Next

- [operations.md](operations.md): upgrades, backups, token rotation, limits
- [troubleshooting.md](troubleshooting.md)
- [security-model.md](../architecture/security-model.md): read this before enabling dind or sharing the tailnet
