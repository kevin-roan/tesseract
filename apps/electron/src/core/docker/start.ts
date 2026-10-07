import { commandError } from "../process";
import type { DockerPhase, DockerReport } from "../../shared/contracts/docker";
import { IpcError } from "../../shared/ipc-types";
import { phaseFromReport } from "./checks";
import {
  DOCKER_DESKTOP_USER_SERVICE,
  DOCKER_SERVICE,
  ELEVATED_TIMEOUT_MS,
  ENGINE_START_POLL_MS,
  ENGINE_START_TIMEOUT_MS,
  SYSTEMD_RUN_DIR,
} from "./constants";
import { pkexecOutcome } from "./elevate";
import { LOG_MESSAGES, PHASE_MESSAGES } from "./labels";
import { collectReport, readDaemon, windowsDesktopExeCandidates } from "./probe";
import { createRuntime, describeCommand, runQuiet, streamLogged, throwIfAborted, type DockerRunOptions, type DockerRuntime } from "./runtime";

export type StartCommand =
  | { mode: "run"; file: string; args: string[]; elevated: boolean }
  | { mode: "launch"; file: string; args: string[] };

export async function startCommand(runtime: DockerRuntime, report: DockerReport): Promise<StartCommand | null> {
  const { platform } = runtime.host;
  const which = (name: string) => runtime.system.which(name, runtime.env, platform);
  if (platform === "darwin") {
    if (report.kind === "colima") return { mode: "run", file: "colima", args: ["start"], elevated: false };
    if (report.kind === "orbstack") return { mode: "run", file: "orb", args: ["start"], elevated: false };
    return { mode: "run", file: "open", args: ["-a", "Docker"], elevated: false };
  }
  if (platform === "win32") {
    if (report.cli) {
      const desktop = await runQuiet(runtime, report.cli.path, ["desktop", "version"]);
      if (desktop.code === 0) return { mode: "run", file: report.cli.path, args: ["desktop", "start"], elevated: false };
    }
    const exe =
      report.windows?.desktopExe ?? windowsDesktopExeCandidates(runtime.env, runtime.host.home).find((path) => runtime.system.exists(path));
    return exe ? { mode: "launch", file: exe, args: [] } : null;
  }
  if (!(report.linux?.systemd ?? runtime.system.exists(SYSTEMD_RUN_DIR))) return null;
  if (report.kind === "rootless") return { mode: "run", file: "systemctl", args: ["--user", "start", DOCKER_SERVICE], elevated: false };
  if (report.kind === "desktop") {
    return { mode: "run", file: "systemctl", args: ["--user", "start", DOCKER_DESKTOP_USER_SERVICE], elevated: false };
  }
  const pkexec = which("pkexec");
  return pkexec ? { mode: "run", file: pkexec, args: ["systemctl", "start", DOCKER_SERVICE], elevated: true } : null;
}

export function startTimeoutMs(platform: NodeJS.Platform): number {
  return platform === "win32" ? ENGINE_START_TIMEOUT_MS.win32 : ENGINE_START_TIMEOUT_MS.default;
}

export async function waitForEngine(runtime: DockerRuntime, cli: string, since: number): Promise<boolean> {
  const timeout = startTimeoutMs(runtime.host.platform);
  while (runtime.system.now() - since < timeout) {
    throwIfAborted(runtime, PHASE_MESSAGES.startCancelled);
    const state = await readDaemon(runtime, cli, false);
    if (state.daemon === "reachable") return true;
    runtime.log(LOG_MESSAGES.polling(Math.round((runtime.system.now() - since) / 1000)));
    await runtime.system.sleep(ENGINE_START_POLL_MS, runtime.signal);
  }
  throwIfAborted(runtime, PHASE_MESSAGES.startCancelled);
  return false;
}

export async function refreshPhase(runtime: DockerRuntime): Promise<DockerPhase> {
  const report = await collectReport(runtime);
  runtime.report(report);
  return phaseFromReport(report, runtime.host.platform);
}

async function runStartCommand(runtime: DockerRuntime, command: StartCommand): Promise<DockerPhase | null> {
  if (command.mode === "launch") {
    runtime.log(LOG_MESSAGES.run(describeCommand(command.file, command.args)));
    runtime.system.launch(command.file, command.args, runtime.env);
    return null;
  }
  const timeout = command.elevated ? ELEVATED_TIMEOUT_MS : startTimeoutMs(runtime.host.platform);
  const result = await streamLogged(runtime, command.file, command.args, timeout);
  throwIfAborted(runtime, PHASE_MESSAGES.startCancelled);
  const outcome = command.elevated ? pkexecOutcome(result) : result.code === 0 ? "ok" : "failed";
  if (outcome === "cancelled") throw new IpcError("cancelled", PHASE_MESSAGES.startCancelled);
  if (outcome === "no-agent") {
    runtime.log(`sudo systemctl start ${DOCKER_SERVICE}`);
    return { kind: "blocked", reason: PHASE_MESSAGES.noAgent };
  }
  if (outcome === "failed") return { kind: "blocked", reason: PHASE_MESSAGES.commandFailed(commandError(command.file, command.args, result)) };
  return null;
}

export async function startWithRuntime(runtime: DockerRuntime, report: DockerReport): Promise<DockerPhase> {
  if (!report.cli) return refreshPhase(runtime);
  if (report.daemon === "reachable") return refreshPhase(runtime);
  if (report.daemon === "permission") return { kind: "blocked", reason: PHASE_MESSAGES.startPermission };
  const command = await startCommand(runtime, report);
  if (!command) return { kind: "blocked", reason: PHASE_MESSAGES.noStartCommand };
  const since = runtime.system.now();
  runtime.phase({ kind: "starting", since });
  const failure = await runStartCommand(runtime, command);
  if (failure) return failure;
  if (!(await waitForEngine(runtime, report.cli.path, since))) {
    return { kind: "blocked", reason: PHASE_MESSAGES.startTimeout(Math.round(startTimeoutMs(runtime.host.platform) / 1000)) };
  }
  runtime.log(LOG_MESSAGES.ready);
  return refreshPhase(runtime);
}

export async function startEngine(report: DockerReport, options: DockerRunOptions = {}): Promise<DockerPhase> {
  return startWithRuntime(createRuntime(options), report);
}
