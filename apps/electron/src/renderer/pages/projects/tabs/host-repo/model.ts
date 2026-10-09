import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import type { HostGitAction, SyncLinkSummary } from "../../../../../shared/contracts/syncback";
import type { IconName } from "../../../../theme/icons";
import { HOST_GIT_ICON, HOST_REPO_ICONS } from "./constants";
import { HOST_REPO_LABELS as L } from "./labels";

export type HostRepoAction = "shell" | HostGitAction;

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

const LABELS: Record<HostRepoAction, string> = { shell: L.shell, pull: L.pull, push: L.push, commit: L.commit };
const BUSY_LABELS: Record<HostRepoAction, string> = { shell: L.opening, pull: L.pulling, push: L.pushing, commit: L.committing };
const TOOLTIPS: Record<HostRepoAction, (path: string) => string> = {
  shell: L.shellTooltip,
  pull: L.pullTooltip,
  push: L.pushTooltip,
  commit: L.commitTooltip,
};

export function hostPathFor(links: readonly SyncLinkSummary[] | undefined, projectId: string): string | null {
  return links?.find((link) => link.projectId === projectId)?.hostPath ?? null;
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
  const running = busy !== null && busy !== "shell";
  return {
    label: running ? BUSY_LABELS[busy] : L.git,
    icon: HOST_GIT_ICON,
    tooltip: hostPath === null ? L.noCopy : L.gitTooltip(hostPath),
    disabled: hostPath === null,
    busy: running,
  };
}
