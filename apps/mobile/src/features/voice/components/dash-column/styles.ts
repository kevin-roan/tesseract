import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    column: {
      flex: 1,
      alignSelf: "stretch",
      justifyContent: "center",
    },
    window: {
      justifyContent: "center",
      overflow: "hidden",
    },
    stack: {
      gap: theme.spacing.xxs,
    },
    dash: {
      height: theme.spacing.xxs,
      borderRadius: theme.radius.full,
    },
  });
}
