import android from "./commands/android";
import config from "./commands/config";
import doctor from "./commands/doctor";
import open from "./commands/open";
import pair from "./commands/pair";
import sandbox from "./commands/sandbox";
import status from "./commands/status";
import sync from "./commands/sync";
import { SYNC_FLAG_COMMANDS } from "./commands/sync-flags";
import version, { versionFlag } from "./commands/version";
import type { CliCommand } from "./types";

export const COMMANDS: readonly CliCommand[] = [
  status,
  open,
  doctor,
  sandbox,
  android,
  pair,
  sync,
  config,
  version,
  ...SYNC_FLAG_COMMANDS,
  versionFlag,
];

export function findCommand(name: string): CliCommand | null {
  return (
    COMMANDS.find(
      (command) =>
        ("subcommand" in command.trigger && command.trigger.subcommand === name) ||
        ("flag" in command.trigger && command.trigger.flag === name.replace(/^--/, "")),
    ) ?? null
  );
}
