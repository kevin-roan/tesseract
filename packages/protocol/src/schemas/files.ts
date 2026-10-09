import { z } from "zod";
import { ByteCountSchema, ProjectIdSchema, TimestampSchema } from "./primitives";

export const PROJECT_FILE_KINDS = ["dir", "file", "symlink", "other"] as const;
export const ProjectFileKindSchema = z.enum(PROJECT_FILE_KINDS);
export type ProjectFileKind = z.infer<typeof ProjectFileKindSchema>;

/** `path` is relative to the project root and uses `/`; symlinks resolving inside the project take their target's kind, others stay `symlink`. `sizeBytes` is null except for files. */
export const ProjectFileSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  kind: ProjectFileKindSchema,
  sizeBytes: ByteCountSchema.nullable(),
  modifiedAt: TimestampSchema.nullable(),
});
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

/** One directory of a project (`GET /v1/projects/:id/files?path=`); `path` is "" at the root. Directories come first. */
export const ProjectDirectorySchema = z.object({
  projectId: ProjectIdSchema,
  path: z.string(),
  entries: z.array(ProjectFileSchema),
  truncated: z.boolean(),
});
export type ProjectDirectory = z.infer<typeof ProjectDirectorySchema>;

export const ProjectPathQuerySchema = z.object({
  path: z.string().max(4096).default(""),
});
export type ProjectPathQuery = z.infer<typeof ProjectPathQuerySchema>;

export const ProjectFileQuerySchema = z.object({
  path: z.string().min(1).max(4096),
});
export type ProjectFileQuery = z.infer<typeof ProjectFileQuerySchema>;

export const SendProjectFileSchema = z.object({
  path: z.string().min(1).max(4096),
  targetId: z.string().min(1).max(256),
});
export type SendProjectFile = z.infer<typeof SendProjectFileSchema>;

/** Regenerable data a project accumulates; everything else in the folder counts as `sourceBytes` and is never cleared. */
export const STORAGE_CATEGORIES = ["dependencies", "builds", "caches"] as const;
export const StorageCategorySchema = z.enum(STORAGE_CATEGORIES);
export type StorageCategory = z.infer<typeof StorageCategorySchema>;

export const StorageEntrySchema = z.object({
  category: StorageCategorySchema,
  sizeBytes: ByteCountSchema,
  /** Folders, relative to the project, that clearing the category removes. */
  paths: z.array(z.string()),
});
export type StorageEntry = z.infer<typeof StorageEntrySchema>;

/** `GET /v1/projects/:id/storage`: disk usage of the project folder, `.git` included. */
export const ProjectStorageSchema = z.object({
  projectId: ProjectIdSchema,
  totalBytes: ByteCountSchema,
  sourceBytes: ByteCountSchema,
  entries: z.array(StorageEntrySchema),
  measuredAt: TimestampSchema,
});
export type ProjectStorage = z.infer<typeof ProjectStorageSchema>;

/** Omitted `categories` clears every category. */
export const ClearProjectStorageSchema = z.object({
  categories: z.array(StorageCategorySchema).min(1).optional(),
});
export type ClearProjectStorage = z.infer<typeof ClearProjectStorageSchema>;
