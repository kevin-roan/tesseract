# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# Monorepo

- bun workspaces: `apps/mobile` (Expo), `apps/controller` (Bun daemon inside the sandbox), `packages/protocol`, `packages/client`.
- Contract for names, ports, env vars and the controller API: `docs/architecture/00-blueprint.md`. Change it together with the code.
- Coding rules: `CODING.md`.
- Verify with `bun run typecheck` and `bun run test` from the repo root.

# After changing the mobile app: restart Expo yourself

Don't ask; do it at the end of every task that touches `apps/mobile` (or `packages/*` it imports), then tell the user to reload the app on the device.

1. Kill the running dev server: `pkill -f "node .*expo start"` (a bare `pkill -f "expo start"` also kills the shell running it, exit 144), then check that port 8081 is free (`ss -ltn | grep :8081`).
2. Start it again from `apps/mobile` as a background command: `npx expo start --clear > /tmp/theone-expo.log 2>&1`. Do not set `CI=1`, because that turns off reloads.
3. Wait until `curl -s localhost:8081/status` returns `packager-status:running`, then check `/tmp/theone-expo.log` for bundling errors.
