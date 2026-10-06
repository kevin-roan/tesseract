import { memo, useCallback, useMemo, useRef } from "react";
import { FlatList, ScrollView, View, type ListRenderItem, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ArrowDownIcon, CheckIcon, CopyIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCopyText } from "@/hooks/use-copy-text";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { Durations, HitSlop, IconSize } from "@/theme";

import { INLINE_LINE_LIMIT, LOG_VIEW_COPY, StreamColors, cleanLogText, logText, type LogViewLine } from "./lines";
import createStyles from "./styles";

export type { LogViewLine } from "./lines";

export type LogViewProps = {
  lines: readonly LogViewLine[];
  emptyLabel?: string;
  /** Bounded, non-virtualized variant for use inside another vertical ScrollView. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
};

const LogRow = memo(function LogRow({ line }: { line: LogViewLine }) {
  return (
    <ThemedText variant="code" color={StreamColors[line.stream]} selectable>
      {cleanLogText(line.text)}
    </ThemedText>
  );
});

const keyOf = (line: LogViewLine) => String(line.seq);

const LogView = ({ lines, emptyLabel = "No output yet.", inline = false, style }: LogViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listRef = useRef<FlatList<LogViewLine>>(null);
  const scrollRef = useRef<ScrollView>(null);
  const getScrollable = useCallback(() => (inline ? scrollRef.current : listRef.current), [inline]);
  const { following, onScroll, onContentSizeChange, jumpToEnd } = useStickToBottom(getScrollable);
  const renderItem: ListRenderItem<LogViewLine> = useCallback(({ item }) => <LogRow line={item} />, []);
  const text = useMemo(() => logText(lines), [lines]);
  const { copied, copy, canCopy } = useCopyText(text);
  const CopyStateIcon = copied ? CheckIcon : CopyIcon;
  const empty = (
    <ThemedText variant="caption" color="textTertiary">
      {emptyLabel}
    </ThemedText>
  );

  return (
    <View style={[styles.container, inline && styles.inline, style]} accessibilityLabel="Log output">
      {inline ? (
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={32}
          contentContainerStyle={styles.content}
        >
          {lines.length === 0 ? empty : lines.slice(-INLINE_LINE_LIMIT).map((line) => <LogRow key={line.seq} line={line} />)}
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={lines}
          keyExtractor={keyOf}
          renderItem={renderItem}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={32}
          initialNumToRender={40}
          maxToRenderPerBatch={40}
          windowSize={9}
          contentContainerStyle={styles.content}
          ListEmptyComponent={empty}
        />
      )}
      {canCopy && lines.length > 0 ? (
        <PressableScale
          depth="control"
          accessibilityRole="button"
          accessibilityLabel={copied ? LOG_VIEW_COPY.copied : LOG_VIEW_COPY.copy}
          hitSlop={HitSlop.md}
          onPress={() => void copy()}
          style={styles.copy}
        >
          <CopyStateIcon size={IconSize.sm} color={copied ? theme.colors.success : theme.colors.textSecondary} weight="regular" />
        </PressableScale>
      ) : null}
      {!following && lines.length > 0 ? (
        <Animated.View entering={FadeIn.duration(Durations.fast)} exiting={FadeOut.duration(Durations.fast)} style={styles.jumpSlot}>
          <PressableScale
            depth="control"
            accessibilityRole="button"
            accessibilityLabel="Jump to latest output"
            hitSlop={HitSlop.md}
            onPress={jumpToEnd}
            style={styles.jump}
          >
            <ArrowDownIcon size={IconSize.sm} color={theme.colors.textOnAccent} weight="regular" />
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
};

export default LogView;
