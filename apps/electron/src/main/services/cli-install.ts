import { lstatSync, realpathSync, statSync } from "node:fs";
import { chmod, copyFile, mkdir, rename, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { app } from "electron";
import { runCommand } from "../../core/process";
import type { CliInstallStatus } from "../../shared/contracts/app";
import { IpcError } from "../../shared/ipc-types";
import { BUNDLED_SANDBOX_DIR, CLI_INSTALL_TIMEOUT_MS, OSASCRIPT_CANCELLED } from "../constants";
import { platform } from "../context";
import { CLI_INSTALL_LABELS } from "../labels";
import { macInstallScript, planCliInstall, type CliEnvironment, type CliPlan, type CliProbe } from "./cli-plan";
import { refreshInstallSidecar, type InstallSidecarFile } from "./cli-sidecar";

const EXECUTABLE_MODE = 0o755;

const probe: CliProbe = {
  realpath: (path) => {
    try {
      return realpathSync(path);
    } catch {
      return null;
    }
  },
  size: (path) => {
    try {
      return statSync(path).size;
    } catch {
      return null;
    }
  },
};

function environment(): CliEnvironment {
  return {
    platform: platform(),
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    home: homedir(),
    pathEnv: process.env.PATH ?? process.env.Path ?? "",
    appImage: Boolean(process.env.APPIMAGE),
    inApplicationsFolder: platform() === "darwin" && app.isPackaged ? app.isInApplicationsFolder() : true,
  };
}

function currentPlan(): CliPlan {
  return planCliInstall(environment(), probe);
}

export function cliStatus(): CliInstallStatus {
  return currentPlan().status;
}

function isLink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

async function replaceLink(target: string, link: string): Promise<void> {
  await mkdir(dirname(link), { recursive: true });
  if (isLink(link)) await rm(link, { force: true });
  await symlink(target, link);
}

async function installCopy(binary: string, copyPath: string, link: string): Promise<void> {
  await mkdir(dirname(copyPath), { recursive: true });
  const temp = `${copyPath}.${process.pid}.tmp`;
  await copyFile(binary, temp);
  await chmod(temp, EXECUTABLE_MODE);
  await rename(temp, copyPath);
  await replaceLink(copyPath, link);
}

async function installWithAdmin(binary: string, link: string): Promise<void> {
  const result = await runCommand("osascript", ["-e", macInstallScript(binary, link)], { timeoutMs: CLI_INSTALL_TIMEOUT_MS });
  if (result.code === 0) return;
  if (result.stderr.includes(OSASCRIPT_CANCELLED)) throw new IpcError("cancelled", CLI_INSTALL_LABELS.cancelled);
  throw new IpcError("internal", CLI_INSTALL_LABELS.failed(result.stderr.trim() || String(result.code)));
}

export async function refreshCliSidecar(): Promise<InstallSidecarFile | null> {
  const appImage = process.env.APPIMAGE;
  if (!app.isPackaged || platform() !== "linux" || !appImage) return null;
  return refreshInstallSidecar({ home: homedir(), appImage, bundledSandboxDir: join(process.resourcesPath, BUNDLED_SANDBOX_DIR) });
}

export async function installCli(): Promise<CliInstallStatus> {
  const { status, method, copyPath } = currentPlan();
  if (status.state !== "missing" || !method || !status.binaryPath || !status.linkPath) return status;
  try {
    if (method === "admin-symlink") await installWithAdmin(status.binaryPath, status.linkPath);
    else if (method === "copy" && copyPath) {
      await installCopy(status.binaryPath, copyPath, status.linkPath);
      await refreshCliSidecar();
    }
    else await replaceLink(status.binaryPath, status.linkPath);
  } catch (error) {
    if (error instanceof IpcError) throw error;
    throw new IpcError("internal", CLI_INSTALL_LABELS.failed(error instanceof Error ? error.message : String(error)));
  }
  return cliStatus();
}
