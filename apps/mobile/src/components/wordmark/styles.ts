import { StyleSheet } from "react-native";

import { WordmarkFace, type Theme } from "@/theme";

/** Same proportions as the splash wordmark: letters tracked 0.36 em, a hairline rule 0.9 em under the baseline. */
const TRACKING = 0.36;

export default function createStyles(theme: Theme, size: number) {
  const tracking = size * TRACKING;

  return StyleSheet.create({
    root: {
      alignItems: "center",
    },
    letters: {
      fontFamily: WordmarkFace,
      fontSize: size,
      lineHeight: size * 1.3,
      letterSpacing: tracking,
      // Tracking also trails the last letter; pad the start so the word stays centered.
      paddingLeft: tracking,
      color: theme.colors.text,
      textTransform: "uppercase",
      textAlign: "center",
    },
    rule: {
      width: size * 3.8,
      height: StyleSheet.hairlineWidth,
      marginTop: size * 0.3,
      backgroundColor: theme.colors.borderStrong,
    },
  });
}
