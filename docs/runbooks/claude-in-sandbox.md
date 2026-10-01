# Claude Code in the sandbox

Claude Code is installed in the image's final stage (`claude`, npm package
`@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`, default `latest`; auto-update
is disabled with `DISABLE_AUTOUPDATER=1`, so versions change with image
rebuilds and bumping the version rebuilds only that layer). It runs as `dev`, inside the sandbox
only. The rules it follows are in [SPEC.md](../../SPEC.md).

## 1. Log in (on the host)

The sandbox uses the host's Claude Code login: the host's `~/.claude/` is
bind-mounted into the sandbox at `/home/dev/.claude/`. Log in once on the
host (`claude`, then `/login`); the sandbox sees the same credentials,
settings and CLAUDE.md, and a token refreshed on either side is shared. There
is no token to paste into the app or save through the controller.

If `claude` in the sandbox still asks to log in, the host is not logged in
or the mount is missing: check `ls -la ~/.claude/.credentials.json` inside
`bun run sandbox shell`, and log in on the host.

This host Claude Max login is the only supported authentication: the stack
passes no API key or long-lived token (`ANTHROPIC_API_KEY`,
`CLAUDE_CODE_OAUTH_TOKEN`) into the sandbox. `theone-doctor` reports the
result as `claude-auth` (PASS when `~/.claude/.credentials.json` holds a
`claudeAiOauth` login).

Check with `claude --version` and `claude -p "say ok"`.

## 2. SPEC.md as the managed CLAUDE.md

- The image build writes the repository's `SPEC.md` (followed by
  `rootfs/etc/claude-code/CLAUDE.md`) to `/etc/claude-code/CLAUDE.md`, Claude
  Code's managed memory file. Nothing is written into `~/.claude`, which is the
  host's own folder.
- Claude loads it in every session (interactive and headless), together with
  the host's `~/.claude/CLAUDE.md` and the project's own `CLAUDE.md`/`AGENTS.md`.
- A SPEC change needs an image rebuild (`bun run sandbox up --build`).

## 3. Permission mode

| Where | Mode | Why |
|---|---|---|
| Headless runs (`POST /v1/agent/runs`) | `THEONE_CLAUDE_PERMISSION_MODE`, default `bypassPermissions` | nobody can answer tool prompts in a background run; the container is the boundary |
| Claude terminal (`kind: "claude"`) | Claude's own default (asks before tools), unless you pass flags or change settings | you are watching and can approve |

To make headless runs stricter, give the controller a different mode, e.g.
`THEONE_CLAUDE_PERMISSION_MODE=acceptEdits` (edits allowed; shell commands
need approval, which nobody can give in a headless run, so they are denied).
Set it in `infra/compose/.env` (compose passes it to the sandbox) and run
`bun run sandbox up`; the controller reads it at start. Alternatively, keep
`bypassPermissions` and deny specific tools in
`/home/dev/.claude/settings.json`:

```json
{
  "permissions": {
    "deny": ["Bash(git push:*)", "Bash(docker:*)", "Bash(curl:*)", "Read(/home/dev/.secrets/**)"]
  }
}
```

The sandbox runs as a non-root user, which `bypassPermissions` requires.
Note that `dev` has passwordless `sudo` inside the container (image build arg
`ENABLE_SUDO=true`). Build with `--build-arg ENABLE_SUDO=false` if you want
Claude and project code unable to become container root. Container root is
still confined by the dropped capabilities and has no host access.
Background: [security-model.md](../architecture/security-model.md#claude-with-bypasspermissions-a3-a4).

## 4. Headless runs from the phone

1. Agents tab → **Claude runs → New run** (or the **Claude** quick action,
   or **Ask Claude to work on this project** on a project screen). Write the
   prompt; the project is optional.
2. The app calls `POST /v1/agent/runs { projectId, prompt }`. The controller
   starts `claude -p` with streaming JSON output in
   `/workspace/projects/<projectId>` (or `/workspace`); the prompt goes in on
   stdin.
3. The run screen (`sandbox/agent/[id]`) streams condensed events: text,
   tool use (`Bash: npm test`), tool results, system messages. Status events
   that Claude emits (`[BUILD] …`) appear in the activity feed.
4. When it finishes you see the result, the tokens used and the session id.
   **Continue** starts a new run with `resumeSessionId`, which is the same conversation.
5. **Cancel** sends `DELETE /v1/agent/runs/:id` and stops the process.

When a run ends, anything it left running in the background (`npm run dev &`)
is stopped and listed as a `system` event. Servers that should keep running
must be started as controller processes (`theone-controller api POST
/v1/processes …`), which SPEC tells Claude to do. Without credentials a run
fails within about a second with "Not logged in · Please run /login".

The same API from a shell, e.g. from a laptop on the tailnet:

```bash
BASE=https://theone-sandbox.tail1234.ts.net; TOKEN=…   # from `bun run sandbox pair`
curl -fsS -X POST "$BASE/v1/agent/runs" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"electron-hello","prompt":"Build the Windows installer and smoke-test it under wine"}'
```

What a good headless run looks like (per SPEC): reads `.agent/` memory,
emits `started`, starts long work as controller builds or processes (through
`theone-controller api`, never `curl` with the token), verifies,
updates `CURRENT_TASK.md`, emits `done`, and ends with the final report.
If it needs confirmation (for example deleting data), it ends with `blocked`
and a question. Answer by continuing the run.

## 5. Interactive Claude terminal

- A Claude terminal is a PTY running `claude` in the project directory. It
  survives phone disconnects. Re-open it from **Sessions** on the Agents tab
  to re-attach, and the scrollback is replayed.
- Use it for exploratory work and for approving tools yourself.
- Closing the terminal (`DELETE /v1/terminals/:id`) ends the Claude process
  and anything it left in the background. Use `claude --resume` in a new
  terminal to continue the conversation. Terminals of an earlier controller
  lifetime are not listed; their PTYs ended with the controller.

## 6. Memory the phone can read

Claude maintains `/workspace/.agent/`. The app shows its Markdown files
(`GLOBAL_CONTEXT.md`, `CURRENT_TASK.md`, `SESSION_LOG.md`, `RUNTIME.md`, …,
plus `projects/<id>/*.md`) via `GET /v1/context`. If Claude seems confused about the state of a
project, read these first. You can edit them from a terminal. The layout is in
[SPEC §3](../../SPEC.md#3-persistent-memory).

## 7. Usage and limits

- Token `usage` is reported per headless run (from Claude's result message); `/v1/usage` sums tokens from the transcripts.
- Long runs keep going when the phone disconnects. Cancel runs you no longer need.
- The model and other defaults come from `/home/dev/.claude/settings.json` (for example `"model"`), or `/model` in an interactive session.
