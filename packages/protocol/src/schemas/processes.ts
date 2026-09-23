import { z } from "zod";
import { LIMITS, LOG_STREAMS, PROCESS_STATES, TERMINAL_KINDS, TERMINAL_STATES } from "../constants";
import {
  EnvSchema,
  ExitCodeSchema,
  NameSchema,
  PidSchema,
  PortSchema,
  ProcessIdSchema,
  ProjectIdSchema,
  SequenceSchema,
  TerminalIdSchema,
  TimestampSchema,
} from "./primitives";

export const LogStreamSchema = z.enum(LOG_STREAMS);
export type LogStream = z.infer<typeof LogStreamSchema>;

export const LogLineSchema = z.object({
  seq: SequenceSchema,
  ts: TimestampSchema,
  stream: LogStreamSchema,
  text: z.string(),
});
export type LogLine = z.infer<typeof LogLineSchema>;

export const ProcessStateSchema = z.enum(PROCESS_STATES);
export type ProcessState = z.infer<typeof ProcessStateSchema>;

export const ProcessCommandSchema = z.union([z.string(), z.array(z.string())]);
export type ProcessCommand = z.infer<typeof ProcessCommandSchema>;

export const ProcessInfoSchema = z.object({
  id: ProcessIdSchema,
  projectId: ProjectIdSchema.nullable(),
  name: z.string(),
  command: ProcessCommandSchema,
  cwd: z.string(),
  pid: PidSchema,
  port: PortSchema.nullable(),
  display: z.boolean(),
  state: ProcessStateSchema,
  exitCode: ExitCodeSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
});
export type ProcessInfo = z.infer<typeof ProcessInfoSchema>;

const ShellCommandSchema = z.string().trim().min(1).max(LIMITS.maxCommandLength);
const ArgvCommandSchema = z
  .array(z.string().max(LIMITS.maxCommandLength))
  .min(1)
  .max(1024)
  .refine((argv) => (argv[0] ?? "").length > 0, "Executable must not be empty");

/** A string runs via `bash -lc` in the project directory; an array is exec'd directly. */
export const StartProcessSchema = z.object({
  projectId: ProjectIdSchema,
  command: z.union([ShellCommandSchema, ArgvCommandSchema]),
  name: NameSchema.optional(),
  env: EnvSchema.optional(),
  display: z.boolean().optional(),
  port: PortSchema.optional(),
});
export type StartProcess = z.infer<typeof StartProcessSchema>;

export const TerminalKindSchema = z.enum(TERMINAL_KINDS);
export type TerminalKind = z.infer<typeof TerminalKindSchema>;

export const TerminalStateSchema = z.enum(TERMINAL_STATES);
export type TerminalState = z.infer<typeof TerminalStateSchema>;

export const TerminalColsSchema = z.int().min(1).max(LIMITS.terminalMaxCols);
export const TerminalRowsSchema = z.int().min(1).max(LIMITS.terminalMaxRows);

export const TerminalInfoSchema = z.object({
  id: TerminalIdSchema,
  kind: TerminalKindSchema,
  projectId: ProjectIdSchema.nullable(),
  title: z.string(),
  cwd: z.string(),
  pid: PidSchema,
  cols: TerminalColsSchema,
  rows: TerminalRowsSchema,
  state: TerminalStateSchema,
  exitCode: ExitCodeSchema,
  createdAt: TimestampSchema,
});
export type TerminalInfo = z.infer<typeof TerminalInfoSchema>;

export const CreateTerminalSchema = z.object({
  kind: TerminalKindSchema,
  projectId: ProjectIdSchema.optional(),
  cols: TerminalColsSchema,
  rows: TerminalRowsSchema,
});
export type CreateTerminal = z.infer<typeof CreateTerminalSchema>;
