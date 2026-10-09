import type { AgentRun, BuildJob, ClaudeAccountList, GitDetails, ProcessInfo, Project } from "@tesseract/protocol";
import type { SemanticColor } from "../../theme/colors";
import { BRANCH_CHARS, PROJECTS_ICONS, PROJECT_TABS } from "./constants";
import { CONFIDENTIAL_LABEL, GIT_LABELS, TAB_LABELS } from "./labels";
import { joinMeta } from "./format";
import { activeBuildCount, claudeAccountLabel, frameworkLabel, projectActivity, runningCount, syncLabel } from "./model";
import type { ActivityKind, ProjectTabId, PropertyChipModel } from "./types";

const ACTIVITY_ICON_COLORS: Record<ActivityKind, SemanticColor> = {
  idle: "text-tertiary",
  agent: "accent",
  building: "info",
  running: "success",
};

export interface DetailChipInput {
  project: Project;
  processes: readonly ProcessInfo[] | null;
  builds: readonly BuildJob[] | null;
  runs: readonly AgentRun[];
  git: GitDetails | null;
  accounts: ClaudeAccountList | null;
}

export function detailChips({ project, processes, builds, runs, git, accounts }: DetailChipInput): PropertyChipModel[] {
  const activity = projectActivity(project.id, processes ?? [], builds ?? [], runs);
  const chips: PropertyChipModel[] = [
    {
      id: "activity",
      icon: activity.kind === "idle" ? PROJECTS_ICONS.idle : PROJECTS_ICONS.busy,
      iconColor: ACTIVITY_ICON_COLORS[activity.kind],
      label: activity.label,
    },
    { id: "framework", icon: PROJECTS_ICONS.project, iconColor: "text-secondary", label: joinMeta(frameworkLabel(project.framework), project.packageManager) },
  ];
  const summary = project.git;
  if (summary) {
    chips.push({
      id: "branch",
      icon: PROJECTS_ICONS.branch,
      iconColor: "text-secondary",
      label: summary.branch || GIT_LABELS.detached,
      maxChars: BRANCH_CHARS,
    });
    const sync = syncLabel(summary.ahead, summary.behind);
    if (sync) chips.push({ id: "sync", icon: PROJECTS_ICONS.sync, iconColor: "text-secondary", label: sync });
    chips.push(
      summary.dirty
        ? {
            id: "dirty",
            icon: PROJECTS_ICONS.busy,
            iconColor: "warning",
            label: git?.files.length ? GIT_LABELS.changed(git.files.length) : GIT_LABELS.dirty,
          }
        : { id: "dirty", icon: PROJECTS_ICONS.clean, iconColor: "success", label: GIT_LABELS.clean },
    );
  }
  if (project.confidential) chips.push({ id: "confidential", icon: PROJECTS_ICONS.confidential, iconColor: "warning", label: CONFIDENTIAL_LABEL });
  const account = claudeAccountLabel(project, accounts);
  if (account) chips.push({ id: "claude", icon: PROJECTS_ICONS.agents, iconColor: "text-secondary", label: account });
  return chips.filter((chip) => chip.label);
}

export interface TabCountInput {
  processes: readonly ProcessInfo[] | null;
  builds: readonly BuildJob[] | null;
  artifacts: readonly unknown[] | null;
  sessions: readonly unknown[] | null;
  syncCount: number | null;
}

export function detailTabs(input: TabCountInput): { id: ProjectTabId; label: string; count: number | null }[] {
  const counts: Record<ProjectTabId, number | null> = {
    processes: input.processes ? runningCount(input.processes) : null,
    builds: input.builds ? activeBuildCount(input.builds) : null,
    artifacts: input.artifacts?.length ?? null,
    files: null,
    git: null,
    sync: input.syncCount,
    conversations: input.sessions?.length ?? null,
  };
  return PROJECT_TABS.map((id) => ({ id, label: TAB_LABELS[id], count: counts[id] }));
}
