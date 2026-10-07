import { table } from "./format";
import { CLI_LABELS } from "./labels";
import type { CliCommand } from "./types";

function triggerName(command: CliCommand): string {
  return "flag" in command.trigger ? `--${command.trigger.flag}` : command.trigger.subcommand;
}

export function generalHelp(commands: readonly CliCommand[]): string[] {
  const visible = commands.filter((command) => !command.hidden);
  const subcommands = visible.filter((command) => "subcommand" in command.trigger);
  const flags = visible.filter((command) => "flag" in command.trigger);
  return [
    CLI_LABELS.usage,
    CLI_LABELS.legacyUsage,
    "",
    CLI_LABELS.commandsHeading,
    ...table(subcommands.map((command) => [triggerName(command), command.summary]), "  "),
    "",
    CLI_LABELS.flagsHeading,
    ...table(
      [
        ...flags.map((command) => [triggerName(command), command.summary]),
        ["--confidential", CLI_LABELS.help.confidential],
        ["--dry-run", CLI_LABELS.help.dryRun],
        ["--force", CLI_LABELS.help.force],
      ],
      "  ",
    ),
    "",
    CLI_LABELS.globalHeading,
    ...table(CLI_LABELS.globalFlags, "  "),
  ];
}

export function commandHelp(command: CliCommand): string[] {
  return [command.summary, "", ...(command.usage ?? [`monolith ${triggerName(command)}`]).map((line) => `  ${line}`)];
}
