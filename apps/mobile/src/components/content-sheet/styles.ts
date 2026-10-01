import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const corner = theme.radius.sheet;

  return StyleSheet.create({
    /** Cancels the scaffold's gutter and section gap, then overlaps the hero by one corner. */
    sheet: {
      flexGrow: 1,
      gap: theme.sectionGap,
      marginTop: -(theme.sectionGap + corner),
      marginHorizontal: -theme.gutter,
      marginBottom: -theme.sectionGap,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.sectionGap,
      paddingBottom: theme.sectionGap,
      borderTopLeftRadius: corner,
      borderTopRightRadius: corner,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: theme.colors.background,
    },
  });
}
