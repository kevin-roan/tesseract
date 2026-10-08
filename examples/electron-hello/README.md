# electron-hello

Minimal Electron + electron-builder app used to verify the Tesseract sandbox end to end:
Linux AppImage build, Windows NSIS build through wine, and rendering on the virtual
display. The window shows "Tesseract Electron Hello" plus the platform and the Electron,
Chromium and Node versions.

It is **not** a workspace member. Never install it on the host; only inside the sandbox
(or another container built from `infra/docker/sandbox/Dockerfile`).

## Build inside the sandbox

```bash
cp -r /path/to/examples/electron-hello /workspace/projects/electron-hello
cd /workspace/projects/electron-hello
npm install
npm run build:linux   # dist/electron-hello-linux-x86_64-1.0.0.AppImage
npm run build:win     # dist/electron-hello-win-x64-1.0.0.exe (NSIS, needs wine)
```

The controller detects `electron-builder` and offers the `electron-linux` and
`electron-windows` build targets, which run the same commands.

`npm install` warns that the `electron-winstaller` install script is not in
`allowScripts`. That script is only used by the Squirrel.Windows target, so NSIS and
AppImage builds work without it.

Squirrel.Windows also works when the image was built with mono (`WITH_MONO=true`, the
default):

```bash
npm install -D electron-builder-squirrel-windows@"$(node -p 'require("electron-builder/package.json").version')"
npm install-scripts approve electron-winstaller && npm rebuild electron-winstaller
npx electron-builder --win squirrel --x64 --publish never \
  -c.squirrelWindows.iconUrl=https://example.com/icon.ico   # dist/squirrel-windows/*.exe, *.nupkg, RELEASES
```

## Run on the virtual display

```bash
DISPLAY=:1 npm start                                                  # electron . --no-sandbox
DISPLAY=:1 ./dist/electron-hello-linux-x86_64-1.0.0.AppImage --no-sandbox
tesseract-screenshot -w "Tesseract Electron Hello"
```

- `--no-sandbox` is required: the container has no unprivileged user namespaces, and a
  `chrome-sandbox` helper that is not setuid root makes Electron abort.
- AppImages need no FUSE because the image sets `APPIMAGE_EXTRACT_AND_RUN=1`.
- D-Bus and ALSA errors in the log are expected and harmless.
- The Windows build (`dist/win-unpacked/Tesseract Electron Hello.exe`) does not render under
  wine 10.0 with Electron 44. The wine path is proven by producing the installer, not by
  running it.
