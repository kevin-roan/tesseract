import { useState } from "react";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceDropdown } from "../../components/ChoiceDropdown";
import { IconButton } from "../../components/IconButton";
import { StatusBadge } from "../../components/StatusBadge";
import { Text } from "../../components/Text";
import type { DeviceView } from "../../features/emulator/hooks/use-device-view";
import { CONTROL_LABELS, LINK_LABELS, STREAM_LABELS } from "../../features/emulator/labels";
import { StreamDialog } from "./StreamDialog";
import styles from "./DeviceToolbar.module.css";

export interface DeviceToolbarProps {
  view: DeviceView;
}

export function DeviceToolbar({ view }: DeviceToolbarProps) {
  const { controls, link } = view;
  const labels = view.kind.labels;
  const [streamOpen, setStreamOpen] = useState(false);
  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        {view.targets.length > 0 ? (
          <ChoiceDropdown
            options={view.targets}
            value={view.target}
            onChange={view.select}
            ariaLabel={labels.target}
            tooltip={labels.target}
            variant="toolbar"
            disabled={view.canStop}
          />
        ) : (
          <Text variant="bodySmall" color="text-secondary" title={labels.noTargetsMessage}>
            {labels.noTargets}
          </Text>
        )}
        {view.badge ? <StatusBadge label={view.badge.label} tone={view.badge.tone} live={view.badge.tone === "success"} /> : null}
      </div>
      <div className={styles.group}>
        {view.canStop ? (
          <>
            <ActionButton label={CONTROL_LABELS.stop} icon="stop" size="sm" busy={controls.stopping} onClick={controls.stop} />
            <ActionButton label={CONTROL_LABELS.kill} variant="destructive" size="sm" tooltip={labels.killTooltip} disabled={controls.stopping} onClick={controls.kill} />
          </>
        ) : (
          <ActionButton label={CONTROL_LABELS.start} icon="play" variant="primary" size="sm" busy={controls.starting} disabled={!view.canStart} onClick={view.start} />
        )}
      </div>
      {link ? (
        <div className={styles.group}>
          <Text variant="caption" color="text-tertiary">
            {LINK_LABELS.title}
          </Text>
          <StatusBadge label={link.badge.label} tone={link.badge.tone} />
          {link.linked ? null : (
            <ActionButton
              label={link.url ? CONTROL_LABELS.relink : CONTROL_LABELS.link}
              icon="link"
              size="sm"
              busy={controls.linking}
              disabled={!link.run}
              tooltip={link.hasSandbox ? (link.error ?? undefined) : LINK_LABELS.noSandbox}
              onClick={link.run ?? undefined}
            />
          )}
        </div>
      ) : null}
      <span className={styles.spacer} />
      <ActionButton
        label={STREAM_LABELS.open}
        icon="settings"
        size="sm"
        tooltip={STREAM_LABELS.tooltip}
        disabled={controls.access !== "ready"}
        onClick={() => setStreamOpen(true)}
      />
      <StreamDialog kind={view.kind} open={streamOpen} onClose={() => setStreamOpen(false)} />
      <IconButton icon="refresh" label={CONTROL_LABELS.refresh} onClick={controls.refresh} />
    </div>
  );
}
