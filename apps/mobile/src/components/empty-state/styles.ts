import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.lg,
      paddingVertical: theme.spacing["3xl"],
      paddingHorizontal: theme.spacing.xl,
    },
    copy: {
      gap: theme.spacing.sm,
      maxWidth: theme.maxContentWidth,
    },
    centered: {
      textAlign: "center",
    },
  });
}
