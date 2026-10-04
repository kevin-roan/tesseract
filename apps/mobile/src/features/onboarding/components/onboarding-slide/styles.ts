import { StyleSheet } from "react-native";

import { type Theme } from "@/theme";

export default function createStyles(theme: Theme, width: number) {
  return StyleSheet.create({
    page: {
      width,
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: theme.gutter,
    },
    column: {
      width: "100%",
      maxWidth: theme.maxContentWidth,
      alignSelf: "center",
      gap: theme.sectionGap,
    },
    copy: {
      gap: theme.spacing.sm,
    },
  });
}
