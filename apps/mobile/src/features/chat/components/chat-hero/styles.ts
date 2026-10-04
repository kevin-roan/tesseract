import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.xl,
    },
    titles: {
      alignItems: "center",
      gap: theme.spacing.md,
    },
    title: {
      textAlign: "center",
    },
    subtitle: {
      textAlign: "center",
    },
    mark: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
