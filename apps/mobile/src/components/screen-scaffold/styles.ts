import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    fill: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    content: {
      flexGrow: 1,
      gap: theme.sectionGap,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.sectionGap,
    },
    footer: {
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.md,
    },
  });
}
