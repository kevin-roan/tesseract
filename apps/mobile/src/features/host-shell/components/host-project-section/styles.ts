import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    body: {
      gap: theme.spacing.md,
    },
    path: {
      ...theme.text.code,
      color: theme.colors.textSecondary,
    },
  });
}
