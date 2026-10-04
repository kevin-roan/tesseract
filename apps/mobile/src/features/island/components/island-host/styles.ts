import { StyleSheet } from "react-native";

import { ZIndex, type Theme } from "@/theme";

export default function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    layer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: ZIndex.overlay,
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
    fill: {
      flex: 1,
    },
    card: {
      transformOrigin: "top",
    },
    island: {
      position: "absolute",
      top: topInset + theme.spacing.sm,
      left: theme.spacing.base,
      right: theme.spacing.base,
      alignItems: "stretch",
    },
  });
}
