import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { abortableSleep } from "../../src/core/docker/system";
import { resolveControllerCommand } from "../../src/core/host";
import { runCommand } from "../../src/core/process";
import { IpcError } from "../../src/shared/ipc-types";
import { UNSAFE_REPO } from "../constants";
import { emit, guarded } from "../io";
import { CLI_LABELS } from "../labels";
import { renderQr } from "../qr";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.unsafeRepo;

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

export interface UnsafeRepoResult extends LinkedRepo {
  started: boolean;
  logFile: string;
  pairing: WorkspacePairing;
}

function repoRoot(context: CliContext): string | null {
  try {
    return context.runtime.sandboxContextDir();
  } catch {
    return null;
  }
}

export function controllerCommand(context: CliContext): string[] {
  const resources = context.runtime.resourcesDir;
  return resolveControllerCommand({
    env: context.env,
    resourcesPath: resources,
    packaged: resources !== null,
    repoRoot: resources ? null : repoRoot(context),
    platform: context.runtime.platform,
  });
}

async function workspace<T>(context: CliContext, command: string[], args: readonly string[]): Promise<T> {
  const [file = "", ...prefix] = command;
  const result = await runCommand(file, [...prefix, ...UNSAFE_REPO.workspaceArgs, ...args, "--json"], {
    env: context.env,
    cwd: context.cwd,
    timeoutMs: UNSAFE_REPO.cliTimeoutMs,
    signal: context.signal,
  });
  if (result.code !== 0) throw new IpcError("unavailable", LABELS.failed(result.stderr.trim().replace(/^error:\s*/i, "") || `exit ${result.code}`));
  return JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "") as T;
}

async function healthy(localUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${localUrl}${UNSAFE_REPO.healthPath}`, { signal: AbortSignal.timeout(UNSAFE_REPO.healthTimeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

export function workspaceLogFile(context: CliContext): string {
  return join(context.runtime.userDataDir, ...UNSAFE_REPO.logFile);
}

function launch(context: CliContext, command: string[], logFile: string): void {
  const [file = "", ...prefix] = command;
  mkdirSync(dirname(logFile), { recursive: true });
  const log = openSync(logFile, "a");
  const child = spawn(file, [...prefix, ...UNSAFE_REPO.workspaceArgs, ...UNSAFE_REPO.serveArgs], {
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
    env: context.env,
  });
  child.on("error", () => {});
  child.unref();
}

async function ensureRunning(context: CliContext, command: string[], localUrl: string, logFile: string): Promise<boolean> {
  if (await healthy(localUrl)) return false;
  launch(context, command, logFile);
  const deadline = Date.now() + UNSAFE_REPO.startTimeoutMs;
  while (Date.now() < deadline && !context.signal.aborted) {
    await abortableSleep(UNSAFE_REPO.pollMs, context.signal);
    if (await healthy(localUrl)) return true;
  }
  throw new IpcError("unavailable", LABELS.notStarted(localUrl, logFile));
}

export async function runUnsafeRepo(context: CliContext): Promise<UnsafeRepoResult> {
  const command = controllerCommand(context);
  const name = context.values.get("name");
  const linked = await workspace<LinkedRepo>(context, command, ["add", context.cwd, ...(name ? ["--name", name] : [])]);
  const pairing = await workspace<WorkspacePairing>(context, command, ["pair"]);
  const logFile = workspaceLogFile(context);
  const started = await ensureRunning(context, command, pairing.localUrl, logFile);
  return { ...linked, started, logFile, pairing };
}

export function unsafeRepoLines(result: UnsafeRepoResult, options: { qr: boolean; color: boolean }): string[] {
  return [
    result.created ? LABELS.linked(result.path, result.id) : LABELS.alreadyLinked(result.path, result.id),
    LABELS.warning,
    result.started ? LABELS.started(result.pairing.url, result.logFile) : LABELS.running(result.pairing.url),
    "",
    LABELS.pairHint(result.pairing.name),
    result.pairing.link,
    ...(options.qr ? ["", ...renderQr(result.pairing.link, options.color)] : []),
  ];
}

export default defineCommand({
  name: "--unsafe-repo",
  trigger: { flag: "unsafe-repo" },
  summary: CLI_LABELS.help.unsafeRepo,
  flags: ["qr"],
  valueFlags: ["name"],
  run: (context) =>
    guarded(context, async () => {
      const result = await runUnsafeRepo(context);
      emit(context, result, (value) => unsafeRepoLines(value, { qr: context.flags.has("qr"), color: Boolean(context.io.color) }));
      return EXIT.ok;
    }),
});
