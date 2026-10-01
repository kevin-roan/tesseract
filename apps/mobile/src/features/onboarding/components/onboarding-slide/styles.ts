import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, width: number) {
  return StyleSheet.create({
    page: {
      width,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.sectionGap,
      paddingHorizontal: theme.gutter,
    },
    hero: {
      alignItems: "center",
      justifyContent: "center",
    },
    copy: {
      gap: theme.spacing.md,
      maxWidth: theme.maxContentWidth,
    },
    centered: {
      textAlign: "center",
    },
  });
}
