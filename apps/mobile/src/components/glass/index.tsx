import { useMemo } from "react";
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";

import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSurfaceTone } from "@/hooks/use-surface-tone";
import { BlurIntensity, type BlurToken } from "@/theme";

import createStyles from "./styles";

export type GlassProps = {
  children?: React.ReactNode;
  /** Reacts to touch with the native liquid-glass shimmer (iOS 26+). */
  interactive?: boolean;
  /** Blur strength of the fallback material; raise it over busy or moving content. */
  intensity?: BlurToken;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type GlassButtonProps = Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  intensity?: BlurToken;
  style?: StyleProp<ViewStyle>;
};

/**
 * Frosted panel that takes its look from the surface it sits on. Renders the
 * native liquid-glass material where the OS has it, and everywhere else a
 * blur under frosted white (light) or smoke (dark) with a hairline rim and a
 * top sheen. Graphite has no glass: it draws a flat hairline panel instead.
 *
 *   <Glass style={styles.stats}>…</Glass>
 */
export const Glass = ({ children, interactive = false, intensity = "light", style, testID }: GlassProps) => {
  const theme = useAppTheme();
  const surfaceTone = useSurfaceTone();
  const tone = surfaceTone ?? "neutral";
  const glass = theme.surfaces[tone].glass;
  const styles = useMemo(() => createStyles(theme, glass, surfaceTone !== undefined), [theme, glass, surfaceTone]);

  if (theme.look === "graphite") {
    return (
      <View style={[styles.glass, styles.flat, style]} testID={testID}>
        {children}
      </View>
    );
  }

  if (isLiquidGlassAvailable() && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={glass.scheme}
        isInteractive={interactive}
        style={[styles.glass, style]}
        testID={testID}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.glass, styles.frosted, style]} testID={testID}>
      <BlurView intensity={BlurIntensity[intensity]} tint={glass.scheme} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[glass.sheen, "transparent"]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
};

/** Round glass control for header and nav rows: a frosted circle with a hairline rim, floating on a soft shadow (a flat dark tile in graphite). */
export const GlassButton = ({ children, intensity, style, disabled, ...pressableProps }: GlassButtonProps) => {
  const theme = useAppTheme();
  const surfaceTone = useSurfaceTone();
  const glass = theme.surfaces[surfaceTone ?? "neutral"].glass;
  const styles = useMemo(() => createStyles(theme, glass, surfaceTone !== undefined), [theme, glass, surfaceTone]);

  return (
    <PressableScale
      depth="control"
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={styles.float}
      {...pressableProps}
    >
      {({ pressed }) => (
        <Glass interactive intensity={intensity} style={[styles.button, disabled && styles.disabled, pressed && styles.pressed, style]}>
          {children}
        </Glass>
      )}
    </PressableScale>
  );
};
