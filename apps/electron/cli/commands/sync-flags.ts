import { runPull, runPush, runRevert, runStatus } from "../../src/core/syncback";
import { guarded, syncEnvironment } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT } from "../types";

export const getFlag = defineCommand({
  name: "--get",
  trigger: { flag: "get" },
  summary: CLI_LABELS.help.get,
  run: async (context) => {
    context.io.stderr(CLI_LABELS.getOnHost);
    return EXIT.error;
  },
});

export const syncFlag = defineCommand({
  name: "--sync",
  trigger: { flag: "sync" },
  summary: CLI_LABELS.help.sync,
  flags: ["confidential"],
  run: (context) =>
    guarded(context, () => runPush(syncEnvironment(context), context.io, { confidential: context.flags.has("confidential") })),
});

export const pullFlag = defineCommand({
  name: "--pull",
  trigger: { flag: "pull" },
  summary: CLI_LABELS.help.pull,
  flags: ["dry-run", "force"],
  run: (context) =>
    guarded(context, () =>
      runPull(syncEnvironment(context), context.io, { dryRun: context.flags.has("dry-run"), force: context.flags.has("force") }),
    ),
});

export const revertFlag = defineCommand({
  name: "--revert",
  trigger: { flag: "revert" },
  summary: CLI_LABELS.help.revert,
  flags: ["force"],
  run: (context) => guarded(context, () => runRevert(syncEnvironment(context), context.io, { force: context.flags.has("force") })),
});

export const syncStatusFlag = defineCommand({
  name: "--sync-status",
  trigger: { flag: "sync-status" },
  summary: CLI_LABELS.help.syncStatus,
  run: (context) => guarded(context, () => runStatus(syncEnvironment(context), context.io)),
});

export const SYNC_FLAG_COMMANDS = [getFlag, syncFlag, pullFlag, revertFlag, syncStatusFlag] as const;
