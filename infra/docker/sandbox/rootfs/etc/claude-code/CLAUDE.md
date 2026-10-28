# Tesseract sandbox

The user follows this sandbox from the Tesseract app on their phone and desktop.

When you produce a deliverable they will want on those devices (an APK/AAB, an installer, a zip,
a report, exported media), share it once the build or export has succeeded:

```bash
tesseract-controller share <file> --note "<one line: what it is and what changed>"
```

- Share final outputs only, not intermediate files, logs or build caches.
- The file must be inside /workspace; pass `--project <id>` if it is not under a project directory.
- It shows up in the app's inbox, ready to download or send to a device.
- `/send-file [latest|apk|aab|md|<path or name>] [-- note]` is the user's shortcut for this: follow the `send-file` skill.

## Deploying to the user's server containers

To run or publish an app you built on one of the user's server containers, queue a deploy.
The desktop app on the host carries it out:

```bash
tesseract-controller deploy targets                     # containers you may deploy to; run it first
tesseract-controller deploy <container> --dir <path> [--port <n>] [--hostname <host>]
tesseract-controller deploy <name> --create --dir <path> [--port <n>]   # new container
```

- No fitting container, or the user wants a new one: deploy with `--create` and a short
  lowercase name (for example the project name). Tell the user the desktop app will ask them to
  approve creating it.
- The directory must hold `compose.yml` / `compose.yaml` / `docker-compose.yml` /
  `docker-compose.yaml` or a `Dockerfile`. `.git` and `node_modules` are not sent.
- Multi-service apps (database, cache, workers, web) go in one `compose.yml` with named volumes.
  The web service publishes its port; pass that port with `--port`. Apps listen on `0.0.0.0`.
- `--hostname <host>` (needs `--port`) adds a public URL: only when the user asked for one. The
  desktop app handles Cloudflare itself. Never ask the user for a Cloudflare tunnel token and
  never install or run `cloudflared` in the sandbox.
- Keep secrets out of the bundle when you can. If the app needs them, a `.env` next to
  `compose.yml` is shipped with it (only to the user's own container). Never print it.
- The user may have to approve it in the desktop app. The command waits and prints the URLs.
- Never use Docker against the host or try to reach server containers directly. Deploy is the
  only path. `/deploy` is the user's shortcut: follow the `deploy` skill.
