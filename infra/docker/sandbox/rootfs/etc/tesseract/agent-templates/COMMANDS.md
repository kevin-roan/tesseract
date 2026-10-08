# Commands

Commands that actually succeeded in this sandbox. Add a line only after it worked.

## Sandbox

| Purpose | Command |
|---|---|
| Health check | `tesseract-doctor` |
| Sandbox status summary | `tesseract-controller status` |
| Screenshot of display :1 | `tesseract-screenshot [-w <window title>] [out.png]` |
| Status event to the phone | `tesseract-controller emit --status building --message "<text>" --project <id>` |
| Supervised programs | `supervisorctl status` (xvnc, openbox, controller, wine-init) |
| Supervisor logs | `/workspace/.agent/logs/supervisor/` |

## Local API

`tesseract-controller api <METHOD> <PATH> [JSON|-]` (GET, POST or DELETE; PATH under `/v1/`)
calls the controller on `127.0.0.1:7700` with its own credentials and prints the JSON
response with the token and VNC password redacted. `-` reads the body from stdin; binary
responses must be redirected to a file. It is the only way to reach the API: never use
curl with a token, never run `tesseract-controller token` or `pair`, and never touch
anything under `/workspace/.agent/controller/`.

| Purpose | Command |
|---|---|
| Projects | `tesseract-controller api GET /v1/projects` |
| Start a tracked process (GUI: `"display":true`) | `tesseract-controller api POST /v1/processes '{"projectId":"<id>","name":"app","command":"npm start","display":true}'` |
| Process logs | `tesseract-controller api GET "/v1/processes/<prc_id>/logs?tail=200"` |
| Stop a process | `tesseract-controller api DELETE /v1/processes/<prc_id>` |
| Queue a build | `tesseract-controller api POST /v1/builds '{"projectId":"<id>","target":"electron-linux","profile":"debug"}'` |
| Build state | `tesseract-controller api GET /v1/builds/<bld_id>` |
| Build logs | `tesseract-controller api GET "/v1/builds/<bld_id>/logs?tail=200"` |
| Artifacts | `tesseract-controller api GET "/v1/artifacts?projectId=<id>"` |
| Screenshot through the API | `tesseract-controller api GET /v1/display/screenshot > shot.png` |

Body from stdin:

```bash
jq -n --arg cmd "npm run dev" '{projectId: "<id>", name: "dev", command: $cmd}' \
  | tesseract-controller api POST /v1/processes -
```

## Electron

| Purpose | Command |
|---|---|
| Linux AppImage | `npx electron-builder --linux AppImage --x64 --publish never` |
| Windows installer (wine) | `npx electron-builder --win nsis --x64 --publish never` |
| Run on the display | `DISPLAY=:1 npx electron . --no-sandbox` |

## Android

| Purpose | Command |
|---|---|
| Generate native project (Expo) | `npx expo prebuild -p android --no-install` |
| Debug APK | `./gradlew assembleDebug` |
| Stop Gradle daemons | `./gradlew --stop` |

## Projects

<!-- ### <project id>
| Purpose | Command |
|---|---| -->
