import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    group: {
      gap: theme.spacing.sm,
    },
    summary: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: theme.spacing.xs,
    },
    value: {
      fontVariant: ["tabular-nums"],
    },
    caretOpen: {
      transform: [{ rotate: "90deg" }],
    },
    rail: {
      paddingLeft: theme.spacing.md,
      borderLeftWidth: StyleSheet.hairlineWidth * 2,
      borderLeftColor: theme.colors.divider,
    },
    steps: {
      gap: theme.spacing.sm,
    },
  });
}
