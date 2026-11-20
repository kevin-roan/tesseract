# Run the Tesseract Network (Headscale + account service)

The Tesseract Network ([ADR 0014](../adr/0014-embedded-tailnet-and-tesseract-accounts.md)) needs two hosted
services: a Headscale control server and the account service (`apps/account`). Both live in one compose stack,
`infra/headscale/`. This runbook deploys them on one Linux VM with Docker.

## What you need

- A VM with a public IPv4 (IPv6 optional), Docker Engine and the compose plugin.
- Two DNS names pointing at it, for example:
  - `net.example.com`: Headscale. This is `TESSERACT_LOGIN_SERVER`, the URL every node logs in to.
  - `account.example.com`: the account service. This is the mobile app's `EXPO_PUBLIC_ACCOUNT_URL`.
- Open ports: TCP 80 and 443 (TLS and ACME), UDP 3478 (STUN for the embedded DERP relay).

The MagicDNS domain (`TESSERACT_NET_DOMAIN`, default `tesseract.internal`) only exists inside the tailnet. It
needs no DNS records, and it must not be a parent of the Headscale host name.

## 1. Configure

```sh
cd infra/headscale
cp .env.example .env
$EDITOR .env
```

| Variable | Value |
|---|---|
| `TESSERACT_LOGIN_SERVER` | `https://net.example.com` (must be `https://`) |
| `TESSERACT_NET_DOMAIN` | leave at `tesseract.internal` unless clients are built with another domain |
| `ACCOUNT_APPLE_AUDIENCES` | the iOS bundle id(s) allowed as `aud`, e.g. `com.kevinroan.tesseract,com.kevinroan.tesseract.dev` |
| `ACCOUNT_DEMO_EMAIL` / `ACCOUNT_DEMO_PASSWORD` | the App Review account (password at least 10 characters) |
| `HEADSCALE_HOST` / `ACCOUNT_HOST` / `ACME_EMAIL` | only for the bundled Caddy (`--tls`) |
| `ACCOUNT_HEADSCALE_API_KEY` | leave empty; `./bootstrap` fills it in |

`config.yaml` holds the rest of the Headscale settings. Compose overrides `server_url` and `dns.base_domain` from
`.env` through `HEADSCALE_SERVER_URL` and `HEADSCALE_DNS_BASE_DOMAIN`, so the file does not need editing.

## 2. Bootstrap

```sh
./bootstrap --tls      # or ./bootstrap if you bring your own TLS proxy
```

The script:

1. starts Headscale and waits until it is healthy,
2. runs `headscale apikeys create --expiration 3650d` inside the container and writes the key to `.env` as
   `ACCOUNT_HEADSCALE_API_KEY` (skipped when one is already set; `--rotate` makes a new one),
3. builds `infra/docker/account/Dockerfile` and starts the account service, plus Caddy with `--tls`.

Only the account service holds the API key. To revoke a key: `docker compose exec headscale headscale apikeys list`,
then `headscale apikeys expire --prefix <prefix>`, then `./bootstrap --rotate`.

## 3. TLS in front of both services

Both containers publish only on `127.0.0.1` (Headscale `8080`, account `7800`). Something must terminate TLS:

- **Bundled Caddy** (`./bootstrap --tls`, compose profile `tls`): `Caddyfile` serves `HEADSCALE_HOST` and
  `ACCOUNT_HOST` with Let's Encrypt certificates. It returns 404 for Headscale's admin API (`/api/*`) on the
  public host; the account service reaches it over the compose network.
- **Your own proxy** (nginx, Traefik, a cloud load balancer): proxy `https://net.example.com` to `127.0.0.1:8080`
  and `https://account.example.com` to `127.0.0.1:7800`. Requirements:
  - Pass `Upgrade`/`Connection` headers through and don't buffer: Tailscale's control protocol (`/ts2021`) and
    the DERP relay (`/derp`) are long-lived upgraded connections.
  - Set `X-Forwarded-For` on the account host. The service rate-limits sign-in and sign-up per client IP and
    trusts the last `X-Forwarded-For` entry (`ACCOUNT_TRUST_PROXY=1` in `compose.yml`). Don't expose port 7800
    directly while that is on, or clients can spoof their IP.
  - Block `/api/` on the Headscale host unless you need remote admin.

## 4. Check it

```sh
curl -fsS https://account.example.com/v1/health          # {"ok":true}
curl -fsS https://net.example.com/health                 # Headscale health
docker compose exec headscale headscale users list        # one u-<accountId> per account that made a device
docker compose exec headscale headscale nodes list
docker compose logs -f account
```

End to end: sign up in the app (or `POST /v1/accounts`), then `POST /v1/devices/keys` with the session token, and
run `tesseract-tailnet up --login-server https://net.example.com --auth-key <key> --hostname test` on any machine.
The node shows up under `GET /v1/devices` and in `headscale nodes list`.

## How accounts map onto Headscale

- Each account gets one Headscale user, `u-<accountId>`, created on its first device key.
- Device keys are single-use, pre-approved, expire after 1 hour and are owned by that user. They carry **no ACL
  tags**: since Headscale 0.28 a tagged node belongs to its tags instead of a user, which would take it out of
  `autogroup:self`. The account service records each key's device kind (`mobile`, `desktop`, `sandbox`,
  `server`) itself and reports it in `GET /v1/devices`.
- `policy.hujson` allows `autogroup:member -> autogroup:self:*` and nothing else, so a device reaches only
  devices of the same account. Headscale warns that `autogroup:self` compiles filters per node; watch the
  coordinator's CPU as the user count grows.
- Nodes don't expire (`node.expiry: 0`). They go away through `DELETE /v1/devices/:id` or account deletion.
- `DELETE /v1/me` deletes the account's nodes, its Headscale user, its sessions and the account row. If Headscale
  is unreachable it returns `502 tailnet_unavailable` and keeps the account so the user can retry.

## App Review demo account

App Review needs a working account and a sandbox to talk to, with no Tailscale app.

1. Set `ACCOUNT_DEMO_EMAIL` and `ACCOUNT_DEMO_PASSWORD` in `.env` and restart the account service
   (`docker compose up -d account`). It creates the account on start, or resets its password if the value
   changed. It never deletes it.
2. Give the demo account a sandbox: on a server you control, sign in to the Electron app with the demo
   credentials and choose the `tesseract-net` reachability for a sandbox (it fetches a `sandbox` device key), or
   do it by hand:

   ```sh
   TOKEN=$(curl -fsS https://account.example.com/v1/sessions -H 'content-type: application/json' \
     -d '{"email":"<demo email>","password":"<demo password>"}' | jq -r .token)
   curl -fsS https://account.example.com/v1/devices/keys -H "authorization: Bearer $TOKEN" \
     -H 'content-type: application/json' -d '{"kind":"sandbox","hostname":"demo-sandbox"}' | jq -r .authKey
   ```

   Put that key in the sandbox's `.env` as `TS_AUTHKEY` within the hour and start it in `tesseract-net` mode.
3. Sign in on a phone with the demo credentials and check the sandbox appears and connects.
4. Put the credentials in App Store Connect under App Review Information. Keep the demo sandbox running for the
   whole review.

The demo account is a normal account: it can be deleted in the app, which also deletes its Headscale user.
Restarting the account service recreates it (with no devices), so redo step 2 after a reviewer tests deletion.

## Backups and upgrades

- State lives in the `headscale-data` and `account-data` volumes (two SQLite databases). Back both up together;
  the account database stores each account's Headscale user id and device kinds.
- Headscale is pinned (`HEADSCALE_VERSION`, default `0.29.7`). Read the Headscale changelog before bumping,
  back up `headscale-data`, then `docker compose pull headscale && docker compose up -d headscale`. Run
  `docker compose run --rm headscale configtest` to validate `config.yaml` and `policy.hujson` first.
