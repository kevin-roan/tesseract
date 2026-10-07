import { AnimatePresence, motion } from "motion/react";
import type { AvdInfo, EmulatorState } from "../../../../shared/contracts/android";
import { ActionButton } from "../../../components/ActionButton";
import { IconButton } from "../../../components/IconButton";
import { Notice } from "../../../components/Notice";
import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { rise, stagger, STAGGER_MS } from "../../../theme/motion";
import { ANDROID_SETTINGS_LABELS } from "./labels";
import { deviceState, deviceSubtitle, emulatorBusy, type DeviceState } from "./model";
import styles from "./AndroidPreferences.module.css";

export interface DevicesGroupProps {
  avds: readonly AvdInfo[];
  emulator: EmulatorState | null;
  disabled: boolean;
  onRefresh(): void;
  onStart(avd: AvdInfo): void;
  onStop(): void;
  onDelete(avd: AvdInfo): void;
}

function DeviceControls({ avd, state, blocked, disabled, onStart, onStop, onDelete }: {
  avd: AvdInfo;
  state: DeviceState;
  blocked: boolean;
  disabled: boolean;
  onStart(): void;
  onStop(): void;
  onDelete(): void;
}) {
  const L = ANDROID_SETTINGS_LABELS.devices;
  if (state === "idle") {
    return (
      <span className={styles.controls}>
        <IconButton icon="delete" label={L.delete(avd.name)} disabled={disabled || blocked} onClick={onDelete} />
        <ActionButton size="dialog" icon="play" label={L.start} disabled={disabled || blocked} onClick={onStart} />
      </span>
    );
  }
  return (
    <span className={styles.controls}>
      <StatusBadge label={L.badges[state]} tone={state === "running" ? "success" : "info"} live={state === "running"} />
      <ActionButton size="dialog" icon="stop" label={L.stop} disabled={disabled || state === "stopping"} onClick={onStop} />
    </span>
  );
}

export function DevicesGroup({ avds, emulator, disabled, onRefresh, onStart, onStop, onDelete }: DevicesGroupProps) {
  const L = ANDROID_SETTINGS_LABELS.devices;
  const blocked = emulatorBusy(emulator);
  return (
    <SettingsGroup
      title={L.title}
      description={L.description}
      headerSuffix={<IconButton icon="refresh" label={ANDROID_SETTINGS_LABELS.refresh} onClick={onRefresh} />}
      actions={emulator?.kind === "failed" ? <Notice tone="danger" title={L.emulatorFailed} message={emulator.message} /> : null}
    >
      {avds.length === 0 ? <PreferenceRow title={L.empty} subtitle={L.emptySubtitle} /> : null}
      <AnimatePresence initial={false}>
        {avds.map((avd, index) => (
          <motion.div key={avd.name} variants={rise} initial="initial" animate="animate" exit="exit" transition={stagger(index, STAGGER_MS.rows)}>
            <PreferenceRow
              title={avd.name}
              subtitle={deviceSubtitle(avd)}
              suffix={
                <DeviceControls
                  avd={avd}
                  state={deviceState(avd, emulator)}
                  blocked={blocked}
                  disabled={disabled}
                  onStart={() => onStart(avd)}
                  onStop={onStop}
                  onDelete={() => onDelete(avd)}
                />
              }
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </SettingsGroup>
  );
}
