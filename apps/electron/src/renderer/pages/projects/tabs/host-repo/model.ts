import type { AgentRun } from "@tesseract/protocol";
import type { ChoiceOption } from "../../../../components/ChoiceDropdown";
import { runTitle } from "../../../../features/agents/model";
import { HOST_TERMINAL_KINDS, type HostShellState, type HostTerminalKind } from "../../../../../shared/contracts/hostShell";
import type { HostGitAction, SyncLinkSummary } from "../../../../../shared/contracts/syncback";
import type { IconName } from "../../../../theme/icons";
import { HOST_GIT_ICON, HOST_REPO_ICONS } from "./constants";
import { HOST_REPO_LABELS as L } from "./labels";

export type HostRepoAction = HostTerminalKind | HostGitAction;

export interface HostRepoButton {
  id: HostRepoAction;
  label: string;
  icon: IconName;
  tooltip: string;
  disabled: boolean;
  busy: boolean;
}

export interface GitTrigger {
  label: string;
  icon: IconName;
  tooltip: string;
  disabled: boolean;
  busy: boolean;
}

export interface HostFolder {
  name: string;
  path: string;
}

const LABELS: Record<HostRepoAction, string> = { claude: L.claude, shell: L.shell, pull: L.pull, push: L.push, commit: L.commit };
const BUSY_LABELS: Record<HostRepoAction, string> = {
  claude: L.opening,
  shell: L.opening,
  pull: L.pulling,
  push: L.pushing,
  commit: L.committing,
};
const TOOLTIPS: Record<HostRepoAction, (path: string) => string> = {
  claude: L.claudeTooltip,
  shell: L.shellTooltip,
  pull: L.pullTooltip,
  push: L.pushTooltip,
  commit: L.commitTooltip,
};

export function hostPathFor(links: readonly SyncLinkSummary[] | undefined, projectId: string): string | null {
  return links?.find((link) => link.projectId === projectId)?.hostPath ?? null;
}

export function isTerminalAction(action: HostRepoAction): action is HostTerminalKind {
  return HOST_TERMINAL_KINDS.some((kind) => kind === action);
}

export function hostFolder(hostPath: string | null): HostFolder | null {
  if (hostPath === null) return null;
  const trimmed = hostPath.replace(/[\\/]+$/, "");
  const name = trimmed.split(/[\\/]/).at(-1);
  return { name: name || hostPath, path: hostPath };
}

export function terminalFailure(kind: HostTerminalKind, error: string): string {
  return kind === "claude" ? L.claudeFailed(error) : L.shellFailed(error);
}

export function hostShellBlocker(state: HostShellState | null): string | null {
  if (state === null) return L.hostLoading;
  if (state.status === "stopped" || state.status === "stopping" || state.status === "failed") return L.hostStopped;
  if (state.status === "starting" || state.pairing === null) return L.hostLoading;
  if (!state.pairing.pinSet) return L.hostNoPin;
  return null;
}

export function gitSummary(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? L.upToDate;
}

export function hostRepoButton(id: HostRepoAction, hostPath: string | null, busy: HostRepoAction | null): HostRepoButton {
  return {
    id,
    label: busy === id ? BUSY_LABELS[id] : LABELS[id],
    icon: HOST_REPO_ICONS[id],
    tooltip: hostPath === null ? L.noCopy : TOOLTIPS[id](hostPath),
    disabled: hostPath === null || busy !== null,
    busy: busy === id,
  };
}

export function gitTrigger(hostPath: string | null, busy: HostRepoAction | null): GitTrigger {
  const running = busy !== null && !isTerminalAction(busy);
  return {
    label: running ? BUSY_LABELS[busy] : L.git,
    icon: HOST_GIT_ICON,
    tooltip: hostPath === null ? L.noCopy : L.gitTooltip(hostPath),
    disabled: hostPath === null,
    busy: running,
  };
}

export const NEW_CHAT = "new";

export function hostChatOptions(runs: readonly AgentRun[] | undefined, limit = 30): ChoiceOption[] {
  const recent = [...(runs ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  return [{ id: NEW_CHAT, label: L.newChat }, ...recent.map((run) => ({ id: run.id, label: runTitle(run.prompt) }))];
}
