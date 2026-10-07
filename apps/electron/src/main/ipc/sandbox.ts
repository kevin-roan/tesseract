import { cpus, homedir, totalmem } from "node:os";
import { effectiveEnv, probeDocker } from "../../core/docker";
import { LogRing } from "../../core/log";
import { runCommand } from "../../core/process";
import {
  adoptExisting,
  composeDown,
  composeLogs,
  composeStatus,
  composeUp,
  currentStack,
  defaultChoices,
  findExisting,
  readEnvValues,
  readPairing,
  runBuild,
  savedChoices,
  tailscaleIpv4,
  tailscaleVolumeExists,
  validateChoices,
  withoutSecrets,
  writeStack,
  DEFAULT_IMAGE,
  DEFAULT_PROJECT,
  SANDBOX_LABELS,
  type HostResources,
  type SandboxContext,
  type ValidationContext,
} from "../../core/sandbox";
import type { DockerReport } from "../../shared/contracts/docker";
import type { BuildFailurePhase, BuildMode, BuildPhase, SandboxStackStatus, SetupChoices } from "../../shared/contracts/sandbox";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { sandboxContext } from "../services/resources";
import { saveConnection } from "./connection";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const RESUMABLE: BuildFailurePhase[] = ["up", "health", "pair"];

const events = serviceEmitter("sandbox");
const log = new LogRing();
let phase: BuildPhase = { kind: "idle" };
let build: AbortController | null = null;
let lastMode: BuildMode | null = null;

function context(): SandboxContext {
  return {
    ...sandboxContext(),
    env: effectiveEnv(),
    configFile: mainContext().configFile,
    saveConnection: async (connection) => {
      await saveConnection(connection);
    },
  };
}

function setPhase(next: BuildPhase): BuildPhase {
  phase = next;
  events.emit("phase", phase);
  return phase;
}

function pushLog(text: string): void {
  for (const line of log.push(text)) events.emit("log", line);
}

function hostResources(): HostResources {
  return {
    cpus: cpus().length,
    memBytes: totalmem(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    homeDir: homedir(),
  };
}

async function dockerReport(): Promise<DockerReport | null> {
  return probeDocker({ env: effectiveEnv() }).catch(() => null);
}

async function emitStatus(status: SandboxStackStatus): Promise<SandboxStackStatus> {
  events.emit("status", status);
  return status;
}

async function refreshStatus(): Promise<void> {
  await composeStatus(context())
    .then(emitStatus)
    .catch(() => undefined);
}

async function validationContext(choices: SetupChoices): Promise<ValidationContext> {
  const ctx = context();
  const [report, saved] = await Promise.all([dockerReport(), readEnvValues(ctx.envFile)]);
  const host = hostResources();
  const needsVolume = choices.mode === "tailscale" && !choices.tsAuthKey.trim() && !saved?.TS_AUTHKEY;
  return {
    maxCpus: report?.server?.ncpu || host.cpus,
    memBytes: report?.server?.memBytes || host.memBytes,
    savedAuthKey: Boolean(saved?.TS_AUTHKEY),
    tailscaleVolumeExists: needsVolume ? await tailscaleVolumeExists({ run: runCommand }, ctx.env, choices.project) : false,
  };
}

export async function sandboxDefaults(): Promise<SetupChoices> {
  const ctx = context();
  const choices = await savedChoices(ctx, defaultChoices(hostResources(), await dockerReport()));
  if (choices.bindAddr) return withoutSecrets(choices);
  return withoutSecrets({ ...choices, bindAddr: await tailscaleIpv4({ run: runCommand }, ctx.env) });
}

export function startSandboxBuild(mode: BuildMode): BuildPhase {
  if (build) throw new IpcError("unavailable", SANDBOX_LABELS.build.alreadyRunning);
  const resumeFrom =
    phase.kind === "failed" && lastMode === mode && RESUMABLE.includes(phase.phase) ? phase.phase : undefined;
  if (!resumeFrom) log.clear();
  lastMode = mode;
  const controller = new AbortController();
  build = controller;
  setPhase({ kind: "preflight" });
  void runBuild(context(), mode, { onLog: pushLog, onPhase: setPhase }, controller.signal, { resumeFrom })
    .then((final) => {
      if (final !== phase) setPhase(final);
    })
    .catch((error: unknown) =>
      setPhase({ kind: "failed", phase: "build", message: error instanceof Error ? error.message : String(error) }),
    )
    .finally(() => {
      if (build === controller) build = null;
      void refreshStatus();
    });
  return phase;
}

export async function adoptSandbox(): Promise<BuildPhase> {
  if (build) throw new IpcError("unavailable", SANDBOX_LABELS.build.alreadyRunning);
  const controller = new AbortController();
  build = controller;
  lastMode = null;
  log.clear();
  setPhase({ kind: "preflight" });
  const stack = await currentStack(context()).catch(() => null);
  const target = { project: stack?.project ?? DEFAULT_PROJECT, image: stack?.image ?? DEFAULT_IMAGE };
  void adoptExisting(context(), target, { onLog: pushLog, onPhase: setPhase }, controller.signal)
    .then((final) => {
      if (final !== phase) setPhase(final);
    })
    .catch((error: unknown) =>
      setPhase({ kind: "failed", phase: "pair", message: error instanceof Error ? error.message : String(error) }),
    )
    .finally(() => {
      if (build === controller) build = null;
      void refreshStatus();
    });
  return phase;
}

export function cancelSandboxBuild(): BuildPhase {
  build?.abort();
  return phase;
}

export function sandboxBuildPhase(): BuildPhase {
  return phase;
}

export function sandboxBuildLog(): string[] {
  return log.snapshot();
}

export async function saveSandboxStack(choices: SetupChoices) {
  return writeStack(context(), choices, await validationContext(choices));
}

export function sandboxPairing() {
  return readPairing(context());
}

export default defineService(
  "sandbox",
  {
    defaults: () => sandboxDefaults(),
    validate: async (_context, choices) => validateChoices(choices, await validationContext(choices)),
    save: (_context, choices) => saveSandboxStack(choices),
    stack: () => currentStack(context()),
    existing: async () => {
      const stack = await currentStack(context());
      return findExisting(context(), stack?.project ?? DEFAULT_PROJECT, stack?.image ?? DEFAULT_IMAGE);
    },
    build: (_context, mode) => startSandboxBuild(mode),
    cancel: () => cancelSandboxBuild(),
    phase: () => phase,
    up: async () => emitStatus(await composeUp(context(), { onLog: pushLog })),
    down: async (_context, removeVolumes) => emitStatus(await composeDown(context(), removeVolumes, { onLog: pushLog })),
    status: () => composeStatus(context()),
    logs: (_context, tail) => composeLogs(context(), tail),
    pairing: () => sandboxPairing(),
  },
  {
    start: () => () => {
      build?.abort();
    },
  },
);
