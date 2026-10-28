---
name: deploy
description: Deploy an app from this sandbox to one of the user's Tesseract server containers, or to a new one, with tesseract-controller deploy. Use when the user runs /deploy or asks to deploy, publish, host or put online an app, API or site this chat built.
argument-hint: "[<container>] [<dir>] [--create] [--port <n>] [--hostname <host>] [--app <name>]"
---

# /deploy

Deploy an app to a server container. Arguments: `$ARGUMENTS`

The sandbox has no Docker access to the host and cannot reach server containers. Do not try:
no `docker` against the host, no `DOCKER_HOST` tricks, no SSH or HTTP to `tesseract-ct-*`.
`tesseract-controller deploy` queues the request on the controller, which archives the
directory itself. The user's desktop app then copies it into the container and runs it there
with the container's own Docker.

## 1. Pick the target

Always list the targets first:

```bash
tesseract-controller deploy targets
```

- No host: the desktop app is not running or not connected. Tell the user. Do not work around it.
- Use the container the user named. If there is none and only one target fits, use it.
  Otherwise list the targets and ask which one.
- No fitting container, no targets at all, or the user asks for a new one: deploy with
  `--create <name>`. Pick a short lowercase name (letters, digits, `-`; for example the project
  name). Tell the user the desktop app will ask them to approve creating it. Creating always
  needs their approval, even when auto-approve is on.
- A target with auto-approve off needs the user to approve each deploy in the desktop app.
  Say so before you start.

## 2. Check the directory

Default: the project root of this chat, or the directory the user named.

- It must hold `compose.yml`, `compose.yaml`, `docker-compose.yml`, `docker-compose.yaml` or
  a `Dockerfile`. If there is none, write a minimal one only when the user asked you to deploy
  this app, and say that you did.
- Multi-service apps go in one `compose.yml`: database, cache, workers and web as separate
  services, with named volumes for their data (`volumes: { db-data: {} }`), not bind mounts to
  sandbox paths. Only the web service publishes a port (`ports: ["3000:3000"]`); pass that
  port with `--port`.
- The app must listen on `0.0.0.0`, not `localhost`. Dockerfile: `EXPOSE` the port and pass
  `--port`.
- Everything except `.git` and `node_modules` is sent (512 MiB limit). Keep build outputs and
  large data out.
- Secrets: keep them out of the bundle when you can (`/home/dev/.secrets/`, keystores never go
  in). If the app needs them, put them in a `.env` next to `compose.yml`; it is shipped with the
  bundle, which only goes to the user's own container. Never print its contents. Ask first if
  the directory holds other secrets.
- If you can, run the app or build in the sandbox first.

## 3. Deploy

```bash
tesseract-controller deploy <container> --dir <path> [--port <n>] [--app <name>] [--hostname <host>]
tesseract-controller deploy <name> --create [--cpus <n>] [--memory <MB>] --dir <path> [--port <n>]
```

- `--app`: defaults to the directory name. Deploying the same app again replaces it.
- `--create`: the host creates the container if it does not exist yet, after the user approves.
  `--cpus` and `--memory` (MB) set its limits; leave them out unless the user asked.
- `--hostname <host>` (needs `--port`) adds a public URL on the user's domain. Use it only when
  the user asked for a public URL. The desktop app sets up Cloudflare with its own connection:
  never ask the user for a Cloudflare tunnel token, and never install or run `cloudflared` in
  the sandbox.
- The command waits until the deploy finishes (approval included) and exits 0 only when it is
  `deployed`. Use `--no-wait` only if the user does not want to wait. Check later with
  `tesseract-controller deploy status <id>`, list with `deploy ls`, stop with `deploy cancel <id>`.

On failure, read the error and the log in the output:

- `no server container named …`: deploy again with `--create` if the user wants a new container.
- `rejected`: the user said no, or nobody approved it within 30 minutes. Do not retry unless
  the user asks.
- Compose or build errors: fix the compose file or Dockerfile and deploy again.
- Route conflict: the hostname is already in use. Ask the user for another one.
- sha256 or size mismatch: deploy once more. If it repeats, report it.

## 4. Report

One short block: container (and whether it was created), app, status, the URLs from the output
(tailnet `http://…:<port>` and `https://<hostname>`), and what you did not verify (for example,
that the URL answers).
