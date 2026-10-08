import { useMemo } from "react";
import { View } from "react-native";
import type { ClaudeSession } from "@tesseract/protocol";

import Notice from "@/components/notice";
import Skeleton from "@/components/skeleton";
import { Surface } from "@/components/surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatTokens } from "@/features/home/utils/tokens";
import { formatRelativeTime } from "@/features/sandbox/utils/format";
import { ControlHeight } from "@/theme";

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
  if (!loading && items.length === 0) return null;

  return (
    <Surface>
      {loading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: skeletonRows }, (_, index) => (
            <Skeleton key={index} height={ControlHeight.lg} radius="md" />
          ))}
        </View>
      ) : (
        items.map((session, index) => (
          <ChatRow
            key={session.sessionId}
            title={sessionTitle(session)}
            preview={session.preview}
            project={projectName(session.projectId)}
            time={formatRelativeTime(session.lastActiveAt)}
            tokens={formatTokens(session.usage.totalTokens)}
            active={session.active}
            divider={index > 0}
            entranceIndex={index}
            onPress={() => onOpen(session)}
          />
        ))
      )}
    </Surface>
  );
};

export default ChatList;
