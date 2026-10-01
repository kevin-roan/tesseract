import { ChatsIcon, PlusIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import ChatList from "@/features/chats/components/chat-list";
import { useChatsScreen } from "@/features/chats/hooks/use-chats-screen";

export default function ChatsScreen() {
  const chats = useChatsScreen();
  const empty = !chats.loading && !chats.error && chats.items.length === 0;

  return (
    <ScreenScaffold
      refreshing={chats.refreshing}
      onRefresh={chats.refresh}
      header={
        <ScreenHeader
          title="Chats"
          subtitle="Claude conversations in this sandbox"
          onBack={chats.back}
          actions={[{ id: "new", icon: PlusIcon, label: "New chat", onPress: chats.newChat }]}
        />
      }
    >
      {empty ? (
        <EmptyState
          icon={ChatsIcon}
          title="No chats yet"
          message="Start a chat and Claude works inside the sandbox. Sessions from the terminal show up here too."
          actionLabel="New chat"
          onAction={chats.newChat}
        />
      ) : (
        <ChatList
          items={chats.items}
          loading={chats.loading || !chats.hydrated}
          error={chats.error}
          onRetry={chats.retry}
          onOpen={chats.open}
          projectName={chats.projectName}
          skeletonRows={5}
        />
      )}
    </ScreenScaffold>
  );
}
