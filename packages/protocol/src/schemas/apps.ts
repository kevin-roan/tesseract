import { z } from "zod";
import { APP_RUN_ACTIONS, APP_RUN_STATES, APP_VIEWER_KINDS, RUN_TARGETS } from "../constants";
import { AppRunIdSchema, PortSchema, ProcessIdSchema, ProjectIdSchema, TimestampSchema } from "./primitives";

export const RunTargetSchema = z.enum(RUN_TARGETS);
export type RunTarget = z.infer<typeof RunTargetSchema>;

export const AppRunStateSchema = z.enum(APP_RUN_STATES);
export type AppRunState = z.infer<typeof AppRunStateSchema>;

export const AppRunActionSchema = z.enum(APP_RUN_ACTIONS);
export type AppRunAction = z.infer<typeof AppRunActionSchema>;

export const AppViewerKindSchema = z.enum(APP_VIEWER_KINDS);
export type AppViewerKind = z.infer<typeof AppViewerKindSchema>;

/** How the phone opens a ready run; `url` is null when the sandbox has no address the phone can reach. */
export const AppViewerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().nullable(), localUrl: z.string() }),
  z.object({
    kind: z.literal("deeplink"),
    devClientUrl: z.string().nullable(),
    expoGoUrl: z.string(),
    manifestUrl: z.string(),
  }),
  z.object({ kind: z.literal("display") }),
  /** `serial`: the sandbox adb serial of the tunnelled host emulator. */
  z.object({ kind: z.literal("android"), serial: z.string() }),
  z.object({ kind: z.literal("none") }),
]);
export type AppViewer = z.infer<typeof AppViewerSchema>;

/** `dir`: project-relative folder the target runs in (a workspace package of a monorepo), null for the project root. */
export const RunTargetInfoSchema = z.object({
  target: RunTargetSchema,
  label: z.string(),
  dir: z.string().nullable(),
  available: z.boolean(),
  reason: z.string().nullable(),
  viewer: AppViewerKindSchema,
  actions: z.array(AppRunActionSchema),
});
export type RunTargetInfo = z.infer<typeof RunTargetInfoSchema>;

/** `processIds`: `[main]`, or `[metro, gradle]` for `rn-android`; `viewer` is set once `ready`. */
export const AppRunSchema = z.object({
  id: AppRunIdSchema,
  projectId: ProjectIdSchema,
  target: RunTargetSchema,
  dir: z.string().nullable(),
  state: AppRunStateSchema,
  port: PortSchema.nullable(),
  processIds: z.array(ProcessIdSchema),
  viewer: AppViewerSchema.nullable(),
  actions: z.array(AppRunActionSchema),
  error: z.string().nullable(),
  startedAt: TimestampSchema,
  readyAt: TimestampSchema.nullable(),
  endedAt: TimestampSchema.nullable(),
});
export type AppRun = z.infer<typeof AppRunSchema>;

export const StartAppRunSchema = z.object({
  target: RunTargetSchema,
  port: PortSchema.optional(),
});
export type StartAppRun = z.infer<typeof StartAppRunSchema>;

export const AppRunActionRequestSchema = z.object({ action: AppRunActionSchema });
export type AppRunActionRequest = z.infer<typeof AppRunActionRequestSchema>;

export const RunTargetListSchema = z.array(RunTargetInfoSchema);
export const AppRunListSchema = z.array(AppRunSchema);
