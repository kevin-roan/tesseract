import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { TerminalWindowIcon } from "phosphor-react-native";
import type { TerminalInfo } from "@theone/protocol";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import MotionItem from "@/components/motion-item";
import RemoteSurface from "@/features/sandbox/components/remote-surface";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useTerminalLauncher } from "@/features/sandbox/hooks/use-terminal-launcher";
import { useTerminalSession } from "@/features/sandbox/hooks/use-terminal-session";
import type { TerminalLaunch } from "@/features/sandbox/types";
import { terminalLaunchFromParams } from "@/features/sandbox/utils/routes";

type Params = { id: string; kind?: string; projectId?: string };

export default function TerminalScreen() {
  const params = useLocalSearchParams<Params>();
  const launch = terminalLaunchFromParams(params);
  return launch ? <NewTerminal launch={launch} /> : <TerminalSession id={params.id} />;
}

function NewTerminal({ launch }: { launch: TerminalLaunch }) {
  const nav = useSandboxNavigation();
  const onCreated = useCallback((terminal: TerminalInfo) => nav.replaceWithTerminal(terminal.id), [nav]);
  const launcher = useTerminalLauncher(launch, onCreated);

  return (
    <ScreenScaffold scroll={false} header={<ScreenHeader title="New session" onBack={nav.back} />}>
      {launcher.error ? (
        <EmptyState
          icon={TerminalWindowIcon}
          title="Couldn't start the session"
          message={launcher.error}
          actionLabel="Try again"
          onAction={launcher.retry}
        />
      ) : (
        <EmptyState loading title="Starting the session…" />
      )}
    </ScreenScaffold>
  );
}

function TerminalSession({ id }: { id: string }) {
  const terminal = useTerminalSession(id);
  const { session } = terminal;

  return (
    <ScreenScaffold
      scroll={false}
      avoidKeyboard
      header={
        <ScreenHeader
          title={terminal.title}
          subtitle={terminal.subtitle}
          onBack={terminal.nav.back}
          accessory={<StatusBadge {...terminal.badge} />}
          actions={terminal.headerActions}
        />
      }
      footer={
        terminal.closeError ? (
          <MotionItem>
            <Notice tone="danger" message={terminal.closeError} />
          </MotionItem>
        ) : undefined
      }
    >
      <RemoteSurface
        title="Terminal"
        url={session.url}
        origin={session.origin}
        isLoading={session.isLoading}
        error={session.error}
        surfaceRef={session.surfaceRef}
        onMessage={session.handleMessage}
        onLoad={session.handleLoad}
        onError={session.handleError}
        onTerminate={session.handleTerminate}
        onReconnect={session.reconnect}
      />
    </ScreenScaffold>
  );
}
