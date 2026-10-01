import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    bubble: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-end",
      gap: theme.spacing.md,
      width: theme.maxBubbleWidth,
      padding: theme.spacing.sm,
      paddingRight: theme.spacing.base,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    toggle: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
    },
    pressed: {
      backgroundColor: theme.colors.accentPressed,
    },
    duration: {
      fontVariant: ["tabular-nums"],
    },
  });
}
