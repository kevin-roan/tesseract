import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    block: {
      overflow: "hidden",
      borderCurve: "continuous",
      backgroundColor: theme.colors.backgroundElement,
    },
    list: {
      gap: theme.spacing.md,
    },
    shimmer: {
      ...StyleSheet.absoluteFill,
    },
  });
}
