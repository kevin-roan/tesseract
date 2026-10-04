import { StyleSheet } from "react-native";

import type { RadiusToken, Theme } from "@/theme";

export default function createStyles(theme: Theme, size: number, radius: RadiusToken) {
  return StyleSheet.create({
    tile: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius[radius],
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
  });
}
