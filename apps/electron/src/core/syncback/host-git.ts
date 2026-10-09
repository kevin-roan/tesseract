import type { HostGitAction, HostGitResult } from "../../shared/contracts/syncback";
import { commandError, runCommand, type CommandResult } from "../process";
import { HOST_GIT_ARGS, HOST_GIT_ENV, HOST_GIT_TIMEOUT_MS } from "./constants";
import { SyncBackError } from "./errors";
import { SYNC_LABELS } from "./labels";
import { requireLink } from "./pull";
import type { SyncState } from "./state";

export type GitRunner = (args: readonly string[], cwd: string) => Promise<CommandResult>;

const runGit: GitRunner = (args, cwd) =>
  runCommand("git", ["-C", cwd, ...args], { cwd, timeoutMs: HOST_GIT_TIMEOUT_MS, env: { ...process.env, ...HOST_GIT_ENV } });

function gitSteps(action: HostGitAction, message: string | undefined): (readonly string[])[] {
  if (action !== "commit") return [HOST_GIT_ARGS[action]];
  const text = message?.trim();
  if (!text) throw new SyncBackError(SYNC_LABELS.commitMessageRequired);
  return [HOST_GIT_ARGS.stage, ["commit", "-m", text]];
}

export async function hostGit(
  state: SyncState,
  projectId: string,
  action: HostGitAction,
  message?: string,
  run: GitRunner = runGit,
): Promise<HostGitResult> {
  const { hostPath } = await requireLink(state, projectId);
  const outputs: string[] = [];
  for (const args of gitSteps(action, message)) {
    const result = await run(args, hostPath);
    if (result.timedOut || result.code !== 0) throw new SyncBackError(commandError("git", args, result));
    outputs.push(`${result.stdout}\n${result.stderr}`.trim());
  }
  return { action, hostPath, output: outputs.filter(Boolean).join("\n") };
}
