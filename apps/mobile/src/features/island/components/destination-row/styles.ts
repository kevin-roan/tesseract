import { StyleSheet } from "react-native";

import { MinTouchTarget, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: MinTouchTarget,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    copy: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });
}
