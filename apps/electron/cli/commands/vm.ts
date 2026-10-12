import { setupVm, startVm, stopVm, vmStatus, type VmOptions } from "../../src/core/vm";
import type { DockerPhase } from "../../src/shared/contracts/docker";
import type { VmStatus, VmTools } from "../../src/shared/contracts/vm";
import { keyValues } from "../format";
import { emit, guarded, log, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.vm;

export function describeVm(status: VmStatus): string[] {
  const tools = (Object.keys(LABELS.tools) as (keyof VmTools)[]).map((tool): [string, string] => [LABELS.tools[tool], status.tools[tool] ?? LABELS.missingTool]);
  return keyValues([
    [LABELS.fields.state, LABELS.states[status.state]],
    [LABELS.fields.profile, status.profile],
    [LABELS.fields.context, status.context],
    [LABELS.fields.docker, status.active ? LABELS.yes : LABELS.inactive(status.activeContext)],
    [LABELS.fields.sysbox, status.sysbox ? LABELS.yes : LABELS.no],
    [LABELS.fields.size, LABELS.size(status.size.cpus, status.size.memoryGb, status.size.diskGb)],
    ...tools,
  ]);
}

export function describePhase(phase: DockerPhase, done: string): string[] {
  if (phase.kind === "blocked") return [LABELS.blocked(phase.reason), ...(phase.commands ?? []).map((command) => `  ${command}`)];
  return phase.kind === "ready" || phase.kind === "idle" ? [done] : [LABELS.phase(phase.kind)];
}

function vmOptions(context: CliContext): VmOptions {
  return { env: context.env, signal: context.signal, onLog: (line) => log(context, line) };
}

function finish(context: CliContext, phase: DockerPhase, done: string): number {
  emit(context, phase, (value) => describePhase(value, done));
  return phase.kind === "blocked" ? EXIT.error : EXIT.ok;
}

type Action = (context: CliContext) => Promise<number>;

export const VM_ACTIONS: Record<string, Action> = {
  status: async (context) => {
    const status = await vmStatus({ env: context.env, signal: context.signal });
    emit(context, status, describeVm);
    if (status.dockerDesktopRunning) log(context, LABELS.dockerDesktopRunning);
    return EXIT.ok;
  },
  setup: async (context) => {
    const resourcesDir = context.runtime.sandboxContextDir();
    log(context, LABELS.settingUp);
    return finish(context, await setupVm({ ...vmOptions(context), resourcesDir }), LABELS.ready);
  },
  start: async (context) => {
    log(context, LABELS.starting);
    return finish(context, await startVm(vmOptions(context)), LABELS.ready);
  },
  stop: async (context) => {
    log(context, LABELS.stopping);
    return finish(context, await stopVm(vmOptions(context)), LABELS.stopped);
  },
};

export default defineCommand({
  name: "vm",
  trigger: { subcommand: "vm" },
  summary: CLI_LABELS.summary.vm,
  usage: CLI_LABELS.usageLines.vm,
  run: (context) =>
    guarded(context, async () => {
      if (context.runtime.platform !== "darwin") usageError(LABELS.onlyMac);
      const name = context.args[0] ?? "status";
      const action = VM_ACTIONS[name];
      if (!action) usageError(CLI_LABELS.unknownSubcommand("vm", name));
      return action(context);
    }),
});
