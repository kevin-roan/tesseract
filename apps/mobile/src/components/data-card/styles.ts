import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.base,
      padding: theme.spacing.base,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    title: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      gap: theme.spacing.sm,
    },
    titleText: {
      flexShrink: 1,
    },
    axis: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: -theme.spacing.sm,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
  });
}
