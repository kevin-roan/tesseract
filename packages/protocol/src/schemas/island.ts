import { z } from "zod";
import { TimestampSchema } from "./primitives";

const CountSchema = z.int().nonnegative();

export const ISLAND_RUN_STATES = ["running", "completed", "failed", "cancelled"] as const;
export const IslandRunStateSchema = z.enum(ISLAND_RUN_STATES);
export type IslandRunState = z.infer<typeof IslandRunStateSchema>;

export const IslandRunSchema = z.object({
  id: z.string(),
  /** First line of the prompt, at most 60 characters. */
  title: z.string(),
  project: z.string().nullable(),
  state: IslandRunStateSchema,
  startedAt: TimestampSchema,
  tokens: CountSchema.nullable(),
});
export type IslandRun = z.infer<typeof IslandRunSchema>;

export const IslandCommandSchema = z.object({
  id: z.string(),
  label: z.string(),
  project: z.string().nullable(),
  state: z.string(),
});
export type IslandCommand = z.infer<typeof IslandCommandSchema>;

export const IslandUsageSchema = z.object({
  todayTokens: CountSchema,
  weekTokens: CountSchema,
  runsToday: CountSchema,
  messagesToday: CountSchema,
});
export type IslandUsage = z.infer<typeof IslandUsageSchema>;

/** Everything the Live Activity (iOS) or ongoing notification (Android) renders; the `content-state` of every ActivityKit push. */
export const IslandStateSchema = z.object({
  sandboxId: z.string(),
  sandboxName: z.string(),
  runs: z.array(IslandRunSchema),
  commands: z.array(IslandCommandSchema),
  usage: IslandUsageSchema,
  updatedAt: TimestampSchema,
});
export type IslandState = z.infer<typeof IslandStateSchema>;
