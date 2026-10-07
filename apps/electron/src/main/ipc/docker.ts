import { shell } from "electron";
import { effectiveEnv, installDocker, installDocsKey, phaseFromReport, probeDocker, refreshProcessPath, startEngine, type DockerRunOptions } from "../../core/docker";
import { SERVICE_MESSAGES } from "../../core/docker/labels";
import { LogRing } from "../../core/log";
import { ONBOARDING_URLS } from "../../core/onboarding/urls";
import { downloadsDir } from "../../core/paths";
import type { DockerInstallRequest, DockerPhase, DockerReport } from "../../shared/contracts/docker";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const events = serviceEmitter("docker");
const log = new LogRing();
const STICKY_PHASES: readonly DockerPhase["kind"][] = ["needs-relogin", "needs-reboot"];
let phase: DockerPhase = { kind: "idle" };
let operation: AbortController | null = null;

function setPhase(next: DockerPhase): DockerPhase {
  phase = next;
  events.emit("phase", phase);
  return phase;
}

function emitReport(next: DockerReport): void {
  events.emit("report", next);
}

function options(signal?: AbortSignal): DockerRunOptions {
  return {
    env: effectiveEnv(),
    signal,
    downloadsDir: downloadsDir(mainContext().paths),
    onLog: (line) => log.push(line).forEach((entry) => events.emit("log", entry)),
    onPhase: setPhase,
    onReport: emitReport,
  };
}

function settledPhase(previous: DockerPhase, next: DockerReport): DockerPhase {
  const result = phaseFromReport(next, process.platform);
  return result.kind !== "ready" && STICKY_PHASES.includes(previous.kind) ? previous : result;
}

async function exclusive(run: (signal: AbortSignal) => Promise<DockerPhase>): Promise<DockerPhase> {
  if (operation) throw new IpcError("unavailable", SERVICE_MESSAGES.busy);
  const controller = new AbortController();
  const previous = phase;
  operation = controller;
  try {
    const next = await run(controller.signal);
    refreshProcessPath();
    return setPhase(next);
  } catch (error) {
    setPhase(previous);
    throw error;
  } finally {
    operation = null;
  }
}

function validInstallRequest(request: unknown): request is DockerInstallRequest {
  const value = request as Partial<DockerInstallRequest> | null;
  return typeof value === "object" && value !== null && typeof value.option === "string" && typeof value.acceptLicense === "boolean";
}

export async function checkDocker(): Promise<DockerReport> {
  refreshProcessPath();
  if (operation) return probeDocker(options());
  const previous = phase;
  setPhase({ kind: "checking" });
  try {
    const next = await probeDocker(options());
    setPhase(settledPhase(previous, next));
    return next;
  } catch (error) {
    setPhase(previous);
    throw error;
  }
}

export function dockerPhase(): DockerPhase {
  return phase;
}

export async function installDockerEngine(request: unknown): Promise<DockerPhase> {
  if (!validInstallRequest(request)) throw new IpcError("invalid_argument", SERVICE_MESSAGES.invalidRequest);
  const docs = installDocsKey(request.option, process.platform);
  if (docs) {
    await shell.openExternal(ONBOARDING_URLS[docs]);
    return phase;
  }
  return exclusive((signal) => installDocker(request, options(signal)));
}

export function startDocker(): Promise<DockerPhase> {
  return exclusive(async (signal) => startEngine(await probeDocker(options(signal)), options(signal)));
}

export function dockerLog(): string[] {
  return log.snapshot();
}

export default defineService(
  "docker",
  {
    check: () => checkDocker(),
    phase: () => phase,
    install: (_context, request) => installDockerEngine(request),
    start: () => startDocker(),
    cancel: () => {
      operation?.abort();
      return phase;
    },
    log: () => log.snapshot(),
  },
  {
    start: () => () => {
      operation?.abort();
    },
  },
);
