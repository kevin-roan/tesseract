import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, View, type ListRenderItem } from "react-native";
import { SparkleIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import ChatComposer from "@/features/chat/components/chat-composer";
import MessageBubble from "@/features/chat/components/message-bubble";
import RunMessage from "@/features/chat/components/run-message";
import { formatClock, type ChatEventItem } from "@/features/chat/utils/messages";

import { useAgentRunScreen } from "../../hooks/use-agent-run-screen";
import AgentEvent from "../agent-event";
import createStyles from "./styles";

export type AgentRunViewProps = {
  runId: string;
};

const keyOf = (item: ChatEventItem) => String(item.event.seq);

const AgentRunView = ({ runId }: AgentRunViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screen = useAgentRunScreen(runId);
  const { run, composer } = screen;
  const listRef = useRef<FlatList<ChatEventItem>>(null);
  const getScrollable = useCallback(() => listRef.current, []);
  const { onScroll, onContentSizeChange } = useStickToBottom(getScrollable);
  const renderItem: ListRenderItem<ChatEventItem> = useCallback(
    ({ item }) => (
      <View style={item.showHeader && styles.turn}>
        <MessageBubble role="assistant" author="Claude" timeLabel={formatClock(item.event.ts)} showHeader={item.showHeader}>
          <AgentEvent event={item.event} />
        </MessageBubble>
      </View>
    ),
    [styles],
  );

  return (
    <ScreenScaffold
      scroll={false}
      avoidKeyboard
      header={
        <ScreenHeader
          title="Claude"
          subtitle={run?.projectId ?? undefined}
          onBack={screen.nav.back}
          accessory={screen.badge ? <StatusBadge {...screen.badge} /> : undefined}
          actions={screen.headerActions}
        />
      }
      footer={
        run && screen.canContinue ? (
          <ChatComposer composer={composer} placeholder="Reply to Claude…" testID="run-composer" />
        ) : undefined
      }
    >
      {!run ? (
        screen.loadError ? (
          <EmptyState
            icon={SparkleIcon}
            title="Couldn't load this run"
            message={screen.loadError}
            actionLabel="Try again"
            onAction={screen.retry}
          />
        ) : (
          <EmptyState loading title="Loading run…" />
        )
      ) : (
        <FlatList
          ref={listRef}
          data={screen.messages}
          keyExtractor={keyOf}
          renderItem={renderItem}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.list}
          ListHeaderComponent={<RunMessage run={run} />}
          ListFooterComponent={
            <View style={styles.footer}>
              {screen.running ? <ActivityIndicator color={theme.colors.streamingCursor} style={styles.spinner} /> : null}
              {screen.result ? <Notice tone="success" title="Result" message={screen.result} /> : null}
              {run.error ? <Notice tone="danger" title="Error" message={run.error} /> : null}
              {screen.brief ? (
                <ThemedText variant="caption" color="textTertiary" style={styles.brief} testID="run-brief">
                  {screen.brief}
                </ThemedText>
              ) : null}
              {screen.streamError ? (
                <Notice tone="warning" message={screen.streamError} actionLabel="Reconnect" onAction={screen.retry} />
              ) : null}
              {screen.cancelError ? <Notice tone="danger" message={screen.cancelError} /> : null}
              {screen.syncNotice ? (
                <Notice {...screen.syncNotice} actionLabel="Dismiss" onAction={screen.dismissSyncNotice} />
              ) : null}
            </View>
          }
        />
      )}
    </ScreenScaffold>
  );
};

export default AgentRunView;
