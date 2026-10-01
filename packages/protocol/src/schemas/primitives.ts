import { z } from "zod";
import { ENV_NAME_PATTERN, LIMITS, PROJECT_ID_PATTERN } from "../constants";
import { idPattern } from "../ids";

export const TimestampSchema = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;

export const ProjectIdSchema = z.string().trim().toLowerCase().regex(PROJECT_ID_PATTERN, "Invalid project id");
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const ProcessIdSchema = z.string().regex(idPattern("process"), "Invalid process id");
export const TerminalIdSchema = z.string().regex(idPattern("terminal"), "Invalid terminal id");
export const BuildIdSchema = z.string().regex(idPattern("build"), "Invalid build id");
export const ArtifactIdSchema = z.string().regex(idPattern("artifact"), "Invalid artifact id");
export const AgentRunIdSchema = z.string().regex(idPattern("agentRun"), "Invalid agent run id");
export const UploadIdSchema = z.string().regex(idPattern("upload"), "Invalid upload id");
export const InboxIdSchema = z.string().regex(idPattern("inbox"), "Invalid inbox id");
export const SyncRequestIdSchema = z.string().regex(idPattern("sync"), "Invalid sync request id");

export const PortSchema = z.int().min(1).max(65535);
export const ByteCountSchema = z.int().nonnegative();
export const ExitCodeSchema = z.int().nullable();
export const SequenceSchema = z.int().nonnegative();
export const PidSchema = z.int().positive().nullable();
export const NameSchema = z.string().trim().min(1).max(LIMITS.maxNameLength);
export const EnvSchema = z.record(z.string().regex(ENV_NAME_PATTERN, "Invalid environment variable name"), z.string());
