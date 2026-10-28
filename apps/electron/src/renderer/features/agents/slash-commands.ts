import { ApiError, type FetchLike, type TesseractClient } from "@tesseract/client";
import { ClaudeCommandListSchema, errorCodeForStatus, restPaths, type ClaudeCommand } from "@tesseract/protocol";
import type { SlashCommand } from "../../components/Composer";
import { SLASH_PREFIX } from "./constants";
import { SLASH_TAG_LABELS } from "./labels";

export function slashTag(command: ClaudeCommand): string {
  return command.source === "project" || command.source === "user" ? SLASH_TAG_LABELS[command.source] : SLASH_TAG_LABELS[command.kind];
}

export function toSlashCommands(commands: readonly ClaudeCommand[]): SlashCommand[] {
  return commands.map((command) => ({
    command: `${SLASH_PREFIX}${command.name}`,
    description: command.description || undefined,
    tag: slashTag(command),
  }));
}

export async function fetchClaudeCommands(client: TesseractClient, fetch: FetchLike, projectId: string | null | undefined, signal: AbortSignal): Promise<ClaudeCommand[]> {
  const path = restPaths.claudeCommands(projectId ? { projectId } : undefined);
  const response = await fetch(client.httpUrl(path), { method: "GET", headers: { Accept: "application/json", ...client.authHeaders() }, signal });
  if (!response.ok) throw new ApiError(response.status, errorCodeForStatus(response.status), response.statusText);
  return ClaudeCommandListSchema.parse(JSON.parse(await response.text()));
}
