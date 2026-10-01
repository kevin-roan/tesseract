import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.base,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surfaceElevated,
    },
    icon: {
      width: theme.spacing["2xl"],
      height: theme.spacing["2xl"],
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.backgroundElement,
    },
    copy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    pressed: {
      opacity: 0.8,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
