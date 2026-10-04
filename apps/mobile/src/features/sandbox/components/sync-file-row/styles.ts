import { StyleSheet } from "react-native";

import { IconSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
    },
    code: {
      minWidth: IconSize.lg,
      height: IconSize.lg,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
    },
    path: {
      flex: 1,
      minWidth: 0,
    },
    check: {
      width: IconSize.md,
      height: IconSize.md,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: theme.colors.textTertiary,
    },
    checkOn: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent,
    },
  });
}
