import { PlugsConnectedIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import HomeHeader from "@/components/home-header";
import ScreenScaffold from "@/components/screen-scaffold";
import ChatComposer from "@/features/chat/components/chat-composer";
import ComposerBanner from "@/features/chat/components/composer-banner";
import HomeDrawer from "@/features/home/components/home-drawer";
import HomeHero from "@/features/home/components/home-hero";
import { useHomeScreen } from "@/features/home/hooks/use-home-screen";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";

export default function HomeScreen() {
  const home = useHomeScreen();

  if (!home.hydrated) return <SandboxGate />;

  if (!home.paired) {
    return (
      <ScreenScaffold>
        <EmptyState
          icon={PlugsConnectedIcon}
          title="Pair a sandbox"
          message="Chat with Claude in your sandbox once this device is paired."
          actionLabel="Pair a sandbox"
          onAction={home.pair}
        />
      </ScreenScaffold>
    );
  }

  const { status } = home;

  return (
    <ScreenScaffold
      scroll={false}
      avoidKeyboard
      header={<HomeHeader onOpenMenu={home.drawer.open} onOpenInbox={home.inbox.open} inboxCount={home.inbox.unreadCount} />}
      footer={
        <ChatComposer
          composer={home.composer}
          placeholder="Chat with Claude"
          noProjectLabel="New project"
          testID="home-composer"
          banner={
            status ? (
              <ComposerBanner
                title={status.title}
                message={status.message}
                progress={status.progress}
                actionLabel={status.actionLabel}
                onAction={status.onAction}
                testID={`home-status-${status.id}`}
              />
            ) : null
          }
        />
      }
    >
      <HomeHero name={home.name} />
      <HomeDrawer visible={home.drawer.visible} onClose={home.drawer.close} />
    </ScreenScaffold>
  );
}
