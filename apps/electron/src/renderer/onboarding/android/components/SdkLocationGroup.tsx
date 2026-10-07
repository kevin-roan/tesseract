import { SettingsGroup } from "../../../components/PreferenceRows";
import { ChoiceRow } from "../../shell";
import { ANDROID_LABELS } from "../labels";
import type { SdkChoice } from "../model";

export interface SdkLocationGroupProps {
  choices: readonly SdkChoice[];
  value: string | null;
  onSelect(path: string): void;
  disabled?: boolean;
}

export function SdkLocationGroup({ choices, value, onSelect, disabled = false }: SdkLocationGroupProps) {
  return (
    <SettingsGroup title={ANDROID_LABELS.sdk.title} description={ANDROID_LABELS.sdk.description} listRole="radiogroup">
      {choices.map((choice) => (
        <ChoiceRow
          key={choice.id}
          title={choice.title}
          subtitle={choice.subtitle}
          checked={choice.id === value}
          disabled={disabled}
          onSelect={() => onSelect(choice.id)}
        />
      ))}
    </SettingsGroup>
  );
}
