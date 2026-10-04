import { PlugsIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import HostAndroid from "@/features/host-shell/components/host-android";
import HostSetup from "@/features/host-shell/components/host-setup";
import HostShells from "@/features/host-shell/components/host-shells";
import HostUnlock from "@/features/host-shell/components/host-unlock";
import { useHostScreen } from "@/features/host-shell/hooks/use-host-screen";
import { HOST_SCREEN } from "@/features/host-shell/utils/content";
import { describeHostError } from "@/features/host-shell/utils/errors";

export default function HostScreen() {
  const screen = useHostScreen();
  const { unlock, shells } = screen;

  return (
    <ScreenScaffold
      avoidKeyboard
      header={
        <ScreenHeader title={HOST_SCREEN.title} subtitle={screen.subtitle} onBack={screen.nav.back} actions={screen.headerActions} />
      }
    >
      {screen.mode === "loading" ? <EmptyState loading title={HOST_SCREEN.title} /> : null}
      {screen.mode === "setup" ? <HostSetup fromLink={screen.fromLink} scanner={screen.scanner} form={screen.pairing} /> : null}
      {screen.mode === "locked" && screen.issue ? (
        <Notice
          tone="danger"
          icon={PlugsIcon}
          title={HOST_SCREEN.repairTitle}
          message={describeHostError(unlock.statusError)}
          actionLabel={HOST_SCREEN.repair}
          onAction={screen.repair}
        />
      ) : null}
      {screen.mode === "locked" && !screen.issue ? (
        <HostUnlock
          hostName={screen.host?.name ?? HOST_SCREEN.title}
          pin={unlock.pin}
          onPress={unlock.press}
          canSubmit={unlock.canSubmit}
          submitting={unlock.submitting}
          disabled={unlock.disabled}
          line={unlock.line}
          rejectedMessage={unlock.rejectedMessage}
          pinMissing={unlock.pinMissing}
          message={unlock.message}
          onRetry={unlock.retry}
        />
      ) : null}
      {screen.mode === "unlocked" ? (
        <HostShells
          list={shells.list}
          loading={shells.loading}
          error={shells.error}
          creating={shells.creating}
          closingId={shells.closingId}
          sessionChip={screen.sessionChip}
          onOpen={shells.open}
          onCreate={shells.create}
          onClose={shells.close}
          onRetry={shells.refresh}
        />
      ) : null}
      {screen.mode === "unlocked" ? <HostAndroid android={screen.android} /> : null}
    </ScreenScaffold>
  );
}
