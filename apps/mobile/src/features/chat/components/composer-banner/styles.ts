import { StyleSheet } from "react-native";

import { ControlHeight, Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.base,
      borderRadius: theme.radius.xl,
      borderCurve: "continuous",
      backgroundColor: theme.colors.backgroundElement,
    },
    copy: {
      gap: theme.spacing.xxs,
    },
    action: {
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      ...Shadows.level1,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
