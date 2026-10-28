import { z } from "zod";
import { ISSUE_ASSIGNEES, ISSUE_COMMENT_AUTHORS, ISSUE_PRIORITIES, ISSUE_STATUSES, LIMITS } from "../constants";
import { AgentRunModeSchema, AgentRunModelSchema, AgentRunStateSchema } from "./agent";
import { AgentRunIdSchema, IssueCommentIdSchema, IssueIdSchema, ProjectIdSchema, TimestampSchema } from "./primitives";

export const IssueStatusSchema = z.enum(ISSUE_STATUSES);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssuePrioritySchema = z.enum(ISSUE_PRIORITIES);
export type IssuePriority = z.infer<typeof IssuePrioritySchema>;

export const IssueAssigneeSchema = z.enum(ISSUE_ASSIGNEES);
export type IssueAssignee = z.infer<typeof IssueAssigneeSchema>;

export const IssueCommentAuthorSchema = z.enum(ISSUE_COMMENT_AUTHORS);
export type IssueCommentAuthor = z.infer<typeof IssueCommentAuthorSchema>;

const IssueTitleSchema = z.string().trim().min(1).max(LIMITS.maxIssueTitleLength);
const IssueDescriptionSchema = z.string().max(LIMITS.maxIssueDescriptionLength);
const IssueLabelsSchema = z
  .array(z.string().trim().min(1).max(LIMITS.maxIssueLabelLength))
  .max(LIMITS.maxIssueLabels)
  .transform((labels) => [...new Set(labels)]);

/** A unit of work in a project, Linear style. Assigning it to `claude` makes the controller work on it. */
export const IssueSchema = z.object({
  id: IssueIdSchema,
  projectId: ProjectIdSchema,
  /** Per-project sequence number, shown as `<PROJECT>-<number>`. */
  number: z.int().positive(),
  title: z.string(),
  /** Markdown. */
  description: z.string(),
  status: IssueStatusSchema,
  priority: IssuePrioritySchema,
  assignee: IssueAssigneeSchema.nullable(),
  labels: z.array(z.string()),
  /** Position inside its status column; lower first. */
  sortOrder: z.number(),
  /** Latest agent run dispatched for this issue. */
  agentRunId: AgentRunIdSchema.nullable(),
  /** State of that run; null without one. */
  agentState: AgentRunStateSchema.nullable(),
  /** Claude session of the latest run; follow-up comments resume it. */
  sessionId: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  /** Set when the issue moved to `done` or `canceled`; cleared when reopened. */
  completedAt: TimestampSchema.nullable(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const IssueListSchema = z.array(IssueSchema);

export const IssueCommentSchema = z.object({
  id: IssueCommentIdSchema,
  issueId: IssueIdSchema,
  author: IssueCommentAuthorSchema,
  /** Markdown. */
  body: z.string(),
  /** Run that wrote this comment (Claude's result or a system note about it). */
  agentRunId: AgentRunIdSchema.nullable(),
  createdAt: TimestampSchema,
});
export type IssueComment = z.infer<typeof IssueCommentSchema>;

/** `GET /v1/issues/:id`: the issue with its activity, oldest comment first. */
export const IssueDetailSchema = IssueSchema.extend({ comments: z.array(IssueCommentSchema) });
export type IssueDetail = z.infer<typeof IssueDetailSchema>;

export const IssueQuerySchema = z.object({
  projectId: ProjectIdSchema.optional(),
  status: IssueStatusSchema.optional(),
  assignee: IssueAssigneeSchema.optional(),
});
export type IssueQuery = z.infer<typeof IssueQuerySchema>;

/** `POST /v1/projects/:id/issues`. */
export const CreateIssueSchema = z.object({
  title: IssueTitleSchema,
  description: IssueDescriptionSchema.optional(),
  status: IssueStatusSchema.optional(),
  priority: IssuePrioritySchema.optional(),
  assignee: IssueAssigneeSchema.nullable().optional(),
  labels: IssueLabelsSchema.optional(),
});
export type CreateIssue = z.input<typeof CreateIssueSchema>;

/** `PATCH /v1/issues/:id`: only the given fields change. */
export const UpdateIssueSchema = z
  .object({
    title: IssueTitleSchema,
    description: IssueDescriptionSchema,
    status: IssueStatusSchema,
    priority: IssuePrioritySchema,
    assignee: IssueAssigneeSchema.nullable(),
    labels: IssueLabelsSchema,
    sortOrder: z.number().finite(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export type UpdateIssue = z.input<typeof UpdateIssueSchema>;

export const CreateIssueCommentSchema = z.object({
  body: z.string().trim().min(1).max(LIMITS.maxIssueCommentLength),
  /** Only the in-sandbox CLI (`tesseract-controller issue comment`) posts as `claude`. */
  author: z.enum(["me", "claude"]).optional(),
});
export type CreateIssueComment = z.input<typeof CreateIssueCommentSchema>;

/** `POST /v1/issues/:id/dispatch`: start (or restart) Claude on the issue now. */
export const DispatchIssueSchema = z.object({
  mode: AgentRunModeSchema.optional(),
  model: AgentRunModelSchema.optional(),
  /** Extra instructions appended to the issue prompt. */
  note: z.string().trim().min(1).max(LIMITS.maxIssueCommentLength).optional(),
});
export type DispatchIssue = z.input<typeof DispatchIssueSchema>;
