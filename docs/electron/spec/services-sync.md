# Spec: sync-back service, `tesseract` sync CLI, and composer attachments

Sources surveyed (read-only): `apps/desktop/tesseract_desktop/sync.py`,
`services/syncback.py`, `syncback/*.py`, `attachments/*.py`, `strings.py`
(`SYNC_BACK`, `ATTACHMENTS`), `app.py` (CLI options), `api/client.py` and
`api/paths.py` (sync and upload endpoints), `theme/extras/agents.py` and
`theme/extras/sidebar.py` (attachment CSS), and `docs/architecture/sync-back.md`
(the contract, which wins on any disagreement).

Scope: everything the Electron **main process** and the standalone
**`tesseract` CLI** (bun `--compile`) must reimplement in TypeScript to replace
the Python host side of sync-back. It also covers the attachment model and chip
UI used by the composers. The Projects page UI (Sync tab, review sheet, action
buttons) is specified in the projects spec. Here it shows up only as a consumer
of the service API (§9).

Proposed module layout (an advisory, not a contract):

```
apps/electron/src/main/sync/           # pure Node, shared by main process and CLI
  constants.ts   state-dir names, limits, KEEP_SNAPSHOTS, ...
  labels.ts      every user-facing string below, verbatim
  errors.ts      SyncBackError, NotLinked, SyncConflict
  manifest.ts    hashPath, DigestCache, buildManifest, checkRelative, resolveInside
  tree.ts        collectFiles, contained, gitManifest, scanTree
  fsutil.ts      writeAtomic, install, copyForSnapshot, modes, makeParents, pruneEmptyParents
  state.ts       SyncState (links.json, snapshots, locks)
  pull.ts        pull, takeSnapshot, rollback, extractExport
  revert.ts      revert, restoreBaseline
  get.ts         planChanges, hostChanges, planGit, get, writeGetArchive
  requests.ts    claimable, handleRequest
  summary.ts     plural, breakdown, describe*
  diff.ts        readHostFile, extractMember, diffFile
  push.ts        runSync (the --sync push)
  cli.ts         runPull, runRevert, runStatus, runGetOnHost, runSync wiring
apps/electron/src/main/services/syncback-service.ts   heartbeat/poll/claim/queue/notify
apps/electron/src/renderer/features/attachments/       model + hooks + chip/tray components
```

---

## 1. Concepts

- **Push** (`tesseract --sync`, run on the host in a checkout): the CLI tars the
  checkout, sends it to `POST /v1/projects/:id/sync`, and records a **link** in
  `links.json` (project id ↔ absolute host path, plus the host manifest at push
  time).
- **Pull / sync back** (sandbox → host): copies files changed in the sandbox
  since the baseline into the linked checkout. It takes a snapshot first,
  refuses to overwrite unexpected host edits unless forced, and can be reverted.
- **Revert**: undoes the newest unreverted pull from its snapshot, and puts the
  sandbox baseline back so the reverted changes are offered again.
- **Get** (host → sandbox): requested from inside the sandbox
  (`tesseract --get`) or from the desktop. The host companion claims the request
  and uploads the host files changed since the last push or get.
- **Discard**: purely controller-side (`POST sync/discard`). The host only
  calls it. See the contract §7.
- Only the desktop companion writes to the host. Mobile and the sandbox CLI
  queue **sync requests**, and the companion claims and applies them.

---

## 2. Host state (files the Electron app must read and write)

### 2.1 State directory

Python: `state_dir() = ($XDG_STATE_HOME || ~/.local/state) + "/tesseract"`.

| Name | Value |
|---|---|
| `STATE_DIR_NAME` | `tesseract` |
| `LINKS_FILE` | `links.json` |
| `SNAPSHOTS_DIR` | `snapshots` |
| `SNAPSHOT_FILE` | `snapshot.json` |
| `FILES_DIR` | `files` |
| `DISPLACED_DIR` | `displaced` |
| `LOCKS_DIR` | `locks` |
| `KEEP_SNAPSHOTS` | `20` |
| `REDACTED` | `REDACTED` |

Electron:
- On Linux, use **exactly** the same path, so links that the Python app or CLI
  already created keep working.
- On macOS and Windows there is no XDG convention. Use
  `$XDG_STATE_HOME/tesseract` if the variable is set. Otherwise use
  `~/.local/state/tesseract` on macOS (it matches Python and keeps the CLI and
  the app in agreement) and `%LOCALAPPDATA%\Tesseract\state` on Windows.
- The CLI and the app **must** resolve the same directory. Put the resolver in
  one shared module, and allow a `TESSERACT_STATE_DIR` override for tests.
- Directories are created with mode `0o700`. `links.json` and `snapshot.json`
  are written with mode `0o600`.

### 2.2 `links.json`

Top-level object keyed by project id. Each value:

```jsonc
{
  "hostPath": "/abs/path/to/checkout",   // required string, else the entry is ignored
  "pushedAt": "2026-10-01T11:40:02.123Z",// string ("" if missing)
  "manifest": { "src/a.ts": "<sha256 hex>" },   // non-string keys/values dropped
  "executable": ["run.sh"],              // OPTIONAL; omitted = unknown (old links). Sorted.
  "gitManifest": { "HEAD": "41:1727779202123456789" }, // OPTIONAL
  "gotAt": "2026-10-01T14:03:12.000Z",   // OPTIONAL, set after an applied get
  "confidential": true                   // OPTIONAL; written only when true; read as `=== true`
}
```

- Serialization: `JSON.stringify(data, null, 2) + "\n"`, UTF-8, written
  atomically (§2.5) with mode `0o600`.
- An unreadable or invalid file reads as `{}`. Entries that are not objects, or
  that have no string `hostPath`, are skipped.
- `link_for_path(root)` compares strings exactly against the **resolved**
  absolute path (`realpath`). There is no case folding. On Windows, normalise
  the drive-letter case before comparing (Python never ran there).
- `shared_path` is `REDACTED` when the link is confidential, otherwise
  `hostPath`.
- `redact(text)`: when confidential, replace every occurrence of `hostPath`
  and then of `basename(hostPath)` with `REDACTED`. Otherwise return the text
  unchanged.
- Mutations always take the `.links` lock and then re-read the file:
  - `save_link(link, replaces?)` deletes `replaces` (if given) and sets
    `data[id] = link`.
  - `update_manifest(id, changes: {path: sha|null}, executable?: {path: bool})`
    sets or deletes manifest entries. A `null` also removes the path from the
    executable set. When `executable` has the path, it adds or removes the bit.
    `executable` is written (sorted) **only if the link already had an
    `executable` list**.
  - `record_get(id, manifest, executable, gitManifest, gotAt)` replaces those
    four fields and keeps `hostPath`, `pushedAt` and `confidential`.

### 2.3 Snapshots

Path: `snapshots/<projectId>/<snapshotId>/`.

- `snapshot.json`:
  ```jsonc
  { "id": "20261001-140312", "projectId": "web", "hostPath": "/abs/checkout",
    "createdAt": "2026-10-01T12:03:12.345Z", "kind": "pull", "reverted": false,
    "entries": [ { "path": "src/a.ts", "before": "file" | "absent",
                   "after_sha256": "<hex>" | null,      // null = the pull deleted it
                   "manifest_before": "<hex>" | null } ] }  // omitted on old snapshots
  ```
  The keys are snake_case inside `entries` and camelCase at the top. Keep this
  mix exactly, because existing files are read back.
- `files/<path>`: copies of every host file that the pull overwrote or
  deleted. Copy contents, permissions and mtime (`shutil.copystat`), and fsync.
  Symlinks are copied as symlinks.
- `displaced/<path>`: host edits that `revert --force` overwrote.
- **Snapshot id**: local time formatted `YYYYMMDD-HHMMSS`
  (`strftime("%Y%m%d-%H%M%S")` on `astimezone()`). If that directory exists,
  try `-2`, `-3`, and so on. Each candidate is created with
  `mkdir(mode 0o700)` and no recursion, so the create itself detects a
  collision. `createdAt` is UTC ISO with milliseconds and `Z` (see `iso()`
  below).
- **baseline_known**: on read, it is true iff the `manifest_before` key is
  present. On write, `manifest_before` is omitted when `baseline_known` is
  false.
- `snapshots(projectId)`: read every subdirectory's `snapshot.json`, skip the
  ones that fail to parse, and sort **newest first** by `(createdAt, id)`
  descending.
- `save_snapshot`: atomic write with mode `0o600`, then fsync the directory.
- `discard_snapshot`: `rm -rf` the directory, ignoring errors.
- `prune(projectId, keep=20)`: discard every snapshot after the first 20
  (newest first). It runs only after a successful pull.

`iso(d)`: `d.toISOString()` already gives millisecond precision and `Z`, so it
matches Python's `isoformat(timespec="milliseconds")` with `+00:00` replaced by
`Z`.

### 2.4 Locks

Python takes `fcntl.flock(LOCK_EX)` on `locks/<name>.lock`, with:
- `name = ".links"` for every `links.json` read-modify-write.
- `name = <projectId>` for every pull, revert and get, held across the whole
  operation.

The lock is blocking and per file, and it serializes the CLI against the app.

Do **not** copy: Node has no `flock`. Use an advisory lock that works across
processes and platforms, for example an `O_EXCL` lock file containing
`{pid, startedAt}` with stale detection, or `proper-lockfile`. The TS app and
the TS CLI must use the same scheme. Mixing the old Python CLI with the new app
is unsupported, because their lock schemes do not interoperate. Keep the same
file names under `locks/`.

### 2.5 Atomic file primitives (`fsutil.py`)

- `TMP_PREFIX = ".tesseract-sync-"`. Temp files are always created **beside the
  target** (same directory), so the rename is atomic.
- `write_atomic(target, bytes, mode=0o644)`: mkstemp in the target directory,
  write, `fchmod(mode)`, flush, `fsync`, `rename` over the target. On any
  error, unlink the temp file and rethrow.
- `install(source, target, mode?)`: put a copy of `source` (a regular file or
  a symlink) at `target` atomically.
  - Symlink: create a symlink with the same link text at a temp name beside the
    target, then rename it over the target.
  - Regular file: stream copy, `fchmod(mode ?? sourceMode & 0o7777)`, fsync,
    rename.
  - Clean up the temp file on any failure.
- `copy_for_snapshot(source, target)`: `mkdir -p` the parent. A symlink is
  copied as a symlink with the same text. A regular file is stream copied,
  fsynced, and then gets `copystat` (mode, atime and mtime).
- `file_mode(p)`: the permission bits if `p` is a regular file (lstat), else
  `null`.
- `is_executable(p)`: `p` is a regular file (lstat) and `mode & 0o111` is
  non-zero.
- `with_executable(mode, exec)`: if `!exec`, return `mode & ~0o111`. If `exec`
  and the mode already has any `0o111` bit, return `mode`. Otherwise return
  `mode | ((mode & 0o444) >> 2)` (git-style 644 → 755).
- `make_parents(root, target, created[])`: walk up from `target`'s parent until
  reaching `root` or an existing path (`lexists`). Create the missing
  directories top-down, without `-p`, and push each one onto `created`.
- `prune_empty_parents(root, target)`: from the parent upward, while the
  directory is not `root` and is inside it, `rmdir`. Stop at the first failure
  (for example, the directory is not empty).
- `fsync_dir(dir)`: best effort, and every error is ignored. On Windows,
  directory fsync is not possible. Skip it.

Windows notes:
- Symlink creation needs Developer Mode or admin rights. On `EPERM`, treat a
  symlink entry as a `SyncBackError` that names the path.
- Executable bits do not exist. `is_executable` returns `false`, and the bit
  handling becomes a no-op. Never send `executable: true` from Windows for a
  file whose bit the host cannot know. In practice, the sandbox's bit should be
  kept: on Windows, omit `executable` in acks, and the controller then uses the
  sandbox file's current bit (contract §1).
- `rename` over an open file can fail with `EPERM` or `EBUSY`. Retry 3× with
  50 ms, 100 ms and 200 ms backoff before failing. This is an Electron
  addition.

---

## 3. Manifests and the host file set

### 3.1 Hashing (`manifest.py`)

- `GIT_DIR = ".git"`.
- `SKIPPED_DIRS = [".git", "node_modules"]`. These are skipped only as the
  **first** path segment, plus any path that contains a `.git` segment.
- `CHUNK = 1 MiB`.
- `hash_path(p)`, using lstat:
  - Missing: `null`.
  - Symlink: `sha256(utf8/fs bytes of readlink(p))`.
  - Regular file: streamed `sha256` of the content.
  - Anything else: `null`.
  - The result is lowercase hex.
- `DigestCache`: memoizes `hash_path` per absolute path. The key is lstat
  `(mode, size, mtimeNs, ctimeNs, ino)`. In Node, use
  `fs.lstat(p, {bigint: true})` for `mtimeNs`, `ctimeNs` and `ino`. A missing
  file evicts its entry and returns `null`. The service keeps **one cache per
  linked project** for its whole lifetime. The Projects page keeps its own
  cache.
- `build_manifest(root, files, hasher)`: for each POSIX relative path, skip it
  if it is a git path or its first segment is in `SKIPPED_DIRS`. Then
  `digest = hasher(root/rel)` and keep the entry if the digest is not null.

### 3.2 Path safety (critical: port exactly)

`check_relative(rel)` throws `SyncBackError` with these exact messages:

| Condition | Message |
|---|---|
| not a string, empty, contains `\0` or `\` | `` Refusing unsafe path ${repr(rel)} `` |
| starts with `/` or is absolute | `` Refusing absolute path ${repr(rel)} `` |
| any segment is `""`, `.` or `..` | `` Refusing path ${repr(rel)}: it must be a plain relative path `` |
| any segment is `.git` | `` Refusing to write inside .git: ${repr(rel)} `` |

`repr` is Python's: single-quoted, for example `'a/../b'`. Emulate it with
`'${rel}'`. Exact escaping does not matter.

`resolve_inside(root, rel)` runs `check_relative`, resolves `root` with
`realpath`, and resolves the target's **parent** with `realpath`. If that
parent is neither the root nor inside it, it throws
`` Refusing path ${repr(rel)}: it leaves ${root} ``. It returns `root/rel`, a
non-resolved leaf, so a symlink leaf is replaced and never followed.

Node: `fs.realpathSync` throws when the parent does not exist, but Python's
`resolve()` is non-strict. Implement a non-strict resolve: realpath the longest
existing ancestor, then append the remaining segments.

On Windows, use `path.posix` for `rel` validation and `path.win32` for the
joins. Additionally reject `:`, reserved device names, and trailing dots or
spaces (an Electron addition).

### 3.3 `collect_files(root)` (`tree.py`)

1. Run `git -C <root> ls-files -z --cached --others --exclude-standard`, with
   stdout and stderr captured and `check=True`. Decode it as UTF-8. Python uses
   `surrogateescape`, so in Node read it as a Buffer and decode with `latin1`
   if the UTF-8 decode is lossy, or keep paths as Buffers.
2. If git fails or is missing, run `os.walk(root)`, which does not follow
   symlinked directories. It yields every file plus every directory entry that
   **is a symlink**. Paths are relative.
3. If git succeeds, yield `.git` first when `root/.git` exists. Then yield the
   NUL-split, de-duplicated (order-preserving) entries that `lexists`.

- `contained(root, files)`: convert each path to POSIX. Drop paths that fail
  `check_relative` (this also drops `.git` itself). Drop paths whose parent
  directory `realpath` is outside `root`. The result is cached per parent.
- `git_manifest(root)`:
  - Returns `null` unless `root/.git` is a real directory (lstat). A worktree
    `.git` **file** gives `null`.
  - Otherwise walk it. For each **regular** file not ending in `.lock`, record
    `"<relpath under .git>": "<st_size>:<st_mtime_ns>"`. Use a bigint
    `mtimeNs`, printed as a decimal integer.
- `scan_tree(root, files)` returns `HostTree`:
  - `manifest = build_manifest(root, contained(root, files))`
  - `executable = sorted(paths in manifest that are executable)`
  - `git = git_manifest(root)`

Sorting: Python sorts by code point. Use `(a, b) => (a < b ? -1 : a > b ? 1 : 0)`
on strings, never `localeCompare`. It differs from Python only for astral
characters, which is acceptable.

---

## 4. Push: `tesseract --sync [--confidential]` (`sync.py`)

`run_sync(cwd, confidential)`:

1. `root = realpath(cwd)`. `link = state.link_for_path(root)`.
2. If `link` exists, `confidential` was requested, and the link is not
   confidential, then `replaces = link.projectId` and `link = null`. The folder
   is re-linked under a pseudonym.
3. If there is still a link, `projectId = link.projectId` and
   `confidential = link.confidential`. An existing link always wins, including
   its confidential flag.
4. Otherwise, `projectId = confidential ? null : project_id_from_name(basename(root))`.
5. If there is no `projectId` and the push is not confidential, print to
   stderr `` tesseract: cannot derive a project id from '${root.name}' ``
   and exit **1**.
6. `connect()` (§4.2). On failure, exit 1.
7. If there is still no `projectId` (confidential), use
   `pseudonym([...state.links().keys, ...sandboxProjectIds(client)])`.
   `sandboxProjectIds` calls `GET /v1/projects` and maps it to ids. Any error
   gives `[]`.
8. Print to stdout, flushed:
   `` Syncing ${root} to ${projectId}${confidential ? " (confidential)" : ""} on ${label}… ``
   (the ellipsis is U+2026).
9. `files = collect_files(root)`. `tree = scan_tree(root, files)`.
10. Write a gzip tar into a temp file. Each path in `files` is added as
    `root/path` with `arcname = path`. Only the `.git` entry is added
    **recursively**. Everything else is added non-recursively: a directory
    symlink is stored as a symlink, and `os.walk` yields only files. `count` is
    the number of top-level entries added.
11. `POST /v1/projects/:id/sync[?confidential=1]` with body
    `application/gzip`, an explicit `Content-Length`, and a timeout of
    **600 s** (`SYNC_TIMEOUT_S`). The response is the project JSON. Status
    `201` means created, otherwise the project was updated.
12. On a controller or OS error, print to stderr
    `` tesseract: sync failed: ${error} `` and exit 1.
13. `state.save_link(Link(projectId, root, iso(now), tree.manifest, tree.executable, tree.git, confidential), replaces)`.
    `got_at` is reset (not carried over). On an `OSError`, print to stderr
    `` tesseract: pushed, but could not record the link for sync back: ${error} ``
    and continue.
14. Print to stdout:
    `` ${created ? "Created" : "Updated"} ${project.path} (${count} entries) · linked for sync back ``
15. If `replaces` is set, print to stderr:
    `` tesseract: the earlier copy ${replaces} is still in the sandbox under its real name and is no longer linked; remove it there with: rm -rf /workspace/projects/${replaces} ``
16. Exit 0.

Tar details to match Python's `tarfile` (the controller extracts it):
- Use POSIX/PAX format and gzip, and keep file modes.
- Store symlinks as symlinks, never followed.
- Do not include absolute paths.
- Use `tar-stream` and `zlib.createGzip()`. Do not use `node-tar`'s
  `portable` mode, because it drops modes.

### 4.1 `project_id_from_name(name)`

```
slug = name.trim().toLowerCase()
slug = slug.replace(/[^a-z0-9._-]+/g, "-")
slug = slug.replace(/-{2,}/g, "-")
slug = slug.replace(/^[._-]+/, "").slice(0, 64)
slug = slug.replace(/[._-]+$/, "")
return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(slug) ? slug : null
```

Python `.lower()` is Unicode-aware, but non-ASCII is replaced by `-` anyway,
so `toLowerCase()` is equivalent.

### 4.2 `connect()`

1. Try the saved connection config: the app's stored connection, or the env
   config (`initial_config()`). If there is none, run Docker discovery of the
   sandbox container (`discover_docker()`). A discovery error prints
   `` tesseract: no sandbox found: ${error} `` and returns `null`.
2. If the config is missing or invalid, print
   `tesseract: no sandbox to sync with; open the app and connect first` and
   return `null`.
3. Return `{client(apiUrl, token), label: config.name || apiUrl}`.

All of these go to stderr. The Electron CLI must read the same connection store
as the Electron app (see the connection and onboarding spec).

### 4.3 `pseudonym(taken)`

- Shuffle all `adjective-noun` pairs with a cryptographic RNG and pick the
  first pair not in `taken`.
- If every pair is taken, use `${pairs[0]}-${n}` with `n` counting up from 2.
- Copy the word lists verbatim from `apps/desktop/tesseract_desktop/pseudonym.py`
  (66 adjectives × 66 nouns). It is the same list that `packages/protocol`
  may already have. If so, reuse it.

---

## 5. Pull (sandbox → host) (`pull.py`)

`pull(client, state, projectId, paths?, force=false, dryRun=false) -> PullOutcome`

1. `require_link`:
   - No link: `NotLinked`, with message
     `` ${id} is not linked on this computer. Run tesseract --sync in the checkout first ``.
   - `hostPath` is not a directory: `` ${hostPath} no longer exists. Run tesseract --sync in the checkout again ``.
2. `root = realpath(hostPath)`. **Take the project lock** for the rest of the
   operation.
3. `data = GET /v1/projects/:id/sync/changes`. If `baselineAt == null`, fail
   with `` ${id} was never pushed. Run tesseract --sync in the checkout first ``.
4. `changes = data.changes`. If `paths` is given, keep only the changes whose
   path is in it.
5. `targets[path] = resolve_inside(root, path)` for every change. This throws
   on any unsafe path **before** any write.
6. For each change:
   - A kind outside `added|modified|deleted` fails with
     `` Unknown change kind ${repr(kind)} for ${path} ``.
   - Append the path to `outcome[kind]`.
   - Check for a conflict:
     `current = hash_path(target)`, and
     `conflict = current !== link.manifest[path] && current !== change.sha256`.
     A host file already equal to the incoming content is **not** a conflict.
     For an added file that is absent on the host, `null === null`, so it is
     not a conflict.
7. If there are no changes, or this is a dry run, return the outcome. A dry run
   reports the conflicts but writes nothing.
8. If there are conflicts and no `force`, throw `SyncConflict(conflicts)` with
   message `` ${n} file${n!==1?"s":""} changed on the host since the last push: ${first 5 joined ", "} ``.
9. `_apply`:
   - `incoming` = non-deleted paths. `deletes` = deleted paths.
   - If `incoming` is non-empty, call `POST sync/export {paths: incoming}`
     (600 s timeout). The response is a gzip tar. Extract it into a temp
     directory with prefix `tesseract-pull-` (§5.1).
   - `written[path] = hash_path(staged)` for incoming, `null` for deletes.
   - `executable[path] = is_executable(staged)` for incoming.
   - **take_snapshot** (§5.2). If it fails, nothing has been written.
   - Write phase:
     - First, for each delete: `remove(target)` (ignore ENOENT), then
       `prune_empty_parents`.
     - Then, for each incoming file: `make_parents(root, target, created)`,
       `hostMode = file_mode(target)`, and
       `install(staged, target, hostMode == null ? undefined : with_executable(hostMode, executable[path]))`.
       New files take the staged mode. Overwritten files keep their host
       permissions, except the executable bit, which follows the sandbox.
   - On any error, run **_rollback** (§5.3).
10. `state.update_manifest(id, written, executable)`.
11. `POST sync/ack {changes: [{path, sha256, executable?}]}`. `executable` is
    included only when `sha256 != null`. If the ack fails, the outcome is
    still a success, with this warning:
    `` The files were written, but the sandbox did not record it (${error}); they may be offered again ``.
12. `state.prune(id)` (keep 20). Return the outcome.

`PullOutcome.result()` (the `SyncResult` sent with `complete`):
`{added: n, modified: n, deleted: n, conflicts: string[], snapshotId, hostPath}`.

### 5.1 `extract_export(data, wanted, dest)`

- Open the archive with auto-detected compression (`r:*`). If it cannot be
  read: `` The sandbox sent an unreadable archive: ${error} ``.
- Member names: strip every leading `./`. Directory names also lose a trailing
  `/`.
- Directory members: if the name is non-empty, `check_relative` it. Otherwise
  skip it.
- Every other member, after `check_relative`:
  - Not in `wanted`: `` The sandbox sent an unexpected file: ${name} ``
  - Seen twice: `` The sandbox sent ${name} twice ``
  - Symlink: the link text must be non-empty and not absolute, and
    `normpath(join(dirname(name), link))` must not be `..` or start with
    `../`. Otherwise: `` Refusing symlink ${name} -> ${link}: it points outside the project ``.
  - Regular file: write it, then `chmod((member.mode & 0o777) | 0o600)`. If it
    cannot be read: `` Could not read ${name} from the archive ``.
  - Anything else: `` Refusing ${name}: only regular files and symlinks can be synced ``
- After the loop, any wanted path not seen fails with
  `` The sandbox archive is missing ${first 5 sorted, ", "} ``.
- Never let the tar library write paths itself. Iterate the entries and write
  them manually (`tar-stream` extract).

### 5.2 `take_snapshot`

- One entry per path in `written`:
  `{path, before: lexists(target) ? "file" : "absent", after_sha256: written[path], manifest_before: link.manifest[path] ?? null, baseline_known: true}`.
- Create the snapshot directory (§2.3).
- For each `before === "file"` entry, `copy_for_snapshot(target, dir/files/<path>)`.
- `save_snapshot`.
- On any failure, `discard_snapshot` and throw
  `` Could not save the snapshot, nothing was written: ${error} ``.

### 5.3 `_rollback`

1. For every `before === "absent"` entry, remove the target. Collect errors as
   `` ${path}: ${error} ``.
2. `rmdir` the directories in `created`, in reverse order. Ignore errors.
3. For every `before === "file"` entry, `make_parents` and then
   `install(savedCopy, target)`. Collect errors.
4. If there were any problems, throw
   `` Sync failed (${cause}) and the rollback was incomplete (${problems.join("; ")}). Copies of the original files are in ${snapshot.directory} ``
   and **keep** the snapshot.
5. Otherwise, `discard_snapshot` and throw `` Sync failed, nothing was changed: ${cause} ``.

---

## 6. Revert (`revert.py`)

`revert(state, projectId, force) -> RevertOutcome`, under the project lock:

1. `snapshot` = the first of `snapshots(id)` (newest first) with
   `!reverted`. If there is none:
   `` There is no sync to revert for ${projectId} ``.
2. `root = realpath(snapshot.hostPath)`. If it is not a directory:
   `` ${root} no longer exists ``.
3. `targets` = `resolve_inside(root, path)` for each entry.
4. `conflicts` = entries where `hash_path(target) !== entry.after_sha256`, that
   is, the host was edited after the pull. If there are conflicts and no
   force, throw `SyncConflict(conflicts, "revert")` with message
   `` ${n} file(s) changed on the host since that sync: ${first5} ``.
5. Force: for each conflicting path that exists, `copy_for_snapshot` it to
   `displaced/<path>` and add it to `displaced`.
   `displaced_dir = <snapshotDir>/displaced/` (the `displaced_copy("")` path).
6. Process the entries sorted with `before === "absent"` **first**, then
   `"file"` (a stable sort on the boolean):
   - `before: "file"`: `make_parents`, then `install(savedCopy, target)`. If
     `after_sha256 == null`, the path goes to `recreated`. Otherwise it goes
     to `restored`.
   - `before: "absent"`: `remove` and `prune_empty_parents`. The path goes to
     `removed`.
7. Baseline restore list: for each entry with `baseline_known`, create
   `{path, sha256: manifest_before}`. Add `executable: is_executable(target)`
   when `manifest_before != null` and `hash_path(target) === manifest_before`.
8. `state.update_manifest(id, {path: manifest_before} for known entries, {path: executable} where present)`.
9. Set `snapshot.reverted = true` and `save_snapshot`.

`restore_baseline(client|null, outcome)` runs **after** the lock is released.
It is best effort:
- If the baseline list is empty, do nothing.
- If there is no client, add the warning
  `The sandbox was not reachable, so it will not offer the reverted changes again`.
- Otherwise `POST sync/ack {changes: baseline}`. On error, add the warning
  `` The sandbox did not record the revert (${error}); it will not offer those changes again ``.

`RevertOutcome.result()` returns `{added: recreated.length, modified: restored.length, deleted: removed.length, conflicts, snapshotId, hostPath}`.

---

## 7. Get (host → sandbox), executed by the companion (`get.py`)

Limits: `MAX_CHANGES = 5000` and `MAX_GIT_PATHS = 200000`.

`plan_changes(tree, link)`:
- Iterate the sorted union of the tree's manifest keys and the link's manifest
  keys.
- A path with no digest now is
  `{path, kind: "deleted", sha256: null, executable: false}`.
- A path that is new, whose digest differs, or whose executable bit differs
  from `link.executable` (only when `link.executable` is known) becomes
  `{path, kind: before == null ? "added" : "modified", sha256, executable: path in tree.executable}`.

`host_changes(link, digests)`:
- Returns `[]` if `realpath(hostPath)` is not a directory.
- Otherwise builds the manifest with the cached hasher, takes executables from
  lstat, sets `git = null`, and returns the changed paths.
- It is used for the heartbeat count and for the Projects page.

`plan_git(current, previous)`:
- Returns `null` if `current` is null.
- Otherwise `{changed: sorted paths whose stamp differs or is new, deleted: sorted paths in previous only}`.
  A `previous` of null is treated as `{}`.

`get(client, state, request)`:
1. `link = require_link(...)` (§5 messages). `root = realpath(hostPath)`.
   Take the project lock.
2. `tree = scan_tree(root, collect_files(root))`. `changes = plan_changes`.
3. More than 5000 changes:
   `` Too many files changed on the host for a get. Run tesseract --sync in ${root} instead ``.
4. `git = plan_git(tree.git, link.gitManifest)`. If `max(changed, deleted)`
   exceeds 200000:
   `` Too many .git files changed on the host for a get. Run tesseract --sync in ${root} instead ``.
5. `POST /v1/sync/requests/:id/plan {hostPath: link.confidential ? "REDACTED" : root, changes, git}`
   (600 s timeout). If `response.request.status === "failed"` (conflicts),
   return that request as is. The controller has already completed it.
6. Validate that `upload` ⊆ the non-deleted change paths and that
   `gitUpload` ⊆ `git.changed`. Otherwise:
   `` The sandbox asked for an unplanned file: ${p} `` /
   `` The sandbox asked for an unplanned .git file: ${p} ``.
7. Write a gzip tar into a temp file. Each `upload` path is added as `root/p`
   with arcname `p`. Each `gitUpload` path is added as `root/.git/p` with
   arcname `.git/p`. Entries are added non-recursively, and symlinks are kept
   as symlinks. If a file is missing (ENOENT):
   `` ${name} changed during the sync, run tesseract --get again ``.
8. `POST /v1/sync/requests/:id/apply` with body `application/gzip`, an
   explicit size, and a 600 s timeout. The response is a `SyncRequest`.
9. On `applied`:
   `state.record_get(id, tree.manifest, tree.executable, tree.git, result.syncedAt ?? iso(now))`.
   On `failed`, return it. On any other status:
   `` The sandbox left the get ${status} ``.

---

## 8. Request handling (`requests.py`)

- `claimable(request, state)`: `status === "pending"` and `projectId` is in
  `state.links()`.
- `empty_result(hostPath, conflicts=[])`:
  `{added:0, modified:0, deleted:0, conflicts, snapshotId:null, hostPath}`.

`handle_request(client, state, request, host) -> Handled{request, ok, message, result}`:
1. `claimed = POST /v1/sync/requests/:id/claim {host}`. A 409 propagates (the
   service ignores it, §9).
2. `link = state.link(claimed.projectId)`. `hostPath = link?.shared_path ?? null`.
   `redact = link?.redact ?? identity`.
3. Dispatch:
   - `kind === "get"`: run `get(...)`, then `_finished(done)`. `applied` gives
     `ok: true` with message `describe_result("get", result)`. Otherwise it
     gives `ok: false` with `done.error || "The sandbox refused the changes"`.
     The request is **not** completed again.
   - `kind === "revert"`: run `revert(state, id, force)`, then
     `restore_baseline(client, outcome)`, and use `outcome.result()`.
   - Otherwise (pull): run `pull(client, state, id, claimed.paths, force).result()`.
     `paths: null` means all.
4. A `SyncConflict` completes the request `failed` with
   `error = redact(message)` and `result = empty_result(hostPath, conflicts)`.
5. Any other error completes the request `failed` with
   `error = redact(message || ErrorClassName)` and
   `result = empty_result(hostPath)`. Log a warning, with the stack trace only
   for non-`SyncBackError` errors.
6. On success, set `result.hostPath = "REDACTED"` if the link is confidential.
   Then `POST complete {status: "applied", result}` and return
   `ok: true, message: describe_result(kind, result)`.
7. `complete` body: `{status, result?, error?}`. `error` is included only if it
   is non-empty.

**Note:** if the get fails before or during `plan`/`apply`, the exception is
caught by the generic handler (step 5) and completed `failed`, which matches
the contract (§6 step 6).

### 8.1 Summary strings (`summary.py`), verbatim

- `plural(n, w)` gives `` `${n} ${w}${n===1?"":"s"}` ``.
- `breakdown(...[n, label])` joins the non-zero entries as `` `${n} ${label}` ``
  with `", "`.
- `UNDO_HINT = "undo with tesseract --revert"`.

| Function | Output |
|---|---|
| describe_pull, total 0 | `` Nothing to sync: ${hostPath} already matches the sandbox `` |
| describe_pull, dry run | `` Would pull ${plural(total,"file")} into ${hostPath} (${counts}) `` |
| describe_pull | `` Pulled ${plural(total,"file")} into ${hostPath} (${counts}) · snapshot ${snapshotId} — undo with tesseract --revert `` |
| describe_revert | `` Reverted snapshot ${id} in ${hostPath} (${counts || "no files"}) `` (labels: restored, recreated, removed) |
| describe_result("revert") | `` Reverted the last sync in ${hostPath} (${breakdown(modified "restored", added "recreated", deleted "removed") || "no files"}) `` |
| describe_result("pull") | `` Pulled ${plural(a+m+d,"file")} into ${hostPath} (${breakdown(... "added","modified","deleted") || "no changes"}) `` |
| describe_get | parts joined by `" · "`: `` Sent ${plural(total,"file")} to the sandbox (${counts}) `` or `Sandbox already up to date`; if total and `insertions` is present, `` +${insertions} −${deletions ?? 0} `` (the minus is U+2212); if `gitFiles`, `` updated .git (${plural(gitFiles,"file")}) ``; if `backupPath`, `` sandbox edits kept in ${backupPath} `` |

`hostPath` in `describe_result` is `result.hostPath || ""`.

---

## 9. `SyncBackService` (Electron main process)

The main process owns this service and replaces `services/syncback.py`. It
runs only while the app runs, and every filesystem operation runs off the UI
thread. Use main-process async fs, or a `worker_thread` for hashing large
trees.

Constants:
- `HEARTBEAT_INTERVAL_S = 20`
- `NOTIFIED_KINDS = ["pull", "revert", "get"]`. Any other kind is treated as
  `pull` for notification titles.
- `host = os.hostname()`

State:
- `revision: number`. It bumps on every finished request, on `sync.updated`,
  on `sync.changed`, and when a request is created locally.
- `busy: Set<projectId>`. It holds the project of the request being applied.
- `queue: SyncRequest[]` and `seen: Set<requestId>`. `seen` is never cleared,
  except on a non-API failure, so the request can be retried.
- `active: boolean`. Requests are applied **one at a time**, in FIFO order.
- `digests: Map<projectId, DigestCache>`.

Behaviour:
- Subscribe to controller events (`/v1/events` socket):
  - `sync.updated`: if `message.request` is an object, bump and enqueue it.
  - `sync.changed`: bump.
  - `hello` (on every (re)connect): `tick()`.
- Connection state:
  - Becoming online starts a 20 s repeating timer, if not already running, and
    calls `tick()` immediately.
  - Going offline clears the timer.
  - `stop()` (on app quit) clears the timer.
- `tick()`: only when online.
  1. Read `links`.
  2. `POST /v1/sync/heartbeat {host, projects: Object.keys(links), changes}`.
     Python always sends `changes` (it may be `{}`). `changes[id] = hostChanges(link, digests[id]).length`.
     A per-project error is logged at debug level and omitted.
  3. If any project is linked, `GET /v1/sync/requests?status=pending`.
  4. Enqueue in **reversed** order. The list is newest first, so the oldest
     request is applied first.
  5. Heartbeat errors are logged at debug level only.
- `enqueue(request)`: skip it if `seen` has it or it is not `claimable`.
  Otherwise mark it seen, push it, and `drain()`.
- `drain()`: if not active and the queue is non-empty:
  1. Shift a request, set `active`, and add its project to `busy`.
  2. Run `handleRequest`.
  3. In `finally`: clear `active`, remove the project from `busy`, bump,
     `drain()`.
- On a handled result: notify with `title = SYNC_BACK[`${kind}_${ok?"done":"failed"}`]`
  (formatted with the project) and `body = handled.message`.
- On an exception:
  - `ApiError` 409 (taken or cancelled): log at debug level and **do not
    notify**.
  - A non-`ApiError` (network or IO): remove the id from `seen` so the next
    poll retries.
  - Then notify with the `${kind}_failed` title and `describe_error(error)` as
    the body. This also happens for non-409 `ApiError`s.
- `submit(projectId, kind, {force=false, paths?, onSuccess, onError})`:
  `POST /v1/projects/:id/sync/requests {kind, force, source: "desktop", paths?}`
  (`paths` only if non-empty). On success, bump, enqueue the created request
  (it is pending, so this app claims it itself), and call `onSuccess`.

Notification strings (`SYNC_BACK`), verbatim (`{project}` = project id):

| key | text |
|---|---|
| pull_done | `Synced {project} to this computer` |
| pull_failed | `Couldn't sync {project} to this computer` |
| revert_done | `Reverted the last sync of {project}` |
| revert_failed | `Couldn't revert the last sync of {project}` |
| get_done | `Sent {project} changes to the sandbox` |
| get_failed | `Couldn't send {project} changes to the sandbox` |

Notification:
- Use Electron `new Notification({title, body})`.
- Python used `Gio.Notification`, whose id is `sync-<projectId>`, so a newer
  notification for the same project **replaces** the older one. Emulate this
  by closing the previous `Notification` stored per project before showing the
  new one.
- Click: show and focus the main window and navigate to the `projects` page
  (Python's `app.navigate` target was `"projects"`). Navigating to the project
  itself (`projects/<id>`) is a nice addition.
- Send failures are swallowed.

IPC surface for the renderer (suggested):
- `sync:state` (pushed to the renderer on change): `{revision, busy: string[]}`.
- `sync:submit(projectId, kind, opts)` resolves to a `SyncRequest`, or rejects
  with a describable error.
- `sync:links()`, `sync:snapshots(projectId)`, `sync:hostChanges(projectId)`,
  `sync:diff(projectId, path)` (§10). The Projects page needs these, because
  the renderer must never touch the filesystem.

Consumers in GTK:
- `pages/projects/sync_actions.py`: polls the `SyncView` while visible,
  refreshes on `revision`, re-renders on `busy`, and keeps its own
  `DigestCache`.
- `pages/projects/model.py`: `load_sync_view` and `sync_blockers` (disabled
  reasons).
- The Claude conversation header's Sync button.

These are specified in the projects spec.

---

## 10. File diff for the review sheet (`diff.py`)

Main-process helper behind `sync:diff`:

- `MAX_PREVIEW_BYTES = 1048576` (1 MiB), `MAX_DIFF_LINES = 4000`,
  `CONTEXT_LINES = 3`.
- `read_host_file(root, rel)`, using `resolve_inside` and lstat:
  - Missing: `null`.
  - Symlink: the link text as bytes.
  - Not a regular file: `null`.
  - Larger than 1 MiB: throw `TooLarge(size)`.
  - Otherwise: the bytes.
- `extract_member(archive, rel)`:
  - Scan the gzip tar from `POST sync/export {paths:[rel]}` for the name
    (`./` stripped).
  - Symlink: the link text.
  - Not a file: `null`.
  - Larger than 1 MiB: `TooLarge`.
  - Missing: `null`.
- `diff_file(before, after)`, where `before` is the host copy and `after` is
  the sandbox copy:
  - Sizes are `before_size` and `after_size` (`null` when absent).
  - `before == after`: state `identical` if non-empty, else `empty`.
  - Decode: if a NUL appears in the first 8192 bytes, or the bytes are not
    UTF-8, the state is `binary`. Otherwise split lines keeping line endings.
    For display, strip `\r\n` from each line.
  - Grouped opcodes with 3 lines of context. Each group starts with
    `{kind:"hunk", text:"@@ -${i1+1},${i2-i1} +${j1+1},${j2-j1} @@"}`, using
    the first and last opcode of the group. Then:
    - `ctx` lines carry `old` and `new` line numbers.
    - `del` lines carry `old`.
    - `add` lines carry `new`.
    - Count `added` and `removed`.
  - If more than 4000 lines accumulate, stop after the current group with
    `truncated = true`, and slice to 4000.
  - If there are no lines, the state is `empty`.
  - Otherwise the state is `text`.
  - Python used `difflib.SequenceMatcher(autojunk=False)`. In TS, use the
    `diff` package (`structuredPatch` with `{context: 3}`) and map hunks the
    same way. Hunk boundaries may differ slightly from difflib. That is
    acceptable, but keep the header format and the 1-based numbering.
- `FileDiff = {state: "text"|"binary"|"too_large"|"identical"|"empty", lines: DiffLine[], added, removed, truncated, beforeSize, afterSize}`.
  `DiffLine = {kind: "hunk"|"add"|"del"|"ctx"|"note", text, old?, new?}`. The
  caller maps `TooLarge` to `too_large`.

---

## 11. CLI behaviour (`tesseract` binary, host side)

Options (GLib option names, ported 1:1 with the same help strings):

| Flag | Help |
|---|---|
| `--sync` | `Copy the current directory to the sandbox and exit` |
| `--confidential` | `With --sync: send the project under a pseudonym and keep its name on this computer` |
| `--pull` | `Copy sandbox changes back into the current directory and exit` |
| `--dry-run` | `With --pull: show what would change, write nothing` |
| `--force` | `With --pull/--revert: overwrite files edited on the host` |
| `--revert` | `Undo the last --pull in the current directory and exit` |
| `--sync-status` | `Show sandbox changes and sync-back snapshots and exit` |
| `--get` | `Runs inside the sandbox; on this computer use --sync` |

The app-only flags (`--hidden` "Start in the tray without a window", `--page ID`
"Open a page by id", `--quit` "Quit the running instance", `--debug` "Verbose
logging") belong to the app launcher spec.

Dispatch order: `--get`, then `--sync`, then `--pull` / `--revert` /
`--sync-status`. The first match wins (in that order: pull, then revert, then
status). These flags never start the GUI.

Exit codes: `EXIT_OK = 0`, `EXIT_ERROR = 1`, `EXIT_CONFLICT = 2`.
`MAX_LISTED = 50`. `KIND_CODES = {added: "A", modified: "M", deleted: "D"}`
(unknown kinds print `?`).

`resolve_link(state, cwd)`:
- Use the link for `realpath(cwd)` if there is one.
- Otherwise `id = project_id_from_name(name) || name`.
- If `state.link(id)` exists elsewhere, throw
  `` ${id} is linked to ${existing.hostPath}, not ${root}. Run tesseract --sync here to relink it ``.
- Otherwise throw `NotLinked(id)`.

`_list(paths)`: print `` `  ${p}` `` for the first 50 paths, then
`` `  … and ${n-50} more` ``.

Conflict report (stderr), returning exit 2:
```
tesseract: ${plural(n,"file")} changed on the host since the last ${action}:
  <paths…>
```
followed by:
- For `action = "push"` (pull): `Nothing was written. Re-run with --force to overwrite them (a snapshot is still taken).`
- For `action = "sync"` (revert): `Nothing was reverted. Re-run with --force to revert anyway (copies of those host edits are kept).`

**`--pull [--dry-run] [--force]`**:
1. Resolve the link, then connect. If there is no client, exit 1.
2. Run `pull`.
3. A `SyncConflict` prints the conflict report and exits 2.
4. Any other error prints `` tesseract: pull failed: ${error} `` to stderr and
   exits 1.
5. Print `describe_pull` to stdout.
6. Dry run: print the plan. Each line is `` `  ${code} ${path}` ``, with the
   suffix `"  (changed on host)"` for conflicts. Rows are ordered added, then
   modified, then deleted. Print at most 50, then `"  … and N more"`. If there
   are conflicts and no force, also print the conflict report and exit 2.
7. Not a dry run, with conflicts (forced): print to stdout
   `` Overwrote ${plural(n,"host edit")} (--force); the originals are in the snapshot ``.
8. Print each warning to stderr as `` tesseract: warning: ${w} ``. Exit 0.

**`--revert [--force]`**:
1. Resolve the link, then run `revert`. It does **not** connect first.
2. A conflict prints the report and exits 2. Any other error prints
   `` tesseract: revert failed: ${error} `` and exits 1.
3. If the baseline list is non-empty, `restore_baseline(connect_client())`.
   This connects lazily, and a failed connect prints its own message.
4. Print `describe_revert`.
5. If anything was displaced, print
   `` Overwrote ${plural(n,"host edit")} (--force); copies are in ${displacedDir} ``.
6. Print the warnings.
7. If unreverted snapshots remain, print
   `` Run tesseract --revert again to undo snapshot ${remaining[0].id} too ``.
   Exit 0.

**`--sync-status`**:
1. Resolve the link. On error, print `` tesseract: ${error} `` and exit 1.
2. Print
   `` ${id} ↔ ${hostPath} · pushed ${pushedAt || "never"} · got ${gotAt || "never"} ``.
3. Connect. If there is no client, the exit code becomes 1, but continue.
   Otherwise `GET changes`:
   - `baselineAt == null`: print `The sandbox has no push baseline yet; run tesseract --sync`.
   - No changes: print `No sandbox changes to pull`.
   - Otherwise: print `` Sandbox changes (${n}): ``, then up to 50 lines
     `` `  ${code} ${path}` ``, adding `"  (changed on host)"` when
     `is_conflict` holds. A path that fails `resolve_inside` counts as a
     conflict. Then print `"  … and N more"` and
     `Run tesseract --pull to copy them here`.
   - If reading fails, print to stderr
     `` tesseract: could not read sandbox changes: ${error} `` and set the
     exit code to 1.
4. Snapshots: print `` Snapshots (${n}): `` or `No snapshots yet`. Then print
   `` `  ${id}  ${plural(entries,"file")}${reverted ? "  reverted" : ""}` ``
   per snapshot.
5. Return the code.

**`--get`** on the host: print
`tesseract --get runs inside the sandbox (in /workspace/projects/<id>); on this computer use tesseract --sync`
to stderr and exit 1.

---

## 12. Attachments (composer) (`attachments/*`)

### 12.1 Model (renderer, pure TS)

Constants, which mirror `LIMITS` in `packages/protocol/src/constants.ts`
(import them from there, do not duplicate them):

| Name | Value |
|---|---|
| `MAX_UPLOAD_BYTES` | 20 MiB (`20*1024*1024`) |
| `MAX_ATTACHMENTS` | `10` |
| `MAX_NAME_LENGTH` | `255` |
| `FALLBACK_MIME_TYPE` | `application/octet-stream` |
| `PNG_MIME_TYPE` | `image/png` |

- `KIND_ICONS = {image: "image", pdf: "file-pdf", audio: "audio", file: "file"}`
  (icon ids from the app's Lucide mapping).
- Upload kind: a MIME type starting `image/` is `image`, `audio/` is `audio`,
  `application/pdf` is `pdf`, and anything else is `file`.
- `mime_type_of(name, hint)`: use the trimmed `hint` if it contains `/`.
  Otherwise guess from the extension (use the `mime` package), falling back to
  `application/octet-stream`. In Electron, `File.type` serves as the hint.
- `upload_name(name)`: `name.trim().slice(0, 255) || "file"`.
- `pasted_image_name(now)`: `` `pasted-image-${Math.floor(now_ms).toString(16)}.png` ``.
- `draft_key(i)`: `` `att-${Date.now().toString(16)}-${i}-${6 hex random chars}` ``.
- `admit_files(files, current)`:
  1. Reject files with a known `size > MAX`, with the message
     `` `${name} is larger than ${formatBytes(MAX)}.` `` (that is,
     `… larger than 20 MB.`).
  2. `slots = max(0, 10 - current)`. If more files remain than slots, add the
     message `You can attach up to 10 files to one message.` and keep the first
     `slots` files.
  3. Rejected messages are joined with `" "` and shown as **one toast with a
     5 s timeout**.
- `read_file`: read the in-memory data, or at most `MAX+1` bytes from the path.
  If neither exists, throw `` `${name} isn't a local file, so it can't be attached.` ``.
  Over the limit, throw the too-large message. The size is re-checked because
  files can change after picking.
- `Drafts` (ordered list):
  - `add`, `get`, `patch(key, changes)`, `remove`, `clear`.
  - `upload_ids` = the ids of drafts with status `ready` and an upload.
  - `blocked` = any draft `uploading` or any `error`.
  - `can_attach` = fewer than 10 drafts.
  - `prompt(text)` = `text.trim()`, or the default prompt:
    - All images, one: `Take a look at this image.`
    - All images, several: `Take a look at these images.`
    - Otherwise, one: `Take a look at the attached file.`
    - Otherwise, several: `Take a look at the attached files.`
- Upload: each file uploads **as soon as it is added**, in parallel.
  - `POST /v1/uploads {name: upload_name(name), mimeType, data: base64(bytes)}`
    with a 120 s timeout (`UPLOAD_TIMEOUT_S`). The response is an `Upload`.
  - On success, patch `{status: "ready", upload, error: null}`.
  - On failure, patch `{status: "error", error}`. For local read errors and
    `ValueError`s, the error is the plain message. Otherwise it is
    `describe_error(e)`.
  - A patch on a removed key is a no-op.
  - Retry sets `uploading` and re-uploads.
- Send gating (sidebar composer):
  - Send is enabled iff (`text.trim()` or attachments exist) and online and
    not `blocked`.
  - On send, use `prompt(text)` when there are attachments, pass
    `attachmentIds = upload_ids`, and `clear()` once the run starts.
- `format_bytes(size)`:
  - `null`, non-finite or ≤ 0 gives `0 B`.
  - Otherwise divide by **1024** while the value is ≥ 1024, through the units
    `B, KB, MB, GB, TB, PB`.
  - Unit B: `Math.round`.
  - Other units: one decimal (JS `toFixed` rounding, half-up) with a trailing
    `.0` trimmed. Values ≥ 100 get no decimal.
  - The result is `"<value> <unit>"`, for example `1.5 MB` or `20 MB`. Reuse
    the shared formatter if one already exists.

Strings (`ATTACHMENTS`), verbatim:

| key | text |
|---|---|
| attach | `Attach` |
| images | `Images…` |
| files | `Files…` |
| paste | `Paste image` |
| images_title | `Attach images` |
| files_title | `Attach files` |
| images_filter | `Images` |
| remove | `Remove {name}` |
| retry | `Retry {name}` |
| too_large | `{name} is larger than {limit}.` |
| too_many | `You can attach up to {limit} files to one message.` |
| no_path | `{name} isn't a local file, so it can't be attached.` |
| unreadable | `Couldn't read {name}: {error}` |
| empty_clipboard | `There's no image on the clipboard to paste.` |
| prompt_* | see above |

### 12.2 Interaction

- **Attach button**: a menu button with icon `attach`, tooltip and aria-label
  `Attach`. The menu items, in order, are `Images…`, `Files…`,
  `Paste image`.
  - `Paste image` is enabled only if the clipboard holds an image. Check this
    each time the menu opens: in Electron, call
    `clipboard.availableFormats()` through IPC and look for `image/*`.
  - The button is disabled when the composer is disabled or 10 attachments are
    present.
- **Images… / Files…**: open the native multi-select dialog
  (`dialog.showOpenDialog`, `properties: ["openFile", "multiSelections"]`).
  - Titles: `Attach images` and `Attach files`.
  - Images get an `Images` filter for image extensions, selected by default.
  - When the draft is already full, show the toast
    `You can attach up to 10 files to one message.` instead of the dialog.
  - Cancel is silent.
  - Files without a local path show the `no_path` toast each. GTK had to deal
    with GVFS URIs here. In Electron, use `webUtils.getPathForFile` for
    dropped files, so this mostly cannot happen.
- **Paste image** (menu):
  - When full, show the too-many toast.
  - With no image, show `There's no image on the clipboard to paste.`
  - Otherwise read the image as PNG (`clipboard.readImage().toPNG()` in main)
    and add it as `pasted-image-<hex ms>.png` (`image/png`). If the read fails,
    show `` Couldn't read Paste image: ${error} ``. Python formats
    `name = S["paste"]`; keep that text.
- **Ctrl/Cmd+V in the composer text field**: if the composer is enabled and
  the clipboard has an image **and no text**, prevent the default paste and run
  the paste-image flow. Otherwise paste text normally.
- **Drag and drop** of files onto the whole composer:
  - While dragging over it, add the `drop-target` look: border `accent`
    `#5E6AD2` and background `accentMuted` `#1E2036`.
  - Remove the look on leave or drop.
  - If the composer is disabled, the drop is rejected.
  - Only `Files` drags are accepted, with copy semantics.
- Chips appear immediately with the `uploading` status.

### 12.3 Visuals (Linear dark scheme; light values in parentheses)

Tokens:
- spacing `xxs 2`, `xs 4`, `sm 8`
- radius `sm 6`, `md 8`, `full`
- control heights `sm 28`, `md 32`
- icon sizes `xs` and `sm`, both 16 px
- `hairline` = `1px solid border`, where `border` = `rgba(255,255,255,0.08)`
  (`rgba(0,0,0,0.09)`)

Colors:
- `surface` `#121213` (`#FFFFFF`)
- `backgroundElement` `#1E1E20` (`#EEEEF0`)
- `textSecondary` `#929294` (`#5C5D66`)
- `textTertiary` `#6B6B6F` (`#7E7F88`)
- `danger` `#EB5757` (`#C93A3A`)
- `accent` `#5E6AD2`
- `accentMuted` `#1E2036` (`#EDEEFA`)

**Tray**:
- Hidden while empty.
- `padding-bottom: 8px`.
- A single horizontally scrolling row with `gap: 8px`. The vertical scrollbar
  is never shown, the horizontal one is automatic, and the height is the
  natural height.
- In the sidebar composer, the tray is the first child above the text field.

**Pill chip** (any non-image, or an image without a thumbnail source):
- Row layout with `gap: 8px`, `padding: 4px`, `border-radius: 8px`, hairline
  border, background `surface`, vertically centered.
- Icon tile: 28×28, radius 6, background `backgroundElement`, with the kind
  icon (16 px, `textSecondary`) centered.
- Text column:
  - Name: 13 px / 18 px line height, weight medium (500), color `text`. Max
    width about 22 characters. Python used `width-chars = min(len(name), 12)`
    and `max-width-chars = 22`, so in CSS use `min-width: min(<len>ch, 12ch)`
    and `max-width: 22ch`. Ellipsis in the **middle** (for example
    `very-long-na…e.pdf`): implement it with a JS middle-truncate, since CSS
    only truncates at the end.
  - Caption: 12 px / 16 px, regular, `textTertiary`, max 28 characters. It
    shows the size (`format_bytes`), and is hidden when there is no size and no
    error.
- Status slot:
  - `ready`: empty.
  - `uploading`: a 16×16 spinner.
  - `error`: a 20×20 circular flat button with the `refresh` icon (16 px,
    `danger`), tooltip and aria-label `Retry {name}`. It appears only when
    retry is possible; otherwise the slot stays empty.
- Remove button (composer drafts only): 20×20, circular, flat, padding 0, with
  the `close` icon at 16 px. Tooltip and aria-label `Remove {name}`.
  Vertically centered.
- Error state:
  - Border `danger`.
  - The caption shows the error text in `danger`.
  - Tooltip `` `${name}. ${error}` ``.
- Default tooltip: `` `${name} · ${size}` ``, or just the name. After any
  status change, the tooltip becomes just the name (Python behaviour).
- Aria-label: the name.

**Thumbnail chip** (image kind with a data source):
- A square of **56 px** (or **160 px** `large`, used for sent images in the
  conversation).
- `overflow: hidden`, `border-radius: 8px`, hairline border.
- Image: centre-cropped square with `object-fit: cover`. Honour EXIF
  orientation (CSS `image-orientation: from-image` is the default in
  Chromium). Decode at 2× for HiDPI.
- While loading or unavailable, show the `image` placeholder icon at the chip
  size.
- The status overlay is centered (spinner, or the retry button in error).
- Remove button overlay: top-right, `margin: 2px`, background
  `rgba(0,0,0,0.55)`, icon color white, 20×20 circular.
- Thumbnails are cached in an LRU of **32** entries, keyed `` `${key}@${size}` ``.
  - Drafts use the draft key.
  - Sent uploads use the upload id, with the bytes from
    `GET /v1/uploads/:id/content` (120 s timeout).
  - In Electron, an object-URL LRU (revoke on eviction) or a main-process
    protocol handler (`tesseract-upload://<id>`) is fine.

**Sent attachments** (conversation messages): `upload_chip(upload, large = kind==="image")`.
They have no remove or retry buttons, and their meta is
`format_bytes(upload.sizeBytes)`.

**Attach button**:
- Main composer: 28×28, `border-radius: full`, padding 0, color
  `textSecondary`, flat.
- Large composer variant: 32×32 with a hairline border and background
  `backgroundElement`.
- Sidebar composer: 28×28 with `border-radius: 6px`.

**Micro-animations** (Electron additions, 120–220 ms, ease-out, disabled under
`prefers-reduced-motion`):
- Chip enter: opacity 0→1 and scale 0.96→1 over 160 ms.
- Chip exit: opacity and width collapse over 140 ms.
- Tray height: expand and collapse over 180 ms.
- Error border: color crossfade over 120 ms.
- `drop-target` border and background: 120 ms. GTK's `transition()` helper
  defaults are `fast` = 120 ms with `cubic-bezier(0.2, 0, 0, 1)`; reuse that
  curve.

---

## 13. GTK/Python quirks that should NOT be copied

1. **`fcntl.flock` locks**: these are POSIX only. Use a portable lock (§2.4).
2. **XDG state dir on every OS**: only correct on Linux. Use the per-OS
   resolution in §2.1, but keep Linux identical.
3. **GLib option parsing** runs in the GUI binary (`do_handle_local_options`),
   so `tesseract --pull` imports GTK. The Electron CLI is a separate
   bun-compiled binary that never loads Electron for sync flags.
4. **`Gio.Notification` id replacement**: emulate it explicitly (§9).
   `app.navigate` is a GAction, so use IPC navigation instead.
5. **`run_async` on GLib threads**: use async fs and promises. Keep the
   single-in-flight queue semantics; do not parallelize request handling.
6. **The `seen` set never shrinks**: in a long-running app this is a slow
   memory leak. Cap it (for example, forget ids older than 500, which matches
   the controller's newest-500 retention).
7. **Pull/export buffers the whole export tar in memory** (`bytes`). In
   Electron, stream the response to a temp file and extract it from there.
8. **Pasted image naming uses `S["paste"]` as the `{name}`**. This produces
   `Couldn't read Paste image: …`. Keep the text for parity, but it reads
   oddly; if allowed, improve it later.
9. **GTK menu "Paste image" sensitivity is computed on open**: in Electron, the
   renderer menu must ask main for the clipboard formats on open. Do not poll.
10. **Middle ellipsis and `width-chars`**: these are Pango features. Use a JS
    truncation helper and `ch` units, not the Pango numbers.
11. **The snapshot id uses local time** while `createdAt` uses UTC. Keep it,
    because existing snapshot directories depend on it. Sorting uses
    `createdAt` first.
12. **`surrogateescape` decoding of git output**: Node strings cannot hold lone
    surrogates. Non-UTF-8 filenames are rare; if one is seen, skip it and log
    a warning rather than corrupting the path.
13. **Python `tarfile` defaults**: Python writes GNU/PAX headers. Make sure the
    TS writer emits PAX for long names (over 100 chars). `tar-stream` does
    this.
14. **Windows**: symlinks, executable bits and atomic rename over open files
    all need the handling described in §2.5. Python never ran there.
