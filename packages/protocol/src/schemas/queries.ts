import { z } from "zod";
import { LIMITS } from "../constants";
import { ProjectIdSchema } from "./primitives";

export const ProjectFilterQuerySchema = z.object({
  projectId: ProjectIdSchema.optional(),
});
export type ProjectFilterQuery = z.infer<typeof ProjectFilterQuerySchema>;

/** Accepts the raw query-string value; the controller should fall back to LIMITS.defaultLogTail when absent. */
export const LogTailQuerySchema = z.object({
  tail: z.coerce.number<string | number | undefined>().int().min(1).max(LIMITS.maxLogTail).optional(),
});
export type LogTailQuery = z.infer<typeof LogTailQuerySchema>;

export const TicketQuerySchema = z.object({
  ticket: z.string().min(1),
});
export type TicketQuery = z.infer<typeof TicketQuerySchema>;
