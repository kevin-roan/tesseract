import { join } from "node:path";
import { resolveControllerCommand } from "../../src/core/host";
import {
  ensureWorkspaceRunning,
  HOST_WORKSPACE,
  linkRepo,
  readPairing,
  type LinkedRepo,
  type WorkspacePairing,
  type WorkspaceRunner,
} from "../../src/core/host-workspace";
import { emit, guarded } from "../io";
import { CLI_LABELS } from "../labels";
import { renderQr } from "../qr";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.unsafeRepo;

export type { LinkedRepo, WorkspacePairing };

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

export function workspaceLogFile(context: CliContext): string {
  return join(context.runtime.userDataDir, ...HOST_WORKSPACE.logFile);
}

export async function runUnsafeRepo(context: CliContext): Promise<UnsafeRepoResult> {
  const runner: WorkspaceRunner = {
    command: controllerCommand(context),
    env: context.env,
    cwd: context.cwd,
    logFile: workspaceLogFile(context),
    signal: context.signal,
  };
  const name = context.values.get("name");
  const linked = await linkRepo(runner, context.cwd, { name });
  const pairing = await readPairing(runner);
  const started = await ensureWorkspaceRunning(runner, pairing.localUrl);
  return { ...linked, started, logFile: runner.logFile, pairing };
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
