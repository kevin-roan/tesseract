import { z } from "zod";
import { AGENT_RUN_MODES, AGENT_RUN_STATES, AGENT_SESSION_ID_PATTERN, LIMITS } from "../constants";
import { AgentRunIdSchema, ProjectIdSchema, SequenceSchema, TimestampSchema, UploadIdSchema } from "./primitives";
import { UploadSchema } from "./uploads";

export const AgentRunStateSchema = z.enum(AGENT_RUN_STATES);
export type AgentRunState = z.infer<typeof AgentRunStateSchema>;

export const AgentRunModeSchema = z.enum(AGENT_RUN_MODES);
export type AgentRunMode = z.infer<typeof AgentRunModeSchema>;

const TokenCountSchema = z.number().int().nonnegative();

/** Token usage reported by the `result` message of a `claude -p` run. */
export const AgentRunUsageSchema = z.object({
  inputTokens: TokenCountSchema,
  outputTokens: TokenCountSchema,
  cacheReadTokens: TokenCountSchema,
  cacheWriteTokens: TokenCountSchema,
  /** input + output + cache read + cache write. */
  totalTokens: TokenCountSchema,
});
export type AgentRunUsage = z.infer<typeof AgentRunUsageSchema>;

export const AgentRunSchema = z.object({
  id: AgentRunIdSchema,
  projectId: ProjectIdSchema.nullable(),
  prompt: z.string(),
  /** Permission mode the run was started with; null means the controller default (`THEONE_CLAUDE_PERMISSION_MODE`). */
  mode: AgentRunModeSchema.nullable().default(null),
  attachments: z.array(UploadSchema).default([]),
  sessionId: z.string().nullable(),
  /** Claude account the run used (its config dir holds the session); older runs have null (the primary account). */
  claudeAccountId: z.string().nullable().default(null),
  state: AgentRunStateSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
  /** Tokens used, from Claude's `result` message; null until the run ends (or when Claude reported none). */
  usage: AgentRunUsageSchema.nullable(),
  result: z.string().nullable(),
  error: z.string().nullable(),
  /** Set while the run is archived; running runs are never archived. */
  archivedAt: TimestampSchema.nullable(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

const eventBase = { seq: SequenceSchema, ts: TimestampSchema };

export const AgentRunTextEventSchema = z.object({ kind: z.literal("text"), ...eventBase, text: z.string() });
export const AgentRunToolUseEventSchema = z.object({
  kind: z.literal("tool_use"),
  ...eventBase,
  tool: z.string(),
  summary: z.string(),
});
export const AgentRunToolResultEventSchema = z.object({
  kind: z.literal("tool_result"),
  ...eventBase,
  tool: z.string().nullable(),
  isError: z.boolean(),
  summary: z.string(),
});
export const AgentRunSystemEventSchema = z.object({ kind: z.literal("system"), ...eventBase, text: z.string() });

export const AgentRunEventSchema = z.discriminatedUnion("kind", [
  AgentRunTextEventSchema,
  AgentRunToolUseEventSchema,
  AgentRunToolResultEventSchema,
  AgentRunSystemEventSchema,
]);
export type AgentRunEvent = z.infer<typeof AgentRunEventSchema>;
export type AgentRunEventKind = AgentRunEvent["kind"];

export const AgentRunDetailSchema = AgentRunSchema.extend({
  events: z.array(AgentRunEventSchema),
});
export type AgentRunDetail = z.infer<typeof AgentRunDetailSchema>;

export const StartAgentRunSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  prompt: z.string().trim().min(1).max(LIMITS.maxPromptLength),
  mode: AgentRunModeSchema.optional(),
  /** Uploads (see `POST /v1/uploads`) Claude should read; their sandbox paths are appended to the prompt. */
  attachmentIds: z.array(UploadIdSchema).max(LIMITS.maxRunAttachments).optional(),
  resumeSessionId: z
    .string()
    .trim()
    .regex(AGENT_SESSION_ID_PATTERN, "Must be a Claude session id (letters, digits, '.', '_' or '-', starting with a letter or digit)")
    .optional(),
});
export type StartAgentRun = z.infer<typeof StartAgentRunSchema>;

export const AgentRunQuerySchema = z.object({
  projectId: ProjectIdSchema.optional(),
  archived: z.enum(["1", "0", "true", "false"]).optional(),
});
export type AgentRunQuery = z.infer<typeof AgentRunQuerySchema>;

const agentRunIds = z.array(AgentRunIdSchema).min(1).max(LIMITS.maxAgentRunBatch);

/** Either `ids` or `all: true` (every finished run, optionally of one project). Running runs are skipped. */
export const ArchiveAgentRunsSchema = z.union([
  z.object({ ids: agentRunIds, archived: z.boolean() }),
  z.object({ all: z.literal(true), archived: z.boolean(), projectId: ProjectIdSchema.optional() }),
]);
export type ArchiveAgentRuns = z.infer<typeof ArchiveAgentRunsSchema>;

/** Either `ids` or `all: true`; `archived` narrows `all` to archived (`true`) or non-archived (`false`) runs. Running runs are skipped. */
export const DeleteAgentRunsSchema = z.union([
  z.object({ ids: agentRunIds }),
  z.object({ all: z.literal(true), projectId: ProjectIdSchema.optional(), archived: z.boolean().optional() }),
]);
export type DeleteAgentRuns = z.infer<typeof DeleteAgentRunsSchema>;

export const AgentRunBatchResultSchema = z.object({ count: z.int().nonnegative() });
export type AgentRunBatchResult = z.infer<typeof AgentRunBatchResultSchema>;

export const StatusEventSchema = z.object({
  project: z.string().trim().min(1).max(128).nullable(),
  status: z.string().trim().min(1).max(64),
  platform: z.string().trim().min(1).max(64).optional(),
  stage: z.string().trim().min(1).max(64).optional(),
  message: z.string().max(LIMITS.maxStatusMessageLength),
  ts: TimestampSchema,
});
export type StatusEvent = z.infer<typeof StatusEventSchema>;

export const StatusEventInputSchema = StatusEventSchema.omit({ ts: true });
export type StatusEventInput = z.infer<typeof StatusEventInputSchema>;
