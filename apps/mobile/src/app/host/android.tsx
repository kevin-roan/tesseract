import ConnectionDot from "@/components/connection-dot";
import { useHostAndroidScreen } from "@/features/host-shell/hooks/use-host-android-screen";
import DisplayStage from "@/features/sandbox/components/display-stage";
import RemoteSurface from "@/features/sandbox/components/remote-surface";

export default function HostAndroidScreen() {
  const screen = useHostAndroidScreen();
  const { page } = screen;

  return (
    <DisplayStage
      fullscreen={screen.fullscreen}
      exitFullscreen={screen.exitFullscreenAction}
      safeArea={screen.safeArea}
      toolbar={{
        title: screen.title,
        subtitle: screen.subtitle,
        accessory: <ConnectionDot tone={screen.badge.tone} label={screen.badge.label} />,
        onBack: screen.nav.back,
        actions: screen.barActions,
        onLayout: screen.onBarLayout,
      }}
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
    </DisplayStage>
  );
}
