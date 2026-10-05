import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.xs,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.md,
    },
  });
}
