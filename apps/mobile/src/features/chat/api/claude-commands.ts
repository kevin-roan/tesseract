import type { TesseractClient } from "@tesseract/client";
import { ClaudeCommandListSchema, restPaths, type ClaudeCommand } from "@tesseract/protocol";

/** Older sandboxes have no commands endpoint; any failure means no hints rather than an error. */
export async function fetchClaudeCommands(
  client: TesseractClient,
  projectId: string | null,
  signal: AbortSignal,
): Promise<ClaudeCommand[]> {
  try {
    const path = restPaths.claudeCommands(projectId ? { projectId } : undefined);
    const response = await fetch(client.httpUrl(path), {
      headers: { Accept: "application/json", ...client.authHeaders() },
      signal,
    });
    if (!response.ok) return [];
    const parsed = ClaudeCommandListSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
