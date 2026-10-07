import type { ClaudeAccountList } from "@theone/protocol";
import { PropertyRow, SettingsGroup } from "../../../components/PreferenceRows";
import { RadioRows } from "../../../components/RadioRows";
import { SHARED_LABELS } from "../shared/labels";
import { SECTION_LABELS } from "./labels";
import { accountChoices } from "./model";

export interface AccountsGroupProps {
  accounts: ClaudeAccountList | null;
  message: string | null;
  pending: string | null;
  now: number;
  onSelect(id: string): void;
}

export function AccountsGroup({ accounts, message, pending, now, onSelect }: AccountsGroupProps) {
  const status = message ?? (accounts ? null : SHARED_LABELS.loading);
  return (
    <SettingsGroup title={SECTION_LABELS.accountsGroup} description={SECTION_LABELS.accountsDescription} listRole="radiogroup">
      {status ? <PropertyRow title={SHARED_LABELS.status} value={status} selectable /> : null}
      {accounts ? (
        <RadioRows choices={accountChoices(accounts, now)} value={pending ?? accounts.defaultAccountId} busy={pending !== null} onSelect={onSelect} />
      ) : null}
    </SettingsGroup>
  );
}
