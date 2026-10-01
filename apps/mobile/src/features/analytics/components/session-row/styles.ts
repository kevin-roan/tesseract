import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: BorderWidth.thin,
      borderColor: theme.colors.divider,
    },
    rank: {
      width: theme.spacing.xl,
      fontVariant: ["tabular-nums"],
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    end: {
      alignItems: "flex-end",
      gap: theme.spacing.xxs,
    },
    value: {
      fontVariant: ["tabular-nums"],
    },
    pressed: {
      opacity: 0.6,
    },
  });
}
