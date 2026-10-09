import { useMemo } from "react";
import { Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { CaretUpIcon, ChatCircleIcon, CropIcon, PaperclipIcon, StopIcon } from "phosphor-react-native";

import DotShape from "@/components/dot-shape";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { MaxFontSizeMultiplier } from "@/theme";

import type { IslandState } from "@/modules/tesseract-island";

import { useIslandSummary } from "../../hooks/use-island-summary";
import { HEADLINE_MIN_FONT_SCALE, ISLAND_PANEL_GLYPH_SIZE } from "../../utils/constants";
import { tokensTodayLabel, type IslandItem } from "../../utils/format";
import IslandButton from "../island-button";
import IslandPager from "../island-pager";
import createStyles from "./styles";

export type IslandPanelProps = {
  state: IslandState;
  sharedCount: number;
  hasDraft: boolean;
  stopping: boolean;
  width: number;
  height: number;
  /** Live tasks to swipe through, and the one the buttons act on. */
  items: IslandItem[];
  focused: IslandItem | null;
  onFocus: (id: string) => void;
  onOpen: () => void;
  onStop: () => void;
  onCapture: () => void;
  onAttach: () => void;
  onCollapse: () => void;
  style?: AnimatedStyle<ViewStyle>;
  testID?: string;
};

/** Expanded island: sandbox and usage on top, the live tasks to swipe through, and a single row of controls acting on the one shown. */
const IslandPanel = ({
  state,
  sharedCount,
  hasDraft,
  stopping,
  width,
  height,
  items,
  focused,
  onFocus,
  onOpen,
  onStop,
  onCapture,
  onAttach,
  onCollapse,
  style,
  testID,
}: IslandPanelProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const motion = useLayoutMotion();
  const summary = useIslandSummary(state, sharedCount, hasDraft);
  const today = tokensTodayLabel(state.usage.todayTokens);

  return (
    <Animated.View exiting={motion.fadeOut} style={[styles.panel, { width, height }, style]} testID={testID}>
      <View style={styles.top}>
        <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
          {state.sandboxName}
        </Text>
        <Text
          style={[styles.meta, styles.usage]}
          numberOfLines={1}
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
          accessibilityLabel={`${today} tokens`}
        >
          {today}
        </Text>
      </View>

      {items.length > 0 ? (
        <IslandPager items={items} focusedId={focused?.id ?? null} width={width} onFocus={onFocus} onOpen={onOpen} />
      ) : (
        <View style={styles.middle} accessible accessibilityLabel={summary.caption} accessibilityValue={{ text: summary.headline }}>
          <DotShape
            size={ISLAND_PANEL_GLYPH_SIZE}
            color={theme.colors.textTertiary}
            dots={24}
            dotSize={2.5}
            scatter={0.4}
            animate={false}
            period={2000}
          />
          <View style={styles.stat}>
            <Text
              style={styles.headline}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={HEADLINE_MIN_FONT_SCALE}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
            >
              {summary.headline}
            </Text>
            <Text style={styles.caption} numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
              {summary.caption}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <IslandButton icon={CropIcon} label="Capture" onPress={onCapture} />
        {sharedCount > 0 ? (
          <IslandButton
            icon={PaperclipIcon}
            label={sharedCount === 1 ? "Attach shared item" : `Attach ${sharedCount} shared items`}
            badge={sharedCount}
            onPress={onAttach}
          />
        ) : null}
        <IslandButton icon={ChatCircleIcon} label="Open chat" variant="primary" onPress={onOpen} />
        {focused ? (
          <IslandButton icon={StopIcon} label={`Stop ${focused.title}`} loading={stopping} onPress={onStop} />
        ) : (
          <IslandButton icon={CaretUpIcon} label="Collapse" onPress={onCollapse} />
        )}
      </View>
    </Animated.View>
  );
};

export default IslandPanel;
