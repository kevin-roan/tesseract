import { StyleSheet } from "react-native";

import { Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.base,
    },
    copy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
