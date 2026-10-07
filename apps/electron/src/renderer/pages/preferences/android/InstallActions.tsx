import { ActionButton } from "../../../components/ActionButton";
import { Notice } from "../../../components/Notice";
import { SettingsActions } from "../../../components/PreferenceRows";
import { formatBytes } from "../../../onboarding/android/model";
import type { InstallStage } from "./hooks/use-install-flow";
import { ANDROID_SETTINGS_LABELS } from "./labels";

export interface InstallActionsProps {
  stage: InstallStage;
  download: number;
  canInstall: boolean;
  onInstall(): void;
  onCancel(): void;
}

export function InstallActions({ stage, download, canInstall, onInstall, onCancel }: InstallActionsProps) {
  const L = ANDROID_SETTINGS_LABELS.install;
  return (
    <>
      {stage.kind === "failed" ? <Notice tone="danger" message={stage.message} /> : null}
      {stage.kind === "cancelled" ? <Notice tone="neutral" message={L.cancelled} /> : null}
      <SettingsActions>
        {stage.kind === "installing" ? (
          <ActionButton size="dialog" label={L.cancel} onClick={onCancel} />
        ) : (
          <ActionButton
            size="dialog"
            variant="primary"
            icon="save"
            label={download > 0 ? L.installSize(formatBytes(download)) : L.install}
            disabled={!canInstall}
            onClick={onInstall}
          />
        )}
      </SettingsActions>
    </>
  );
}
