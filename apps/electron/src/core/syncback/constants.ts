export const SYNC_STATE = {
  linksFile: "links.json",
  snapshotsDir: "snapshots",
  snapshotFile: "snapshot.json",
  filesDir: "files",
  displacedDir: "displaced",
  locksDir: "locks",
  keepSnapshots: 20,
  redacted: "REDACTED",
} as const;

export const LINKS_LOCK = ".links";
export const LOCK_SUFFIX = ".lock";
export const TMP_PREFIX = ".tesseract-sync-";
export const PULL_TEMP_PREFIX = "tesseract-pull-";
export const PUSH_TEMP_PREFIX = "tesseract-push-";
export const GET_TEMP_PREFIX = "tesseract-get-";
export const DIFF_TEMP_PREFIX = "tesseract-diff-";

export const DIR_MODE = 0o700;
export const STATE_FILE_MODE = 0o600;
export const DEFAULT_FILE_MODE = 0o644;
export const STAGED_MIN_MODE = 0o600;
export const PERMISSION_BITS = 0o7777;
export const ACCESS_BITS = 0o777;
export const EXEC_BITS = 0o111;
export const READ_BITS = 0o444;

export const GIT_DIR = ".git";
export const GIT_EXECUTABLE_MODE = "100755";
export const PORTABLE_FILE_MODE = 0o644;
export const PORTABLE_EXEC_MODE = 0o755;
export const SYMLINK_MODE = 0o777;
export const SKIPPED_DIRS: readonly string[] = [GIT_DIR, "node_modules"];
export const HASH_CHUNK_BYTES = 1024 * 1024;
export const COPY_CHUNK_BYTES = 1024 * 1024;

export const CHANGE_KINDS = ["added", "modified", "deleted"] as const;
export const KIND_CODES: Record<string, string> = { added: "A", modified: "M", deleted: "D" };
export const UNKNOWN_KIND_CODE = "?";
export const MAX_LISTED = 50;
export const CONFLICT_PREVIEW = 5;

export const MAX_GET_CHANGES = 5000;
export const MAX_GET_GIT_PATHS = 200_000;

export const SYNC_TIMEOUT_MS = 600_000;
export const GIT_LIST_TIMEOUT_MS = 120_000;
export const HOST_GIT_TIMEOUT_MS = 300_000;
export const HOST_GIT_ARGS = { pull: ["pull", "--ff-only"], push: ["push"], stage: ["add", "--all"] } as const;
export const HOST_GIT_ENV = { GIT_TERMINAL_PROMPT: "0", GIT_MERGE_AUTOEDIT: "no" } as const;
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const CONFIG_POLL_MS = 5_000;
export const SEEN_LIMIT = 500;
export const NOTIFIED_KINDS = ["pull", "revert", "get"] as const;

export const MAX_PREVIEW_BYTES = 1024 * 1024;
export const MAX_DIFF_LINES = 4000;
export const CONTEXT_LINES = 3;
export const BINARY_SNIFF_BYTES = 8192;

export const LOCK_POLL_MIN_MS = 25;
export const LOCK_POLL_MAX_MS = 500;
export const LOCK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const BOOT_SLACK_MS = 60_000;
export const STALE_LOCK_SUFFIX = ".stale";
export const RENAME_RETRY_DELAYS_MS: readonly number[] = [50, 100, 200];

export const EXIT = { ok: 0, error: 1, conflict: 2 } as const;
export const DESKTOP_SOURCE = "desktop" as const;
export const GZIP_MIME_TYPE = "application/gzip";
export const CONFLICT_STATUS = 409;
