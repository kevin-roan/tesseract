import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

const BAR_HEIGHT = 12;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    bar: {
      flexDirection: "row",
      height: BAR_HEIGHT,
      gap: theme.spacing.xxs,
    },
    segment: {
      minWidth: BAR_HEIGHT,
      borderRadius: theme.radius.full,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.full,
    },
    swatch: {
      width: theme.spacing.sm,
      height: theme.spacing.sm,
      borderRadius: theme.radius.full,
    },
  });
}
