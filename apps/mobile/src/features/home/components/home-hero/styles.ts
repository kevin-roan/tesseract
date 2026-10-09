import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    panel: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: theme.spacing.sm,
      overflow: "hidden",
    },
  });
}
