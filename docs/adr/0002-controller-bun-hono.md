# ADR 0002: Controller on Bun + Hono

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The sandbox needs one network-facing daemon that exposes REST and WebSockets,
supervises child processes and PTYs, runs build recipes, bridges VNC, persists
job history and serves two static web pages (terminal and VNC). It runs inside
a container that ships many toolchains already, so it should add as little
runtime surface as possible and start instantly. It must also run on a
developer laptop without X, VNC, wine or Claude for tests.

## Decision

- Runtime: **Bun**. Built-in HTTP server with WebSocket upgrade, built-in
  `bun:sqlite`, `Bun.spawn` (including a terminal/PTY option), `bun test`,
  and `bun build --compile` for a single self-contained binary
  (`/usr/local/bin/tesseract-controller`).
- HTTP framework: **Hono**. Small, typed routing, middleware for auth, error
  mapping and CORS, and first-class Bun support. Request bodies are validated
  with the zod schemas from `@tesseract/protocol`.
- One binary provides both the daemon (`serve`) and the CLI (`pair`,
  `status`, `emit`, `token`).
- Every sandbox dependency is optional and probed at runtime. A missing one
  is reported as unavailable (`tools[].version: null`,
  `display.available: false`, HTTP 503 `unavailable`) rather than crashing.

## Consequences

- The image needs no Node or Bun runtime for the controller. Bun is installed
  anyway as a developer tool.
- Protocol types come straight from the shared package. There is no codegen step.
- The controller is tied to Bun-specific APIs (`bun:sqlite`, `Bun.spawn`).
  Porting to Node would take real work.
- `bun build --compile` produces a binary for one platform. The Docker
  stage compiles on the image's own platform, so the binary always matches
  the image; cross-building would need an explicit `--target`.
- PTY support depends on Bun's terminal support, not on a native addon such
  as `node-pty`, which avoids compiling native modules in the image.

## Alternatives considered

- **Node + Fastify + node-pty.** Well proven, but it needs a native addon
  build, a Node runtime in the final stage, and a bundler for single-file distribution.
- **Go.** Excellent for a daemon and a static binary, but it cannot share
  TypeScript types and zod schemas with the app, which duplicates the contract.
- **Rust (axum).** Same contract-duplication issue and a slower iteration loop for the MVP.
- **Reusing an existing tool** (ttyd plus websockify plus a job runner). Too
  many separately authenticated services. The blueprint requires a single
  network-facing service.

## Implementation notes (2026-09-23)

Not a change of decision; recorded so the ADR matches the shipped code.

- The CLI gained `api <METHOD> <PATH> [JSON|-]`, the in-sandbox agent's only
  way to call the REST API (the token is read by the binary and never printed),
  and `status --json` redacts the VNC password.
- Child processes run in their own session; leftovers of a finished leader's
  group or session are found through `/proc` and stopped.
- The `/ui` pages are Bun HTML routes; their bundled chunks are served at root
  paths and do not include zod (the message names come from
  `@tesseract/protocol/bridge`).
