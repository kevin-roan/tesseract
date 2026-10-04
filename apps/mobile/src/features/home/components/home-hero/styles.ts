import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.gutter,
    },
    headline: {
      marginTop: theme.spacing.xs,
      alignItems: "center",
    },
  });
}
