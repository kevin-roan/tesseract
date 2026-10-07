---
name: send-file
description: Send a file from this chat to the TheOne app's Files (inbox) with theone-controller share. Use when the user runs /send-file or asks to send, share or push a build, APK/AAB, installer or Markdown file to their phone or desktop.
argument-hint: "[latest | apk | aab | android | windows | linux | build | md | <path or name>] [-- note]"
---

# /send-file

Share a file with the user's TheOne app. Arguments: `$ARGUMENTS`

`theone-controller share` copies the file to `/workspace/artifacts/`, links it to this chat
(it sends `THEONE_AGENT_RUN_ID` / `CLAUDE_CODE_SESSION_ID` itself) and adds it to the app's
Files and inbox.

## 1. Pick the file

Read the arguments (text after `--` is the note):

- **Empty or `latest`**: the deliverable this chat produced or talked about last (a build
  output, report or Markdown file you wrote). If the chat has none, use the newest
  `build` result from the finder below.
- **`apk`, `aab`, `android`, `windows`, `linux`, `build`, `md`**: the newest file of that kind
  in the current project.
- **A path** (absolute or relative to the current directory): that file.
- **A name or glob** (`README.md`, `*.pdf`, `release notes`): find it in the project; for a
  plain phrase, match it against Markdown file names.

Finder (newest first, skips `node_modules`, `.git` and intermediate build dirs):

```bash
"${CLAUDE_SKILL_DIR}/find-files" <kind|name|glob> [dir] [limit]
```

Rules:

- Several files fit equally well (e.g. a debug and a release APK of the same age, or a
  phrase that matches two documents): send the obvious one if the chat makes it clear,
  otherwise list them with dates and sizes and ask which one. Do not send them all.
- A build output older than the project's last source change may be stale: say so in your
  reply (and in the note), but send it if the user asked for it.
- Files already in `/workspace/artifacts/` (controller builds) are already in the app's Files;
  the share command refuses them. Tell the user the name instead of copying it elsewhere.
- Never send secrets or anything that holds them: `.env*`, keystores (`*.jks`, `*.keystore`),
  certificates and keys (`*.p12`, `*.pfx`, `*.pem`, `*.key`), `/home/dev/.secrets/`,
  `.credentials.json`, `/workspace/.agent/controller/`. Refuse and say why.
- Only files inside `/workspace` can be shared. For a file elsewhere (e.g. `/tmp`), copy it
  into the project first only if it is a real deliverable, and say where you put it.

## 2. Share it

```bash
theone-controller share "<file>" --note "<one line: what it is and what changed>"
```

- Write the note yourself when the user gave none: what the file is plus the version, build
  profile or the change it carries (≤ 500 characters, one line, no secrets).
- Add `--project <id>` only when the file is not under `/workspace/projects/<id>/`.
- Add `--name <name>` when the file name says nothing (`app-release.apk` →
  `<project>-android-release-<version>.apk`, version from `app.json`/`package.json`/Gradle
  when it is easy to find).
- Exit code 1 prints the reason: a confidential project (sharing is disabled), a file under
  `/workspace/artifacts/`, or the controller being down (`curl -fsS
  http://127.0.0.1:7700/v1/health`). Report it; do not work around a confidential project.

## 3. Report

One short block: the shared name, size and project from the command's output
(`shared <name> (<size>, <project>) as <id>`), the note, and anything stale or unverified.
