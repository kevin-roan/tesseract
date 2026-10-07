import { ActionButton } from "../../../components/ActionButton";
import { ButtonRow, EntryRow, PreferenceRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { SetupEntryGroup } from "../../../onboarding/done/setup-entry";
import { PreferencesPage } from "../shared/PreferencesPage";
import { SECTION_LABELS } from "./labels";
import { useConnectionForm } from "./use-connection-form";

export default function ConnectionPreferences() {
  const { form, fields, saving, status, save, rediscover, forget } = useConnectionForm();
  return (
    <PreferencesPage>
      <SettingsGroup
        title={SECTION_LABELS.sandboxGroup}
        description={SECTION_LABELS.sandboxDescription}
        actions={
          <SettingsActions>
            <ActionButton icon="search" label={SECTION_LABELS.rediscover} disabled={status.discovering} onClick={rediscover} />
            <ActionButton variant="primary" label={SECTION_LABELS.save} busy={saving} disabled={status.discovering} onClick={save} />
          </SettingsActions>
        }
      >
        <EntryRow title={SECTION_LABELS.apiUrl} type="url" value={form.apiUrl} onChange={fields.apiUrl} onActivate={save} />
        <EntryRow title={SECTION_LABELS.token} password value={form.token} onChange={fields.token} onActivate={save} />
        <EntryRow title={SECTION_LABELS.name} value={form.name} onChange={fields.name} onActivate={save} />
      </SettingsGroup>
      <SettingsGroup title={SECTION_LABELS.pairingGroup} description={SECTION_LABELS.pairingDescription}>
        <EntryRow title={SECTION_LABELS.pairingUrl} type="url" value={form.pairingUrl} onChange={fields.pairingUrl} onActivate={save} />
      </SettingsGroup>
      <SettingsGroup title={SECTION_LABELS.statusGroup}>
        <PreferenceRow
          title={SECTION_LABELS.status}
          subtitle={status.statusSubtitle}
          suffix={<StatusBadge label={status.badge.label} tone={status.badge.tone} />}
        />
        <PreferenceRow title={status.sourceTitle} subtitle={status.sourceSubtitle} selectable />
        <ButtonRow title={SECTION_LABELS.forget} subtitle={SECTION_LABELS.forgetSubtitle} label={SECTION_LABELS.forgetButton} variant="destructive" disabled={status.discovering} onActivate={forget} />
      </SettingsGroup>
      <SetupEntryGroup />
    </PreferencesPage>
  );
}
