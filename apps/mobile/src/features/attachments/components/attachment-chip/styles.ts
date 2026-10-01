import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme, large: boolean) {
  const thumbSize = large ? ControlHeight.xl * 2 : ControlHeight.xl;

  return StyleSheet.create({
    thumb: {
      width: thumbSize,
      height: thumbSize,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: theme.colors.backgroundElement,
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
      borderRadius: theme.radius.full,
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
      paddingRight: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    failed: {
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.danger,
    },
    kind: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.accentMuted,
    },
    body: {
      flexShrink: 1,
      gap: theme.spacing.xxs,
    },
  });
}
