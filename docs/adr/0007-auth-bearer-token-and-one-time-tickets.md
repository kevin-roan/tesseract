# ADR 0007: Bearer token plus one-time tickets

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The controller can run arbitrary commands in the sandbox, so its credential is
powerful. Tailscale already authenticates devices, but anyone on the tailnet
who can reach the node (other devices, shared users, a compromised laptop)
would otherwise have that power. The phone uses three kinds of connection:
REST from JavaScript, WebSockets, and URLs opened by a WebView or the OS
(terminal and VNC pages, artifact downloads). The last two cannot carry
custom headers reliably.

## Decision

- **One bearer token per sandbox**: 32 random bytes, base64url. It is
  generated on first start into `$TESSERACT_DATA_DIR/token` (mode 0600), or set
  with `TESSERACT_TOKEN`. REST requires `Authorization: Bearer`, compared in
  constant time. Only `GET /v1/health` is public.
- **One-time tickets** for everything that cannot send headers:
  `POST /v1/auth/ticket` returns 32 random bytes, valid for 60 s and consumed
  on first use. Tickets are accepted as `?ticket=` on WebSocket endpoints and
  on artifact downloads.
- **Static `/ui/*` pages hold no secrets.** The app passes `ticket`,
  `session` and the VNC `password` in the URL fragment, which is never sent to
  the server, and the page opens the WebSocket with `?ticket=`.
- **No cookies**, so no CSRF surface. `TESSERACT_CORS_ORIGINS` defaults to `*`.
- The token reaches the phone only through the pairing link
  (`tesseract://pair?url=…&token=…`, QR or deep link) and is stored in
  `expo-secure-store`. It is rotated with `tesseract-controller token --rotate`
  (see [operations](../runbooks/operations.md#rotate-the-token)).

## Consequences

- Leaked tickets are nearly worthless: short-lived, single-use, and bound to the one request that consumes them.
- A leaked token is equivalent to a shell as `dev` in the sandbox until it is
  rotated. Rotation invalidates every paired phone, which must pair again.
- There is no per-device identity, no scopes and no audit trail per client.
  Multiple tokens, scopes and an audit log are roadmap items.
- Tokens in query strings are avoided everywhere, so they do not end up in
  proxy logs or WebView history. Tickets in query strings are acceptable
  because they are single-use.
- Every WebSocket (re)connect costs an extra REST round-trip for the ticket.

## Alternatives considered

- **Tailscale identity only** (via `Tailscale-User-Login` headers from serve).
  Elegant, but it does not protect against other devices of the same user or
  shared nodes, and it does not work in `local` mode. It remains a possible
  second factor.
- **Token in the WS query string.** Leaks the long-lived secret into logs and history.
- **WS subprotocol header carrying the token.** Works for our own clients, but
  not for noVNC's stock connection code, and it complicates the page.
- **OAuth/OIDC.** Too heavy for a single-user self-hosted sandbox.
- **mTLS.** Certificate management on phones is painful, and serve terminates TLS anyway.

## Implementation notes (2026-09-23)

- `POST /v1/auth/ticket` answers `200`. Tickets are not bound to a target: any
  unused ticket opens any socket or download for 60 s. Scoping them is an open
  decision in the [roadmap](../roadmap.md#open-decisions).
- A `TESSERACT_TOKEN` set through compose is handed to the controller only
  (`/run/tesseract/controller.env`), mirrored into the 0600 token file, and
  stripped from every child process. The in-sandbox agent never handles the
  token: it calls the API through `tesseract-controller api`.
- Clients distinguish a revoked token (401/403, "Pairing no longer valid") and a
  protocol mismatch (`ProtocolVersionError`) and offer re-pairing.
