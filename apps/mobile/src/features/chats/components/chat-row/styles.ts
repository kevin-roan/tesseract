import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    top: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
    },
    figure: {
      fontVariant: ["tabular-nums"],
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    project: {
      flexShrink: 1,
    },
  });
}
