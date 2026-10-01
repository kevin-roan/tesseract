import { StyleSheet } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

import { ControlHeight, ZIndex, type Theme } from "@/theme";

export default function createStyles(theme: Theme, safeArea: EdgeInsets) {
  const edge = theme.spacing.sm;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    bar: {
      position: "absolute",
      top: safeArea.top + edge,
      left: safeArea.left + edge,
      right: safeArea.right + edge,
      zIndex: ZIndex.header,
    },
    exit: {
      position: "absolute",
      top: safeArea.top + edge,
      right: safeArea.right + edge,
      zIndex: ZIndex.header,
    },
    exitButton: {
      width: ControlHeight.md,
      height: ControlHeight.md,
    },
  });
}
