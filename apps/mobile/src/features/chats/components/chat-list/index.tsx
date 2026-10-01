import { useMemo } from "react";
import { View } from "react-native";
import type { ClaudeSession } from "@theone/protocol";

import Notice from "@/components/notice";
import Skeleton from "@/components/skeleton";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatTokens } from "@/features/home/utils/tokens";
import { formatRelativeTime } from "@/features/sandbox/utils/format";

import { sessionTitle } from "../../utils/sessions";
import ChatRow from "../chat-row";
import createStyles from "./styles";

export type ChatListProps = {
  items: readonly ClaudeSession[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (session: ClaudeSession) => void;
  projectName: (projectId: string | null) => string | null;
  skeletonRows?: number;
};

const ChatList = ({ items, loading, error, onRetry, onOpen, projectName, skeletonRows = 3 }: ChatListProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (error) return <Notice tone="danger" title="Chats are unavailable" message={error} actionLabel="Retry" onAction={onRetry} />;

  return (
    <View style={styles.list}>
      {loading
        ? Array.from({ length: skeletonRows }, (_, index) => <Skeleton key={index} height={112} radius="card" />)
        : items.map((session) => (
            <ChatRow
              key={session.sessionId}
              title={sessionTitle(session)}
              preview={session.preview}
              project={projectName(session.projectId)}
              time={formatRelativeTime(session.lastActiveAt)}
              tokens={formatTokens(session.usage.totalTokens)}
              active={session.active}
              onPress={() => onOpen(session)}
            />
          ))}
    </View>
  );
};

export default ChatList;
