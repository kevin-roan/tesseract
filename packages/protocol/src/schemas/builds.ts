import { z } from "zod";
import { BUILD_PROFILES, BUILD_STATES, SHA256_PATTERN } from "../constants";
import { ArtifactIdSchema, BuildIdSchema, ByteCountSchema, ProjectIdSchema, TimestampSchema } from "./primitives";
import { BuildTargetSchema } from "./projects";

export const BuildProfileSchema = z.enum(BUILD_PROFILES);
export type BuildProfile = z.infer<typeof BuildProfileSchema>;

export const BuildStateSchema = z.enum(BUILD_STATES);
export type BuildState = z.infer<typeof BuildStateSchema>;

export const ArtifactSchema = z.object({
  id: ArtifactIdSchema,
  projectId: ProjectIdSchema,
  buildId: BuildIdSchema.nullable(),
  fileName: z.string().min(1),
  path: z.string().min(1),
  sizeBytes: ByteCountSchema,
  sha256: z.string().regex(SHA256_PATTERN, "Invalid sha256"),
  platform: z.string(),
  createdAt: TimestampSchema,
});
export type Artifact = z.infer<typeof ArtifactSchema>;

/** `progress` is a fraction in [0, 1] when known. `stage` is usually one of BUILD_STAGES. */
export const BuildJobSchema = z.object({
  id: BuildIdSchema,
  projectId: ProjectIdSchema,
  target: BuildTargetSchema,
  profile: BuildProfileSchema,
  state: BuildStateSchema,
  stage: z.string().nullable(),
  progress: z.number().min(0).max(1).nullable(),
  startedAt: TimestampSchema.nullable(),
  endedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  artifacts: z.array(ArtifactSchema),
  error: z.string().nullable(),
});
export type BuildJob = z.infer<typeof BuildJobSchema>;

/** `profile` defaults to "debug" on the controller when omitted. */
export const StartBuildSchema = z.object({
  projectId: ProjectIdSchema,
  target: BuildTargetSchema,
  profile: BuildProfileSchema.optional(),
});
export type StartBuild = z.infer<typeof StartBuildSchema>;
