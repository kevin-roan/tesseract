# tesseract-simcap

macOS helper that streams an iOS Simulator screen as H.264. It reads the framebuffer through Apple's private
CoreSimulator/SimulatorKit frameworks and encodes it with VideoToolbox (I and P frames only, no B-frames). The host
daemon (`apps/controller/src/host/ios`) runs it for `/v1/ios/screen`; without it the daemon falls back to idb + ffmpeg.

CoreSimulator and SimulatorKit are loaded with `dlopen` at runtime (never linked), so the binary only works with an
installed Xcode. It does not need Screen Recording permission.

## Build

Only on a Mac (plain `swiftc`, no Package.swift). Cross-compiling the other arch works from either Mac:

```sh
xcrun --sdk macosx swiftc -O -swift-version 5 -target arm64-apple-macos12 \
  -framework VideoToolbox -framework CoreMedia -framework CoreVideo -framework IOSurface \
  -o <out>/tesseract-simcap apps/controller/native/simcap/*.swift
```

Use `-target x86_64-apple-macos12` for Intel. `tests/` is not part of the binary (the glob is not recursive).

Tests for the pure encoder decisions in `policy.swift` (key frame retry, stale buffers, startup deadline):

```sh
xcrun --sdk macosx swiftc -swift-version 5 -o /tmp/simcap-policy-tests \
  apps/controller/native/simcap/policy.swift apps/controller/native/simcap/tests/main.swift && /tmp/simcap-policy-tests
``` Rebuilding after an Xcode update is not required, but run `probe` to
check that the private API still matches.

## CLI

```
tesseract-simcap --version
tesseract-simcap probe  --udid <UDID> [--developer-dir <dir>]
tesseract-simcap stream --udid <UDID> [--bitrate <bps>] [--fps <max>] [--keyint-sec <s>] [--max-side <px>]
                        [--idle-fps <n>] [--screen-id <n>] [--developer-dir <dir>]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--bitrate` | 6000000 | Average bit rate; bursts are capped at 2x per second. |
| `--fps` | 60 | Max encoded frame rate. Bursts are coalesced; the last frame of a burst is never dropped. |
| `--keyint-sec` | 2 | A key frame (IDR) at least this often. |
| `--max-side` | 0 | Scale so the longer side is at most this many pixels (0 = native, e.g. 1320x2868). |
| `--idle-fps` | 1 | Re-encode the last frame at this rate while the screen is static. |
| `--screen-id` | lowest | SimScreen screenID to capture (1 = the main "LCD" screen). |
| `--developer-dir` | `$DEVELOPER_DIR`, else `xcode-select -p` | Xcode developer dir that provides SimulatorKit. |

Debug only: `--api screen|damage` (force the legacy damage-rectangle callbacks) and `--stats-sec <s>` (default 5).

`probe` prints one JSON line on stdout and exits 0 when the frameworks load, the device is booted and its screen port
has a callback API: `{"ok":true,"api":"screen"|"damage","width":1320,"height":2868}`. Otherwise it prints
`{"ok":false,"message":"..."}` and exits 1.

## `stream` output

stdout is a sequence of packets (not a raw Annex-B stream):

```
u32 BE  payload length
u8      flags   0x80 size    payload = u32 BE width, u32 BE height of the encoded frames
                0x01 config  payload = Annex-B SPS + PPS (4-byte start codes)
                0x02 key     payload = Annex-B IDR access unit, without SPS/PPS
                0x00 delta   payload = Annex-B P-frame access unit
payload
```

- The stream starts with size, config, key. After a resolution change it repeats size, config, key.
- Config is only sent when the SPS/PPS bytes change, not before every key frame.
- One packet is one access unit, written as soon as VideoToolbox returns it. Decode order is display order.

stdin: a line `k` forces a key frame now (the last frame is re-encoded). EOF on stdin is ignored.

stderr: JSON lines for logs only (`screen`, `mode`, `size`, `stats`, `warn`, `error`).

Exit codes: 0 on SIGTERM/SIGINT or when stdout is closed; 1 setup error (bad arguments, unknown or not booted device,
framework or API missing, no key frame written within 10 s); 3 the device stopped being booted.

## Notes (Xcode 26.2)

- Port descriptors are ROCK XPC proxies, so KVC does not work on them; all calls are typed IMP calls.
- Xcode 26 screens implement `registerScreenCallbacksWithUUID:callbackQueue:frameCallback:...` (one callback per
  presented frame). Older Xcodes only have `ioSurfacesChange` + `damageRectangles`, used as a fallback.
- The framebuffer is copied at callback time; encoding the live IOSurface later smears transitions.
- Callbacks are unregistered before exit. The device state is polled once a second to notice a shutdown.
