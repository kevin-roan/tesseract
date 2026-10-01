import { z } from "zod";
import { ARTIFACT_SOURCES, BUILD_PROFILES, BUILD_STATES, LIMITS, SHA256_PATTERN } from "../constants";
import { AgentRunIdSchema, ArtifactIdSchema, BuildIdSchema, ByteCountSchema, ProjectIdSchema, TimestampSchema } from "./primitives";
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
  source: z.enum(ARTIFACT_SOURCES),
  agentRunId: AgentRunIdSchema.nullable(),
  note: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type Artifact = z.infer<typeof ArtifactSchema>;
export type ArtifactSource = Artifact["source"];

/**
 * `POST /v1/artifacts`: copy a sandbox file into the artifacts directory, index it and post a `file`
 * inbox item. `projectId` defaults to the project containing `path`.
 */
export const ShareArtifactSchema = z.object({
  path: z.string().min(1).max(4096).startsWith("/"),
  projectId: ProjectIdSchema.optional(),
  name: z.string().min(1).max(255).regex(/^[^/\\\0]+$/, "Invalid file name").optional(),
  note: z.string().max(LIMITS.maxArtifactNoteLength).optional(),
  agentRunId: AgentRunIdSchema.optional(),
  sessionId: z.string().max(256).optional(),
});
export type ShareArtifact = z.infer<typeof ShareArtifactSchema>;

/** A tailnet device that accepts Taildrop files (`/localapi/v0/file-targets`). */
export const TaildropTargetSchema = z.object({
  id: z.string().min(1),
  hostName: z.string(),
  dnsName: z.string().nullable(),
  os: z.string().nullable(),
  online: z.boolean(),
});
export type TaildropTarget = z.infer<typeof TaildropTargetSchema>;

/** `available: false` when the LocalAPI socket is not shared with the sandbox. */
export const TaildropTargetsSchema = z.object({
  available: z.boolean(),
  targets: z.array(TaildropTargetSchema),
});
export type TaildropTargets = z.infer<typeof TaildropTargetsSchema>;

export const SendArtifactSchema = z.object({ targetId: z.string().min(1).max(256) });
export type SendArtifact = z.infer<typeof SendArtifactSchema>;

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
