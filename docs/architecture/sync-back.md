# Sync back (sandbox → host) and get (host → sandbox)

`monolith --sync` pushes a host checkout into the sandbox
(`POST /v1/projects/:id/sync`). `monolith --get`, run **inside the sandbox**,
brings the host's later changes in without touching the host (§6). The sandbox is for trying changes out; once they
are good, **sync back** copies the changed files from the sandbox into the host
checkout. Sync back writes nothing until it has taken a snapshot, refuses to
overwrite host edits it did not expect, and can be undone with
`monolith --revert`.

A push of a confidential project (its id is a pseudonym chosen by the desktop
client) adds `?confidential=1`, which marks the project confidential before the
archive is extracted ([00-blueprint.md §6.1](00-blueprint.md)).

Only the desktop companion (`apps/desktop`, running on the host) can write to
the host. The mobile app never touches the host directly: it queues a **sync
request** on the controller, and the desktop companion claims and applies it.

## 1. Baseline and changes (controller)

- **Baseline:** after a successful push (`POST /v1/projects/:id/sync`), the
  controller records a manifest of the project tree: `path → sha256` for every
  regular file and symlink. In a git checkout that is `git ls-files -z --cached
  --others --exclude-standard`; otherwise a walk that skips `.git` and
  `node_modules`. `.git/**` is never part of a manifest. Stored under the
  controller state dir as `sync/<projectId>.json`
  (`{ pushedAt, files: {path: sha256}, executable: path[] }`; `executable` lists
  the regular files with an executable bit, so a `chmod +x` in the sandbox is a
  change too. Baselines without it only compare content).
- **Changes:** the current manifest diffed against the baseline:
  `added` (not in baseline), `modified` (hash or executable bit differs; a
  mode-only change keeps its `sha256`), `deleted` (in baseline, gone now).
  Paths are POSIX, relative, never absolute, never contain `..`.
- **Ack:** after the host applies files it acks them, and the baseline entries
  for those paths move to the acked hash and executable bit (or are removed for
  a delete), so the same change is not offered twice. When an ack omits
  `executable`, the sandbox file's current bit is used if its hash matches the
  acked one. A host revert acks the pre-pull values back (see §4).
- **Blobs:** the baseline content itself, content-addressed in
  `sync/blobs/<projectId>/<sha256>` (a symlink: its target, as `<sha256>.link`;
  0600 files, 0700 dirs, temp + rename). Stored for every entry on push, for the
  incoming files of a get, and on ack when the sandbox file has the acked hash.
  A push removes the blobs its baseline no longer references; nothing else
  prunes them (a host revert acks old hashes back). Baselines from before the
  store have no blobs: those changes are not discardable until the next push.

## 2. Protocol (`@theone/protocol`, schemas in `schemas/sync.ts`)

```ts
SyncChangeKind = "added" | "modified" | "deleted"
SyncFileChange = { path: string; kind: SyncChangeKind; sha256: string | null /* null for deleted */; size: number | null;
                   discardable?: boolean /* added: true; else the baseline blob is stored (or only the mode changed) */ }
SyncHost      = { name: string; lastSeenAt: Timestamp; online: boolean /* seen in the last 60 s */; linked: boolean /* this project is linked on it */ }
SyncChanges   = { projectId: ProjectId; baselineAt: Timestamp | null /* null: never pushed, sync back unavailable */;
                  changes: SyncFileChange[]; totalBytes: number; host: SyncHost | null;
                  lastGetAt?: Timestamp | null /* last get applied since the last push */ }

SyncRequestId     = "sync_" + id (idPattern("sync"))
SyncRequestKind   = "pull" | "revert" | "get"
SyncRequestStatus = "pending" | "claimed" | "applied" | "failed" | "cancelled"
SyncResult = { added: number; modified: number; deleted: number; conflicts: string[];
               snapshotId: string | null; hostPath: string | null;
               // get only:
               files?: SyncFileStat[]; insertions?: number; deletions?: number; gitFiles?: number;
               syncedAt?: Timestamp; previousSyncAt?: Timestamp | null; backupPath?: string | null }
SyncFileStat = { path: string; kind: SyncChangeKind; insertions: number; deletions: number; binary: boolean;
                 oldMode: "100644" | "100755" | "120000" | null; newMode: (same) | null;
                 oldSize: number | null; newSize: number | null }
SyncRequest = { id: SyncRequestId; projectId: ProjectId; kind: SyncRequestKind; status: SyncRequestStatus;
                paths: string[] | null /* pull subset; null = all */; force: boolean;
                source: "mobile" | "desktop" | "cli"; claimedBy: string | null;
                result: SyncResult | null; error: string | null; createdAt: Timestamp; updatedAt: Timestamp }
CreateSyncRequest = { kind: SyncRequestKind; paths?: string[] (1–5000); force?: boolean; source?: "mobile" | "desktop" | "cli" }
ClaimSyncRequest  = { host: string }
CompleteSyncRequest = { status: "applied" | "failed"; result?: SyncResult; error?: string }
SyncAck       = { changes: { path: string; sha256: string | null; executable?: boolean }[] }
SyncHeartbeat = { host: string; projects: ProjectId[] /* projects linked on this host */ }
SyncDiscard   = { paths?: SyncPath[] (1–5000) /* omitted: every change */ }
SyncDiscardResult = { discarded: SyncPath[]; unavailable: SyncPath[] /* no blob, untouched */;
                      backupPath: string | null; changes: SyncChanges }
SyncGetChange = { path: string; kind: SyncChangeKind; sha256: string | null /* null exactly for deleted */; executable: boolean }
SyncGetPlan   = { hostPath: string; changes: SyncGetChange[] (≤ 5000);
                  git: { changed: string[]; deleted: string[] } /* paths relative to .git, ≤ 200000 each */ | null }
SyncGetPlanResponse = { request: SyncRequest; upload: string[]; gitUpload: string[] }
```

Event on `/v1/events`: `{ type: "sync.updated", request: SyncRequest }` and
`{ type: "sync.changed", projectId }` (baseline moved: after push, ack or get; or a discard changed sandbox files).

## 3. REST (controller)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/projects/:id/sync/changes` | — | `SyncChanges` (404 unknown project) |
| POST | `/v1/projects/:id/sync/export` | `{ paths: string[] }` (1–5000, each must be a current `added`/`modified` change) | `200 application/gzip` tar of those files' current content (`--no-same-owner` safe: regular files and symlinks only, no absolute or `..` entries); 400 for a path that is not a current change |
| POST | `/v1/projects/:id/sync/ack` | `SyncAck` | `200 SyncChanges`; publishes `sync.changed` |
| POST | `/v1/projects/:id/sync/discard` | `SyncDiscard` | `200 SyncDiscardResult` (§7); 400 without a baseline, for a path that is not a current change or is behind a sandbox symlink; 409 if a `pending`/`claimed` request exists for the project; publishes `sync.changed` and `project.updated` |
| GET | `/v1/projects/:id/sync/requests` | — | `SyncRequest[]` newest first (last 50) |
| POST | `/v1/projects/:id/sync/requests` | `CreateSyncRequest` | `201 SyncRequest`; 409 if a `pending`/`claimed` request exists for the project; 400 for `pull` when `baselineAt` is null; publishes `sync.updated` |
| GET | `/v1/sync/requests?status=pending` | — | `SyncRequest[]` across projects (the desktop poll) |
| POST | `/v1/sync/requests/:id/claim` | `ClaimSyncRequest` | `200 SyncRequest` (`claimed`); 409 unless `pending` |
| POST | `/v1/sync/requests/:id/complete` | `CompleteSyncRequest` | `200 SyncRequest`; 409 unless `claimed` |
| POST | `/v1/sync/requests/:id/cancel` | — | `200 SyncRequest` (`cancelled`); 409 unless `pending` |
| POST | `/v1/sync/heartbeat` | `SyncHeartbeat` | `204`; remembers the host per project for `SyncChanges.host` |
| POST | `/v1/sync/requests/:id/plan` | `SyncGetPlan` (body limit 64 MiB) | `200 SyncGetPlanResponse`; 409 unless a `claimed` `get`. With conflicts and no `force` the request is completed `failed` (`result.conflicts`) and `upload` is empty |
| POST | `/v1/sync/requests/:id/apply` | gzip (or plain) tar of exactly `upload` + `.git/<gitUpload>` (body limit 1 GiB) | `200 SyncRequest`: `applied` with the stats, or `failed` on conflicts found at apply time; 409 unless `claimed` with a plan; 400 for a bad archive or a file whose hash is not the planned one (the request stays `claimed`: the host completes it `failed`) |

A request `claimed` for more than 10 minutes without completing is failed by the
controller with `error: "The desktop companion stopped responding"`.
Requests are persisted in the controller database (newest 500 kept).

## 4. Host side (`apps/desktop`, Python)

State lives in `$XDG_STATE_HOME/monolith` (default `~/.local/state/monolith`):

- `links.json`: `{ projectId: { hostPath, pushedAt, manifest: {path: sha256}, confidential?: true } }`,
  written by every successful `monolith --sync` (the host manifest at push time,
  same file set rules as the push, `.git` excluded). A confidential link never
  sends its `hostPath` or folder name to the controller: request results and get
  plans carry `hostPath: "REDACTED"` and error messages are redacted the same way.
- `snapshots/<projectId>/<snapshotId>/`: `snapshot.json`
  (`{ id, projectId, hostPath, createdAt, kind: "pull", entries: [{ path, before: "file" | "absent", after_sha256: string | null, manifest_before: string | null }], reverted: bool }`)
  plus `files/<path>` copies of every host file the pull overwrote or deleted,
  and `displaced/<path>` copies of host edits a `--revert --force` overwrote.
  `manifest_before` is the `links.json` manifest hash before the pull (null: not in it).
  Keep the newest 20 snapshots per project.

**Pull** (`monolith --pull` in the checkout, or a claimed `pull` request):
1. Resolve the project (cwd → id as `--sync` does, or request → `links.json`).
   Unlinked project → fail "Run monolith --sync in the checkout first".
2. `GET changes`; filter to `paths` if given. Nothing to do → report and exit 0.
3. **Conflict check:** for each change, if the host file's current hash differs
   from the push-time manifest (host edited it after pushing, or created it) →
   conflict. Any conflict without `--force` aborts before writing and lists them.
4. Validate every path (relative, no `..`, stays inside the checkout, never
   `.git/`), then write the snapshot (copies of every file about to be
   overwritten/deleted, and `before: "absent"` for new ones) and fsync it.
5. `POST export`, extract into a temp dir, validate entries, then move files
   into place atomically (write temp + rename); apply deletes. An overwritten
   file keeps its host permissions except the executable bit, which follows the
   sandbox. On any error, roll back from the snapshot and fail.
6. `POST ack` with the hashes and executable bits actually written; update `links.json` manifest
   entries to the new hashes (so a later pull does not flag them as conflicts).
7. Print/return `SyncResult` (with `snapshotId`).

**Revert** (`monolith --revert`, or a claimed `revert` request): take the newest
snapshot of the project with `reverted: false`; for each entry, if the host
file no longer matches `after_sha256` (edited since the pull) → conflict, abort
unless `--force` (which first copies those host edits to `displaced/`); else
restore the saved copy (`before: "file"`) or delete the file (`before: "absent"`).
Mark the snapshot `reverted: true`. Running it again reverts the pull before that.
Revert never touches the sandbox's files, but it undoes the pull's bookkeeping:
the `links.json` manifest entries go back to `manifest_before`, and it acks
`manifest_before` (plus the restored executable bit) to the controller, so the
baseline is back where it was and the reverted changes are offered again by the
next `changes`. A plain re-pull then applies them without conflicts; a file the
host had edited before a forced pull is still a conflict. If the controller is
unreachable the host revert still happens, with a warning that the changes will
not be offered again.

CLI (GLib options on the same `monolith` entry point, run in the checkout):
`--sync [--confidential]` (push, now also records the link; a folder that is
already linked keeps its id and confidential flag, otherwise `--confidential`
pushes under a fresh `adjective-noun` pseudonym that no link or sandbox project
uses; a folder already linked under its real name is re-linked under a fresh
pseudonym, and the old real-named copy stays in the sandbox, unlinked, for the
user to delete),
`--pull [--dry-run] [--force]`,
`--revert [--force]`, `--sync-status` (changes + snapshots). Exit 0 on success,
1 on error, 2 on conflicts.

The running desktop app sends `SyncHeartbeat` every 20 s, polls
`GET /v1/sync/requests?status=pending` (and reacts to `sync.updated` events),
claims requests for linked projects, applies them with the same engine, completes
them, and shows a desktop notification. Its Projects page shows sync-back
changes, recent requests and snapshots, and four actions: **Sync to host**
(`pull`, confirm sheet listing the files, forced when host edits conflict),
**Sync from host** (`get` with `source: "desktop"`, claimed by this same app;
it asks to force only when the last get failed on conflicts), **Revert last sync**
(`revert`) and **Discard changes** (`POST sync/discard` with the `discardable`
files, after a destructive confirm; reports discarded/unavailable counts and the
backup path). Each is disabled with the reason as tooltip (not linked here,
never pushed, a request active, nothing to sync/discard, no snapshot). The
Claude conversation header has a **Sync** button opening the same four actions
for the run's project.

## 5. Mobile

Project screen (`sandbox/projects/[id]`) gets a **Sync to host** group:
changed-file list (A/M/D + path), host status ("Monolith on <host> · online" /
"Desktop companion offline — the request waits until it connects" / "Not linked
— run monolith --sync on your computer"), a primary **Sync to host** button
(confirm sheet listing the files, optional force when the last request failed on
conflicts), **Revert last sync**, and the recent requests with live status from
`sync.updated`. Cancel is available while a request is pending.

The group also offers **Sync from host** (confirm sheet; optional force when
the last `get` failed on conflicts; the request row shows files and `+ins −del`),
and **Discard changes**: a destructive sheet listing the `discardable` files
(all selected, each can be unticked) that calls `POST sync/discard`, stores the
returned changes and shows a notice with the restored count, the files kept
(`unavailable`) and the `backupPath`. Every action is disabled with a reason:
loading, never pushed, a request active, nothing to sync / revert / discard,
no discardable file, or (to/from host and revert) the project not linked on a
host. An offline companion does not disable them: the request queues.

The Claude run screen (`sandbox/agent/[id]`) has a **Sync** header action next
to Reload / Stop run when the run has a project. It opens a menu sheet with the
same four actions and their disabled reasons: Sync to host (a pull of all listed
changes) and Sync from host queue in one tap; Revert and Discard (all
discardable files) ask for confirmation first. It refreshes the changes when
the run finishes (and every 15 s while it runs), and shows a notice that
follows the queued request via `sync.updated` (queued with the offline /
not-linked warning, applying, applied counts, or the error and conflicts) or
the discard result.

`sync.updated` patches the request list (and refetches the changes once a
request is applied); `sync.changed` refetches both the changes and the requests.

## 6. Get (host → sandbox)

`monolith --get` in a sandbox project folder (`/workspace/projects/<id>/…`)
copies what changed in the linked host checkout since the last push or get into
the sandbox, and prints a `git pull` style summary.

**Scope.** The sandbox never names a host path. A `get` request carries only the
project id; the desktop companion claims it only for projects in its
`links.json` (written by `monolith --sync`), reads only that checkout, with the
same file set as the push (tracked + unignored files and `.git`), never follows
a symlink out of it, and skips any path whose parent resolves outside it. A
project never pushed (no baseline) cannot be got from (400 at create).

**Sandbox CLI** (`/usr/local/bin/monolith` → `theone-controller monolith`):
`monolith --get [--force] [--json]`. Checks `GET changes` first and fails fast
when no desktop companion is connected, it is offline, or the project is not
linked there. Creates `{ kind: "get", force, source: "cli" }`, then follows the
request (polling `GET /v1/projects/:id/sync/requests`): pending → "Waiting for
Monolith on <host>…", claimed → "Getting changes from <host>…". A request still
pending after 60 s (or on Ctrl-C) is cancelled. Exit 0 applied, 1 error, 2
conflicts. Output:

```
From <host>:<hostPath>
 src/app.ts      | 12 ++++++++----
 assets/logo.png | Bin 1204 -> 2048 bytes
 2 files changed, 8 insertions(+), 4 deletions(-)
 create mode 100644 src/new.ts
 delete mode 100644 old.ts
 mode change 100644 => 100755 run.sh
Updated .git (37 files)
Synced at 2026-10-01 14:03:12 · previous sync 2026-10-01 11:40:02 (2 hours ago)
```

"Already up to date." when nothing changed (the timestamp is still recorded).

**Host (desktop companion), on a claimed `get`:**
1. `link = links.json[projectId]` (unlinked → never claimed); the checkout must exist.
2. Host manifest now (`build_manifest`, same rules as the push) vs `link.manifest`:
   `added` / `modified` (hash differs, or the executable bit differs when
   `link.executable` is known) / `deleted`. More than 5000 → fail ("run monolith --sync").
3. `.git` (a directory): `gitManifest` = `{ path under .git: "<size>:<mtime_ns>" }`
   for regular files, skipping `*.lock`; `changed` = new or different vs
   `link.gitManifest` (absent: everything), `deleted` = gone since.
4. `POST plan`. A `failed` request (conflicts) is reported as is (not completed again).
5. Tar (gzip) exactly `upload` + `.git/<gitUpload>` (symlinks as symlinks), `POST apply`.
6. On `applied`: `links.json` gets the new `manifest`, `executable`,
   `gitManifest` and `gotAt` (`pushedAt` unchanged). Any error before or during
   `apply` → `complete` `failed` with the message.

`monolith --sync` also records `executable` and `gitManifest`, so the first get
after a push sends only real changes.

**Controller:**
- Baseline gains `gotAt` (last get) and `gitHead` (`<symbolic ref>@<sha>` of the
  sandbox repo at push/get time; `null`: not a git repo).
- **Conflicts** (plan, and again at apply): a planned path whose sandbox content
  differs from both the baseline (edited in the sandbox since the last sync) and
  the incoming content (`null` = absent). `.git` is a conflict when the plan
  changes `.git` and the sandbox `HEAD` moved since the baseline (sandbox
  commits or a checkout). Without `force` nothing is written.
- `upload` = added/modified paths whose sandbox content differs from the
  incoming hash; `gitUpload` = all `git.changed`. The plan is kept in memory
  until apply (lost on restart: the host's apply gets 409 and fails the request).
- **Apply:** extract into a staging directory, accept only regular files and
  in-tree symlinks, require exactly the planned set and the planned hashes,
  set the executable bits from the plan, then move each file into place
  (sandbox versions of forced conflicts are first copied to
  `<dataDir>/sync/backups/<projectId>/<requestId>/`), apply deletes (pruning
  empty directories) and the `.git` updates/deletes, rolling everything back on
  error. Line counts are computed per file (Myers diff over lines; binary = a
  NUL byte in the first 8000 bytes, or larger than 16 MiB).
- The baseline entries of every planned path move to the incoming hash and
  executable bit (or are removed), so sandbox-side edits elsewhere are still
  offered for sync back; `gotAt` and `gitHead` are updated. Completes the request
  `applied` with `SyncResult` (`snapshotId: null`), publishes `sync.changed` and
  `project.updated`.

## 7. Discard (sandbox → baseline)

`POST /v1/projects/:id/sync/discard` throws away sandbox-side changes: the
selected changes (`paths`, or every change) go back to the baseline (the last
push, get or ack). The host is not involved.

- `added` → the file is removed (empty parent folders pruned).
- `modified` / `deleted` → the baseline blob is written back (temp + rename),
  a symlink as a symlink, with the baseline executable bit (old baselines
  without `executable`: the current bit). A mode-only change is a `chmod`.
  No blob → listed in `unavailable` and left as is (`discardable: false` in
  `changes`).
- The sandbox versions are first copied to
  `sync/backups/<projectId>/discard-<ts>/` (`backupPath`; shares the newest-20
  pruning with get backups). All or nothing: any error rolls back and is a 500.
- `.git` is never touched; paths behind a sandbox symlink are refused (400).
- 409 while a `pending`/`claimed` sync request exists (or another discard runs).
- The baseline does not move. Publishes `sync.changed` and `project.updated`
  and returns the fresh `changes`.
