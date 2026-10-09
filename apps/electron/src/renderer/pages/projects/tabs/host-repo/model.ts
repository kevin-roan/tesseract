import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import type { HostGitAction, SyncLinkSummary } from "../../../../../shared/contracts/syncback";
import type { IconName } from "../../../../theme/icons";
import { HOST_REPO_ACTIONS, HOST_REPO_ICONS } from "./constants";
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

const LABELS: Record<HostRepoAction, string> = { shell: L.shell, pull: L.pull, push: L.push };
const BUSY_LABELS: Record<HostRepoAction, string> = { shell: L.opening, pull: L.pulling, push: L.pushing };
const TOOLTIPS: Record<HostRepoAction, (path: string) => string> = { shell: L.shellTooltip, pull: L.pullTooltip, push: L.pushTooltip };

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

export function hostRepoButtons(hostPath: string | null, busy: HostRepoAction | null): HostRepoButton[] {
  return HOST_REPO_ACTIONS.map((id) => ({
    id,
    label: busy === id ? BUSY_LABELS[id] : LABELS[id],
    icon: HOST_REPO_ICONS[id],
    tooltip: hostPath === null ? L.noCopy : TOOLTIPS[id](hostPath),
    disabled: hostPath === null || busy !== null,
    busy: busy === id,
  }));
}
