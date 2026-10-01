import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    table: {
      borderTopWidth: BorderWidth.thin,
      borderColor: theme.colors.divider,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderBottomWidth: BorderWidth.thin,
      borderColor: theme.colors.divider,
    },
    first: {
      flex: 1.4,
    },
    cell: {
      flex: 1,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
  });
}
