import { z } from "zod";
import { PidSchema, ProjectIdSchema, TimestampSchema } from "./primitives";

/** What `GET /v1/runtime` lists: everything the controller can stop in the sandbox. */
export const RUNTIME_KINDS = ["process", "app-run", "agent-run", "terminal", "browser", "vnc"] as const;
export const RuntimeKindSchema = z.enum(RUNTIME_KINDS);
export type RuntimeKind = z.infer<typeof RuntimeKindSchema>;

export const RuntimeEntrySchema = z.object({
  kind: RuntimeKindSchema,
  id: z.string().min(1),
  name: z.string(),
  detail: z.string().nullable(),
  pid: PidSchema,
  projectId: ProjectIdSchema.nullable(),
  startedAt: TimestampSchema.nullable(),
  state: z.string(),
  cpuPercent: z.number().nonnegative().nullable(),
  memoryBytes: z.int().nonnegative().nullable(),
  /** supervisord restarts it after a kill (`SIGKILL`); a `SIGTERM` stop keeps it stopped. */
  supervised: z.boolean(),
  canStop: z.boolean(),
});
export type RuntimeEntry = z.infer<typeof RuntimeEntrySchema>;

export const RuntimeListSchema = z.object({ entries: z.array(RuntimeEntrySchema) });
export type RuntimeList = z.infer<typeof RuntimeListSchema>;
