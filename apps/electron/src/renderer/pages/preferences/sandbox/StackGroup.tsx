import type { SandboxStackConfig, SandboxStackStatus } from "../../../../shared/contracts/sandbox";
import { ActionButton } from "../../../components/ActionButton";
import { Notice } from "../../../components/Notice";
import { PreferenceRow, SettingsActions, SettingsGroup, SwitchRow } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import type { PendingAction } from "./hooks/use-sandbox-actions";
import { SANDBOX_SETTINGS_LABELS } from "./labels";
import { imageSubtitle, stackBadge, stackRunning, stackSubtitle } from "./model";

export interface StackGroupProps {
  stack: SandboxStackConfig | null;
  status: SandboxStackStatus | null;
  pending: PendingAction;
  locked: boolean;
  autostart: boolean;
  formatWhen(iso: string): string;
  onStart(): void;
  onStop(): void;
  onAutostart(enabled: boolean): void;
  onOpenSetup(): void;
}

export function StackGroup({ stack, status, pending, locked, autostart, formatWhen, onStart, onStop, onAutostart, onOpenSetup }: StackGroupProps) {
  const L = SANDBOX_SETTINGS_LABELS;
  const badge = stackBadge(status);
  const configured = status?.configured ?? false;
  const running = stackRunning(status);
  const busy = pending !== null || locked;
  return (
    <SettingsGroup
      title={L.stack.title}
      description={L.stack.description}
      actions={
        status && !configured ? (
          <Notice tone="info" message={L.stack.unconfigured} actionLabel={L.stack.setUp} onAction={onOpenSetup} />
        ) : configured ? (
          <SettingsActions>
            {running ? (
              <ActionButton size="dialog" icon="stop" label={L.stack.stop} busy={pending === "stop"} disabled={busy} onClick={onStop} />
            ) : (
              <ActionButton size="dialog" variant="primary" icon="play" label={L.stack.start} busy={pending === "start"} disabled={busy} onClick={onStart} />
            )}
          </SettingsActions>
        ) : null
      }
    >
      <PreferenceRow
        title={L.stack.status}
        subtitle={stackSubtitle(status, stack)}
        suffix={<StatusBadge label={badge.label} tone={badge.tone} live={badge.tone === "success"} />}
      />
      {stack ? <PreferenceRow title={L.stack.image} subtitle={imageSubtitle(stack, formatWhen)} selectable /> : null}
      <SwitchRow title={L.stack.autostart} subtitle={L.stack.autostartSubtitle} checked={autostart} disabled={!configured} onChange={onAutostart} />
    </SettingsGroup>
  );
}
