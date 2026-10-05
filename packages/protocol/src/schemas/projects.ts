import { z } from "zod";
import { BUILD_TARGETS, FRAMEWORKS, GIT_REF_PATTERN, GIT_URL_PATTERN, PACKAGE_MANAGERS } from "../constants";
import { projectIdFromName } from "../ids";
import { NameSchema, ProcessIdSchema, ProjectIdSchema, TimestampSchema } from "./primitives";

export const FrameworkSchema = z.enum(FRAMEWORKS);
export type Framework = z.infer<typeof FrameworkSchema>;

export const PackageManagerSchema = z.enum(PACKAGE_MANAGERS);
export type PackageManager = z.infer<typeof PackageManagerSchema>;

export const BuildTargetSchema = z.enum(BUILD_TARGETS);
export type BuildTarget = z.infer<typeof BuildTargetSchema>;

export const GitCommitRefSchema = z.object({
  sha: z.string().min(1),
  subject: z.string(),
  date: TimestampSchema,
});
export type GitCommitRef = z.infer<typeof GitCommitRefSchema>;

export const GitSummarySchema = z.object({
  branch: z.string().nullable(),
  dirty: z.boolean(),
  ahead: z.int().nonnegative(),
  behind: z.int().nonnegative(),
  lastCommit: GitCommitRefSchema.nullable(),
});
export type GitSummary = z.infer<typeof GitSummarySchema>;

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  name: z.string(),
  path: z.string(),
  framework: FrameworkSchema,
  packageManager: PackageManagerSchema.nullable(),
  scripts: z.array(z.string()),
  /** False when package.json declares dependencies but `node_modules` is missing; null when there is nothing to install. Older controllers omit it. */
  dependenciesInstalled: z.boolean().nullable().default(null),
  buildTargets: z.array(BuildTargetSchema),
  git: GitSummarySchema.nullable(),
  /** Controllers older than confidential projects omit it. */
  confidential: z.boolean().default(false),
  /** Claude account pinned to the project; null follows the default. Older controllers omit it. */
  claudeAccountId: z.string().nullable().default(null),
});
export type Project = z.infer<typeof ProjectSchema>;

export const GitFileStatusSchema = z.object({
  path: z.string(),
  index: z.string(),
  worktree: z.string(),
});
export type GitFileStatus = z.infer<typeof GitFileStatusSchema>;

export const GitCommitSchema = z.object({
  sha: z.string().min(1),
  subject: z.string(),
  author: z.string(),
  date: TimestampSchema,
});
export type GitCommit = z.infer<typeof GitCommitSchema>;

export const GitDetailsSchema = z.object({
  branch: z.string().nullable(),
  ahead: z.int().nonnegative(),
  behind: z.int().nonnegative(),
  files: z.array(GitFileStatusSchema),
  log: z.array(GitCommitSchema),
});
export type GitDetails = z.infer<typeof GitDetailsSchema>;

/** `name` becomes the project directory via `projectIdFromName`; the schema rejects names that yield no valid id. */
export const CreateProjectSchema = z.object({
  name: NameSchema.refine((name) => projectIdFromName(name) !== null, "Name must contain letters or digits"),
  gitUrl: z.string().trim().max(2048).regex(GIT_URL_PATTERN, "Unsupported git URL").optional(),
  branch: z.string().trim().regex(GIT_REF_PATTERN, "Invalid branch name").optional(),
  confidential: z.boolean().optional(),
});
export type CreateProject = z.infer<typeof CreateProjectSchema>;

/** `name: null` drops the custom name, so the project falls back to its package.json name or id. */
export const RenameProjectSchema = z.object({ name: NameSchema.nullable() });
export type RenameProject = z.infer<typeof RenameProjectSchema>;

export const CreateProjectResponseSchema = z.object({
  project: ProjectSchema,
  processId: ProcessIdSchema.optional(),
});
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

/** `trashPath`: where the sandbox copy was moved (`DELETE /v1/projects/:id`). */
export const DeletedProjectSchema = z.object({
  id: ProjectIdSchema,
  trashPath: z.string(),
});
export type DeletedProject = z.infer<typeof DeletedProjectSchema>;
