import { MonitorIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import RemoteSurface from "@/features/sandbox/components/remote-surface";
import { useDisplaySession } from "@/features/sandbox/hooks/use-display-session";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

export default function DisplayScreen() {
  const nav = useSandboxNavigation();
  const display = useDisplaySession();
  const { session } = display;

  return (
    <ScreenScaffold
      scroll={false}
      header={
        <ScreenHeader
          title="Display"
          subtitle={display.subtitle}
          onBack={nav.back}
          accessory={<StatusBadge {...display.badge} />}
          actions={display.headerActions}
        />
      }
    >
      {display.outage ? (
        <EmptyState
          icon={MonitorIcon}
          loading={display.rechecking}
          title={display.outage.title}
          message={display.outage.message}
          actionLabel="Check again"
          onAction={display.recheck}
        />
      ) : display.statusError && !session.url ? (
        <EmptyState
          icon={MonitorIcon}
          title="Couldn't reach the display"
          message={display.statusError}
          actionLabel="Try again"
          onAction={display.recheck}
        />
      ) : (
        <RemoteSurface
          title="Display"
          url={session.url}
          origin={session.origin}
          isLoading={session.isLoading || display.statusLoading}
          error={session.error}
          surfaceRef={session.surfaceRef}
          onMessage={session.handleMessage}
          onLoad={session.handleLoad}
          onError={session.handleError}
          onReconnect={session.reconnect}
        />
      )}
    </ScreenScaffold>
  );
}
