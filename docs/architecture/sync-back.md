# Sync back (sandbox → host)

`monolith --sync` pushes a host checkout into the sandbox
(`POST /v1/projects/:id/sync`). The sandbox is for trying changes out; once they
are good, **sync back** copies the changed files from the sandbox into the host
checkout. Sync back writes nothing until it has taken a snapshot, refuses to
overwrite host edits it did not expect, and can be undone with
`monolith --revert`.

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

## 2. Protocol (`@theone/protocol`, schemas in `schemas/sync.ts`)

```ts
SyncChangeKind = "added" | "modified" | "deleted"
SyncFileChange = { path: string; kind: SyncChangeKind; sha256: string | null /* null for deleted */; size: number | null }
SyncHost      = { name: string; lastSeenAt: Timestamp; online: boolean /* seen in the last 60 s */; linked: boolean /* this project is linked on it */ }
SyncChanges   = { projectId: ProjectId; baselineAt: Timestamp | null /* null: never pushed, sync back unavailable */;
                  changes: SyncFileChange[]; totalBytes: number; host: SyncHost | null }

SyncRequestId     = "sync_" + id (idPattern("sync"))
SyncRequestKind   = "pull" | "revert"
SyncRequestStatus = "pending" | "claimed" | "applied" | "failed" | "cancelled"
SyncResult = { added: number; modified: number; deleted: number; conflicts: string[];
               snapshotId: string | null; hostPath: string | null }
SyncRequest = { id: SyncRequestId; projectId: ProjectId; kind: SyncRequestKind; status: SyncRequestStatus;
                paths: string[] | null /* pull subset; null = all */; force: boolean;
                source: "mobile" | "desktop" | "cli"; claimedBy: string | null;
                result: SyncResult | null; error: string | null; createdAt: Timestamp; updatedAt: Timestamp }
CreateSyncRequest = { kind: SyncRequestKind; paths?: string[] (1–5000); force?: boolean; source?: "mobile" | "desktop" | "cli" }
ClaimSyncRequest  = { host: string }
CompleteSyncRequest = { status: "applied" | "failed"; result?: SyncResult; error?: string }
SyncAck       = { changes: { path: string; sha256: string | null; executable?: boolean }[] }
SyncHeartbeat = { host: string; projects: ProjectId[] /* projects linked on this host */ }
```

Event on `/v1/events`: `{ type: "sync.updated", request: SyncRequest }` and
`{ type: "sync.changed", projectId }` (baseline moved: after push or ack).

## 3. REST (controller)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/projects/:id/sync/changes` | — | `SyncChanges` (404 unknown project) |
| POST | `/v1/projects/:id/sync/export` | `{ paths: string[] }` (1–5000, each must be a current `added`/`modified` change) | `200 application/gzip` tar of those files' current content (`--no-same-owner` safe: regular files and symlinks only, no absolute or `..` entries); 400 for a path that is not a current change |
| POST | `/v1/projects/:id/sync/ack` | `SyncAck` | `200 SyncChanges`; publishes `sync.changed` |
| GET | `/v1/projects/:id/sync/requests` | — | `SyncRequest[]` newest first (last 50) |
| POST | `/v1/projects/:id/sync/requests` | `CreateSyncRequest` | `201 SyncRequest`; 409 if a `pending`/`claimed` request exists for the project; 400 for `pull` when `baselineAt` is null; publishes `sync.updated` |
| GET | `/v1/sync/requests?status=pending` | — | `SyncRequest[]` across projects (the desktop poll) |
| POST | `/v1/sync/requests/:id/claim` | `ClaimSyncRequest` | `200 SyncRequest` (`claimed`); 409 unless `pending` |
| POST | `/v1/sync/requests/:id/complete` | `CompleteSyncRequest` | `200 SyncRequest`; 409 unless `claimed` |
| POST | `/v1/sync/requests/:id/cancel` | — | `200 SyncRequest` (`cancelled`); 409 unless `pending` |
| POST | `/v1/sync/heartbeat` | `SyncHeartbeat` | `204`; remembers the host per project for `SyncChanges.host` |

A request `claimed` for more than 10 minutes without completing is failed by the
controller with `error: "The desktop companion stopped responding"`.
Requests are persisted in the controller database (newest 500 kept).

## 4. Host side (`apps/desktop`, Python)

State lives in `$XDG_STATE_HOME/monolith` (default `~/.local/state/monolith`):

- `links.json`: `{ projectId: { hostPath, pushedAt, manifest: {path: sha256} } }`,
  written by every successful `monolith --sync` (the host manifest at push time,
  same file set rules as the push, `.git` excluded).
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
`--sync` (push, now also records the link), `--pull [--dry-run] [--force]`,
`--revert [--force]`, `--sync-status` (changes + snapshots). Exit 0 on success,
1 on error, 2 on conflicts.

The running desktop app sends `SyncHeartbeat` every 20 s, polls
`GET /v1/sync/requests?status=pending` (and reacts to `sync.updated` events),
claims requests for linked projects, applies them with the same engine, completes
them, and shows a desktop notification. Its Projects page shows sync-back
changes, "Sync to host", "Revert last sync" and recent snapshots.

## 5. Mobile

Project screen (`sandbox/projects/[id]`) gets a **Sync to host** group:
changed-file list (A/M/D + path), host status ("Monolith on <host> · online" /
"Desktop companion offline — the request waits until it connects" / "Not linked
— run monolith --sync on your computer"), a primary **Sync to host** button
(confirm sheet listing the files, optional force when the last request failed on
conflicts), **Revert last sync**, and the recent requests with live status from
`sync.updated`. Cancel is available while a request is pending.

The Claude run screen (`sandbox/agent/[id]`) has a **Sync to host** header
action next to Reload / Stop run when the run has a project: one tap queues a
pull of all listed changes (no confirm sheet; the snapshot makes it revertable
from the project screen). It is disabled with a reason while nothing can be
synced (never pushed, host up to date, a request already active), refreshes
the changes when the run finishes (and every 15 s while it runs), and shows a
notice that follows the request via `sync.updated`: queued (with the offline /
not-linked warning), applying, applied counts, or the error and conflicts.
