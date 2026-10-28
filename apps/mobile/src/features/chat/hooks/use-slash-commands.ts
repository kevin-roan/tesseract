import { useCallback, useMemo } from "react";

import { commandInput, matchCommands, slashQuery, toCommandHint } from "../utils/slash-commands";
import { useClaudeCommands } from "./use-claude-commands";

type SlashCommandsOptions = {
  text: string;
  setText: (text: string) => void;
  projectId: string | null;
};

export function useSlashCommands({ text, setText, projectId }: SlashCommandsOptions) {
  const query = slashQuery(text);
  const commands = useClaudeCommands(projectId, query !== null);
  const items = useMemo(
    () => (query === null ? [] : matchCommands(commands, query).map(toCommandHint)),
    [commands, query],
  );
  const select = useCallback((name: string) => setText(commandInput(name)), [setText]);
  return { items, select };
}
