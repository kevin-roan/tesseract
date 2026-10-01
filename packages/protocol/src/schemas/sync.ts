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

/** POSIX path relative to the project root: no leading `/`, no `..`/`.`/empty segments, no backslashes, never inside `.git`. */
export const SyncPathSchema = z.string().refine(isSafeSyncPath, "Invalid sync path");
export type SyncPath = z.infer<typeof SyncPathSchema>;

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
});
export type SyncChanges = z.infer<typeof SyncChangesSchema>;

export const SyncRequestKindSchema = z.enum(SYNC_REQUEST_KINDS);
export type SyncRequestKind = z.infer<typeof SyncRequestKindSchema>;

export const SyncRequestStatusSchema = z.enum(SYNC_REQUEST_STATUSES);
export type SyncRequestStatus = z.infer<typeof SyncRequestStatusSchema>;

export const SyncRequestSourceSchema = z.enum(SYNC_REQUEST_SOURCES);
export type SyncRequestSource = z.infer<typeof SyncRequestSourceSchema>;

export const SyncResultSchema = z.object({
  added: z.int().nonnegative(),
  modified: z.int().nonnegative(),
  deleted: z.int().nonnegative(),
  conflicts: z.array(z.string()),
  snapshotId: z.string().nullable(),
  hostPath: z.string().nullable(),
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

export const SyncHeartbeatSchema = z.object({
  host: SyncHostNameSchema,
  projects: z.array(ProjectIdSchema).max(LIMITS.maxSyncPaths),
});
export type SyncHeartbeat = z.infer<typeof SyncHeartbeatSchema>;

export const SyncRequestsQuerySchema = z.object({ status: SyncRequestStatusSchema.optional() });
export type SyncRequestsQuery = z.infer<typeof SyncRequestsQuerySchema>;
