# Electron builds (Linux and Windows)

Build Electron apps for Linux and Windows inside the sandbox, from the phone
or from a shell, and smoke-test the Linux build on the virtual display. Background:
[electron-windows-wine.md](../architecture/electron-windows-wine.md).

## 1. Get the project into the sandbox

From the phone: Agents tab → **Projects** → **Add** → name, git URL (and
optionally a branch) → the app shows the clone's log and opens the project when
git exits with 0. If the clone fails, the exit code is shown and the folder
stays, so you can fix it from a terminal. Otherwise, from a sandbox shell or
Claude (the API variant runs the clone as a tracked process):

```bash
cd /workspace/projects && git clone https://github.com/acme/my-electron-app.git my-electron-app
# or, with the API:
tesseract-controller api POST /v1/projects '{"name":"my-electron-app","gitUrl":"https://github.com/acme/my-electron-app.git"}'
```

The repository's own fixture, `examples/electron-hello` (Electron plus
electron-builder, not a workspace member), is the quickest end-to-end test.
Copy it into the sandbox from the host, extracting as `dev` so the files get
the right owner:

```bash
tar -C examples -c electron-hello | docker exec -i -u dev tesseract-sandbox-1 tar -C /workspace/projects -x
```

The project must list `electron-builder` (or `@electron-forge/cli`) in its
dependencies for the controller to offer the `electron-*` targets
(`Project.buildTargets`).

## 2. Build from the phone

Agents tab → **Projects** → project → **Build** → target (debug or release):

| Target | Command the controller runs | Collected artifacts |
|---|---|---|
| `electron-linux` | `<pm> install` → (`<pm> run build` if present and it does not call the packager itself) → `<exec> electron-builder --linux AppImage --x64 --publish never` | `dist/*.AppImage`, `dist/*.deb` (or `build.directories.output`) |
| `electron-windows` | same, with `--win nsis --x64`, in the wine env | `dist/*.exe`, excluding `__uninstaller*` |
| Forge projects | `<exec> electron-forge make --platform linux\|win32 --arch x64` | `out/make/**` |

`<exec>` is the package manager's local runner (`npx --yes=false`, `pnpm exec`,
`yarn run`, `bunx --no-install`). Only files written by this build are
collected; installers of earlier builds in `dist/` are ignored. The `debug` profile (the default) adds
`-c.compression=store`, which is faster to build and produces bigger files.
Use `release` for installers you ship. The full recipe rules are in
[controller.md](../architecture/controller.md#build-queue-and-recipes).

Artifacts are copied to `/workspace/artifacts/` as
`<project>-<platform>-<profile>-<version>.<ext>`, e.g.
`electron-hello-windows-release-1.0.0.exe` (electron-builder itself writes
`dist/electron-hello-win-x64-1.0.0.exe`, following the example's `artifactName`), with a sha256, and appear under
**Artifacts** for download. A second build of the same version gets `-2`,
`-3`, … before the extension.

The equivalent with the API (from a shell in the sandbox, see
[SPEC §8.2](../../SPEC.md#82-local-api)):

```bash
tesseract-controller api POST /v1/builds '{"projectId":"electron-hello","target":"electron-windows","profile":"release"}'
tesseract-controller api GET /v1/builds/<id>                    # state, stage, artifacts
tesseract-controller api GET "/v1/builds/<id>/logs?tail=100"
```

## 3. Build by hand (iterating)

```bash
cd /workspace/projects/electron-hello
npm ci                                                     # or the project's package manager
npm install-scripts ls                                     # npm 11 skipped these; approve only what you need
npx electron-builder --linux AppImage --x64 --publish never
npx electron-builder --win nsis --x64 --publish never      # uses wine from WINEPREFIX=/home/dev/.wine
npx electron-builder --win portable --x64 --publish never  # single-file portable exe
ls -lh dist/
```

The first Windows build downloads the Windows Electron zip and the NSIS
toolchain into `~/.cache/electron` and `~/.cache/electron-builder` on the home
volume. Later builds reuse them. Builds need network access (npm registry,
Electron and electron-builder downloads).

npm 11 skips dependency install scripts that are not approved in the project's
`package.json` (`allowScripts`). Packaging does not need them. `npm start`
(`electron .`) needs `electron`'s script and Squirrel needs
`electron-winstaller`'s: `npm install-scripts approve electron && npm rebuild electron`
([details](../architecture/electron-windows-wine.md#npm-11-install-script-approval)).

## 4. Run and smoke-test on the display

Open **Display** in the app (noVNC) first, so you can watch. From the phone,
the simplest way is the project screen: **Scripts** → `start` → **Show on
display** → **Run** (needs `electron`'s install script, see above). From a shell:

```bash
# Linux dev run
tesseract-controller api POST /v1/processes '{"projectId":"electron-hello","name":"dev","command":"npm start","display":true}'   # start script passes --no-sandbox
# Linux AppImage (APPIMAGE_EXTRACT_AND_RUN=1 is set in the image, no FUSE needed)
tesseract-controller api POST /v1/processes '{"projectId":"electron-hello","name":"appimage","display":true,"command":"./dist/*.AppImage --no-sandbox"}'
tesseract-screenshot -w "Tesseract Electron Hello"
tesseract-controller api GET /v1/display/screenshot > /tmp/check.png
```

Stop each one with `tesseract-controller api DELETE /v1/processes/<id>` or from
the app's process list.

**Windows builds:** building the installer through wine is reliable, running
it is not. With Electron 44 on wine 10.0, `dist/win-unpacked/*.exe` starts but
shows no window. Smoke-test the Linux build of the same sources, verify the
Windows artifact by size and sha256, and report it as "built, not run on
Windows". Trying `wine dist/win-unpacked/*.exe --disable-gpu` is best-effort
(see the [limits](../architecture/electron-windows-wine.md#smoke-testing)).

## 5. Signing

- **Windows:** put the PFX in `/home/dev/.secrets/<project>/` and set
  `CSC_LINK` and `CSC_KEY_PASSWORD` for the build. electron-builder then signs
  with `osslsigncode`. The controller's build API cannot pass environment
  variables, and it runs `electron-builder` directly (not through a `build`
  script that calls it), so sign release builds by hand (section 3) with the
  variables exported from a file in `/home/dev/.secrets/<project>/`. Details
  and manual signing:
  [electron-windows-wine.md](../architecture/electron-windows-wine.md#code-signing).
- **Linux:** AppImages are usually unsigned. Sign `.deb`/`.rpm` repositories outside the sandbox pipeline.
- **macOS:** not possible here.

## 6. Common failures

| Symptom | Fix |
|---|---|
| `electron-windows` missing from build targets | add `electron-builder` to the project's dependencies (detection reads `package.json` on disk), then refresh the project |
| `wine: '/home/dev/.wine' is not owned by you` | the volume was created by another uid. Run `sudo chown -R dev:dev /home/dev/.wine` in the sandbox |
| Build stuck at `building target=nsis` | wine is showing a dialog. Look at the display, close it, and check `/workspace/.agent/logs/supervisor/wine-init.log` |
| `Exit code: ENOENT. spawn mono` | Squirrel maker without mono. Use NSIS, or build the image with `WITH_MONO=true` |
| `npm start`: "Electron failed to install correctly" | npm 11 skipped `electron`'s install script: `npm install-scripts approve electron && npm rebuild electron` |
| Windows app shows no window under wine | expected with Electron 44 on wine 10; smoke-test the Linux build |
| Build failed: "No artifacts from this build matched …" | the packager wrote nothing new (only older files in the output dir), or into another directory; check the log |
| AppImage fails with `fuse: device not found` | run with `--appimage-extract-and-run`, or make sure `APPIMAGE_EXTRACT_AND_RUN=1` is set |
| Black window | add `--disable-gpu` (no GPU in the sandbox) |
| Native module error on Windows only | the module has no Windows prebuild. Pin a version that ships one |

More in [troubleshooting.md](troubleshooting.md).
