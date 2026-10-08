import { posix, win32 } from "node:path";
import type { CliInstallStatus } from "../../shared/contracts/app";
import type { Platform } from "../../shared/runtime";
import { CLI_NAME } from "../../shared/runtime";
import { CLI_DEB_LINK_DIR, CLI_MAC_LINK_DIR, CLI_USER_COPY_DIR, CLI_USER_LINK_DIR, LEGACY_CLI_TARGETS } from "../constants";
import { CLI_INSTALL_LABELS } from "../labels";

export interface CliEnvironment {
  platform: Platform;
  packaged: boolean;
  resourcesPath: string;
  home: string;
  pathEnv: string;
  appImage: boolean;
  inApplicationsFolder: boolean;
}

export interface CliProbe {
  realpath(path: string): string | null;
  size(path: string): number | null;
}

export type CliInstallMethod = "admin-symlink" | "symlink" | "copy";

export interface CliPlan {
  status: CliInstallStatus;
  method: CliInstallMethod | null;
  copyPath: string | null;
}

export function cliBinaryPath(env: CliEnvironment): string | null {
  if (!env.packaged) return null;
  const file = env.platform === "win32" ? `${CLI_NAME}.exe` : CLI_NAME;
  return env.platform === "win32" ? win32.join(env.resourcesPath, "bin", file) : posix.join(env.resourcesPath, "bin", file);
}

export function pathContains(pathEnv: string, dir: string, platform: Platform): boolean {
  const separator = platform === "win32" ? ";" : ":";
  const normalise = (value: string) => {
    const trimmed = value.replace(/[\\/]+$/, "");
    return platform === "win32" ? trimmed.toLowerCase() : trimmed;
  };
  const wanted = normalise(dir);
  return pathEnv.split(separator).some((entry) => entry && normalise(entry) === wanted);
}

function status(state: CliInstallStatus["state"], binaryPath: string | null, linkPath: string | null, message: string | null = null): CliInstallStatus {
  return { state, binaryPath, linkPath, message };
}

function plan(value: CliInstallStatus, method: CliInstallMethod | null = null, copyPath: string | null = null): CliPlan {
  return { status: value, method, copyPath };
}

export function isLegacyCli(target: string | null): boolean {
  return target !== null && LEGACY_CLI_TARGETS.some((pattern) => pattern.test(target));
}

function linuxPlan(env: CliEnvironment, binary: string, probe: CliProbe): CliPlan {
  const deb = posix.join(CLI_DEB_LINK_DIR, CLI_NAME);
  const binaryTarget = probe.realpath(binary) ?? binary;
  if (!env.appImage && probe.realpath(deb) === binaryTarget) return plan(status("installed", binary, deb));
  const linkDir = posix.join(env.home, ...CLI_USER_LINK_DIR);
  const link = posix.join(linkDir, CLI_NAME);
  const onPath = pathContains(env.pathEnv, linkDir, "linux") ? null : CLI_INSTALL_LABELS.notOnPath(linkDir);
  const copyPath = env.appImage ? posix.join(env.home, ...CLI_USER_COPY_DIR, CLI_NAME) : null;
  const expected = copyPath ?? binaryTarget;
  const method: CliInstallMethod = copyPath ? "copy" : "symlink";
  const current = probe.realpath(link);
  if (current === expected) {
    if (copyPath && probe.size(copyPath) !== probe.size(binary)) {
      return plan(status("missing", binary, link, CLI_INSTALL_LABELS.outdated), method, copyPath);
    }
    return plan(status("installed", binary, link, onPath));
  }
  if (current === null || isLegacyCli(current)) return plan(status("missing", binary, link, onPath), method, copyPath);
  return plan(status("conflict", binary, link, CLI_INSTALL_LABELS.conflict(link)));
}

function macPlan(env: CliEnvironment, binary: string, probe: CliProbe): CliPlan {
  const link = posix.join(CLI_MAC_LINK_DIR, CLI_NAME);
  const current = probe.realpath(link);
  const binaryTarget = probe.realpath(binary) ?? binary;
  if (current === binaryTarget) return plan(status("installed", binary, link));
  if (!env.inApplicationsFolder) return plan(status("unsupported", binary, link, CLI_INSTALL_LABELS.translocated));
  if (current === null || isLegacyCli(current)) return plan(status("missing", binary, link), "admin-symlink");
  return plan(status("conflict", binary, link, CLI_INSTALL_LABELS.conflict(link)));
}

export function planCliInstall(env: CliEnvironment, probe: CliProbe): CliPlan {
  const binary = cliBinaryPath(env);
  if (!binary) return plan(status("unsupported", null, null, CLI_INSTALL_LABELS.dev));
  if (env.platform === "win32") {
    const dir = win32.dirname(binary);
    return pathContains(env.pathEnv, dir, "win32")
      ? plan(status("installed", binary, null, CLI_INSTALL_LABELS.windows))
      : plan(status("unsupported", binary, null, CLI_INSTALL_LABELS.windowsMissing));
  }
  return env.platform === "darwin" ? macPlan(env, binary, probe) : linuxPlan(env, binary, probe);
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function macInstallScript(binary: string, link: string): string {
  const command = `mkdir -p ${shellQuote(posix.dirname(link))} && ln -sfn ${shellQuote(binary)} ${shellQuote(link)}`;
  return `do shell script ${appleScriptString(command)} with administrator privileges`;
}
