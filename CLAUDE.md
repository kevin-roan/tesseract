@AGENTS.md

# Do not run the applications

- Never start, restart, or kill the mobile app or the Expo dev server yourself. The user already has it running, and it picks up changes automatically.
- Only run an app (mobile, controller, desktop) when the user explicitly asks for it in their message.
- To check your work, use `bun run typecheck` and `bun run test`, then tell the user to reload the app on the device.
