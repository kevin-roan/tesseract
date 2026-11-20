import { ActionButton } from "../../../components/ActionButton";
import { EntryRow, PreferenceRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { TOKEN_LABELS as L } from "./labels";

export interface TokenGroupProps {
  configured: boolean;
  value: string;
  online: boolean;
  canSave: boolean;
  saving: boolean;
  clearing: boolean;
  onChange(value: string): void;
  onSubmit(): void;
  onClear(): void;
}

export function TokenGroup({ configured, value, online, canSave, saving, clearing, onChange, onSubmit, onClear }: TokenGroupProps) {
  return (
    <SettingsGroup
      title={L.title}
      description={L.description}
      actions={
        <SettingsActions>
          {configured ? <ActionButton variant="destructive" label={L.clear} busy={clearing} disabled={clearing || !online} onClick={onClear} /> : null}
          <ActionButton variant="primary" label={L.save} busy={saving} disabled={!canSave} onClick={onSubmit} />
        </SettingsActions>
      }
    >
      <PreferenceRow
        title={L.token}
        subtitle={configured ? L.configured : L.missing}
        suffix={<StatusBadge label={configured ? L.badge.saved : L.badge.missing} tone={configured ? "success" : "neutral"} />}
      />
      <EntryRow title={L.token} subtitle={L.help} password mono placeholder={L.placeholder} value={value} onChange={onChange} onActivate={onSubmit} rowDisabled={!online} />
    </SettingsGroup>
  );
}
