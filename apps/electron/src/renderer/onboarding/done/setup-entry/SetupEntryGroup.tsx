import { ActionButton } from "../../../components/ActionButton";
import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import type { OnboardingStepId } from "../../../../shared/routes";
import { SETUP_ENTRY_LABELS } from "./labels";
import { useOpenSetup } from "./use-open-setup";

export interface SetupEntryGroupProps {
  step?: OnboardingStepId;
}

export function SetupEntryGroup({ step }: SetupEntryGroupProps) {
  const open = useOpenSetup(step);
  return (
    <SettingsGroup title={SETUP_ENTRY_LABELS.group} description={SETUP_ENTRY_LABELS.description}>
      <PreferenceRow
        title={SETUP_ENTRY_LABELS.title}
        subtitle={SETUP_ENTRY_LABELS.subtitle}
        suffix={
          <ActionButton
            variant="secondary"
            size="sm"
            icon="settings"
            label={SETUP_ENTRY_LABELS.action}
            onClick={open}
          />
        }
      />
    </SettingsGroup>
  );
}
