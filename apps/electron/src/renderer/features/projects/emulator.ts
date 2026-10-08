import { ApiError } from "@tesseract/client";
import type { AppRun, RunTargetInfo } from "@tesseract/protocol";
import { describeError } from "../../app/connection";
import { ANDROID_FRAMEWORKS, ANDROID_VIEWER, LIVE_APP_RUN_STATES, NOT_FOUND_STATUS } from "./constants";
import { DETAIL_LABELS, EMULATOR_LABELS, HOST_FIXABLE_REASONS } from "./labels";
import type { DisplayButtonModel, NoticeAction } from "./types";

export function androidTarget(targets: readonly RunTargetInfo[] | null | undefined): RunTargetInfo | null {
  return targets?.find((target) => target.viewer === ANDROID_VIEWER) ?? null;
}

export function hostFixable(target: Pick<RunTargetInfo, "available" | "reason">): boolean {
  return !target.available && target.reason !== null && HOST_FIXABLE_REASONS.includes(target.reason);
}

export function liveRun(runs: readonly AppRun[] | null | undefined, target: string): AppRun | null {
  return runs?.find((run) => run.target === target && LIVE_APP_RUN_STATES.includes(run.state)) ?? null;
}

export function isAndroidFramework(framework: string | null | undefined): boolean {
  return framework !== null && framework !== undefined && (ANDROID_FRAMEWORKS as readonly string[]).includes(framework);
}

export function displayButton(
  targets: readonly RunTargetInfo[] | null | undefined,
  runs: readonly AppRun[] | null | undefined,
  framework: string | null | undefined,
  targetsError: unknown = null,
): DisplayButtonModel {
  const target = androidTarget(targets);
  if (!target) {
    if (!isAndroidFramework(framework)) {
      return { mode: "display", label: DETAIL_LABELS.display, icon: "display", tooltip: null, disabled: false };
    }
    let tooltip: string | null;
    if (!targets && !targetsError) tooltip = null;
    else if (!targetsError) tooltip = EMULATOR_LABELS.noTarget;
    else if (targetsError instanceof ApiError && targetsError.status === NOT_FOUND_STATUS) tooltip = EMULATOR_LABELS.outdated;
    else tooltip = EMULATOR_LABELS.noTargets(describeError(targetsError));
    return { mode: "unsupported", label: EMULATOR_LABELS.run, icon: "smartphone", tooltip, disabled: true };
  }
  const running = liveRun(runs, target.target) !== null;
  let tooltip: string | null;
  if (target.available) tooltip = target.dir ? EMULATOR_LABELS.tooltipDir(target.dir) : EMULATOR_LABELS.tooltip;
  else if (hostFixable(target)) tooltip = EMULATOR_LABELS.tooltipSetup(target.reason ?? "");
  else tooltip = target.reason;
  return { mode: "emulator", label: running ? EMULATOR_LABELS.show : EMULATOR_LABELS.run, icon: "smartphone", tooltip, disabled: false };
}

export interface EmulatorButtonSlotProps {
  projectId: string;
  projectName: string;
  framework: string | null;
  runTargets: readonly RunTargetInfo[] | null;
  appRuns: readonly AppRun[] | null;
  runTargetsError?: unknown;
  report(error: unknown, action?: NoticeAction): void;
  onRun?: (run: AppRun) => void;
  className?: string;
}
