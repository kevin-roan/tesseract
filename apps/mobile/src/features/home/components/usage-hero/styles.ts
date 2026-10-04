import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const CHART_HEIGHT = 148;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.xl,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.card,
    },
    figure: {
      gap: theme.spacing.xs,
    },
    figureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    metric: {
      flex: 1,
    },
    footer: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    skeleton: {
      gap: theme.spacing.md,
    },
  });
}
