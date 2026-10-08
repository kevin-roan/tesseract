import { z } from "zod";
import { INBOX_KINDS, LIMITS } from "../constants";
import { AgentRunIdSchema, ArtifactIdSchema, InboxIdSchema, ProjectIdSchema, TerminalIdSchema, TimestampSchema } from "./primitives";

export const InboxKindSchema = z.enum(INBOX_KINDS);
export type InboxKind = z.infer<typeof InboxKindSchema>;

/**
 * Something that happened in the sandbox the user should see. `needs_input` and `permission` mean
 * Claude is blocked on a human; `file` announces a shared artifact; the rest are informational.
 */
export const InboxItemSchema = z.object({
  id: InboxIdSchema,
  kind: InboxKindSchema,
  title: z.string(),
  body: z.string(),
  projectId: ProjectIdSchema.nullable(),
  sessionId: z.string().nullable(),
  agentRunId: AgentRunIdSchema.nullable(),
  terminalId: TerminalIdSchema.nullable(),
  /** Set on `file` items: the shared artifact to download. */
  artifactId: ArtifactIdSchema.nullable(),
  createdAt: TimestampSchema,
  /** Bumped when a repeat of the same unread item (same kind + session) arrives instead of adding a new one. */
  updatedAt: TimestampSchema,
  readAt: TimestampSchema.nullable(),
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

export const InboxSchema = z.object({
  /** Newest `updatedAt` first. */
  items: z.array(InboxItemSchema),
  unreadCount: z.int().nonnegative(),
  /** Unread items of kind `needs_input` or `permission`. */
  attentionCount: z.int().nonnegative(),
});
export type Inbox = z.infer<typeof InboxSchema>;

export const InboxQuerySchema = z.object({
  limit: z.coerce.number<string | number | undefined>().int().min(1).max(LIMITS.maxInboxList).optional(),
  unread: z.enum(["1", "0", "true", "false"]).optional(),
});
export type InboxQuery = z.infer<typeof InboxQuerySchema>;

/** Either `ids` or `all: true`. */
export const MarkInboxReadSchema = z.union([
  z.object({ ids: z.array(InboxIdSchema).min(1).max(LIMITS.maxInboxList) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkInboxRead = z.infer<typeof MarkInboxReadSchema>;

export const InboxCountsSchema = InboxSchema.pick({ unreadCount: true, attentionCount: true });
export type InboxCounts = z.infer<typeof InboxCountsSchema>;

/**
 * The JSON Claude Code passes to a hook on stdin (`Notification`, `Stop`, …), forwarded as-is by
 * `tesseract-controller hook`. Only the fields the controller reads are declared; the rest pass through.
 */
export const ClaudeHookPayloadSchema = z.looseObject({
  hook_event_name: z.string().min(1).max(64),
  session_id: z.string().max(256).optional(),
  cwd: z.string().max(4096).optional(),
  transcript_path: z.string().max(4096).optional(),
  message: z.string().max(LIMITS.maxStatusMessageLength).optional(),
  notification_type: z.string().max(64).optional(),
  title: z.string().max(256).optional(),
});
export type ClaudeHookPayload = z.infer<typeof ClaudeHookPayloadSchema>;
