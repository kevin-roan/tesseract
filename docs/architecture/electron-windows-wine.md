# Electron builds for Windows via wine

The sandbox is Linux, but it builds Windows installers for Electron apps
without a Windows machine. Running the result under wine is best-effort (see
[smoke testing](#smoke-testing)). This page explains how that
works and where it stops working. Decision record:
[ADR 0005](../adr/0005-wine-for-windows-electron-builds.md). Step-by-step
usage: [runbooks/electron-builds.md](../runbooks/electron-builds.md).

## How a Windows build works on Linux

Packaging an Electron app for Windows mostly doesn't need Windows:

1. **Download the Windows Electron runtime.** `electron.exe` and its DLLs are
   prebuilt zips from the Electron releases, cached in `~/.cache/electron`.
2. **Copy the app** (`app.asar`, resources) next to it. This is plain file work.
3. **Patch resources** in `electron.exe`: icon, version info, product name,
   and the manifest (`requestedExecutionLevel`). electron-builder uses
   `rcedit`, a Windows executable, and runs it under **wine** on Linux. Newer
   electron-builder versions can edit resources natively for some cases, and
   wine covers the rest.
4. **Build the installer.** NSIS (`makensis`) has Linux builds, which
   electron-builder downloads. The uninstaller stub is produced by running the
   generated installer under wine, which is why you see a
   `__uninstaller-nsis-*.exe` in `dist/`. The recipe skips it when collecting artifacts.
5. **Sign** (optional) with Authenticode via `osslsigncode` or `jsign`, which are native Linux tools.

What cannot happen on Linux is compiling Windows **native Node modules**. They
need prebuilt Windows binaries (`prebuild`/`node-gyp-build` packages usually
ship them), or the build fails.

## Sandbox setup

| Piece | Value |
|---|---|
| wine | 64-bit wine with the `wine32:i386` libraries (NSIS and some tools are 32-bit) |
| Prefix | `WINEPREFIX=/home/dev/.wine` on the `theone-home` volume, `WINEARCH=win64` |
| Noise | `WINEDEBUG=-all` |
| Init | supervisord oneshot `wine-init` runs `wineboot -u` at container start (idempotent) |
| Display | `DISPLAY=:1`, so wine dialogs and the app appear in VNC |
| Extra tools | `osslsigncode`, `fakeroot`, `dpkg-dev`, `rpm`, `xz`, and `mono-complete` unless the image is built with `WITH_MONO=false`. `wine64` is linked into `/usr/local/bin` because electron-winstaller calls it and Debian's wine 10 only ships it under `/usr/lib/wine` |
| Versions | Debian trixie: wine 10.0; Node 24 with npm 11 |

Reset a broken prefix: [operations → reset the wine prefix](../runbooks/operations.md#reset-the-wine-prefix).

## electron-builder vs Electron Forge

| | electron-builder | Electron Forge |
|---|---|---|
| Detection | `electron-builder` in dependencies | `@electron-forge/cli` in dependencies |
| Controller command | `<exec> electron-builder --win nsis --x64 --publish never` | `<exec> electron-forge make --platform win32 --arch x64` |
| Output | `dist/*.exe` (installer); `dist/win-unpacked/` (unpacked app) | `out/make/**` (per maker); `out/<name>-win32-x64/` |
| Windows installer on Linux | NSIS and portable: reliable | `maker-squirrel`: needs mono and wine, best-effort. `maker-zip`: reliable |
| Recommendation | preferred for Windows from this sandbox | prefer `maker-zip` or switch the Windows target to electron-builder |

`<exec>` is the package manager's local runner (`npx --yes=false`, `pnpm exec`,
`yarn run`, `bunx --no-install`); see
[controller.md](controller.md#build-queue-and-recipes) for the full recipe.

## Target support matrix

| Target | Status in the sandbox |
|---|---|
| NSIS installer (`--win nsis`) | supported; the default recipe |
| Portable `.exe` (`--win portable`) | supported (run manually or configure in `build.win.target`) |
| `.zip` / `7z` | supported |
| Squirrel.Windows | best-effort (mono, and npm 11 must be allowed to run electron-winstaller's install script, [below](#npm-11-install-script-approval)) |
| MSI (WiX) | not supported (WiX needs Windows or .NET tooling) |
| AppX / MSIX | not supported (needs the Windows SDK `makeappx`) |
| arm64 Windows | packaging works (`--arm64`), running it under wine does not |
| macOS `.dmg`/`.app`/`.pkg` | **not possible**: needs macOS for `codesign`, notarization and `hdiutil` |

## npm 11 install-script approval

The image's npm (11.19) blocks dependency install scripts by default: `npm
install` skips every script not listed in the project's `allowScripts` and ends
with a list of what it skipped. electron-builder packaging does not need them, so
NSIS, portable, zip and AppImage builds work regardless. Two scripts matter:

| Package | Script needed for |
|---|---|
| `electron-winstaller` | Squirrel.Windows only |
| `electron` | downloading the runtime that `electron .` / `npm start` uses (not packaging) |

Approve what the project really needs, after reading the script, then rebuild it:

```bash
npm install-scripts ls
npm install-scripts approve electron electron-winstaller && npm rebuild electron electron-winstaller
```

Approvals are written (version-pinned) to the project's `package.json`, so they
are reviewed like any other change. Never use `--all` for convenience. pnpm and
bun have their own allow-lists (`onlyBuiltDependencies`, `trustedDependencies`).

## Code signing

Unsigned installers work but trigger SmartScreen warnings. When the user
provides a certificate:

- **PFX/P12 file**: store it in `/home/dev/.secrets/<project>/` (dir 0700,
  file 0600) and pass it through the environment variables electron-builder
  reads (`CSC_LINK=/home/dev/.secrets/<project>/cert.pfx`, `CSC_KEY_PASSWORD`).
  electron-builder signs with `osslsigncode` on Linux. `POST /v1/builds`
  takes no environment, so controller builds only sign when these variables
  are already in the build shell's environment. For signed releases, export
  them from a secrets file in a sandbox shell and build by hand:
  `set -a; . /home/dev/.secrets/<project>/signing.env; set +a; npx electron-builder --win nsis --x64 --publish never`.
- **Manual signing** of any `.exe`:

  ```bash
  osslsigncode sign -pkcs12 /home/dev/.secrets/hello/cert.pfx -pass "$CSC_KEY_PASSWORD" \
    -n "Hello" -i https://example.com -t http://timestamp.digicert.com \
    -in dist/hello-setup.exe -out dist/hello-setup-signed.exe
  osslsigncode verify dist/hello-setup-signed.exe
  ```

- **Keys in an HSM or a cloud KMS** (EV certificates are no longer issued as
  files): use `jsign` with the provider's PKCS#11 or KMS backend. That needs
  network access and credentials the user configures, and is outside the
  default recipe.

Signing keys MUST NOT be committed, printed or placed in `.agent/`
([SPEC §9](../../SPEC.md#9-git-dependencies-network-secrets)).

## Smoke testing

What is verified end to end (`bun run e2e`, `examples/electron-hello`): the
`electron-windows` build succeeds through wine and produces a valid NSIS
installer with its sha256. What is **not** reliable: running Windows Electron
builds under wine. With Electron 44 and Debian's wine 10.0,
`dist/win-unpacked/<App>.exe` starts but never shows a window. So:

1. **Smoke-test the Linux build on the display.** Build `electron-linux` from
   the same sources and run it; that proves the app itself starts and renders:

   ```bash
   theone-controller api POST /v1/processes '{"projectId":"hello","name":"linux-smoke","display":true,
     "command":"./dist/*.AppImage --no-sandbox"}'
   theone-screenshot -w "Hello"
   ```

2. **Treat the Windows artifact as build-verified.** Check that it exists, its
   size and sha256, and (optionally) its resources and signature
   (`osslsigncode verify`).
3. **Running the `.exe` under wine is best-effort.** Try it if useful
   (`wine "dist/win-unpacked/Hello.exe" --disable-gpu` as a `display: true`
   process, or `wine dist/<installer>.exe` to click through the installer in
   VNC), but a blank or missing window says nothing about real Windows, and a
   working one proves little more.

Even when a wine run works, it does **not** show:

- behavior on real Windows (GPU and DirectX paths, fonts and DPI scaling,
  Windows Defender and SmartScreen, the registry and services, auto-update via
  Squirrel or NSIS web installers)
- Windows-only native modules (a bad prebuild may still load under wine)
- installer UX on current Windows versions

Reports MUST say how the Windows build was verified ("built through wine,
installer not run on Windows", or "smoke-tested under wine") and list anything
that needs real Windows verification.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `wine: could not load kernel32.dll` / prefix errors | corrupted prefix, or it was created with a different `WINEARCH` | [reset the prefix](../runbooks/operations.md#reset-the-wine-prefix) |
| Build hangs at "building target=nsis" | wine is waiting on a dialog (e.g. a Mono or Gecko install prompt) | look at the display in VNC; `wine-init` should have run with `WINEDLLOVERRIDES=mscoree,mshtml=` |
| `rcedit` fails with `Unable to commit changes` | antivirus-style file locks do not exist here; usually a file still open from a previous run | rerun; `wineserver -k` to kill stale wine processes |
| Electron window is black under wine | GPU path | `--disable-gpu`, or `app.disableHardwareAcceleration()` in dev builds |
| Electron (44) window never appears under wine 10 | known incompatibility | smoke-test the Linux build instead; see [smoke testing](#smoke-testing) |
| `npm install` lists skipped install scripts (`allowScripts`) | npm 11 blocks dependency scripts by default | ignore it for packaging; [approve](#npm-11-install-script-approval) `electron-winstaller` for Squirrel |
| `npm start`: "Electron failed to install correctly" | `electron`'s install script was skipped | `npm install-scripts approve electron && npm rebuild electron`, or run the packaged AppImage |
| `Cannot find module '*.node'` on Windows only | a native module without Windows prebuilds | pin a version with prebuilds, or replace the module |
| Squirrel maker fails with `mono: command not found` | mono is not in the image | use `maker-zip` or electron-builder NSIS |

More: [runbooks/troubleshooting.md](../runbooks/troubleshooting.md).
