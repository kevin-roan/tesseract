# ADR 0001: Monorepo with bun workspaces

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

Tesseract began as a single Expo app. The product now needs a daemon inside the
sandbox (the controller), a wire contract shared by the app and the daemon, a
client library, a Docker image and a compose stack. The protocol changes often
while the MVP is built. A change to one endpoint touches the schema, the
server, the client and the screens, and those must land together.

The app is React Native, whose bundler (Metro) and native autolinking are
sensitive to how `node_modules` is laid out.

## Decision

- One repository with bun workspaces: `apps/*` (`mobile`, `controller`) and
  `packages/*` (`protocol`, `client`). `infra/`, `examples/` and `docs/` are
  plain directories.
- `bunfig.toml` sets `[install] linker = "hoisted"`, giving a flat
  `node_modules` that Metro and Expo autolinking handle reliably.
- Internal packages export TypeScript source (`exports: { ".": "./src/index.ts" }`)
  and have no build step.
- The root scripts `typecheck`, `test` and `lint` fan out with
  `bun run --filter '*'`. Every package defines `typecheck` and `test`.
- `docs/architecture/00-blueprint.md` is the contract, changed together with the code.

## Consequences

- A protocol change is one atomic change with type checking across app,
  client and server.
- The controller Docker stage builds from the repository root, so its context
  includes the whole repo. `.dockerignore` must keep `node_modules`, native
  folders and docs out of it.
- Hoisting allows phantom dependencies (importing a package you did not
  declare). Typecheck and review have to catch them.
- Source-exporting packages must stay platform-neutral: no Node, Bun or React
  Native specific imports.
- Contributors need bun on the host. npm, yarn and pnpm are not used for the repository.

## Alternatives considered

- **Separate repositories** (app, controller, protocol). This needs protocol
  versioning and publishing from day one, and slows iteration while the
  contract is still moving.
- **pnpm workspaces.** Mature, but they need `node-linker=hoisted` for React
  Native anyway, and they bring no single-binary compiler. Bun already runs
  and compiles the controller.
- **Nx or Turborepo on top.** Unnecessary for four packages. Caching can be
  added later without restructuring.
- **Bun isolated linker.** Stricter, but Metro and some Expo config plugins
  resolve transitive native packages by walking up `node_modules` and break.
