import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    message: {
      paddingHorizontal: theme.spacing.xs,
    },
    actions: {
      gap: theme.spacing.sm,
    },
  });
}
