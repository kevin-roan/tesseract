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

## Android emulator

The daemon also drives an Android emulator on the host (KVM) and streams its screen to
the app (**Host → Android emulator**); contract in
[app-runs-and-emulator.md §2](../architecture/app-runs-and-emulator.md#2-android-emulator-on-the-host).
It needs the Android SDK emulator, `adb`, `scrcpy` (for `scrcpy-server`) and, for phones
that can't decode H.264, `ffmpeg` on the host; `GET /v1/android` reports what is missing. Stopping the daemon leaves the emulator
running; the next daemon adopts it.

By default the emulator runs **network-isolated** (`THEONE_EMULATOR_ISOLATION=netns`): in its
own user + network namespace, where the guest can reach only public internet addresses
through a filtering proxy in the daemon, never the host's loopback (your adb server, this
daemon, local dev servers), your LAN or your tailnet. That needs `unshare` (util-linux), `ip`
(iproute2) and unprivileged user namespaces (`unshare --user --map-root-user --net true`
must work as your user; most distributions allow it). Its adb serial on the host is
`127.0.0.1:<port>` (a bridge the daemon `adb connect`s to your adb server), not
`emulator-5554`.

| Variable | Default |
|---|---|
| `THEONE_ANDROID_SDK_ROOT` | `~/.local/share/theone/android-sdk` if it has `emulator/emulator`, else `$ANDROID_SDK_ROOT`, else `$ANDROID_HOME` |
| `THEONE_ADB` | `adb` on `PATH` (talks to your normal adb server on 5037) |
| `THEONE_SCRCPY_SERVER` | `/usr/share/scrcpy/scrcpy-server`, else `/usr/local/share/scrcpy/scrcpy-server` |
| `THEONE_SCRCPY_VERSION` | parsed from `scrcpy --version`; must equal the jar's version |
| `THEONE_FFMPEG` | `ffmpeg` on `PATH` |
| `THEONE_EMULATOR_PORT` | `5554` (even, 5554-5682; adbd = +1) |
| `THEONE_EMULATOR_GPU` | `host` if a `/dev/dri/renderD*` node is usable, else `swiftshader_indirect` |
| `THEONE_EMULATOR_ISOLATION` | `netns`; `none` runs it on the host network (see the warning below) |
| `THEONE_EMULATOR_ALLOW_NETS` | — ; comma-separated CIDRs the guest may reach anyway, e.g. `192.168.1.20/32` for a backend on your LAN |
| `THEONE_EMULATOR_ADB_PORT` | a free port, reused after daemon restarts |

Its runtime files (sockets, pids, `emulator.log`) are in
`$XDG_RUNTIME_DIR/theone/emulator-<port>/` (0700). The daemon logs every refused guest
connection as `emulator egress denied host=… port=…`.

`THEONE_EMULATOR_ISOLATION=none` is only for hosts without user namespaces: then the guest
(root for anyone with adb access, i.e. the linked sandbox) reaches `10.0.2.2` = your
`127.0.0.1`, including your unauthenticated adb server and everything on your LAN and tailnet.
An emulator you start yourself (`emulator -avd …`, serial `emulator-5554`) is adopted and can
be viewed, but with isolation on it is **not** linked to the sandbox ("Emulator is not
isolated; start it from the app"): stop it and start it from the app.

### Screen sharing and stream settings

The phone can view any device `adb devices` lists on the host, not only the daemon's
emulator: a Genymotion VM (it registers with adb as `192.168.56.x:5555`; set Genymotion's
*ADB → Use custom Android SDK tools* to the same SDK so both share one adb server), a phone
on USB, or one connected with `adb connect <ip>:<port>` / wireless debugging. adb stays on the
host; only the scrcpy video and input travel over the tailnet to the phone. Only the
daemon's own (isolated) emulator can be linked to the sandbox.

By default the daemon forwards scrcpy's H.264 untouched and the phone decodes it (WebCodecs),
which needs far less bandwidth than the JPEG fallback that ffmpeg makes for phones that can't.
Tune it in the desktop app (**Settings → Android streaming**), from the CLI, or with
`PUT /v1/android/stream`:

```sh
theone-controller host stream                       # settings and adb devices
echo '{"bitRate":4000000,"maxFps":30}' | theone-controller host stream --stdin
echo '{"device":"192.168.56.101:5555"}' | theone-controller host stream --stdin
```

| Setting | Default | |
|---|---|---|
| `encoding` | `h264` | `mjpeg` always sends JPEG (needs ffmpeg) |
| `bitRate` | `8000000` | bps; lower it when `tailscale status` shows the phone `relay` instead of `direct` |
| `maxFps` | `60` | |
| `maxSize` | `null` | caps the longest side; `null` follows the phone's screen |
| `keyFrameInterval` | `2` | seconds; a phone that falls behind waits for the next key frame |
| `jpegQuality` | `5` | ffmpeg `-q:v`, 2 (best) to 31 |
| `device` | `null` | adb serial the phone opens by default; `null` is the daemon's emulator |

Saved settings reach screens that are already open: the daemon watches `state.json`, so
within a moment each phone switches to a new session with the new settings without
reconnecting. On the phone, the corners button in the screen's bar goes full screen
(the small button in the corner, or Android's back, leaves it).

**Link sandbox** in the app stores the sandbox URL and token in `state.json` (`androidLink`)
and the daemon dials the sandbox's `/v1/android/link`, so builds in the sandbox can use the
emulator through `adb` (serial `127.0.0.1:15555` there). The host token + PIN therefore also
give control of the linked sandbox.

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
- Android: "Emulator network isolation could not create a user and network namespace":
  check `unshare --user --map-root-user --net true` (Debian/Ubuntu:
  `sysctl kernel.unprivileged_userns_clone=1`; Ubuntu 24.04+ AppArmor:
  `kernel.apparmor_restrict_unprivileged_userns=0`, or a profile for `unshare`). Only if that
  is impossible, set `THEONE_EMULATOR_ISOLATION=none` and accept the risk above.
- Android app in the emulator cannot reach a dev server on your machine or LAN: that is the
  isolation. Expose the server publicly, or allow its address with
  `THEONE_EMULATOR_ALLOW_NETS` (host loopback stays blocked whatever you allow, so bind the
  dev server to your LAN address).
- Android emulator `failed` with "did not boot": see `emulator.log` in the runtime dir; an
  adopted emulator that never booted stays `failed` until you stop it (Delete) or it exits.
