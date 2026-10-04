import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    tool: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.codeBackground,
    },
    toolError: {
      borderColor: theme.colors.danger,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
  });
}
