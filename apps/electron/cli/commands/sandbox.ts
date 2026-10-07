import { cpus, homedir, totalmem } from "node:os";
import { containerName } from "../../src/core/connection";
import { probeDocker } from "../../src/core/docker";
import { scrubEnv } from "../../src/core/process";
import {
  composeArgs,
  composeDown,
  composeLogs,
  composeRestart,
  composeStatus,
  composeUp,
  defaultChoices,
  readEnvValues,
  resolveStack,
  runBuild,
  savedChoices,
  SCRUBBED_ENV_NAMES,
  SCRUBBED_ENV_PREFIXES,
  stackProject,
  writeStack,
  type HostResources,
  type SandboxContext,
} from "../../src/core/sandbox";
import { COMPONENTS } from "../../src/core/sandbox/constants";
import { streamCommand } from "../../src/core/sandbox/spawn";
import type { BuildMode, BuildPhase, SandboxComponent, SandboxStackStatus } from "../../src/shared/contracts/sandbox";
import { positiveInt, splitList } from "../args";
import { BASE_IMAGE_ALIASES, COMPONENT_KEYWORDS, DEFAULT_LOG_TAIL } from "../constants";
import { formatPercent, table } from "../format";
import { createProgress, emit, guarded, log, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";
import { runPair } from "./pair";

const LABELS = CLI_LABELS.sandbox;
const PHASE = LABELS.phase;

export interface ComponentSelection {
  components: SandboxComponent[];
  notes: string[];
}

export function parseComponents(value: string): ComponentSelection {
  const notes: string[] = [];
  const picked = new Set<SandboxComponent>();
  for (const name of splitList(value)) {
    if (name === COMPONENT_KEYWORDS.all) COMPONENTS.forEach((component) => picked.add(component));
    else if (name === COMPONENT_KEYWORDS.none) picked.clear();
    else if ((BASE_IMAGE_ALIASES as readonly string[]).includes(name)) notes.push(LABELS.baseIncluded(name));
    else {
      const component = COMPONENTS.find((candidate) => candidate === name);
      if (!component) usageError(LABELS.unknownComponent(name, COMPONENTS.join(", ")));
      picked.add(component);
    }
  }
  return { components: COMPONENTS.filter((component) => picked.has(component)), notes };
}

export function buildMode(flags: ReadonlySet<string>): BuildMode {
  if (flags.has("pull")) return "pull";
  if (flags.has("existing")) return "existing";
  return "build";
}

export function phaseLine(phase: BuildPhase): string {
  switch (phase.kind) {
    case "idle":
      return PHASE.idle;
    case "preflight":
      return PHASE.preflight;
    case "building":
      return PHASE.building(formatPercent(phase.fraction), phase.step);
    case "pulling":
      return PHASE.pulling(formatPercent(phase.fraction), phase.detail);
    case "starting":
      return PHASE.starting;
    case "waiting":
      return PHASE.waiting;
    case "pairing":
      return PHASE.pairing;
    case "done":
      return PHASE.done(phase.apiUrl);
    case "failed":
      return PHASE.failed(phase.phase, phase.message);
    case "cancelled":
      return PHASE.cancelled;
  }
}

export function hostResources(): HostResources {
  return { cpus: cpus().length, memBytes: totalmem(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, homeDir: homedir() };
}

export function describeServices(status: SandboxStackStatus): string[] {
  if (status.services.length === 0) return [LABELS.noServices];
  return table([
    LABELS.header,
    ...status.services.map((service) => [service.service, service.container, service.state, service.health ?? ""]),
  ]);
}

async function configureStack(context: CliContext, sandbox: SandboxContext): Promise<void> {
  const withValue = context.values.get("with");
  const configured = (await readEnvValues(sandbox.envFile)) !== null;
  if (configured && withValue === undefined) return;
  const report = await probeDocker({ env: context.env, signal: context.signal }).catch(() => null);
  const choices = await savedChoices(sandbox, defaultChoices(hostResources(), report));
  const selection = withValue === undefined ? null : parseComponents(withValue);
  selection?.notes.forEach((note) => log(context, note));
  const stack = await writeStack(sandbox, selection ? { ...choices, components: selection.components } : choices, {
    maxCpus: report?.server?.ncpu || undefined,
    memBytes: report?.server?.memBytes || undefined,
  });
  log(context, LABELS.configured(stack.envFile));
}

async function build(context: CliContext, sandbox: SandboxContext): Promise<number> {
  await configureStack(context, sandbox);
  return runStackBuild(context, sandbox, buildMode(context.flags));
}

export async function runStackBuild(context: CliContext, sandbox: SandboxContext, mode: BuildMode): Promise<number> {
  const progress = createProgress(context);
  let lastKind: BuildPhase["kind"] | null = null;
  const onPhase = (phase: BuildPhase) => {
    if (phase.kind === "building" || phase.kind === "pulling") {
      progress.update(phaseLine(phase));
    } else if (phase.kind !== lastKind) {
      progress.done();
      if (phase.kind !== "done" && phase.kind !== "failed" && phase.kind !== "cancelled") log(context, phaseLine(phase));
    }
    lastKind = phase.kind;
  };
  const onLog = (line: string) => {
    if (context.verbose) log(context, line);
  };
  const final = await runBuild(sandbox, mode, { onLog, onPhase }, context.signal);
  progress.done();
  emit(context, final, (phase) => [phaseLine(phase)]);
  if (final.kind === "done") return EXIT.ok;
  return final.kind === "cancelled" ? EXIT.interrupted : EXIT.error;
}

async function followLogs(context: CliContext, sandbox: SandboxContext, tail: number): Promise<number> {
  const { project, configured } = await stackProject(sandbox);
  const print = (line: string) => context.io.stdout(line);
  let args: string[];
  let env: NodeJS.ProcessEnv;
  if (configured) {
    const stack = await resolveStack(sandbox, "logs");
    args = composeArgs(stack, ["logs", "--no-color", "--follow", `--tail=${tail}`]);
    env = stack.env;
  } else {
    args = ["logs", "--follow", "--tail", String(tail), containerName(project)];
    env = scrubEnv(sandbox.env, SCRUBBED_ENV_PREFIXES, SCRUBBED_ENV_NAMES);
  }
  const result = await streamCommand("docker", args, { env, signal: context.signal, onStdout: print, onStderr: print });
  if (result.cancelled) return EXIT.ok;
  if (result.error) throw new Error(result.error);
  return result.code === 0 ? EXIT.ok : EXIT.error;
}

async function logs(context: CliContext, sandbox: SandboxContext): Promise<number> {
  const raw = context.values.get("tail");
  const tail = raw === undefined ? DEFAULT_LOG_TAIL : positiveInt(raw);
  if (tail === null) usageError(CLI_LABELS.invalidValue("tail", raw ?? ""));
  if (context.flags.has("follow")) return followLogs(context, sandbox, tail);
  const lines = await composeLogs(sandbox, tail);
  emit(context, { lines }, (value) => value.lines);
  return EXIT.ok;
}

async function withStatus(context: CliContext, start: string | null, action: () => Promise<SandboxStackStatus>): Promise<number> {
  if (start) log(context, start);
  emit(context, await action(), describeServices);
  return EXIT.ok;
}

type Action = (context: CliContext) => Promise<number>;
type SandboxAction = (context: CliContext, sandbox: SandboxContext) => Promise<number>;

function withSandbox(action: SandboxAction): Action {
  return async (context) => action(context, await context.runtime.sandboxContext());
}

const onLog = (context: CliContext) => ({ onLog: (line: string) => log(context, line) });

export const SANDBOX_ACTIONS: Record<string, Action> = {
  status: withSandbox((context, sandbox) => withStatus(context, null, () => composeStatus(sandbox))),
  up: withSandbox((context, sandbox) =>
    withStatus(context, LABELS.up, () => composeUp(sandbox, { ...onLog(context), signal: context.signal })),
  ),
  down: withSandbox((context, sandbox) =>
    withStatus(context, LABELS.down, () => composeDown(sandbox, context.flags.has("volumes"), onLog(context))),
  ),
  restart: withSandbox((context, sandbox) =>
    withStatus(context, LABELS.restart, () => composeRestart(sandbox, context.args[1] ?? null, onLog(context))),
  ),
  logs: withSandbox(logs),
  build: withSandbox(build),
  pair: runPair,
};

export default defineCommand({
  name: "sandbox",
  trigger: { subcommand: "sandbox" },
  summary: CLI_LABELS.summary.sandbox,
  usage: CLI_LABELS.usageLines.sandbox,
  flags: ["volumes", "follow", "pull", "existing", "no-qr"],
  valueFlags: ["tail", "with"],
  run: (context) =>
    guarded(context, async () => {
      const name = context.args[0] ?? "status";
      const action = SANDBOX_ACTIONS[name];
      if (!action) usageError(CLI_LABELS.unknownSubcommand("sandbox", name));
      return action(context);
    }),
});
