import { RadioRows } from "../../../components/RadioRows";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { PreferencesPage } from "../shared/PreferencesPage";
import { APPEARANCE_CHOICES, SECTION_LABELS } from "./labels";
import { useAppearance } from "./use-appearance";

export default function AppearancePreferences() {
  const { value, select } = useAppearance();
  return (
    <PreferencesPage>
      <SettingsGroup title={SECTION_LABELS.themeGroup} description={SECTION_LABELS.themeDescription} listRole="radiogroup">
        <RadioRows choices={APPEARANCE_CHOICES} value={value} onSelect={select} />
      </SettingsGroup>
    </PreferencesPage>
  );
}
