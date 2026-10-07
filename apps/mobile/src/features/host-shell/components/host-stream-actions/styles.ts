import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    action: {
      flex: 1,
    },
  });
}
