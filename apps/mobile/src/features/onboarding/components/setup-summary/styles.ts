import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    stats: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    stat: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });
}
