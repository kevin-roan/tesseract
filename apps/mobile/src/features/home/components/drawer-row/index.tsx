import { useMemo } from "react";
import Animated, { ZoomIn } from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import { badgeLabel } from "@/components/list-group/utils/badge";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { ControlHeight, IconSize, MaxFontSizeMultiplier, Durations } from "@/theme";
import { MotionEasing } from "@/lib/motion";

import createStyles from "./styles";

export type DrawerRowProps = {
  icon: Icon;
  label: string;
  badge?: number | null;
  size?: "regular" | "large";
  index: number;
  onPress: () => void;
  testID?: string;
};

/** Drawer entry: an icon tile and a name, an optional count in a small grey square; rises in and sinks on press. */
const DrawerRow = ({ icon, label, badge, size = "regular", index, onPress, testID }: DrawerRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance(index, "tight");
  const count = badgeLabel(badge);
  const large = size === "large";

  return (
    <Animated.View entering={entering}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[label, count].filter(Boolean).join(", ")}
        onPress={onPress}
        testID={testID}
        style={[styles.row, large && styles.rowLarge]}
      >
        <IconTile
          icon={icon}
          size={large ? ControlHeight.md : ControlHeight.sm}
          iconSize={large ? IconSize.md : IconSize.sm}
          radius="md"
        />
        <ThemedText variant={large ? "bodyLarge" : "body"} color={large ? "text" : "textSecondary"} numberOfLines={1} style={styles.label}>
          {label}
        </ThemedText>
        {count ? (
          <Animated.View entering={ZoomIn.duration(Durations.normal).easing(MotionEasing)} style={styles.badge}>
            <ThemedText variant="caption" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.badgeText}>
              {count}
            </ThemedText>
          </Animated.View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
};

export default DrawerRow;
