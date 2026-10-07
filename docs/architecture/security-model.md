# Security model

TheOne deliberately runs an autonomous agent with `bypassPermissions`,
together with untrusted project code, on a machine reachable from a phone.
The design goal is containment, not prevention: assume anything inside the
sandbox can be compromised, and make sure that compromise stays inside the
sandbox and is reachable only over the tailnet.

Related: [overview → trust boundaries](overview.md#trust-boundaries),
[ADR 0003](../adr/0003-single-sandbox-container-with-tailscale-sidecar.md),
[ADR 0006](../adr/0006-optional-docker-in-docker.md),
[ADR 0007](../adr/0007-auth-bearer-token-and-one-time-tickets.md),
[SPEC.md §2](../../SPEC.md#2-isolation-and-safety).

## Assets

| Asset | Where | Why it matters |
|---|---|---|
| Host integrity | the Docker host, which also runs unrelated services | the only hard requirement: the host must stay untouched |
| Source code and user work | `theone-workspace` volume | loss or leakage of the user's projects |
| Controller token | `/workspace/.agent/controller/token` (0600, in a 0700 dir), `/run/theone/controller.env` when set through compose, the controller's environment, phone secure store | equivalent to a shell in the sandbox |
| Claude credentials | `/home/dev/.claude/` (`theone-home` volume) | billable account access |
| Tailscale auth key and node key | `infra/compose/.env` on the host, sidecar state volume | lets a device join the tailnet |
| Project secrets and signing keys | project `.env*.local`, `/home/dev/.secrets/<project>/` | code signing identity, cloud and API access |
| VNC password | `THEONE_VNC_PASSWORD` or generated once into `/home/dev/.vnc/password` (0600); hash in `/home/dev/.vnc/passwd`; controller copy in `/run/theone/controller.env` | view and control of the display |
| Speech-to-text API key (optional) | `THEONE_STT_API_KEY` in `.env`, moved into `/run/theone/controller.env`; only the controller's environment | billable transcription account; voice notes are sent to `THEONE_STT_URL` |
| Gemini API key (optional) | saved from the mobile or desktop app or `tesseract --gemini-key=KEY` into the controller's `state.db` (`settings` table, data dir mode 0700; never returned by the API); only the controller | billable Google account; voice notes requested with `provider: "gemini"` are sent to Google |
| Host shell token and PIN hash (opt-in) | `~/.config/theone/host-shell/state.json` on the host (0600 in a 0700 dir), host token also in the phone's secure store | together they are a shell on the host as the user running `host serve` |
| Android link (opt-in) | `androidLink` in the host's `state.json` (0600): the sandbox URL and the **sandbox controller token** | host token + PIN therefore also means full control of the linked sandbox; anyone with the sandbox's adb access is root in the host emulator's guest |
| Phone uploads (attachments, voice notes) | `/workspace/.theone/uploads` (0700 dirs, 0600 files), pruned after 30 days | the user's photos, documents and recordings |

## Adversaries and scenarios

| # | Adversary | Scenario |
|---|---|---|
| A1 | Internet attacker | scans for exposed services |
| A2 | Tailnet peer | another device or user on the same tailnet, or a compromised laptop |
| A3 | Malicious project content | a dependency postinstall, build script, or poisoned README/issue that tries prompt injection on Claude |
| A4 | Claude mistakes | a destructive command, a leaked secret in output, a wrong target |
| A5 | Lost or stolen phone | the token is in the secure store of an unlocked or compromised device |
| A6 | Leaked token | pasted into a chat, captured in a screenshot or log |

## Controls

### Exposure (A1, A2)

- **Tailnet only.** In the default mode the compose stack publishes no host
  ports. The Tailscale sidecar serves HTTPS 443 (→ controller 7700) and TCP
  5901 (→ Xvnc) on the tailnet. Funnel is never enabled (`AllowFunnel` absent or false).
- **Tailnet reachability.** In userspace mode, tailscaled forwards inbound
  tailnet TCP connections to the matching loopback port of the shared
  namespace. So besides the served ports, a peer allowed by your ACLs may
  reach other listening ports: the controller's plain HTTP on 7700, and dev
  servers bound to `127.0.0.1` or `0.0.0.0`. Treat ACLs as the port filter:
  grant the phone only `:443` and, if you use native VNC, `:5901`. The
  controller requires the token on 7700 too.
  While the Android link tunnels an emulator, the controller's adb tunnel
  listener `127.0.0.1:15555` is reachable the same way, and it is plain,
  unauthenticated adb: a peer allowed on that port gets the emulator's adbd
  (shell, install, app data). The same port-restricted ACLs close it.
- **ACLs.** Tag the node (e.g. `tag:theone`), create the auth key for that
  tag, and allow only your own devices:

  ```jsonc
  // tailnet policy file (excerpt)
  "tagOwners": { "tag:theone": ["autogroup:admin"] },
  "grants": [
    { "src": ["autogroup:member"], "dst": ["tag:theone"], "ip": ["tcp:443", "tcp:5901"] }
  ]
  ```

  Narrow `src` to your own user, or to a group, if the tailnet has other members.
  The sandbox itself needs no inbound or outbound tailnet access to other
  nodes. Unless you grant `tag:theone` access to other destinations, a
  compromised sandbox cannot reach the rest of your tailnet.
- **`host-tailscale` mode** binds ports on the host's tailnet IP. Host ACLs
  then decide reachability. The operator CLI accepts only an IPv4 address
  there: wildcards in any spelling (`0.0.0.0`, `::`, `[::0]`, …), `0.x.x.x` and
  names such as `localhost` are refused. **`local` mode** binds `127.0.0.1` only.
- **Egress and the Docker bridge.** The sandbox's default route is the compose
  network (or, in tailscale mode, the sidecar's), so it can reach host services
  published on `0.0.0.0`, the host's LAN and cloud metadata endpoints. Nothing
  filters this; see [known gaps](#known-gaps-tracked-in-the-roadmap).

### Authentication (A2, A5, A6)

- A bearer token on every REST call except `/v1/health`, compared in constant time.
- One-time, 60 s tickets for WebSockets and downloads. Secrets for `/ui` pages
  travel in the URL fragment and never reach server logs.
- The token is stored in `expo-secure-store` (Keychain / Android Keystore) and never in zustand persistence or logs.
- Tickets are not scoped: any unused ticket opens any socket (including a
  terminal or the VNC bridge) or download within its 60 s. Download tickets
  travel in a URL handed to the OS browser and can remain in its history until
  they expire.
- Rotation: `theone-controller token --rotate`, restart the controller, then
  pair again ([operations](../runbooks/operations.md#rotate-the-token)). There
  are no per-device tokens or revocation list. The app shows "Pairing no longer
  valid" on 401 and offers **Pair again**.
- **Blast radius of a leaked token:** anyone who has it *and* network reach
  (the tailnet, subject to ACLs) can do everything the app can: run commands
  as `dev`, read and modify all projects, read the Claude login and project
  secrets on the home volume, start Claude runs on your account, download
  artifacts, and watch or control the display. They cannot touch the host
  without a container escape, and without tailnet access they cannot reach
  the controller at all. Rotate immediately, then review `SESSION_LOG.md`,
  `git status` of projects, and recent processes, builds and agent runs.

### Host shell (opt-in)

`theone-controller host serve` deliberately crosses the host boundary, so it is
built so that nothing in the sandbox can use it:

- **Runs on the host, owned by the host.** The daemon, its token and the PIN hash
  live in the host user's `~/.config/theone/host-shell/`. The sandbox has no route
  to that file, no copy of the token and no SSH key for the host; a compromised
  sandbox or a prompt-injected Claude gains nothing new (A3, A4).
- **Tailnet only.** It binds one IPv4 and refuses wildcards and anything outside
  loopback and `100.64.0.0/10`, so it is never on a LAN or public interface (A1).
  Tailscale ACLs can narrow it further to your own devices (A2).
- **Two factors.** Every call except `/v1/health` needs the host token (32 random
  bytes, constant-time compare). A shell additionally needs a session, which only
  `POST /v1/host/unlock` with the correct PIN issues. A leaked token alone (A6) or
  a PIN alone opens nothing.
- **PIN brute force.** The PIN is stored as an argon2id hash. Attempts are
  serialized; 5 wrong PINs lock unlocking for 5 min, doubling on every further
  lockout up to 24 h. Counters persist in `state.json`, so restarting the daemon
  does not reset them; only a correct PIN or `host pin` does. Failed attempts are
  logged with the peer address.
- **Short sessions.** Sessions are random, kept in daemon memory only (never on
  disk, never persisted by the app), expire after 15 min and die when the PIN
  changes, the token is rotated or the phone taps **Lock**. A terminal already
  attached keeps streaming; reconnecting needs a new ticket and thus a session.
- **Lost phone (A5).** The secure store holds only the host token; the PIN is not
  stored. Run `theone-controller host token --rotate` (and `host pin` if the PIN
  may have been seen), then pair the remaining phones again.
- **Blast radius.** Token + PIN = a login shell as the user who runs
  `host serve`, with that user's sudo rights. Run it as an unprivileged account
  if that matters, and stop the service when you don't need it.

### Android emulator (opt-in)

The host daemon can run an Android emulator and link it to the sandbox, which then drives it
with `adb` ([app-runs-and-emulator.md §2](app-runs-and-emulator.md#2-android-emulator-on-the-host)).
This hands a compromised sandbox (A3, A4) a root shell in the guest: the emulator runs with
`-skip-adb-auth`, and `google_apis` images allow `adb root`. The guest must therefore count
as sandbox-controlled, and what matters is what the guest can reach on the host.

- **The problem.** The emulator's user-mode network maps the guest's `10.0.2.2` to the
  host's `127.0.0.1` and sends all guest traffic out through the host's network stack. On
  the host network a guest could reach the user's unauthenticated adb server
  (`127.0.0.1:5037`: USB phones, `host:connect`, port forwards), this daemon, local dev
  servers and databases, the LAN and every tailnet peer the host may reach.
- **Isolation (`THEONE_EMULATOR_ISOLATION=netns`, default).** The emulator runs in its own
  unprivileged user + network namespace (`unshare --user --map-root-user --net`) holding
  only `lo` and a dummy interface without routes. Guest TCP goes through `-http-proxy` and
  guest DNS through `-dns-server`, both to a helper inside the namespace that relays them
  over unix sockets in a 0700 runtime directory to the daemon. The daemon resolves names on
  the host and refuses (`403`) any destination with a loopback, unspecified, private
  (RFC 1918, `fc00::/7`), CGNAT/tailnet (`100.64/10`), link-local, site-local, multicast,
  reserved, NAT64 or IPv4-mapped-private address, then dials the vetted IP itself (no DNS
  rebinding). UDP other than DNS and ICMP have no route. adbd is reached only through the
  runtime directory (`adbd.sock`), bridged to `127.0.0.1:<port>` on the host for the daemon's
  own adb use and dialled directly by the link.
- **What it guarantees.** Verified live: from the guest, `10.0.2.2:5037` (the host adb
  server), the daemon's own port, the host's LAN IP and its Tailscale IP are refused; public
  HTTP/HTTPS works. The emulator's own adb server, started inside the namespace, sees nothing
  of the host's. Everything in the namespace is killed when the emulator is stopped.
- **Allowlist caveat.** `THEONE_EMULATOR_ALLOW_NETS` re-opens chosen ranges for the guest
  and thus for the sandbox. Allow single hosts, never the tailnet range. Host loopback
  (`127/8`, `0/8`, `::/96`, also IPv4-mapped) stays blocked whatever the allowlist says.
- **Not isolated.** `THEONE_EMULATOR_ISOLATION=none` (for hosts without user namespaces)
  keeps the old behaviour and its exposure. With isolation on, an emulator started outside
  the daemon is adopted for viewing only; the link refuses to tunnel it.
- **Shared host emulators.** `THEONE_ANDROID_SHARE_EMULATORS=on` (off by default) tunnels
  every other `emulator-<port>` the host adb lists to the linked sandbox. Those emulators are
  not isolated, so it has the same exposure as `none`: through the guest the sandbox reaches
  host loopback (the host adb server on `5037`, so USB phones), LAN and tailnet. Turn it on
  only for a sandbox you trust as much as the host user.
- **Other host-side limits.** At most 32 tunnelled adb streams, 20 new ones per second, a
  4 MiB write buffer per stream; the screen stream rejects non-H.264 video, absurd sizes and
  packets over 8 MiB; the sandbox only learns a generic emulator error (host paths stay on
  the host); logs omit tickets and URL userinfo.
- **Residual risks.** The guest still has internet access (it can exfiltrate what the
  sandbox gives it, like the sandbox itself). DNS queries go to the host's resolver
  (e.g. Tailscale MagicDNS), so the guest can resolve, but not connect to, private and
  tailnet names. A QEMU escape lands as the host user inside an unprivileged namespace with
  `/dev/kvm`, and the user's files are reachable from there. The host adb server talks to a
  guest adbd the sandbox controls (adb client parsing bugs). Any local user of the host can
  connect to the loopback adb bridge, as before to the emulator's adbd. On the sandbox side,
  tailnet peers can reach the controller's adb tunnel port `15555` like other loopback ports
  in userspace networking mode (see [Exposure](#exposure-a1-a2)).

### Container hardening (A3, A4 → host)

| Control | Setting |
|---|---|
| No privilege | no `privileged`, no `/dev/net/tun`, no `NET_ADMIN` (userspace Tailscale) |
| Capabilities | `cap_drop: [ALL]`, `cap_add` only `CHOWN, DAC_OVERRIDE, FOWNER, SETUID, SETGID, KILL, AUDIT_WRITE` (needed by the entrypoint and `sudo`) |
| Filesystem | named volumes only. No host bind mounts except the read-only Tailscale serve config (and the read-only host tailscale socket directory with the opt-in `--tailscale-api`, [below](#tailscale-localapi-opt-in)). No Docker socket |
| Resources | CPU and memory limits from `.env`, `pids_limit`, `shm_size: 2g` |
| User | every program runs as `dev` (uid 1000), including supervisord (`user=dev`). Only the entrypoint runs as root; it never follows symlinks in the volumes and runs its tool probes as `dev`, so a binary `dev` planted in `/opt/android-sdk` cannot get root at the next start. `dev` has passwordless `sudo` by default (`ENABLE_SUDO=true`), so container root is one command away, still confined by the capability set. Build with `ENABLE_SUDO=false` to remove it |
| PID 1 | tini (reaping), supervisord for fixed programs |

Residual risk: a kernel exploit from inside the container. Keep the host
kernel patched. Seccomp and AppArmor defaults from Docker stay enabled: never
set `seccomp=unconfined` for the sandbox. The sandbox cannot use
`no-new-privileges`, because sudo needs setuid. The Tailscale sidecar does use it.

### Tailscale LocalAPI (opt-in)

`--tailscale-api` (`THEONE_TAILSCALE_LOCALAPI=1`) mounts a tailscaled LocalAPI socket into
the sandbox so `GET /v1/identity` can name the Tailscale user and node. The read-only mount
does not make the API read-only: tailscaled authorises each connection by the peer's uid
(`SO_PEERCRED`, which containers share with the host because Docker does not remap uids):

- **Any uid:** read access. `status`, `whois`, `prefs`, the list of peers, their
  addresses, OS and owners, i.e. the tailnet's device inventory, become visible to all
  code in the sandbox, including untrusted project code (A3).
- **uid 0, or the tailscale operator uid:** full write access. The sandbox's `dev` has
  passwordless `sudo` by default, so root is always one command away; and on Linux hosts
  where the operator (`tailscale up --operator=<user>`) is the uid-1000 desktop user,
  `dev` (uid 1000) is treated as the operator without sudo. Verified on the reference
  host: `dev` passed a write-only LocalAPI check. Write access can change prefs, the
  exit node, subnet routes and `serve`/Funnel configuration, or log the node out.
- **`host-tailscale`/`local` mode:** that is the **host's** tailscaled. A compromised
  sandbox could, for example, add a serve or Funnel rule that exposes a host service,
  advertise routes, or disconnect the host from the tailnet. This breaks the "host stays
  untouched" goal for everything Tailscale controls. Enable it only on a host whose
  Tailscale you would also trust the sandbox's workload with, and turn it off otherwise.
- **`tailscale` mode:** the sidecar's own node. The worst case is the sandbox node:
  reconfiguring serve (Funnel still needs the `funnel` node attribute from your tailnet
  policy), logging it out, or changing its tags within what the policy allows.

Taildrop uses the same socket: `GET /v1/taildrop/targets` (`file-targets`, read access)
and `POST /v1/artifacts/:id/taildrop` (`file-put`). Without the opt-in the targets list is
empty with `available: false` and sends answer `503`; nothing else is attempted.
tailscaled only accepts `file-put` from a connection with write access (the root/operator
case above; otherwise the controller returns its `403`), and only offers the node's
Taildrop targets, i.e. devices of the same user (a tagged sidecar node usually has none).
The controller pushes only files already in `/workspace/artifacts`, to a target listed by
tailscaled, and only for a caller holding the token.

Mitigations: keep it off unless the Profile tab or Taildrop needs it; build with `ENABLE_SUDO=false`
and a `DEV_UID` that is not the host's operator uid, which leaves read access only; do not
grant `tag:theone` the `funnel` attribute. The serve headers need no socket and give the
viewer in `tailscale` mode. Identity data is informational: nothing in the controller
authorises on it, and a caller that already holds the token can fake serve headers from
loopback.

### Docker-in-Docker (opt-in)

`compose.dind.yml` adds a **privileged** `docker:dind` sidecar and gives the
sandbox `DOCKER_HOST`. From then on, any code in the sandbox can start a
privileged container on that daemon and escape to the host kernel. Enable
dind only for projects you trust about as much as host root. Disable it when
you no longer need it. See [ADR 0006](../adr/0006-optional-docker-in-docker.md).

### Claude with `bypassPermissions` (A3, A4)

Headless runs use `--permission-mode bypassPermissions`
(`THEONE_CLAUDE_PERMISSION_MODE`) because nobody can approve tool prompts from
a background job. The consequences:

- Claude can run any command `dev` can, which is the same power as the token.
  The container is the boundary.
- Behavioral guardrails come from `SPEC.md` (installed as the user-level
  `CLAUDE.md`): no host access attempts, confirmation before destructive
  operations (the run stops and asks), git safety, secret handling, and
  prompt-injection rules.
- To be stricter, set `THEONE_CLAUDE_PERMISSION_MODE=acceptEdits` or
  `default` in `infra/compose/.env` (compose passes it to the controller; see
  [claude-in-sandbox](../runbooks/claude-in-sandbox.md#3-permission-mode)).
  Headless runs then have tool calls that need approval denied. You can
  also add `permissions.deny` rules in `/home/dev/.claude/settings.json`
  (for example `Bash(git push:*)`, `Bash(curl:*)`). See
  [runbooks/claude-in-sandbox.md](../runbooks/claude-in-sandbox.md).

### Prompt injection (A3)

Repository files, issues, web pages and tool output can contain instructions
aimed at Claude. Mitigations:

- SPEC.md §2 defines them as data. Instructions come only from the user.
- There are no secrets in `.agent/` or status events. SPEC has the agent use
  the API only through `theone-controller api`, which reads the token itself
  and prints it (and the VNC password) as `***`, and forbids running
  `theone-controller token`/`pair` or touching `.agent/controller/`. An injected
  "print your token" request is therefore a rule violation rather than a
  routine action. Nothing technical stops code running as `dev` from reading
  the token ([same-user limit](#same-user-limit)).
- Egress is not filtered by default. A determined injection could exfiltrate
  workspace contents over HTTPS. For sensitive work, restrict egress at the
  Docker network level (roadmap) and keep high-value secrets out of the sandbox.

### Secrets

| Secret | Rule |
|---|---|
| `TS_AUTHKEY` | lives only in `infra/compose/.env` on the host (gitignored) and is read by the sidecar. Prefer a one-time (not reusable), non-ephemeral, pre-approved key for `tag:theone`, and remove it from `.env` after the first login |
| Controller token | generated in the sandbox, shown only by `sandbox pair` / `theone-controller pair` / `token`. A `THEONE_TOKEN` from `.env` is moved into `/run/theone/controller.env`, unset before supervisord starts, and mirrored into the 0600 token file |
| VNC password | `THEONE_VNC_PASSWORD` in `.env`, or generated on first start. Only the controller has it in its environment. Returned to authenticated clients by `GET /v1/display` so noVNC can log in; `status --json` and `api` print it as `***` |
| Claude login | created by `claude` login inside the sandbox, stored on the home volume. Never copied from the host |
| Project secrets | `.env*.local` in the project (gitignored) or `/home/dev/.secrets/<project>/` (0700/0600). Injected through `env` in `StartProcess` or project config |

Never mount host credential directories (`~/.ssh`, `~/.aws`, `~/.config`)
into the sandbox. Use deploy keys or fine-grained tokens created for the
sandbox, so a compromise is revocable on its own.

### Lost phone (A5)

The token is in the platform keystore. If the device is lost: rotate the
controller token, and remove the device from the tailnet in the Tailscale admin
console. Either step alone cuts access, and doing both is best.

### Controller hardening against its own workload

- **Child environment.** `THEONE_TOKEN`, `THEONE_VNC_PASSWORD` and `THEONE_STT_API_KEY` are removed
  from the environment of every process, build step, terminal, agent run and
  git/zip helper, and neither reaches Xvnc, openbox or GUI apps. This prevents
  accidental leaks (crash reporters, `env` in a log), nothing more.
- **Malicious repositories (A3).** Listing a project never executes code from
  it: `git status`/`log` run with `core.fsmonitor=false`,
  `log.showSignature=false` and every configured filter driver blanked, and
  `package.json`/`.agent` files are read only if they are regular files within
  a size cap, so a symlink to `/dev/zero` or a FIFO cannot freeze the controller.
- **Leftover processes.** When a tracked command exits, whatever it left in its
  process group or session is stopped, so background jobs cannot quietly
  outlive the task that started them.

### Same-user limit

The controller, Claude and project code all run as `dev`. Anything running as
`dev` can read `/workspace/.agent/controller/token` and the controller's
`/proc/<pid>/environ`, and with `ENABLE_SUDO=true` become container root.
Executed malicious project code (A3) is therefore equivalent to a compromised
sandbox and to holding the API token. Real separation would need the controller
under its own uid, which conflicts with the `api` CLI and file ownership; it is
an [open decision](../roadmap.md#open-decisions).

## Audit (2026-09-23)

| Finding | Status |
|---|---|
| Unauthenticated access: every protected route, path variant (`//v1/status`, `%73tatus`, `/v1/health/../status`, …), HEAD, WS without a ticket and oversized chunked bodies | no bypass found (401/404/413) |
| `package.json` symlinked to `/dev/urandom` froze the controller (health timed out) | fixed: regular files ≤ 1 MiB only |
| A repository's `core.fsmonitor` / filter drivers ran on `GET /v1/projects` | fixed: neutralised on the command line |
| Entrypoint ran a dev-writable `adb` as root at start | fixed: probes run as `dev` |
| Token and VNC password visible to every child and to all supervisord programs | fixed: moved to `controller.env`, stripped from children |
| FIFO swap race in `/v1/context` | fixed: `O_NONBLOCK` + `fstat` on the open descriptor |
| Tailnet peers reach every loopback port of the netns (userspace forwarding) | open; mitigation: port-restricted ACLs (not verifiable without a tailnet) |
| Unscoped tickets; download tickets in browser history | open (needs a protocol change) |
| Web build: tokens in `localStorage`; iframe delegates `clipboard-read` to the controller origin | open, low (web is for development) |
| `/ui` pages without CSP, `X-Content-Type-Options` or `frame-ancestors` | open, low (Bun HTML routes cannot set headers directly) |
| Supply chain: `CLAUDE_CODE_VERSION=latest` without lockfile; base images by tag; Node checked against `SHASUMS256.txt` from the same origin (no GPG) | open ([roadmap](../roadmap.md#open-decisions)) |

Regression tests: `apps/controller/tests/hardening.test.ts` and
`infra/tests/entrypoint.bats`.

## What is never exposed

- No published host ports in the default mode, no Funnel, no public DNS.
- The host Docker socket and host filesystem (the host's tailscale socket directory only
  with the opt-in `--tailscale-api`).
- The controller token, in any API response. The only exceptions are the
  CLI `pair`/`token` output (run by the operator through `bun run sandbox pair`).
- `/workspace/.agent/controller/` contents through `/v1/context`, which
  returns only `.agent/*.md` and `.agent/projects/<id>/*.md` and never follows symlinks.

## Known gaps (tracked in the [roadmap](../roadmap.md))

- A single token without scopes or per-device identity, and no audit log of API calls.
- Tickets are not bound to a purpose or target.
- `--tailscale-api` hands the raw LocalAPI socket to the sandbox; a filtering proxy that
  only forwards `status` and `whois` would remove the write access.
- No egress filtering: the sandbox reaches the internet, the host's published
  ports, the LAN and metadata endpoints. Use `DOCKER-USER` iptables rules on the
  host or an egress proxy for sensitive work.
- No isolation between projects inside the sandbox (shared user and filesystem),
  and none between the controller and the workload ([same-user limit](#same-user-limit)).
- Plain `VncAuth` on the direct 5901 path (8-character password limit); ACLs are the real control there.
- After a controller crash, processes it had started keep running untracked
  (rows are only marked `orphaned`).
- The Tailscale sidecar keeps Docker's default capabilities (`cap_drop: [ALL]`
  is untested).
- Scanning a QR code pairs immediately, without the confirmation step deep
  links get; `theone://sandbox/terminal/new?kind=…` links create a terminal
  without a prompt (they cannot type into it).
