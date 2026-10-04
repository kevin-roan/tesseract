import { useLocalSearchParams } from "expo-router";

import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import { useHostTerminalSession } from "@/features/host-shell/hooks/use-host-terminal-session";
import RemoteSurface from "@/features/sandbox/components/remote-surface";

export default function HostTerminalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const terminal = useHostTerminalSession(id);
  const { page } = terminal;

  return (
    <ScreenScaffold
      scroll={false}
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
        url={page.url}
        origin={page.origin}
        isLoading={page.isLoading}
        error={page.error}
        surfaceRef={page.surfaceRef}
        onMessage={page.handleMessage}
        onLoad={page.handleLoad}
        onError={page.handleError}
        onTerminate={page.handleTerminate}
        onReconnect={page.reconnect}
      />
    </ScreenScaffold>
  );
}
