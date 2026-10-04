import { z } from "zod";
import { CLAUDE_SESSION_SOURCES, LIMITS } from "../constants";
import { AgentRunIdSchema, ProjectIdSchema, TerminalIdSchema, TimestampSchema } from "./primitives";

const CountSchema = z.int().nonnegative();

/** Token counts summed from Claude Code transcripts (`~/.claude/projects/**\/*.jsonl`). */
export const TokenUsageSchema = z.object({
  inputTokens: CountSchema,
  outputTokens: CountSchema,
  cacheReadTokens: CountSchema,
  cacheWriteTokens: CountSchema,
  /** input + output + cache read + cache write. */
  totalTokens: CountSchema,
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const UsageTotalsSchema = TokenUsageSchema.extend({
  /** Assistant messages with a real model (synthetic messages are skipped). */
  messages: CountSchema,
  sessions: CountSchema,
});
export type UsageTotals = z.infer<typeof UsageTotalsSchema>;

export const UsageDaySchema = UsageTotalsSchema.extend({
  /** UTC calendar day, `YYYY-MM-DD`. Every day of the range is present, zero-filled. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type UsageDay = z.infer<typeof UsageDaySchema>;

export const UsageByModelSchema = TokenUsageSchema.extend({ model: z.string(), messages: CountSchema });
export type UsageByModel = z.infer<typeof UsageByModelSchema>;

export const UsageByProjectSchema = TokenUsageSchema.extend({
  /** Null for sessions outside the projects directory. */
  projectId: ProjectIdSchema.nullable(),
  messages: CountSchema,
  sessions: CountSchema,
});
export type UsageByProject = z.infer<typeof UsageByProjectSchema>;

export const UsageReportSchema = z.object({
  generatedAt: TimestampSchema,
  from: TimestampSchema,
  to: TimestampSchema,
  days: z.int().min(1).max(LIMITS.maxUsageDays),
  totals: UsageTotalsSchema,
  /** Oldest first. */
  daily: z.array(UsageDaySchema),
  /** Most tokens first. */
  models: z.array(UsageByModelSchema),
  /** Most tokens first. */
  projects: z.array(UsageByProjectSchema),
});
export type UsageReport = z.infer<typeof UsageReportSchema>;

export const UsageQuerySchema = z.object({
  days: z.coerce.number<string | number | undefined>().int().min(1).max(LIMITS.maxUsageDays).optional(),
});
export type UsageQuery = z.infer<typeof UsageQuerySchema>;

export const ClaudeSessionSourceSchema = z.enum(CLAUDE_SESSION_SOURCES);
export type ClaudeSessionSource = z.infer<typeof ClaudeSessionSourceSchema>;

/** One Claude Code conversation (a transcript file), the unit of the app's chat list. */
export const ClaudeSessionSchema = z.object({
  sessionId: z.string(),
  /** Claude account whose config dir holds the transcript. */
  claudeAccountId: z.string().default("claude"),
  projectId: ProjectIdSchema.nullable(),
  cwd: z.string().nullable(),
  /** First real user prompt, trimmed to one line and at most 120 characters; null when there is none yet. */
  title: z.string().nullable(),
  /** Last assistant text, one line, at most 160 characters. */
  preview: z.string().nullable(),
  model: z.string().nullable(),
  startedAt: TimestampSchema,
  lastActiveAt: TimestampSchema,
  messages: CountSchema,
  usage: TokenUsageSchema,
  /** `agent-run` when a controller agent run produced it, `terminal` when a live Claude terminal is attached, else `cli`. */
  source: ClaudeSessionSourceSchema,
  /** Newest agent run with this session id, if any. */
  agentRunId: AgentRunIdSchema.nullable(),
  /** Live Claude terminal attached to this session (current controller lifetime), if any. */
  terminalId: TerminalIdSchema.nullable(),
  /** A run or terminal is working on it right now. */
  active: z.boolean(),
});
export type ClaudeSession = z.infer<typeof ClaudeSessionSchema>;

export const SessionsQuerySchema = z.object({
  limit: z.coerce.number<string | number | undefined>().int().min(1).max(LIMITS.maxSessionsList).optional(),
  projectId: ProjectIdSchema.optional(),
});
export type SessionsQuery = z.infer<typeof SessionsQuerySchema>;
