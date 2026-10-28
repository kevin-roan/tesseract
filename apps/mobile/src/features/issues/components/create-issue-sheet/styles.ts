import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.base,
      paddingBottom: theme.spacing.sm,
    },
    field: {
      gap: theme.spacing.xs,
    },
  });
}
