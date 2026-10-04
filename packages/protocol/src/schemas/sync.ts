import { z } from "zod";
import {
  LIMITS,
  SHA256_PATTERN,
  SYNC_CHANGE_KINDS,
  SYNC_REQUEST_KINDS,
  SYNC_REQUEST_SOURCES,
  SYNC_REQUEST_STATUSES,
} from "../constants";
import { ByteCountSchema, ProjectIdSchema, SyncRequestIdSchema, TimestampSchema } from "./primitives";

export function isSafeSyncPath(path: string): boolean {
  if (path.length === 0 || path.length > LIMITS.maxSyncPathLength) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((part) => part !== "" && part !== "." && part !== ".." && part !== ".git");
}

/** POSIX path relative to a project's `.git` directory: no leading `/`, no `..`/`.`/empty segments, no backslashes. */
export function isSafeSyncGitPath(path: string): boolean {
  if (path.length === 0 || path.length > LIMITS.maxSyncPathLength) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

/** POSIX path relative to the project root: no leading `/`, no `..`/`.`/empty segments, no backslashes, never inside `.git`. */
export const SyncPathSchema = z.string().refine(isSafeSyncPath, "Invalid sync path");
export type SyncPath = z.infer<typeof SyncPathSchema>;

export const SyncGitPathSchema = z.string().refine(isSafeSyncGitPath, "Invalid .git path");

export const Sha256Schema = z.string().regex(SHA256_PATTERN, "Invalid sha256");

const SyncPathListSchema = z.array(SyncPathSchema).min(1).max(LIMITS.maxSyncPaths);
const SyncHostNameSchema = z.string().trim().min(1).max(LIMITS.maxSyncHostLength);

export const SyncChangeKindSchema = z.enum(SYNC_CHANGE_KINDS);
export type SyncChangeKind = z.infer<typeof SyncChangeKindSchema>;

export const SyncFileChangeSchema = z.object({
  path: SyncPathSchema,
  kind: SyncChangeKindSchema,
  /** `null` for `deleted`. */
  sha256: Sha256Schema.nullable(),
  size: ByteCountSchema.nullable(),
  /** The controller can restore the baseline version (always for `added`: the file is removed). Absent: unknown, treat as `false`. */
  discardable: z.boolean().optional(),
});
export type SyncFileChange = z.infer<typeof SyncFileChangeSchema>;

export const SyncHostSchema = z.object({
  name: z.string(),
  lastSeenAt: TimestampSchema,
  /** Heartbeat seen within `LIMITS.syncHostOnlineMs`. */
  online: z.boolean(),
  /** The project is linked on this host. */
  linked: z.boolean(),
});
export type SyncHost = z.infer<typeof SyncHostSchema>;

export const SyncChangesSchema = z.object({
  projectId: ProjectIdSchema,
  /** `null`: never pushed, so sync back is unavailable. */
  baselineAt: TimestampSchema.nullable(),
  changes: z.array(SyncFileChangeSchema),
  totalBytes: ByteCountSchema,
  host: SyncHostSchema.nullable(),
  /** Last `get` (host → sandbox) applied; `null` or absent: none since the last push. */
  lastGetAt: TimestampSchema.nullable().optional(),
});
export type SyncChanges = z.infer<typeof SyncChangesSchema>;

export const SyncRequestKindSchema = z.enum(SYNC_REQUEST_KINDS);
export type SyncRequestKind = z.infer<typeof SyncRequestKindSchema>;

export const SyncRequestStatusSchema = z.enum(SYNC_REQUEST_STATUSES);
export type SyncRequestStatus = z.infer<typeof SyncRequestStatusSchema>;

export const SyncRequestSourceSchema = z.enum(SYNC_REQUEST_SOURCES);
export type SyncRequestSource = z.infer<typeof SyncRequestSourceSchema>;

/** Git-style file mode: `100644`, `100755` or `120000` (symlink). */
export const SyncFileModeSchema = z.enum(["100644", "100755", "120000"]);
export type SyncFileMode = z.infer<typeof SyncFileModeSchema>;

/** One file a `get` changed in the sandbox, with `git diff --stat` style line counts. */
export const SyncFileStatSchema = z.object({
  path: SyncPathSchema,
  kind: SyncChangeKindSchema,
  insertions: z.int().nonnegative(),
  deletions: z.int().nonnegative(),
  /** Line counts are 0 for binary (or very large) files; sizes are given instead. */
  binary: z.boolean(),
  oldMode: SyncFileModeSchema.nullable(),
  newMode: SyncFileModeSchema.nullable(),
  oldSize: ByteCountSchema.nullable(),
  newSize: ByteCountSchema.nullable(),
});
export type SyncFileStat = z.infer<typeof SyncFileStatSchema>;

export const SyncResultSchema = z.object({
  added: z.int().nonnegative(),
  modified: z.int().nonnegative(),
  deleted: z.int().nonnegative(),
  conflicts: z.array(z.string()),
  snapshotId: z.string().nullable(),
  hostPath: z.string().nullable(),
  /** `get` only: the files changed in the sandbox, sorted by path. */
  files: z.array(SyncFileStatSchema).max(LIMITS.maxSyncPaths).optional(),
  insertions: z.int().nonnegative().optional(),
  deletions: z.int().nonnegative().optional(),
  /** `get` only: files under `.git` updated or deleted. */
  gitFiles: z.int().nonnegative().optional(),
  /** `get` only: when it was applied, and the previous sync from the host (push or get). */
  syncedAt: TimestampSchema.optional(),
  previousSyncAt: TimestampSchema.nullable().optional(),
  /** `get --force` only: where copies of the overwritten sandbox edits are kept. */
  backupPath: z.string().nullable().optional(),
});
export type SyncResult = z.infer<typeof SyncResultSchema>;

export const SyncRequestSchema = z.object({
  id: SyncRequestIdSchema,
  projectId: ProjectIdSchema,
  kind: SyncRequestKindSchema,
  status: SyncRequestStatusSchema,
  /** Subset to pull; `null` means every change. */
  paths: z.array(SyncPathSchema).nullable(),
  force: z.boolean(),
  source: SyncRequestSourceSchema,
  claimedBy: z.string().nullable(),
  result: SyncResultSchema.nullable(),
  error: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export const SyncRequestListSchema = z.array(SyncRequestSchema);

export const CreateSyncRequestSchema = z.object({
  kind: SyncRequestKindSchema,
  paths: SyncPathListSchema.optional(),
  force: z.boolean().optional(),
  source: SyncRequestSourceSchema.optional(),
});
export type CreateSyncRequest = z.infer<typeof CreateSyncRequestSchema>;

export const ClaimSyncRequestSchema = z.object({ host: SyncHostNameSchema });
export type ClaimSyncRequest = z.infer<typeof ClaimSyncRequestSchema>;

export const CompleteSyncRequestSchema = z.object({
  status: z.enum(["applied", "failed"]),
  result: SyncResultSchema.optional(),
  error: z.string().max(LIMITS.maxStatusMessageLength).optional(),
});
export type CompleteSyncRequest = z.infer<typeof CompleteSyncRequestSchema>;

export const SyncExportSchema = z.object({ paths: SyncPathListSchema });
export type SyncExport = z.infer<typeof SyncExportSchema>;

export const SyncAckSchema = z.object({
  changes: z
    .array(
      z.object({
        path: SyncPathSchema,
        sha256: Sha256Schema.nullable(),
        /** Executable bit the host now has for this file; omitted: take the sandbox file's when its hash matches. */
        executable: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(LIMITS.maxSyncPaths),
});
export type SyncAck = z.infer<typeof SyncAckSchema>;

/** `POST /v1/projects/:id/sync/discard`: put sandbox files back to the baseline (last push / get / ack). */
export const SyncDiscardSchema = z.object({
  /** Subset of current changes; omitted: every change. */
  paths: SyncPathListSchema.optional(),
});
export type SyncDiscard = z.infer<typeof SyncDiscardSchema>;

export const SyncDiscardResultSchema = z.object({
  /** Paths restored to the baseline (`added` ones removed). */
  discarded: z.array(SyncPathSchema),
  /** Paths left as they are because the baseline content is not stored on the controller. */
  unavailable: z.array(SyncPathSchema),
  /** Where copies of the discarded sandbox versions are kept; `null` when nothing was overwritten. */
  backupPath: z.string().nullable(),
  changes: SyncChangesSchema,
});
export type SyncDiscardResult = z.infer<typeof SyncDiscardResultSchema>;

export const SyncGetChangeSchema = z.object({
  path: SyncPathSchema,
  kind: SyncChangeKindSchema,
  /** The host content's sha256 (symlinks: of the target); `null` exactly for `deleted`. */
  sha256: Sha256Schema.nullable(),
  /** Executable bit on the host; `false` for deletes and symlinks. */
  executable: z.boolean(),
});
export type SyncGetChange = z.infer<typeof SyncGetChangeSchema>;

/** `POST /v1/sync/requests/:id/plan`: what changed on the host since the last push or get. */
export const SyncGetPlanSchema = z.object({
  hostPath: z.string().min(1).max(LIMITS.maxSyncPathLength),
  changes: z.array(SyncGetChangeSchema).max(LIMITS.maxSyncPaths),
  /** Files under `.git` (paths relative to it) changed or deleted on the host; `null`: no `.git` on the host. */
  git: z
    .object({
      changed: z.array(SyncGitPathSchema).max(LIMITS.maxSyncGitPaths),
      deleted: z.array(SyncGitPathSchema).max(LIMITS.maxSyncGitPaths),
    })
    .nullable(),
});
export type SyncGetPlan = z.infer<typeof SyncGetPlanSchema>;

export const SyncGetPlanResponseSchema = z.object({
  /** `failed` (with `result.conflicts`) when the plan would overwrite sandbox edits and `force` is off. */
  request: SyncRequestSchema,
  /** Send exactly these files to `apply`, project-relative. */
  upload: z.array(SyncPathSchema),
  /** And these, relative to `.git` (archived as `.git/<path>`). */
  gitUpload: z.array(SyncGitPathSchema),
});
export type SyncGetPlanResponse = z.infer<typeof SyncGetPlanResponseSchema>;

export const SyncHeartbeatSchema = z.object({
  host: SyncHostNameSchema,
  projects: z.array(ProjectIdSchema).max(LIMITS.maxSyncPaths),
});
export type SyncHeartbeat = z.infer<typeof SyncHeartbeatSchema>;

export const SyncRequestsQuerySchema = z.object({ status: SyncRequestStatusSchema.optional() });
export type SyncRequestsQuery = z.infer<typeof SyncRequestsQuerySchema>;
