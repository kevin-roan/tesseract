import { MonitorIcon } from "phosphor-react-native";

import ConnectionDot from "@/components/connection-dot";
import EmptyState from "@/components/empty-state";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import BrowserSheet from "@/features/sandbox/components/browser-sheet";
import DisplayStage from "@/features/sandbox/components/display-stage";
import RemoteSurface from "@/features/sandbox/components/remote-surface";
import WindowsSheet from "@/features/sandbox/components/windows-sheet";
import { useDisplayScreen } from "@/features/sandbox/hooks/use-display-screen";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

export default function DisplayScreen() {
  const nav = useSandboxNavigation();
  const screen = useDisplayScreen();
  const { display } = screen;
  const { session } = display;
  const unreachable = display.statusError !== null && !session.url;

  if (display.outage || unreachable) {
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
        ) : (
          <EmptyState
            icon={MonitorIcon}
            title="Couldn't reach the display"
            message={display.statusError ?? undefined}
            actionLabel="Try again"
            onAction={display.recheck}
          />
        )}
      </ScreenScaffold>
    );
  }

  return (
    <DisplayStage
      fullscreen={screen.fullscreen}
      exitFullscreen={screen.exitFullscreenAction}
      safeArea={screen.safeArea}
      toolbar={{
        title: "Display",
        subtitle: display.subtitle,
        accessory: <ConnectionDot tone={display.badge.tone} label={display.badge.label} />,
        onBack: nav.back,
        actions: screen.barActions,
        onLayout: screen.onBarLayout,
      }}
    >
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
        onTerminate={session.handleTerminate}
        onReconnect={session.reconnect}
      />
      <BrowserSheet visible={screen.browser.visible} onClose={screen.browser.close} />
      <WindowsSheet visible={screen.windows.visible} onClose={screen.windows.close} />
    </DisplayStage>
  );
}
