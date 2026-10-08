# Switch the sandbox to HTTPS (tailscale mode)

Use this when the iPhone app says **"Can't reach the sandbox. Check that
Tailscale is connected on this device."** even though Tailscale is on.

## Why it happens

In `host-tailscale` and `local` modes the pairing URL is plain HTTP
(`http://100.x.x.x:7700`). iOS App Transport Security blocks cleartext HTTP
from the app, and ATS exceptions can't be scoped to a raw IP address. Safari
still loads the URL, which is what makes it confusing. The fix is an HTTPS
URL: `tailscale` mode serves the sandbox at
`https://<TESSERACT_HOSTNAME>.<tailnet>.ts.net` with a real certificate.

## Confirm it's this problem

1. On the host, check the sandbox is healthy:
   ```sh
   docker ps --format '{{.Names}}\t{{.Status}}' | grep tesseract
   curl -sS http://<host tailnet IP>:7700/v1/health
   ```
2. Check the phone is on the tailnet: `tailscale status` lists it as online,
   and `tailscale ping <phone name>` gets a pong.
3. On the phone, open `http://<host tailnet IP>:7700/v1/health` in Safari.
   If Safari shows `{"ok":true,…}` but the app fails, it's ATS. Continue below.

## One-time tailnet setup (admin console)

1. **Enable MagicDNS and HTTPS certificates**:
   https://login.tailscale.com/admin/dns → turn on MagicDNS → **Enable HTTPS**.
   Check it took effect: `tailscale status --json | grep -A2 CertDomains`
   should not be empty.
2. **Find the tailnet name** (same page, "Tailnet name"), or run
   `tailscale status --json | grep MagicDNSSuffix`. Ours: `tail511d9d.ts.net`.
3. **Create an auth key**: https://login.tailscale.com/admin/settings/keys →
   **Generate auth key** (not ephemeral, not reusable; a tag is optional).

## Configure and restart

Edit `infra/compose/.env`:

```sh
TESSERACT_MODE=tailscale
TS_TAILNET_DOMAIN=tail511d9d.ts.net
TS_AUTHKEY=tskey-auth-...        # only needed for the first start
TESSERACT_HOSTNAME=tesseract-sandbox   # becomes https://tesseract-sandbox.<tailnet>
```

Then, from the repo root:

```sh
bun run sandbox up
```

This replaces the published host ports with the Tailscale sidecar. Projects,
the home volume and the token are kept. After the first successful start,
the sidecar keeps its login in its state volume, so you can clear
`TS_AUTHKEY` again.

A machine named `tesseract-sandbox` must not already exist on the tailnet
(check `tailscale status`). Otherwise Tailscale gives the new node a
suffixed name and the URL won't match.

## Verify

```sh
curl -sS https://tesseract-sandbox.tail511d9d.ts.net/v1/health
bun run sandbox doctor
```

The first HTTPS request can take a few seconds while the certificate is issued.

## Re-pair the phone

1. `bun run sandbox pair`: the QR code now encodes the `https://` URL.
2. In the app, remove the old sandbox (Agents tab → header → **Remove this
   sandbox**), which still has the old `http://` URL. Then scan the new code.
   If no other sandbox is paired, the app returns to onboarding → **Scan
   pairing code**.

## Roll back

Set `TESSERACT_MODE=host-tailscale` (and `TESSERACT_BIND_ADDR` to the host's
tailnet IPv4, or leave it empty for auto-detection) in `infra/compose/.env`,
run `bun run sandbox up`, and pair again.

See also: [pairing-mobile](pairing-mobile.md), [troubleshooting](troubleshooting.md),
[networking-tailscale](../architecture/networking-tailscale.md).
