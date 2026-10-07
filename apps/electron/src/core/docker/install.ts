import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOWNLOAD_URLS } from "../onboarding/urls";
import { commandError } from "../process";
import type { DockerInstallOption, DockerInstallRequest, DockerPhase } from "../../shared/contracts/docker";
import type { OnboardingUrlKey } from "../../shared/contracts/onboarding";
import { IpcError } from "../../shared/ipc-types";
import {
  DOCKER_GROUP,
  ELEVATED_TIMEOUT_MS,
  GET_DOCKER_LAST_LINE,
  GET_DOCKER_SCRIPT,
  GET_DOCKER_SHEBANG,
  INSTALL_TIMEOUT_MS,
  KVM_GROUP,
  MAC_DMG,
  MAC_INSTALLER_DISPLAY,
  MIN_MAC_OS_VERSION,
  OS_RELEASE,
  WIN_INSTALLER,
} from "./constants";
import { downloadVerified } from "./download";
import {
  groupCommand,
  linuxFamily,
  linuxInstallSteps,
  manualGroupCommand,
  macInstallScript,
  manualLinuxCommands,
  osascriptAdminArgs,
  osascriptOutcome,
  pkexecOutcome,
  powershellElevated,
  windowsOutcome,
  type ElevationOutcome,
} from "./elevate";
import { LOG_MESSAGES, PHASE_MESSAGES } from "./labels";
import { applyPathFix } from "./path-fix";
import { parseMinimumSystemVersion, parseOsRelease } from "./parse";
import { collectReport, platformBlock, readGroupMembership, readMacVersion, readWslVersion } from "./probe";
import { createRuntime, describeCommand, isCancelled, runQuiet, streamLogged, throwIfAborted, type DockerRunOptions, type DockerRuntime } from "./runtime";
import { refreshPhase, startWithRuntime } from "./start";

const PLATFORM_OPTIONS: Partial<Record<NodeJS.Platform, readonly DockerInstallOption[]>> = {
  darwin: ["desktop", "manual"],
  win32: ["desktop", "desktop-user", "wsl", "manual"],
  linux: ["engine", "desktop-linux", "manual", "docker-group", "kvm-group"],
};

const LICENSED_OPTIONS: readonly DockerInstallOption[] = ["desktop", "desktop-user"];

export function installOptions(platform: NodeJS.Platform): readonly DockerInstallOption[] {
  return PLATFORM_OPTIONS[platform] ?? [];
}

export function installDocsKey(option: DockerInstallOption, platform: NodeJS.Platform): OnboardingUrlKey | null {
  if (option === "desktop-linux") return "docker_desktop_linux_docs";
  if (option !== "manual") return null;
  if (platform === "darwin") return "docker_mac_docs";
  if (platform === "win32") return "docker_windows_docs";
  return "docker_engine_docs";
}

function installing(runtime: DockerRuntime): void {
  runtime.phase({ kind: "installing", stage: "installing", received: 0, total: null });
}

function cancelled(): never {
  throw new IpcError("cancelled", PHASE_MESSAGES.installCancelled);
}

function failure(command: string, args: readonly string[], result: Parameters<typeof commandError>[2]): DockerPhase {
  return { kind: "blocked", reason: PHASE_MESSAGES.commandFailed(commandError(command, args, result)) };
}

function logCommands(runtime: DockerRuntime, commands: readonly string[]): void {
  for (const command of commands) runtime.log(command);
}

export async function isCompleteGetDockerScript(path: string): Promise<boolean> {
  const text = await readFile(path, "utf8").catch(() => "");
  const lines = text.trimEnd().split("\n");
  return text.startsWith(GET_DOCKER_SHEBANG) && lines[lines.length - 1]?.trim() === GET_DOCKER_LAST_LINE;
}

function refreshEnv(runtime: DockerRuntime): void {
  runtime.env = applyPathFix(runtime.env, runtime.host.platform, runtime.host.home, (path) => runtime.system.exists(path));
}

async function startAfterInstall(runtime: DockerRuntime): Promise<DockerPhase> {
  refreshEnv(runtime);
  const report = await collectReport(runtime);
  runtime.report(report);
  return startWithRuntime(runtime, report);
}

function macArch(runtime: DockerRuntime, translated: boolean): "arm64" | "amd64" {
  return runtime.host.arch === "arm64" || translated ? "arm64" : "amd64";
}

async function macMinimum(runtime: DockerRuntime, arch: "arm64" | "amd64"): Promise<string> {
  try {
    const response = await runtime.system.fetch(DOWNLOAD_URLS.dockerMacAppcast(arch), { signal: runtime.signal });
    return (response.ok ? parseMinimumSystemVersion(await response.text()) : null) ?? MIN_MAC_OS_VERSION;
  } catch {
    return MIN_MAC_OS_VERSION;
  }
}

async function installMacDesktop(runtime: DockerRuntime): Promise<DockerPhase> {
  const translated = (await runQuiet(runtime, "sysctl", ["-in", "sysctl.proc_translated"])).stdout.trim() === "1";
  const arch = macArch(runtime, translated);
  const block = platformBlock(runtime, await readMacVersion(runtime), await macMinimum(runtime, arch));
  if (block) return { kind: "blocked", reason: block };
  const dmg = await downloadVerified(runtime, {
    url: DOWNLOAD_URLS.dockerMacDmg(arch),
    checksumsUrl: DOWNLOAD_URLS.dockerMacChecksums(arch),
    fileName: MAC_DMG,
    cancelMessage: PHASE_MESSAGES.installCancelled,
  });
  throwIfAborted(runtime, PHASE_MESSAGES.installCancelled);
  installing(runtime);
  const mountPoint = await mkdtemp(join(tmpdir(), "monolith-docker-"));
  try {
    const args = osascriptAdminArgs(macInstallScript(dmg, mountPoint, runtime.host.user));
    const result = await streamLogged(runtime, "osascript", args, INSTALL_TIMEOUT_MS, LOG_MESSAGES.elevated(MAC_INSTALLER_DISPLAY));
    const outcome = osascriptOutcome(result);
    if (outcome === "cancelled") cancelled();
    if (outcome !== "ok") return { kind: "blocked", reason: PHASE_MESSAGES.installFailed(result.code) };
  } finally {
    await rm(mountPoint, { recursive: true, force: true }).catch(() => {});
  }
  return startAfterInstall(runtime);
}

async function runWindowsElevated(runtime: DockerRuntime, file: string, args: readonly string[]): Promise<ElevationOutcome> {
  const powershellArgs = powershellElevated(file, args);
  const result = await streamLogged(runtime, "powershell", powershellArgs, INSTALL_TIMEOUT_MS, LOG_MESSAGES.elevated(describeCommand(file, args)));
  return windowsOutcome(result);
}

async function installWsl(runtime: DockerRuntime): Promise<DockerPhase | "installed"> {
  installing(runtime);
  const present = await readWslVersion(runtime);
  const outcome = await runWindowsElevated(runtime, "wsl.exe", present ? ["--update"] : ["--install", "--no-distribution"]);
  if (outcome === "cancelled") cancelled();
  if (outcome === "failed") return { kind: "blocked", reason: PHASE_MESSAGES.installFailed(null) };
  if (outcome === "reboot" || !present) return "installed";
  return refreshPhase(runtime);
}

async function installWindowsDesktop(runtime: DockerRuntime, perUser: boolean): Promise<DockerPhase> {
  const block = platformBlock(runtime, null);
  if (block) return { kind: "blocked", reason: block };
  let needsReboot = false;
  if (!(await readWslVersion(runtime))) {
    const wsl = await installWsl(runtime);
    if (wsl !== "installed") return wsl;
    needsReboot = true;
  }
  const arch = runtime.host.arch === "arm64" ? "arm64" : "amd64";
  const exe = await downloadVerified(runtime, {
    url: DOWNLOAD_URLS.dockerWinExe(arch),
    checksumsUrl: DOWNLOAD_URLS.dockerWinChecksums(arch),
    fileName: WIN_INSTALLER,
    cancelMessage: PHASE_MESSAGES.installCancelled,
  });
  throwIfAborted(runtime, PHASE_MESSAGES.installCancelled);
  installing(runtime);
  const args = perUser
    ? ["install", "--user", "--quiet", "--accept-license", "--backend=wsl-2"]
    : ["install", "--quiet", "--accept-license", "--backend=wsl-2", "--always-run-service"];
  const outcome = perUser
    ? windowsOutcome(await streamLogged(runtime, exe, args, INSTALL_TIMEOUT_MS))
    : await runWindowsElevated(runtime, exe, args);
  if (outcome === "cancelled") cancelled();
  if (outcome === "failed") return { kind: "blocked", reason: PHASE_MESSAGES.installFailed(null) };
  if (!perUser) runtime.log(LOG_MESSAGES.dockerUsers(runtime.host.user));
  if (outcome === "reboot" || needsReboot) return { kind: "needs-reboot" };
  return startAfterInstall(runtime);
}

async function runPkexec(runtime: DockerRuntime, script: string, timeoutMs: number, manual: readonly string[]): Promise<DockerPhase | null> {
  const pkexec = runtime.system.which("pkexec", runtime.env, runtime.host.platform);
  if (!pkexec) {
    logCommands(runtime, manual);
    return { kind: "blocked", reason: PHASE_MESSAGES.noPkexec, commands: [...manual] };
  }
  installing(runtime);
  const args = ["sh", "-c", script];
  const result = await streamLogged(runtime, pkexec, args, timeoutMs);
  throwIfAborted(runtime, PHASE_MESSAGES.installCancelled);
  const outcome = pkexecOutcome(result);
  if (outcome === "cancelled") cancelled();
  if (outcome === "no-agent") {
    logCommands(runtime, manual);
    return { kind: "blocked", reason: PHASE_MESSAGES.noAgent, commands: [...manual] };
  }
  if (outcome !== "ok") return failure("pkexec", args, result);
  return null;
}

async function afterGroupChange(runtime: DockerRuntime, group: string): Promise<DockerPhase> {
  refreshEnv(runtime);
  const membership = await readGroupMembership(runtime, group);
  return membership.current ? refreshPhase(runtime) : { kind: "needs-relogin" };
}

async function installLinuxEngine(runtime: DockerRuntime): Promise<DockerPhase> {
  const distro = parseOsRelease((await runtime.system.readText(OS_RELEASE)) ?? "");
  const family = linuxFamily(distro);
  const manual = manualLinuxCommands(family, runtime.host.user);
  if (family === "manual") {
    logCommands(runtime, manual);
    return { kind: "blocked", reason: PHASE_MESSAGES.manualInstall, commands: [...manual] };
  }
  if (!runtime.system.which("pkexec", runtime.env, runtime.host.platform)) {
    logCommands(runtime, manual);
    return { kind: "blocked", reason: PHASE_MESSAGES.noPkexec, commands: [...manual] };
  }
  const script =
    family === "convenience"
      ? await downloadVerified(runtime, {
          url: DOWNLOAD_URLS.dockerGetScript,
          fileName: GET_DOCKER_SCRIPT,
          cancelMessage: PHASE_MESSAGES.installCancelled,
          validate: isCompleteGetDockerScript,
        })
      : "";
  throwIfAborted(runtime, PHASE_MESSAGES.installCancelled);
  const failed = await runPkexec(runtime, linuxInstallSteps(family, runtime.host.user, script).join(" && "), INSTALL_TIMEOUT_MS, manual);
  return failed ?? afterGroupChange(runtime, DOCKER_GROUP);
}

async function addToGroup(runtime: DockerRuntime, group: string): Promise<DockerPhase> {
  const failed = await runPkexec(runtime, groupCommand(group, runtime.host.user), ELEVATED_TIMEOUT_MS, [manualGroupCommand(group)]);
  return failed ?? afterGroupChange(runtime, group);
}

export async function installWithRuntime(runtime: DockerRuntime, request: DockerInstallRequest): Promise<DockerPhase> {
  const { platform } = runtime.host;
  if (!installOptions(platform).includes(request.option)) {
    throw new IpcError("invalid_argument", PHASE_MESSAGES.unsupportedOption(request.option, platform));
  }
  if (LICENSED_OPTIONS.includes(request.option) && !request.acceptLicense) {
    throw new IpcError("invalid_argument", PHASE_MESSAGES.acceptLicense);
  }
  switch (request.option) {
    case "desktop":
      return platform === "darwin" ? installMacDesktop(runtime) : installWindowsDesktop(runtime, false);
    case "desktop-user":
      return installWindowsDesktop(runtime, true);
    case "wsl": {
      const result = await installWsl(runtime);
      return result === "installed" ? { kind: "needs-reboot" } : result;
    }
    case "engine":
      return installLinuxEngine(runtime);
    case "docker-group":
      return addToGroup(runtime, DOCKER_GROUP);
    case "kvm-group":
      return addToGroup(runtime, KVM_GROUP);
    default:
      return { kind: "idle" };
  }
}

export async function installDocker(request: DockerInstallRequest, options: DockerRunOptions = {}): Promise<DockerPhase> {
  const runtime = createRuntime(options);
  try {
    return await installWithRuntime(runtime, request);
  } catch (error) {
    if (error instanceof IpcError) throw error;
    if (isCancelled(error) || runtime.signal?.aborted) cancelled();
    const message = error instanceof Error ? error.message : String(error);
    runtime.log(message);
    return { kind: "blocked", reason: message };
  }
}
