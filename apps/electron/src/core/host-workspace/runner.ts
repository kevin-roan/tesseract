import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname } from "node:path";
import { parsePairingLink } from "@tesseract/protocol";
import { IpcError } from "../../shared/ipc-types";
import { abortableSleep } from "../docker/system";
import { runCommand } from "../process";
import { HOST_WORKSPACE } from "./constants";
import { HOST_WORKSPACE_LABELS as L } from "./labels";

export interface WorkspaceRunner {
  /** `tesseract-controller` argv, e.g. `["bun", "apps/controller/src/index.ts"]`. */
  command: readonly string[];
  env: NodeJS.ProcessEnv;
  cwd?: string;
  logFile: string;
  signal?: AbortSignal;
}

export interface LinkedRepo {
  id: string;
  path: string;
  created: boolean;
}

export interface WorkspacePairing {
  link: string;
  url: string;
  localUrl: string;
  name: string;
}

export async function workspaceCommand<T>(runner: WorkspaceRunner, args: readonly string[]): Promise<T> {
  const [file = "", ...prefix] = runner.command;
  const result = await runCommand(file, [...prefix, ...HOST_WORKSPACE.workspaceArgs, ...args, "--json"], {
    env: runner.env,
    cwd: runner.cwd,
    timeoutMs: HOST_WORKSPACE.cliTimeoutMs,
    signal: runner.signal,
  });
  if (result.code !== 0) throw new IpcError("unavailable", L.failed(result.stderr.trim().replace(/^error:\s*/i, "") || `exit ${result.code}`));
  return JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "") as T;
}

export function linkRepo(runner: WorkspaceRunner, path: string, naming: { name?: string; id?: string } = {}): Promise<LinkedRepo> {
  const flags = naming.id ? ["--id", naming.id] : naming.name ? ["--name", naming.name] : [];
  return workspaceCommand<LinkedRepo>(runner, ["add", path, ...flags]);
}

export function readPairing(runner: WorkspaceRunner): Promise<WorkspacePairing> {
  return workspaceCommand<WorkspacePairing>(runner, ["pair"]);
}

export function pairingToken(pairing: WorkspacePairing): string {
  const parsed = parsePairingLink(pairing.link);
  if (!parsed.ok) throw new IpcError("unavailable", L.badPairing);
  return parsed.value.token;
}

export async function workspaceHealthy(localUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${localUrl}${HOST_WORKSPACE.healthPath}`, { signal: AbortSignal.timeout(HOST_WORKSPACE.healthTimeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

function launch(runner: WorkspaceRunner): void {
  const [file = "", ...prefix] = runner.command;
  mkdirSync(dirname(runner.logFile), { recursive: true });
  const log = openSync(runner.logFile, "a");
  const child = spawn(file, [...prefix, ...HOST_WORKSPACE.workspaceArgs, ...HOST_WORKSPACE.serveArgs], {
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
    env: runner.env,
  });
  child.on("error", () => {});
  child.unref();
}

export async function stopWorkspace(runner: WorkspaceRunner, localUrl: string): Promise<void> {
  await workspaceCommand<{ stopped: boolean }>(runner, ["stop"]);
  const deadline = Date.now() + HOST_WORKSPACE.startTimeoutMs;
  while (Date.now() < deadline && !runner.signal?.aborted && (await workspaceHealthy(localUrl))) {
    await abortableSleep(HOST_WORKSPACE.pollMs, runner.signal);
  }
}

/** Account ids the running controller offers; `null` when it can't be asked. */
export async function runningAccountIds(localUrl: string, token: string): Promise<string[] | null> {
  try {
    const response = await fetch(`${localUrl}${HOST_WORKSPACE.accountsPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(HOST_WORKSPACE.healthTimeoutMs),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { accounts?: { id?: unknown }[] };
    return (body.accounts ?? []).map((account) => String(account.id));
  } catch {
    return null;
  }
}

/** Starts `host workspace serve` detached unless it already answers; `true` when it was started. */
export async function ensureWorkspaceRunning(runner: WorkspaceRunner, localUrl: string): Promise<boolean> {
  if (await workspaceHealthy(localUrl)) return false;
  launch(runner);
  const deadline = Date.now() + HOST_WORKSPACE.startTimeoutMs;
  while (Date.now() < deadline && !runner.signal?.aborted) {
    await abortableSleep(HOST_WORKSPACE.pollMs, runner.signal);
    if (await workspaceHealthy(localUrl)) return true;
  }
  throw new IpcError("unavailable", L.notStarted(localUrl, runner.logFile));
}
