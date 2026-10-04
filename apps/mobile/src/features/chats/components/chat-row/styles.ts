import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.base,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    body: {
      flex: 1,
      gap: theme.spacing.sm,
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
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    project: {
      flexShrink: 1,
      maxWidth: "60%",
      overflow: "hidden",
    },
    spacer: {
      flex: 1,
    },
  });
}
