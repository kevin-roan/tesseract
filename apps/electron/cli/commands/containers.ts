import type { ContainersReport, ServerContainer } from "../../src/shared/contracts/containers";
import { positiveInt } from "../args";
import { containersService, readStdinSecret } from "../containers-service";
import { keyValues, table } from "../format";
import { createProgress, emit, guarded, log, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.containers;

function nameArg(context: CliContext): string {
  const name = context.args[1];
  if (!name) usageError(CLI_LABELS.missingArgument("containers", LABELS.nameArg));
  return name;
}

export function describeContainers(containers: readonly ServerContainer[]): string[] {
  if (!containers.length) return [LABELS.none];
  return table([
    LABELS.header,
    ...containers.map((container) => [
      container.name,
      container.state,
      container.tailnet?.dnsName ?? container.tailnet?.hostname ?? "-",
      container.tunnel,
      [container.cpus ? `${container.cpus} cpu` : "", container.memoryMb ? `${container.memoryMb} MB` : ""].filter(Boolean).join(", ") || "-",
    ]),
  ]);
}

export function describeReport(report: ContainersReport): string[] {
  return report.checks.map((check) => `${LABELS.checkMark[check.status]} ${check.title}: ${check.detail}`);
}

function describeOne(container: ServerContainer): string[] {
  return keyValues([
    [LABELS.fields.name, container.name],
    [LABELS.fields.state, container.status],
    [LABELS.fields.tailnet, container.tailnet?.dnsName ?? LABELS.notJoined],
    [LABELS.fields.ssh, container.tailnet ? `ssh ${container.tailnet.sshTarget}` : "-"],
    [LABELS.fields.tunnel, container.tunnel],
  ]);
}

type Action = (context: CliContext) => Promise<number>;

const single = (run: (context: CliContext, name: string) => Promise<ServerContainer>): Action => async (context) => {
  emit(context, await run(context, nameArg(context)), describeOne);
  return EXIT.ok;
};

export const CONTAINERS_ACTIONS: Record<string, Action> = {
  ls: async (context) => {
    emit(context, await containersService(context).list(), describeContainers);
    return EXIT.ok;
  },
  doctor: async (context) => {
    const report = await containersService(context).report();
    emit(context, report, describeReport);
    return report.checks.some((check) => check.status === "error") ? EXIT.error : EXIT.ok;
  },
  build: async (context) => {
    const progress = createProgress(context);
    const service = containersService(context);
    log(context, LABELS.building);
    const poll = setInterval(() => {
      const phase = service.phase();
      if (phase.kind === "building" && phase.step) progress.update(phase.step);
    }, 250);
    try {
      emit(context, await service.buildImage(), describeReport);
    } finally {
      clearInterval(poll);
      progress.done();
    }
    return EXIT.ok;
  },
  create: single((context, name) => {
    log(context, LABELS.creating(name));
    const memory = context.values.get("memory");
    return containersService(context).create({
      name,
      cpus: context.values.has("cpus") ? Number(context.values.get("cpus")) : null,
      memoryMb: memory ? positiveInt(memory) : null,
    });
  }),
  start: single((context, name) => containersService(context).start(name)),
  stop: single((context, name) => containersService(context).stop(name)),
  restart: single((context, name) => containersService(context).restart(name)),
  rm: async (context) => {
    const name = nameArg(context);
    if (!context.flags.has("yes")) usageError(LABELS.confirmRemove(name));
    await containersService(context).remove(name);
    emit(context, { removed: name }, () => [LABELS.removed(name)]);
    return EXIT.ok;
  },
  logs: async (context) => {
    emit(context, await containersService(context).logs(nameArg(context)), (lines) => lines);
    return EXIT.ok;
  },
  ssh: async (context) => {
    const name = nameArg(context);
    const container = (await containersService(context).list()).find((entry) => entry.name === name);
    if (!container?.tailnet) usageError(LABELS.noTailnet(name));
    emit(context, { target: container.tailnet.sshTarget }, (value) => [`ssh ${value.target}`]);
    return EXIT.ok;
  },
  "tailscale-key": async (context) => {
    const authKey = context.flags.has("clear") ? null : await readStdinSecret();
    if (authKey === "") usageError(LABELS.keyFromStdin);
    emit(context, await containersService(context).setTailscaleKey({ authKey, tags: context.values.get("tags") }), describeReport);
    return EXIT.ok;
  },
};

export default defineCommand({
  name: "containers",
  trigger: { subcommand: "containers" },
  summary: CLI_LABELS.summary.containers,
  usage: CLI_LABELS.usageLines.containers,
  flags: ["yes", "clear"],
  valueFlags: ["cpus", "memory", "tags"],
  run: (context) =>
    guarded(context, async () => {
      const name = context.args[0] ?? "ls";
      const action = CONTAINERS_ACTIONS[name];
      if (!action) usageError(CLI_LABELS.unknownSubcommand("containers", name));
      return action(context);
    }),
});
