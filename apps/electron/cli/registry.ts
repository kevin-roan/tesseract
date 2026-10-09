import android from "./commands/android";
import config from "./commands/config";
import containers from "./commands/containers";
import doctor from "./commands/doctor";
import domains from "./commands/domains";
import open from "./commands/open";
import pair from "./commands/pair";
import sandbox from "./commands/sandbox";
import server from "./commands/server";
import status from "./commands/status";
import sync from "./commands/sync";
import { geminiKeyFlag } from "./commands/gemini";
import { SYNC_FLAG_COMMANDS } from "./commands/sync-flags";
import version, { versionFlag } from "./commands/version";
import type { CliCommand } from "./types";

export const COMMANDS: readonly CliCommand[] = [
  status,
  open,
  doctor,
  sandbox,
  server,
  containers,
  domains,
  android,
  pair,
  sync,
  config,
  version,
  ...SYNC_FLAG_COMMANDS,
  geminiKeyFlag,
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
