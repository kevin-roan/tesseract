# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# Monorepo

- bun workspaces: `apps/mobile` (Expo), `apps/controller` (Bun daemon inside the sandbox), `packages/protocol`, `packages/client`.
- Contract for names, ports, env vars and the controller API: `docs/architecture/00-blueprint.md`. Change it together with the code.
- Coding rules: `CODING.md`.
- Verify with `bun run typecheck` and `bun run test` from the repo root.

# Never start or restart the mobile app yourself

The user runs the Expo dev server. Do not run `expo start`, `npx expo ...`, `bun run start`/`ios`/`android`, or kill/restart the dev server, unless the user explicitly asks in that message.

- If a server is already on port 8081 (`ss -ltn | grep :8081`), leave it alone. It hot-reloads changes on its own.
- After changing `apps/mobile` (or `packages/*` it imports), verify with `bun run typecheck` and `bun run test`, then tell the user to reload the app on the device. If the change needs a clean Metro cache, say so and let the user restart it.
