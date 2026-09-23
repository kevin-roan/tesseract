import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    body: {
      flex: 1,
      gap: theme.spacing.base,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.base,
    },
    summary: {
      gap: theme.spacing.md,
    },
  });
}
