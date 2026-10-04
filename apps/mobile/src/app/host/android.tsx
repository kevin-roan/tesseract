import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import { useHostAndroidScreen } from "@/features/host-shell/hooks/use-host-android-screen";
import RemoteSurface from "@/features/sandbox/components/remote-surface";

export default function HostAndroidScreen() {
  const screen = useHostAndroidScreen();
  const { page } = screen;

  return (
    <ScreenScaffold
      scroll={false}
      header={
        <ScreenHeader
          title={screen.title}
          subtitle={screen.subtitle}
          onBack={screen.nav.back}
          accessory={<StatusBadge {...screen.badge} />}
          actions={screen.headerActions}
        />
      }
    >
      <RemoteSurface
        title={screen.title}
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
