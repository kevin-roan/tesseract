import type { ClaudeCommand } from "@tesseract/protocol";

import type { Tone } from "@/lib/tone";

export const MAX_COMMAND_HINTS = 6;
export const CLAUDE_COMMANDS_STALE_MS = 30_000;

export type CommandSourceTag = { label: string; tone: Tone };

export const COMMAND_SOURCE_TAGS: Record<ClaudeCommand["source"], CommandSourceTag> = {
  builtin: { label: "Built-in", tone: "neutral" },
  managed: { label: "Managed", tone: "warning" },
  user: { label: "User", tone: "info" },
  project: { label: "Project", tone: "success" },
};

export type CommandHint = { name: string; label: string; description: string; tag: CommandSourceTag };

/** The command name typed so far, or null once the draft is no longer a bare `/command`. */
export function slashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;
  const query = text.slice(1);
  return /\s/.test(query) ? null : query;
}

export function matchCommands(
  commands: readonly ClaudeCommand[],
  query: string,
  limit = MAX_COMMAND_HINTS,
): ClaudeCommand[] {
  const prefix = query.toLowerCase();
  const seen = new Set<string>();
  return commands
    .filter((command) => {
      const name = command.name.toLowerCase();
      if (!name.startsWith(prefix) || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export const commandInput = (name: string) => `/${name} `;

export function toCommandHint(command: ClaudeCommand): CommandHint {
  return {
    name: command.name,
    label: `/${command.name}`,
    description: command.description,
    tag: COMMAND_SOURCE_TAGS[command.source],
  };
}
