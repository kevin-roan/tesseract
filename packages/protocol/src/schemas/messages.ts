import { z } from "zod";
import { PROTOCOL_VERSION } from "../constants";
import { AgentRunEventSchema, AgentRunSchema, StatusEventSchema } from "./agent";
import { ArtifactSchema, BuildJobSchema } from "./builds";
import { LogLineSchema, ProcessInfoSchema, TerminalColsSchema, TerminalInfoSchema, TerminalRowsSchema } from "./processes";
import { ExitCodeSchema } from "./primitives";
import { ProjectSchema } from "./projects";

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
  z.object({ type: z.literal("agent.updated"), run: AgentRunSchema }),
  z.object({ type: z.literal("project.updated"), project: ProjectSchema }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ServerEventType = ServerEvent["type"];
export type ServerEventOf<T extends ServerEventType> = Extract<ServerEvent, { type: T }>;

export const EventsClientMessageSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("pong") })]);
export type EventsClientMessage = z.infer<typeof EventsClientMessageSchema>;
