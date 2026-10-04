import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    segment: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    bar: {
      height: theme.spacing.xs,
      borderRadius: theme.radius.xs,
      backgroundColor: theme.colors.backgroundSelected,
    },
    active: {
      backgroundColor: theme.colors.text,
    },
  });
}
