import { useLocalSearchParams } from "expo-router";

import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import ChatComposer from "@/features/chat/components/chat-composer";
import MessageBubble from "@/features/chat/components/message-bubble";
import { useResumeChat } from "@/features/chats/hooks/use-resume-chat";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function ResumeChatScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const chat = useResumeChat(firstParam(params.id) ?? "");

  return (
    <ScreenScaffold
      avoidKeyboard
      header={<ScreenHeader title={chat.title} subtitle={chat.project ?? "Continue this chat"} onBack={chat.back} />}
      footer={<ChatComposer composer={chat.composer} placeholder="Tell Claude what to do next…" />}
    >
      {chat.error ? <Notice tone="warning" message={chat.error} /> : null}
      {chat.session?.preview ? <MessageBubble role="assistant" author="Claude" text={chat.session.preview} /> : null}
    </ScreenScaffold>
  );
}
