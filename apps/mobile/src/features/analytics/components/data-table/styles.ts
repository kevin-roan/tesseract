import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    table: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.divider,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.divider,
    },
    first: {
      flex: 1.4,
      fontVariant: ["tabular-nums"],
    },
    cell: {
      flex: 1,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
  });
}
