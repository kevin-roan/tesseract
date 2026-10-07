import type { StepStatus } from "../../../shared/contracts/onboarding";
import type { OnboardingStepId } from "../../../shared/routes";
import { CLICKABLE_STATUSES, FINISHED_STATUSES } from "./constants";

export interface RailStep {
  id: OnboardingStepId;
  railLabel: string;
  optional: boolean;
}

export interface RailItem extends RailStep {
  status: StepStatus;
  current: boolean;
  clickable: boolean;
}

export type StepStatuses = Partial<Record<OnboardingStepId, StepStatus>>;

export type StepDirection = 1 | -1;

export function resolveStatus(
  id: OnboardingStepId,
  current: OnboardingStepId,
  statuses: StepStatuses,
  overrides: StepStatuses,
): StepStatus {
  const status = overrides[id] ?? statuses[id] ?? "pending";
  if (id === current && status === "pending") return "active";
  if (id !== current && status === "active") return "pending";
  return status;
}

export function firstUnfinishedRequired(steps: readonly RailStep[], statuses: (id: OnboardingStepId) => StepStatus): number {
  const index = steps.findIndex((step) => !step.optional && !FINISHED_STATUSES.includes(statuses(step.id)));
  return index === -1 ? steps.length - 1 : index;
}

export function railItems(
  steps: readonly RailStep[],
  current: OnboardingStepId,
  statuses: StepStatuses,
  overrides: StepStatuses = {},
): RailItem[] {
  const statusOf = (id: OnboardingStepId) => resolveStatus(id, current, statuses, overrides);
  const reachable = Math.max(firstUnfinishedRequired(steps, statusOf), steps.findIndex((step) => step.id === current));
  return steps.map((step, index) => {
    const status = statusOf(step.id);
    const isCurrent = step.id === current;
    return {
      ...step,
      status,
      current: isCurrent,
      clickable: isCurrent || CLICKABLE_STATUSES.includes(status) || index <= reachable,
    };
  });
}

export function stepPosition(steps: readonly RailStep[], id: OnboardingStepId): { index: number; total: number } {
  return { index: Math.max(0, steps.findIndex((step) => step.id === id)), total: steps.length };
}

export function adjacentStep(steps: readonly RailStep[], id: OnboardingStepId, delta: number): OnboardingStepId | null {
  const index = steps.findIndex((step) => step.id === id);
  if (index === -1) return null;
  return steps[index + delta]?.id ?? null;
}

export function directionBetween(from: number, to: number, fallback: StepDirection): StepDirection {
  if (to > from) return 1;
  if (to < from) return -1;
  return fallback;
}

export function isEditableTarget(target: EventTarget | null, selector: string): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return (target as Element).closest(selector) !== null;
}
