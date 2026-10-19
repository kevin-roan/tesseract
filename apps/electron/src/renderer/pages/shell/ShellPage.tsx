import { HOST_LAUNCHERS, HOST_PLACEHOLDER } from "../../features/shell/constants";
import { useHostShellPage } from "../../features/shell/hooks/use-host-shell-page";
import { SHELL_LABELS } from "../../features/shell/labels";
import { HOST_TERMINALS } from "../../features/shell/scope";
import { TerminalsScopeContext } from "../../features/terminals/scope";
import { TerminalsLayout } from "../terminals/TerminalsLayout";
import { HostUnlock } from "./HostUnlock";
import { useHostLockHeader } from "./HostLockAction";

function HostShellView() {
  const { host, workspace, empty } = useHostShellPage();
  useHostLockHeader({ title: SHELL_LABELS.title, visible: host.access === "ready", onLock: host.lock });
  return (
    <TerminalsLayout
      page={workspace}
      empty={empty}
      onEmptyAction={host.onAction}
      onEmptySecondary={host.onSecondary}
      launchers={HOST_LAUNCHERS}
      placeholder={HOST_PLACEHOLDER}
    >
      <HostUnlock dialog={host.unlockDialog} />
    </TerminalsLayout>
  );
}

export default function ShellPage() {
  return (
    <TerminalsScopeContext value={HOST_TERMINALS}>
      <HostShellView />
    </TerminalsScopeContext>
  );
}
