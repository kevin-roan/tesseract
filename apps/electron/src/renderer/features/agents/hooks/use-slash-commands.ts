import { controllerFetch, useApiQuery, useScopedClient } from "../../../app/data";
import type { SlashCommand } from "../../../components/Composer";
import { AGENTS_QUERY_KEYS, NO_PROJECT_KEY, SLASH_COMMANDS_STALE_MS } from "../constants";
import { fetchClaudeCommands, toSlashCommands } from "../slash-commands";

const NO_COMMANDS: readonly SlashCommand[] = [];

export function useSlashCommands(projectId?: string | null): readonly SlashCommand[] {
  const scoped = useScopedClient() !== null;
  const query = useApiQuery(
    [...AGENTS_QUERY_KEYS.slashCommands, projectId ?? NO_PROJECT_KEY],
    async (client, signal) => toSlashCommands(await fetchClaudeCommands(client, controllerFetch(), projectId, signal)),
    { enabled: !scoped, staleTime: SLASH_COMMANDS_STALE_MS, retry: false },
  );
  return query.isError ? NO_COMMANDS : query.data ?? NO_COMMANDS;
}
