import { z } from "zod";
import { ERROR_CODES, PROTOCOL_VERSION } from "../constants";
import { ByteCountSchema, PortSchema, TimestampSchema } from "./primitives";

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const ErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

export const HealthSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  sandboxId: z.string(),
});
export type Health = z.infer<typeof HealthSchema>;

export const TicketSchema = z.object({
  ticket: z.string().min(1),
  expiresAt: TimestampSchema,
});
export type Ticket = z.infer<typeof TicketSchema>;

export const ToolVersionSchema = z.object({
  name: z.string().min(1),
  version: z.string().nullable(),
});
export type ToolVersion = z.infer<typeof ToolVersionSchema>;

export const DisplayStatusSchema = z.object({
  display: z.string(),
  available: z.boolean(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  vnc: z.object({
    available: z.boolean(),
    port: PortSchema,
    password: z.string().nullable(),
  }),
  webPath: z.literal("/ui/vnc"),
});
export type DisplayStatus = z.infer<typeof DisplayStatusSchema>;

export const BrowserTabSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  phoneUrl: z.string().nullable(),
});
export type BrowserTab = z.infer<typeof BrowserTabSchema>;

/** Chromium pages in the sandbox; `tabs[0]` is the current (most recently active) tab. */
export const BrowserStatusSchema = z.object({
  available: z.boolean(),
  tabs: z.array(BrowserTabSchema),
});
export type BrowserStatus = z.infer<typeof BrowserStatusSchema>;

const CountSchema = z.int().nonnegative();

export const SandboxResourcesSchema = z.object({
  cpu: z.object({
    cores: z.int().nonnegative(),
    load1: z.number().nonnegative(),
    load5: z.number().nonnegative(),
    load15: z.number().nonnegative(),
  }),
  memory: z.object({
    totalBytes: ByteCountSchema,
    usedBytes: ByteCountSchema,
  }),
  disk: z.object({
    path: z.string(),
    totalBytes: ByteCountSchema,
    usedBytes: ByteCountSchema,
  }),
});
export type SandboxResources = z.infer<typeof SandboxResourcesSchema>;

export const SandboxCountsSchema = z.object({
  projects: CountSchema,
  runningProcesses: CountSchema,
  activeBuilds: CountSchema,
  terminals: CountSchema,
  agentRuns: CountSchema,
});
export type SandboxCounts = z.infer<typeof SandboxCountsSchema>;

export const SandboxStatusSchema = z.object({
  sandboxId: z.string(),
  hostname: z.string(),
  version: z.string(),
  startedAt: TimestampSchema,
  uptimeSec: z.number().nonnegative(),
  resources: SandboxResourcesSchema,
  display: DisplayStatusSchema,
  tools: z.array(ToolVersionSchema),
  counts: SandboxCountsSchema,
});
export type SandboxStatus = z.infer<typeof SandboxStatusSchema>;

export const AgentContextFileSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  sizeBytes: ByteCountSchema,
  modifiedAt: TimestampSchema,
  truncated: z.boolean(),
  content: z.string(),
});
export type AgentContextFile = z.infer<typeof AgentContextFileSchema>;

export const AgentContextSchema = z.object({
  files: z.array(AgentContextFileSchema),
});
export type AgentContext = z.infer<typeof AgentContextSchema>;
