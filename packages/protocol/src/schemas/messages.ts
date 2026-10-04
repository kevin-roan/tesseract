import { z } from "zod";
import { PROTOCOL_VERSION } from "../constants";
import { AgentRunEventSchema, AgentRunSchema, StatusEventSchema } from "./agent";
import { AppRunSchema } from "./apps";
import { ArtifactSchema, BuildJobSchema } from "./builds";
import { LogLineSchema, ProcessInfoSchema, TerminalColsSchema, TerminalInfoSchema, TerminalRowsSchema } from "./processes";
import { AgentRunIdSchema, ArtifactIdSchema, ExitCodeSchema, ProjectIdSchema } from "./primitives";
import { InboxCountsSchema, InboxItemSchema } from "./inbox";
import { ProjectSchema } from "./projects";
import { SttStatusSchema } from "./stt";
import { SyncRequestSchema } from "./sync";

export const TerminalInputMessageSchema = z.object({ type: z.literal("input"), data: z.string() });
export const TerminalResizeMessageSchema = z.object({
  type: z.literal("resize"),
  cols: TerminalColsSchema,
  rows: TerminalRowsSchema,
});
export const TerminalClientMessageSchema = z.discriminatedUnion("type", [
  TerminalInputMessageSchema,
  TerminalResizeMessageSchema,
]);
export type TerminalClientMessage = z.infer<typeof TerminalClientMessageSchema>;

export const TerminalOutputMessageSchema = z.object({ type: z.literal("output"), data: z.string() });
export const ExitMessageSchema = z.object({ type: z.literal("exit"), code: ExitCodeSchema });
export type ExitMessage = z.infer<typeof ExitMessageSchema>;

export const TerminalServerMessageSchema = z.discriminatedUnion("type", [
  TerminalOutputMessageSchema,
  ExitMessageSchema,
]);
export type TerminalServerMessage = z.infer<typeof TerminalServerMessageSchema>;

export const LogMessageSchema = z.object({ type: z.literal("log"), line: LogLineSchema });
export const BuildMessageSchema = z.object({ type: z.literal("build"), build: BuildJobSchema });

export const ProcessLogStreamMessageSchema = z.discriminatedUnion("type", [LogMessageSchema, ExitMessageSchema]);
export type ProcessLogStreamMessage = z.infer<typeof ProcessLogStreamMessageSchema>;

/** Superset used by `/v1/builds/:id/logs/stream`; process log streams never send `build`. */
export const LogStreamMessageSchema = z.discriminatedUnion("type", [
  LogMessageSchema,
  ExitMessageSchema,
  BuildMessageSchema,
]);
export type LogStreamMessage = z.infer<typeof LogStreamMessageSchema>;

export const AgentStreamMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), event: AgentRunEventSchema }),
  z.object({ type: z.literal("run"), run: AgentRunSchema }),
]);
export type AgentStreamMessage = z.infer<typeof AgentStreamMessageSchema>;

export const ServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), protocolVersion: z.literal(PROTOCOL_VERSION), sandboxId: z.string() }),
  z.object({ type: z.literal("ping") }),
  z.object({ type: z.literal("status"), event: StatusEventSchema }),
  z.object({ type: z.literal("process.updated"), process: ProcessInfoSchema }),
  z.object({ type: z.literal("terminal.updated"), terminal: TerminalInfoSchema }),
  z.object({ type: z.literal("build.updated"), build: BuildJobSchema }),
  z.object({ type: z.literal("artifact.created"), artifact: ArtifactSchema }),
  z.object({ type: z.literal("artifact.deleted"), id: ArtifactIdSchema }),
  z.object({ type: z.literal("agent.updated"), run: AgentRunSchema }),
  /** Runs removed by `POST /v1/agent/runs/delete`. */
  z.object({ type: z.literal("agent.deleted"), ids: z.array(AgentRunIdSchema) }),
  z.object({ type: z.literal("project.updated"), project: ProjectSchema }),
  /** The project was moved out of the sandbox by `DELETE /v1/projects/:id`. */
  z.object({ type: z.literal("project.deleted"), id: ProjectIdSchema }),
  /** An item was added, bumped or read; `item` is absent after a mark-read. */
  z.object({ type: z.literal("inbox.updated"), item: InboxItemSchema.optional(), ...InboxCountsSchema.shape }),
  z.object({ type: z.literal("stt.updated"), stt: SttStatusSchema }),
  z.object({ type: z.literal("sync.updated"), request: SyncRequestSchema }),
  /** The project's sync-back baseline moved (after a push or an ack). */
  z.object({ type: z.literal("sync.changed"), projectId: ProjectIdSchema }),
  z.object({ type: z.literal("app.updated"), run: AppRunSchema }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ServerEventType = ServerEvent["type"];
export type ServerEventOf<T extends ServerEventType> = Extract<ServerEvent, { type: T }>;

export const EventsClientMessageSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("pong") })]);
export type EventsClientMessage = z.infer<typeof EventsClientMessageSchema>;
