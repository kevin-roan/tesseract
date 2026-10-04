import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    safe: {
      flex: 1,
    },
    content: {
      flex: 1,
      gap: theme.spacing.base,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.base,
    },
    step: {
      flex: 1,
    },
  });
}
