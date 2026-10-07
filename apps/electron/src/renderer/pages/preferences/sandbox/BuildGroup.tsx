import type { BuildPhase } from "../../../../shared/contracts/sandbox";
import { ActionButton } from "../../../components/ActionButton";
import { SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { progressView } from "../../../onboarding/sandbox/model";
import { LogDisclosure, ProgressBlock } from "../../../onboarding/shell";
import { SANDBOX_SETTINGS_LABELS } from "./labels";
import { buildActive } from "./model";
import styles from "./SandboxPreferences.module.css";

export interface BuildGroupProps {
  phase: BuildPhase;
  fraction: number;
  now: number;
  log: readonly string[];
  cancelling: boolean;
  onCancel(): void;
}

export function BuildGroup({ phase, fraction, now, log, cancelling, onCancel }: BuildGroupProps) {
  const L = SANDBOX_SETTINGS_LABELS;
  const view = progressView(phase, fraction, now);
  const active = buildActive(phase);
  return (
    <SettingsGroup
      title={L.build.title}
      actions={
        <>
          <LogDisclosure lines={log} />
          {active ? (
            <SettingsActions>
              <ActionButton size="dialog" label={L.build.cancel} busy={cancelling} disabled={cancelling} onClick={onCancel} />
            </SettingsActions>
          ) : null}
        </>
      }
    >
      <div className={styles.progress}>
        <ProgressBlock label={view.label} progress={view.fraction} detail={view.detail} tone={view.tone} />
      </div>
    </SettingsGroup>
  );
}
