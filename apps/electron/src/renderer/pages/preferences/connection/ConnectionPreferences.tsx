import { useCallback, useState } from "react";
import { ActionButton } from "../../../components/ActionButton";
import type { PairTarget } from "../../../components/PairDialog";
import { ButtonRow, EntryRow, PreferenceRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { SetupEntryGroup } from "../../../onboarding/done/setup-entry";
import { PairPhoneDialog } from "../shared/PairPhoneDialog";
import { PreferencesPage } from "../shared/PreferencesPage";
import { SECTION_LABELS } from "./labels";
import { MachinesGroup } from "./MachinesGroup";
import { MasterHostRow } from "./MasterHostRow";
import { useConnectionForm } from "./use-connection-form";
import { useMasterHostRow } from "./use-master-host-row";

export default function ConnectionPreferences() {
  const { form, fields, saving, status, save, rediscover, forget } = useConnectionForm();
  const master = useMasterHostRow();
  const [pairOpen, setPairOpen] = useState(false);
  const [pairTarget, setPairTarget] = useState<PairTarget>("sandbox");
  const openPair = useCallback((target: PairTarget) => {
    setPairTarget(target);
    setPairOpen(true);
  }, []);
  const closePair = useCallback(() => setPairOpen(false), []);
  return (
    <PreferencesPage>
      <MachinesGroup />
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
        <ButtonRow
          title={SECTION_LABELS.pair}
          subtitle={SECTION_LABELS.pairSubtitle}
          label={SECTION_LABELS.showQr}
          variant="primary"
          disabled={status.discovering}
          onActivate={() => openPair("sandbox")}
        />
        {master.row ? (
          <MasterHostRow
            title={SECTION_LABELS.master}
            row={master.row}
            pairLabel={SECTION_LABELS.masterPair}
            unlinkLabel={SECTION_LABELS.masterUnlink}
            busy={master.busy}
            disabled={status.discovering}
            onPair={() => openPair(master.row?.pairTarget ?? "master")}
            onUnlink={master.unlink}
          />
        ) : null}
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
      <PairPhoneDialog open={pairOpen} target={pairTarget} onClose={closePair} />
    </PreferencesPage>
  );
}
