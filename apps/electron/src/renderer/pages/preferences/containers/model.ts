import type { CheckItem } from "../../../../shared/contracts/common";
import type { ContainersActionKey } from "../../../../shared/contracts/containers";
import type { CheckRowStatus } from "../../../onboarding/shell";
import { CONTAINERS_SETTINGS_LABELS as L } from "./labels";

export type InlineAction = keyof typeof L.checks.actions;

export type TaskAction = keyof typeof L.checks.progress;

export interface TaskProgress {
  running: boolean;
  step: string | null;
}

export interface CheckView {
  id: string;
  title: string;
  subtitle: string;
  status: CheckRowStatus;
  action: InlineAction | null;
  primary: boolean;
}

function inlineAction(action: ContainersActionKey | undefined): InlineAction | null {
  return action === "install-sysbox" || action === "setup-vm" || action === "build-image" ? action : null;
}

function taskAction(action: ContainersActionKey | undefined): TaskAction | null {
  return action === "setup-vm" || action === "build-image" ? action : null;
}

export function checkViews(checks: readonly CheckItem<ContainersActionKey>[], tasks: Record<TaskAction, TaskProgress>): CheckView[] {
  return checks.map((check) => {
    const task = taskAction(check.action);
    const running = task !== null && tasks[task].running;
    return {
      id: check.id,
      title: check.title,
      subtitle: running ? tasks[task].step || L.checks.progress[task] : check.detail,
      status: running ? "running" : check.status,
      action: running ? null : inlineAction(check.action),
      primary: task !== null,
    };
  });
}

export function runningTask(tasks: Record<TaskAction, TaskProgress>): TaskAction | null {
  return (Object.keys(tasks) as TaskAction[]).find((task) => tasks[task].running) ?? null;
}
