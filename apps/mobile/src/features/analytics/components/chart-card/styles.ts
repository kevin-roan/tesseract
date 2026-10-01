import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.base,
      padding: theme.spacing.base,
      borderRadius: theme.radius.xl,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    head: {
      gap: theme.spacing.xxs,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    toggle: {
      paddingVertical: theme.spacing.xs,
    },
    pressed: {
      opacity: 0.6,
    },
  });
}
