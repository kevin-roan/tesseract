const repr = (value: unknown) => `'${String(value)}'`;

export const UNDO_HINT = "undo with tesseract --revert";

export const SYNC_LABELS = {
  unsafePath: (rel: unknown) => `Refusing unsafe path ${repr(rel)}`,
  absolutePath: (rel: string) => `Refusing absolute path ${repr(rel)}`,
  plainPath: (rel: string) => `Refusing path ${repr(rel)}: it must be a plain relative path`,
  insideGit: (rel: string) => `Refusing to write inside .git: ${repr(rel)}`,
  leavesRoot: (rel: string, root: string) => `Refusing path ${repr(rel)}: it leaves ${root}`,
  windowsName: (rel: string) => `Refusing path ${repr(rel)}: it is not a valid file name on this computer`,
  commitMessageRequired: "Write a commit message",
  symlinkUnsupported: (rel: string) => `Cannot create the symlink ${rel}: this computer does not allow it`,

  notLinked: (id: string) => `${id} is not linked on this computer. Run tesseract --sync in the checkout first`,
  hostMissing: (path: string) => `${path} no longer exists. Run tesseract --sync in the checkout again`,
  neverPushed: (id: string) => `${id} was never pushed. Run tesseract --sync in the checkout first`,
  unknownKind: (kind: unknown, path: string) => `Unknown change kind ${repr(kind)} for ${path}`,
  conflictPull: (count: number, preview: string) =>
    `${count} file${count !== 1 ? "s" : ""} changed on the host since the last push: ${preview}`,
  conflictRevert: (count: number, preview: string) =>
    `${count} file${count !== 1 ? "s" : ""} changed on the host since that sync: ${preview}`,
  ackFailed: (error: string) =>
    `The files were written, but the sandbox did not record it (${error}); they may be offered again`,
  snapshotFailed: (error: string) => `Could not save the snapshot, nothing was written: ${error}`,
  rollbackIncomplete: (cause: string, problems: string, directory: string) =>
    `Sync failed (${cause}) and the rollback was incomplete (${problems}). Copies of the original files are in ${directory}`,
  rollbackDone: (cause: string) => `Sync failed, nothing was changed: ${cause}`,

  unreadableArchive: (error: string) => `The sandbox sent an unreadable archive: ${error}`,
  unexpectedFile: (name: string) => `The sandbox sent an unexpected file: ${name}`,
  duplicateFile: (name: string) => `The sandbox sent ${name} twice`,
  symlinkOutside: (name: string, link: string) => `Refusing symlink ${name} -> ${link}: it points outside the project`,
  nestedPath: (name: string, parent: string) => `Refusing ${name}: ${parent} is a file in the same change`,
  memberUnreadable: (name: string) => `Could not read ${name} from the archive`,
  memberType: (name: string) => `Refusing ${name}: only regular files and symlinks can be synced`,
  archiveMissing: (names: string) => `The sandbox archive is missing ${names}`,
  unexpectedEnd: "unexpected end of data",
  badChecksum: "bad checksum",
  emptyArchive: "empty file",

  nothingToRevert: (id: string) => `There is no sync to revert for ${id}`,
  revertRootMissing: (root: string) => `${root} no longer exists`,
  baselineUnreachable: "The sandbox was not reachable, so it will not offer the reverted changes again",
  baselineFailed: (error: string) =>
    `The sandbox did not record the revert (${error}); it will not offer those changes again`,

  tooMany: (what: string, root: string) =>
    `Too many ${what} changed on the host for a get. Run tesseract --sync in ${root} instead`,
  tooManyFiles: "files",
  tooManyGitFiles: ".git files",
  unplanned: (what: string, path: string) => `The sandbox asked for an unplanned ${what}: ${path}`,
  unplannedFile: "file",
  unplannedGitFile: ".git file",
  vanished: (name: string) => `${name} changed during the sync, run tesseract --get again`,
  getLeft: (status: string) => `The sandbox left the get ${status}`,
  refused: "The sandbox refused the changes",

  nothingToSync: (where: string) => `Nothing to sync: ${where} already matches the sandbox`,
  wouldPull: (files: string, where: string, counts: string) => `Would pull ${files} into ${where} (${counts})`,
  pulled: (files: string, where: string, counts: string, snapshot: string | null) =>
    `Pulled ${files} into ${where} (${counts}) · snapshot ${snapshot} — ${UNDO_HINT}`,
  revertedSnapshot: (id: string, where: string, counts: string) => `Reverted snapshot ${id} in ${where} (${counts})`,
  revertedLast: (where: string, counts: string) => `Reverted the last sync in ${where} (${counts})`,
  pulledResult: (files: string, where: string, counts: string) => `Pulled ${files} into ${where} (${counts})`,
  sent: (files: string, counts: string) => `Sent ${files} to the sandbox (${counts})`,
  upToDate: "Sandbox already up to date",
  lineCounts: (insertions: unknown, deletions: unknown) => `+${insertions} −${deletions}`,
  gitUpdated: (files: string) => `updated .git (${files})`,
  backupKept: (path: string) => `sandbox edits kept in ${path}`,
  noFiles: "no files",
  noChanges: "no changes",
  summarySeparator: " · ",

  words: {
    file: "file",
    hostEdit: "host edit",
    added: "added",
    modified: "modified",
    deleted: "deleted",
    restored: "restored",
    recreated: "recreated",
    removed: "removed",
  },
} as const;

export const SYNC_BACK_TITLES = {
  pull_done: (project: string) => `Synced ${project} to this computer`,
  pull_failed: (project: string) => `Couldn't sync ${project} to this computer`,
  revert_done: (project: string) => `Reverted the last sync of ${project}`,
  revert_failed: (project: string) => `Couldn't revert the last sync of ${project}`,
  get_done: (project: string) => `Sent ${project} changes to the sandbox`,
  get_failed: (project: string) => `Couldn't send ${project} changes to the sandbox`,
} as const;

export const ERROR_DESCRIPTIONS = {
  auth: "The sandbox rejected this token. Update it in Preferences or rediscover the sandbox.",
  timeout: "The sandbox took too long to answer.",
  network: "Can't reach the sandbox. Check that the stack is running and the URL is reachable from this machine.",
  version: (server: unknown, client: unknown) =>
    `The sandbox speaks protocol v${server} and this app speaks v${client}. Update the app or the sandbox so they match.`,
  protocol: "The controller answered in an unexpected format. Update the app or the sandbox so their versions match.",
  notConfigured: "No sandbox is configured yet. Open Preferences to discover it or enter its URL and token.",
  fallback: "Something went wrong.",
} as const;

export const DIFF_LABELS = {
  tooLarge: (size: number) => `${size} bytes`,
} as const;

export const CLI_SYNC_LABELS = {
  prefix: (message: string) => `tesseract: ${message}`,
  noSandbox: (error: string) => `tesseract: no sandbox found: ${error}`,
  notConnected: "tesseract: no sandbox to sync with; open the app and connect first",
  sealedToken: (error: string, urlVar: string, tokenVar: string) =>
    `tesseract: the app keeps the sandbox token in the system keychain, which this command cannot read, and no local sandbox was found (${error}). Set ${urlVar} and ${tokenVar} to sync with a remote sandbox`,
  cannotDerive: (name: string) => `tesseract: cannot derive a project id from ${repr(name)}`,
  syncing: (root: string, id: string, confidential: boolean, label: string) =>
    `Syncing ${root} to ${id}${confidential ? " (confidential)" : ""} on ${label}…`,
  syncFailed: (error: string) => `tesseract: sync failed: ${error}`,
  linkFailed: (error: string) => `tesseract: pushed, but could not record the link for sync back: ${error}`,
  pushed: (created: boolean, path: string, count: number) =>
    `${created ? "Created" : "Updated"} ${path} (${count} entries) · linked for sync back`,
  replaced: (id: string) =>
    `tesseract: the earlier copy ${id} is still in the sandbox under its real name and is no longer linked; remove it there with: rm -rf /workspace/projects/${id}`,
  linkedElsewhere: (id: string, existing: string, root: string) =>
    `${id} is linked to ${existing}, not ${root}. Run tesseract --sync here to relink it`,
  listed: (path: string) => `  ${path}`,
  more: (count: number) => `  … and ${count} more`,
  conflictHeader: (files: string, action: string) => `tesseract: ${files} changed on the host since the last ${action}:`,
  conflictPush: "Nothing was written. Re-run with --force to overwrite them (a snapshot is still taken).",
  conflictSync: "Nothing was reverted. Re-run with --force to revert anyway (copies of those host edits are kept).",
  pullFailed: (error: string) => `tesseract: pull failed: ${error}`,
  revertFailed: (error: string) => `tesseract: revert failed: ${error}`,
  planRow: (code: string, path: string, conflict: boolean) => `  ${code} ${path}${conflict ? "  (changed on host)" : ""}`,
  overwrotePull: (edits: string) => `Overwrote ${edits} (--force); the originals are in the snapshot`,
  overwroteRevert: (edits: string, dir: string | null) => `Overwrote ${edits} (--force); copies are in ${dir}`,
  warning: (message: string) => `tesseract: warning: ${message}`,
  revertAgain: (id: string) => `Run tesseract --revert again to undo snapshot ${id} too`,
  status: (id: string, path: string, pushedAt: string, gotAt: string | null) =>
    `${id} ↔ ${path} · pushed ${pushedAt || "never"} · got ${gotAt || "never"}`,
  noBaseline: "The sandbox has no push baseline yet; run tesseract --sync",
  noChanges: "No sandbox changes to pull",
  changesHeader: (count: number) => `Sandbox changes (${count}):`,
  pullHint: "Run tesseract --pull to copy them here",
  changesFailed: (error: string) => `tesseract: could not read sandbox changes: ${error}`,
  snapshotsHeader: (count: number) => `Snapshots (${count}):`,
  noSnapshots: "No snapshots yet",
  snapshotRow: (id: string, files: string, reverted: boolean) => `  ${id}  ${files}${reverted ? "  reverted" : ""}`,
  actionPush: "push",
  actionSync: "sync",
} as const;
