import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    title: {
      padding: theme.spacing.base,
    },
    field: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    notice: {
      padding: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    othersTitle: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
    },
  });
}
