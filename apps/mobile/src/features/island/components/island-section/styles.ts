import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    rows: {
      gap: theme.spacing.xs,
    },
  });
}
