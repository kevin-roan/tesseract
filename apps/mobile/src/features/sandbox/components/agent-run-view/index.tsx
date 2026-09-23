import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, View, type ListRenderItem } from "react-native";
import { SparkleIcon } from "phosphor-react-native";
import type { AgentRunEvent } from "@theone/protocol";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";

import { useAgentRunScreen } from "../../hooks/use-agent-run-screen";
import AgentComposer from "../agent-composer";
import AgentEvent from "../agent-event";
import createStyles from "./styles";

export type AgentRunViewProps = {
  runId: string;
};

const keyOf = (event: AgentRunEvent) => String(event.seq);

const AgentRunView = ({ runId }: AgentRunViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screen = useAgentRunScreen(runId);
  const { run, composer } = screen;
  const listRef = useRef<FlatList<AgentRunEvent>>(null);
  const getScrollable = useCallback(() => listRef.current, []);
  const { onScroll, onContentSizeChange } = useStickToBottom(getScrollable);
  const renderItem: ListRenderItem<AgentRunEvent> = useCallback(({ item }) => <AgentEvent event={item} />, []);

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
          data={screen.events}
          keyExtractor={keyOf}
          renderItem={renderItem}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.prompt}>
              <ThemedText variant="overline" color="textTertiary">
                Prompt
              </ThemedText>
              <ThemedText variant="body" selectable>
                {run.prompt}
              </ThemedText>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {screen.running ? <ActivityIndicator color={theme.colors.streamingCursor} /> : null}
              {run.result ? <Notice tone="success" title="Result" message={run.result} /> : null}
              {run.error ? <Notice tone="danger" title="Error" message={run.error} /> : null}
              {screen.cost ? (
                <ThemedText variant="caption" color="textTertiary">
                  {`Cost ${screen.cost}`}
                </ThemedText>
              ) : null}
              {screen.streamError ? (
                <Notice tone="warning" message={screen.streamError} actionLabel="Reconnect" onAction={screen.retry} />
              ) : null}
              {screen.cancelError ? <Notice tone="danger" message={screen.cancelError} /> : null}
              {screen.canContinue ? (
                <AgentComposer
                  prompt={composer.prompt}
                  onChangePrompt={composer.setPrompt}
                  onSubmit={composer.submit}
                  canSubmit={composer.canSubmit}
                  submitting={composer.isSubmitting}
                  submitLabel="Continue"
                  placeholder="Reply to Claude or give the next instruction…"
                  error={composer.error}
                />
              ) : null}
            </View>
          }
        />
      )}
    </ScreenScaffold>
  );
};

export default AgentRunView;
