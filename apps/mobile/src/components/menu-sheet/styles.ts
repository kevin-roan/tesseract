import { StyleSheet } from "react-native";

import { MinTouchTarget, Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const check = theme.spacing.lg;

  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: MinTouchTarget,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
    },
    selected: {
      backgroundColor: theme.colors.backgroundElement,
    },
    disabled: {
      opacity: Opacity.disabled,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    check: {
      width: check,
      height: check,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accent,
    },
  });
}
