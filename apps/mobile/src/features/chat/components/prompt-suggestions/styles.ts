import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 0,
      marginHorizontal: -theme.gutter,
    },
    content: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
    },
  });
}
