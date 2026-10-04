import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    rows: {
      gap: theme.spacing.xs,
    },
    divider: {
      marginBottom: theme.spacing.xs,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.divider,
    },
  });
}
