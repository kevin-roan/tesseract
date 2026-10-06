import type { ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon, PlayIcon, SparkleIcon, StopIcon } from "phosphor-react-native";
import type { AppRunAction } from "@theone/protocol";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";
import { ThemedText } from "@/components/themed-text";
import { canFixAppRun } from "@/features/sandbox/utils/fix-prompt";
import { stateLabel } from "@/features/sandbox/utils/states";

import {
  APP_RUN_A11Y,
  APP_RUN_TONES,
  APP_RUNS_COPY,
  EMULATOR_ACTION_LABELS,
  OPEN_ICON,
  OPEN_LABELS,
  RUN_ACTION_ICONS,
  RUN_ACTION_LABELS,
  VIEWER_DESCRIPTIONS,
  VIEWER_ICONS,
} from "../../utils/content";
import { appRunMeta, canStart, isActiveAppRun, isUnreachable, openPlanFor, runActions, type AppRunEntry } from "../../utils/runs";

export type AppRunCardProps = {
  entry: AppRunEntry;
  onStart: () => void;
  starting?: boolean;
  /** Opens the host emulator controls; offered while an Android target can't start. */
  onSetupEmulator?: () => void;
  onOpen: () => void;
  onAction: (action: AppRunAction) => void;
  pendingAction?: AppRunAction | null;
  onStop: () => void;
  stopping?: boolean;
  onToggleLogs?: () => void;
  logsOpen?: boolean;
  /** The log view, rendered inside the card while `logsOpen`. */
  logs?: ReactNode;
  /** Shown once the run has failed: hands its logs to a new chat. */
  onFix?: () => void;
  fixing?: boolean;
};

const AppRunCard = ({
  entry,
  onStart,
  starting = false,
  onSetupEmulator,
  onOpen,
  onAction,
  pendingAction = null,
  onStop,
  stopping = false,
  onToggleLogs,
  logsOpen = false,
  logs,
  onFix,
  fixing = false,
}: AppRunCardProps) => {
  const { run, info, label, viewer } = entry;
  const active = run ? isActiveAppRun(run) : false;
  const openable = run ? openPlanFor(run) !== null : false;
  const reason = info && !info.available ? info.reason : null;
  const needsEmulator = viewer === "android" && info !== null && !info.available && !active && onSetupEmulator !== undefined;
  const note = run?.error ?? (run && isUnreachable(run) ? APP_RUNS_COPY.unreachable : null) ?? (active ? null : reason);
  const badge = run
    ? { label: stateLabel(run.state), tone: APP_RUN_TONES[run.state] }
    : reason
      ? { label: APP_RUNS_COPY.unavailable, tone: "warning" as const }
      : undefined;

  return (
    <ResourceCard
      icon={VIEWER_ICONS[viewer]}
      title={label}
      subtitle={VIEWER_DESCRIPTIONS[viewer]}
      meta={run ? appRunMeta(run) : undefined}
      badge={badge}
      footer={
        <>
          {active ? null : (
            <ActionButton
              label={run ? APP_RUNS_COPY.startAgain : APP_RUNS_COPY.start}
              icon={PlayIcon}
              size="sm"
              loading={starting}
              disabled={!canStart(entry)}
              onPress={onStart}
              accessibilityLabel={APP_RUN_A11Y.start(label)}
            />
          )}
          {needsEmulator ? (
            <ActionButton
              label={EMULATOR_ACTION_LABELS.setup}
              icon={VIEWER_ICONS.android}
              variant="secondary"
              size="sm"
              onPress={onSetupEmulator}
              accessibilityLabel={APP_RUN_A11Y.labelled(EMULATOR_ACTION_LABELS.setup, label)}
            />
          ) : null}
          {openable ? (
            <ActionButton label={OPEN_LABELS[viewer]} icon={OPEN_ICON} size="sm" onPress={onOpen} accessibilityLabel={APP_RUN_A11Y.labelled(OPEN_LABELS[viewer], label)} />
          ) : null}
          {run
            ? runActions(run).map((action) => (
                <ActionButton
                  key={action}
                  label={RUN_ACTION_LABELS[action]}
                  icon={RUN_ACTION_ICONS[action]}
                  variant="secondary"
                  size="sm"
                  loading={pendingAction === action}
                  onPress={() => onAction(action)}
                  accessibilityLabel={APP_RUN_A11Y.action(RUN_ACTION_LABELS[action], label)}
                />
              ))
            : null}
          {run && onFix && canFixAppRun(run) ? (
            <ActionButton
              label={APP_RUNS_COPY.fix}
              icon={SparkleIcon}
              variant="secondary"
              size="sm"
              loading={fixing}
              onPress={onFix}
              accessibilityLabel={APP_RUN_A11Y.fix(label)}
            />
          ) : null}
          {run && onToggleLogs ? (
            <ActionButton
              label={logsOpen ? APP_RUNS_COPY.hideLogs : APP_RUNS_COPY.logs}
              icon={logsOpen ? CaretUpIcon : CaretDownIcon}
              variant="secondary"
              size="sm"
              onPress={onToggleLogs}
              accessibilityLabel={APP_RUN_A11Y.labelled(logsOpen ? APP_RUNS_COPY.hideLogs : APP_RUNS_COPY.logs, label)}
            />
          ) : null}
          {active ? (
            <ActionButton
              label={APP_RUNS_COPY.stop}
              icon={StopIcon}
              variant="danger"
              size="sm"
              loading={stopping}
              onPress={onStop}
              accessibilityLabel={APP_RUN_A11Y.stop(label)}
            />
          ) : null}
        </>
      }
      expanded={logsOpen ? logs : null}
    >
      {note ? (
        <ThemedText variant="caption" color={run?.error ? "danger" : "textTertiary"} selectable>
          {note}
        </ThemedText>
      ) : null}
    </ResourceCard>
  );
};

export default AppRunCard;
