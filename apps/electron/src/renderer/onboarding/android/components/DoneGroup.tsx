import { Notice } from "../../../components/Notice";
import { PropertyRow, SettingsGroup } from "../../../components/PreferenceRows";
import { ANDROID_LABELS } from "../labels";
import styles from "./groups.module.css";

export interface DoneGroupProps {
  sdkRoot: string;
  avd: string;
  avdPath: string | null;
  version: string;
  abi: string;
  emulatorRevision: string | null;
  warnings: readonly string[];
  isolationOs: string | null;
}

export function DoneGroup({ sdkRoot, avd, avdPath, version, abi, emulatorRevision, warnings, isolationOs }: DoneGroupProps) {
  const LABELS = ANDROID_LABELS.done;
  return (
    <>
      <div className={styles.notices}>
        <Notice tone="success" message={LABELS.ready(avd, version, abi)} />
        {warnings.map((warning) => (
          <Notice key={warning} tone="warning" message={warning} />
        ))}
        {isolationOs ? <Notice tone="warning" message={LABELS.noIsolation(isolationOs)} /> : null}
      </div>
      <SettingsGroup>
        <PropertyRow title={LABELS.sdk} value={sdkRoot} selectable />
        {emulatorRevision ? <PropertyRow title={LABELS.emulator} value={emulatorRevision} /> : null}
        <PropertyRow title={LABELS.avd} value={avdPath ?? avd} selectable />
      </SettingsGroup>
    </>
  );
}
