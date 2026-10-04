import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

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
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bubbleUser,
    },
    toggle: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accent,
    },
    duration: {
      fontVariant: ["tabular-nums"],
    },
  });
}
