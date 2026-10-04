import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CaretDownIcon, CaretUpIcon, type Icon } from "phosphor-react-native";

import ActionButton, { type ActionButtonVariant } from "@/components/action-button";
import DotSphere from "@/components/dot-sphere";
import { Glass } from "@/components/glass";
import PressableScale from "@/components/pressable-scale";
import ProgressBar from "@/components/progress-bar";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { HitSlop, IconSize } from "@/theme";

import createStyles, { SPHERE } from "./styles";

export type ActivityIslandAction = {
  label: string;
  onPress: () => void;
  icon?: Icon;
  variant?: ActionButtonVariant;
  loading?: boolean;
};

export type ActivityIslandProps = {
  title: string;
  message?: string;
  /** Fraction in [0, 1]; null shows an indeterminate state. */
  progress?: number | null;
  expanded: boolean;
  onToggle: () => void;
  actions?: ActivityIslandAction[];
  testID?: string;
};

const percentLabel = (progress: number | null | undefined) =>
  progress === null || progress === undefined ? null : `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;

/**
 * Hairline capsule for a background task that opens into a card with its
 * progress and actions, in the spirit of the iOS Dynamic Island.
 */
const ActivityIsland = ({ title, message, progress = null, expanded, onToggle, actions = [], testID }: ActivityIslandProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toggle = useHapticPress(onToggle);
  const percent = percentLabel(progress);
  const motion = useLayoutMotion();

  return (
    <Animated.View layout={motion.layout} testID={testID}>
      {expanded ? (
        <Glass intensity="medium" style={styles.card}>
          <PressableScale
            depth="control"
            accessibilityRole="button"
            accessibilityLabel="Collapse"
            hitSlop={HitSlop.md}
            onPress={toggle}
            style={styles.collapse}
          >
            <CaretUpIcon size={IconSize.md} color={theme.colors.textSecondary} weight="regular" />
          </PressableScale>
          <Animated.View entering={motion.fadeIn}>
            <DotSphere size={SPHERE.card.size} dots={SPHERE.card.dots} />
          </Animated.View>
          <View style={styles.copy}>
            <ThemedText variant="h4" style={styles.centered}>
              {title}
            </ThemedText>
            {message ? (
              <ThemedText variant="bodySmall" color="textSecondary" style={styles.centered}>
                {message}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.progress}>
            <ProgressBar progress={progress} label={title} />
            {percent ? (
              <ThemedText variant="caption" color="textSecondary" style={[styles.centered, styles.figure]}>
                {percent}
              </ThemedText>
            ) : null}
          </View>
          {actions.length > 0 ? (
            <View style={styles.actions}>
              {actions.map((action) => (
                <View key={action.label} style={styles.action}>
                  <ActionButton
                    label={action.label}
                    icon={action.icon}
                    variant={action.variant ?? "secondary"}
                    loading={action.loading}
                    onPress={action.onPress}
                    stretch
                  />
                </View>
              ))}
            </View>
          ) : null}
        </Glass>
      ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={percent ? `${title}, ${percent}` : title}
          accessibilityHint="Shows progress and controls"
          onPress={toggle}
        >
          <Glass intensity="medium" style={styles.capsule}>
            <DotSphere size={SPHERE.capsule.size} dots={SPHERE.capsule.dots} />
            <ThemedText variant="h4" numberOfLines={1} style={styles.capsuleText}>
              {title}
            </ThemedText>
            {percent ? <TagChip label={percent} /> : null}
            <CaretDownIcon size={IconSize.sm} color={theme.colors.textSecondary} weight="regular" />
          </Glass>
        </PressableScale>
      )}
    </Animated.View>
  );
};

export default ActivityIsland;
