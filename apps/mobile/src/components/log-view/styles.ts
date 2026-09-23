import { StyleSheet } from "react-native";

import { ControlHeight, Shadows, type Theme } from "@/theme";

import { INLINE_HEIGHT_RATIO } from "./lines";

export default function createStyles(theme: Theme) {
  const jump = ControlHeight.md;

  return StyleSheet.create({
    container: {
      flex: 1,
      overflow: "hidden",
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      backgroundColor: theme.colors.codeBackground,
    },
    inline: {
      flex: 0,
      height: Math.round(theme.height * INLINE_HEIGHT_RATIO),
    },
    content: {
      padding: theme.spacing.md,
      gap: theme.spacing.xxs,
    },
    jump: {
      position: "absolute",
      right: theme.spacing.md,
      bottom: theme.spacing.md,
      width: jump,
      height: jump,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
      ...Shadows.level2,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
