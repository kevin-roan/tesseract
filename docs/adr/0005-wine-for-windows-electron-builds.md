# ADR 0005: wine for Windows Electron builds

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

A core use case is building Windows installers for Electron apps from the
phone. The sandbox is Linux. electron-builder can package Windows targets on
Linux, but some steps run Windows executables (`rcedit` to set icons and
version resources, and parts of the NSIS toolchain), and the result should be
smoke-tested before it is shipped to real Windows machines. A Windows VM or a
Windows CI runner is outside the host-only-Docker constraint.

## Decision

- The `electron` image stage installs **wine** (64-bit, with the 32-bit
  `wine32:i386` libraries), `osslsigncode`, `fakeroot`, `dpkg-dev`, `rpm` and
  `xz`, plus `mono-complete` for Squirrel.Windows unless the image is built
  with `WITH_MONO=false`.
- The wine prefix lives at `/home/dev/.wine` (`WINEARCH=win64`,
  `WINEDEBUG=-all`) on the persistent home volume. The supervisord oneshot
  `wine-init` runs `wineboot -u` idempotently at start, so the first build does not pay for prefix creation.
- The `electron-windows` build recipe runs the project's own
  `electron-builder --win nsis --x64 --publish never` in that environment,
  through the package manager's local runner (`npx --no` for npm). Forge
  projects use `electron-forge make --platform win32 --arch x64`.
- Code signing, when the user provides a certificate, uses `osslsigncode`
  (Authenticode on Linux) or `jsign`. Keys stay in the sandbox (`/home/dev/.secrets/`).
- Smoke tests run the unpacked `.exe` under wine on display `:1`, where the
  user watches through VNC.

## Consequences

- Windows NSIS and portable builds work entirely inside the sandbox, with no host involvement.
- wine is large (hundreds of MB, including i386 multiarch) and makes the image slower to build.
- Running under wine proves little about real Windows. There is no GPU
  acceleration (`--disable-gpu` may be needed), fonts and DPI differ, and
  Windows-only native modules or services may behave differently. Reports
  must say "smoke-tested under wine", not "tested on Windows".
- Squirrel.Windows (Forge `maker-squirrel`) depends on mono and is best-effort.
  MSI (WiX) and AppX/MSIX targets are not supported.
- macOS targets remain impossible: signing and notarization need macOS
  (roadmap: a remote Mac builder).
- Native Node modules must have Windows prebuilds. They cannot be compiled for
  Windows in the sandbox.

## Alternatives considered

- **Windows VM or container** (dockur/windows, a KVM-based VM). Needs KVM and
  privileged devices on the host, plus licensing. It violates host-minimal.
- **Windows CI (GitHub Actions).** Useful later as an optional remote builder,
  but it moves builds and secrets off the sandbox and needs network credentials.
- **The electronuserland/builder:wine image as a nested container.** Requires
  Docker inside the sandbox (dind) for every build. Installing wine directly is simpler.
- **Skipping wine** (`--win` without rcedit). Leaves icons and version info
  missing and gives no way to smoke-test.

## Update (2026-09-23): smoke tests

The end-to-end suite showed that the decision's last bullet does not hold for
current Electron: with Electron 44 on Debian's wine 10.0 the unpacked `.exe`
starts but never shows a window. Building NSIS installers through wine works
and is covered by `bun run e2e`. Therefore:

- The Linux build of the same sources is what gets smoke-tested on display `:1`.
- The Windows artifact is verified as a file (size, sha256, optional signature
  check) and reported as "built, not run on Windows".
- Running Windows builds under wine remains possible but best-effort.

Other implementation notes: npm's local runner is invoked as `npx --yes=false`
(a bare `--no` swallows the next argument); `wine64` is linked into
`/usr/local/bin` for electron-winstaller; npm 11 skips unapproved dependency
install scripts, so Squirrel needs `npm install-scripts approve electron-winstaller`.
