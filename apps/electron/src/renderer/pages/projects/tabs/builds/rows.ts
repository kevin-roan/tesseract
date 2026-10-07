import type { BuildJob, BuildTarget } from "@theone/protocol";
import type { RecordRowProps, RowAction } from "../../../../components/RecordRow";
import { FIX_LABELS } from "../../../../features/projects/labels";
import { canFixBuild, targetLabel } from "../../../../features/projects/model";
import { BUILDS_LABELS as L } from "./labels";
import { buildMeta, buildProgress, buildStatus, isFinalBuild, targetSubtitle } from "./model";

export function targetRow(target: BuildTarget, starting: boolean, onBuild: (target: BuildTarget) => void): RecordRowProps {
  return {
    icon: "builds",
    title: targetLabel(target),
    subtitle: targetSubtitle(target),
    actions: [{ id: "build", icon: "play", label: L.build, labeled: true, sensitive: !starting, onActivate: () => onBuild(target) }],
  };
}

export interface BuildRowState {
  logsOpen: boolean;
  fixPending: boolean;
  cancelling: boolean;
  now?: number;
}

export interface BuildRowHandlers {
  fix(build: BuildJob): void;
  toggleLogs(build: BuildJob): void;
  cancel(build: BuildJob): void;
}

export function buildRow(build: BuildJob, state: BuildRowState, handlers: BuildRowHandlers): RecordRowProps {
  const actions: RowAction[] = [];
  if (canFixBuild(build)) {
    actions.push({ id: "fix", icon: "fix-ai", label: FIX_LABELS.action, sensitive: !state.fixPending, onActivate: () => handlers.fix(build) });
  }
  actions.push({
    id: "logs",
    icon: "terminal",
    label: state.logsOpen ? L.hideLogs : L.showLogs,
    active: state.logsOpen,
    onActivate: () => handlers.toggleLogs(build),
  });
  if (!isFinalBuild(build)) {
    actions.push({
      id: "cancel",
      icon: "stop",
      label: L.cancel,
      destructive: true,
      sensitive: !state.cancelling,
      onActivate: () => handlers.cancel(build),
    });
  }
  return {
    icon: "builds",
    status: buildStatus(build),
    title: targetLabel(build.target),
    subtitle: build.error || null,
    meta: buildMeta(build, state.now),
    progress: buildProgress(build),
    progressTone: "info",
    actions,
    onActivate: () => handlers.toggleLogs(build),
    selected: state.logsOpen,
  };
}
