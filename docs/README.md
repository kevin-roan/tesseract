# TheOne documentation

Start with the [architecture overview](architecture/overview.md) for the big
picture, or [getting started](runbooks/getting-started.md) to run it. The
[blueprint](architecture/00-blueprint.md) is the contract that every other
note builds on.

## Architecture

| Note | What it covers |
|---|---|
| [00-blueprint.md](architecture/00-blueprint.md) | **The contract**: names, ports, paths, env vars, API, types, recipes, WebView bridge, process-group rules, image stages, compose modes, tests. Change it together with the code |
| [overview.md](architecture/overview.md) | components, data flows (pairing, status, terminal, VNC, build, Claude run), trust boundaries |
| [monorepo.md](architecture/monorepo.md) | bun workspaces, the hoisted linker, TypeScript-source packages, scripts, adding packages and deps, Expo/Metro notes |
| [controller.md](architecture/controller.md) | controller modules, lifecycle, persistence, logs, process groups, build queue and recipes, PTY, VNC bridge, runtime mirror, CLI (incl. `api`), untrusted project content |
| [protocol.md](architecture/protocol.md) | REST and WebSocket reference with examples, auth, close codes, WebView bridge, in-sandbox API use, limits, versioning |
| [sandbox-image.md](architecture/sandbox-image.md) | Dockerfile stages, build args, users, volumes, entrypoint, supervisord programs, extending |
| [networking-tailscale.md](architecture/networking-tailscale.md) | userspace sidecar, serve config, MagicDNS/HTTPS, ACLs, host-tailscale and local modes, what is never exposed |
| [display-vnc.md](architecture/display-vnc.md) | Xvnc + openbox, noVNC through the controller bridge, native VNC clients, screenshots, geometry, phone UX |
| [app-runs-and-emulator.md](architecture/app-runs-and-emulator.md) | run targets (web, Expo, React Native, Flutter, Electron, tests), app runs and viewers, the host Android emulator, its sandbox adb link and screen stream |
| [electron-windows-wine.md](architecture/electron-windows-wine.md) | how Windows builds work on Linux, builder vs forge, targets, signing, wine smoke tests, limits |
| [mobile-app.md](architecture/mobile-app.md) | the sandbox feature module, stores, react-query + events socket, reconnect and re-pair, screens (incl. add project), WebView pages, web build, dev builds |
| [security-model.md](architecture/security-model.md) | threat model, controls, dind risk, Claude `bypassPermissions`, secrets, prompt injection, token blast radius, same-user limit, audit results |

## Decisions (ADRs)

| ADR | Decision |
|---|---|
| [0001](adr/0001-monorepo-bun-workspaces.md) | Monorepo with bun workspaces and the hoisted linker |
| [0002](adr/0002-controller-bun-hono.md) | Controller on Bun + Hono, compiled to one binary |
| [0003](adr/0003-single-sandbox-container-with-tailscale-sidecar.md) | One sandbox container with a userspace Tailscale sidecar |
| [0004](adr/0004-tigervnc-novnc-via-controller-bridge.md) | TigerVNC + noVNC through a controller WebSocket bridge |
| [0005](adr/0005-wine-for-windows-electron-builds.md) | wine for Windows Electron builds |
| [0006](adr/0006-optional-docker-in-docker.md) | Docker-in-Docker only as an opt-in sidecar |
| [0007](adr/0007-auth-bearer-token-and-one-time-tickets.md) | Bearer token plus one-time tickets |
| [0008](adr/0008-mobile-server-state-react-query-and-events.md) | Mobile server state via react-query and an events socket |
| [0009](adr/0009-supervisord-process-supervision.md) | supervisord for in-container process supervision |

New ADRs: copy the structure (Status, Date, Context, Decision, Consequences,
Alternatives considered), use the next number, and never rewrite an accepted
ADR. Supersede it with a new one instead.

## Runbooks

| Runbook | Use it to |
|---|---|
| [getting-started.md](runbooks/getting-started.md) | set up Tailscale, configure `.env`, build and start the sandbox, run the app |
| [pairing-mobile.md](runbooks/pairing-mobile.md) | pair a phone (QR, deep link, manual), manage several sandboxes, re-pair |
| [electron-builds.md](runbooks/electron-builds.md) | build Linux and Windows Electron apps, run them on the display, sign them |
| [android-builds.md](runbooks/android-builds.md) | build APKs/AABs, release signing, EAS, memory tuning |
| [claude-in-sandbox.md](runbooks/claude-in-sandbox.md) | log Claude in, permission modes, SPEC as CLAUDE.md, headless runs from the phone |
| [operations.md](runbooks/operations.md) | run several stacks, upgrade the image, back up and restore volumes, rotate the token, reset the wine prefix, resource limits, logs |
| [e2e-testing.md](runbooks/e2e-testing.md) | run the unit, infra (bats) and end-to-end suites; what they cover; what to do when they fail |
| [troubleshooting.md](runbooks/troubleshooting.md) | symptom → cause → fix |

## Other

- [../SPEC.md](../SPEC.md): operating spec for Claude inside the sandbox ([v1 archive](archive/SPEC.v1.md))
- [roadmap.md](roadmap.md): open decisions and what comes after the MVP
- [../infra/e2e/README.md](../infra/e2e/README.md), [../infra/tests/README.md](../infra/tests/README.md): test suite internals
- [../CODING.md](../CODING.md): coding rules for this repository
