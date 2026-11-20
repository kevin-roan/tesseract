# native/tailnet

Embedded Tesseract Network node: a Go wrapper around `tailscale.com/tsnet` with a
gomobile-compatible API, plus the `tesseract-tailnet` CLI for desktop hosts. See
[ADR 0014](../../docs/adr/0014-embedded-tailnet-and-tesseract-accounts.md), section 3.

```go
func Start(stateDir, controlURL, authKey, hostname string) error
func Stop() error
func Logout() error
func StatusJSON() string // TailnetStatus from @tesseract/protocol
func Forward(host string, port int) (int, error)
func CloseForward(host string, port int)
func Serve(tailnetPort int, localAddr string) error
```

- `tailnet.go`: the package-level API, one node per process.
- `internal/node`: the node itself (status, forwarders, serve listeners); tests run several.
- `cmd/tesseract-tailnet`: `up --state-dir D --login-server URL [--auth-key K] --hostname H [--serve PORT=ADDR ...]`
  prints one status JSON per line on stdout, logs on stderr, stops on SIGTERM/SIGINT. `version` prints the build.

Log uploads to Tailscale are disabled. Set `TESSERACT_TAILNET_VERBOSE=1` (library) or
`--verbose` (CLI) for backend logs on stderr.

## Build

Requires Go (see `go.mod`). Outputs are not committed.

| Script | Output |
|---|---|
| `scripts/build-desktop.sh [goos/goarch ...]` | `apps/electron/resources/bin/<linux\|mac\|win>-<x64\|arm64>/tesseract-tailnet[.exe]` |
| `scripts/build-android.sh` | `apps/mobile/modules/tesseract-tailnet/android/libs/tailnet.aar` (needs `ANDROID_HOME` with an NDK) |
| `scripts/build-ios.sh` | `apps/mobile/modules/tesseract-tailnet/ios/Tailnet.xcframework` (macOS + Xcode) |

The mobile scripts install `gomobile`/`gobind` into `$(go env GOPATH)/bin` when missing.

## Test

```sh
go vet ./... && go test ./...
```

The tests run an in-process control server, DERP and STUN (`internal/nodetest`) and
connect real nodes through them.
