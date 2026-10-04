import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, type Theme } from "@/theme";

export function onMediaColor(theme: Theme) {
  return theme.scheme === "light" ? theme.colors.textInverse : theme.colors.text;
}

export default function createStyles(theme: Theme, large: boolean) {
  const thumbSize = large ? ControlHeight.xl * 2 : ControlHeight.xl;

  return StyleSheet.create({
    thumb: {
      width: thumbSize,
      height: thumbSize,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceElevated,
    },
    image: {
      ...StyleSheet.absoluteFill,
    },
    thumbOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.overlay,
    },
    removeFloating: {
      position: "absolute",
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      padding: theme.spacing.xxs,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      backgroundColor: theme.colors.overlay,
    },
    removeInline: {
      padding: theme.spacing.xxs,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: ControlHeight.xl,
      maxWidth: theme.maxBubbleWidth,
      paddingLeft: theme.spacing.xs,
      paddingRight: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    failed: {
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.danger,
    },
    body: {
      flexShrink: 1,
      gap: theme.spacing.xxs,
    },
  });
}
