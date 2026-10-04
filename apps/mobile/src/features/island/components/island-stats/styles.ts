import { StyleSheet } from "react-native";

import { type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    stat: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    value: {
      fontVariant: ["tabular-nums"],
    },
    rule: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      backgroundColor: theme.colors.divider,
    },
  });
}
