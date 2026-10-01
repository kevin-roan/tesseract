import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    tile: {
      flexGrow: 1,
      flexBasis: theme.isTablet ? "22%" : "45%",
      gap: theme.spacing.xxs,
      padding: theme.spacing.base,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
  });
}
