# Host shell

A PIN-protected terminal on the **host** machine (not the sandbox), reachable from the
phone over Tailscale. It is opt-in: nothing runs until you start it. Contract:
[blueprint §4.3 and §5.7](../architecture/00-blueprint.md); threat model:
[security model → Host shell](../architecture/security-model.md#host-shell-opt-in).

## Requirements

- The host is on your tailnet (`tailscale ip -4` prints an address).
- Bun on the host and a checkout of this repository (`bun install` done).
- The phone is on the same tailnet with the TheOne app.

Every command below runs **on the host**, from the repository root.

## Set up

```bash
bun run host pin       # asks for a 6-12 digit PIN twice, without echo
bun run host serve     # listens on <tailscale ip -4>:7701 until Ctrl-C
bun run host pair      # in another terminal: QR code + theone://host link
```

In the app open **Host shell**, scan the QR code (or open the link on the phone), then
enter the PIN. The app keeps the host token in the secure store; the PIN is asked again
whenever the 15-minute session has expired or you tapped **Lock**.

Non-interactive PIN (e.g. from a password manager): `printf '%s' "$PIN" | bun run host pin --stdin`.

Options: `--bind <ipv4>` / `THEONE_HOST_SHELL_BIND` (loopback or a `100.64.0.0/10`
address only), `--port <n>` / `THEONE_HOST_SHELL_PORT` (default `7701`),
`THEONE_HOST_SHELL_PUBLIC_URL` (e.g. `http://my-pc.tail1234.ts.net:7701` for the pairing
link), `THEONE_HOST_SHELL_DIR` (state directory, default `~/.config/theone/host-shell`).

## Run it as a user service (systemd)

`~/.config/systemd/user/theone-host-shell.service`:

```ini
[Unit]
Description=TheOne host shell
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
WorkingDirectory=%h/path/to/theone-mobile
ExecStart=/usr/bin/env bun apps/controller/src/index.ts host serve
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now theone-host-shell
journalctl --user -u theone-host-shell -f    # wrong PINs and lockouts are logged with the peer address
loginctl enable-linger "$USER"               # optional: keep it running while logged out
```

`ExecStart` needs the absolute path to `bun` if it is not on the service's `PATH`
(e.g. `%h/.bun/bin/bun`). The shell it opens is `$SHELL -l` as this user, in `$HOME`.

## Operations

| Task | Command |
|---|---|
| Change the PIN (ends every session) | `bun run host pin` |
| Locked out after wrong PINs | wait until the time shown in the app, or reset with `bun run host pin` |
| Lost phone | `bun run host token --rotate`, then `bun run host pin` if the PIN may be known; pair the other phones again |
| Print the token | `bun run host token` |
| Stop exposing the host | stop `host serve` (`systemctl --user stop theone-host-shell`) |

Token rotation and PIN changes apply to the running daemon at once; no restart needed.

## Troubleshooting

- `Could not read the host's Tailscale IPv4`: run `tailscale up`, or pass `--bind`.
- `Refusing to bind …`: only loopback and Tailscale (`100.64.0.0/10`) addresses are allowed.
- App shows "Wrong PIN (n attempts left)": after 5 wrong PINs unlocking is locked for
  5 min, doubling with every further lockout (max 24 h).
- App cannot connect: check `curl http://<tailscale ip>:7701/v1/health` from another
  tailnet device and your Tailscale ACLs.
