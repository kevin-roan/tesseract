import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
    },
    head: {
      gap: theme.spacing.xs,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    toggle: {
      minHeight: ControlHeight.sm,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.base,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
  });
}
