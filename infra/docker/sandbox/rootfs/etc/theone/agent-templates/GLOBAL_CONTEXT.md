# Global Context

Agent-maintained. Sandbox identity, rules, user preferences and the project list.
Tool versions: `ENVIRONMENT.md` (regenerated every start). Live state: `RUNTIME.md` (controller).
Keep it short (the phone shows it) and never write secrets here.

## Environment

- Execution: TheOne sandbox container (Debian 13 trixie), user `dev`. The host only runs Docker; modifying it is FORBIDDEN.
- Workspace: `/workspace` (volume). Projects: `/workspace/projects/<projectId>`. Artifacts: `/workspace/artifacts/`.
- Home: `/home/dev` (volume): Claude login, wine prefix, package caches. Anything else is lost when the container is recreated.
- Remote access: phone → Tailscale → theone-controller (`127.0.0.1:7700` inside the sandbox).
- Visual access: X display `:1` (Xvnc + openbox), VNC port 5901, viewed from the phone through the controller.
- Public controller URL: (fill in from ENVIRONMENT.md; never add tokens or passwords)

## Rules

- Build, run and test only inside the sandbox; GUI apps on `DISPLAY=:1` (Chromium/Electron need `--no-sandbox`).
- Call the local API only with `theone-controller api <METHOD> <PATH> [JSON|-]` (examples in COMMANDS.md). It authenticates on its own: no curl with a token, never run `theone-controller token` or `theone-controller pair`.
- Long-running work goes through the controller (`theone-controller api POST /v1/processes …`, `… POST /v1/builds …`) so the phone can see it.
- Report milestones with `theone-controller emit --status <status> --message "<one line>" [--project <id>]`.
- Never read, list, print, copy or edit anything under `/workspace/.agent/controller/` (token, database, logs).
- `theone-controller api` redacts the token and the VNC password; never print them from anywhere else (`/home/dev/.vnc/`, `/run/theone/`).
- Never discard user work without explicit permission.

## Projects

| Project | Path | Stack | Status |
|---|---|---|---|

## User preferences

- (durable preferences: conventions, package managers, commit style, review habits)

## System changes

- (packages installed with sudo since the container was created; they vanish on recreation)

## Known limitations

- Windows builds run through wine: NSIS, portable and zip targets; Squirrel only with mono (best-effort).
- No macOS builds, no Android emulator (no KVM).
- No Docker unless the stack was started with `--dind` (`$DOCKER_HOST` set).
