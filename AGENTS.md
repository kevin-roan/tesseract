# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# Monorepo

- bun workspaces: `apps/mobile` (Expo), `apps/controller` (Bun daemon inside the sandbox), `packages/protocol`, `packages/client`.
- Contract for names, ports, env vars and the controller API: `docs/architecture/00-blueprint.md`. Change it together with the code.
- Coding rules: `CODING.md`.
- Verify with `bun run typecheck` and `bun run test` from the repo root.
