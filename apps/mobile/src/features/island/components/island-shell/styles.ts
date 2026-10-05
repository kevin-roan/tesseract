import { StyleSheet } from "react-native";

import { Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    shell: {
      position: "absolute",
      top: 0,
      left: 0,
      borderCurve: "continuous",
      backgroundColor: theme.colors.surfaceSunken,
      ...Shadows.level3,
    },
    clip: {
      ...StyleSheet.absoluteFill,
      overflow: "hidden",
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
    },
    fill: {
      flex: 1,
    },
  });
}
