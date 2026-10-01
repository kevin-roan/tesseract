import { memo, useId, useMemo } from "react";
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useAppTheme } from "@/hooks/use-app-theme";
import { SurfaceToneContext } from "@/hooks/use-surface-tone";
import type { SurfaceFill as Fill, SurfaceTone } from "@/theme";

import createStyles from "./styles";

export type SurfaceProps = {
  children?: React.ReactNode;
  /** Card fill. Defaults to `neutral`; the colored tones re-ink everything inside. */
  tone?: SurfaceTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type SurfaceButtonProps = Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  tone?: SurfaceTone;
  style?: StyleProp<ViewStyle>;
};

export type SurfacePillProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const SurfaceFill = memo(function SurfaceFill({ fill }: { fill: Fill }) {
  const rawId = useId();
  const id = `surface${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx={`${fill.cx * 100}%`} cy={`${fill.cy * 100}%`} r={`${fill.r * 100}%`}>
          <Stop offset="0" stopColor={fill.inner} />
          <Stop offset="1" stopColor={fill.outer} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
});

/**
 * Card in one of the theme's surface tones — a white card on the paper in
 * light mode, warm charcoal in dark, with the colored tones as quiet tints.
 * Every tone provides its ink to descendants, so `useAppTheme()` inside a card
 * already returns the matching chips and hairlines, and inside `ink` the
 * inverted accent. Tones whose fill has a lit corner draw it as a radial wash.
 *
 *   <Surface style={styles.card}>…</Surface>
 */
export const Surface = ({ children, tone = "neutral", style, testID }: SurfaceProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const surface = theme.surfaces[tone];

  return (
    <View style={[styles.surface, { borderColor: surface.border, backgroundColor: surface.fill.outer }, style]} testID={testID}>
      {surface.fill.inner !== surface.fill.outer ? <SurfaceFill fill={surface.fill} /> : null}
      <SurfaceToneContext.Provider value={tone}>{children}</SurfaceToneContext.Provider>
    </View>
  );
};

/** Solid pill button. Neutral is the white secondary pill; `tone="ink"` is the black primary. */
export const SurfaceButton = ({ children, tone = "neutral", style, disabled, ...pressableProps }: SurfaceButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} {...pressableProps}>
      {({ pressed }) => (
        <Surface
          tone={tone}
          style={[styles.button, disabled && styles.buttonDisabled, pressed && styles.buttonPressed, style]}
        >
          {children}
        </Surface>
      )}
    </Pressable>
  );
};

/** Small rounded chip that takes its fill from the surface it sits on. */
export const SurfacePill = ({ children, style }: SurfacePillProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return <View style={[styles.pill, style]}>{children}</View>;
};
