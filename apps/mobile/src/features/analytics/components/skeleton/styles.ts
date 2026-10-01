import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    skeleton: {
      gap: theme.sectionGap,
    },
    stack: { gap: theme.spacing.sm },
    tiles: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    tile: { flexGrow: 1, flexBasis: "45%" },
  });
}
