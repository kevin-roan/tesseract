import { emit } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";
import { CLI_VERSION } from "../version";

export function versionInfo(context: CliContext) {
  return { name: CLI_LABELS.name, version: CLI_VERSION, platform: context.runtime.platform, arch: context.runtime.arch };
}

async function run(context: CliContext): Promise<number> {
  emit(context, versionInfo(context), (info) => [CLI_LABELS.version(info.name, info.version)]);
  return EXIT.ok;
}

export const versionFlag = defineCommand({
  name: "--version",
  trigger: { flag: "version" },
  summary: CLI_LABELS.help.version,
  hidden: true,
  run,
});

export default defineCommand({
  name: "version",
  trigger: { subcommand: "version" },
  summary: CLI_LABELS.summary.version,
  usage: CLI_LABELS.usageLines.version,
  run,
});
