import { StyleSheet } from "react-native";

import { Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    surface: {
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    pill: {
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      overflow: "hidden",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      backgroundColor: theme.colors.backgroundElement,
    },
    button: {
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
    },
    buttonDisabled: {
      opacity: Opacity.disabled,
    },
  });
}
