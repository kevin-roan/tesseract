import { useCallback, useMemo, useRef } from "react";
import { FlatList, View, type ListRenderItem } from "react-native";
import Animated from "react-native-reanimated";
import { SparkleIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import MenuSheet from "@/components/menu-sheet";
import Notice from "@/components/notice";
import Reveal from "@/components/reveal";
import ScreenScaffold from "@/components/screen-scaffold";
import TabPills from "@/components/tab-pills";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFreshEntrance } from "@/hooks/use-fresh-entrance";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import ChatComposer from "@/features/chat/components/chat-composer";
import ChatHeader from "@/features/chat/components/chat-header";
import EarlierTurn from "@/features/chat/components/earlier-turn";
import RunMessage from "@/features/chat/components/run-message";
import type { TranscriptBlock } from "@/features/chat/utils/transcript";

import { useAgentRunScreen, type AgentRunTab } from "../../hooks/use-agent-run-screen";
import ActivityGroup from "../activity-group";
import AgentEvent from "../agent-event";
import RunChanges from "../run-changes";
import createStyles from "./styles";

export type AgentRunViewProps = {
  runId: string;
};

const keyOf = (block: TranscriptBlock) => block.key;
const orderOf = (block: TranscriptBlock) => block.order;

const AgentRunView = ({ runId }: AgentRunViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screen = useAgentRunScreen(runId);
  const { run, composer } = screen;
  const listRef = useRef<FlatList<TranscriptBlock>>(null);
  const getScrollable = useCallback(() => listRef.current, []);
  const { scrollProps } = useStickToBottom(getScrollable);
  const orders = useMemo(() => screen.transcript.map(orderOf), [screen.transcript]);
  const entranceFor = useFreshEntrance(orders, Boolean(run));
  const tabs = useMemo(
    () => [
      { value: "agent" as AgentRunTab, label: "Agent" },
      {
        value: "changes" as AgentRunTab,
        label: "Changes",
        badge: screen.changes.length > 0 ? String(screen.changes.length) : undefined,
      },
    ],
    [screen.changes.length],
  );
  const renderItem: ListRenderItem<TranscriptBlock> = useCallback(
    ({ item }) => (
      <Animated.View entering={entranceFor(item.order)}>
        {item.kind === "text" ? <AgentEvent event={item.event} /> : <ActivityGroup activity={item} />}
      </Animated.View>
    ),
    [entranceFor],
  );

  return (
    <ScreenScaffold
      scroll={false}
      avoidKeyboard
      header={
        <ChatHeader
          title={screen.title}
          detail={screen.model ?? screen.badge?.label}
          onBack={screen.nav.back}
          actions={screen.headerActions}
          tabs={run?.projectId ? <TabPills options={tabs} value={screen.tab} onChange={screen.setTab} /> : null}
        />
      }
      footer={
        screen.showComposer && screen.tab === "agent" ? (
          <ChatComposer
            composer={composer}
            placeholder={screen.running ? "Claude is working… queue your next message" : "Ask Claude…"}
            queued={screen.queued}
            testID="run-composer"
          />
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
      ) : screen.tab === "changes" ? (
        <RunChanges changes={screen.changes} />
      ) : (
        <FlatList
          ref={listRef}
          data={screen.transcript}
          keyExtractor={keyOf}
          renderItem={renderItem}
          {...scrollProps}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              {screen.history.map((turn) => (
                <EarlierTurn key={turn.id} run={turn} />
              ))}
              <RunMessage run={run} />
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {screen.result ? (
                <Reveal>
                  <Notice tone="success" title="Result" message={screen.result} />
                </Reveal>
              ) : null}
              {run.error ? (
                <Reveal>
                  <Notice
                    tone="danger"
                    title="Error"
                    message={run.error}
                    actionLabel="Retry"
                    onAction={screen.canRetryRun && !screen.retryingRun ? screen.retryRun : undefined}
                  />
                </Reveal>
              ) : null}
              {screen.retryRunError ? (
                <Reveal>
                  <Notice tone="danger" message={screen.retryRunError} />
                </Reveal>
              ) : null}
              {screen.brief ? (
                <Reveal>
                  <ThemedText variant="caption" color="textTertiary" style={styles.brief} testID="run-brief">
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
