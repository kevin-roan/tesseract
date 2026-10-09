import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
    },
    panel: {
      flex: 1,
      width: "100%",
    },
  });
}
