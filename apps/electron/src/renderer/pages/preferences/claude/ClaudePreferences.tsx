import { PreferencesPage } from "../shared/PreferencesPage";
import { useNow } from "../../../onboarding/shared/use-now";
import { NOW_TICK_MS } from "../shared/constants";
import { AccountsGroup } from "./AccountsGroup";
import { HostAccountsGroup } from "./HostAccountsGroup";
import { SandboxAuthGroup } from "./SandboxAuthGroup";
import { TokenGroup } from "./TokenGroup";
import { useClaudeHost } from "./use-claude-host";
import { useClaudeSandbox } from "./use-claude-sandbox";

export default function ClaudePreferences() {
  const now = useNow(true, NOW_TICK_MS);
  const host = useClaudeHost();
  const sandbox = useClaudeSandbox();
  const refresh = () => {
    void host.refetch();
    sandbox.refresh();
  };
  return (
    <PreferencesPage>
      <HostAccountsGroup accounts={host.accounts} firstId={host.firstId} now={now} />
      <SandboxAuthGroup auth={sandbox.auth} message={sandbox.authMessage} now={now} onRefresh={refresh} />
      <AccountsGroup
        accounts={sandbox.accounts}
        message={sandbox.accountsMessage}
        pending={sandbox.pendingAccount}
        now={now}
        onSelect={sandbox.selectDefault}
      />
      <TokenGroup
        configured={sandbox.token.configured}
        value={sandbox.token.value}
        online={sandbox.online}
        canSave={sandbox.token.canSave}
        saving={sandbox.token.saving}
        clearing={sandbox.token.clearing}
        onChange={sandbox.token.setValue}
        onSubmit={sandbox.token.submit}
        onClear={sandbox.token.clear}
      />
    </PreferencesPage>
  );
}
