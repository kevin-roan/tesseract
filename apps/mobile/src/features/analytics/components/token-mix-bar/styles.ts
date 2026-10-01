import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const MIX_BAR_HEIGHT = 16;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    mix: {
      gap: theme.spacing.md,
    },
    bar: {
      flexDirection: "row",
      height: MIX_BAR_HEIGHT,
      gap: theme.spacing.xxs,
      borderRadius: theme.radius.xs,
      overflow: "hidden",
    },
    empty: {
      flex: 1,
      backgroundColor: theme.colors.backgroundSelected,
    },
  });
}
