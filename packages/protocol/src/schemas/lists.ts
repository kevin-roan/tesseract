import { z } from "zod";
import { AgentRunSchema } from "./agent";
import { ArtifactSchema, BuildJobSchema, BuildOutputSchema } from "./builds";
import { LogLineSchema, ProcessInfoSchema, TerminalInfoSchema } from "./processes";
import { ProjectSchema } from "./projects";
import { ClaudeSessionSchema } from "./usage";

export const ProjectListSchema = z.array(ProjectSchema);
export const ProcessListSchema = z.array(ProcessInfoSchema);
export const TerminalListSchema = z.array(TerminalInfoSchema);
export const BuildListSchema = z.array(BuildJobSchema);
export const ArtifactListSchema = z.array(ArtifactSchema);
export const BuildOutputListSchema = z.array(BuildOutputSchema);
export const AgentRunListSchema = z.array(AgentRunSchema);
export const LogLineListSchema = z.array(LogLineSchema);
export const ClaudeSessionListSchema = z.array(ClaudeSessionSchema);
