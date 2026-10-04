import { useCallback, useMemo, useRef } from "react";
import { FlatList, View, type ListRenderItem } from "react-native";
import Animated from "react-native-reanimated";
import { SparkleIcon } from "phosphor-react-native";

import BarStrip from "@/components/bar-strip";
import EmptyState from "@/components/empty-state";
import MenuSheet from "@/components/menu-sheet";
import Notice from "@/components/notice";
import Reveal from "@/components/reveal";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFreshEntrance } from "@/hooks/use-fresh-entrance";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import ChatComposer from "@/features/chat/components/chat-composer";
import MessageBubble from "@/features/chat/components/message-bubble";
import RunMessage from "@/features/chat/components/run-message";
import { formatClock, type ChatEventItem } from "@/features/chat/utils/messages";

import { useAgentRunScreen } from "../../hooks/use-agent-run-screen";
import { RUN_ACTIVITY_LEVELS } from "../../utils/run-activity";
import AgentEvent from "../agent-event";
import createStyles from "./styles";

export type AgentRunViewProps = {
  runId: string;
};

const keyOf = (item: ChatEventItem) => String(item.event.seq);
const seqOf = (item: ChatEventItem) => item.event.seq;

const AgentRunView = ({ runId }: AgentRunViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screen = useAgentRunScreen(runId);
  const { run, composer } = screen;
  const listRef = useRef<FlatList<ChatEventItem>>(null);
  const getScrollable = useCallback(() => listRef.current, []);
  const { onScroll, onContentSizeChange } = useStickToBottom(getScrollable);
  const seqs = useMemo(() => screen.messages.map(seqOf), [screen.messages]);
  const entranceFor = useFreshEntrance(seqs, Boolean(run));
  const renderItem: ListRenderItem<ChatEventItem> = useCallback(
    ({ item }) => (
      <Animated.View entering={entranceFor(item.event.seq)} style={item.showHeader && styles.turn}>
        <MessageBubble role="assistant" author="Claude" timeLabel={formatClock(item.event.ts)} showHeader={item.showHeader}>
          <AgentEvent event={item.event} />
        </MessageBubble>
      </Animated.View>
    ),
    [styles, entranceFor],
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
          accessory={
            screen.badge ? (
              <Reveal key={screen.badge.label}>
                <StatusBadge {...screen.badge} />
              </Reveal>
            ) : undefined
          }
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
              {screen.running ? (
                <Reveal>
                  <BarStrip values={RUN_ACTIVITY_LEVELS} stream height={theme.spacing.xl} style={styles.activity} />
                </Reveal>
              ) : null}
              {screen.result ? (
                <Reveal>
                  <Notice tone="success" title="Result" message={screen.result} />
                </Reveal>
              ) : null}
              {run.error ? (
                <Reveal>
                  <Notice tone="danger" title="Error" message={run.error} />
                </Reveal>
              ) : null}
              {screen.brief ? (
                <Reveal style={styles.brief}>
                  <ThemedText variant="caption" color="textSecondary" style={styles.briefText} testID="run-brief">
                    {screen.brief}
                  </ThemedText>
                </Reveal>
              ) : null}
              {screen.streamError ? (
                <Reveal>
                  <Notice tone="warning" message={screen.streamError} actionLabel="Reconnect" onAction={screen.retry} />
                </Reveal>
              ) : null}
              {screen.cancelError ? (
                <Reveal>
                  <Notice tone="danger" message={screen.cancelError} />
                </Reveal>
              ) : null}
              {screen.syncNotice ? (
                <Reveal>
                  <Notice {...screen.syncNotice} actionLabel="Dismiss" onAction={screen.dismissSyncNotice} />
                </Reveal>
              ) : null}
            </View>
          }
        />
      )}
      <MenuSheet title="Sync" testID="sync-menu" {...screen.syncMenu} />
    </ScreenScaffold>
  );
};

export default AgentRunView;
