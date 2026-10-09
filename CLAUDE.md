@AGENTS.md

# Desktop app: Electron only

- The desktop app is `apps/electron` (Electron). All desktop work goes there.
- The old GTK app (`apps/desktop`) has been removed from the repo. Do not recreate it; GTK mentions in `docs/` are history (the Electron app was ported from it).
- "Desktop app", "build/install the desktop app" and similar always mean the Electron app. On this Linux machine it is installed as `~/Applications/Tesseract.AppImage` (built with `bun run electron:dist`).

# Do not run the applications

- Never start, restart, or kill the mobile app or the Expo dev server yourself. The user already has it running, and it picks up changes automatically.
- Only run an app (mobile, controller, desktop) when the user explicitly asks for it in their message.
- To check your work, use `bun run typecheck` and `bun run test`, then tell the user to reload the app on the device.
