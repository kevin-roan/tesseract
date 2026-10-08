# Pairing the mobile app

Pairing gives the phone a sandbox's base URL and bearer token. There are no
accounts: whoever holds the token (and can reach the URL over the tailnet)
controls the sandbox.

## The pairing link

```text
tesseract://pair?url=<encoded base URL>&token=<token>&name=<label>
```

| Part | Source |
|---|---|
| `url` | `TESSERACT_PUBLIC_URL`. tailscale mode: `https://$TESSERACT_HOSTNAME.$TS_TAILNET_DOMAIN`; host-tailscale/local: `http://$TESSERACT_BIND_ADDR:$TESSERACT_CONTROLLER_HOST_PORT` (default 7700) |
| `token` | `TESSERACT_TOKEN` if set in `.env`, otherwise `/workspace/.agent/controller/token` (generated on first start) |
| `name` | label shown in the app (defaults to the sandbox id) |

## Steps

1. Make sure the phone's Tailscale app is connected to the tailnet.
2. On the host: `bun run sandbox pair`. This runs `tesseract-controller pair`
   inside the sandbox, which prints the ANSI QR code, the link, and the
   sandbox URL. `bun run sandbox pair --json` prints `{ link, url, name }`
   for scripting (the token is inside `link`).
3. In the app: without a paired sandbox the app opens onboarding; go through
   the welcome pages to **Pair your sandbox** → **Scan pairing code**. Once one
   is paired, use the Agents tab's header action **Pair another sandbox**.
   Then one of:
   - **Scan**: point the camera at the QR code (grant camera permission).
     A scanned code pairs immediately.
   - **Deep link**: open the `tesseract://pair?…` link on the phone, for example
     from a note or password manager. The OS routes it to the app's `pair`
     screen with the fields filled in; tap **Pair sandbox** to confirm.
   - **Manual**: paste the whole link, or enter URL and token separately.
4. The app checks `GET /v1/health` (reachability, protocol version) and
   `GET /v1/status` (token). It stores the token in `expo-secure-store` (web:
   `localStorage`) and the entry (name, URL) in the persisted sandbox list
   (`expo-sqlite/kv-store`), and makes it the active sandbox.

`http://` URLs (local and host-tailscale modes) are verified with development
builds only. Release builds may refuse cleartext (Android blocks it by default,
and iOS applies its App Transport Security rules); `app.json` does not configure
either. See the [open decisions](../roadmap.md#open-decisions).

## Several sandboxes

The app keeps a list of paired sandboxes with one active. The events socket
and live queries run only for the active one. Switching sandboxes swaps the
cached data (query keys are scoped per sandbox). Removing a sandbox deletes
its token from secure storage.

## Re-pairing

You need to pair again when:

- the token was rotated (`tesseract-controller token --rotate` plus a controller
  restart, see [operations](operations.md#rotate-the-token)): every phone gets 401 until re-paired
- `TESSERACT_HOSTNAME` or `TS_TAILNET_DOMAIN` changed, which changes the URL
- the `tesseract-workspace` volume was recreated, which generates a new token (unless `TESSERACT_TOKEN` is set)

When the sandbox rejects the stored token (401/403), the Agents tab shows
**Pairing no longer valid** with a **Pair again** button. It opens the pair
screen with the URL and name filled in and the QR scanner ready; scan the new
code or paste the new link. A protocol mismatch between app and sandbox shows
**Version mismatch** instead: update the app or the image.

Pairing again with the same URL updates the existing entry (new token and name). A changed URL creates a new entry, so remove the old one.

## Security notes

- The QR code and link contain the token. Do not screenshot them into shared
  places. Clear your terminal scrollback afterwards if the host is shared.
- The token never travels in other URLs. WebViews and downloads use one-time
  tickets ([ADR 0007](../adr/0007-auth-bearer-token-and-one-time-tickets.md)).
- Lost phone: rotate the token and remove the device from the tailnet
  ([security-model.md](../architecture/security-model.md#lost-phone-a5)).

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot reach sandbox" | Tailscale disconnected on the phone, or wrong tailnet. Open `https://<host>.<tailnet>.ts.net/v1/health` in the phone browser |
| "Pairing no longer valid" / "Unauthorized" | token rotated or mistyped. Run `bun run sandbox pair` again and use **Pair again** |
| "Version mismatch" | the app and the controller speak different protocol versions. Update the app or rebuild the image |
| `http://` URL fails ("Can't reach the sandbox" while Safari loads it) | cleartext refused by the OS (iOS ATS). Switch to tailscale mode: [tailscale-https-setup](tailscale-https-setup.md) |
| Link URL is `https://tesseract-sandbox` without `.<tailnet>.ts.net` | `TS_TAILNET_DOMAIN` was empty when the container was created. Set it in `.env` and run `bun run sandbox up` |
| Camera does not open | development build missing `expo-camera`, or permission denied in the OS settings |
| Deep link opens nothing | the app was not built with the `tesseract` scheme (`app.json` → `scheme`), or you are in Expo Go |
