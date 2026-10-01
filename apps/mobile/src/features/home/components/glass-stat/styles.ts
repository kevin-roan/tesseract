import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      flex: 1,
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
      borderRadius: theme.radius.xl,
    },
  });
}
