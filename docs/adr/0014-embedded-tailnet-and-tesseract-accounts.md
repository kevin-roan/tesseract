# ADR 0014: Embedded tailnet and Tesseract accounts

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

Tailscale is the only transport between the phone and the sandbox
([ADR 0003](0003-single-sandbox-container-with-tailscale-sidecar.md)). Today the phone needs
the Tailscale app installed, logged in and its VPN connected, and the desktop host needs
Tailscale for the host shell daemon. App Store review cannot test an app that only works with
a third-party VPN app and a tailnet the reviewer does not have, and the app has no account
system of its own.

The Tailscale client is BSD-3 licensed and ships `tsnet`, which runs a full node inside a
process with a userspace network stack: no VPN profile, no Network Extension, no root.
Headscale (BSD-3) is an open-source control server that speaks the same protocol.

## Decision

Add a second network, the **Tesseract Network**, next to the existing Tailscale modes. It
does not replace them; users who already run Tailscale keep the current modes.

1. **Control plane.** A self-hosted Headscale (`infra/headscale/`) is the coordination
   server. MagicDNS base domain `TESSERACT_NET_DOMAIN` (default `tesseract.internal`,
   `TESSERACT_NET_DEFAULT_DOMAIN`). Each Tesseract account maps to one Headscale user named
   `u-<accountId>`. The policy (`autogroup:member -> autogroup:self:*`) only lets a user's
   devices reach that user's own devices. Device keys carry no ACL tags: since Headscale
   0.28 a tagged node is owned by its tags, leaves `autogroup:self`, and a shared tag would
   group every account's devices together. Untagged nodes also make LocalAPI whois name the
   account's Headscale user, so `GET /v1/identity` works.
2. **Account service.** `apps/account` (Bun, Hono, `bun:sqlite`) owns accounts and is the only
   thing holding the Headscale API key. Default port `7800` (`ACCOUNT_DEFAULT_PORT`). Routes
   are `ACCOUNT_ROUTES` in `@tesseract/protocol`; bodies and responses are the schemas in
   `packages/protocol/src/schemas/account.ts`:

   | Method | Path | Auth | Body | Response |
   |---|---|---|---|---|
   | GET | `/v1/health` | none | — | `{ ok: true }` |
   | POST | `/v1/accounts` | none | `CreateAccount` | `201 AccountSession`; 409 `email_taken` |
   | POST | `/v1/sessions` | none | `PasswordSignIn` | `AccountSession`; 401 `invalid_credentials` |
   | POST | `/v1/sessions/apple` | none | `AppleSignIn` | `AccountSession` (creates the account on first use) |
   | DELETE | `/v1/sessions/current` | bearer | — | 204 |
   | GET | `/v1/me` | bearer | — | `Account` |
   | DELETE | `/v1/me` | bearer | — | 204; deletes the account, its sessions, its Headscale nodes and user |
   | POST | `/v1/devices/keys` | bearer | `CreateDeviceKey` | `201 DeviceKey`: single-use, pre-approved, 1 h expiry, user-owned (no ACL tags, `DeviceKey.tags` is `[]`), kind recorded by the account service |
   | GET | `/v1/devices` | bearer | — | `AccountDeviceList` from the user's Headscale nodes |
   | DELETE | `/v1/devices/:id` | bearer | — | 204; 404 for a node of another user |

   Errors are `AccountError` (`{ error: { code, message } }`). Session tokens are random
   32-byte base64url strings, stored only as SHA-256 hashes, 30-day expiry. Passwords use
   `Bun.password` (argon2id). Sign in with Apple verifies the identity token's RS256
   signature against Apple's JWKS, `iss=https://appleid.apple.com` and `aud` in
   `ACCOUNT_APPLE_AUDIENCES`. Environment: `ACCOUNT_PORT`, `ACCOUNT_DATA_DIR`,
   `ACCOUNT_HEADSCALE_URL`, `ACCOUNT_HEADSCALE_API_KEY`, `ACCOUNT_LOGIN_SERVER` (public URL
   clients pass to `tsnet`, returned as `DeviceKey.loginServer`), `ACCOUNT_NET_DOMAIN`,
   `ACCOUNT_APPLE_AUDIENCES` (comma-separated), `ACCOUNT_DEMO_EMAIL`/`ACCOUNT_DEMO_PASSWORD`
   (seeded on start, for App Review).
3. **Embedded node library.** `native/tailnet` is a Go module wrapping `tsnet` with a
   gomobile-compatible API (package `tailnet`, one node per process):

   ```go
   func Start(stateDir, controlURL, authKey, hostname string) error // authKey may be "" when state exists
   func Stop() error
   func Logout() error                         // logs out and wipes stateDir
   func StatusJSON() string                    // a TailnetStatus (protocol) as JSON
   func Forward(host string, port int) (int, error) // 127.0.0.1:<returned> -> host:port over the tailnet; idempotent
   func CloseForward(host string, port int)
   func Serve(tailnetPort int, localAddr string) error // expose localAddr on the node's tailnet port
   ```

   `host` is a MagicDNS name or a tailnet IP. Forwarders are plain TCP, so HTTP, WebSocket
   and VNC go through unchanged. The CLI `native/tailnet/cmd/tesseract-tailnet` runs the same
   library for desktop hosts: `tesseract-tailnet up --state-dir D --login-server URL
   [--auth-key K] --hostname H [--serve 7701=127.0.0.1:7701 ...]` prints one `TailnetStatus`
   JSON object per line on stdout whenever the state changes; `SIGTERM` stops it.
   Build scripts in `native/tailnet/scripts/`: `build-android.sh` (gomobile, writes
   `apps/mobile/modules/tesseract-tailnet/android/libs/tailnet.aar`), `build-ios.sh`
   (gomobile, macOS only, writes `apps/mobile/modules/tesseract-tailnet/ios/Tailnet.xcframework`),
   `build-desktop.sh` (writes `apps/electron/resources/bin/<linux|mac|win>-<x64|arm64>/tesseract-tailnet[.exe]` (electron-builder names)).
   Build outputs are not committed.
4. **Phone.** The Expo module `apps/mobile/modules/tesseract-tailnet` wraps the library on
   iOS and Android (`start`, `stop`, `logout`, `status`, `forward`, `closeForward`, a
   `status` event). `apps/mobile/src/features/tailnet` owns connecting and URL resolution:
   a controller or host URL whose host is under the tailnet's MagicDNS suffix or in
   `100.64.0.0/10` is rewritten to `http://127.0.0.1:<forwarded port>` before the client,
   WebSocket or WebView uses it. Other URLs (the Tailscale modes) are untouched. ATS allows
   loopback (`NSAllowsLocalNetworking`), so no HTTPS certificate is needed on this path.
   `apps/mobile/src/features/account` owns sign-in, sign-up, Sign in with Apple, sign-out
   and account deletion; after sign-in it requests a `mobile` device key and starts the node.
   The account service URL is `EXPO_PUBLIC_ACCOUNT_URL`.
5. **Sandbox.** A new compose mode `tesseract-net` (`compose.yml` + `compose.tesseract-net.yml`):
   the same userspace sidecar with `--login-server=${TESSERACT_LOGIN_SERVER}`, no `serve`
   (Headscale cannot issue HTTPS certificates), and
   `TESSERACT_PUBLIC_URL=http://${TESSERACT_HOSTNAME}.${TESSERACT_NET_DOMAIN}:7700`.
   Inbound tailnet TCP reaches the namespace's loopback ports as in the userspace
   `tailscale` mode. `TS_AUTHKEY` is a `sandbox` device key.
6. **Desktop.** The Electron app signs in to a Tesseract account, offers `tesseract-net` as
   the sandbox reachability choice (fetching the sandbox key itself), and runs the bundled
   `tesseract-tailnet` to expose the host shell (`7701`) and host workspace (`7702`)
   daemons on the Tesseract Network, bound to loopback, instead of requiring Tailscale.

## Consequences

- The phone works with no other app installed, and App Review gets a demo account
  (`ACCOUNT_DEMO_*`) whose demo sandbox is a `tesseract-net` node.
- Tesseract now runs a hosted service (Headscale plus the account service) and holds user
  accounts: account deletion is in-app, as App Store guideline 5.1.1(v) requires, and Sign
  in with Apple is offered.
- The node only runs while the app runs. Background streaming is not a goal.
- Features built on Tailscale's hosted service are not available on the Tesseract Network:
  `*.ts.net` HTTPS certificates, serve identity headers and Taildrop. `GET /v1/identity`
  still works through the LocalAPI (`--tailscale-api`), which Headscale supports.
- "Tailscale" is a trademark; the product calls this the Tesseract Network.
