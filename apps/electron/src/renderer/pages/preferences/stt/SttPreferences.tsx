import { ActionButton } from "../../../components/ActionButton";
import { EntryRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { RadioRows } from "../../../components/RadioRows";
import { SHARED_LABELS } from "../shared/labels";
import { PreferencesPage } from "../shared/PreferencesPage";
import { PropertyList } from "../shared/PropertyList";
import { RefreshButton } from "../shared/RefreshButton";
import { SECTION_LABELS } from "./labels";
import { geminiSubtitle, profileChoices, statusRows } from "./model";
import { useStt } from "./use-stt";
import styles from "./SttPreferences.module.css";

export default function SttPreferences() {
  const stt = useStt();
  const { status, pending } = stt;
  const keyDisabled = !status || pending;
  const statusItems = status ? statusRows(status) : [{ key: SHARED_LABELS.status, value: stt.message || SHARED_LABELS.loading }];
  return (
    <PreferencesPage>
      <SettingsGroup title={SECTION_LABELS.profilesGroup} description={SECTION_LABELS.profilesDescription} listRole="radiogroup">
        <RadioRows
          choices={profileChoices(status, pending)}
          value={stt.pendingProfile ?? status?.profile ?? null}
          busy={pending}
          onSelect={stt.selectProfile}
        />
      </SettingsGroup>
      <SettingsGroup
        title={SECTION_LABELS.geminiGroup}
        description={SECTION_LABELS.geminiDescription}
        actions={
          <SettingsActions>
            {status?.gemini.source === "settings" ? (
              <ActionButton variant="destructive" className={styles.remove} label={SECTION_LABELS.geminiRemove} disabled={pending} onClick={stt.removeKey} />
            ) : null}
            <ActionButton variant="primary" label={SECTION_LABELS.save} disabled={keyDisabled} onClick={stt.saveKey} />
          </SettingsActions>
        }
      >
        <EntryRow
          title={SECTION_LABELS.geminiKey}
          subtitle={geminiSubtitle(status)}
          password
          autoComplete="off"
          value={stt.geminiKey}
          disabled={keyDisabled}
          onChange={stt.setGeminiKey}
          onActivate={stt.saveKey}
        />
      </SettingsGroup>
      <SettingsGroup title={SECTION_LABELS.statusGroup} headerSuffix={<RefreshButton onClick={stt.refresh} />}>
        <PropertyList items={statusItems} />
      </SettingsGroup>
    </PreferencesPage>
  );
}
