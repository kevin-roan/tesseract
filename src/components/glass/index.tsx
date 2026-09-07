import { useMemo } from "react";
import {
  Pressable,
  type PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from "@callstack/liquid-glass";

import { useAppTheme } from "@/hooks/use-app-theme";
import { BlurIntensity, type Theme } from "@/theme";

import createStyles from "./styles";

export type GlassEffect = "clear" | "regular";

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  effect?: GlassEffect;
  interactive?: boolean;
  tintOnFallback?: string;
}

export interface GlassButtonProps
  extends Omit<PressableProps, "style" | "children"> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  effect?: GlassEffect;
  tintOnFallback?: string;
}

export interface GlassPillProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  effect?: GlassEffect;
  tintOnFallback?: string;
}

const intensityFor = (effect: GlassEffect) =>
  effect === "clear" ? BlurIntensity.light : BlurIntensity.medium;

function useGlassStyles(theme: Theme) {
  return useMemo(() => createStyles(theme), [theme]);
}

interface FallbackGlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  baseStyle: ViewStyle;
  effect: GlassEffect;
  tintOnFallback?: string;
  theme: Theme;
}

/**
 * Blur + tint stand-in for platforms without native liquid glass (Android, web,
 * and iOS below 26).
 */
const FallbackGlass: React.FC<FallbackGlassProps> = ({
  children,
  style,
  baseStyle,
  effect,
  tintOnFallback,
  theme,
}) => {
  const flattened = StyleSheet.flatten([baseStyle, style]);
  const cornerStyle: ViewStyle = {
    borderRadius: flattened.borderRadius,
    borderCurve: flattened.borderCurve,
  };

  return (
    <View style={[baseStyle, style]}>
      <BlurView
        style={[StyleSheet.absoluteFill, cornerStyle]}
        intensity={intensityFor(effect)}
        tint={theme.scheme === "dark" ? "dark" : "light"}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          cornerStyle,
          { backgroundColor: tintOnFallback ?? theme.colors.glassFallback },
        ]}
      />
      {children}
    </View>
  );
};

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  effect = "regular",
  interactive = false,
  tintOnFallback,
}) => {
  const theme = useAppTheme();
  const styles = useGlassStyles(theme);

  if (!isLiquidGlassSupported) {
    return (
      <FallbackGlass
        baseStyle={styles.surface}
        style={style}
        effect={effect}
        tintOnFallback={tintOnFallback}
        theme={theme}
      >
        {children}
      </FallbackGlass>
    );
  }

  return (
    <LiquidGlassView
      style={[styles.surface, style]}
      effect={effect}
      interactive={interactive}
    >
      {children}
    </LiquidGlassView>
  );
};

/**
 * Pill-shaped liquid glass button. On iOS 26+ the native view supplies its own
 * press response via `interactive`; elsewhere the blur fallback gets a small
 * scale-down instead.
 */
export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  style,
  effect = "regular",
  tintOnFallback,
  disabled,
  ...pressableProps
}) => {
  const theme = useAppTheme();
  const styles = useGlassStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...pressableProps}
    >
      {({ pressed }) => {
        const stateStyle = [
          disabled && styles.buttonDisabled,
          pressed && !isLiquidGlassSupported && styles.buttonPressed,
          style,
        ];

        return isLiquidGlassSupported ? (
          <LiquidGlassView
            style={[styles.button, stateStyle]}
            effect={effect}
            interactive
          >
            {children}
          </LiquidGlassView>
        ) : (
          <FallbackGlass
            baseStyle={styles.button}
            style={stateStyle}
            effect={effect}
            tintOnFallback={tintOnFallback}
            theme={theme}
          >
            {children}
          </FallbackGlass>
        );
      }}
    </Pressable>
  );
};

export const GlassPill: React.FC<GlassPillProps> = ({
  children,
  style,
  effect = "clear",
  tintOnFallback,
}) => {
  const theme = useAppTheme();
  const styles = useGlassStyles(theme);

  if (!isLiquidGlassSupported) {
    return (
      <FallbackGlass
        baseStyle={styles.pill}
        style={style}
        effect={effect}
        tintOnFallback={tintOnFallback}
        theme={theme}
      >
        {children}
      </FallbackGlass>
    );
  }

  return (
    <LiquidGlassView style={[styles.pill, style]} effect={effect}>
      {children}
    </LiquidGlassView>
  );
};
