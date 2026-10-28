import type { ClaudeCommand } from "@tesseract/protocol";

import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { fetchClaudeCommands } from "../api/claude-commands";
import { chatKeys } from "../api/query-keys";
import { CLAUDE_COMMANDS_STALE_MS } from "../utils/slash-commands";

const NO_COMMANDS: ClaudeCommand[] = [];

export function useClaudeCommands(projectId: string | null, enabled = true): ClaudeCommand[] {
  const query = useSandboxQuery(
    (sandboxId) => chatKeys.claudeCommands(sandboxId, projectId),
    (client, signal) => fetchClaudeCommands(client, projectId, signal),
    { enabled, staleTime: CLAUDE_COMMANDS_STALE_MS },
  );
  return query.data ?? NO_COMMANDS;
}
