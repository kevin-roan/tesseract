import type { HostClaudeState } from "../../../../shared/contracts/claude";
import { ExpanderRow, SettingsGroup } from "../../../components/PreferenceRows";
import { SHARED_LABELS } from "../shared/labels";
import { PropertyList } from "../shared/PropertyList";
import { SECTION_LABELS } from "./labels";
import { hostAccountRows, hostAccountSubtitle } from "./model";

export interface HostAccountsGroupProps {
  accounts: readonly HostClaudeState[] | null;
  firstId: string | null;
  now: number;
}

export function HostAccountsGroup({ accounts, firstId, now }: HostAccountsGroupProps) {
  return (
    <SettingsGroup title={SECTION_LABELS.hostGroup} description={accounts ? SECTION_LABELS.hostDescription : SHARED_LABELS.loading}>
      {accounts?.map((account) => (
        <ExpanderRow key={account.id} title={account.id} subtitle={hostAccountSubtitle(account)} defaultExpanded={account.id === firstId}>
          <PropertyList items={hostAccountRows(account, now)} nested />
        </ExpanderRow>
      ))}
    </SettingsGroup>
  );
}
