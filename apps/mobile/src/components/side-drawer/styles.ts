import { StyleSheet } from "react-native";

import { ZIndex, type Theme } from "@/theme";

export default function createStyles(theme: Theme, width: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    scrimTouch: {
      flex: 1,
    },
    panel: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width,
      zIndex: ZIndex.drawer,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
  });
}
