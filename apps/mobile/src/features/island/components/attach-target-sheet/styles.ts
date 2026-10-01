import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

const MAX_HEIGHT_RATIO = 0.7;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    scroll: {
      maxHeight: theme.height * MAX_HEIGHT_RATIO,
    },
    content: {
      gap: theme.spacing.base,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.base,
    },
    group: {
      gap: theme.spacing.xs,
    },
  });
}
