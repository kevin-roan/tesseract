import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
    },
    rank: {
      minWidth: theme.spacing.xl,
      height: theme.spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    rankText: {
      fontVariant: ["tabular-nums"],
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    end: {
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    value: {
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
  });
}
