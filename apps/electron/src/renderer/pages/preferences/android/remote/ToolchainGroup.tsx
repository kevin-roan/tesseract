import { ActionButton } from "../../../../components/ActionButton";
import { EntryRow, PropertyRow, SettingsActions, SettingsGroup } from "../../../../components/PreferenceRows";
import { ChoiceRow } from "../../../../onboarding/shell";
import { REMOTE_ANDROID_LABELS as L } from "./labels";
import { CUSTOM, toolchainChoices, type ToolchainKind, type ToolchainPick, type ToolchainSection } from "./model";

export interface ToolchainGroupProps {
  kind: ToolchainKind;
  section: ToolchainSection;
  pick: ToolchainPick;
  onPick(pick: ToolchainPick): void;
  canSave: boolean;
  saving: boolean;
  disabled: boolean;
  onSave(): void;
  /** Extra rows under the choices (adb, emulator). */
  details?: readonly { title: string; value: string | null }[];
}

export function ToolchainGroup({ kind, section, pick, onPick, canSave, saving, disabled, onSave, details = [] }: ToolchainGroupProps) {
  const labels = L[kind];
  return (
    <SettingsGroup
      title={labels.title}
      description={labels.description}
      listRole="radiogroup"
      listLabel={labels.title}
      actions={
        <SettingsActions>
          <ActionButton variant="primary" label={L.save} busy={saving} disabled={!canSave || disabled} onClick={onSave} />
        </SettingsActions>
      }
    >
      {toolchainChoices(section, kind).map((choice) => (
        <ChoiceRow
          key={choice.id}
          title={choice.title}
          subtitle={choice.subtitle}
          checked={pick.choice === choice.id}
          disabled={disabled}
          onSelect={() => onPick({ ...pick, choice: choice.id })}
        />
      ))}
      {pick.choice === CUSTOM ? (
        <EntryRow
          title={L.customField}
          mono
          value={pick.custom}
          disabled={disabled}
          onChange={(custom) => onPick({ ...pick, custom })}
          onActivate={canSave ? onSave : undefined}
        />
      ) : null}
      {details.map((row) => (
        <PropertyRow key={row.title} title={row.title} value={row.value ?? L.android.notFound} selectable={row.value !== null} />
      ))}
    </SettingsGroup>
  );
}
