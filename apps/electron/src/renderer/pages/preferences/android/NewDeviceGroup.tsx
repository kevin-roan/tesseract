import { SettingsGroup, SwitchRow } from "../../../components/PreferenceRows";
import { ANDROID_SETTINGS_LABELS } from "./labels";

export function NewDeviceGroup({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange(on: boolean): void }) {
  const L = ANDROID_SETTINGS_LABELS.newDevice;
  return (
    <SettingsGroup>
      <SwitchRow title={L.title} subtitle={L.subtitle} checked={checked} disabled={disabled} onChange={onChange} />
    </SettingsGroup>
  );
}
