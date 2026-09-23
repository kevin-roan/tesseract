import { z } from "zod";
import { AGENT_RUN_STATES, AGENT_SESSION_ID_PATTERN, LIMITS } from "../constants";
import { AgentRunIdSchema, ProjectIdSchema, SequenceSchema, TimestampSchema } from "./primitives";

export const AgentRunStateSchema = z.enum(AGENT_RUN_STATES);
export type AgentRunState = z.infer<typeof AgentRunStateSchema>;

export const AgentRunSchema = z.object({
  id: AgentRunIdSchema,
  projectId: ProjectIdSchema.nullable(),
  prompt: z.string(),
  sessionId: z.string().nullable(),
  state: AgentRunStateSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
  costUsd: z.number().nonnegative().nullable(),
  result: z.string().nullable(),
  error: z.string().nullable(),
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
  resumeSessionId: z
    .string()
    .trim()
    .regex(AGENT_SESSION_ID_PATTERN, "Must be a Claude session id (letters, digits, '.', '_' or '-', starting with a letter or digit)")
    .optional(),
});
export type StartAgentRun = z.infer<typeof StartAgentRunSchema>;

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
