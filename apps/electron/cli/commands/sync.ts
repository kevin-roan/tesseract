import { runPull, runPush, runRevert, runStatus } from "../../src/core/syncback";
import { guarded, syncEnvironment, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, type CliContext } from "../types";

const ACTIONS = {
  push: (context: CliContext) =>
    runPush(syncEnvironment(context), context.io, { confidential: context.flags.has("confidential") }),
  pull: (context: CliContext) =>
    runPull(syncEnvironment(context), context.io, { dryRun: context.flags.has("dry-run"), force: context.flags.has("force") }),
  revert: (context: CliContext) => runRevert(syncEnvironment(context), context.io, { force: context.flags.has("force") }),
  status: (context: CliContext) => runStatus(syncEnvironment(context), context.io),
} as const;

type SyncAction = keyof typeof ACTIONS;

function isAction(value: string): value is SyncAction {
  return value in ACTIONS;
}

export default defineCommand({
  name: "sync",
  trigger: { subcommand: "sync" },
  summary: CLI_LABELS.summary.sync,
  usage: CLI_LABELS.usageLines.sync,
  flags: ["confidential", "dry-run", "force"],
  run: (context) =>
    guarded(context, async () => {
      const action = context.args[0] ?? "push";
      if (!isAction(action)) usageError(CLI_LABELS.unknownSubcommand("sync", action));
      return ACTIONS[action](context);
    }),
});
