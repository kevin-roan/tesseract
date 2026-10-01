import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { CaretDownIcon, CaretUpIcon, type Icon } from "phosphor-react-native";

import ActionButton, { type ActionButtonVariant } from "@/components/action-button";
import DotSphere from "@/components/dot-sphere";
import { Glass } from "@/components/glass";
import ProgressBar from "@/components/progress-bar";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { HitSlop, IconSize, Springs } from "@/theme";

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

const layout = LinearTransition.springify()
  .damping(Springs.gentle.damping)
  .stiffness(Springs.gentle.stiffness);

const percentLabel = (progress: number | null | undefined) =>
  progress === null || progress === undefined ? null : `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;

/**
 * Glass capsule for a background task that opens into a card with its
 * progress and actions, in the spirit of the iOS Dynamic Island.
 */
const ActivityIsland = ({ title, message, progress = null, expanded, onToggle, actions = [], testID }: ActivityIslandProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toggle = useHapticPress(onToggle);
  const percent = percentLabel(progress);

  return (
    <Animated.View layout={layout} testID={testID}>
      {expanded ? (
        <Glass intensity="medium" style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collapse"
            hitSlop={HitSlop.md}
            onPress={toggle}
            style={styles.collapse}
          >
            <CaretUpIcon size={IconSize.md} color={theme.colors.textSecondary} weight="bold" />
          </Pressable>
          <Animated.View entering={FadeIn}>
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
              <ThemedText variant="caption" color="textSecondary" style={styles.centered}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={percent ? `${title}, ${percent}` : title}
          accessibilityHint="Shows progress and controls"
          onPress={toggle}
        >
          {({ pressed }) => (
            <Glass intensity="medium" style={[styles.capsule, pressed && styles.pressed]}>
              <DotSphere size={SPHERE.capsule.size} dots={SPHERE.capsule.dots} />
              <ThemedText variant="h4" numberOfLines={1} style={styles.capsuleText}>
                {title}
              </ThemedText>
              {percent ? (
                <View style={styles.percentPill}>
                  <ThemedText variant="label">{percent}</ThemedText>
                </View>
              ) : null}
              <CaretDownIcon size={IconSize.sm} color={theme.colors.textSecondary} weight="bold" />
            </Glass>
          )}
        </Pressable>
      )}
    </Animated.View>
  );
};

export default ActivityIsland;
