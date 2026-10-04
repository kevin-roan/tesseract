import { StyleSheet } from "react-native";

import { type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
    },
    cell: {
      flexGrow: 1,
      flexBasis: theme.isTablet ? "22%" : "45%",
    },
    tile: {
      flexGrow: 1,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
  });
}
