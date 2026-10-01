import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const DOT_SIZE = 8;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    dot: {
      height: DOT_SIZE,
      width: DOT_SIZE,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.text,
    },
  });
}
