import { useMemo } from "react";
import { Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { CaretUpIcon, ChatCircleIcon, CropIcon, PaperclipIcon, StopIcon } from "phosphor-react-native";

import DotShape from "@/components/dot-shape";
import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { MaxFontSizeMultiplier } from "@/theme";

import type { IslandState } from "@/modules/theone-island";

import { useIslandSummary } from "../../hooks/use-island-summary";
import { HEADLINE_MIN_FONT_SCALE, ISLAND_PANEL_GLYPH_SIZE } from "../../utils/constants";
import { tokensTodayLabel } from "../../utils/format";
import IslandButton from "../island-button";
import createStyles from "./styles";

export type IslandPanelProps = {
  state: IslandState;
  sharedCount: number;
  hasDraft: boolean;
  stopping: boolean;
  width: number;
  onOpen: () => void;
  onStop: () => void;
  onCapture: () => void;
  onAttach: () => void;
  onCollapse: () => void;
  style?: AnimatedStyle<ViewStyle>;
  testID?: string;
};

/** Expanded island: sandbox and usage on top, one big live figure, and a single row of controls. Fits without scrolling. */
const IslandPanel = ({
  state,
  sharedCount,
  hasDraft,
  stopping,
  width,
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
  const openRun = useHapticPress(state.runs.length > 0 ? onOpen : undefined);
  const today = tokensTodayLabel(state.usage.todayTokens);

  return (
    <Animated.View exiting={motion.fadeOut} style={[styles.panel, { width }, style]} testID={testID}>
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

      <PressableScale
        depth="card"
        accessibilityRole={openRun ? "button" : undefined}
        accessibilityLabel={summary.caption}
        accessibilityValue={{ text: summary.headline }}
        accessibilityHint={openRun ? "Opens the chat" : undefined}
        disabled={!openRun}
        onPress={openRun}
        style={styles.middle}
      >
        <DotShape
          size={ISLAND_PANEL_GLYPH_SIZE}
          color={summary.live ? theme.colors.text : theme.colors.textTertiary}
          dots={24}
          dotSize={2.5}
          scatter={0.4}
          animate={summary.live}
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
          <View style={styles.captionRow}>
            <Text style={styles.caption} numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
              {summary.caption}
            </Text>
            {summary.more > 0 ? (
              <Text style={styles.more} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
                +{summary.more}
              </Text>
            ) : null}
          </View>
        </View>
      </PressableScale>

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
        {summary.primary ? (
          <IslandButton icon={StopIcon} label={`Stop ${summary.primary}`} loading={stopping} onPress={onStop} />
        ) : (
          <IslandButton icon={CaretUpIcon} label="Collapse" onPress={onCollapse} />
        )}
      </View>
    </Animated.View>
  );
};

export default IslandPanel;
